/* Renders a BoolLogic "network" object ({gates, output, inputsUsed}) as an SVG schematic.
   Edges that would otherwise skip across a column (e.g. a depth-1 gate feeding a depth-3
   gate) are broken into a chain of invisible pass-through nodes, one per intermediate
   column, so every wire only ever travels between adjacent columns and never has to cut
   through a gate that lives in between. */
(function (global) {
  const GATE_W = 64;
  const PIN_GAP = 22;
  const MIN_H = 40;
  const COL_GAP = 130;
  const ROW_GAP = 100;
  const MARGIN = 60;

  function gateHeight(nInputs) {
    return Math.max(MIN_H, (nInputs - 1) * PIN_GAP + 40);
  }

  // Build an augmented node list: original gates (cloned) + dummy pass-through nodes
  // inserted on any edge spanning more than one column. Does not mutate `network`.
  function expandWithDummies(network) {
    const origById = {};
    network.gates.forEach(g => origById[g.id] = g);

    function depthOf(ref, memo) {
      if (ref.kind === 'var' || ref.kind === 'const') return 0;
      if (memo.has(ref.id)) return memo.get(ref.id);
      const g = origById[ref.id];
      const d = 1 + Math.max(0, ...g.inputs.map(r => depthOf(r, memo)));
      memo.set(ref.id, d);
      return d;
    }
    const depths = new Map();
    network.gates.forEach(g => depthOf({ kind: 'gate', id: g.id }, depths));

    const nodes = network.gates.map(g => ({ id: g.id, type: g.type, inputs: g.inputs.slice(), label: g.label, depth: depths.get(g.id) }));
    const nodeById = {};
    nodes.forEach(n => nodeById[n.id] = n);

    let dummyCounter = 0;
    nodes.slice().forEach(node => {
      for (let i = 0; i < node.inputs.length; i++) {
        const ref = node.inputs[i];
        const ds = ref.kind === 'gate' ? depths.get(ref.id) : 0;
        const dd = node.depth;
        if (dd - ds > 1) {
          let prevRef = ref;
          for (let cd = ds + 1; cd < dd; cd++) {
            const dummyId = 'dm' + (dummyCounter++);
            const dummyNode = { id: dummyId, type: 'DUMMY', inputs: [prevRef], label: null, depth: cd };
            nodes.push(dummyNode);
            nodeById[dummyId] = dummyNode;
            prevRef = { kind: 'gate', id: dummyId };
          }
          node.inputs[i] = prevRef;
        }
      }
    });

    const maxDepth = Math.max(0, ...nodes.map(n => n.depth));
    return { nodes, nodeById, maxDepth };
  }

  function computeLayout(network) {
    const { nodes, nodeById, maxDepth } = expandWithDummies(network);

    const columns = {};
    nodes.forEach(n => {
      columns[n.depth] = columns[n.depth] || [];
      columns[n.depth].push(n);
    });

    const vars = network.inputsUsed;
    const varPos = {};
    const varColHeight = Math.max(vars.length * ROW_GAP, 80);
    vars.forEach((v, i) => {
      varPos[v] = { x: MARGIN, y: 40 + i * ROW_GAP + (varColHeight - vars.length * ROW_GAP) / 2 };
    });

    const nodePos = {};
    const colXs = {};
    for (let d = 1; d <= maxDepth; d++) colXs[d] = MARGIN + 90 + (d - 1) * COL_GAP;

    let maxColHeight = varColHeight;
    for (let d = 1; d <= maxDepth; d++) {
      maxColHeight = Math.max(maxColHeight, Math.max((columns[d] || []).length * ROW_GAP, 80));
    }

    function sourceY(ref) {
      if (ref.kind === 'var') return varPos[ref.name].y;
      if (ref.kind === 'const') return 40;
      return nodePos[ref.id].cy;
    }
    for (let d = 1; d <= maxDepth; d++) {
      const ns = (columns[d] || []).slice();
      ns.forEach(n => { n._bary = n.inputs.reduce((s, r) => s + sourceY(r), 0) / n.inputs.length; });
      ns.sort((a, b) => a._bary - b._bary || a.id.localeCompare(b.id));
      const n = ns.length;
      ns.forEach((node, i) => {
        const h = node.type === 'DUMMY' ? MIN_H : gateHeight(node.inputs.length);
        const centerY = 40 + i * ROW_GAP + (maxColHeight - n * ROW_GAP) / 2;
        nodePos[node.id] = { x: colXs[d], y: centerY - h / 2, h, w: GATE_W, cy: centerY };
      });
    }

    const width = MARGIN + 90 + Math.max(0, maxDepth - 1) * COL_GAP + GATE_W + 140;
    const height = maxColHeight + 80;
    return { varPos, nodePos, nodeById, maxDepth, width, height };
  }

  function pinPositions(pos, nInputs) {
    if (nInputs === 1) return [pos.h / 2];
    const arr = [];
    const usable = pos.h - 16;
    for (let i = 0; i < nInputs; i++) arr.push(8 + (usable * i) / (nInputs - 1));
    return arr;
  }

  function gateBody(type, x, y, w, h, label) {
    if (type === 'DUMMY') return { svg: '', outX: x, outY: y + h / 2 };
    const bubble = (type === 'NAND' || type === 'NOR' || type === 'NOT');
    const r = 5;
    let shape = '';
    let outX = x + w;
    if (type === 'AND' || type === 'NAND') {
      const rad = h / 2;
      shape = `<path class="gate-shape" d="M ${x} ${y} H ${x + w - rad} A ${rad} ${rad} 0 0 1 ${x + w - rad} ${y + h} H ${x} Z" />`;
      outX = x + w;
    } else if (type === 'OR' || type === 'NOR') {
      const w2 = w;
      shape = `<path class="gate-shape" d="
        M ${x} ${y}
        Q ${x + w2 * 0.35} ${y} ${x + w2 * 0.62} ${y + h * 0.12}
        Q ${x + w2 * 1.05} ${y + h * 0.4} ${x + w2 * 1.18} ${y + h / 2}
        Q ${x + w2 * 1.05} ${y + h * 0.6} ${x + w2 * 0.62} ${y + h * 0.88}
        Q ${x + w2 * 0.35} ${y + h} ${x} ${y + h}
        Q ${x + w2 * 0.22} ${y + h / 2} ${x} ${y}
        Z" />`;
      outX = x + w2 * 1.18;
    } else if (type === 'NOT') {
      shape = `<path class="gate-shape" d="M ${x} ${y} L ${x} ${y + h} L ${x + w} ${y + h / 2} Z" />`;
      outX = x + w;
    }
    let bubbleEl = '';
    let finalOutX = outX;
    if (bubble) {
      finalOutX = outX + r * 2;
      bubbleEl = `<circle class="gate-bubble" cx="${outX + r}" cy="${y + h / 2}" r="${r}" />`;
    }
    const labelEl = label ? `<text class="gate-label" x="${x + w * 0.32}" y="${y + h + 14}">${escapeXml(label)}</text>` : '';
    return { svg: shape + bubbleEl + labelEl, outX: finalOutX, outY: y + h / 2 };
  }

  function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;');
  }

  function wire(x1, y1, x2, y2, extraClass) {
    const midx = (x1 + x2) / 2;
    return `<path class="wire ${extraClass || ''}" d="M ${x1} ${y1} H ${midx} V ${y2} H ${x2}" />`;
  }

  function renderNetworkSVG(network) {
    if (network.output.kind === 'const') {
      const val = network.output.value;
      return `<svg viewBox="0 0 320 120" class="gate-svg"><text x="20" y="65" class="const-label">F = ${val}  (constant, no gates required)</text></svg>`;
    }
    const layout = computeLayout(network);
    const { varPos, nodePos, nodeById, width, height } = layout;

    let svgParts = [];
    Object.entries(varPos).forEach(([v, p]) => {
      svgParts.push(`<line class="wire" x1="${p.x - 34}" y1="${p.y}" x2="${p.x}" y2="${p.y}" />`);
      svgParts.push(`<text class="var-label" x="${p.x - 40}" y="${p.y + 5}" text-anchor="end">${escapeXml(v)}</text>`);
      svgParts.push(`<circle class="pin-dot" cx="${p.x}" cy="${p.y}" r="2.5" />`);
    });

    function outputPointFor(ref) {
      if (ref.kind === 'var') return { x: varPos[ref.name].x, y: varPos[ref.name].y };
      const gp = nodePos[ref.id];
      const node = nodeById[ref.id];
      const body = gateBody(node.type, gp.x, gp.y, gp.w, gp.h, null);
      return { x: body.outX, y: body.outY };
    }

    // dummies drawn first (so wires layer above their pass-through points), then real gates
    const dummies = Object.values(nodeById).filter(n => n.type === 'DUMMY');
    const realGates = Object.values(nodeById).filter(n => n.type !== 'DUMMY');

    [...dummies, ...realGates].forEach(node => {
      const gp = nodePos[node.id];
      const body = gateBody(node.type, gp.x, gp.y, gp.w, gp.h, node.label);
      if (body.svg) svgParts.push(`<g class="gate gate-${node.type.toLowerCase()}">${body.svg}</g>`);
      const pins = pinPositions(gp, node.inputs.length);
      node.inputs.forEach((ref, i) => {
        const src = outputPointFor(ref);
        const destY = gp.y + pins[i];
        svgParts.push(wire(src.x, src.y, gp.x, destY));
        if (node.type !== 'DUMMY') svgParts.push(`<circle class="pin-dot" cx="${gp.x}" cy="${destY}" r="2" />`);
      });
    });

    const outPt = outputPointFor(network.output);
    const finalX = outPt.x + 46;
    svgParts.push(wire(outPt.x, outPt.y, finalX, outPt.y, 'wire-out'));
    svgParts.push(`<text class="out-label" x="${finalX + 6}" y="${outPt.y + 5}">F</text>`);
    svgParts.push(`<circle class="pin-dot pin-out" cx="${outPt.x}" cy="${outPt.y}" r="2.5" />`);

    const totalW = Math.max(width, finalX + 60);
    return `<svg viewBox="0 0 ${totalW} ${height}" class="gate-svg" preserveAspectRatio="xMidYMid meet">${svgParts.join('\n')}</svg>`;
  }

  global.BoolDiagram = { renderNetworkSVG };
})(typeof window !== 'undefined' ? window : globalThis);

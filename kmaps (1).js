/**
 * BoolSynth — Interactive K-Map Solver Module
 * 2, 3, and 4-variable Karnaugh Maps with Gray-code coordinate mapping,
 * toroidal wrap-around grouping, visual overlay rendering, and minimal SOP/POS synthesis.
 */
(function () {
  'use strict';

  const ALL_VARS = ['A', 'B', 'C', 'D'];
  const GROUP_PALETTE = [
    { name: 'Emerald', fill: 'rgba(107, 255, 176, 0.18)', stroke: '#6bffb0', text: '#6bffb0' },
    { name: 'Amber',   fill: 'rgba(255, 190, 92, 0.18)',  stroke: '#ffbe5c', text: '#ffbe5c' },
    { name: 'Cyan',    fill: 'rgba(92, 225, 230, 0.18)',  stroke: '#5ce1e6', text: '#5ce1e6' },
    { name: 'Rose',    fill: 'rgba(255, 107, 139, 0.18)', stroke: '#ff6b8b', text: '#ff6b8b' },
    { name: 'Violet',  fill: 'rgba(179, 136, 255, 0.18)', stroke: '#b388ff', text: '#b388ff' },
    { name: 'Coral',   fill: 'rgba(255, 138, 101, 0.18)', stroke: '#ff8a65', text: '#ff8a65' }
  ];

  // Gray code layouts
  const CONFIGS = {
    2: {
      numVars: 2,
      rowVars: ['A'],
      colVars: ['B'],
      rowGray: [0, 1],
      colGray: [0, 1],
      rowLabels: ['0', '1'],
      colLabels: ['0', '1'],
      rows: 2,
      cols: 2,
      cellSize: 72,
      mintermOf: (r, c) => (CONFIGS[2].rowGray[r] << 1) | CONFIGS[2].colGray[c]
    },
    3: {
      numVars: 3,
      rowVars: ['A'],
      colVars: ['B', 'C'],
      rowGray: [0, 1],
      colGray: [0, 1, 3, 2], // 00, 01, 11, 10
      rowLabels: ['0', '1'],
      colLabels: ['00', '01', '11', '10'],
      rows: 2,
      cols: 4,
      cellSize: 68,
      mintermOf: (r, c) => (CONFIGS[3].rowGray[r] << 2) | CONFIGS[3].colGray[c]
    },
    4: {
      numVars: 4,
      rowVars: ['A', 'B'],
      colVars: ['C', 'D'],
      rowGray: [0, 1, 3, 2], // 00, 01, 11, 10
      colGray: [0, 1, 3, 2], // 00, 01, 11, 10
      rowLabels: ['00', '01', '11', '10'],
      colLabels: ['00', '01', '11', '10'],
      rows: 4,
      cols: 4,
      cellSize: 64,
      mintermOf: (r, c) => (CONFIGS[4].rowGray[r] << 2) | CONFIGS[4].colGray[c]
    }
  };

  // State
  let currentNumVars = 3;
  let cellValues = new Array(1 << currentNumVars).fill(0);
  let optimizationTarget = 'sop'; // 'sop' or 'pos'
  let activeHoveredGroupIndex = null;

  // Preset definitions
  const PRESETS = {
    2: [
      { name: 'XOR (A ⊕ B)', ones: [1, 2], dcs: [] },
      { name: 'XNOR / Equivalence', ones: [0, 3], dcs: [] },
      { name: 'NAND Function', ones: [0, 1, 2], dcs: [] },
      { name: 'Implication (A → B)', ones: [0, 1, 3], dcs: [] }
    ],
    3: [
      { name: 'Majority Vote (2 of 3)', ones: [3, 5, 6, 7], dcs: [] },
      { name: 'Odd Parity (A ⊕ B ⊕ C)', ones: [1, 2, 4, 7], dcs: [] },
      { name: 'Full Adder Sum', ones: [1, 2, 4, 7], dcs: [] },
      { name: 'Full Adder Carry', ones: [3, 5, 6, 7], dcs: [] },
      { name: '2:1 MUX (A=Sel, B=D0, C=D1)', ones: [2, 3, 5, 7], dcs: [] },
      { name: 'Don\'t-Care Example', ones: [0, 2, 5], dcs: [3, 7] }
    ],
    4: [
      { name: '4-Corners Group (m0, m2, m8, m10)', ones: [0, 2, 8, 10], dcs: [] },
      { name: 'BCD Valid (< 10) with Don\'t Cares', ones: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], dcs: [10, 11, 12, 13, 14, 15] },
      { name: '7-Segment Display: Segment A', ones: [0, 2, 3, 5, 6, 7, 8, 9], dcs: [10, 11, 12, 13, 14, 15] },
      { name: '7-Segment Display: Segment E', ones: [0, 2, 6, 8], dcs: [10, 11, 12, 13, 14, 15] },
      { name: '7-Segment Display: Segment G', ones: [2, 3, 4, 5, 6, 8, 9], dcs: [10, 11, 12, 13, 14, 15] },
      { name: '4-Variable Parity', ones: [1, 2, 4, 7, 8, 11, 13, 14], dcs: [] },
      { name: 'Wrap-Around Column Group', ones: [0, 4, 12, 8, 2, 6, 14, 10], dcs: [] }
    ]
  };

  /* ===================== K-Map Grouping Logic ===================== */

  /**
   * Find all rectangular sub-cubes of powers of 2 (1, 2, 4, 8, 16) with toroidal wrap-around.
   */
  function solveKMapGroups(numVars, values, target) {
    const cfg = CONFIGS[numVars];
    const R = cfg.rows;
    const C = cfg.cols;
    const totalCells = 1 << numVars;

    // Target values: for SOP we group 1s and Xs (values 1 and 2). For POS we group 0s and Xs (values 0 and 2).
    const targetVal = target === 'sop' ? 1 : 0;
    const allowedVals = target === 'sop' ? [1, 2] : [0, 2];

    const targetIndices = [];
    for (let i = 0; i < totalCells; i++) {
      if (values[i] === targetVal) targetIndices.push(i);
    }

    if (targetIndices.length === 0) {
      return {
        groups: [],
        expression: target === 'sop' ? '0' : '1',
        isConstant: true,
        constantValue: target === 'sop' ? '0' : '1'
      };
    }

    if (targetIndices.length + values.filter(v => v === 2).length === totalCells) {
      return {
        groups: [{
          r: 0, c: 0, h: R, w: C,
          cells: Array.from({ length: totalCells }, (_, i) => i),
          term: '1',
          isEssential: true,
          color: GROUP_PALETTE[0]
        }],
        expression: target === 'sop' ? '1' : '0',
        isConstant: true,
        constantValue: target === 'sop' ? '1' : '0'
      };
    }

    // Candidate heights and widths (must be powers of 2 and <= R, C)
    const validDims = [];
    const heights = [1, 2, 4].filter(h => h <= R);
    const widths = [1, 2, 4].filter(w => w <= C);

    for (const h of heights) {
      for (const w of widths) {
        validDims.push({ h, w, size: h * w });
      }
    }
    // Sort largest subcubes first
    validDims.sort((a, b) => b.size - a.size);

    // Find all valid rectangular groups
    const candidateGroups = [];

    for (const { h, w, size } of validDims) {
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) {
          const cells = [];
          let allAllowed = true;
          let hasTarget = false;

          for (let dr = 0; dr < h; dr++) {
            for (let dc = 0; dc < w; dc++) {
              const rr = (r + dr) % R;
              const cc = (c + dc) % C;
              const m = cfg.mintermOf(rr, cc);
              cells.push(m);
              const val = values[m];
              if (!allowedVals.includes(val)) {
                allAllowed = false;
                break;
              }
              if (val === targetVal) hasTarget = true;
            }
            if (!allAllowed) break;
          }

          if (allAllowed && hasTarget) {
            // Deduplicate cell sets
            const cellSetKey = [...cells].sort((a, b) => a - b).join(',');
            if (!candidateGroups.some(g => g.key === cellSetKey)) {
              candidateGroups.push({
                r, c, h, w, size,
                cells,
                key: cellSetKey,
                term: computeGroupTerm(cells, numVars, target)
              });
            }
          }
        }
      }
    }

    // Filter prime implicants (groups not strictly subset of any larger candidate group)
    const primeImplicants = candidateGroups.filter(g1 => {
      const g1Set = new Set(g1.cells);
      return !candidateGroups.some(g2 => {
        if (g2.size <= g1.size) return false;
        const g2Set = new Set(g2.cells);
        return g1.cells.every(c => g2Set.has(c));
      });
    });

    // Find minimal cover using Essential Prime Implicants + Greedy cover
    const cover = findMinimalGroupCover(primeImplicants, targetIndices);

    // Assign colors
    cover.forEach((g, idx) => {
      g.color = GROUP_PALETTE[idx % GROUP_PALETTE.length];
    });

    const expression = formatExpression(cover, target);

    return {
      groups: cover,
      primeImplicants,
      expression,
      isConstant: false
    };
  }

  /**
   * Determine the Boolean term for a group of minterms.
   */
  function computeGroupTerm(minterms, numVars, target) {
    const vars = ALL_VARS.slice(0, numVars);
    const literals = [];

    for (let bit = 0; bit < numVars; bit++) {
      const shift = numVars - 1 - bit;
      const firstBitVal = (minterms[0] >> shift) & 1;
      const isConstant = minterms.every(m => ((m >> shift) & 1) === firstBitVal);

      if (isConstant) {
        const v = vars[bit];
        if (target === 'sop') {
          literals.push(firstBitVal === 1 ? v : v + "'");
        } else {
          // For POS, 0 becomes V and 1 becomes V' in maxterm sums
          literals.push(firstBitVal === 0 ? v : v + "'");
        }
      }
    }

    if (literals.length === 0) return '1';

    if (target === 'sop') {
      return literals.join('');
    } else {
      return literals.length === 1 ? literals[0] : '(' + literals.join(' + ') + ')';
    }
  }

  /**
   * Minimal cover algorithm: Extracts Essential PIs first, then greedily picks best covers.
   */
  function findMinimalGroupCover(primeImplicants, targetMinterms) {
    const uncovered = new Set(targetMinterms);
    const chosen = [];
    const mintermCoverage = {};

    targetMinterms.forEach(m => mintermCoverage[m] = []);

    primeImplicants.forEach((pi, idx) => {
      pi.cells.forEach(m => {
        if (mintermCoverage[m]) mintermCoverage[m].push(idx);
      });
    });

    // 1. Essential Prime Implicants
    targetMinterms.forEach(m => {
      if (mintermCoverage[m].length === 1) {
        const piIdx = mintermCoverage[m][0];
        const pi = primeImplicants[piIdx];
        if (!chosen.includes(pi)) {
          pi.isEssential = true;
          chosen.push(pi);
          pi.cells.forEach(c => uncovered.delete(c));
        }
      }
    });

    // 2. Greedy selection for remaining uncovered
    const remainingPIs = primeImplicants.filter(pi => !chosen.includes(pi));

    while (uncovered.size > 0 && remainingPIs.length > 0) {
      // Pick PI covering the most remaining uncovered minterms, preferring larger PI size
      remainingPIs.sort((a, b) => {
        const covA = a.cells.filter(c => uncovered.has(c)).length;
        const covB = b.cells.filter(c => uncovered.has(c)).length;
        if (covB !== covA) return covB - covA;
        return b.size - a.size;
      });

      const best = remainingPIs.shift();
      const newCovers = best.cells.filter(c => uncovered.has(c)).length;
      if (newCovers > 0) {
        best.isEssential = false;
        chosen.push(best);
        best.cells.forEach(c => uncovered.delete(c));
      }
    }

    return chosen;
  }

  function formatExpression(groups, target) {
    if (groups.length === 0) return target === 'sop' ? '0' : '1';
    if (groups.length === 1 && groups[0].term === '1') return target === 'sop' ? '1' : '0';

    if (target === 'sop') {
      return groups.map(g => g.term).join(' + ');
    } else {
      return groups.map(g => g.term).join(' · ');
    }
  }

  /* ===================== SVG Overlays Rendering ===================== */

  /**
   * Generates SVG overlay paths for K-Map groups, supporting toroidal wrap-around.
   */
  function renderGroupOverlaysSVG(groups, numVars) {
    const cfg = CONFIGS[numVars];
    const cellSize = cfg.cellSize;
    const pad = 6;
    const cornerRadius = 10;
    const svgWidth = cfg.cols * cellSize;
    const svgHeight = cfg.rows * cellSize;

    let svg = `<svg class="kmap-overlay-svg" viewBox="0 0 ${svgWidth} ${svgHeight}" preserveAspectRatio="none">`;

    groups.forEach((g, gIdx) => {
      const isHovered = activeHoveredGroupIndex === gIdx;
      const isAnyHovered = activeHoveredGroupIndex !== null;
      const opacity = isAnyHovered ? (isHovered ? 1 : 0.22) : 1;
      const filter = isHovered ? `filter: drop-shadow(0 0 6px ${g.color.stroke});` : '';

      // Determine wrap behavior
      const wrapsH = (g.c + g.w) > cfg.cols;
      const wrapsV = (g.r + g.h) > cfg.rows;

      // Handle 4-corners wrap in 4x4
      if (numVars === 4 && g.h === 2 && g.w === 2 && g.r === 3 && g.c === 3) {
        // Special 4 corners case: (r=3, c=3) wrapping horizontally to c=0 and vertically to r=0
        // Cells: m0 (r=0,c=0), m2 (r=0,c=3), m8 (r=3,c=0), m10 (r=3,c=3)
        const corners = [
          { r: 0, c: 0 },
          { r: 0, c: 3 },
          { r: 3, c: 0 },
          { r: 3, c: 3 }
        ];
        corners.forEach(cn => {
          const x = cn.c * cellSize + pad;
          const y = cn.r * cellSize + pad;
          const w = cellSize - 2 * pad;
          const h = cellSize - 2 * pad;
          svg += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${cornerRadius}" ry="${cornerRadius}"
            fill="${g.color.fill}" stroke="${g.color.stroke}" stroke-width="${isHovered ? 2.5 : 1.8}"
            stroke-dasharray="4 2" style="opacity:${opacity}; ${filter} transition: all .15s;" />`;
        });
        return;
      }

      // Decompose wrapped rectangles into sub-rectangles
      const subRects = [];
      const colRanges = wrapsH
        ? [{ c: g.c, w: cfg.cols - g.c }, { c: 0, w: (g.c + g.w) % cfg.cols }]
        : [{ c: g.c, w: g.w }];
      const rowRanges = wrapsV
        ? [{ r: g.r, h: cfg.rows - g.r }, { r: 0, h: (g.r + g.h) % cfg.rows }]
        : [{ r: g.r, h: g.h }];

      for (const rSeg of rowRanges) {
        for (const cSeg of colRanges) {
          subRects.push({
            x: cSeg.c * cellSize + pad,
            y: rSeg.r * cellSize + pad,
            w: cSeg.w * cellSize - 2 * pad,
            h: rSeg.h * cellSize - 2 * pad,
            isSplit: wrapsH || wrapsV
          });
        }
      }

      subRects.forEach(sr => {
        const strokeDash = sr.isSplit ? 'stroke-dasharray="6 3"' : '';
        svg += `<rect x="${sr.x}" y="${sr.y}" width="${sr.w}" height="${sr.h}"
          rx="${cornerRadius}" ry="${cornerRadius}"
          fill="${g.color.fill}" stroke="${g.color.stroke}"
          stroke-width="${isHovered ? 2.5 : 1.8}" ${strokeDash}
          style="opacity:${opacity}; ${filter} transition: all .15s;" />`;
      });
    });

    svg += '</svg>';
    return svg;
  }

  /* ===================== DOM & View Controller ===================== */

  function initKMapModule() {
    renderVarSelector();
    renderPresets();
    renderKMapGrid();
    solveAndRenderResults();
    bindGlobalEvents();
  }

  function renderVarSelector() {
    const container = document.getElementById('kmap-var-selector');
    if (!container) return;
    container.innerHTML = `
      <div class="tabs">
        <button class="kmap-tab-btn ${currentNumVars === 2 ? 'active' : ''}" data-vars="2">2 Variables (A, B)</button>
        <button class="kmap-tab-btn ${currentNumVars === 3 ? 'active' : ''}" data-vars="3">3 Variables (A, B, C)</button>
        <button class="kmap-tab-btn ${currentNumVars === 4 ? 'active' : ''}" data-vars="4">4 Variables (A, B, C, D)</button>
      </div>
    `;

    container.querySelectorAll('.kmap-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const n = parseInt(btn.dataset.vars, 10);
        if (n !== currentNumVars) {
          currentNumVars = n;
          cellValues = new Array(1 << currentNumVars).fill(0);
          renderVarSelector();
          renderPresets();
          renderKMapGrid();
          solveAndRenderResults();
        }
      });
    });
  }

  function renderPresets() {
    const select = document.getElementById('kmap-preset-select');
    if (!select) return;
    const list = PRESETS[currentNumVars] || [];
    let html = '<option value="">-- Load a preset example --</option>';
    list.forEach((p, idx) => {
      html += `<option value="${idx}">${p.name}</option>`;
    });
    select.innerHTML = html;
  }

  function renderKMapGrid() {
    const cfg = CONFIGS[currentNumVars];
    const gridContainer = document.getElementById('kmap-grid-wrapper');
    if (!gridContainer) return;

    const rowVarLabel = cfg.rowVars.join('');
    const colVarLabel = cfg.colVars.join('');

    let html = `
      <div class="kmap-matrix-box">
        <div class="kmap-corner-label">
          <span class="var-row">${rowVarLabel}</span>
          <span class="corner-slash">╲</span>
          <span class="var-col">${colVarLabel}</span>
        </div>
        <div class="kmap-col-headers">
    `;

    cfg.colLabels.forEach(lbl => {
      html += `<div class="kmap-col-header">${lbl}</div>`;
    });

    html += `</div><div class="kmap-body-row">
      <div class="kmap-row-headers">`;

    cfg.rowLabels.forEach(lbl => {
      html += `<div class="kmap-row-header">${lbl}</div>`;
    });

    html += `</div><div class="kmap-grid kmap-grid-${currentNumVars}v" id="kmap-cells-grid">`;

    for (let r = 0; r < cfg.rows; r++) {
      for (let c = 0; c < cfg.cols; c++) {
        const m = cfg.mintermOf(r, c);
        const val = cellValues[m];
        const valLabel = val === 2 ? 'X' : val;
        html += `
          <div class="kmap-cell" data-minterm="${m}" data-r="${r}" data-c="${c}" data-val="${valLabel}">
            <span class="kmap-minterm-badge">m${m}</span>
            <span class="kmap-cell-val">${valLabel}</span>
          </div>
        `;
      }
    }

    html += `
          <div id="kmap-svg-overlay-container" class="kmap-overlay-layer"></div>
        </div>
      </div>
    </div>`;

    gridContainer.innerHTML = html;

    // Attach cell click handlers
    gridContainer.querySelectorAll('.kmap-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const m = parseInt(cell.dataset.minterm, 10);
        // Cycle: 0 -> 1 -> X (2) -> 0
        cellValues[m] = (cellValues[m] + 1) % 3;
        const newVal = cellValues[m];
        const label = newVal === 2 ? 'X' : newVal;
        cell.dataset.val = label;
        cell.querySelector('.kmap-cell-val').textContent = label;
        solveAndRenderResults();
      });
    });
  }

  function solveAndRenderResults() {
    const result = solveKMapGroups(currentNumVars, cellValues, optimizationTarget);
    const dualResult = solveKMapGroups(currentNumVars, cellValues, optimizationTarget === 'sop' ? 'pos' : 'sop');

    // 1. Render Overlays
    const overlayContainer = document.getElementById('kmap-svg-overlay-container');
    if (overlayContainer) {
      overlayContainer.innerHTML = renderGroupOverlaysSVG(result.groups, currentNumVars);
    }

    // 2. Render Expressions
    const sopExpr = optimizationTarget === 'sop' ? result.expression : dualResult.expression;
    const posExpr = optimizationTarget === 'pos' ? result.expression : dualResult.expression;

    const sopEl = document.getElementById('kmap-res-sop');
    const posEl = document.getElementById('kmap-res-pos');
    if (sopEl) sopEl.textContent = 'F = ' + sopExpr;
    if (posEl) posEl.textContent = 'F = ' + posExpr;

    // 3. Render Canonical Minterms / Maxterms List
    const ones = [], dcs = [], zeros = [];
    cellValues.forEach((v, i) => {
      if (v === 1) ones.push(i);
      else if (v === 2) dcs.push(i);
      else zeros.push(i);
    });

    const canonEl = document.getElementById('kmap-res-canonical');
    if (canonEl) {
      let canonHtml = `<div><span class="lbl-inline">SOP Minterms:</span> <strong style="color:var(--signal)">Σm(${ones.join(', ') || '∅'})</strong>`;
      if (dcs.length > 0) canonHtml += ` + <span style="color:var(--amber)">d(${dcs.join(', ')})</span>`;
      canonHtml += `</div><div style="margin-top:6px;"><span class="lbl-inline">POS Maxterms:</span> <strong style="color:var(--signal)">ΠM(${zeros.join(', ') || '∅'})</strong>`;
      if (dcs.length > 0) canonHtml += ` · <span style="color:var(--amber)">d(${dcs.join(', ')})</span>`;
      canonHtml += `</div>`;
      canonEl.innerHTML = canonHtml;
    }

    // 4. Render Group Breakdown Table
    const breakdownEl = document.getElementById('kmap-groups-table');
    if (breakdownEl) {
      if (result.groups.length === 0) {
        breakdownEl.innerHTML = `<div class="empty-hint">No active groupings (Function is constant ${result.constantValue || '0'}).</div>`;
      } else {
        let tHtml = `
          <table class="tt">
            <thead>
              <tr>
                <th>Group</th>
                <th>Size</th>
                <th>Covered Minterms</th>
                <th>Resulting Term</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
        `;
        result.groups.forEach((g, idx) => {
          tHtml += `
            <tr class="kmap-group-row" data-gidx="${idx}">
              <td>
                <span class="group-color-pill" style="background:${g.color.fill}; border:1.5px solid ${g.color.stroke}; color:${g.color.text};">
                  Loop ${idx + 1}
                </span>
              </td>
              <td><strong>${g.size}</strong> cell${g.size > 1 ? 's' : ''}</td>
              <td><code>${g.cells.map(c => 'm' + c).join(', ')}</code></td>
              <td><strong style="color:${g.color.stroke}; font-size:15px;">${g.term}</strong></td>
              <td><span class="badge ${g.isEssential ? 'badge-essential' : 'badge-pi'}">${g.isEssential ? 'Essential PI' : 'Prime Implicant'}</span></td>
            </tr>
          `;
        });
        tHtml += '</tbody></table>';
        breakdownEl.innerHTML = tHtml;

        // Hover events on table rows to highlight overlay
        breakdownEl.querySelectorAll('.kmap-group-row').forEach(row => {
          row.addEventListener('mouseenter', () => {
            activeHoveredGroupIndex = parseInt(row.dataset.gidx, 10);
            if (overlayContainer) overlayContainer.innerHTML = renderGroupOverlaysSVG(result.groups, currentNumVars);
          });
          row.addEventListener('mouseleave', () => {
            activeHoveredGroupIndex = null;
            if (overlayContainer) overlayContainer.innerHTML = renderGroupOverlaysSVG(result.groups, currentNumVars);
          });
        });
      }
    }
  }

  function bindGlobalEvents() {
    // Preset dropdown
    const presetSelect = document.getElementById('kmap-preset-select');
    if (presetSelect) {
      presetSelect.addEventListener('change', () => {
        const val = presetSelect.value;
        if (val === '') return;
        const p = PRESETS[currentNumVars][parseInt(val, 10)];
        if (!p) return;
        cellValues.fill(0);
        p.ones.forEach(m => cellValues[m] = 1);
        p.dcs.forEach(d => cellValues[d] = 2);
        renderKMapGrid();
        solveAndRenderResults();
      });
    }

    // Clear / Fill / Invert / Random
    const btnClear = document.getElementById('kmap-btn-clear');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        cellValues.fill(0);
        renderKMapGrid();
        solveAndRenderResults();
      });
    }

    const btnFill = document.getElementById('kmap-btn-fill');
    if (btnFill) {
      btnFill.addEventListener('click', () => {
        cellValues.fill(1);
        renderKMapGrid();
        solveAndRenderResults();
      });
    }

    const btnInvert = document.getElementById('kmap-btn-invert');
    if (btnInvert) {
      btnInvert.addEventListener('click', () => {
        cellValues = cellValues.map(v => (v === 1 ? 0 : v === 0 ? 1 : 2));
        renderKMapGrid();
        solveAndRenderResults();
      });
    }

    const btnRandom = document.getElementById('kmap-btn-random');
    if (btnRandom) {
      btnRandom.addEventListener('click', () => {
        cellValues = cellValues.map(() => {
          const r = Math.random();
          return r < 0.45 ? 1 : r < 0.85 ? 0 : 2;
        });
        renderKMapGrid();
        solveAndRenderResults();
      });
    }

    // Optimization target SOP vs POS
    document.querySelectorAll('input[name="kmap-opt-mode"]').forEach(radio => {
      radio.addEventListener('change', (e) => {
        optimizationTarget = e.target.value;
        solveAndRenderResults();
      });
    });

    // Bridge: "Synthesize Circuit in BoolSynth"
    const btnSendToSynth = document.getElementById('kmap-btn-send-to-synth');
    if (btnSendToSynth) {
      btnSendToSynth.addEventListener('click', () => {
        const ones = [], dcs = [];
        cellValues.forEach((v, i) => {
          if (v === 1) ones.push(i);
          else if (v === 2) dcs.push(i);
        });

        // Set inputs in BoolSynth's Minterm Tab
        const mmNumVarsSelect = document.getElementById('mm-numvars');
        const mmListInput = document.getElementById('mm-list');
        const mmDcInput = document.getElementById('mm-dc');
        const mmTabBtn = document.querySelector('.tab-btn[data-tab="mm"]');
        const minRadio = document.querySelector('input[name="mm-mode"][value="min"]');

        if (mmNumVarsSelect) mmNumVarsSelect.value = currentNumVars;
        if (minRadio) minRadio.checked = true;
        if (mmListInput) mmListInput.value = ones.join(', ');
        if (mmDcInput) mmDcInput.value = dcs.join(', ');
        if (mmTabBtn) mmTabBtn.click();

        // Switch to BoolSynth tab
        if (window.BoolUI && window.BoolUI.switchTab) {
          window.BoolUI.switchTab('module-boolsynth');
          window.BoolUI.showToast(`Exported ${currentNumVars}-variable function to BoolSynth!`, 'success');
        }

        // Trigger synthesize
        const synthBtn = document.getElementById('synthesize-btn');
        if (synthBtn) synthBtn.click();
      });
    }
  }

  // Hook for ui.js activation
  if (window.BoolUI && window.BoolUI.registerModuleHook) {
    window.BoolUI.registerModuleHook('module-kmaps', () => {
      solveAndRenderResults();
    });
  }

  // Self-init on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initKMapModule);
  } else {
    initKMapModule();
  }
})();

(function () {
  const L = window.BoolLogic;
  const D = window.BoolDiagram;
  const ALL_VARS = ['A', 'B', 'C', 'D', 'E', 'F'];

  let ttState = null; // { n, vars, values: [0/1/2 per row] }  2 = don't care

  /* ---------------- tabs ---------------- */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('panel-' + btn.dataset.tab).classList.add('active');
    });
  });

  /* ---------------- truth-table input builder ---------------- */
  const ttVarsSelect = document.getElementById('tt-numvars');
  function buildTTInput() {
    const n = parseInt(ttVarsSelect.value, 10);
    const vars = ALL_VARS.slice(0, n);
    const rows = 1 << n;
    if (!ttState || ttState.n !== n) {
      ttState = { n, vars, values: new Array(rows).fill(0) };
    }
    const container = document.getElementById('tt-input-container');
    let html = '<div class="tt-scroll"><table class="tt"><thead><tr>';
    vars.forEach(v => html += `<th>${v}</th>`);
    html += '<th>Output</th></tr></thead><tbody>';
    for (let i = 0; i < rows; i++) {
      html += '<tr>';
      for (let b = 0; b < n; b++) html += `<td>${(i >> (n - 1 - b)) & 1}</td>`;
      const v = ttState.values[i];
      const label = v === 2 ? 'X' : v;
      html += `<td class="out-cell" data-idx="${i}" data-v="${label}">${label}</td>`;
      html += '</tr>';
    }
    html += '</tbody></table></div>';
    container.innerHTML = html;
    container.querySelectorAll('.out-cell').forEach(cell => {
      cell.addEventListener('click', () => {
        const idx = parseInt(cell.dataset.idx, 10);
        ttState.values[idx] = (ttState.values[idx] + 1) % 3;
        const label = ttState.values[idx] === 2 ? 'X' : ttState.values[idx];
        cell.dataset.v = label;
        cell.textContent = label;
      });
    });
  }
  ttVarsSelect.addEventListener('change', buildTTInput);
  buildTTInput();

  /* ---------------- example chips ---------------- */
  document.querySelectorAll('.example-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('expr-input').value = chip.dataset.expr;
      document.querySelector('.tab-btn[data-tab="expr"]').click();
    });
  });

  /* ---------------- gather input spec from active tab ---------------- */
  function getActiveTab() {
    return document.querySelector('.tab-btn.active').dataset.tab;
  }

  function gatherSpec() {
    const tab = getActiveTab();
    if (tab === 'tt') {
      const n = ttState.n;
      const vars = ttState.vars;
      const minterms = [], dontcares = [];
      const originalRows = [];
      ttState.values.forEach((v, i) => {
        if (v === 1) minterms.push(i);
        else if (v === 2) dontcares.push(i);
        originalRows.push(v === 2 ? null : v);
      });
      return { vars, numVars: n, minterms, dontcares, originalRows, sourceLabel: 'truth table you entered' };
    }
    if (tab === 'mm') {
      const n = parseInt(document.getElementById('mm-numvars').value, 10);
      const vars = ALL_VARS.slice(0, n);
      const mode = document.querySelector('input[name="mm-mode"]:checked').value;
      const listStr = document.getElementById('mm-list').value.trim();
      const dcStr = document.getElementById('mm-dc').value.trim();
      const parseList = (s) => s.length === 0 ? [] : s.split(/[\s,]+/).filter(x => x.length).map(x => {
        const num = parseInt(x, 10);
        if (isNaN(num)) throw new Error(`"${x}" is not a valid term index`);
        if (num < 0 || num >= (1 << n)) throw new Error(`Index ${num} is out of range for ${n} variables (valid: 0–${(1 << n) - 1})`);
        return num;
      });
      const list = parseList(listStr);
      const dontcares = parseList(dcStr);
      if (list.length === 0) throw new Error(`Enter at least one ${mode === 'min' ? 'minterm' : 'maxterm'} index.`);
      let minterms;
      if (mode === 'min') minterms = list;
      else {
        const all = Array.from({ length: 1 << n }, (_, i) => i);
        minterms = all.filter(i => !list.includes(i) && !dontcares.includes(i));
      }
      const originalRows = new Array(1 << n).fill(0);
      minterms.forEach(m => originalRows[m] = 1);
      dontcares.forEach(d => originalRows[d] = null);
      return { vars, numVars: n, minterms, dontcares, originalRows, sourceLabel: `${mode === 'min' ? 'minterms' : 'maxterms'} you entered` };
    }
    if (tab === 'expr') {
      const str = document.getElementById('expr-input').value.trim();
      if (!str) throw new Error('Enter a Boolean expression.');
      const ast = L.parseExpression(str);
      const varSet = L.collectVars(ast);
      if (varSet.size === 0) throw new Error('No variables found in the expression.');
      if (varSet.size > 6) throw new Error('This tool supports up to 6 variables.');
      const vars = Array.from(varSet).sort();
      const n = vars.length;
      const minterms = [], originalRows = [];
      for (let i = 0; i < (1 << n); i++) {
        const env = {};
        for (let b = 0; b < n; b++) env[vars[b]] = (i >> (n - 1 - b)) & 1;
        const val = L.evalAst(ast, env);
        originalRows.push(val);
        if (val === 1) minterms.push(i);
      }
      return { vars, numVars: n, minterms, dontcares: [], originalRows, sourceLabel: `expression "${str}"`, exprStr: str };
    }
  }

  /* ---------------- rendering results ---------------- */
  function envForIndex(i, n, vars) {
    const env = {};
    for (let b = 0; b < n; b++) env[vars[b]] = (i >> (n - 1 - b)) & 1;
    return env;
  }

  function renderResults(spec) {
    const { vars, numVars, minterms, dontcares, originalRows } = spec;
    const { sop, pos } = L.minimize(minterms, dontcares, numVars, vars);
    const basicNet = L.buildBasicNetwork(sop.terms, vars);
    const nandNet = L.buildNANDNetwork(sop.terms, vars);
    const norNet = L.buildNORNetwork(pos.groups, vars);

    // --- simplified expression ---
    document.getElementById('res-expr').textContent = sop.str;
    document.getElementById('res-pos-expr').textContent = pos.str;

    // --- literal / gate stats ---
    const literalCount = sop.terms.reduce((a, t) => a + t.length, 0);
    const termCount = sop.terms.length;
    document.getElementById('stat-literals').textContent = literalCount;
    document.getElementById('stat-terms').textContent = termCount;
    document.getElementById('stat-vars').textContent = numVars;
    document.getElementById('stat-rows').textContent = 1 << numVars;

    // --- truth table ---
    let ttHtml = '<div class="tt-scroll"><table class="tt"><thead><tr>';
    vars.forEach(v => ttHtml += `<th>${v}</th>`);
    ttHtml += '<th>Given F</th><th>Simplified F</th></tr></thead><tbody>';
    for (let i = 0; i < (1 << numVars); i++) {
      const env = envForIndex(i, numVars, vars);
      const simp = L.evalSOP(sop.terms, env);
      const given = originalRows[i];
      ttHtml += '<tr>';
      for (let b = 0; b < numVars; b++) ttHtml += `<td>${env[vars[b]]}</td>`;
      ttHtml += `<td>${given === null ? 'X' : given}</td>`;
      ttHtml += `<td>${simp}</td>`;
      ttHtml += '</tr>';
    }
    ttHtml += '</tbody></table></div>';
    document.getElementById('res-tt').innerHTML = ttHtml;

    // --- diagrams ---
    document.getElementById('res-basic-expr').textContent = 'F = ' + sop.str;
    document.getElementById('res-basic-svg').innerHTML = D.renderNetworkSVG(basicNet);
    document.getElementById('res-nand-svg').innerHTML = D.renderNetworkSVG(nandNet);
    document.getElementById('res-nor-svg').innerHTML = D.renderNetworkSVG(norNet);

    // --- verification ---
    let allPass = true;
    let vHtml = '<div class="tt-scroll"><table class="verify"><thead><tr>';
    vars.forEach(v => vHtml += `<th>${v}</th>`);
    vHtml += '<th>Given</th><th>Simplified</th><th>NAND-only</th><th>NOR-only</th><th>Match</th></tr></thead><tbody>';
    for (let i = 0; i < (1 << numVars); i++) {
      const env = envForIndex(i, numVars, vars);
      const given = originalRows[i];
      const simp = L.evalSOP(sop.terms, env);
      const nand = L.simulateNetwork(nandNet, env);
      const nor = L.simulateNetwork(norNet, env);
      const isDC = given === null;
      const coreMatch = (simp === nand && nand === nor);
      const fullMatch = isDC ? coreMatch : (coreMatch && simp === given);
      if (!fullMatch) allPass = false;
      vHtml += '<tr>';
      for (let b = 0; b < numVars; b++) vHtml += `<td>${env[vars[b]]}</td>`;
      vHtml += `<td class="${isDC ? 'dc' : ''}">${isDC ? 'X' : given}</td>`;
      vHtml += `<td>${simp}</td><td>${nand}</td><td>${nor}</td>`;
      vHtml += `<td class="${fullMatch ? 'ok' : 'bad'}">${fullMatch ? '✓' : '✗'}</td>`;
      vHtml += '</tr>';
    }
    vHtml += '</tbody></table></div>';
    document.getElementById('res-verify-table').innerHTML = vHtml;

    const banner = document.getElementById('verify-banner');
    banner.className = 'verify-banner ' + (allPass ? 'pass' : 'fail');
    banner.innerHTML = `<span class="dot"></span> ${allPass
      ? 'Verified — the given function, simplified expression, NAND-only circuit and NOR-only circuit agree on every input combination.'
      : 'Mismatch detected — see the table below for the exact rows that disagree.'}`;

    document.getElementById('results').style.display = 'block';
    document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------------- synthesize button ---------------- */
  document.getElementById('synthesize-btn').addEventListener('click', () => {
    const errBox = document.getElementById('error-box');
    errBox.style.display = 'none';
    try {
      const spec = gatherSpec();
      if (spec.minterms.length + spec.dontcares.length === 0 && getActiveTab() !== 'expr') {
        // allow all-zero function (valid), just proceed
      }
      renderResults(spec);
    } catch (e) {
      errBox.textContent = 'Error: ' + e.message;
      errBox.style.display = 'block';
      errBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });
})();

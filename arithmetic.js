/**
 * BoolSynth — Binary Arithmetic Engine Module
 * 1-bit to 4-bit Binary Adders & Subtractors, Half/Full Adders & Subtractors,
 * 2's Complement Adder-Subtractor with interactive bitwise inputs, dynamic carry/borrow toggle,
 * and ripple carry visualizer.
 */
(function () {
  'use strict';

  // Sub-modules state
  let currentSubTab = 'multibit'; // 'multibit', 'fa', 'ha', 'fs', 'hs'
  let multiBitWidth = 4;          // 1, 2, 3, 4
  let multiBitMode = 'add';       // 'add' or 'sub'

  // Multi-bit inputs
  let bitsA = [0, 1, 0, 1];       // [A3, A2, A1, A0] MSB to LSB
  let bitsB = [0, 0, 1, 1];       // [B3, B2, B1, B0]
  let cinBit = 0;                 // 0 or 1 (interactive in both ADD and SUB)

  // Discrete 1-bit gate states
  let haState = { a: 1, b: 1 };
  let faState = { a: 1, b: 0, cin: 1 };
  let hsState = { a: 1, b: 1 };
  let fsState = { a: 0, b: 1, bin: 1 };

  /* ===================== Logic Computations ===================== */

  function computeHalfAdder(a, b) {
    const sum = a ^ b;
    const cout = a & b;
    return { sum, cout };
  }

  function computeFullAdder(a, b, cin) {
    const axorb = a ^ b;
    const sum = axorb ^ cin;
    const aandb = a & b;
    const cin_and_axorb = cin & axorb;
    const cout = aandb | cin_and_axorb;
    return { sum, cout, axorb, aandb, cin_and_axorb };
  }

  function computeHalfSubtractor(a, b) {
    const diff = a ^ b;
    const notA = a === 0 ? 1 : 0;
    const bout = notA & b;
    return { diff, bout, notA };
  }

  function computeFullSubtractor(a, b, bin) {
    const axorb = a ^ b;
    const diff = axorb ^ bin;
    const notA = a === 0 ? 1 : 0;
    const notAxorB = axorb === 0 ? 1 : 0;
    const term1 = notA & b;
    const term2 = bin & notAxorB;
    const bout = term1 | term2;
    return { diff, bout, axorb, notA, notAxorB, term1, term2 };
  }

  /**
   * Multi-Bit Ripple Carry Adder / Subtractor Calculation
   * Supports dynamic interactive Cin in both ADD and SUB modes.
   */
  function computeMultiBit() {
    const n = multiBitWidth;
    // Extract active bits (LSB is at index n-1)
    const aVals = bitsA.slice(4 - n);
    const bVals = bitsB.slice(4 - n);

    const isSub = multiBitMode === 'sub';
    const effectiveCin = cinBit; // Dynamic 0 or 1 in both modes

    // Process ripple carry chain from LSB (stage 0) to MSB (stage n-1)
    const stages = [];
    let currentCarry = effectiveCin;

    for (let i = n - 1; i >= 0; i--) {
      const bitIndex = (n - 1) - i; // 0 is LSB, n-1 is MSB
      const a = aVals[i];
      const bOriginal = bVals[i];
      // In subtract mode (M=1), B is inverted via XOR: B_i ^ 1 = ~B_i
      const bEffective = isSub ? (bOriginal ^ 1) : bOriginal;

      const fa = computeFullAdder(a, bEffective, currentCarry);
      stages.unshift({
        bitIndex,
        posFromLeft: i,
        a,
        bOriginal,
        bEffective,
        cin: currentCarry,
        sum: fa.sum,
        cout: fa.cout
      });
      currentCarry = fa.cout;
    }

    const sumBits = stages.map(s => s.sum);
    const coutFinal = currentCarry; // Carry out of MSB Full Adder (C_n)
    const boutFinal = isSub ? (coutFinal === 1 ? 0 : 1) : (coutFinal); // In subtraction, Bout = ~C_n

    // Numerical conversions
    const valA = parseInt(aVals.join(''), 2);
    const valB = parseInt(bVals.join(''), 2);
    const rawSumVal = parseInt(sumBits.join(''), 2);
    const valSumUnsigned = isSub ? rawSumVal : (rawSumVal + (coutFinal ? (1 << n) : 0));

    // Signed 2's complement interpretation: range [ -2^(n-1) to 2^(n-1)-1 ]
    function toSigned(bits) {
      const val = parseInt(bits.join(''), 2);
      const msb = bits[0];
      if (msb === 1) {
        return val - (1 << bits.length);
      }
      return val;
    }

    const signedA = toSigned(aVals);
    const signedB = toSigned(bVals);
    const signedSum = toSigned(sumBits);

    // True mathematical result
    let trueMathSigned;
    let operationFormula;
    if (!isSub) {
      trueMathSigned = signedA + signedB + effectiveCin;
      operationFormula = `A + B + Cin = ${signedA} + ${signedB} + ${effectiveCin} = ${trueMathSigned}`;
    } else {
      if (effectiveCin === 1) {
        trueMathSigned = signedA - signedB;
        operationFormula = `A + ~B + 1 = A − B = ${signedA} − ${signedB} = ${trueMathSigned} (2's Complement Subtraction)`;
      } else {
        trueMathSigned = signedA - signedB - 1;
        operationFormula = `A + ~B + 0 = A − B − 1 = ${signedA} − ${signedB} − 1 = ${trueMathSigned} (1's Complement / Subtract with Borrow)`;
      }
    }

    // Signed Overflow Flag: V = C_n ^ C_{n-1}
    const cN = stages[0].cout; // Carry out of MSB
    const cNminus1 = stages[0].cin; // Carry into MSB
    const overflow = (cN ^ cNminus1) === 1;

    // Status Flags
    const zeroFlag = rawSumVal === 0;
    const negFlag = sumBits[0] === 1;

    return {
      n,
      isSub,
      aVals,
      bVals,
      effectiveCin,
      stages,
      sumBits,
      coutFinal,
      boutFinal,
      valA,
      valB,
      valSumUnsigned,
      rawSumVal,
      signedA,
      signedB,
      signedSum,
      trueMathSigned,
      operationFormula,
      overflow,
      zeroFlag,
      negFlag
    };
  }

  /* ===================== DOM & View Controller ===================== */

  function initArithmeticModule() {
    renderSubNav();
    bindEvents();
    renderActiveSubModule();
  }

  function renderSubNav() {
    const navContainer = document.getElementById('arithmetic-subnav');
    if (!navContainer) return;
    navContainer.innerHTML = `
      <div class="tabs">
        <button class="tab-btn arith-tab-btn ${currentSubTab === 'multibit' ? 'active' : ''}" data-tab="multibit">1–4 Bit Adder / Subtractor</button>
        <button class="tab-btn arith-tab-btn ${currentSubTab === 'fa' ? 'active' : ''}" data-tab="fa">Full Adder (1-Bit)</button>
        <button class="tab-btn arith-tab-btn ${currentSubTab === 'ha' ? 'active' : ''}" data-tab="ha">Half Adder (1-Bit)</button>
        <button class="tab-btn arith-tab-btn ${currentSubTab === 'fs' ? 'active' : ''}" data-tab="fs">Full Subtractor (1-Bit)</button>
        <button class="tab-btn arith-tab-btn ${currentSubTab === 'hs' ? 'active' : ''}" data-tab="hs">Half Subtractor (1-Bit)</button>
      </div>
    `;

    navContainer.querySelectorAll('.arith-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        currentSubTab = btn.dataset.tab;
        renderSubNav();
        renderActiveSubModule();
      });
    });
  }

  function renderActiveSubModule() {
    document.querySelectorAll('.arith-view').forEach(v => v.style.display = 'none');
    const activeView = document.getElementById(`arith-view-${currentSubTab}`);
    if (activeView) activeView.style.display = 'block';

    if (currentSubTab === 'multibit') renderMultiBitView();
    else if (currentSubTab === 'fa') renderFullAdderView();
    else if (currentSubTab === 'ha') renderHalfAdderView();
    else if (currentSubTab === 'fs') renderFullSubtractorView();
    else if (currentSubTab === 'hs') renderHalfSubtractorView();
  }

  /* ---------------- Multi-Bit View ---------------- */
  function renderMultiBitView() {
    const container = document.getElementById('arith-view-multibit');
    if (!container) return;

    const data = computeMultiBit();
    const n = data.n;

    let html = `
      <div class="panel">
        <div class="row" style="align-items:center; justify-content:space-between; margin-bottom:20px;">
          <div>
            <label class="field-label">Bit Width</label>
            <div class="tabs" style="margin-bottom:0;">
              ${[1, 2, 3, 4].map(w => `
                <button class="tab-btn arith-width-btn ${multiBitWidth === w ? 'active' : ''}" data-width="${w}">${w}-Bit</button>
              `).join('')}
            </div>
          </div>
          <div>
            <label class="field-label">Operation Mode</label>
            <div class="tabs" style="margin-bottom:0;">
              <button class="tab-btn arith-mode-btn ${multiBitMode === 'add' ? 'active' : ''}" data-mode="add">ADD (A + B)</button>
              <button class="tab-btn arith-mode-btn ${multiBitMode === 'sub' ? 'active' : ''}" data-mode="sub">SUBTRACT (A − B)</button>
            </div>
          </div>
        </div>

        <!-- Interactive Bit Inputs -->
        <div class="arith-inputs-grid">
          <!-- Operand A -->
          <div class="arith-operand-card">
            <div class="card-head">
              <span class="card-title">Operand A</span>
              <span class="card-badge">Dec: ${data.valA} | 2's Compl: ${data.signedA} | Hex: 0x${data.valA.toString(16).toUpperCase()}</span>
            </div>
            <div class="bit-switches-row">
              ${data.aVals.map((bit, idx) => {
                const bitWeight = 1 << (n - 1 - idx);
                const absIdx = (4 - n) + idx;
                return `
                  <div class="bit-toggle-col">
                    <span class="bit-weight">2<sup>${n - 1 - idx}</sup> (${bitWeight})</span>
                    <button class="bit-toggle-btn ${bit === 1 ? 'active' : ''}" data-op="A" data-idx="${absIdx}">${bit}</button>
                    <span class="bit-name">A<sub>${n - 1 - idx}</sub></span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Operand B -->
          <div class="arith-operand-card">
            <div class="card-head">
              <span class="card-title">Operand B</span>
              <span class="card-badge">Dec: ${data.valB} | 2's Compl: ${data.signedB} | Hex: 0x${data.valB.toString(16).toUpperCase()}</span>
            </div>
            <div class="bit-switches-row">
              ${data.bVals.map((bit, idx) => {
                const bitWeight = 1 << (n - 1 - idx);
                const absIdx = (4 - n) + idx;
                return `
                  <div class="bit-toggle-col">
                    <span class="bit-weight">2<sup>${n - 1 - idx}</sup> (${bitWeight})</span>
                    <button class="bit-toggle-btn ${bit === 1 ? 'active' : ''}" data-op="B" data-idx="${absIdx}">${bit}</button>
                    <span class="bit-name">B<sub>${n - 1 - idx}</sub></span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Carry / Borrow In Toggle (Dynamic in both ADD and SUB modes) -->
          <div class="arith-operand-card cin-card">
            <div class="card-head">
              <span class="card-title">${data.isSub ? 'Carry In / Inverted Borrow (C<sub>in</sub>)' : 'Initial Carry In (C<sub>in</sub>)'}</span>
              <span class="card-badge">${data.isSub ? (cinBit === 1 ? "2's Compl (Cin=1)" : "1's Compl (Cin=0)") : `C0 = ${cinBit}`}</span>
            </div>
            <div class="bit-switches-row">
              <div class="bit-toggle-col">
                <span class="bit-weight">C<sub>0</sub></span>
                <button class="bit-toggle-btn ${cinBit === 1 ? 'active' : ''}" data-op="CIN" data-idx="0">${cinBit}</button>
                <span class="bit-name">C<sub>in</sub></span>
              </div>
              <div style="font-size:12px; color:var(--text-dim); line-height:1.4; padding-left:8px; border-left:1px dashed var(--line);">
                ${data.isSub ? `
                  ${cinBit === 1 ? '<strong>C<sub>in</sub>=1:</strong> Standard 2\'s Complement Subtraction (A − B).' : '<strong>C<sub>in</sub>=0:</strong> 1\'s Complement / Subtract with Borrow (A − B − 1).'}
                ` : `
                  ${cinBit === 1 ? 'Carry In is active (adds +1 to LSB).' : 'Normal addition (C<sub>in</sub> = 0).'}
                `}
              </div>
            </div>
          </div>
        </div>

        <!-- Active Operation Formula Banner -->
        <div style="background:var(--bg-alt); border:1px solid var(--line); border-radius:4px; padding:12px 18px; margin-bottom:20px; font-family:var(--font-data); font-size:13px; color:var(--amber);">
          <strong>Active Formula:</strong> <span style="color:var(--text);">${data.operationFormula}</span>
        </div>

        <!-- Ripple Carry Stage Visualizer -->
        <h3 style="font-family:var(--font-display); font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-dim); margin:26px 0 14px;">
          Ripple Stage Visualizer (${n} × Full Adder Slices)
        </h3>
        <div class="ripple-slices-container">
          ${data.stages.map((stage, idx) => {
            return `
              <div class="fa-slice-box">
                <div class="fa-slice-header">FA<sub>${stage.bitIndex}</sub> (Bit ${stage.bitIndex})</div>
                <div class="fa-slice-body">
                  <div class="slice-in-row">
                    <span class="pin-lbl">A<sub>${stage.bitIndex}</sub>: <strong class="val-${stage.a}">${stage.a}</strong></span>
                    <span class="pin-lbl">B<sub>${stage.bitIndex}</sub>: <strong class="val-${stage.bOriginal}">${stage.bOriginal}</strong>
                      ${data.isSub ? `<span style="font-size:11px; color:var(--amber);">→ B'=${stage.bEffective}</span>` : ''}
                    </span>
                  </div>
                  <div class="slice-cin-row">
                    <span class="cin-arrow">← C<sub>in</sub>: <strong class="val-${stage.cin}">${stage.cin}</strong></span>
                  </div>
                  <div class="fa-gate-core">
                    <span class="gate-icon">⊞ Full Adder</span>
                  </div>
                  <div class="slice-out-row">
                    <div class="slice-sum">
                      <span>${data.isSub ? 'Diff' : 'Sum'} S<sub>${stage.bitIndex}</sub></span>
                      <strong class="out-val-pill val-${stage.sum}">${stage.sum}</strong>
                    </div>
                    <div class="slice-cout">
                      <span>C<sub>out</sub> →</span>
                      <strong class="val-${stage.cout}">${stage.cout}</strong>
                    </div>
                  </div>
                </div>
              </div>
            `;
          }).join('<div class="ripple-connector">⟹</div>')}
        </div>

        <!-- Math & Status Summary -->
        <div class="arith-summary-grid" style="margin-top:24px;">
          <!-- Manual Column Math Block -->
          <div class="column-math-card">
            <div class="card-head">
              <span class="card-title">Binary Calculation Breakdown</span>
            </div>
            <pre class="binary-math-pre">
   Carry/C_in:   ${data.stages.map(s => s.cin).join('  ')}  ${data.effectiveCin}
            A:   ${data.aVals.join('  ')}   (${data.valA})
 ${data.isSub ? '−' : '+'}          B:   ${data.bVals.join('  ')}   (${data.valB}) ${data.isSub ? ` [~B: ${data.stages.map(s => s.bEffective).join(' ')}]` : ''}
-----------------------
       Result: ${data.coutFinal ? `(${data.coutFinal}) ` : '    '}${data.sumBits.join('  ')}   (Dec: ${data.isSub ? data.signedSum : data.valSumUnsigned})
            </pre>
          </div>

          <!-- Result & Status Flags -->
          <div class="arith-results-card">
            <div class="card-head">
              <span class="card-title">Output & Status Flags</span>
            </div>
            <div class="stat-row" style="margin-bottom:14px;">
              <div class="stat">
                <span class="n">${data.sumBits.join('')}</span>
                <span class="l">${data.isSub ? 'Difference' : 'Sum'} (Binary)</span>
              </div>
              <div class="stat">
                <span class="n">${data.signedSum}</span>
                <span class="l">Signed 2's Compl</span>
              </div>
              <div class="stat">
                <span class="n">${data.isSub ? data.boutFinal : data.coutFinal}</span>
                <span class="l">${data.isSub ? 'Borrow Out (Bout)' : 'Carry Out (Cout)'}</span>
              </div>
            </div>

            <div class="flags-row">
              <span class="flag-badge ${data.overflow ? 'flag-alert' : 'flag-normal'}">
                <strong>V (Signed Overflow):</strong> ${data.overflow ? '1 (TRIGGERED)' : '0 (OK)'}
              </span>
              <span class="flag-badge ${data.zeroFlag ? 'flag-active' : 'flag-normal'}">
                <strong>Z (Zero Flag):</strong> ${data.zeroFlag ? '1' : '0'}
              </span>
              <span class="flag-badge ${data.negFlag ? 'flag-active' : 'flag-normal'}">
                <strong>N (Negative Flag):</strong> ${data.negFlag ? '1' : '0'}
              </span>
              <span class="flag-badge flag-normal">
                <strong>C<sub>n</sub> (MSB Carry):</strong> ${data.coutFinal}
              </span>
            </div>

            <div class="hint" style="margin-top:12px; color:var(--text-dim); line-height:1.45;">
              ${data.isSub ? `
                <strong>Subtraction Logic:</strong> Evaluated as <code>A + (~B) + Cin</code>.<br/>
                ${data.coutFinal === 1 ? '<span style="color:var(--signal);">✓ C<sub>n</sub> = 1 → No borrow required (A ≥ B). Borrow Out B<sub>out</sub> = 0.</span>' : '<span style="color:var(--amber);">⚠ C<sub>n</sub> = 0 → Borrow required (A < B). Borrow Out B<sub>out</sub> = 1.</span>'}<br/>
                Signed range for ${n}-bit: <strong>${-(1 << (n - 1))} to +${(1 << (n - 1)) - 1}</strong>.
              ` : `
                <strong>Addition Logic:</strong> Evaluated as <code>A + B + Cin</code>.<br/>
                Signed range for ${n}-bit: <strong>${-(1 << (n - 1))} to +${(1 << (n - 1)) - 1}</strong>. Unsigned total: <strong>${data.valSumUnsigned}</strong>.
              `}
              ${data.overflow ? `<div style="color:var(--red); margin-top:4px; font-weight:700;">⚠ Signed Overflow: True math result (${data.trueMathSigned}) exceeds ${n}-bit signed range [${-(1 << (n - 1))}, +${(1 << (n - 1)) - 1}].</div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    // Attach width switch events
    container.querySelectorAll('.arith-width-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        multiBitWidth = parseInt(btn.dataset.width, 10);
        renderMultiBitView();
      });
    });

    // Attach mode switch events
    container.querySelectorAll('.arith-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        multiBitMode = btn.dataset.mode;
        // When switching to sub mode default Cin to 1 (standard 2's compl), when switching to add mode default Cin to 0
        if (multiBitMode === 'sub' && cinBit === 0) {
          cinBit = 1;
        } else if (multiBitMode === 'add' && cinBit === 1) {
          cinBit = 0;
        }
        renderMultiBitView();
      });
    });

    // Attach bit toggle events
    container.querySelectorAll('.bit-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const op = btn.dataset.op;
        const idx = parseInt(btn.dataset.idx, 10);
        if (op === 'A') bitsA[idx] = bitsA[idx] === 1 ? 0 : 1;
        else if (op === 'B') bitsB[idx] = bitsB[idx] === 1 ? 0 : 1;
        else if (op === 'CIN') cinBit = cinBit === 1 ? 0 : 1;
        renderMultiBitView();
      });
    });
  }

  /* ---------------- Full Adder View ---------------- */
  function renderFullAdderView() {
    const container = document.getElementById('arith-view-fa');
    if (!container) return;

    const res = computeFullAdder(faState.a, faState.b, faState.cin);

    let html = `
      <div class="panel">
        <h2><span class="num">FA</span> 1-Bit Full Adder</h2>
        <div class="row" style="align-items:flex-start;">
          <!-- Controls -->
          <div style="flex:1; min-width:280px;">
            <div class="arith-operand-card" style="margin-bottom:18px;">
              <div class="card-head"><span class="card-title">Inputs</span></div>
              <div class="bit-switches-row">
                <div class="bit-toggle-col">
                  <span class="bit-name">Input A</span>
                  <button class="bit-toggle-btn ${faState.a === 1 ? 'active' : ''}" id="fa-toggle-a">${faState.a}</button>
                </div>
                <div class="bit-toggle-col">
                  <span class="bit-name">Input B</span>
                  <button class="bit-toggle-btn ${faState.b === 1 ? 'active' : ''}" id="fa-toggle-b">${faState.b}</button>
                </div>
                <div class="bit-toggle-col">
                  <span class="bit-name">Carry In (C<sub>in</sub>)</span>
                  <button class="bit-toggle-btn ${faState.cin === 1 ? 'active' : ''}" id="fa-toggle-cin">${faState.cin}</button>
                </div>
              </div>
            </div>

            <div class="expr-display" style="font-size:16px; margin-bottom:18px;">
              <span class="lbl">Boolean Equations</span>
              <div>Sum (S) = A ⊕ B ⊕ C<sub>in</sub> = <strong style="color:var(--signal); font-size:20px;">${res.sum}</strong></div>
              <div style="margin-top:6px;">C<sub>out</sub> = (A · B) + (C<sub>in</sub> · (A ⊕ B)) = <strong style="color:var(--signal); font-size:20px;">${res.cout}</strong></div>
            </div>
          </div>

          <!-- Live Gate Diagram SVG -->
          <div style="flex:1.4; min-width:340px;">
            <div class="diagram-card">
              <div class="dc-head">
                <h3>Full Adder Gate-Level Schematic</h3>
              </div>
              <div class="dc-body">
                ${renderFullAdderSVG(faState.a, faState.b, faState.cin, res)}
              </div>
            </div>
          </div>
        </div>

        <!-- Truth table -->
        <h3 style="font-family:var(--font-display); font-size:13px; letter-spacing:.08em; text-transform:uppercase; color:var(--text-dim); margin:20px 0 10px;">
          Full Adder Truth Table
        </h3>
        <table class="tt">
          <thead>
            <tr><th>A</th><th>B</th><th>C<sub>in</sub></th><th>A ⊕ B</th><th>Sum (S)</th><th>C<sub>out</sub></th></tr>
          </thead>
          <tbody>
            ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
              const a = (i >> 2) & 1;
              const b = (i >> 1) & 1;
              const cin = i & 1;
              const r = computeFullAdder(a, b, cin);
              const isActive = (a === faState.a && b === faState.b && cin === faState.cin);
              return `
                <tr style="${isActive ? 'background:rgba(107,255,176,0.12); font-weight:700;' : ''}">
                  <td>${a}</td><td>${b}</td><td>${cin}</td><td>${a ^ b}</td>
                  <td style="color:${r.sum ? 'var(--signal)' : 'var(--text-faint)'};">${r.sum}</td>
                  <td style="color:${r.cout ? 'var(--amber)' : 'var(--text-faint)'};">${r.cout}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.innerHTML = html;

    document.getElementById('fa-toggle-a').addEventListener('click', () => {
      faState.a = faState.a === 1 ? 0 : 1;
      renderFullAdderView();
    });
    document.getElementById('fa-toggle-b').addEventListener('click', () => {
      faState.b = faState.b === 1 ? 0 : 1;
      renderFullAdderView();
    });
    document.getElementById('fa-toggle-cin').addEventListener('click', () => {
      faState.cin = faState.cin === 1 ? 0 : 1;
      renderFullAdderView();
    });
  }

  function renderFullAdderSVG(a, b, cin, res) {
    const sigA = a ? 'var(--signal)' : 'var(--line)';
    const sigB = b ? 'var(--signal)' : 'var(--line)';
    const sigCin = cin ? 'var(--signal)' : 'var(--line)';
    const sigAxorB = res.axorb ? 'var(--signal)' : 'var(--line)';
    const sigSum = res.sum ? 'var(--signal)' : 'var(--line)';
    const sigCout = res.cout ? 'var(--amber)' : 'var(--line)';

    return `
      <svg viewBox="0 0 540 220" class="gate-svg">
        <!-- Inputs -->
        <text x="20" y="45" class="var-label">A = ${a}</text>
        <text x="20" y="85" class="var-label">B = ${b}</text>
        <text x="20" y="165" class="var-label">Cin = ${cin}</text>

        <!-- Input wires -->
        <path d="M75 40 H140" stroke="${sigA}" stroke-width="2" fill="none" />
        <path d="M75 80 H140" stroke="${sigB}" stroke-width="2" fill="none" />
        <path d="M95 40 V120 H140" stroke="${sigA}" stroke-width="2" fill="none" />
        <path d="M110 80 V150 H140" stroke="${sigB}" stroke-width="2" fill="none" />
        <path d="M75 160 H280" stroke="${sigCin}" stroke-width="2" fill="none" />

        <!-- Gate 1: XOR1 (A xor B) -->
        <rect x="140" y="30" width="55" height="40" rx="4" class="gate-shape" />
        <text x="150" y="55" class="gate-label" style="fill:var(--text)">XOR</text>

        <!-- Gate 2: AND1 (A and B) -->
        <rect x="140" y="115" width="55" height="40" rx="4" class="gate-shape" />
        <text x="150" y="140" class="gate-label" style="fill:var(--text)">AND</text>

        <!-- Intermediate wires -->
        <path d="M195 50 H240 V65 H280" stroke="${sigAxorB}" stroke-width="2" fill="none" />
        <path d="M220 50 V185 H280" stroke="${sigAxorB}" stroke-width="2" fill="none" />
        <path d="M195 135 H390" stroke="${res.aandb ? 'var(--signal)' : 'var(--line)'}" stroke-width="2" fill="none" />

        <!-- Gate 3: XOR2 (Sum) -->
        <rect x="280" y="50" width="55" height="40" rx="4" class="gate-shape" />
        <text x="290" y="75" class="gate-label" style="fill:var(--text)">XOR</text>

        <!-- Gate 4: AND2 (Cin and (AxorB)) -->
        <rect x="280" y="160" width="55" height="40" rx="4" class="gate-shape" />
        <text x="290" y="185" class="gate-label" style="fill:var(--text)">AND</text>

        <!-- Gate 5: OR (Cout) -->
        <rect x="390" y="125" width="55" height="50" rx="4" class="gate-shape" />
        <text x="405" y="155" class="gate-label" style="fill:var(--text)">OR</text>

        <!-- Output wires -->
        <path d="M335 70 H490" stroke="${sigSum}" stroke-width="2.5" fill="none" />
        <text x="500" y="75" class="out-label">S = ${res.sum}</text>

        <path d="M335 180 H360 V160 H390" stroke="${res.cin_and_axorb ? 'var(--signal)' : 'var(--line)'}" stroke-width="2" fill="none" />
        <path d="M445 150 H490" stroke="${sigCout}" stroke-width="2.5" fill="none" />
        <text x="500" y="155" style="fill:var(--amber); font-family:var(--font-data); font-weight:700;">Cout = ${res.cout}</text>
      </svg>
    `;
  }

  /* ---------------- Half Adder View ---------------- */
  function renderHalfAdderView() {
    const container = document.getElementById('arith-view-ha');
    if (!container) return;

    const res = computeHalfAdder(haState.a, haState.b);

    let html = `
      <div class="panel">
        <h2><span class="num">HA</span> 1-Bit Half Adder</h2>
        <div class="row">
          <div style="flex:1;">
            <div class="arith-operand-card" style="margin-bottom:18px;">
              <div class="card-head"><span class="card-title">Inputs</span></div>
              <div class="bit-switches-row">
                <div class="bit-toggle-col">
                  <span class="bit-name">Input A</span>
                  <button class="bit-toggle-btn ${haState.a === 1 ? 'active' : ''}" id="ha-toggle-a">${haState.a}</button>
                </div>
                <div class="bit-toggle-col">
                  <span class="bit-name">Input B</span>
                  <button class="bit-toggle-btn ${haState.b === 1 ? 'active' : ''}" id="ha-toggle-b">${haState.b}</button>
                </div>
              </div>
            </div>

            <div class="expr-display" style="font-size:16px; margin-bottom:18px;">
              <span class="lbl">Boolean Equations</span>
              <div>Sum (S) = A ⊕ B = <strong style="color:var(--signal); font-size:20px;">${res.sum}</strong></div>
              <div style="margin-top:6px;">Carry (C) = A · B = <strong style="color:var(--signal); font-size:20px;">${res.cout}</strong></div>
            </div>
          </div>

          <div style="flex:1.2;">
            <table class="tt">
              <thead><tr><th>A</th><th>B</th><th>Sum (S)</th><th>Carry (C)</th></tr></thead>
              <tbody>
                ${[[0,0], [0,1], [1,0], [1,1]].map(([a, b]) => {
                  const r = computeHalfAdder(a, b);
                  const isActive = (a === haState.a && b === haState.b);
                  return `
                    <tr style="${isActive ? 'background:rgba(107,255,176,0.12); font-weight:700;' : ''}">
                      <td>${a}</td><td>${b}</td>
                      <td style="color:${r.sum ? 'var(--signal)' : 'var(--text-faint)'};">${r.sum}</td>
                      <td style="color:${r.cout ? 'var(--amber)' : 'var(--text-faint)'};">${r.cout}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    document.getElementById('ha-toggle-a').addEventListener('click', () => {
      haState.a = haState.a === 1 ? 0 : 1;
      renderHalfAdderView();
    });
    document.getElementById('ha-toggle-b').addEventListener('click', () => {
      haState.b = haState.b === 1 ? 0 : 1;
      renderHalfAdderView();
    });
  }

  /* ---------------- Full Subtractor View ---------------- */
  function renderFullSubtractorView() {
    const container = document.getElementById('arith-view-fs');
    if (!container) return;

    const res = computeFullSubtractor(fsState.a, fsState.b, fsState.bin);

    let html = `
      <div class="panel">
        <h2><span class="num">FS</span> 1-Bit Full Subtractor</h2>
        <div class="row">
          <div style="flex:1;">
            <div class="arith-operand-card" style="margin-bottom:18px;">
              <div class="card-head"><span class="card-title">Inputs</span></div>
              <div class="bit-switches-row">
                <div class="bit-toggle-col">
                  <span class="bit-name">Input A (Minuend)</span>
                  <button class="bit-toggle-btn ${fsState.a === 1 ? 'active' : ''}" id="fs-toggle-a">${fsState.a}</button>
                </div>
                <div class="bit-toggle-col">
                  <span class="bit-name">Input B (Subtrahend)</span>
                  <button class="bit-toggle-btn ${fsState.b === 1 ? 'active' : ''}" id="fs-toggle-b">${fsState.b}</button>
                </div>
                <div class="bit-toggle-col">
                  <span class="bit-name">Borrow In (B<sub>in</sub>)</span>
                  <button class="bit-toggle-btn ${fsState.bin === 1 ? 'active' : ''}" id="fs-toggle-bin">${fsState.bin}</button>
                </div>
              </div>
            </div>

            <div class="expr-display" style="font-size:16px; margin-bottom:18px;">
              <span class="lbl">Boolean Equations</span>
              <div>Diff (D) = A ⊕ B ⊕ B<sub>in</sub> = <strong style="color:var(--signal); font-size:20px;">${res.diff}</strong></div>
              <div style="margin-top:6px;">B<sub>out</sub> = A'B + B<sub>in</sub>(A ⊕ B)' = <strong style="color:var(--signal); font-size:20px;">${res.bout}</strong></div>
            </div>
          </div>

          <div style="flex:1.2;">
            <table class="tt">
              <thead><tr><th>A</th><th>B</th><th>B<sub>in</sub></th><th>Diff (D)</th><th>B<sub>out</sub></th></tr></thead>
              <tbody>
                ${[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
                  const a = (i >> 2) & 1;
                  const b = (i >> 1) & 1;
                  const bin = i & 1;
                  const r = computeFullSubtractor(a, b, bin);
                  const isActive = (a === fsState.a && b === fsState.b && bin === fsState.bin);
                  return `
                    <tr style="${isActive ? 'background:rgba(107,255,176,0.12); font-weight:700;' : ''}">
                      <td>${a}</td><td>${b}</td><td>${bin}</td>
                      <td style="color:${r.diff ? 'var(--signal)' : 'var(--text-faint)'};">${r.diff}</td>
                      <td style="color:${r.bout ? 'var(--red)' : 'var(--text-faint)'};">${r.bout}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    document.getElementById('fs-toggle-a').addEventListener('click', () => {
      fsState.a = fsState.a === 1 ? 0 : 1;
      renderFullSubtractorView();
    });
    document.getElementById('fs-toggle-b').addEventListener('click', () => {
      fsState.b = fsState.b === 1 ? 0 : 1;
      renderFullSubtractorView();
    });
    document.getElementById('fs-toggle-bin').addEventListener('click', () => {
      fsState.bin = fsState.bin === 1 ? 0 : 1;
      renderFullSubtractorView();
    });
  }

  /* ---------------- Half Subtractor View ---------------- */
  function renderHalfSubtractorView() {
    const container = document.getElementById('arith-view-hs');
    if (!container) return;

    const res = computeHalfSubtractor(hsState.a, hsState.b);

    let html = `
      <div class="panel">
        <h2><span class="num">HS</span> 1-Bit Half Subtractor</h2>
        <div class="row">
          <div style="flex:1;">
            <div class="arith-operand-card" style="margin-bottom:18px;">
              <div class="card-head"><span class="card-title">Inputs</span></div>
              <div class="bit-switches-row">
                <div class="bit-toggle-col">
                  <span class="bit-name">Input A</span>
                  <button class="bit-toggle-btn ${hsState.a === 1 ? 'active' : ''}" id="hs-toggle-a">${hsState.a}</button>
                </div>
                <div class="bit-toggle-col">
                  <span class="bit-name">Input B</span>
                  <button class="bit-toggle-btn ${hsState.b === 1 ? 'active' : ''}" id="hs-toggle-b">${hsState.b}</button>
                </div>
              </div>
            </div>

            <div class="expr-display" style="font-size:16px; margin-bottom:18px;">
              <span class="lbl">Boolean Equations</span>
              <div>Difference (D) = A ⊕ B = <strong style="color:var(--signal); font-size:20px;">${res.diff}</strong></div>
              <div style="margin-top:6px;">Borrow Out (B<sub>out</sub>) = A' · B = <strong style="color:var(--signal); font-size:20px;">${res.bout}</strong></div>
            </div>
          </div>

          <div style="flex:1.2;">
            <table class="tt">
              <thead><tr><th>A</th><th>B</th><th>Diff (D)</th><th>Borrow (B<sub>out</sub>)</th></tr></thead>
              <tbody>
                ${[[0,0], [0,1], [1,0], [1,1]].map(([a, b]) => {
                  const r = computeHalfSubtractor(a, b);
                  const isActive = (a === hsState.a && b === hsState.b);
                  return `
                    <tr style="${isActive ? 'background:rgba(107,255,176,0.12); font-weight:700;' : ''}">
                      <td>${a}</td><td>${b}</td>
                      <td style="color:${r.diff ? 'var(--signal)' : 'var(--text-faint)'};">${r.diff}</td>
                      <td style="color:${r.bout ? 'var(--red)' : 'var(--text-faint)'};">${r.bout}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;

    document.getElementById('hs-toggle-a').addEventListener('click', () => {
      hsState.a = hsState.a === 1 ? 0 : 1;
      renderHalfSubtractorView();
    });
    document.getElementById('hs-toggle-b').addEventListener('click', () => {
      hsState.b = hsState.b === 1 ? 0 : 1;
      renderHalfSubtractorView();
    });
  }

  function bindEvents() {
    // Module hooks
    if (window.BoolUI && window.BoolUI.registerModuleHook) {
      window.BoolUI.registerModuleHook('module-arithmetic', () => {
        renderActiveSubModule();
      });
    }
  }

  // Export helper for automated test suites
  window.BoolArithmetic = {
    computeHalfAdder,
    computeFullAdder,
    computeHalfSubtractor,
    computeFullSubtractor,
    computeMultiBit
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initArithmeticModule);
  } else {
    initArithmeticModule();
  }
})();

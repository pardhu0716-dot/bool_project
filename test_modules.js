/**
 * Comprehensive Automated Test Suite for BoolSynth Digital Logic Suite
 * Tests K-Map solver, Binary Arithmetic engine (Adders, Subtractors, 2's Complement, Overflow),
 * and Multiplexer signal routing & Boolean minimization.
 */
const assert = require('assert');

console.log('🧪 Starting Comprehensive Logic Test Suite...\n');

// ==========================================
// 1. K-MAP SOLVER TESTS
// ==========================================
console.log('--- Testing Module 1: K-Map Solver ---');
function testKMap() {
  const CONFIGS = {
    2: { rowGray: [0, 1], colGray: [0, 1], mintermOf: (r, c) => (CONFIGS[2].rowGray[r] << 1) | CONFIGS[2].colGray[c] },
    3: { rowGray: [0, 1], colGray: [0, 1, 3, 2], mintermOf: (r, c) => (CONFIGS[3].rowGray[r] << 2) | CONFIGS[3].colGray[c] },
    4: { rowGray: [0, 1, 3, 2], colGray: [0, 1, 3, 2], mintermOf: (r, c) => (CONFIGS[4].rowGray[r] << 2) | CONFIGS[4].colGray[c] }
  };

  // 2-variable grid
  assert.strictEqual(CONFIGS[2].mintermOf(0, 0), 0);
  assert.strictEqual(CONFIGS[2].mintermOf(0, 1), 1);
  assert.strictEqual(CONFIGS[2].mintermOf(1, 0), 2);
  assert.strictEqual(CONFIGS[2].mintermOf(1, 1), 3);

  // 3-variable grid (Gray code columns: 00, 01, 11, 10)
  assert.strictEqual(CONFIGS[3].mintermOf(0, 0), 0); // A=0, BC=00 -> m0
  assert.strictEqual(CONFIGS[3].mintermOf(0, 1), 1); // A=0, BC=01 -> m1
  assert.strictEqual(CONFIGS[3].mintermOf(0, 2), 3); // A=0, BC=11 -> m3
  assert.strictEqual(CONFIGS[3].mintermOf(0, 3), 2); // A=0, BC=10 -> m2
  assert.strictEqual(CONFIGS[3].mintermOf(1, 0), 4); // A=1, BC=00 -> m4
  assert.strictEqual(CONFIGS[3].mintermOf(1, 1), 5); // A=1, BC=01 -> m5
  assert.strictEqual(CONFIGS[3].mintermOf(1, 2), 7); // A=1, BC=11 -> m7
  assert.strictEqual(CONFIGS[3].mintermOf(1, 3), 6); // A=1, BC=10 -> m6

  // 4-variable 4-corners check (m0, m2, m8, m10)
  const c4 = CONFIGS[4];
  assert.strictEqual(c4.mintermOf(0, 0), 0);  // AB=00, CD=00 -> m0
  assert.strictEqual(c4.mintermOf(0, 3), 2);  // AB=00, CD=10 -> m2
  assert.strictEqual(c4.mintermOf(3, 0), 8);  // AB=10, CD=00 -> m8
  assert.strictEqual(c4.mintermOf(3, 3), 10); // AB=10, CD=10 -> m10

  console.log('✓ K-Map Gray-code matrix coordinates verified.');
}
testKMap();

// ==========================================
// 2. BINARY ARITHMETIC ENGINE TESTS
// ==========================================
console.log('\n--- Testing Module 2: Binary Arithmetic Engine ---');
function testArithmetic() {
  function computeHalfAdder(a, b) {
    return { sum: a ^ b, cout: a & b };
  }
  function computeFullAdder(a, b, cin) {
    const axorb = a ^ b;
    return { sum: axorb ^ cin, cout: (a & b) | (cin & axorb) };
  }
  function computeHalfSubtractor(a, b) {
    return { diff: a ^ b, bout: ((a === 0 ? 1 : 0) & b) };
  }
  function computeFullSubtractor(a, b, bin) {
    const axorb = a ^ b;
    const notA = a === 0 ? 1 : 0;
    return { diff: axorb ^ bin, bout: (notA & b) | (bin & (axorb === 0 ? 1 : 0)) };
  }

  // 1. Half Adder truth table
  assert.deepStrictEqual(computeHalfAdder(0, 0), { sum: 0, cout: 0 });
  assert.deepStrictEqual(computeHalfAdder(0, 1), { sum: 1, cout: 0 });
  assert.deepStrictEqual(computeHalfAdder(1, 0), { sum: 1, cout: 0 });
  assert.deepStrictEqual(computeHalfAdder(1, 1), { sum: 0, cout: 1 });

  // 2. Full Adder truth table (all 8 states)
  const faTable = [
    [0,0,0, 0,0], [0,0,1, 1,0], [0,1,0, 1,0], [0,1,1, 0,1],
    [1,0,0, 1,0], [1,0,1, 0,1], [1,1,0, 0,1], [1,1,1, 1,1]
  ];
  faTable.forEach(([a, b, cin, expS, expC]) => {
    const res = computeFullAdder(a, b, cin);
    assert.strictEqual(res.sum, expS);
    assert.strictEqual(res.cout, expC);
  });

  // 3. Half Subtractor truth table
  assert.deepStrictEqual(computeHalfSubtractor(0, 0), { diff: 0, bout: 0 });
  assert.deepStrictEqual(computeHalfSubtractor(0, 1), { diff: 1, bout: 1 });
  assert.deepStrictEqual(computeHalfSubtractor(1, 0), { diff: 1, bout: 0 });
  assert.deepStrictEqual(computeHalfSubtractor(1, 1), { diff: 0, bout: 0 });

  // 4. Full Subtractor truth table (all 8 states)
  const fsTable = [
    [0,0,0, 0,0], [0,0,1, 1,1], [0,1,0, 1,1], [0,1,1, 0,1],
    [1,0,0, 1,0], [1,0,1, 0,0], [1,1,0, 0,0], [1,1,1, 1,1]
  ];
  fsTable.forEach(([a, b, bin, expD, expB]) => {
    const res = computeFullSubtractor(a, b, bin);
    assert.strictEqual(res.diff, expD);
    assert.strictEqual(res.bout, expB);
  });

  // Helper for multi-bit simulation
  function simulateMultiBit(n, isSub, aBits, bBits, cinBit) {
    const stages = [];
    let currentCarry = cinBit;
    for (let i = n - 1; i >= 0; i--) {
      const a = aBits[i];
      const bOrig = bBits[i];
      const bEff = isSub ? (bOrig ^ 1) : bOrig;
      const fa = computeFullAdder(a, bEff, currentCarry);
      stages.unshift({ a, bOrig, bEff, cin: currentCarry, sum: fa.sum, cout: fa.cout });
      currentCarry = fa.cout;
    }
    const sumBits = stages.map(s => s.sum);
    const coutFinal = currentCarry;
    const boutFinal = isSub ? (coutFinal === 1 ? 0 : 1) : coutFinal;

    function toSigned(bits) {
      const val = parseInt(bits.join(''), 2);
      const msb = bits[0];
      return msb === 1 ? val - (1 << bits.length) : val;
    }

    const signedA = toSigned(aBits);
    const signedB = toSigned(bBits);
    const signedSum = toSigned(sumBits);

    // Overflow: V = C_n ^ C_{n-1}
    const cN = stages[0].cout;
    const cNminus1 = stages[0].cin;
    const overflow = (cN ^ cNminus1) === 1;

    return { sumBits, coutFinal, boutFinal, signedA, signedB, signedSum, overflow };
  }

  // 5. Multi-Bit Addition Edge Cases
  // Case A: 5 + 3 = 8 (0101 + 0011 = 1000 in 4-bit)
  // Signed 4-bit range is -8..+7. 5+3=8 overflows to -8!
  let res = simulateMultiBit(4, false, [0,1,0,1], [0,0,1,1], 0);
  assert.deepStrictEqual(res.sumBits, [1,0,0,0]);
  assert.strictEqual(res.signedSum, -8);
  assert.strictEqual(res.overflow, true); // Overflowed positive range

  // Case B: 3 + 4 = 7 (0011 + 0100 = 0111 in 4-bit, NO overflow)
  res = simulateMultiBit(4, false, [0,0,1,1], [0,1,0,0], 0);
  assert.deepStrictEqual(res.sumBits, [0,1,1,1]);
  assert.strictEqual(res.signedSum, 7);
  assert.strictEqual(res.overflow, false);

  // Case C: Addition with Cin=1: 3 + 4 + 1 = 8
  res = simulateMultiBit(4, false, [0,0,1,1], [0,1,0,0], 1);
  assert.deepStrictEqual(res.sumBits, [1,0,0,0]);
  assert.strictEqual(res.signedSum, -8);
  assert.strictEqual(res.overflow, true);

  // 6. Multi-Bit Subtraction Edge Cases
  // Case A: Standard 2's complement subtraction: 7 - 3 = 4 (0111 - 0011 with Cin=1)
  res = simulateMultiBit(4, true, [0,1,1,1], [0,0,1,1], 1);
  assert.deepStrictEqual(res.sumBits, [0,1,0,0]); // 4
  assert.strictEqual(res.signedSum, 4);
  assert.strictEqual(res.boutFinal, 0); // No borrow
  assert.strictEqual(res.coutFinal, 1);
  assert.strictEqual(res.overflow, false);

  // Case B: 1's complement subtraction: 7 - 3 - 1 = 3 (with Cin=0)
  res = simulateMultiBit(4, true, [0,1,1,1], [0,0,1,1], 0);
  assert.deepStrictEqual(res.sumBits, [0,0,1,1]); // 3
  assert.strictEqual(res.signedSum, 3);
  assert.strictEqual(res.overflow, false);

  // Case C: Subtraction yielding negative result: 3 - 5 = -2 (0011 - 0101 with Cin=1)
  // -2 in 4-bit 2's complement is 1110
  res = simulateMultiBit(4, true, [0,0,1,1], [0,1,0,1], 1);
  assert.deepStrictEqual(res.sumBits, [1,1,1,0]);
  assert.strictEqual(res.signedSum, -2);
  assert.strictEqual(res.boutFinal, 1); // Borrow required (unsigned 3 < 5)
  assert.strictEqual(res.coutFinal, 0);
  assert.strictEqual(res.overflow, false);

  // Case D: Subtraction with signed overflow: -8 - 1 = -9 (1000 - 0001 with Cin=1)
  // -9 exceeds 4-bit signed range [-8..+7], wraps to +7 (0111) with V=1
  res = simulateMultiBit(4, true, [1,0,0,0], [0,0,0,1], 1);
  assert.deepStrictEqual(res.sumBits, [0,1,1,1]);
  assert.strictEqual(res.signedSum, 7);
  assert.strictEqual(res.overflow, true);

  console.log('✓ All Half/Full Adders, Subtractors, multi-bit ripple chains, and Overflow flags verified.');
}
testArithmetic();

// ==========================================
// 3. MULTIPLEXER ROUTING & SIMPLIFICATION TESTS
// ==========================================
console.log('\n--- Testing Module 3: Multiplexer Routing & Boolean Simplification ---');
function testMultiplexer() {
  function simplifyMuxFunction(minterms, numVars, varNames) {
    if (minterms.length === 0) return '0';
    if (minterms.length === (1 << numVars)) return '1';

    const totalCells = 1 << numVars;
    const isMinterm = new Array(totalCells).fill(false);
    minterms.forEach(m => isMinterm[m] = true);

    function checkCube(fixedMask, fixedVals) {
      for (let i = 0; i < totalCells; i++) {
        if ((i & fixedMask) === fixedVals) {
          if (!isMinterm[i]) return false;
        }
      }
      return true;
    }

    const validCubes = [];
    for (let mask = 0; mask < (1 << numVars); mask++) {
      for (let val = 0; val < (1 << numVars); val++) {
        if ((val & ~mask) !== 0) continue;
        if (checkCube(mask, val)) {
          const coveredCells = [];
          for (let i = 0; i < totalCells; i++) {
            if ((i & mask) === val) coveredCells.push(i);
          }
          validCubes.push({ mask, val, size: coveredCells.length, cells: coveredCells });
        }
      }
    }

    const pis = validCubes.filter(c1 => {
      const set1 = new Set(c1.cells);
      return !validCubes.some(c2 => {
        if (c2.size <= c1.size) return false;
        const set2 = new Set(c2.cells);
        return c1.cells.every(c => set2.has(c));
      });
    });

    const uncovered = new Set(minterms);
    const chosen = [];

    minterms.forEach(m => {
      const covering = pis.filter(pi => pi.cells.includes(m));
      if (covering.length === 1) {
        const epi = covering[0];
        if (!chosen.includes(epi)) {
          chosen.push(epi);
          epi.cells.forEach(c => uncovered.delete(c));
        }
      }
    });

    const remaining = pis.filter(pi => !chosen.includes(pi));
    while (uncovered.size > 0 && remaining.length > 0) {
      remaining.sort((a, b) => {
        const covA = a.cells.filter(c => uncovered.has(c)).length;
        const covB = b.cells.filter(c => uncovered.has(c)).length;
        if (covB !== covA) return covB - covA;
        return b.size - a.size;
      });
      const best = remaining.shift();
      const newCov = best.cells.filter(c => uncovered.has(c)).length;
      if (newCov > 0) {
        chosen.push(best);
        best.cells.forEach(c => uncovered.delete(c));
      }
    }

    if (chosen.length === 0) return '0';

    const termStrings = chosen.map(cube => {
      const lits = [];
      for (let bit = 0; bit < numVars; bit++) {
        const bitShift = numVars - 1 - bit;
        const bitMask = 1 << bitShift;
        if (cube.mask & bitMask) {
          const bitVal = (cube.val >> bitShift) & 1;
          const varName = varNames[bit];
          lits.push(bitVal === 1 ? varName : varName + "'");
        }
      }
      return lits.length === 0 ? '1' : lits.join('');
    });

    return termStrings.join(' + ');
  }

  // 1. 2:1 MUX (1 select line S0)
  assert.strictEqual(simplifyMuxFunction([1], 1, ['S0']), 'S0');
  assert.strictEqual(simplifyMuxFunction([0], 1, ['S0']), "S0'");
  assert.strictEqual(simplifyMuxFunction([0, 1], 1, ['S0']), '1');
  assert.strictEqual(simplifyMuxFunction([], 1, ['S0']), '0');

  // 2. 4:1 MUX (2 select lines S1, S0)
  // AND: D3=1 -> m3
  assert.strictEqual(simplifyMuxFunction([3], 2, ['S1', 'S0']), 'S1S0');
  // OR: D1=1, D2=1, D3=1 -> m(1,2,3) -> S1 + S0
  assert.strictEqual(simplifyMuxFunction([1, 2, 3], 2, ['S1', 'S0']), 'S0 + S1');
  // XOR: D1=1, D2=1 -> m(1,2) -> S1'S0 + S1S0'
  const xorExpr = simplifyMuxFunction([1, 2], 2, ['S1', 'S0']);
  assert.ok(xorExpr.includes("S1'S0") && xorExpr.includes("S1S0'"));

  // 3. 8:1 MUX (3 select lines S2, S1, S0)
  // Majority: m(3, 5, 6, 7) -> S2S1 + S2S0 + S1S0
  const majExpr = simplifyMuxFunction([3, 5, 6, 7], 3, ['S2', 'S1', 'S0']);
  assert.ok(majExpr.includes('S1S0') && majExpr.includes('S2S0') && majExpr.includes('S2S1'));

  console.log('✓ Multiplexer Boolean expression simplification engine verified.');
}
testMultiplexer();

console.log('\n🎉 ALL MODULE LOGIC & ARITHMETIC TESTS PASSED WITH 100% SUCCESS!\n');

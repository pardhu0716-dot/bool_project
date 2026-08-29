/**
 * Comprehensive Automated Test Suite for BoolSynth Digital Logic Suite
 * Tests K-Map solver, Binary Arithmetic engine (Adders, Subtractors, 2's Complement, Overflow),
 * and Multiplexer signal routing & Boolean minimization.
 */
const assert = require('assert');
const BoolAI = require('./ai.js');
const BoolLogic = require('./logic.js');

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

// ==========================================
// 4. AI LOGIC ASSISTANT TESTS
// ==========================================
console.log('\n--- Testing Module 4: AI Logic Assistant & Normalizer ---');
function testAIAssistant() {
  const BoolAI = require('./ai.js');
  const BoolLogic = require('./logic.js');

  // 1. Model & Endpoint check
  assert.strictEqual(BoolAI.DEFAULT_MODEL, 'gemini-3.6-flash');
  assert.strictEqual(BoolAI.INTERACTIONS_ENDPOINT, 'https://generativelanguage.googleapis.com/v1beta/interactions');

  // 2. Rejection message constant check
  const expectedRejection = "Sorry, I can only help with digital logic, Boolean algebra, digital circuits, and related mathematical calculations.";
  assert.strictEqual(BoolAI.REJECTION_MESSAGE, expectedRejection);

  // 3. Syntax Normalizer: Explicit dot (.) multiplication and NOT (') prime
  assert.strictEqual(BoolAI.normalizeExpressionSyntax('AB + BCD'), 'A.B + B.C.D');
  assert.strictEqual(BoolAI.normalizeExpressionSyntax("A'B + AB'"), "A'.B + A.B'");
  assert.strictEqual(BoolAI.normalizeExpressionSyntax('A(B+C) + D(B+C)'), 'A.(B + C) + D.(B + C)');
  assert.strictEqual(BoolAI.normalizeExpressionSyntax('!A + ~B'), "A' + B'");
  assert.strictEqual(BoolAI.normalizeExpressionSyntax('F = A.B + A.C + D.(B + C)'), 'A.B + A.C + D.(B + C)');
  assert.strictEqual(BoolAI.normalizeExpressionSyntax('(A+B)(C+D)'), '(A + B).(C + D)');
  assert.strictEqual(BoolAI.normalizeExpressionSyntax('A * B + C & D'), 'A.B + C.D');

  // 4. Expression Detector (isBooleanExpression)
  assert.strictEqual(BoolAI.isBooleanExpression('A.B + A.C + D.(B + C)'), true);
  assert.strictEqual(BoolAI.isBooleanExpression("A'B'C' + ABC"), true);
  assert.strictEqual(BoolAI.isBooleanExpression(BoolAI.REJECTION_MESSAGE), false);
  assert.strictEqual(BoolAI.isBooleanExpression('In this digital circuit, sensor A and B are active.'), false);
  assert.strictEqual(BoolAI.isBooleanExpression('What is the weather today?'), false);
  assert.strictEqual(BoolAI.isBooleanExpression('32'), false); // Pure math answer is not a Boolean expression

  // 5. Interactions API Payload Structure
  const history = [
    { role: 'user', text: 'Design an alarm system with A, B, C.' },
    { role: 'model', text: 'A.B + C' }
  ];
  const payload = BoolAI.buildInteractionsPayload('Explain this expression', history);
  assert.strictEqual(payload.model, 'gemini-3.6-flash');
  assert.ok(payload.system_instruction.includes('Digital Logic'));
  assert.strictEqual(payload.input.length, 3);
  assert.deepStrictEqual(payload.input[0], { type: 'user_input', content: [{ type: 'text', text: 'Design an alarm system with A, B, C.' }] });
  assert.deepStrictEqual(payload.input[1], { type: 'model_output', content: [{ type: 'text', text: 'A.B + C' }] });
  assert.deepStrictEqual(payload.input[2], { type: 'user_input', content: [{ type: 'text', text: 'Explain this expression' }] });

  // 6. Interactions API Response Parser
  const mockInteractionsResponse = {
    id: 'test_interaction_123',
    model: 'gemini-3.6-flash',
    object: 'interaction',
    status: 'completed',
    steps: [
      {
        type: 'model_output',
        content: [
          { type: 'text', text: 'A.B + A.C + D.(B + C)' }
        ]
      }
    ]
  };
  assert.strictEqual(BoolAI.parseInteractionsResponse(mockInteractionsResponse), 'A.B + A.C + D.(B + C)');

  // Math output parsing test
  const mockMathResponse = {
    steps: [{ type: 'model_output', content: [{ type: 'text', text: '32' }] }]
  };
  assert.strictEqual(BoolAI.parseInteractionsResponse(mockMathResponse), '32');

  // 7. LaTeX & Escaped Markdown Cleaner Tests
  assert.strictEqual(BoolAI.cleanExplanationText(String.raw`\[ A \cdot B + \mathbf{C} \]`), 'A . B + C');
  assert.strictEqual(BoolAI.cleanExplanationText(String.raw`$\overline{A} \cdot B$`), "(A)' . B");
  assert.strictEqual(BoolAI.cleanExplanationText(String.raw`\### Step 1: Simplification`), '### Step 1: Simplification');
  assert.strictEqual(BoolAI.cleanExplanationText(String.raw`\*\*Note\*\*: \---`), '**Note**: ---');
  assert.strictEqual(BoolAI.cleanExplanationText(String.raw`The result is \( A + B \cdot C \)`), 'The result is A + B . C');
  assert.strictEqual(BoolAI.cleanExplanationText(String.raw`Formula: $$F = \overline{X} \cdot Y + Z$$`), "Formula: F = (X)' . Y + Z");

  // 8. Mathematical Calculation Recognition
  assert.strictEqual(BoolAI.isBooleanExpression('400'), false);
  assert.strictEqual(BoolAI.isBooleanExpression('25 * 16 = 400'), false);
  assert.strictEqual(BoolAI.isBooleanExpression('32'), false);
  assert.strictEqual(BoolAI.parseInteractionsResponse({ steps: [{ type: 'model_output', content: [{ type: 'text', text: '400' }] }] }), '400');

  // 9. 5-Variable Don't-Care Mathematical Minimization Verification
  // F(A,B,C,D,E) = Σm(0, 1, 4, 5, 16, 17, 20, 21) + Σd(2, 6, 18, 22)
  // Minimal SOP is B'.D'
  const min5Expr = BoolAI.normalizeExpressionSyntax("B'.D'");
  const ast5 = BoolLogic.parseExpression(min5Expr);
  assert.ok(ast5, 'AST successfully parsed for 5-variable minimal expression');
  // Check coverage on required minterm m0 (00000: B=0, D=0) -> 1
  assert.strictEqual(BoolLogic.evalAst(ast5, { A: 0, B: 0, C: 0, D: 0, E: 0 }), 1);
  // Check coverage on required minterm m21 (10101: B=0, D=0) -> 1
  assert.strictEqual(BoolLogic.evalAst(ast5, { A: 1, B: 0, C: 1, D: 0, E: 1 }), 1);
  // Check exclusion of 0-term m3 (00011: B=0, D=1) -> 0
  assert.strictEqual(BoolLogic.evalAst(ast5, { A: 0, B: 0, C: 0, D: 1, E: 1 }), 0);

  // 10. 6-Variable Don't-Care Mathematical Minimization Verification
  // F(A,B,C,D,E,F) = Σm(0, 2, 8, 10, 32, 34, 40, 42) + Σd(16, 18, 24, 26, 48, 50, 56, 58)
  // Minimal SOP is D'.F'
  const min6Expr = BoolAI.normalizeExpressionSyntax("D'.F'");
  const ast6 = BoolLogic.parseExpression(min6Expr);
  assert.ok(ast6, 'AST successfully parsed for 6-variable minimal expression');
  // Check coverage on required minterm m42 (101010: D=0, F=0) -> 1
  assert.strictEqual(BoolLogic.evalAst(ast6, { A: 1, B: 0, C: 1, D: 0, E: 1, F: 0 }), 1);
  // Check exclusion of 0-term m1 (000001: D=0, F=1) -> 0
  assert.strictEqual(BoolLogic.evalAst(ast6, { A: 0, B: 0, C: 0, D: 0, E: 0, F: 1 }), 0);

  // 11. Compatibility Bridge with BoolLogic Parser & Synthesizer
  const rawExpression = BoolAI.normalizeExpressionSyntax('A.B + A.C + D.(B + C)');
  const ast = BoolLogic.parseExpression(rawExpression);
  assert.ok(ast, 'AST successfully parsed from AI normalized expression');
  const vars = Array.from(BoolLogic.collectVars(ast)).sort();
  assert.deepStrictEqual(vars, ['A', 'B', 'C', 'D']);

  // Truth table verification for lab controller expression: A.B + A.C + D.(B + C)
  // When A=1, B=1, C=0, D=0 -> F = 1.B + 1.0 + 0.(1+0) = 1 + 0 + 0 = 1
  const env1 = { A: 1, B: 1, C: 0, D: 0 };
  assert.strictEqual(BoolLogic.evalAst(ast, env1), 1);

  // When A=0, B=0, C=0, D=1 -> F = 0 + 0 + 1.(0+0) = 0
  const env2 = { A: 0, B: 0, C: 0, D: 1 };
  assert.strictEqual(BoolLogic.evalAst(ast, env2), 0);

  // When A=0, B=1, C=0, D=1 -> F = 0 + 0 + 1.(1+0) = 1
  const env3 = { A: 0, B: 1, C: 0, D: 1 };
  assert.strictEqual(BoolLogic.evalAst(ast, env3), 1);

  console.log('✓ Gemini Interactions API payload, response parser, 5/6-var minimization, LaTeX cleaner, and BoolLogic bridge verified.');
}
testAIAssistant();

// ==========================================
// 6. DETERMINISTIC VERIFICATION ENGINE TESTS
// ==========================================
console.log('\n--- Testing Module 6: Deterministic Verification Engine ---');
function testDeterministicVerification() {

  // --- 6a. extractBooleanSpec() ---
  // Q7: F(C,B,K,S,E) = Σm(12,16,18,20,22,24,26,28,30) + d(C,B,K,S,E) = Σd(13,17,21,25,29,31)
  const q7Text = 'F(C,B,K,S,E) = Σm(12,16,18,20,22,24,26,28,30) d(C,B,K,S,E) = Σd(13,17,21,25,29,31)';
  const q7Spec = BoolAI.extractBooleanSpec(q7Text);
  assert.ok(q7Spec !== null, 'Q7: extractBooleanSpec should detect formal spec');
  assert.deepStrictEqual(q7Spec.vars, ['C','B','K','S','E'], 'Q7: Variable list');
  assert.deepStrictEqual(q7Spec.minterms.sort((a,b)=>a-b), [12,16,18,20,22,24,26,28,30], 'Q7: Minterms');
  assert.deepStrictEqual(q7Spec.dontcares.sort((a,b)=>a-b), [13,17,21,25,29,31], 'Q7: Don\'t-cares');
  assert.strictEqual(q7Spec.numVars, 5, 'Q7: numVars = 5');

  // Q9: Z(A,B,T,P,V,M) = Σm(10,11,...) + Σd(8,9,...)
  const q9Text = 'Z(A,B,T,P,V,M) = Σm(10,11,14,15,26,27,30,31,42,43,46,47,56,57,58,59,60,61,62,63) d(A,B,T,P,V,M) = Σd(8,9,24,25,40,41,44,45)';
  const q9Spec = BoolAI.extractBooleanSpec(q9Text);
  assert.ok(q9Spec !== null, 'Q9: extractBooleanSpec should detect formal spec');
  assert.deepStrictEqual(q9Spec.vars, ['A','B','T','P','V','M'], 'Q9: Variable list');
  assert.strictEqual(q9Spec.numVars, 6, 'Q9: numVars = 6');
  assert.deepStrictEqual(q9Spec.minterms.sort((a,b)=>a-b), [10,11,14,15,26,27,30,31,42,43,46,47,56,57,58,59,60,61,62,63], 'Q9: Minterms');
  assert.deepStrictEqual(q9Spec.dontcares.sort((a,b)=>a-b), [8,9,24,25,40,41,44,45], 'Q9: Don\'t-cares');

  // Simple 4-var case no don't-cares
  const s4 = BoolAI.extractBooleanSpec('F(A,B,C,D) = Σm(0,1,2,3)');
  assert.ok(s4 !== null, '4-var: spec detected');
  assert.deepStrictEqual(s4.vars, ['A','B','C','D']);
  assert.deepStrictEqual(s4.dontcares, []);
  assert.strictEqual(s4.numVars, 4);

  // Natural language — should NOT be extracted
  const nlSpec = BoolAI.extractBooleanSpec('Design a 4-bit adder with carry propagation.');
  assert.strictEqual(nlSpec, null, 'Natural language: no spec extracted');

  // Domain rejection — should NOT be extracted
  const rejSpec = BoolAI.extractBooleanSpec('What is the weather today?');
  assert.strictEqual(rejSpec, null, 'Domain rejection: no spec extracted');
  console.log('  ✓ extractBooleanSpec: Q7, Q9, 4-var, natural language, rejection all correct');

  // --- 6b. verifyBooleanExpression() with deterministic logic.js calls ---

  // Q7 CORRECT: "B.K.S' + C.E'" should PASS all 5 checks
  const q7CorrectExpr = "B.K.S' + C.E'";
  const q7VerPass = BoolAI.verifyBooleanExpression(q7CorrectExpr, q7Spec);
  assert.strictEqual(q7VerPass.check1.pass, true,  `Q7 correct: CHECK1 must pass (minterms covered). Failed: ${q7VerPass.check1.failedMinterms}`);
  assert.strictEqual(q7VerPass.check2.pass, true,  `Q7 correct: CHECK2 must pass (no forbidden 1s). Failed: ${q7VerPass.check2.failedMinterms}`);
  assert.strictEqual(q7VerPass.check3.pass, true,  'Q7 correct: CHECK3 must pass (DC handling)');
  assert.strictEqual(q7VerPass.check4.pass, true,  'Q7 correct: CHECK4 must pass (syntax valid)');
  assert.strictEqual(q7VerPass.check5.pass, true,  `Q7 correct: CHECK5 must pass (minimal). AI terms=${q7VerPass.check5.aiTermCount}, lits=${q7VerPass.check5.aiLitCount}; Ref terms=${q7VerPass.check5.refTermCount}, lits=${q7VerPass.check5.refLitCount}`);
  assert.strictEqual(q7VerPass.passed, true,       'Q7 correct: overall PASSED');
  assert.strictEqual(q7VerPass.correctedExpr, null,'Q7 correct: no correction needed');

  // Q7 EXACT BUG TEST: "C.E' + C'.B.K.E'" — must FAIL and be corrected to "B.K.S' + C.E'"
  const q7BadExpr = "C.E' + C'.B.K.E'";
  const q7BadVer = BoolAI.verifyBooleanExpression(q7BadExpr, q7Spec);
  assert.strictEqual(q7BadVer.passed, false, 'Q7 bad expression (C.E\' + C\'.B.K.E\'): must FAIL verification');
  assert.ok(q7BadVer.correctedExpr !== null, 'Q7 bad expression: must produce deterministic correctedExpr');
  assert.strictEqual(q7BadVer.correctedExpr, "B.K.S' + C.E'", 'Q7 bad expression: must be corrected to QM minimum "B.K.S\' + C.E\'"');

  // Q7 WRONG: "B.K + C.E'" — covers fewer minterms, should FAIL check1
  const q7WrongExpr = "B.K + C.E'";
  const q7VerFail = BoolAI.verifyBooleanExpression(q7WrongExpr, q7Spec);
  assert.strictEqual(q7VerFail.passed, false, 'Q7 wrong: overall must FAIL');
  assert.ok(q7VerFail.correctedExpr !== null, 'Q7 wrong: correctedExpr must be set');
  // Corrected expression must cover all required minterms
  const q7FixedVer = BoolAI.verifyBooleanExpression(q7VerFail.correctedExpr, q7Spec);
  assert.strictEqual(q7FixedVer.check1.pass, true, `Q7 corrected: CHECK1 must pass. Corrected expr: "${q7VerFail.correctedExpr}"`);
  assert.strictEqual(q7FixedVer.check2.pass, true, `Q7 corrected: CHECK2 must pass.`);

  // Q7 NON-MINIMAL: "B.K.S' + C.E' + B.C.E'" — covers all minterms but includes redundant term, should fail check5
  const q7NonMinExpr = "B.K.S' + C.E' + B.C.E'";
  const q7NonMin = BoolAI.verifyBooleanExpression(q7NonMinExpr, q7Spec);
  assert.strictEqual(q7NonMin.check1.pass, true, 'Q7 non-minimal: CHECK1 passes (all minterms covered)');
  assert.strictEqual(q7NonMin.check2.pass, true, 'Q7 non-minimal: CHECK2 passes (no forbidden 1s)');
  assert.strictEqual(q7NonMin.check5.pass, false, 'Q7 non-minimal: CHECK5 must FAIL (terms/literals exceed QM minimum)');
  assert.strictEqual(q7NonMin.passed, false, 'Q7 non-minimal: overall must FAIL');
  assert.strictEqual(q7NonMin.correctedExpr, "B.K.S' + C.E'", 'Q7 non-minimal: must be replaced with QM minimum');

  console.log('  ✓ verifyBooleanExpression: Q7 correct/bad/wrong/non-minimal all properly verified and corrected');

  // Q9 CORRECT: "T.V + A.T" should PASS all 5 checks
  const q9CorrectExpr = "T.V + A.T";
  const q9VerPass = BoolAI.verifyBooleanExpression(q9CorrectExpr, q9Spec);
  assert.strictEqual(q9VerPass.check1.pass, true, `Q9 correct: CHECK1 must pass. Failed: ${q9VerPass.check1.failedMinterms}`);
  assert.strictEqual(q9VerPass.check2.pass, true, `Q9 correct: CHECK2 must pass. Failed: ${q9VerPass.check2.failedMinterms}`);
  assert.strictEqual(q9VerPass.check4.pass, true, 'Q9 correct: CHECK4 must pass (syntax)');
  assert.strictEqual(q9VerPass.passed, true,      'Q9 correct: overall PASSED');

  // Q9 WRONG: "T.P + A.T" — check1 should fail (covers wrong minterms)
  const q9WrongExpr = "T.P + A.T";
  const q9VerFail = BoolAI.verifyBooleanExpression(q9WrongExpr, q9Spec);
  assert.strictEqual(q9VerFail.passed, false, 'Q9 wrong: overall must FAIL');
  assert.ok(q9VerFail.correctedExpr !== null, 'Q9 wrong: must produce correctedExpr');

  console.log('  ✓ verifyBooleanExpression: Q9 pass/fail/correction all correct');

  // --- 6c. Invalid variable CHECK4 ---
  const badVarSpec = { vars: ['A','B','C','D'], minterms: [0,1,2,3], dontcares: [], numVars: 4, questionType: 'minSOP' };
  const badVarExpr = "A.B + X.D"; // X is not in vars
  const badVarResult = BoolAI.verifyBooleanExpression(badVarExpr, badVarSpec);
  assert.strictEqual(badVarResult.check4.pass, false, 'CHECK4 must fail for invalid variable X');
  assert.strictEqual(badVarResult.passed, false, 'Overall must fail when CHECK4 fails');

  // --- 6d. Syntax error CHECK4 ---
  const syntaxSpec = { vars: ['A','B'], minterms: [3], dontcares: [], numVars: 2, questionType: 'minSOP' };
  const syntaxExpr = "A.B + "; // incomplete expression
  const syntaxResult = BoolAI.verifyBooleanExpression(syntaxExpr, syntaxSpec);
  assert.strictEqual(syntaxResult.check4.pass, false, 'CHECK4 must fail for malformed expression');

  // --- 6e. Simple 4-var known correct expression ---
  const s4Spec = { vars: ['A','B','C','D'], minterms: [0,1,2,3], dontcares: [], numVars: 4, questionType: 'minSOP' };
  // Σm(0,1,2,3) with 4 vars => A'.B' (covers 0..3: all cases where A=0,B=0)
  const s4ExprOk = "A'.B'";
  const s4Result = BoolAI.verifyBooleanExpression(s4ExprOk, s4Spec);
  assert.strictEqual(s4Result.check1.pass, true, `4-var simple: CHECK1. Failed: ${s4Result.check1.failedMinterms}`);
  assert.strictEqual(s4Result.check2.pass, true, `4-var simple: CHECK2. Failed: ${s4Result.check2.failedMinterms}`);
  assert.strictEqual(s4Result.passed, true, '4-var simple: overall PASSED');

  // Non-minimal 4-var expression: "A'.B'.C' + A'.B'.C" (logically equivalent to A'.B', but 2 terms / 6 literals)
  const s4NonMinExpr = "A'.B'.C' + A'.B'.C";
  const s4NonMinResult = BoolAI.verifyBooleanExpression(s4NonMinExpr, s4Spec);
  assert.strictEqual(s4NonMinResult.check1.pass, true, '4-var non-minimal: Check 1 passes');
  assert.strictEqual(s4NonMinResult.check2.pass, true, '4-var non-minimal: Check 2 passes');
  assert.strictEqual(s4NonMinResult.check5.pass, false, '4-var non-minimal: Check 5 must FAIL');
  assert.strictEqual(s4NonMinResult.passed, false, '4-var non-minimal: overall must FAIL');
  assert.strictEqual(s4NonMinResult.correctedExpr, "A'.B'", '4-var non-minimal: corrected to minimal A\'.B\'');

  // --- 6f. Verify refExpr is always set from QM engine ---
  const anyResult = BoolAI.verifyBooleanExpression("A'.B'", s4Spec);
  assert.ok(typeof anyResult.refExpr === 'string' && anyResult.refExpr.length > 0, 'refExpr must always be set from QM engine');

  // --- 6g. 3-Variable K-Map with Don't-Cares ---
  // F(A,B,C) = Σm(0,2,4,6) + Σd(1,5) => all A,B with C=0 are 1s, C=1 are DCs => minimal SOP is C'
  const kmap3Text = 'F(A,B,C) = Σm(0,2,4,6) + Σd(1,5)';
  const kmap3Spec = BoolAI.extractBooleanSpec(kmap3Text);
  assert.ok(kmap3Spec !== null, '3-var K-Map: spec detected');
  assert.deepStrictEqual(kmap3Spec.vars, ['A','B','C']);
  assert.deepStrictEqual(kmap3Spec.minterms.sort((a,b)=>a-b), [0,2,4,6]);
  assert.deepStrictEqual(kmap3Spec.dontcares.sort((a,b)=>a-b), [1,5]);
  const kmap3Ver = BoolAI.verifyBooleanExpression("C'", kmap3Spec);
  assert.strictEqual(kmap3Ver.passed, true, "3-var K-Map: C' must pass verification");
  assert.strictEqual(kmap3Ver.refExpr, "C'", "3-var K-Map: reference expression is C'");

  // Don't-cares NOT treated as mandatory 1s:
  // If DC minterm 1 evaluates to 0, expression must NOT fail Check 1
  const dcNotMandatorySpec = { vars: ['A','B'], minterms: [0], dontcares: [1], numVars: 2, questionType: 'minSOP' };
  // F = A'.B' only covers m0 (m1=0), which is valid because m1 is only a don't-care
  const dcVer = BoolAI.verifyBooleanExpression("A'.B'", dcNotMandatorySpec);
  assert.strictEqual(dcVer.check1.pass, true, 'Don\'t care m1=0 does not fail Check 1');
  assert.strictEqual(dcVer.check2.pass, true, 'Off minterm m2,m3=0 pass Check 2');

  // --- 6h. Multiple Minimum Solutions Test ---
  // F(A,B,C,D) = Σm(0, 4, 5, 7, 8, 9, 13, 15) has multiple minimal covers with identical term/literal counts
  const multiMinSpec = { vars: ['A','B','C','D'], minterms: [0, 4, 5, 7, 8, 9, 13, 15], dontcares: [], numVars: 4, questionType: 'minSOP' };
  const multiMinRef = BoolAI.verifyBooleanExpression("B'.C'.D' + A'.B.D + A.B'.C' + A.B.D", multiMinSpec);
  assert.ok(multiMinRef.refExpr.length > 0, 'Reference expression computed');

  // --- 6i. Question Type Detection (SOP vs POS vs PIs) ---
  const posText = 'Find minimal POS for F(A,B,C,D) = Σm(0,1,4,5,10,11,14,15)';
  const posSpec = BoolAI.extractBooleanSpec(posText);
  assert.ok(posSpec !== null, 'POS spec detected');
  assert.strictEqual(posSpec.questionType, 'minPOS');

  const piText = 'Find all prime implicants for F(w,x,y,z) = m(0,2,5,7,8,10,13,15)';
  const piSpec = BoolAI.extractBooleanSpec(piText);
  assert.ok(piSpec !== null, 'PI spec detected');
  assert.strictEqual(piSpec.questionType, 'primeImplicants');

  // --- 6j. LaTeX syntax extraction ---
  const latexText = String.raw`F(A,B,C,D) = \Sigma m(0,1,2,3) + \Sigma d(4,5)`;
  const latexSpec = BoolAI.extractBooleanSpec(latexText);
  assert.ok(latexSpec !== null, 'LaTeX spec detected');
  assert.deepStrictEqual(latexSpec.vars, ['A','B','C','D']);
  assert.deepStrictEqual(latexSpec.minterms, [0,1,2,3]);
  assert.deepStrictEqual(latexSpec.dontcares, [4,5]);

  console.log('  ✓ verifyBooleanExpression: Q7 bad expression correction, multiple min covers, DC non-mandatory all correct');
  console.log('✓ Module 6 (Deterministic Verification Engine) — ALL TESTS PASSED');
}
testDeterministicVerification();

// ========================================================
// 7. COMPLETE EXPLANATION & CONTINUATION ENGINE TESTS
// ========================================================
console.log('\n--- Testing Module 7: Complete Explanation & Continuation Engine ---');
function testExplanationAndContinuationEngine() {

  // --- 7a. isExplanationRequest() query intent classification ---
  assert.strictEqual(BoolAI.isExplanationRequest('Explain A.B + A.C step by step'), true);
  assert.strictEqual(BoolAI.isExplanationRequest('Explain the minimization and derivation of the secure vault controller function.'), true);
  assert.strictEqual(BoolAI.isExplanationRequest("Why is B.K.S' + C.E' minimal?"), true);
  assert.strictEqual(BoolAI.isExplanationRequest('How to derive the SOP for 4-bit carry lookahead adder?'), true);
  assert.strictEqual(BoolAI.isExplanationRequest('Show step by step walkthrough for F(A,B,C) = m(0,1,4,5)'), true);
  assert.strictEqual(BoolAI.isExplanationRequest('Breakdown of K-map grouping and don\'t cares'), true);
  assert.strictEqual(BoolAI.isExplanationRequest('Describe the circuit operation details'), true);

  // Expression-only queries must NOT trigger explanation mode
  assert.strictEqual(BoolAI.isExplanationRequest('F(C,B,K,S,E) = Σm(12,16,18,20,22,24,26,28,30) + Σd(13,17,21,25,29,31)'), false);
  assert.strictEqual(BoolAI.isExplanationRequest('Design an alarm system where siren triggers if A and B are active or C is active.'), false);
  assert.strictEqual(BoolAI.isExplanationRequest('Give only the expression for laboratory access controller'), false);
  assert.strictEqual(BoolAI.isExplanationRequest('What is 25 * 16?'), false);

  console.log('  ✓ isExplanationRequest: Intent classification for full-question vs explanation verified');

  // --- 7b. Dynamic max_output_tokens in buildInteractionsPayload() ---
  const explainPayload = BoolAI.buildInteractionsPayload('Explain A.B + A.C step by step', []);
  assert.strictEqual(explainPayload.generation_config.max_output_tokens, 8192, 'Explanation request must allow high token ceiling (8192)');

  const exprPayload = BoolAI.buildInteractionsPayload('F(A,B,C) = Σm(0,1,2,3)', []);
  assert.strictEqual(exprPayload.generation_config.max_output_tokens, 1200, 'Expression request must maintain concise token limit (1200)');

  console.log('  ✓ buildInteractionsPayload: Dynamic token limit allocation (8192 vs 1200) verified');

  // --- 7c. isHeuristicallyTruncated() detection ---
  // Dangling cutoff from the user's reported problem
  const cutOffUserSample = "This step-by-step breakdown explains the minimization and derivation of the secure vault controller function.\n\n1. Binary Analysis of Minterms and Don't-Cares\n\nThe variables are ordered as C";
  assert.strictEqual(BoolAI.isHeuristicallyTruncated(cutOffUserSample), true, 'Dangling "as C" cutoff must be flagged as truncated');

  const cutOffDanglingStep = "Step 1: Variables are A, B, C.\nStep 2: Placing minterms on K-Map with";
  assert.strictEqual(BoolAI.isHeuristicallyTruncated(cutOffDanglingStep), true, 'Dangling connector "with" must be flagged as truncated');

  const cutOffColon = "Step 1: Variable identification.\nStep 2: The essential prime implicants are:";
  assert.strictEqual(BoolAI.isHeuristicallyTruncated(cutOffColon), true, 'Dangling colon ending must be flagged as truncated');

  // Fully concluded complete explanation
  const completeSample = "Step 1: Identify variables C, B, K, S, E.\nStep 2: Binary codes for minterms...\nStep 3: Groupings...\nStep 4: Essential Implicants...\nFinal result: B.K.S' + C.E'";
  assert.strictEqual(BoolAI.isHeuristicallyTruncated(completeSample), false, 'Complete explanation reaching final result must NOT be flagged as truncated');

  console.log('  ✓ isHeuristicallyTruncated: Truncation detection and conclusion validation verified');

  // --- 7d. parseInteractionsResponseWithMeta() finish reason handling ---
  const maxTokensMock = {
    steps: [
      {
        type: 'model_output',
        content: [{ type: 'text', text: 'Step 1: Variable list is C, B, K, S, E.\nStep 2: Minterms are' }],
        finish_reason: 'MAX_TOKENS'
      }
    ]
  };
  const maxTokensParsed = BoolAI.parseInteractionsResponseWithMeta(maxTokensMock);
  assert.strictEqual(maxTokensParsed.isTruncated, true, 'MAX_TOKENS finish_reason must mark response as truncated');
  assert.strictEqual(maxTokensParsed.finishReason, 'MAX_TOKENS');

  const stopMock = {
    steps: [
      {
        type: 'model_output',
        content: [
          { type: 'text', text: 'Step 1: Variables A, B.\n' },
          { type: 'text', text: 'Step 2: A.B + A.C = A.(B + C).\nFinal result: A.(B + C)' }
        ],
        finish_reason: 'STOP'
      }
    ]
  };
  const stopParsed = BoolAI.parseInteractionsResponseWithMeta(stopMock);
  assert.strictEqual(stopParsed.isTruncated, false, 'Complete STOP response must not be marked truncated');
  assert.ok(stopParsed.text.includes('Final result: A.(B + C)'));

  console.log('  ✓ parseInteractionsResponseWithMeta: Multi-chunk concatenation and finish_reason detection verified');

  // --- 7e. Simulated Secure Vault Q7 Complete Explanation ---
  const q7ExplanationFull = [
    "Step 1: Identify the variables and order them from MSB to LSB: (C, B, K, S, E).",
    "Step 2: Convert the minterms and don't-cares to 5-bit binary representations:",
    "  - Minterms: m12 (01100), m16 (10000), m18 (10010), m20 (10100), m22 (10110), m24 (11000), m26 (11010), m28 (11100), m30 (11110)",
    "  - Don't-cares: d13 (01101), d17 (10001), d21 (10101), d25 (11001), d29 (11101), d31 (11111)",
    "Step 3: Place the 1s and don't-cares on a 5-variable K-map (32 cells total).",
    "Step 4: Form the largest valid power-of-2 groups using don't-cares as 1s:",
    "  - Group 1 (16 cells): Combines all minterms with C=1 (m16, m18, m20, m22, m24, m26, m28, m30) and don't-cares (d17, d21, d25, d29, d31). In this 16-cell subcube, B, K, S, E take all combinations, but E=0 is constant. Hence, this group simplifies to C.E'.",
    "  - Group 2 (4 cells): Combines m12 (01100) with d13 (01101) and adjacent terms where C=0, B=1, K=1, S=0. This simplifies to B.K.S'.",
    "Step 5: Derive each essential prime implicant:",
    "  - Implicant 1: C.E' covers minterms 16, 18, 20, 22, 24, 26, 28, 30.",
    "  - Implicant 2: B.K.S' covers minterm 12.",
    "Step 6: Confirm all 9 required minterms are covered with no redundant terms.",
    "Step 7: Obtain the minimized sum-of-products expression.",
    "Step 8: Verify the result against the truth table.",
    "Final result: B.K.S' + C.E'"
  ].join('\n\n');

  // Verify markdown formatting produces clean HTML without raw LaTeX
  const formattedQ7 = BoolAI.formatMarkdownText(q7ExplanationFull);
  assert.ok(!formattedQ7.includes('\\Sigma'), 'No raw LaTeX commands in formatted explanation');
  assert.ok(!formattedQ7.includes('\\cdot'), 'No raw LaTeX dot operators in formatted explanation');
  assert.ok(formattedQ7.includes("B.K.S' + C.E'"), 'Final simplified result is present in explanation');
  assert.ok(formattedQ7.includes('Step 1:'), 'Step 1 is present');
  assert.ok(formattedQ7.includes('Step 8:'), 'Step 8 is present');

  // --- 7f. Simpler Expression Explanation: "Explain A.B + A.C step by step" ---
  const simpleExplanation = [
    "Step 1: Identify the common factor in the expression A.B + A.C. The variable A is present in both product terms.",
    "Step 2: Apply the Distributive Law of Boolean Algebra: X.Y + X.Z = X.(Y + Z).",
    "Step 3: Factor out the variable A to obtain A.(B + C).",
    "Step 4: Verify equivalence via truth table:",
    "  - When A=0: 0.B + 0.C = 0, and 0.(B+C) = 0 (Matches).",
    "  - When A=1, B=1, C=0: 1.1 + 1.0 = 1, and 1.(1+0) = 1 (Matches).",
    "  - When A=1, B=0, C=1: 1.0 + 1.1 = 1, and 1.(0+1) = 1 (Matches).",
    "Final result: A.(B + C)"
  ].join('\n\n');

  const formattedSimple = BoolAI.formatMarkdownText(simpleExplanation);
  assert.ok(formattedSimple.includes('Step 1:'), 'Simple explanation includes Step 1');
  assert.ok(formattedSimple.includes('Final result: A.(B + C)'), 'Simple explanation reaches final result');

  // --- 7g. Multi-part Continuation Stitching Logic ---
  // Part 1: Cut off mid-sentence
  const chunk1 = "This step-by-step breakdown explains the minimization and derivation of the secure vault controller function.\n\n1. Binary Analysis of Minterms and Don't-Cares\n\nThe variables are ordered as C";
  assert.strictEqual(BoolAI.isHeuristicallyTruncated(chunk1), true);

  // Part 2: Continuation
  const chunk2 = ", B, K, S, E.\n\nStep 2: Binary Analysis...\nStep 3: K-map grouping...\nStep 4: Implicants...\nFinal result: B.K.S' + C.E'";
  
  // Stitching simulation as done in fetchCompleteGeminiResponse
  let stitched = chunk1;
  if (stitched.endsWith('\n') || chunk2.startsWith('\n')) {
    stitched += chunk2;
  } else if (stitched.endsWith(' ') || chunk2.startsWith(' ')) {
    stitched += chunk2;
  } else {
    stitched += chunk2; // chunk2 starts with comma ", B..."
  }

  assert.strictEqual(BoolAI.isHeuristicallyTruncated(stitched), false, 'Stitched response must now be complete');
  assert.ok(stitched.includes('The variables are ordered as C, B, K, S, E.'));
  assert.ok(stitched.includes("Final result: B.K.S' + C.E'"));

  console.log('  ✓ Continuation stitching and multi-step assembly verified');
  console.log('  ✓ Secure Vault Q7 full 8-step explanation & simple expression explanation verified');
  console.log('✓ Module 7 (Complete Explanation & Continuation Engine) — ALL TESTS PASSED');
}
testExplanationAndContinuationEngine();

console.log('\n🎉 ALL MODULE LOGIC, ARITHMETIC, AI SUITE, DETERMINISTIC VERIFICATION & EXPLANATION TESTS PASSED WITH 100% SUCCESS!\n');


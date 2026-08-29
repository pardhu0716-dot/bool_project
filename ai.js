/**
 * BoolSynth — Domain-Restricted Conversational AI Module
 *
 * Dedicated digital logic conversational agent powered by Google Gemini Interactions API.
 * - Current Model: gemini-3.6-flash via Google's official Interactions API (/v1beta/interactions).
 * - Strict domain boundary: Only answers Boolean algebra, digital logic, circuits, and BoolSynth.
 * - DETERMINISTIC VERIFICATION ENGINE: Connects Gemini output to logic.js (parseExpression,
 *   evalAst, quineMcCluskey, minimize) to perform 5 independent mathematical checks.
 * - Automatic Correction: If Gemini gives wrong expression, BoolLogic computes and substitutes
 *   the correct answer for formal minterm/don't-care problems.
 * - LaTeX & Escaped-Markdown Sanitizer for clean explanation rendering.
 * - Multi-turn conversational memory.
 * - Dedicated Result Card with Copy-to-Clipboard and BoolSynth Synthesizer Bridge.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'boolsynth_gemini_api_key';
  const DEFAULT_MODEL = 'gemini-3.6-flash';
  const INTERACTIONS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
  const REJECTION_MESSAGE = "Sorry, I can only help with digital logic, Boolean algebra, digital circuits, and related mathematical calculations.";

  const SYSTEM_INSTRUCTION = `You are the dedicated Digital Logic & Boolean Algebra Conversational Assistant for BoolSynth.

ALLOWED SCOPE (STRICTLY RESTRICTED):
Your knowledge, conversation, and responses MUST ONLY cover:
1. Boolean algebra (laws, identities, theorems, simplifications)
2. Digital logic design & logic gates (AND, OR, NOT, NAND, NOR, XOR, XNOR)
3. Boolean expressions & canonical representations (SOP, POS, minterms, maxterms)
4. Truth tables & timing/state analysis
5. Karnaugh Maps (K-maps) & grouping rules (powers of 2, wrap-around, essential prime implicants)
6. SOP (Sum of Products) and POS (Product of Sums)
7. NAND/NOR-only implementations & De Morgan's conversions
8. Digital circuit analysis & combinational logic
9. Questions related to the BoolSynth digital logic suite and its tools
10. Mathematical calculations when directly relevant to digital logic (binary/hex conversions, 2's complement, signed overflow, popcount, powers of 2, powers of base numbers, exponentiation like 2^5, arithmetic like 25 * 16)

STRICT DOMAIN REJECTION RULE:
If the user asks ANY question, problem, code, or topic outside digital logic, Boolean algebra, digital circuits, or related digital mathematics (e.g. weather, sports, movies, music, politics, general coding in other languages like Python/Java/React/SQL, jokes, trivia, celebrities, recipes, history, philosophy, etc.):
You MUST NOT answer the question.
You MUST reply ONLY with this exact sentence:
"Sorry, I can only help with digital logic, Boolean algebra, digital circuits, and related mathematical calculations."

CRITICAL OUTPUT RULE FOR BOOLEAN PROBLEM STATEMENTS:
When the user provides a complete Boolean problem statement, word problem, circuit specification, or scenario (such as a laboratory access controller, priority decoder, voting circuit, alarm system, segment controller, etc.) and expects or asks for the Boolean function/expression:
You MUST return ONLY the raw Boolean expression.

DO NOT INCLUDE:
- No introductory text (e.g. "The Boolean expression is...")
- No greetings or pleasantries
- No explanations or step-by-step breakdowns
- No truth tables, No K-maps, No minterms or maxterms lists
- No circuit diagrams or descriptions
- No "The answer is:" or "F ="
- No Markdown fences or commentary

EXPRESSION SYNTAX RULES:
- AND operator: . (explicit dot, e.g. A.B, B.C.D)
- OR operator: + (e.g. A.B + C.D)
- NOT operator: ' (trailing prime, e.g. A', (B + C)')
- Grouping: ( ) (standard parentheses)
- NEVER use implicit multiplication (NEVER AB, ALWAYS A.B)

FORMAL MINTERM SPECIFICATION FORMAT:
When a user provides F(vars) = Σm(...) or d(vars) = Σd(...) forms, YOU MUST:
1. Interpret the variable list in exact left-to-right order as the MSB-to-LSB ordering.
2. Generate the correct minimum SOP expression using all the minterms and don't-cares.
3. Return ONLY the minimum SOP expression.

EXPLANATION FORMATTING & COMPLETENESS RULES (CRITICAL):
When the user explicitly asks for an explanation, step-by-step breakdown, or derivation (e.g. "Explain", "Step by step", "Why", "How", "Derive"):
- You MUST provide a COMPLETE, comprehensive end-to-end explanation covering all steps from start to finish.
- NEVER stop or cut off after the first section or binary analysis.
- Include all relevant sections:
  Step 1: Identify and order all input variables (MSB to LSB).
  Step 2: Convert and list minterms and don't-cares with their binary codes.
  Step 3: Analyze K-Map sub-cube groupings or Quine-McCluskey prime implicants (powers of 2, wrap-arounds, essential terms).
  Step 4: Explain which don't-cares are included as 1s to form larger groups and which remain 0s.
  Step 5: Derive the simplified algebraic product terms for each essential prime implicant.
  Step 6: Combine the terms into the final minimal SOP (or POS) expression.
  Step 7: Provide verification/truth table checking or NAND/NOR implementation when relevant.
  Final Result: State the exact final minimized Boolean expression clearly at the conclusion.
- DO NOT use raw LaTeX math delimiters: $, $$, \\[, \\], \\(, \\)
- DO NOT use LaTeX commands: \\cdot, \\mathbf, \\text, \\mathrm, \\overline, \\times, \\oplus, \\lor, \\land, \\neg
- DO NOT use backslash-escaped Markdown: \\###, \\**, \\---
- Always use standard plain-text Boolean notation: AND=., OR=+, NOT=', Grouping=()
- Structure explanations with clean whitespace, step numbers, and plain text.

CONVERSATIONAL BEHAVIOR:
- When given a problem statement -> Return ONLY the Boolean expression.
- If the user follows up with "Explain" -> Provide a complete, multi-step digital logic explanation.
- If the user asks for NAND/NOR implementation -> Provide a complete, relevant explanation.
- If the user asks "Give only the expression" -> Return ONLY the Boolean expression.
- If the user asks relevant mathematical questions -> Provide the direct answer.
- If the user asks an unrelated question -> Reject with the exact domain rejection message.`;

  // State
  let apiKey = (typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : '') || '';
  let chatHistory = [];
  let lastGeneratedExpression = '';
  let lastVerificationResult = null; // stores the most recent verification result
  let isRequestPending = false;

  /* =====================================================================
   * SECTION 1: Syntax Normalization & Environment Helpers
   * ===================================================================== */

  function getBoolLogic() {
    if (typeof window !== 'undefined' && window.BoolLogic) return window.BoolLogic;
    if (typeof global !== 'undefined' && global.BoolLogic) return global.BoolLogic;
    if (typeof require !== 'undefined') {
      try { return require('./logic.js'); } catch (e) {}
    }
    return null;
  }

  function normalizeExpressionSyntax(raw) {
    if (!raw) return '';
    let s = raw.trim();
    s = s.replace(/^```[a-z]*\s*/i, '').replace(/```$/g, '').replace(/`/g, '');
    s = s.replace(/^(?:F|f|Y|y|Z|z|Output|Result|Function)\s*(?:\([^)]*\))?\s*[:=]\s*/i, '');
    s = s.replace(/[\*\&]/g, '.');
    s = s.replace(/\|+/g, '+');
    s = s.replace(/[!~]\s*([A-Za-z0-9])/g, "$1'");
    s = s.replace(/[!~]\s*\(([^)]+)\)/g, "($1)'");
    s = s.replace(/\s+/g, '');
    s = s.replace(/([A-Za-z0-9]')([A-Za-z0-9])/g, '$1.$2');
    s = s.replace(/([A-Za-z0-9])([A-Za-z0-9])/g, '$1.$2');
    s = s.replace(/([A-Za-z0-9])([A-Za-z0-9])/g, '$1.$2');
    s = s.replace(/([A-Za-z0-9'])\(/g, '$1.(');
    s = s.replace(/\)([A-Za-z0-9])/g, ').$1');
    s = s.replace(/\)\(/g, ').(');
    s = s.replace(/\.{2,}/g, '.');
    s = s.replace(/\+/g, ' + ');
    return s.trim();
  }

  function isBooleanExpression(text) {
    const clean = text.trim();
    if (!clean) return false;
    if (clean.includes(REJECTION_MESSAGE)) return false;
    if (clean.includes('?')) return false;

    // Pure numbers / arithmetic without variables (e.g. "32", "400", "25 * 16 = 400")
    if (/^[\d\s\+\-\*\/\=\×\÷\^\.\,\(\)]+$/.test(clean) && /\d/.test(clean) && !/[A-Za-z]/.test(clean)) {
      return false;
    }

    // Natural language detection: check for lowercase words with length >= 2
    if (/[a-z]{2,}/.test(clean)) {
      const words = clean.match(/[A-Za-z]+/g) || [];
      const allowedKeywords = new Set(['AND', 'OR', 'NOT', 'XOR', 'XNOR', 'NAND', 'NOR']);
      for (const w of words) {
        if (w.length > 1 && !allowedKeywords.has(w.toUpperCase())) {
          return false; // contains natural language English words (e.g. 'circuit', 'sensor', 'weather')
        }
      }
    }

    // English stop words rejection for uppercase sentences
    const englishStopWords = new Set([
      'THE', 'WHAT', 'IS', 'IN', 'THIS', 'THAT', 'FOR', 'WITH', 'TODAY', 'EXPLAIN',
      'HOW', 'WHY', 'WHEN', 'WHERE', 'WHO', 'CAN', 'YOU', 'HELP', 'ME', 'GIVE',
      'ONLY', 'CIRCUIT', 'DESIGN', 'SENSOR', 'ALARM', 'SYSTEM', 'DOOR', 'CONTROLLER',
      'OUTPUT', 'INPUT', 'STATE', 'TABLE', 'TRUTH', 'MAP', 'KARNAUGH', 'MINTERM',
      'MAXTERM', 'SORRY', 'HELLO', 'PLEASE', 'YES', 'NO', 'TRUE', 'FALSE'
    ]);
    const upperWords = clean.match(/[A-Za-z]{2,}/g) || [];
    for (const w of upperWords) {
      if (englishStopWords.has(w.toUpperCase())) return false;
    }

    const validPattern = /^[A-Za-z0-9\s\.\+\'\!\~\*\&\^\|\(\)\=\:\-]+$/;
    return validPattern.test(clean) && /[A-Za-z]/.test(clean);
  }

  /* =====================================================================
   * SECTION 2: Formal Boolean Specification Extractor
   *
   * Detects and parses formal minterm/don't-care notation from user input:
   *   F(A,B,C,D,E) = Σm(0,1,4,...) or Sm(...)
   *   d(A,B,C,D,E) = Σd(2,3,...) or Sd(...)
   * Returns null if no formal spec found (ordinary natural-language question).
   * ===================================================================== */

  function extractBooleanSpec(userText) {
    if (!userText) return null;
    // Normalize LaTeX \Sigma / \sigma / \sum and collapse whitespace
    let t = userText.replace(/\\Sigma|\\sigma|\\sum/gi, 'Σ');
    t = t.replace(/\s+/g, ' ').trim();

    // Variable list pattern: F(C,B,K,S,E), Z(A,B,T,P,V,M), (A, B, C, D)
    let vars = null;
    let minterms = null;
    let dontcares = [];

    const varHeaderMatch = /(?:[A-Za-z0-9_]+)?\s*\(\s*([A-Za-z](?:\s*,\s*[A-Za-z])*)\s*\)/.exec(t);
    if (varHeaderMatch) {
      const parsedVars = varHeaderMatch[1].split(',').map(v => v.trim()).filter(v => v.length > 0);
      if (parsedVars.length >= 2) {
        vars = parsedVars;
      }
    }

    // Minterms pattern: Σm(...) or m(...) or minterms: ... or minterms(...)
    const mMatch = /(?:[Σσ∑]\s*)?[Mm](?:interms?)?\s*\(\s*([\d,\s]+)\s*\)/.exec(t) ||
                   /[Mm]interms?\s*[:=]\s*([\d,\s]+)/.exec(t);
    if (mMatch) {
      minterms = mMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    }

    // Don't-cares pattern: Σd(...) or d(...) = Σd(...) or + d(...) or don't cares: ...
    const dMatch = /(?:[dD](?:on'?t[-\s]?[Cc]are[s]?)?\s*(?:\([A-Za-z,\s]+\)\s*=?)?\s*)?[Σσ∑]\s*[Dd](?:on'?t[-\s]?[Cc]are[s]?)?\s*\(\s*([\d,\s]+)\s*\)/.exec(t) ||
                   /(?:[Σσ∑]\s*)?[dD](?:on'?t[-\s]?[Cc]are[s]?)?\s*\(\s*([\d,\s]+)\s*\)/.exec(t) ||
                   /[dD](?:on'?t[-\s]?[Cc]are[s]?)?\s*[:=]\s*([\d,\s]+)/.exec(t);
    if (dMatch) {
      dontcares = dMatch[1].split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    }

    // Fallback variable detection if not in header
    if (!vars && minterms && minterms.length > 0) {
      const varWordMatch = /variables?\s*[:=]?\s*([A-Za-z,\s]+)/i.exec(t);
      if (varWordMatch) {
        vars = varWordMatch[1].split(',').map(v => v.trim()).filter(v => v.length === 1);
      }
    }

    if (!vars || !minterms || minterms.length === 0) return null;

    const numVars = vars.length;
    const maxMinterm = (1 << numVars) - 1;

    // Sanity check: all minterms and dontcares within valid range [0, 2^n - 1]
    if (minterms.some(m => m < 0 || m > maxMinterm)) return null;
    if (dontcares.some(d => d < 0 || d > maxMinterm)) return null;

    // Detect question type
    const lc = t.toLowerCase();
    let questionType = 'minSOP'; // default
    if (/\bpos\b|\bproduct\s+of\s+sum|\bmin(?:imum)?\s+pos\b/i.test(t)) questionType = 'minPOS';
    if (/\bprime\s+impl/i.test(t) && !/essential/i.test(t)) questionType = 'primeImplicants';
    if (/essential\s+prime\s+impl/i.test(t)) questionType = 'essentialPIs';

    return { vars, minterms, dontcares, numVars, questionType };
  }

  /* =====================================================================
   * SECTION 3: Deterministic Verification Engine
   *
   * Uses logic.js functions:
   *   - BoolLogic.parseExpression()
   *   - BoolLogic.evalAst()
   *   - BoolLogic.collectVars()
   *   - BoolLogic.quineMcCluskey()
   *   - BoolLogic.sopFromPIs()
   *   - BoolLogic.minimize()
   *
   * Returns a verification result object:
   * {
   *   passed: boolean,
   *   check1: { pass, failedMinterms },  // required 1s
   *   check2: { pass, failedMinterms },  // required 0s
   *   check3: { pass },                  // don't-care handling
   *   check4: { pass, error },           // syntax / variable validity
   *   check5: { pass, aiLitCount, refLitCount, refExpr }, // minimality
   *   correctedExpr: string | null,      // deterministic result if AI was wrong
   *   refExpr: string                    // reference expression from QM
   * }
   * ===================================================================== */

  function countProductTerms(exprStr) {
    try {
      const logic = getBoolLogic();
      if (!logic) return Infinity;
      const ast = logic.parseExpression(exprStr);
      if (!ast) return Infinity;
      let terms = 0;
      function countOrBranches(node) {
        if (!node) return;
        if (node.type === 'OR') {
          if (Array.isArray(node.args)) node.args.forEach(countOrBranches);
        } else {
          terms++;
        }
      }
      countOrBranches(ast);
      return terms;
    } catch (e) {
      return Infinity;
    }
  }

  function countLiterals(exprStr) {
    try {
      const logic = getBoolLogic();
      if (!logic) return Infinity;
      const ast = logic.parseExpression(exprStr);
      if (!ast) return Infinity;
      let count = 0;
      function walk(node) {
        if (!node) return;
        if (node.type === 'VAR') { count++; return; }
        if (Array.isArray(node.args)) node.args.forEach(walk);
      }
      walk(ast);
      return count;
    } catch (e) {
      return Infinity;
    }
  }

  function evalExprOnMinterm(exprStr, vars, mintermIndex) {
    const logic = getBoolLogic();
    if (!logic) return null;
    const numVars = vars.length;
    const env = {};
    for (let b = 0; b < numVars; b++) {
      env[vars[b]] = (mintermIndex >> (numVars - 1 - b)) & 1;
    }
    try {
      const ast = logic.parseExpression(exprStr);
      return logic.evalAst(ast, env);
    } catch (e) {
      return null; // parse error
    }
  }

  function verifyBooleanExpression(aiExpr, spec) {
    const logic = getBoolLogic();
    const { vars, minterms, dontcares, numVars, questionType } = spec;
    const reqSet = new Set(minterms);
    const dcSet = new Set(dontcares);
    const total = 1 << numVars;
    const offSet = [];
    for (let i = 0; i < total; i++) {
      if (!reqSet.has(i) && !dcSet.has(i)) offSet.push(i);
    }

    const result = {
      passed: false,
      check1: { pass: true, failedMinterms: [] },
      check2: { pass: true, failedMinterms: [] },
      check3: { pass: true },
      check4: { pass: true, error: null },
      check5: { pass: true, aiTermCount: 0, refTermCount: 0, aiLitCount: 0, refLitCount: 0, refExpr: '' },
      correctedExpr: null,
      refExpr: '',
      questionType: questionType || 'minSOP'
    };

    if (!logic) {
      result.check4.pass = false;
      result.check4.error = 'BoolLogic engine unavailable';
      return result;
    }

    // CHECK 4: Parse the AI expression and validate variable usage
    let aiAst = null;
    try {
      aiAst = logic.parseExpression(aiExpr);
    } catch (e) {
      result.check4.pass = false;
      result.check4.error = e.message;
    }

    if (aiAst) {
      const usedVars = Array.from(logic.collectVars(aiAst));
      const validVarSet = new Set(vars.map(v => v.toUpperCase()));
      const invalidVars = usedVars.filter(v => !validVarSet.has(v.toUpperCase()));
      if (invalidVars.length > 0) {
        result.check4.pass = false;
        result.check4.error = `Expression uses variables (${invalidVars.join(', ')}) not in the specification (${vars.join(', ')})`;
      }
    }

    // CHECK 1: Every required minterm must evaluate to 1
    if (aiAst && result.check4.pass) {
      for (const m of minterms) {
        const val = evalExprOnMinterm(aiExpr, vars, m);
        if (val !== 1) {
          result.check1.pass = false;
          result.check1.failedMinterms.push(m);
        }
      }
    } else {
      result.check1.pass = false;
    }

    // CHECK 2: Every required 0-minterm must evaluate to 0
    if (aiAst && result.check4.pass) {
      for (const m of offSet) {
        const val = evalExprOnMinterm(aiExpr, vars, m);
        if (val !== 0) {
          result.check2.pass = false;
          result.check2.failedMinterms.push(m);
        }
      }
    } else {
      result.check2.pass = false;
    }

    // CHECK 3: Don't-cares are NOT required to be 1 — verify validity
    result.check3.pass = result.check1.pass && result.check2.pass;

    // Compute deterministic reference solution using logic.js
    let normalizedRef = '';
    if (questionType === 'minPOS') {
      const minResult = logic.minimize(minterms, dontcares, numVars, vars);
      normalizedRef = normalizeExpressionSyntax(minResult.pos.str);
    } else if (questionType === 'primeImplicants' || questionType === 'essentialPIs') {
      const qm = logic.quineMcCluskey(minterms, dontcares, numVars);
      const targetPIs = (questionType === 'essentialPIs') ? qm.essentialPIs : qm.primeImplicants;
      const piStrings = targetPIs.map(pi => logic.literalsToString(logic.piToLiterals(pi.bits, vars), ''));
      normalizedRef = piStrings.join(', ');
    } else {
      // Default: minSOP
      const qm = logic.quineMcCluskey(minterms, dontcares, numVars);
      const refSOP = logic.sopFromPIs(qm.selectedPIs, vars);
      normalizedRef = normalizeExpressionSyntax(refSOP.str);
    }

    result.refExpr = normalizedRef;
    result.check5.refExpr = normalizedRef;

    const refTerms = countProductTerms(normalizedRef);
    const refLits = countLiterals(normalizedRef);
    result.check5.refTermCount = refTerms;
    result.check5.refLitCount = refLits;

    // CHECK 5: Minimality — compare AI terms and literal counts against QM reference
    if (aiAst && result.check4.pass && result.check1.pass && result.check2.pass) {
      const aiTerms = countProductTerms(aiExpr);
      const aiLits = countLiterals(aiExpr);
      result.check5.aiTermCount = aiTerms;
      result.check5.aiLitCount = aiLits;

      // Minimality criteria:
      // 1. Must minimize number of product terms first
      // 2. Then minimize total literal count
      // 3. Accept any valid alternate minimal cover having same minimum term count and literal count
      if (aiTerms > refTerms) {
        result.check5.pass = false; // More product terms than minimal cover
      } else if (aiTerms === refTerms && aiLits > refLits) {
        result.check5.pass = false; // More literals than minimal cover
      } else {
        result.check5.pass = true; // Minimal cover satisfied
      }
    } else {
      result.check5.pass = false;
    }

    // Overall pass/fail
    result.passed = result.check1.pass && result.check2.pass &&
                    result.check3.pass && result.check4.pass && result.check5.pass;

    // If any check failed, compute correction using deterministic engine
    if (!result.passed) {
      result.correctedExpr = normalizedRef;
    }

    return result;
  }

  /* =====================================================================
   * SECTION 4: LaTeX & Escaped-Markdown Sanitizer
   * ===================================================================== */

  function cleanExplanationText(raw) {
    if (!raw) return '';
    let s = raw;
    // Display LaTeX delimiters
    s = s.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, '$1');
    s = s.replace(/\$\$\s*([\s\S]*?)\s*\$\$/g, '$1');
    // Inline LaTeX delimiters
    s = s.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, '$1');
    s = s.replace(/\$([^\$\n]+)\$/g, '$1');
    // LaTeX commands
    s = s.replace(/\\mathbf\{([^}]+)\}/g, '$1');
    s = s.replace(/\\text\{([^}]+)\}/g, '$1');
    s = s.replace(/\\mathrm\{([^}]+)\}/g, '$1');
    s = s.replace(/\\operatorname\{([^}]+)\}/g, '$1');
    s = s.replace(/\\overline\{([^}]+)\}/g, "($1)'");
    s = s.replace(/\\cdot/g, '.');
    s = s.replace(/\\times/g, '×');
    s = s.replace(/\\oplus/g, '⊕');
    s = s.replace(/\\lor/g, '+');
    s = s.replace(/\\land/g, '.');
    s = s.replace(/\\neg\s*([A-Za-z0-9])/g, "$1'");
    s = s.replace(/\\sim\s*([A-Za-z0-9])/g, "$1'");
    s = s.replace(/\\neq/g, '≠');
    s = s.replace(/\\le(q)?/g, '≤');
    s = s.replace(/\\ge(q)?/g, '≥');
    s = s.replace(/\\Sigma/g, 'Σ');
    s = s.replace(/\\Pi/g, 'Π');
    // Escaped Markdown
    s = s.replace(/\\(#{1,6})/g, '$1');
    s = s.replace(/\\\*/g, '*');
    s = s.replace(/\\_/g, '_');
    s = s.replace(/\\-/g, '-');
    s = s.replace(/\\\[/g, '[');
    s = s.replace(/\\\]/g, ']');
    s = s.replace(/\\\(/g, '(');
    s = s.replace(/\\\)/g, ')');
    s = s.replace(/\\([.+*'=><^])/g, '$1');
    return s;
  }

  /* =====================================================================
   * SECTION 5: Google Interactions API Transport & Continuation
   * ===================================================================== */

  function isExplanationRequest(text) {
    if (!text || typeof text !== 'string') return false;
    return /\b(explain|explanation|breakdown|step[- ]by[- ]step|steps|why|how\s+(?:to|did|does|is|come|derive|simplify)|derivation|derive|walkthrough|describe|show\s+how|details?)\b/i.test(text);
  }

  function isHeuristicallyTruncated(text) {
    if (!text || typeof text !== 'string') return false;
    const trimmed = text.trim();
    if (!trimmed || trimmed.length < 50) return false;

    // Check for unclosed markdown code fences
    const fenceCount = (trimmed.match(/```/g) || []).length;
    if (fenceCount % 2 !== 0) return true;

    // Check if ending with dangling connectors, incomplete steps, or open punctuation
    const danglingEnd = /(?:as\s+[A-Za-z0-9_]+|with|and|or|where|step\s+\d+:?|for\s+example:?|because|such\s+as|namely|i\.e\.|e\.g\.|including|minterms?|variables?|is|are|the|to|in|of|that|which|[\,\:\;\-\+\*\/\\\(])$/i.test(trimmed);
    if (danglingEnd) return true;

    // Check if ends abruptly without terminal punctuation and is missing conclusion
    const hasTerminalPunct = /[.!?\)`'"]$/.test(trimmed);
    if (!hasTerminalPunct) {
      if (/\b(?:Step|1\.|2\.)\b/i.test(trimmed) && !/\b(?:Final\s+(?:result|expression|sop|pos)|Conclusion|Therefore)\b/i.test(trimmed)) {
        return true;
      }
    }

    return false;
  }

  function buildInteractionsPayload(userPrompt, history) {
    const isExplain = isExplanationRequest(userPrompt);
    // Explanations require high token ceiling; expression requests remain concise and fast
    const maxTokens = isExplain ? 8192 : 1200;

    const inputSteps = [];
    if (Array.isArray(history) && history.length > 0) {
      history.forEach(msg => {
        inputSteps.push({
          type: msg.role === 'user' ? 'user_input' : 'model_output',
          content: [{ type: 'text', text: msg.text }]
        });
      });
    }
    inputSteps.push({
      type: 'user_input',
      content: [{ type: 'text', text: userPrompt }]
    });
    return {
      model: DEFAULT_MODEL,
      system_instruction: SYSTEM_INSTRUCTION,
      input: inputSteps,
      generation_config: { max_output_tokens: maxTokens }
    };
  }

  function parseInteractionsResponseWithMeta(data) {
    if (!data) return { text: '', finishReason: null, isTruncated: false };

    let text = '';
    let finishReason = null;

    if (typeof data.output_text === 'string' && data.output_text.trim()) {
      text = data.output_text.trim();
    } else if (Array.isArray(data.steps) && data.steps.length > 0) {
      const parts = [];
      for (const step of data.steps) {
        if (step && step.type === 'model_output' && Array.isArray(step.content)) {
          for (const item of step.content) {
            if (item && item.type === 'text' && typeof item.text === 'string') {
              parts.push(item.text);
            }
          }
          if (step.finish_reason || step.finishReason) {
            finishReason = step.finish_reason || step.finishReason;
          }
        }
      }
      if (parts.length > 0) text = parts.join('').trim();
    } else if (data.candidates?.[0]?.content?.parts) {
      const parts = data.candidates[0].content.parts
        .filter(p => typeof p.text === 'string').map(p => p.text);
      if (parts.length > 0) text = parts.join('').trim();
      finishReason = data.candidates[0].finishReason || data.candidates[0].finish_reason || null;
    } else if (typeof data.text === 'string' && data.text.trim()) {
      text = data.text.trim();
    }

    if (!finishReason) {
      finishReason = data.finish_reason || data.finishReason || null;
    }

    const frUpper = String(finishReason || '').toUpperCase();
    const isTruncated = frUpper === 'MAX_TOKENS' || frUpper === 'LENGTH' || isHeuristicallyTruncated(text);

    return { text, finishReason, isTruncated };
  }

  function parseInteractionsResponse(data) {
    return parseInteractionsResponseWithMeta(data).text;
  }

  async function callGeminiAPI(userPrompt, customHistory = null) {
    if (!apiKey) throw new Error('MISSING_API_KEY');
    const trimmedKey = apiKey.trim();
    const endpoint = `${INTERACTIONS_ENDPOINT}?key=${encodeURIComponent(trimmedKey)}`;
    const history = customHistory !== null ? customHistory : chatHistory;
    const requestBody = buildInteractionsPayload(userPrompt, history);
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': trimmedKey },
      body: JSON.stringify(requestBody)
    });
    if (!response.ok) {
      let errDetail = '';
      try {
        const errJson = await response.json();
        errDetail = errJson.error?.message || errJson.message || JSON.stringify(errJson);
      } catch (e) { errDetail = response.statusText; }
      if ((response.status === 400 || response.status === 401 || response.status === 403) &&
          (errDetail.toLowerCase().includes('api key') || errDetail.toLowerCase().includes('unauthorized'))) {
        throw new Error('INVALID_API_KEY: ' + errDetail);
      }
      throw new Error(`API Error (${response.status}): ${errDetail}`);
    }
    const data = await response.json();
    const meta = parseInteractionsResponseWithMeta(data);
    if (!meta.text) throw new Error('Empty response received from Gemini Interactions API.');
    return meta;
  }

  async function fetchCompleteGeminiResponse(userPrompt) {
    const isExplain = isExplanationRequest(userPrompt);
    const initialResult = await callGeminiAPI(userPrompt);
    let accumulatedText = initialResult.text;
    let isTruncated = initialResult.isTruncated;

    // Automatic multi-step continuation for explanation requests
    if (isExplain && isTruncated) {
      const MAX_CONTINUATIONS = 4;
      let count = 0;
      while (count < MAX_CONTINUATIONS && isTruncated) {
        count++;
        const continuationHistory = [
          ...(Array.isArray(chatHistory) ? chatHistory : []),
          { role: 'user', text: userPrompt },
          { role: 'model', text: accumulatedText }
        ];
        const continuationPrompt = "Please continue the explanation seamlessly from the exact point where you stopped above. Provide the remaining steps, derivations, and final minimized Boolean expression without repeating prior text.";

        try {
          const nextResult = await callGeminiAPI(continuationPrompt, continuationHistory);
          const nextText = nextResult.text.trim();
          if (!nextText) break;

          if (accumulatedText.endsWith('\n') || nextText.startsWith('\n')) {
            accumulatedText += nextText;
          } else if (accumulatedText.endsWith(' ') || nextText.startsWith(' ')) {
            accumulatedText += nextText;
          } else {
            accumulatedText += ' ' + nextText;
          }

          isTruncated = nextResult.isTruncated || isHeuristicallyTruncated(accumulatedText);
        } catch (err) {
          console.warn('Continuation request failed, returning accumulated text:', err);
          break;
        }
      }
    }

    return accumulatedText;
  }

  /* =====================================================================
   * SECTION 6: Main Message Processing Pipeline
   *
   * Full flow:
   *   userText → Gemini → extract spec → deterministic verify → render
   * ===================================================================== */

  async function processMessage(userText) {
    const isExplain = isExplanationRequest(userText);

    // 1. Call Gemini with automatic continuation for complete explanations
    const aiRawReply = await fetchCompleteGeminiResponse(userText);

    // 2. Extract formal spec from the USER's question (not the AI reply)
    const spec = extractBooleanSpec(userText);

    // 3. If we have a formal spec and the user is NOT requesting an explanation
    //    → perform deterministic verification
    let finalExpr = null;
    let verificationResult = null;
    const aiReplyIsExpr = isBooleanExpression(aiRawReply.trim());

    const logic = getBoolLogic();
    if (!isExplain) {
      if (spec && logic) {
        if (aiReplyIsExpr) {
          const normalizedAIExpr = normalizeExpressionSyntax(aiRawReply);
          try {
            verificationResult = verifyBooleanExpression(normalizedAIExpr, spec);
            lastVerificationResult = verificationResult;

            if (verificationResult.passed) {
              finalExpr = normalizedAIExpr;
            } else {
              // Use deterministic correction from logic.js
              finalExpr = verificationResult.correctedExpr
                ? normalizeExpressionSyntax(verificationResult.correctedExpr)
                : normalizedAIExpr;
            }
          } catch (e) {
            console.error('Verification engine error:', e);
            finalExpr = normalizeExpressionSyntax(aiRawReply);
            verificationResult = null;
          }
        } else {
          // Spec is present, but AI returned non-expression (e.g. preamble)
          // Compute mathematically authoritative minimal SOP using logic.js
          try {
            const qm = logic.quineMcCluskey(spec.minterms, spec.dontcares, spec.numVars);
            const refSOP = logic.sopFromPIs(qm.selectedPIs, spec.vars);
            finalExpr = normalizeExpressionSyntax(refSOP.str);
            verificationResult = {
              passed: false,
              check1: { pass: true, failedMinterms: [] },
              check2: { pass: true, failedMinterms: [] },
              check3: { pass: true },
              check4: { pass: true, error: null },
              check5: { pass: true, aiLitCount: 0, refLitCount: countLiterals(finalExpr), refExpr: finalExpr },
              correctedExpr: finalExpr,
              refExpr: finalExpr,
              questionType: spec.questionType
            };
            lastVerificationResult = verificationResult;
          } catch (e) {
            console.error('Deterministic QM fallback error:', e);
          }
        }
      } else if (aiReplyIsExpr) {
        // No formal spec, but AI returned an expression — normalize and use as-is
        finalExpr = normalizeExpressionSyntax(aiRawReply);
        verificationResult = null;
      }
    }

    return { aiRawReply, finalExpr, verificationResult, spec };
  }

  /* =====================================================================
   * SECTION 7: DOM & Chat UI
   * ===================================================================== */

  function initAIModule() {
    renderAPIKeyBadge();
    bindEvents();
    renderWelcomeMessage();
  }

  function renderAPIKeyBadge() {
    const badgeContainer = document.getElementById('ai-key-status-container');
    if (!badgeContainer) return;
    if (apiKey) {
      badgeContainer.innerHTML = `
        <button class="btn-secondary ai-key-badge active" id="ai-btn-open-key" title="Gemini API Key configured. Click to modify.">
          <span class="key-dot active"></span> 🔑 API Key Active (${DEFAULT_MODEL})
        </button>`;
    } else {
      badgeContainer.innerHTML = `
        <button class="btn-primary ai-key-badge inactive" id="ai-btn-open-key" title="Click to enter your Gemini API Key">
          <span class="key-dot inactive"></span> 🔑 Set Gemini API Key
        </button>`;
    }
    const btn = document.getElementById('ai-btn-open-key');
    if (btn) btn.addEventListener('click', openKeyModal);
  }

  function openKeyModal() {
    const modal = document.getElementById('ai-key-modal');
    const input = document.getElementById('ai-key-input');
    if (!modal || !input) return;
    input.value = apiKey || '';
    modal.style.display = 'flex';
    input.focus();
  }

  function closeKeyModal() {
    const modal = document.getElementById('ai-key-modal');
    if (modal) modal.style.display = 'none';
  }

  function renderWelcomeMessage() {
    const stream = document.getElementById('ai-chat-stream');
    if (!stream || stream.children.length > 0) return;
    stream.innerHTML = `
      <div class="ai-msg-row ai-msg-model welcome-card">
        <div class="ai-avatar">⚡</div>
        <div class="ai-msg-content">
          <div class="ai-msg-header">BoolSynth AI Logic Assistant (${DEFAULT_MODEL})</div>
          <p>I am your dedicated <strong>Digital Logic &amp; Boolean Algebra Assistant</strong>.
          Paste any digital logic problem to get its exact Boolean expression, or ask questions about gates, K-maps, and digital circuit theorems.</p>
          <div class="ai-rules-badge-row">
            <span class="ai-rule-badge">✓ Boolean Algebra</span>
            <span class="ai-rule-badge">✓ Problem → Formula (Raw)</span>
            <span class="ai-rule-badge">✓ Deterministic Verification</span>
            <span class="ai-rule-badge">✓ K-Maps &amp; Gates</span>
            <span class="ai-rule-badge">✓ Zero General Chat</span>
          </div>
        </div>
      </div>`;
  }

  function appendUserMessage(text) {
    const stream = document.getElementById('ai-chat-stream');
    if (!stream) return;
    const row = document.createElement('div');
    row.className = 'ai-msg-row ai-msg-user';
    row.innerHTML = `
      <div class="ai-msg-content"><div class="ai-msg-text">${escapeHtml(text)}</div></div>
      <div class="ai-avatar user-avatar">U</div>`;
    stream.appendChild(row);
    scrollChatToBottom();
  }

  function appendLoadingIndicator() {
    const stream = document.getElementById('ai-chat-stream');
    if (!stream) return null;
    const row = document.createElement('div');
    row.id = 'ai-typing-indicator';
    row.className = 'ai-msg-row ai-msg-model';
    row.innerHTML = `
      <div class="ai-avatar">⚡</div>
      <div class="ai-msg-content">
        <div class="ai-typing-dots"><span></span><span></span><span></span></div>
      </div>`;
    stream.appendChild(row);
    scrollChatToBottom();
    return row;
  }

  function removeLoadingIndicator() {
    const el = document.getElementById('ai-typing-indicator');
    if (el) el.remove();
  }

  function appendModelResponse(rawText, finalExpr, verificationResult) {
    const stream = document.getElementById('ai-chat-stream');
    if (!stream) return;

    const isRejection = rawText.trim() === REJECTION_MESSAGE || rawText.includes(REJECTION_MESSAGE);
    const row = document.createElement('div');
    row.className = `ai-msg-row ai-msg-model ${isRejection ? 'ai-msg-rejection' : ''}`;

    let contentHtml = '';

    if (isRejection) {
      contentHtml = `
        <div class="ai-avatar rejection-avatar">🚫</div>
        <div class="ai-msg-content">
          <div class="ai-rejection-box">
            <span class="ai-rejection-icon">⚠️</span>
            <span class="ai-rejection-text">${escapeHtml(REJECTION_MESSAGE)}</span>
          </div>
        </div>`;
    } else if (finalExpr) {
      // Build verification status badge
      let verBadge = '';
      if (verificationResult) {
        if (verificationResult.passed) {
          verBadge = `<span class="ai-ver-badge ai-ver-ok" title="All 5 deterministic checks passed using logic.js">✓ VERIFIED by Boolean engine</span>`;
        } else {
          verBadge = `<span class="ai-ver-badge ai-ver-corrected" title="AI expression failed verification. Corrected by Quine-McCluskey engine.">⚡ CORRECTED by Boolean engine</span>`;
        }
      }

      lastGeneratedExpression = finalExpr;
      contentHtml = `
        <div class="ai-avatar">⚡</div>
        <div class="ai-msg-content" style="width:100%;">
          <div class="ai-expr-card">
            <div class="ai-expr-card-head">
              <span class="ai-expr-tag">Boolean Expression</span>
              <span class="ai-expr-sub">Explicit Dot (.) Multiplication</span>
            </div>
            <div class="ai-expr-formula">${escapeHtml(finalExpr)}</div>
            ${verBadge}
            <div class="ai-expr-actions">
              <button class="btn-secondary ai-btn-copy" data-expr="${escapeAttr(finalExpr)}">
                <span class="btn-icon">📋</span> Copy Expression
              </button>
              <button class="btn-primary ai-btn-synth" data-expr="${escapeAttr(finalExpr)}">
                <span class="btn-icon">⚡</span> Synthesize Circuit in BoolSynth →
              </button>
            </div>
          </div>
        </div>`;
    } else {
      // Explanations, math answers, NAND descriptions, etc.
      contentHtml = `
        <div class="ai-avatar">⚡</div>
        <div class="ai-msg-content">
          <div class="ai-msg-text">${formatMarkdownText(rawText)}</div>
        </div>`;
    }

    row.innerHTML = contentHtml;
    stream.appendChild(row);

    row.querySelectorAll('.ai-btn-copy').forEach(btn => {
      btn.addEventListener('click', () => copyToClipboard(btn.dataset.expr, btn));
    });
    row.querySelectorAll('.ai-btn-synth').forEach(btn => {
      btn.addEventListener('click', () => sendExpressionToBoolSynth(btn.dataset.expr));
    });

    scrollChatToBottom();
  }

  function scrollChatToBottom() {
    const stream = document.getElementById('ai-chat-stream');
    if (stream) stream.scrollTop = stream.scrollHeight;
  }

  /* =====================================================================
   * SECTION 8: Actions — Copy & Synthesize
   * ===================================================================== */

  async function copyToClipboard(text, btnElement) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      if (btnElement) {
        const oldHtml = btnElement.innerHTML;
        btnElement.innerHTML = '<span class="btn-icon">✓</span> Copied!';
        btnElement.classList.add('btn-copied');
        setTimeout(() => {
          btnElement.innerHTML = oldHtml;
          btnElement.classList.remove('btn-copied');
        }, 2000);
      }
      if (window.BoolUI && window.BoolUI.showToast) window.BoolUI.showToast('Expression copied!', 'success');
    } catch (err) {
      console.error('Copy failed:', err);
    }
  }

  function sendExpressionToBoolSynth(expression) {
    if (!expression) return;
    if (window.BoolUI && window.BoolUI.switchTab) window.BoolUI.switchTab('module-boolsynth');
    const exprTabBtn = document.querySelector('.tab-btn[data-tab="expr"]');
    if (exprTabBtn) exprTabBtn.click();
    const exprInput = document.getElementById('expr-input');
    if (exprInput) exprInput.value = expression;
    const synthBtn = document.getElementById('synthesize-btn');
    if (synthBtn) synthBtn.click();
    if (window.BoolUI && window.BoolUI.showToast) window.BoolUI.showToast(`Synthesizing: ${expression}`, 'success');
  }

  /* =====================================================================
   * SECTION 9: Send Message Handler
   * ===================================================================== */

  async function handleSendMessage() {
    const input = document.getElementById('ai-chat-input');
    if (!input || isRequestPending) return;
    const userText = input.value.trim();
    if (!userText) return;
    if (!apiKey) {
      openKeyModal();
      if (window.BoolUI && window.BoolUI.showToast) window.BoolUI.showToast('Please enter your Gemini API Key.', 'info');
      return;
    }
    input.value = '';
    input.style.height = 'auto';
    appendUserMessage(userText);
    appendLoadingIndicator();
    isRequestPending = true;
    try {
      const { aiRawReply, finalExpr, verificationResult } = await processMessage(userText);

      chatHistory.push({ role: 'user', text: userText });
      chatHistory.push({ role: 'model', text: finalExpr || aiRawReply });
      if (chatHistory.length > 20) chatHistory = chatHistory.slice(chatHistory.length - 20);

      removeLoadingIndicator();
      appendModelResponse(aiRawReply, finalExpr, verificationResult);
    } catch (err) {
      removeLoadingIndicator();
      console.error('AI Error:', err);
      const errMessage = err.message || 'Unknown error occurred.';
      if (errMessage.includes('MISSING_API_KEY') || errMessage.includes('INVALID_API_KEY')) {
        appendModelResponse(`API Key Error: ${errMessage}. Please check your Gemini API key.`, null, null);
        openKeyModal();
      } else {
        appendModelResponse(`Error communicating with Gemini: ${errMessage}`, null, null);
      }
    } finally {
      isRequestPending = false;
    }
  }

  /* =====================================================================
   * SECTION 10: Event Bindings
   * ===================================================================== */

  function bindEvents() {
    const sendBtn = document.getElementById('ai-btn-send');
    if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);

    const chatInput = document.getElementById('ai-chat-input');
    if (chatInput) {
      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage(); }
      });
      chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
      });
    }

    const clearBtn = document.getElementById('ai-btn-clear-chat');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        chatHistory = [];
        lastGeneratedExpression = '';
        lastVerificationResult = null;
        const stream = document.getElementById('ai-chat-stream');
        if (stream) stream.innerHTML = '';
        renderWelcomeMessage();
        if (window.BoolUI && window.BoolUI.showToast) window.BoolUI.showToast('Conversation cleared.', 'info');
      });
    }

    document.querySelectorAll('.ai-example-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const chatInput = document.getElementById('ai-chat-input');
        const promptText = chip.dataset.prompt;
        if (promptText && chatInput) {
          chatInput.value = promptText;
          chatInput.focus();
          chatInput.style.height = 'auto';
          chatInput.style.height = Math.min(chatInput.scrollHeight, 140) + 'px';
        }
      });
    });

    const saveKeyBtn = document.getElementById('ai-btn-save-key');
    if (saveKeyBtn) {
      saveKeyBtn.addEventListener('click', () => {
        const input = document.getElementById('ai-key-input');
        if (input) {
          const val = input.value.trim();
          apiKey = val;
          if (val) {
            localStorage.setItem(STORAGE_KEY, val);
            if (window.BoolUI && window.BoolUI.showToast) window.BoolUI.showToast('API Key saved!', 'success');
          } else {
            localStorage.removeItem(STORAGE_KEY);
            if (window.BoolUI && window.BoolUI.showToast) window.BoolUI.showToast('API Key removed.', 'info');
          }
          renderAPIKeyBadge();
          closeKeyModal();
        }
      });
    }

    const closeKeyBtn = document.getElementById('ai-btn-close-key');
    if (closeKeyBtn) closeKeyBtn.addEventListener('click', closeKeyModal);

    const keyModal = document.getElementById('ai-key-modal');
    if (keyModal) keyModal.addEventListener('click', (e) => { if (e.target === keyModal) closeKeyModal(); });

    if (window.BoolUI && window.BoolUI.registerModuleHook) {
      window.BoolUI.registerModuleHook('module-ai', () => {
        renderAPIKeyBadge();
        const input = document.getElementById('ai-chat-input');
        if (input) input.focus();
      });
    }
  }

  /* =====================================================================
   * SECTION 11: Utility Helpers
   * ===================================================================== */

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function formatMarkdownText(text) {
    const cleaned = cleanExplanationText(text);
    let s = escapeHtml(cleaned);
    s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/^### (.*$)/gim, '<h4 style="color:var(--signal);margin:10px 0 4px;">$1</h4>');
    s = s.replace(/^## (.*$)/gim, '<h3 style="color:var(--signal);margin:12px 0 6px;">$1</h3>');
    s = s.replace(/^# (.*$)/gim, '<h2 style="color:var(--signal);margin:14px 0 8px;">$1</h2>');
    s = s.replace(/^(\d+\.\s+)(.*$)/gim, '<div style="margin:4px 0 4px 8px;"><strong>$1</strong>$2</div>');
    s = s.replace(/^([*-]\s+)(.*$)/gim, '<div style="margin:3px 0 3px 16px;">• $2</div>');
    s = s.replace(/\n\n+/g, '</p><p>').replace(/\n/g, '<br/>');
    return `<p>${s}</p>`;
  }

  /* =====================================================================
   * SECTION 12: Exports for unit testing and external hooks
   * ===================================================================== */

  const BoolAIExports = {
    DEFAULT_MODEL,
    INTERACTIONS_ENDPOINT,
    SYSTEM_INSTRUCTION,
    REJECTION_MESSAGE,
    normalizeExpressionSyntax,
    isBooleanExpression,
    isExplanationRequest,
    isHeuristicallyTruncated,
    cleanExplanationText,
    formatMarkdownText,
    extractBooleanSpec,
    verifyBooleanExpression,
    countProductTerms,
    countLiterals,
    buildInteractionsPayload,
    parseInteractionsResponse,
    parseInteractionsResponseWithMeta,
    callGeminiAPI,
    fetchCompleteGeminiResponse,
    processMessage,
    sendExpressionToBoolSynth,
    copyToClipboard,
    setApiKey: (key) => {
      apiKey = key;
      if (typeof localStorage !== 'undefined') {
        if (key) localStorage.setItem(STORAGE_KEY, key);
        else localStorage.removeItem(STORAGE_KEY);
      }
    },
    getApiKey: () => apiKey,
    getChatHistory: () => chatHistory,
    clearChatHistory: () => { chatHistory = []; },
    getLastVerificationResult: () => lastVerificationResult
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = BoolAIExports;
  if (typeof window !== 'undefined') window.BoolAI = BoolAIExports;
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initAIModule);
    else initAIModule();
  }
})();

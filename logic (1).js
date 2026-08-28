/* ===================== Boolean Expression Parser ===================== */
// Grammar (precedence low->high): OR ( + | ) > AND ( . & or juxtaposition ) > NOT ( ! ~ prefix, ' postfix ) > atom
function tokenize(str) {
  const tokens = [];
  let i = 0;
  str = str.trim();
  while (i < str.length) {
    const c = str[i];
    if (/\s/.test(c)) { i++; continue; }
    if (/[A-Za-z]/.test(c)) {
      // collect a full identifier (supports single-letter vars primarily, but allow words like AND/OR/NOT/XOR)
      let j = i + 1;
      while (j < str.length && /[A-Za-z0-9_]/.test(str[j])) j++;
      const word = str.slice(i, j);
      const upper = word.toUpperCase();
      if (upper === 'AND') tokens.push({ t: 'AND' });
      else if (upper === 'OR') tokens.push({ t: 'OR' });
      else if (upper === 'NOT') tokens.push({ t: 'NOT' });
      else if (upper === 'XOR') tokens.push({ t: 'XOR' });
      else if (upper === 'XNOR') tokens.push({ t: 'XNOR' });
      else if (upper === '0' ) tokens.push({t:'ZERO'});
      else if (word.length === 1) tokens.push({ t: 'VAR', v: word.toUpperCase() });
      else {
        // multi-letter variable name, allow as-is (uppercased) treated as single var token
        tokens.push({ t: 'VAR', v: upper });
      }
      i = j;
      continue;
    }
    if (c === '0' || c === '1') {
      tokens.push({ t: c === '0' ? 'ZERO' : 'ONE' });
      i++;
      continue;
    }
    if (c === '+' || c === '|') { tokens.push({ t: 'OR' }); i++; continue; }
    if (c === '.' || c === '&' || c === '*') { tokens.push({ t: 'AND' }); i++; continue; }
    if (c === '!' || c === '~') { tokens.push({ t: 'NOT' }); i++; continue; }
    if (c === "'") { tokens.push({ t: 'PRIME' }); i++; continue; }
    if (c === '(') { tokens.push({ t: 'LP' }); i++; continue; }
    if (c === ')') { tokens.push({ t: 'RP' }); i++; continue; }
    if (c === '^') { tokens.push({ t: 'XOR' }); i++; continue; }
    throw new Error(`Unexpected character "${c}" in expression`);
  }
  return tokens;
}

function parseExpression(str) {
  const tokens = tokenize(str);
  let pos = 0;
  function peek() { return tokens[pos]; }
  function next() { return tokens[pos++]; }

  function parseOr() {
    let node = parseXor();
    while (peek() && peek().t === 'OR') {
      next();
      const right = parseXor();
      node = { type: 'OR', args: [node, right] };
    }
    return node;
  }
  function parseXor() {
    let node = parseAnd();
    while (peek() && (peek().t === 'XOR' || peek().t === 'XNOR')) {
      const op = next().t;
      const right = parseAnd();
      node = { type: op, args: [node, right] };
    }
    return node;
  }
  function startsFactor(tok) {
    if (!tok) return false;
    return ['VAR', 'NOT', 'LP', 'ZERO', 'ONE'].includes(tok.t);
  }
  function parseAnd() {
    let node = parseNot();
    while (peek() && (peek().t === 'AND' || startsFactor(peek()))) {
      if (peek().t === 'AND') next();
      const right = parseNot();
      node = { type: 'AND', args: [node, right] };
    }
    return node;
  }
  function parseNot() {
    if (peek() && peek().t === 'NOT') {
      next();
      const operand = parseNot();
      return applyPrime({ type: 'NOT', args: [operand] });
    }
    return applyPrime(parseAtom());
  }
  function applyPrime(node) {
    while (peek() && peek().t === 'PRIME') {
      next();
      node = { type: 'NOT', args: [node] };
    }
    return node;
  }
  function parseAtom() {
    const tok = next();
    if (!tok) throw new Error('Unexpected end of expression');
    if (tok.t === 'VAR') return { type: 'VAR', name: tok.v };
    if (tok.t === 'ZERO') return { type: 'CONST', value: 0 };
    if (tok.t === 'ONE') return { type: 'CONST', value: 1 };
    if (tok.t === 'LP') {
      const node = parseOr();
      if (!peek() || peek().t !== 'RP') throw new Error('Missing closing parenthesis');
      next();
      return node;
    }
    throw new Error(`Unexpected token in expression: ${tok.t}`);
  }

  const ast = parseOr();
  if (pos < tokens.length) throw new Error('Unexpected trailing tokens in expression');
  return ast;
}

function collectVars(ast, set) {
  set = set || new Set();
  if (!ast) return set;
  if (ast.type === 'VAR') set.add(ast.name);
  if (ast.args) ast.args.forEach(a => collectVars(a, set));
  return set;
}

function evalAst(ast, env) {
  switch (ast.type) {
    case 'VAR': return env[ast.name] ? 1 : 0;
    case 'CONST': return ast.value;
    case 'NOT': return evalAst(ast.args[0], env) ? 0 : 1;
    case 'AND': return (evalAst(ast.args[0], env) && evalAst(ast.args[1], env)) ? 1 : 0;
    case 'OR': return (evalAst(ast.args[0], env) || evalAst(ast.args[1], env)) ? 1 : 0;
    case 'XOR': return (evalAst(ast.args[0], env) ^ evalAst(ast.args[1], env)) ? 1 : 0;
    case 'XNOR': return (evalAst(ast.args[0], env) ^ evalAst(ast.args[1], env)) ? 0 : 1;
    default: throw new Error('Unknown node type ' + ast.type);
  }
}

/* ===================== Truth table generation ===================== */
function generateTruthTable(vars, evalRowFn) {
  const n = vars.length;
  const rows = [];
  for (let i = 0; i < (1 << n); i++) {
    const env = {};
    for (let b = 0; b < n; b++) {
      env[vars[b]] = (i >> (n - 1 - b)) & 1;
    }
    const out = evalRowFn(env, i);
    rows.push({ index: i, env, out });
  }
  return rows;
}

function truthTableFromExpr(exprStr) {
  const ast = parseExpression(exprStr);
  const vars = Array.from(collectVars(ast)).sort();
  const rows = generateTruthTable(vars, (env) => evalAst(ast, env));
  return { vars, rows, ast };
}

/* ===================== Quine-McCluskey ===================== */
// terms: array of minterm indices (numbers). numVars: number of variables.
// dontcares: array of indices treated as don't-care.
// Returns { primeImplicants: [{bits:'1-0', minterms:[...]}], essential: [...], selected: [...bits terms...] }

function popcount(x) { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; }

function toBits(num, numVars) {
  return num.toString(2).padStart(numVars, '0');
}

function combineBits(a, b) {
  // a,b strings of same length with '0','1','-' ; combine if differ in exactly one bit position (non-dash) and dashes align
  if (a.length !== b.length) return null;
  let diff = 0, idx = -1;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      if (a[i] === '-' || b[i] === '-') return null; // dash positions must match
      diff++; idx = i;
      if (diff > 1) return null;
    }
  }
  if (diff !== 1) return null;
  return a.substring(0, idx) + '-' + a.substring(idx + 1);
}

function quineMcCluskey(minterms, dontcares, numVars) {
  const allTerms = Array.from(new Set([...minterms, ...dontcares]));
  if (allTerms.length === 0) {
    return { primeImplicants: [], essentialPIs: [], selectedPIs: [], coverage: {} };
  }
  // group by popcount
  let groups = {};
  allTerms.forEach(m => {
    const bits = toBits(m, numVars);
    const ones = popcount(m);
    groups[ones] = groups[ones] || [];
    groups[ones].push({ bits, mints: new Set([m]) });
  });

  let allPIs = new Map(); // bits -> {bits, mints:Set}
  let currentGroups = groups;
  let changed = true;
  let usedInCombine = new Set();

  while (true) {
    const keys = Object.keys(currentGroups).map(Number).sort((a, b) => a - b);
    if (keys.length === 0) break;
    const nextGroups = {};
    const combinedFlags = new Map(); // key: bits -> used?
    let anyCombine = false;
    for (let k = 0; k < keys.length - 1; k++) {
      const g1 = currentGroups[keys[k]] || [];
      const g2 = currentGroups[keys[k + 1]] || [];
      for (const t1 of g1) {
        for (const t2 of g2) {
          const combined = combineBits(t1.bits, t2.bits);
          if (combined !== null) {
            anyCombine = true;
            combinedFlags.set(t1.bits, true);
            combinedFlags.set(t2.bits, true);
            const ones = combined.split('').filter(c => c === '1').length;
            nextGroups[ones] = nextGroups[ones] || new Map();
            const mkey = combined;
            const existing = nextGroups[ones].get(mkey);
            const mergedMints = new Set([...t1.mints, ...t2.mints]);
            if (existing) {
              mergedMints.forEach(m => existing.mints.add(m));
            } else {
              nextGroups[ones].set(mkey, { bits: combined, mints: mergedMints });
            }
          }
        }
      }
    }
    // any term in currentGroups not combined -> prime implicant
    for (const k of keys) {
      for (const t of (currentGroups[k] || [])) {
        if (!combinedFlags.get(t.bits)) {
          allPIs.set(t.bits + '|' + Array.from(t.mints).sort((a,b)=>a-b).join(','), t);
        }
      }
    }
    if (!anyCombine) break;
    // convert nextGroups maps to arrays for next iteration
    const converted = {};
    Object.keys(nextGroups).forEach(k => { converted[k] = Array.from(nextGroups[k].values()); });
    currentGroups = converted;
  }

  // dedupe PIs by bits (mints sets may already differ per bits string uniquely, but same bits should have same mints)
  const piByBits = new Map();
  allPIs.forEach(pi => {
    if (!piByBits.has(pi.bits)) piByBits.set(pi.bits, { bits: pi.bits, mints: new Set(pi.mints) });
    else {
      const existing = piByBits.get(pi.bits);
      pi.mints.forEach(m => existing.mints.add(m));
    }
  });
  const primeImplicants = Array.from(piByBits.values());

  // Build coverage table: only for actual minterms (not pure don't-cares) since we must cover required minterms
  const requiredMinterms = Array.from(new Set(minterms));
  const coverage = {}; // minterm -> [pi indices]
  requiredMinterms.forEach(m => { coverage[m] = []; });
  primeImplicants.forEach((pi, idx) => {
    pi.mints.forEach(m => {
      if (coverage.hasOwnProperty(m)) coverage[m].push(idx);
    });
  });

  // essential PIs: minterm covered by exactly 1 PI
  const essentialSet = new Set();
  requiredMinterms.forEach(m => {
    if (coverage[m].length === 1) essentialSet.add(coverage[m][0]);
  });

  let selected = new Set(essentialSet);
  let covered = new Set();
  selected.forEach(idx => primeImplicants[idx].mints.forEach(m => { if (requiredMinterms.includes(m)) covered.add(m); }));

  // greedy cover remaining minterms
  let remaining = requiredMinterms.filter(m => !covered.has(m));
  while (remaining.length > 0) {
    // pick PI covering the most remaining minterms
    let bestIdx = -1, bestCount = -1;
    primeImplicants.forEach((pi, idx) => {
      if (selected.has(idx)) return;
      const count = remaining.filter(m => pi.mints.has(m)).length;
      if (count > bestCount) { bestCount = count; bestIdx = idx; }
    });
    if (bestIdx === -1 || bestCount <= 0) break; // safety
    selected.add(bestIdx);
    remaining = remaining.filter(m => !primeImplicants[bestIdx].mints.has(m));
  }

  const essentialPIs = Array.from(essentialSet).map(i => primeImplicants[i]);
  const selectedPIs = Array.from(selected).map(i => primeImplicants[i]);

  return { primeImplicants, essentialPIs, selectedPIs, coverage, requiredMinterms };
}

// Convert a PI bit-string + var list into a product-term structure: array of {name, neg}
function piToLiterals(bits, vars) {
  const lits = [];
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '-') continue;
    lits.push({ name: vars[i], neg: bits[i] === '0' });
  }
  return lits;
}

function literalsToString(lits, opSymbol) {
  if (lits.length === 0) return '1';
  return lits.map(l => l.name + (l.neg ? "'" : '')).join(opSymbol);
}

// Build minimal SOP string & structure from selected PIs
function sopFromPIs(selectedPIs, vars) {
  if (selectedPIs.length === 0) return { terms: [], str: '0' };
  const terms = selectedPIs.map(pi => piToLiterals(pi.bits, vars));
  // if any term has zero literals -> function is constant 1
  if (terms.some(t => t.length === 0)) return { terms: [[]], str: '1' };
  const str = terms.map(t => literalsToString(t, '')).join(' + ');
  return { terms, str };
}

// POS: minimal SOP of complement gives product terms (each a "0-implicant"); negate each term (De Morgan)
// to get sum-of-literals groups, then AND all groups together.
function posFromComplementPIs(selectedPIs, vars) {
  if (selectedPIs.length === 0) return { groups: [], str: '1' };
  const groups = selectedPIs.map(pi => {
    const lits = piToLiterals(pi.bits, vars);
    // negate each literal (De Morgan on the product term)
    return lits.map(l => ({ name: l.name, neg: !l.neg }));
  });
  if (groups.some(g => g.length === 0)) return { groups: [[]], str: '0' };
  const str = groups.map(g => '(' + literalsToString(g, ' + ') + ')').join('');
  return { groups, str };
}

function minimize(minterms, dontcares, numVars, vars) {
  const qmSOP = quineMcCluskey(minterms, dontcares, numVars);
  const sop = sopFromPIs(qmSOP.selectedPIs, vars);

  // Determine the fully-specified function that the SOP actually realizes (don't-cares
  // get resolved one way or another by QM's PI selection). We then derive the minimal
  // POS for that *exact same* fully-specified function, so SOP/NAND and POS/NOR are
  // guaranteed to agree on every input, including don't-care rows.
  const allIdx = Array.from({ length: 1 << numVars }, (_, i) => i);
  const oneTerms = allIdx.filter(i => evalSOP(sop.terms, indexToEnv(i, numVars, vars)) === 1);
  const zeroTerms = allIdx.filter(i => !oneTerms.includes(i));
  const qmPOS = quineMcCluskey(zeroTerms, [], numVars);
  const pos = posFromComplementPIs(qmPOS.selectedPIs, vars);

  return { sop, pos, qmSOP, qmPOS, realizedOnes: oneTerms };
}

function indexToEnv(i, numVars, vars) {
  const env = {};
  for (let b = 0; b < numVars; b++) env[vars[b]] = (i >> (numVars - 1 - b)) & 1;
  return env;
}

/* ===================== NAND / NOR structural evaluation ===================== */
// Evaluate an SOP structure (terms: array of literal-arrays) as normal AND-OR-NOT circuit
function evalSOP(terms, env) {
  if (terms.length === 0) return 0;
  return terms.some(term => term.every(l => (env[l.name] ? 1 : 0) === (l.neg ? 0 : 1))) ? 1 : 0;
}
function evalPOS(groups, env) {
  if (groups.length === 0) return 1;
  return groups.every(g => g.some(l => (env[l.name] ? 1 : 0) === (l.neg ? 0 : 1))) ? 1 : 0;
}

// NAND-only realization of SOP: first layer NAND per term (literal inputs), second layer single NAND combining.
// If a term has only 1 literal that's the AND-input duplicated; if only one term total, add inverter stage.
function evalNANDCircuit(terms, env) {
  const nand = (a, b) => (a && b) ? 0 : 1;
  if (terms.length === 0) return 0; // constant 0 function - no terms
  const firstLayer = terms.map(term => {
    if (term.length === 0) return 0; // shouldn't happen for proper SOP terms (constant-1 handled elsewhere)
    let vals = term.map(l => (env[l.name] ? 1 : 0) ^ (l.neg ? 1 : 0) ? 1 : ((env[l.name]?1:0) === (l.neg?0:1) ?1:0));
    // simpler: compute literal value directly
    vals = term.map(l => ((env[l.name] ? 1 : 0) === (l.neg ? 0 : 1)) ? 1 : 0);
    let acc = vals[0];
    for (let i = 1; i < vals.length; i++) acc = nand(acc, vals[i]) ; // NOTE: chaining NAND isn't plain AND; fixed below
    return vals; // placeholder, replaced by structural version below
  });
  return null; // not used; see buildNANDGateNetwork for authoritative simulation
}

/* Authoritative gate-level network simulation (used for verification + diagrams) */
// A "network" is a list of gates: {id, type: 'NAND'|'NOR'|'NOT'|'AND'|'OR', inputs:[ref,...]}, refs are either
// {kind:'var', name} or {kind:'gate', id}. Output is the last gate's id (or 'OUT').

function buildNANDNetwork(terms, vars) {
  const gates = [];
  let gid = 0;
  const newId = () => 'g' + (gid++);

  if (terms.length === 0) {
    return { gates: [], output: { kind: 'const', value: 0 }, inputsUsed: vars };
  }
  // constant-1 term (empty literal list) => output is constant 1
  if (terms.length === 1 && terms[0].length === 0) {
    return { gates: [], output: { kind: 'const', value: 1 }, inputsUsed: vars };
  }

  const termGateIds = [];
  const invCache = {};
  for (const term of terms) {
    // literal inputs: for negated literal l, we need l' - realize with a NAND(var,var) inverter gate first
    const litRefs = term.map(l => {
      if (!l.neg) return { kind: 'var', name: l.name };
      if (invCache[l.name]) return { kind: 'gate', id: invCache[l.name] };
      const invId = newId();
      gates.push({ id: invId, type: 'NAND', inputs: [{ kind: 'var', name: l.name }, { kind: 'var', name: l.name }], role: 'inverter', label: l.name + "'" });
      invCache[l.name] = invId;
      return { kind: 'gate', id: invId };
    });
    const tId = newId();
    const inputs = litRefs.length === 1 ? [litRefs[0], litRefs[0]] : litRefs;
    gates.push({ id: tId, type: 'NAND', inputs, role: 'product', label: term.map(l => l.name + (l.neg ? "'" : '')).join('') });
    termGateIds.push(tId);
  }
  let output;
  if (termGateIds.length === 1) {
    // single product term: NAND gate gives (term)'; add inverter to recover term
    const outId = newId();
    gates.push({ id: outId, type: 'NAND', inputs: [{ kind: 'gate', id: termGateIds[0] }, { kind: 'gate', id: termGateIds[0] }], role: 'output-inverter', label: 'F' });
    output = { kind: 'gate', id: outId };
  } else {
    const outId = newId();
    gates.push({ id: outId, type: 'NAND', inputs: termGateIds.map(id => ({ kind: 'gate', id })), role: 'output', label: 'F' });
    output = { kind: 'gate', id: outId };
  }
  return { gates, output, inputsUsed: vars };
}

// Basic AND-OR-NOT realization of SOP (standard two-level circuit)
function buildBasicNetwork(terms, vars) {
  const gates = [];
  let gid = 0;
  const newId = () => 'b' + (gid++);

  if (terms.length === 0) {
    return { gates: [], output: { kind: 'const', value: 0 }, inputsUsed: vars };
  }
  if (terms.length === 1 && terms[0].length === 0) {
    return { gates: [], output: { kind: 'const', value: 1 }, inputsUsed: vars };
  }

  const termGateIds = [];
  const invCache = {};
  for (const term of terms) {
    const litRefs = term.map(l => {
      if (!l.neg) return { kind: 'var', name: l.name };
      if (invCache[l.name]) return { kind: 'gate', id: invCache[l.name] };
      const invId = newId();
      gates.push({ id: invId, type: 'NOT', inputs: [{ kind: 'var', name: l.name }], role: 'inverter', label: l.name + "'" });
      invCache[l.name] = invId;
      return { kind: 'gate', id: invId };
    });
    if (litRefs.length === 1) {
      // single-literal term: no AND gate needed, term IS the literal
      termGateIds.push(litRefs[0]);
      continue;
    }
    const tId = newId();
    gates.push({ id: tId, type: 'AND', inputs: litRefs, role: 'product', label: term.map(l => l.name + (l.neg ? "'" : '')).join('') });
    termGateIds.push({ kind: 'gate', id: tId });
  }
  let output;
  if (termGateIds.length === 1) {
    output = termGateIds[0];
  } else {
    const outId = newId();
    gates.push({ id: outId, type: 'OR', inputs: termGateIds, role: 'output', label: 'F' });
    output = { kind: 'gate', id: outId };
  }
  return { gates, output, inputsUsed: vars };
}

function buildNORNetwork(groups, vars) {
  const gates = [];
  let gid = 0;
  const newId = () => 'h' + (gid++);

  if (groups.length === 0) {
    return { gates: [], output: { kind: 'const', value: 1 }, inputsUsed: vars };
  }
  if (groups.length === 1 && groups[0].length === 0) {
    return { gates: [], output: { kind: 'const', value: 0 }, inputsUsed: vars };
  }

  const sumGateIds = [];
  const invCache = {};
  for (const group of groups) {
    const litRefs = group.map(l => {
      if (!l.neg) return { kind: 'var', name: l.name };
      if (invCache[l.name]) return { kind: 'gate', id: invCache[l.name] };
      const invId = newId();
      gates.push({ id: invId, type: 'NOR', inputs: [{ kind: 'var', name: l.name }, { kind: 'var', name: l.name }], role: 'inverter', label: l.name + "'" });
      invCache[l.name] = invId;
      return { kind: 'gate', id: invId };
    });
    const sId = newId();
    const inputs = litRefs.length === 1 ? [litRefs[0], litRefs[0]] : litRefs;
    gates.push({ id: sId, type: 'NOR', inputs, role: 'sum', label: '(' + group.map(l => l.name + (l.neg ? "'" : '')).join('+') + ')' });
    sumGateIds.push(sId);
  }
  let output;
  if (sumGateIds.length === 1) {
    const outId = newId();
    gates.push({ id: outId, type: 'NOR', inputs: [{ kind: 'gate', id: sumGateIds[0] }, { kind: 'gate', id: sumGateIds[0] }], role: 'output-inverter', label: 'F' });
    output = { kind: 'gate', id: outId };
  } else {
    const outId = newId();
    gates.push({ id: outId, type: 'NOR', inputs: sumGateIds.map(id => ({ kind: 'gate', id })), role: 'output', label: 'F' });
    output = { kind: 'gate', id: outId };
  }
  return { gates, output, inputsUsed: vars };
}

function simulateNetwork(network, env) {
  if (network.output.kind === 'const') return network.output.value;
  const values = {};
  const gateById = {};
  network.gates.forEach(g => gateById[g.id] = g);
  function resolve(ref) {
    if (ref.kind === 'var') return env[ref.name] ? 1 : 0;
    if (ref.kind === 'const') return ref.value;
    if (values.hasOwnProperty(ref.id)) return values[ref.id];
    const g = gateById[ref.id];
    const inVals = g.inputs.map(resolve);
    let out;
    if (g.type === 'NAND') out = inVals.every(v => v === 1) ? 0 : 1;
    else if (g.type === 'NOR') out = inVals.some(v => v === 1) ? 0 : 1;
    else if (g.type === 'AND') out = inVals.every(v => v === 1) ? 1 : 0;
    else if (g.type === 'OR') out = inVals.some(v => v === 1) ? 1 : 0;
    else if (g.type === 'NOT') out = inVals[0] ? 0 : 1;
    values[g.id] = out;
    return out;
  }
  return resolve(network.output);
}

const BoolLogicExports = {
  tokenize, parseExpression, collectVars, evalAst, generateTruthTable, truthTableFromExpr,
  quineMcCluskey, piToLiterals, literalsToString, sopFromPIs, posFromComplementPIs, minimize,
  evalSOP, evalPOS, buildNANDNetwork, buildNORNetwork, buildBasicNetwork, simulateNetwork, toBits
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = BoolLogicExports;
}
if (typeof window !== 'undefined') {
  window.BoolLogic = BoolLogicExports;
}

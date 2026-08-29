# BoolSynth — Digital Logic Suite

A client-side digital logic toolkit with zero build steps or external dependencies. It provides four integrated modules for Boolean algebra synthesis, Karnaugh map minimization, binary arithmetic simulation, and multiplexer signal routing.

---

## Modules

### 1. ⚡ BoolSynth (Boolean Function Synthesizer)
- **Flexible Input**: Accepts Boolean functions as a **Truth Table**, a list of **Minterms / Maxterms** (with optional don't-cares), or a raw **Boolean Expression** (with support for `AND`, `OR`, `NOT`, `XOR`, `XNOR`, parentheses, and juxtaposition).
- **Quine–McCluskey Minimization**: Exact minimization via prime implicant generation, essential prime implicant extraction, and greedy minimal cover selection.
- **Circuit Generation**: Automatically lays out and renders three SVG schematics:
  - Standard **AND · OR · NOT** logic gates.
  - Two-level **NAND-only** equivalent (derived from SOP).
  - Two-level **NOR-only** equivalent (derived from POS).
- **4-Way Equivalence Verification**: Simulates every input combination across the given function, simplified SOP expression, NAND network, and NOR network, reporting a pass/fail verification table and status banner.

---

### 2. ⊞ K-Map Solver (Interactive Karnaugh Maps)
- **Variable Support**: Interactive grids for **2 variables** ($2\times 2$), **3 variables** ($2\times 4$), and **4 variables** ($4\times 4$) with Gray-code coordinate mapping ($00, 01, 11, 10$).
- **Interactive State Cycling**: Click any cell to cycle states: `0 → 1 → X (Don't Care) → 0`.
- **Toroidal Grouping Engine**: Identifies all valid power-of-2 sub-cubes ($16, 8, 4, 2, 1$) with horizontal wrap-around, vertical wrap-around, and 4-corner loop detection ($m_0, m_2, m_8, m_{10}$).
- **Visual Glow Overlays**: Renders color-coded grouping loops (Emerald, Amber, Cyan, Rose, Violet, Coral) with hover-to-glow interaction linked to the Prime Implicants table.
- **SOP & POS Minimization**: Generates minimal SOP/POS algebraic expressions and canonical $\Sigma m(...) + d(...)$ / $\Pi M(...) \cdot d(...)$ forms.
- **Direct Synthesizer Bridge**: One-click **"Synthesize Circuit in BoolSynth"** exports the current K-Map function directly into BoolSynth to generate gate-level circuit diagrams.
- **Preset Library**: Includes standard presets (XOR, Majority Vote, Odd Parity, BCD Validator, 4-Corners, 7-Segment Display segments).

---

### 3. ∑ Binary Arithmetic Engine (Adders & Subtractors)
- **1–4 Bit Multi-Bit Adder / Subtractor**:
  - Configurable bit width ($1, 2, 3, 4$ bits) and operation mode (**ADD** vs **SUBTRACT**).
  - Interactive $0/1$ bit switches for Operands $A$, $B$, and Carry-In ($C_{in}$).
  - Live decimal, signed 2's complement ($-8 \dots +7$), and hexadecimal output conversions.
- **Ripple Carry Stage Visualizer**:
  - Displays individual 1-bit Full Adder blocks ($FA_3 \leftarrow FA_2 \leftarrow FA_1 \leftarrow FA_0$).
  - Shows per-stage inputs, intermediate XOR/AND gate states, sum/difference bits, and real-time carry ripple propagation ($C_0 \rightarrow C_1 \rightarrow \dots$).
- **2's Complement Subtraction**:
  - Subtraction mode ($M = 1$) negates $B$ bitwise ($B_i \oplus 1 = B_i'$) and injects $C_{in} = 1$ to compute $A + B' + 1 = A - B$.
  - Detects signed **Overflow ($V = C_n \oplus C_{n-1}$)**, **Zero Flag ($Z$)**, and **Negative Sign ($N$)**.
- **Formatted Column Math**: Displays formatted vertical binary calculation with carry/borrow rows.
- **Discrete 1-Bit Gate Units**: Dedicated interactive modules and truth tables for **Half Adder**, **Full Adder**, **Half Subtractor**, and **Full Subtractor**.

---

### 4. 🔀 Multiplexer Simulator (Signal Routing)
- **Configurations**: Simulates **2:1**, **4:1**, and **8:1** Multiplexers with an active-low Enable Strobe ($\bar{E}$).
- **Dynamic Schematic & Signal Flow**:
  - Renders an interactive trapezoidal MUX schematic.
  - Traces the active routed data channel with a pulsing neon signal wire from input $D_i$ through the MUX core to outputs $Y$ and inverted output $\bar{Y}$ ($W$).
- **Live Equation & Truth Table**:
  - Displays the canonical SOP routing equation ($Y = \bar{E}' \cdot [\sum m_i D_i]$) with live highlight on the active product term.
  - Automatically highlights the active row in the truth table based on current Select inputs.
- **Universal Logic Synthesizer**: Preconfigured mode demonstrating how arbitrary Boolean functions (AND, OR, XOR, Majority, Full Adder Sum) can be implemented directly using a multiplexer.

---

### 5. 🤖 AI Digital Logic Assistant & Deterministic Verification Engine (`ai.js`)
- **Domain-Restricted Conversational AI**: Dedicated digital logic assistant powered by Google Gemini Interactions API (`gemini-3.6-flash`).
- **Strict Domain Boundary**: Answers only questions concerning Boolean algebra, digital logic, logic gates, truth tables, K-maps, SOP/POS, digital circuit analysis, and the BoolSynth toolkit. Automatically rejects all unrelated inquiries with a standardized domain refusal.
- **Deterministic Verification Engine (`logic.js` Authority)**: Connects AI outputs to `logic.js` (`parseExpression`, `evalAst`, `quineMcCluskey`, `sopFromPIs`, `minimize`) to perform 5 independent mathematical checks:
  1. *Check 1 (Required 1s)*: Evaluates AST across all required minterms to ensure output is 1.
  2. *Check 2 (Required 0s)*: Evaluates AST across all 0-minterms to ensure output is 0.
  3. *Check 3 (Don't-Care Handling)*: Ensures don't-care rows are not falsely required to be 1.
  4. *Check 4 (Syntax & Variable Validity)*: Validates AST parsing and verifies that all variables match the problem specification.
  5. *Check 5 (Minimality)*: Compares literal count against the Quine-McCluskey minimal cover.
- **Automatic Deterministic Correction**: If the AI output fails any check, the mathematically authoritative solution computed by `logic.js` is automatically substituted before display.
- **Problem Statement Translation**: Converts natural-language problem descriptions directly into **pure Boolean expressions** (without unnecessary explanatory text).
- **Exact Syntax Enforcement**: Automatically normalizes expressions to enforce explicit dot multiplication (`.`), OR (`+`), NOT prime (`'`), and parentheses (`( )`).
- **Dedicated Expression Card**:
  - **Verification Badges**: Live badges indicating `✓ VERIFIED by Boolean engine` or `⚡ CORRECTED by Boolean engine`.
  - **Copy to Clipboard Button**: Copies *only* the clean algebraic expression.
  - **Synthesize Circuit in BoolSynth Button**: Instantly loads the expression into the BoolSynth engine and generates all 3 gate schematics and equivalence verification.
- **Client-Side Key Protection**: API keys are stored solely in local browser storage and transmitted directly to Google Gemini via HTTPS.

---

### 6. ⚡ Kinetic Background Engine (`canvas.js`)
- **Physics-Based Particle System**: Interactive 2D particles drifting gently in the background with circuit constellation lines.
- **Cursor Repulsion**: Particles smoothly dodge and accelerate away from the mouse cursor using inverse-distance force calculations.
- **Click Energy Bursts**: Clicking on empty space spawns explosive particle bursts with decaying velocities and alpha trails.
- **Zero-Footprint Toggle**: Controlled via a floating switch at the bottom-left. When toggled OFF, `requestAnimationFrame` stops, the canvas is hidden, and memory is released to guarantee 0% CPU/GPU overhead.

---

## File Structure

```
├── index.html            — Page structure, top-level navigation, and 5 module layouts
├── style.css             — Design tokens, dark theme, interactive grids, AI chat, and schematics
├── ui.js                 — Top-level tab switching, URL hash routing, and cross-module bridge
├── ai.js                 — Domain-restricted AI conversational assistant, syntax normalizer, copy/synth bridge
├── kmaps.js              — Karnaugh Map solver, Gray-code mapper, toroidal grouping, minimal cover
├── arithmetic.js         — 1–4 bit Adders/Subtractors, ripple carry visualizer, 2's complement logic
├── mux.js                — Multiplexer simulator, signal bus visualizer, Universal Logic builder
├── canvas.js             — Kinetic background particle canvas engine
├── logic.js              — Expression parser, evaluator, Quine–McCluskey, NAND/NOR network builder
├── diagram.js            — SVG schematic renderer (auto-layout and wire routing)
├── app.js                — BoolSynth synthesizer controller
└── test_modules.js       — Automated unit test suite
```

---

## Running Locally

No dependencies, build tools, or `npm install` required:
1. Open `index.html` directly in any web browser.
2. Alternatively, run a lightweight static server:
   ```bash
   npx serve .
   ```

---

## Running Automated Tests

Run the included unit test suite to verify the algorithmic logic:
```bash
node test_modules.js
```

---

## Deployment Options

Because BoolSynth is 100% static, it can be deployed to any static hosting provider in under two minutes:

- **Netlify Drop**: Drag and drop the project folder onto [Netlify Drop](https://app.netlify.com/drop).
- **GitHub Pages**: Push the repository to GitHub and enable Pages in **Settings → Pages** (source: `main` branch root).
- **Vercel**: Run `vercel` in the project directory or import the repository at [vercel.com/new](https://vercel.com/new).
- **Cloudflare Pages / Firebase / AWS S3**: Deploy directly as static assets.

---

## Notes on the Math & Implementation

- **Quine–McCluskey Minimization**: Groups minterms and don't-cares by Hamming weight (popcount), systematically combines terms differing by a single bit, collects prime implicants, selects all essential prime implicants, and performs greedy set covering for remaining uncovered terms.
- **Dual POS Derivation**: The POS expression used for the NOR circuit is derived from the exact Boolean function realized by the SOP, ensuring both NAND and NOR implementations evaluate identically across all rows.
- **K-Map Toroidal Geometry**: The K-Map solver computes all valid rectangular sub-cubes of sizes $2^k$ across a 2D discrete torus, natively supporting wrap-around across top-bottom, left-right, and four-corner cell boundaries.
- **2's Complement Overflow**: In the arithmetic engine, signed overflow is detected via $V = C_n \oplus C_{n-1}$, correctly flagging when the addition of two numbers of the same sign produces a result of opposite sign.

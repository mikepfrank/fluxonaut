/* FLUXONAUT test harness.
 * Verifies: (1) every element transition table matches its reversibility claim;
 * (2) every level's reference solution passes Certify (all cases × jitter seeds);
 * (3) reference solutions meet the par element count and par heat (star criteria);
 * (4) fault rules fire when they should (collision, asynchrony, open port, runaway).
 * Run: node test/run-tests.mjs [--verbose]
 */
import { createRequire } from 'module';
import path from 'path';
import url from 'url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

require(path.join(__dirname, '..', 'js', 'elements.js'));
require(path.join(__dirname, '..', 'js', 'engine.js'));
require(path.join(__dirname, '..', 'js', 'levels.js'));

const F = globalThis.FLUXON;
const VERBOSE = process.argv.includes('--verbose');
let nPass = 0, nFail = 0;
function check(label, ok, extra) {
  if (ok) { nPass++; if (VERBOSE) console.log('  ✓', label); }
  else { nFail++; console.log('  ✗', label, extra || ''); }
}

// ───────────────────────────── element audits ─────────────────────────────────
console.log('Element table audit:');
for (const id of Object.keys(F.TYPES)) {
  const t = F.TYPES[id];
  const inj = F.checkReversibility(id);
  if (id === 'PFG' || id === 'PS') check(`${id} is non-injective (genuinely irreversible)`, !inj);
  else check(`${id} transition table is injective`, inj);
  // exactly one output pulse per input pulse (unless absorber)
  const states = t.states || [null];
  // partial chips (DUP/RDUP) intentionally leave out-of-order transitions undefined (fault)
  if (!t.partial) for (const st of states) for (const port of t.ports) for (const pol of [1, -1]) {
    const r = t.transition(port.name, pol, st, t.config);
    check(`${id}(${port.name},${pol > 0 ? '+' : '−'},${st}) defined`, !!r);
  }
}

// CB semantics vs the JJ'25 talk
{
  const cb = F.TYPES.CB;
  const r1 = cb.transition('K1', 1, -1);   // + control, stored − → exchange
  check('CB control mismatch exchanges (token out same port)', r1.port === 'K1' && r1.pol === -1 && r1.state === 1);
  const r2 = cb.transition('D1', 1, 1);    // + data, stored + → pass
  check('CB data match passes', r2.port === 'D2' && r2.pol === 1 && r2.state === 1);
  const r3 = cb.transition('D1', 1, -1);   // + data, stored − → reflect
  check('CB data mismatch reflects', r3.port === 'D1' && r3.pol === 1 && r3.state === -1);
  // F-symmetry: negate all polarities & states ⇒ same behavior
  let fsym = true;
  for (const port of ['K1', 'K2', 'D1', 'D2']) for (const pol of [1, -1]) for (const st of [1, -1]) {
    const a = cb.transition(port, pol, st);
    const b = cb.transition(port, -pol, -st);
    if (a.port !== b.port || a.pol !== -b.pol || a.state !== -b.state) fsym = false;
  }
  check('CB obeys flux-negation symmetry', fsym);
}

// Sandbox must offer EVERY defined element (placeable + I/O), so the free bench can
// build anything. Guards against forgetting a newly-added element (e.g. rPF).
console.log('\nSandbox palette coverage:');
for (const id of Object.keys(F.TYPES)) {
  check(`sandbox palette includes ${id}`, id in F.SANDBOX.palette, '(add it to SANDBOX.palette)');
}

// Dissipation consistency (Landauer / merge law). Heat is each device's OWN property
// (which transitions dissipate depends on its physical implementation) — but one rule
// is universal: whenever ≥2 transitions land on the same (port, polarity, state)
// output, all but one MUST be dissipative. A non-dissipative many-to-one would erase a
// distinction for free, violating Landauer. This validates the heat flags are
// self-consistent for every device in the palette, across all of its bias settings.
console.log('\nDissipation (Landauer merge law):');
for (const id of Object.keys(F.TYPES)) {
  const t = F.TYPES[id];
  if (!t.transition || t.io) continue;            // skip I/O endpoints (launcher/detector)
  // enumerate config variants (e.g. bias ±1, ccw on/off) so we check every mode
  let cfgs = [undefined];
  if (t.config) {
    cfgs = [{}];
    for (const k of Object.keys(t.config)) {
      const base = t.config[k];
      const alts = typeof base === 'boolean' ? [false, true] : (base === 1 || base === -1 ? [1, -1] : [base]);
      cfgs = cfgs.flatMap(c => alts.map(a => ({ ...c, [k]: a })));
    }
  }
  let worstFree = 1, detail = null;
  for (const cfg of cfgs) {
    const groups = {};
    for (const st of (t.states || [null])) for (const port of t.ports) for (const pol of [1, -1]) {
      let r; try { r = t.transition(port.name, pol, st, cfg); } catch (e) { r = null; }
      if (!r) continue;                            // null = undefined/fault transition, not a logical output
      const outKey = r.absorb ? 'ABSORB' : `${r.port}|${r.pol}|${r.state}`;
      (groups[outKey] = groups[outKey] || []).push(r.heat || 0);
    }
    for (const [ok, heats] of Object.entries(groups)) {
      if (heats.length < 2) continue;
      const free = heats.filter(h => h === 0).length;
      if (free > worstFree) { worstFree = free; detail = `${id} ${JSON.stringify(cfg || {})} → ${ok}: ${free} non-dissipative merges`; }
    }
  }
  check(`${id}: merged outputs leave ≤1 non-dissipative transition`, worstFree <= 1, detail);
}

// ───────────────────────────── helpers ────────────────────────────────────────
function buildCircuit(level, solution) {
  const elements = level.fixed.map(e => ({ ...e, cfg: e.cfg ? { ...e.cfg } : undefined }));
  for (const e of (solution.place || [])) {
    const t = F.TYPES[e.type];
    elements.push({
      id: e.id, type: e.type, x: e.x, y: e.y, rot: e.rot || 0, mir: !!e.mir,
      state: 'state' in e ? e.state : (t.states ? t.defaultState : null),
      cfg: e.cfg ? { ...e.cfg } : (t.config ? { ...t.config } : undefined),
    });
  }
  let wid = 0;
  const wires = [];
  for (const pw of (level.prewires || [])) {
    if ((solution.dropPrewires || []).includes(level.prewires.indexOf(pw))) continue;
    wires.push({ id: 'pw' + (wid++), a: { el: pw.a[0], port: pw.a[1] }, b: { el: pw.b[0], port: pw.b[1] }, via: pw.via || [] });
  }
  for (const w of (solution.wires || [])) {
    wires.push({ id: 'w' + (wid++), a: { el: w[0][0], port: w[0][1] }, b: { el: w[1][0], port: w[1][1] }, via: w[2] || [] });
  }
  return { elements, wires };
}

function _gsegs(pts){const o=[];for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i];if(Math.abs(a.x-b.x)<1e-9&&Math.abs(a.y-b.y)<1e-9)continue;o.push({a,b,horiz:Math.abs(a.y-b.y)<1e-9});}return o;}
function _gRect(s,r){if(s.horiz){if(s.a.y<r.y1-1e-9||s.a.y>r.y2+1e-9)return 0;return Math.max(0,Math.min(Math.max(s.a.x,s.b.x),r.x2)-Math.max(Math.min(s.a.x,s.b.x),r.x1));}if(s.a.x<r.x1-1e-9||s.a.x>r.x2+1e-9)return 0;return Math.max(0,Math.min(Math.max(s.a.y,s.b.y),r.y2)-Math.max(Math.min(s.a.y,s.b.y),r.y1));}
function _gOv(s1,s2){if(s1.horiz!==s2.horiz)return 0;if(s1.horiz){if(Math.abs(s1.a.y-s2.a.y)>1e-9)return 0;return Math.max(0,Math.min(Math.max(s1.a.x,s1.b.x),Math.max(s2.a.x,s2.b.x))-Math.max(Math.min(s1.a.x,s1.b.x),Math.min(s2.a.x,s2.b.x)));}if(Math.abs(s1.a.x-s2.a.x)>1e-9)return 0;return Math.max(0,Math.min(Math.max(s1.a.y,s1.b.y),Math.max(s2.a.y,s2.b.y))-Math.max(Math.min(s1.a.y,s1.b.y),Math.min(s2.a.y,s2.b.y)));}
// reference solutions must be drawable under the editor's hard wiring rules
function checkGeometry(circuit){
  const boxes=circuit.elements.map(el=>{const t=F.TYPES[el.type],sz=F.rotatedSize(t,el.rot||0);return{x1:el.x,y1:el.y,x2:el.x+sz.w,y2:el.y+sz.h};});
  const ws=circuit.wires.map(w=>_gsegs(F.engine.wirePath(circuit,w)));
  let thr=0,ov=0,self=0;
  for(let wi=0;wi<circuit.wires.length;wi++)for(const r of boxes){let f=false;for(const sg of ws[wi])if(_gRect(sg,r)>0.05)f=true;if(f){thr++;break;}}
  for(let i=0;i<ws.length;i++)for(let j=i+1;j<ws.length;j++){let f=false;for(const a of ws[i])for(const b of ws[j])if(_gOv(a,b)>0.15)f=true;if(f)ov++;}
  for(const ss of ws){for(let i=0;i<ss.length;i++)for(let j=i+2;j<ss.length;j++)if(_gOv(ss[i],ss[j])>0.15){self++;break;}}
  check('no wire passes through an element',thr===0,`(${thr})`);
  check('no overlapping wires',ov===0,`(${ov})`);
  check('no wire self-overlap',self===0,`(${self})`);
}

function testLevel(level, solution) {
  console.log(`Level ${level.id} — ${level.title}:`);
  const circuit = buildCircuit(level, solution);
  const res = F.engine.certify(circuit, level.cases, [0, 1, 2, 3, 4, 5, 6], { optional: level.optionalDetectors || [] });
  check('certify passes (all cases × 7 seeds)', res.pass,
    res.perCase.filter(c => !c.pass).map(c => `\n      case "${c.name}": ${c.reasons.join('; ')}`).join(''));
  const placed = (solution.place || []).length;
  check(`element count ${placed} ≤ par ${level.parElements}`, placed <= level.parElements);
  check(`heat ${res.heatMax} ≤ par ${level.parHeat}`, res.heatMax <= level.parHeat, `(heat ${res.heatMax})`);
  checkGeometry(circuit);
  return res;
}

// ───────────────────────────── reference solutions ────────────────────────────
const SOLUTIONS = require('./solutions.json');

// apply moveFixed (for levels where the solution repositions an unlocked fixed element)
function applyMoves(level, solution) {
  if (!solution.moveFixed) return level;
  const lv = { ...level, fixed: level.fixed.map(e => solution.moveFixed[e.id] ? { ...e, ...solution.moveFixed[e.id] } : e) };
  return lv;
}

console.log('\nLevel reference solutions:');
for (const level of F.LEVELS) {
  const sol = SOLUTIONS[level.id];
  if (!sol) { console.log(`Level ${level.id}: NO SOLUTION DEFINED`); nFail++; continue; }
  testLevel(applyMoves(level, sol), sol);
}

// ───────────────────────────── fault-rule tests ───────────────────────────────
console.log('\nFault rules:');
{
  // head-on collision: w1l3 as shipped (long reflector spur) must fault with 'collision' or 'async'
  const level = F.LEVELS.find(l => l.id === 'w1l3');
  const circuit = buildCircuit(level, { wires: [] });
  const r = F.engine.runCase(circuit, level.cases[0], 0);
  check('w1l3 as shipped faults (collision/async)', !r.pass && r.trace.fault &&
    (r.trace.fault.kind === 'collision' || r.trace.fault.kind === 'async'), r.trace.fault && r.trace.fault.kind);
}
{
  // open port fault
  const circuit = {
    elements: [
      { id: 'L', type: 'LAUNCHER', x: 1, y: 2, rot: 0, state: null },
      { id: 'R', type: 'ROTARY', x: 5, y: 2, rot: 0, state: null, cfg: { ccw: false } },
    ],
    wires: [{ id: 'w1', a: { el: 'L', port: 'A' }, b: { el: 'R', port: 'A' }, via: [] }],
  };
  const t = F.engine.simulate(circuit, [{ t: 0.5, launcher: 'L', pol: 1 }]);
  check('open-port fault fires', t.fault && t.fault.kind === 'open');
}
{
  // runaway loop: two reflectors? Reflector->Reflector wire = pulse bounces forever
  const circuit = {
    elements: [
      { id: 'L', type: 'LAUNCHER', x: 1, y: 2, rot: 0, state: null },
      { id: 'R1', type: 'ROTARY', x: 5, y: 2, rot: 0, state: null, cfg: { ccw: false } },
      { id: 'F1', type: 'REFLECTOR', x: 5, y: 0, rot: 3, state: null },
      { id: 'F2', type: 'REFLECTOR', x: 9, y: 2, rot: 0, state: null },
    ],
    wires: [
      { id: 'w1', a: { el: 'L', port: 'A' }, b: { el: 'R1', port: 'A' }, via: [] },
      { id: 'w2', a: { el: 'R1', port: 'B' }, b: { el: 'F1', port: 'A' }, via: [] },
      { id: 'w3', a: { el: 'R1', port: 'C' }, b: { el: 'F2', port: 'A' }, via: [] },
    ],
  };
  // pulse: L->R1(A->B)->F1 bounce ->R1(B->C)->F2 bounce ->R1(C->A) -> back to L = backflow (absorbed, heat)
  const t = F.engine.simulate(circuit, [{ t: 0.5, launcher: 'L', pol: 1 }]);
  check('backflow into launcher absorbs with heat', t.backflows === 1 && t.heat >= 5);
}
{
  // asynchrony fault: two pulses through one open TCB, launched only 0.1 s apart
  // (same wire, same direction — no head-on — but overlapping arrivals at the device)
  const circuit = {
    elements: [
      { id: 'L1', type: 'LAUNCHER', x: 1, y: 2, rot: 0, state: null },
      { id: 'D1', type: 'DETECTOR', x: 10, y: 2, rot: 0, state: null },
      { id: 'TC', type: 'TCB', x: 5, y: 2, rot: 0, state: 'open' },
    ],
    wires: [
      { id: 'w1', a: { el: 'L1', port: 'A' }, b: { el: 'TC', port: 'A' }, via: [] },
      { id: 'w3', a: { el: 'TC', port: 'B' }, b: { el: 'D1', port: 'A' }, via: [] },
    ],
  };
  const t = F.engine.simulate(circuit, [
    { t: 0.5, launcher: 'L1', pol: 1 }, { t: 0.6, launcher: 'L1', pol: 1 },
  ]);
  check('asynchrony (overlapping arrivals) fault fires', t.fault && t.fault.kind === 'async', t.fault && t.fault.kind);
}

{
  // polarity is tracked per segment (so the renderer shows color changes at twists)
  const circuit = {
    elements: [
      { id: 'L', type: 'LAUNCHER', x: 1, y: 2, rot: 0, state: null },
      { id: 'N', type: 'NOT', x: 5, y: 2, rot: 0, state: null },
      { id: 'D', type: 'DETECTOR', x: 9, y: 2, rot: 0, state: null },
    ],
    wires: [
      { id: 'w1', a: { el: 'L', port: 'A' }, b: { el: 'N', port: 'A' }, via: [] },
      { id: 'w2', a: { el: 'N', port: 'B' }, b: { el: 'D', port: 'A' }, via: [] },
    ],
  };
  const t = F.engine.simulate(circuit, [{ t: 0.5, launcher: 'L', pol: 1 }]);
  const segs = t.pulses[0].segs;
  check('segment polarity flips across a twist', segs.length === 2 && segs[0].pol === 1 && segs[1].pol === -1,
    JSON.stringify(segs.map(s => s.pol)));
  check('twisted pulse detected with flipped polarity', t.detections.D.length === 1 && t.detections.D[0].pol === -1);
}

console.log(`\n${nPass} passed, ${nFail} failed`);
process.exit(nFail ? 1 : 0);

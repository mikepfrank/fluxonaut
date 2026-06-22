/* Headless UI smoke test: stub DOM + canvas, then drive the real ui.js through
 * every level — load, apply reference solution, play every case to completion,
 * certify, and render frames with a recording 2D context to catch draw errors.
 * Run: node test/smoke-ui.mjs
 */
import { createRequire } from 'module';
import path from 'path';
import url from 'url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

let nPass = 0, nFail = 0;
function check(label, ok, extra) {
  if (ok) nPass++;
  else { nFail++; console.log('  ✗', label, extra || ''); }
}

// ── DOM stubs ────────────────────────────────────────────────────────────────
function makeCtx() {
  const calls = [];
  const ctxStub = new Proxy({}, {
    get(t, prop) {
      if (prop === 'canvas') return canvasStub;
      if (prop === 'measureText') return () => ({ width: 50 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop: () => { } });
      }
      if (typeof prop === 'string') {
        return (...a) => { calls.push(prop); };
      }
      return undefined;
    },
    set() { return true; },
  });
  return { ctxStub, calls };
}

const { ctxStub } = makeCtx();

function makeEl(id) {
  const el = {
    id, children: [], style: {}, _listeners: {},
    classList: { add() { }, remove() { }, toggle() { } },
    setAttribute(k, v) { this[k] = v; },
    getAttribute(k) { return this[k]; },
    addEventListener(ev, fn) { (this._listeners[ev] = this._listeners[ev] || []).push(fn); },
    append(...kids) { this.children.push(...kids); },
    appendChild(k) { this.children.push(k); },
    querySelector(sel) { return makeEl(sel); },
    querySelectorAll() { return []; },
    getContext() { return ctxStub; },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.width || 968, height: this.height || 572 }; },
    set innerHTML(v) { this.children = []; },
    get innerHTML() { return ''; },
    set textContent(v) { this._txt = v; },
    get textContent() { return this._txt || ''; },
  };
  return el;
}
const canvasStub = makeEl('board');
canvasStub.width = 968; canvasStub.height = 572;

const elCache = new Map();
const documentStub = {
  querySelector(sel) {
    if (!elCache.has(sel)) elCache.set(sel, sel === '#board' ? canvasStub : makeEl(sel));
    return elCache.get(sel);
  },
  createElement(tag) { return tag === 'canvas' ? Object.assign(makeEl(tag), { width: 64, height: 64 }) : makeEl(tag); },
  addEventListener() { },
};
globalThis.document = documentStub;
globalThis.window = {
  addEventListener() { },
  AudioContext: undefined, webkitAudioContext: undefined,
};
globalThis.localStorage = { getItem: () => null, setItem: () => { } };
try { globalThis.navigator = {}; } catch (e) { /* node ≥21: navigator is a getter; the real one is fine */ }
globalThis.performance = globalThis.performance || { now: () => Date.now() };
let rafCb = null;
globalThis.requestAnimationFrame = cb => { rafCb = cb; return 1; };

// ── load the game ────────────────────────────────────────────────────────────
for (const f of ['elements.js', 'engine.js', 'levels.js', 'render.js', 'ui.js']) {
  require(path.join(__dirname, '..', 'js', f));
}
const F = globalThis.FLUXON;
const U = F._ui;

U.boot();
check('boot completes', true);
U.buildLevelSelect();
check('level select builds', true);
U.showNotebook();
check('notebook builds', true);

// reference solutions (same shapes as run-tests.mjs, duplicated lean here)
const SOLUTIONS = require('./solutions.json');

let frameT = 0;
function tickFrames(n) {
  for (let i = 0; i < n; i++) { frameT += 33; if (rafCb) { const cb = rafCb; cb(frameT); } }
}

for (const lv of F.LEVELS.concat([F.SANDBOX])) {
  const label = `level ${lv.id}`;
  try {
    U.loadLevel(lv);
    check(`${label}: loads`, U.app.level === lv);
    tickFrames(4); // render empty board

    const sol = SOLUTIONS[lv.id];
    if (sol) {
      // apply solution directly to app state (same path the editor produces)
      if (sol.moveFixed) for (const [id, mv] of Object.entries(sol.moveFixed)) {
        Object.assign(U.app.elements.find(e => e.id === id), mv);
      }
      if (sol.dropPrewires) {
        const drop = new Set(sol.dropPrewires.map(i => 'pw' + i));
        U.app.wires = U.app.wires.filter(w => !drop.has(w.id));
      }
      for (const e of (sol.place || [])) {
        const t = F.TYPES[e.type];
        U.app.elements.push({
          id: e.id, type: e.type, x: e.x, y: e.y, rot: e.rot || 0, mir: !!e.mir,
          state: 'state' in e ? e.state : (t.states ? t.defaultState : null),
          cfg: e.cfg ? { ...e.cfg } : (t.config ? { ...t.config } : undefined),
          placed: true,
        });
      }
      for (const w of (sol.wires || [])) {
        U.app.wires.push({
          id: 'tw' + Math.random().toString(36).slice(2, 7),
          a: { el: w[0][0], port: w[0][1] }, b: { el: w[1][0], port: w[1][1] }, via: w[2] || [],
        });
      }

      // play every case to the end through the real playback path
      for (let ci = 0; ci < lv.cases.length; ci++) {
        U.app.caseIdx = ci;
        U.runCurrentCase();
        let guard = 0;
        while (U.app.playing && guard++ < 20000) U.advancePlayback(0.05);
        tickFrames(3);
        const banner = U.app.banner;
        check(`${label} case "${lv.cases[ci].name}": playback ends ok`,
          banner && banner.kind === 'ok', banner && banner.kind + ': ' + banner.text);
      }
      // certify through the UI path
      U.certify();
      check(`${label}: certify passes`, U.app.certifyResult && U.app.certifyResult.pass,
        U.app.certifyResult && JSON.stringify(U.app.certifyResult.perCase.filter(c => !c.pass).map(c => c.reasons)));
    } else if (lv.sandbox) {
      // sandbox: place a couple of things and run
      U.app.elements.push(
        { id: 'sl', type: 'LAUNCHER', x: 1, y: 3, rot: 0, state: null, placed: true, pattern: [1, -1] },
        { id: 'sp', type: 'PR3', x: 6, y: 3, rot: 0, state: null, placed: true },
        { id: 'sd1', type: 'DETECTOR', x: 12, y: 1, rot: 0, state: null, placed: true },
        { id: 'sd2', type: 'DETECTOR', x: 12, y: 5, rot: 0, state: null, placed: true });
      U.app.wires.push(
        { id: 'sw1', a: { el: 'sl', port: 'A' }, b: { el: 'sp', port: 'A' }, via: [] },
        { id: 'sw2', a: { el: 'sp', port: 'B' }, b: { el: 'sd1', port: 'A' }, via: [] },
        { id: 'sw3', a: { el: 'sp', port: 'C' }, b: { el: 'sd2', port: 'A' }, via: [] });
      U.runCurrentCase();
      let guard = 0;
      while (U.app.playing && guard++ < 20000) U.advancePlayback(0.05);
      tickFrames(3);
      check('sandbox: free run completes', U.app.banner && U.app.banner.kind === 'ok',
        U.app.banner && U.app.banner.text);
    }
  } catch (err) {
    check(`${label}: no exception`, false, err.stack.split('\n').slice(0, 3).join(' | '));
  }
}

// editor interaction micro-test: placing + wiring through the real handlers
{
  const lv = F.LEVELS.find(l => l.id === 'w1l2');
  U.loadLevel(lv);
  U.startPlacing('REFLECTOR');
  check('placing mode entered', U.app.mode === 'placing');
  U.tryPlace(10, 2);
  check('element placed via editor', U.app.elements.some(e => e.placed && e.type === 'REFLECTOR'));
  check('palette count decremented', U.app.paletteLeft.REFLECTOR === 0);
  tickFrames(2);}

// wire auto-reroute: a wire forced through an obstacle by a move is rerouted, not broken
{
  const lv = F.LEVELS.find(l => l.size && l.size.w >= 14 && l.size.h >= 6) || F.LEVELS[0];
  U.loadLevel(lv);
  U.app.elements = [
    { id: 'rL', type: 'LAUNCHER', x: 1, y: 3, rot: 0, state: null, placed: true },
    { id: 'rD', type: 'DETECTOR', x: 12, y: 3, rot: 0, state: null, placed: true },
    { id: 'rR', type: 'REFLECTOR', x: 6, y: 3, rot: 0, state: null, placed: true },
  ];
  U.app.wires = [{ id: 'rw', a: { el: 'rL', port: 'A' }, b: { el: 'rD', port: 'A' }, via: [] }];
  U.revalidateWires();
  const w = U.app.wires[0];
  check('wire reroute: a wire forced through an obstacle is auto-rerouted (not left bad)', w.bad === false && w.via.length > 0);
}

// wire reroute: mutual overlap — rerouting one wire frees the other, no stale red (fixpoint)
{
  const lv = F.LEVELS.find(l => l.size && l.size.w >= 20 && l.size.h >= 9) || F.LEVELS[0];
  U.loadLevel(lv);
  U.app.elements = [
    { id: 'aL', type: 'LAUNCHER', x: 1, y: 2, rot: 0, state: null, placed: true },
    { id: 'aD', type: 'DETECTOR', x: 18, y: 2, rot: 0, state: null, placed: true },
    { id: 'bL', type: 'LAUNCHER', x: 1, y: 7, rot: 0, state: null, placed: true },
    { id: 'bD', type: 'DETECTOR', x: 18, y: 7, rot: 0, state: null, placed: true },
  ];
  // both wires jammed onto the same y=7.5 lane → they overlap
  U.app.wires = [
    { id: 'aw', a: { el: 'aL', port: 'A' }, b: { el: 'aD', port: 'A' }, via: [{ x: 3, y: 7.5 }, { x: 17, y: 7.5 }] },
    { id: 'bw', a: { el: 'bL', port: 'A' }, b: { el: 'bD', port: 'A' }, via: [] },
  ];
  U.revalidateWires();
  check('wire reroute: mutual overlap resolved — neither wire left bad', U.app.wires.every(w => w.bad === false));
}

// drop-on-wire: a NEW part placed onto an existing wire flags it red, but does NOT reroute it
{
  const lv = F.LEVELS.find(l => l.size && l.size.w >= 14 && l.size.h >= 6) || F.LEVELS[0];
  U.loadLevel(lv);
  U.app.elements = [
    { id: 'gL', type: 'LAUNCHER', x: 1, y: 3, rot: 0, state: null, placed: true },
    { id: 'gD', type: 'DETECTOR', x: 12, y: 3, rot: 0, state: null, placed: true },
  ];
  U.app.wires = [{ id: 'gw', a: { el: 'gL', port: 'A' }, b: { el: 'gD', port: 'A' }, via: [] }];
  const viaBefore = JSON.stringify(U.app.wires[0].via);
  U.app.paletteLeft = { REFLECTOR: 1 };
  U.startPlacing('REFLECTOR');
  U.tryPlace(6, 3);   // drop it right on the straight wire between L and D
  const w = U.app.wires[0];
  check('drop-on-wire: the part was actually placed (not rejected)', U.app.elements.some(e => e.type === 'REFLECTOR' && e.placed));
  check('drop-on-wire: a part dropped on a wire flags it sticky-red', w.bad === true);
  check('drop-on-wire: the grazed wire is NOT rerouted (via preserved)', JSON.stringify(w.via) === viaBefore);
}

// wire delay tooltip: propagation delay (ps) + physical length (µm) from the routed path
{
  const lv = F.LEVELS.find(l => l.size && l.size.w >= 10 && l.size.h >= 5) || F.LEVELS[0];
  U.loadLevel(lv);
  U.app.elements = [
    { id: 'L', type: 'LAUNCHER', x: 1, y: 3, rot: 0, state: null, placed: true },
    { id: 'D', type: 'DETECTOR', x: 8, y: 3, rot: 0, state: null, placed: true },
  ];
  U.app.wires = [{ id: 'w', a: { el: 'L', port: 'A' }, b: { el: 'D', port: 'A' }, via: [] }];
  const info = U.wireDelayInfo(U.app.wires[0]);
  const cells = F.engine.pathLength(F.engine.wirePath({ elements: U.app.elements }, U.app.wires[0]));
  check('wire tooltip: delay = pathLength × PS_PER_UNIT / SPEED', Math.abs(info.ps - cells * F.engine.PS_PER_UNIT / F.engine.SPEED) < 1e-9);
  check('wire tooltip: length = delay × fluxon velocity (UM_PER_PS = 10)', F.engine.UM_PER_PS === 10 && Math.abs(info.um - info.ps * 10) < 1e-9);
  check('wire tooltip: a real wire reports a positive delay', info.ps > 0 && info.cells > 0);
  // a detoured (longer) wire reports a larger delay — the whole point of the readout
  U.app.wires = [{ id: 'w', a: { el: 'L', port: 'A' }, b: { el: 'D', port: 'A' }, via: [{ x: 4, y: 1 }] }];
  check('wire tooltip: a longer (detoured) wire has a larger delay', U.wireDelayInfo(U.app.wires[0]).ps > info.ps);
}

// element transition-rule inspector (the 🔍 modal): renders for every device
{
  let ok = true, detail = '';
  for (const id of Object.keys(F.TYPES)) {
    const t = F.TYPES[id];
    if (!t.transition || t.io) continue;
    try { const r = U.ruleSVG(t, t.config); if (!r || typeof r.svg !== 'string' || !r.svg.includes('<svg')) { ok = false; detail = id + ' bad svg'; } }
    catch (e) { ok = false; detail = id + ': ' + e.message; }
  }
  check('rule inspector: ruleSVG renders for every device', ok, detail);
  check('rule inspector: PFG is conditionally reversible (has merges)', U.ruleSVG(F.TYPES.PFG, F.TYPES.PFG.config).hasMerges === true);
  check('rule inspector: a reversible device has no merges', U.ruleSVG(F.TYPES.ROTARY).hasMerges === false);
  check('rule inspector: W1-2 hides polarity (stateless → port only)', U.ruleSVG(F.TYPES.CROSS, null, false).svg.includes('input · (port)'));
  check('rule inspector: W3-4 shows polarity', U.ruleSVG(F.TYPES.CROSS, null, true).svg.includes('input · (pol, port)'));
  check('rule inspector: stateful element keeps the state column', U.ruleSVG(F.TYPES.TCB, null, false).svg.includes('input · (port, state)'));
  { const c = U.ruleSVG(F.TYPES.CIRC); check('rule inspector: partial Circulator (faults + dissipative, no merges)', c.hasFaults && c.hasHeat && !c.hasMerges); }
  { const d = U.ruleSVG(F.TYPES.DUP); check('rule inspector: partial chip DUP flagged (faults, reversible)', d.hasFaults && !d.hasHeat && !d.hasMerges); }
  try { U.openRuleModal(F.TYPES.PFG, F.TYPES.PFG.config); check('rule inspector: modal opens without error', true); }
  catch (e) { check('rule inspector: modal opens without error', false, e.message); }
}

// instant replay of a failed fuzzed seed — debugging aid for timing-sensitive puzzles
{
  const lv = F.LEVELS.find(l => l.id === 'w2l4') || F.LEVELS.find(l => l.cases && l.cases.length > 0);
  U.loadLevel(lv);   // (the engine-level failSeed contract is asserted in run-tests.mjs)

  // playFailingSeed arms the replay and drives the normal playback path
  U.playFailingSeed(0, 3);
  check('replay: playFailingSeed arms app.replay (caseIdx + seed)',
    U.app.replay && U.app.replay.caseIdx === 0 && U.app.replay.seed === 3, JSON.stringify(U.app.replay));
  check('replay: playFailingSeed starts playback (trace set, case selected)', !!U.app.trace && U.app.caseIdx === 0);

  // the flashing strip above the board reflects the armed seed
  U.drawBanner();
  check('replay: banner reflects the armed run number', U.app._replaySig === 'R3|' + U.app.replay.caseName);
  check('replay: banner DOM text names the run', document.querySelector('#replay-banner').textContent.includes('#3'));

  // ANY edit drops the replay — stopPlayback is the common funnel (drag/wire/delete/case-switch/re-certify)
  U.stopPlayback(); U.drawBanner();
  check('replay: an edit clears the replay flag', U.app.replay === null);
  check('replay: banner hidden once cleared', U.app._replaySig === '');

  // in-place edits (rotate/flip/config) route through revalidateWires, not stopPlayback — clear too
  U.playFailingSeed(0, 5);
  U.revalidateWires();
  check('replay: in-place edit (revalidateWires) also clears the replay', U.app.replay === null);

  // re-watch: after the run ends, pressing play restarts the SAME seed, not the nominal timing
  U.playFailingSeed(0, 7);
  let guard = 0; while (U.app.playing && guard++ < 20000) U.advancePlayback(0.05);
  U.togglePlay();
  check('replay: re-watch keeps the same seed (#7), not nominal', U.app.replay && U.app.replay.seed === 7, JSON.stringify(U.app.replay));

  // Reset keeps the replay armed so the same run can be watched more than once
  U.playFailingSeed(0, 11);
  U.resetBoard();
  check('replay: Reset preserves the armed replay (does not clear it)', U.app.replay && U.app.replay.seed === 11, JSON.stringify(U.app.replay));
  check('replay: Reset stops the run (trace cleared)', !U.app.trace);
  U.drawBanner();
  check('replay: banner still shown after Reset', U.app._replaySig === 'R11|' + U.app.replay.caseName);
  U.togglePlay();   // pressing Run after a Reset re-watches the same seed, not nominal
  check('replay: Run after Reset re-watches the same seed (#11)', U.app.replay && U.app.replay.seed === 11 && !!U.app.trace, JSON.stringify(U.app.replay));

  // a genuine edit after a Reset still drops the replay
  U.stopPlayback();
  check('replay: an edit after Reset still clears the replay', U.app.replay === null);
}

// reverse playback: seek-by-time, rewind to the last merge (or the start), and the teaching modal
{
  const lv = F.LEVELS.find(l => l.cases && l.cases.length) || F.LEVELS[0];
  U.loadLevel(lv);
  U.app.elements = [
    { id: 'X', type: 'REFLECTOR', x: 1, y: 1, rot: 0, state: 0, placed: true },
    { id: 'DET', type: 'DETECTOR', x: 5, y: 1, rot: 0, state: null, placed: true },
  ];
  U.app.flipEvents = [];
  U.app.trace = {
    tEnd: 4, heat: 0, heatEvents: [], arrivals: [], backflows: 0, pulses: [], finalStates: {},
    stateChanges: [{ t: 1, el: 'X', from: 0, to: 1 }],
    detections: { DET: [{ t: 2, pol: 1 }] },
    barriers: [{ t: 3, el: 'X', elType: 'PS', elName: 'Polarity Separator (biased)', kind: 'merge',
      out: { port: 'P', pol: 1, state: null },
      priors: [{ port: 'S', pol: 1, state: null }, { port: 'M', pol: 1, state: null }] }],
  };
  // seekTo is a pure function of time
  U.seekTo(3.5);
  check('reverse: seekTo applies state changes up to T', U.app.liveStates.get('X') === 1 && U.app.liveDetections.DET.length === 1);
  U.seekTo(0.5);
  check('reverse: seekTo before the change restores the initial state', U.app.liveStates.get('X') === 0 && U.app.liveDetections.DET.length === 0);
  // the floor is the last barrier AT OR BEFORE the current position
  U.app.playT = 4;
  check('reverse: reverseFloor = the last barrier at/before playT', U.reverseFloor() === 3);
  U.app.playT = 2;   // the merge at t=3 is still in the future from here → must not count
  check('reverse: a not-yet-reached barrier does not set the floor', U.reverseFloor() === 0);

  // rewinding halts exactly at the merge floor and opens the teaching modal
  U.app.playT = 4; U.app.playing = true; U.app.playDir = -1; U.app.speed = 1;
  let guard = 0; while (U.app.playing && guard++ < 1000) U.advancePlayback(0.1);
  check('reverse: playback halts at the merge floor', Math.abs(U.app.playT - 3) < 1e-6 && !U.app.playing);
  check('reverse: barrier modal is populated (lists prior states)', document.querySelector('#modal-box').children.length > 0);

  // a dissipative sink (exhaust) is also a hard reverse barrier, with its own explanation
  U.app.trace.barriers = [{ t: 2, el: 'X', elType: 'EXHAUST', elName: 'Exhaust', kind: 'absorb', absorbed: { port: 'A', pol: 1 } }];
  U.app.playT = 4;
  check('reverse: an exhaust dissipation sets the reverse floor', U.reverseFloor() === 2);
  U.app.playing = true; U.app.playDir = -1;
  guard = 0; while (U.app.playing && guard++ < 1000) U.advancePlayback(0.1);
  check('reverse: rewind halts at the exhaust', Math.abs(U.app.playT - 2) < 1e-6 && !U.app.playing);

  // regression — reflect-into-launcher: pausing BEFORE an irreversible event and reversing must
  // rewind freely to the start, not pop the barrier for an event that hasn't happened yet
  U.app.trace.barriers = [{ t: 9, el: 'L', elType: 'LAUNCHER', elName: 'Launcher', kind: 'absorb', absorbed: { port: 'A', pol: 1 } }];
  U.app.playT = 5; U.app.playing = true; U.app.playDir = -1;   // paused at 5; the backflow is not until t=9
  guard = 0; while (U.app.playing && guard++ < 1000) U.advancePlayback(0.1);
  check('reverse: a future barrier does not block rewind (reflect-into-launcher bug)', Math.abs(U.app.playT) < 1e-6 && !U.app.playing);
  U.app.playT = 10;   // once the backflow IS behind you, it sets the floor again
  check('reverse: a barrier already behind playT sets the floor', U.reverseFloor() === 9);

  // with no barriers the run rewinds all the way to the initial state
  U.app.trace.barriers = [];
  U.app.playT = 4; U.app.playing = true; U.app.playDir = -1;
  guard = 0; while (U.app.playing && guard++ < 1000) U.advancePlayback(0.1);
  check('reverse: a fully reversible run rewinds to t=0', Math.abs(U.app.playT) < 1e-6 && !U.app.playing);

  // ◀ / ▶ flip the play direction
  U.app.playT = 2; U.app.playing = true; U.app.playDir = 1;
  U.toggleReverse();
  check('reverse: ◀ switches a forward run to reverse', U.app.playDir === -1 && U.app.playing);
  U.togglePlay();
  check('reverse: ▶ switches a reverse run back to forward', U.app.playDir === 1 && U.app.playing);
}

console.log(`\n${nPass} passed, ${nFail} failed`);
process.exit(nFail ? 1 : 0);


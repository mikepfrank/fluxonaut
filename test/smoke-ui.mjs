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

console.log(`\n${nPass} passed, ${nFail} failed`);
process.exit(nFail ? 1 : 0);


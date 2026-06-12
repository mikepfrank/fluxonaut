/* Render real gameplay frames to PNG using @napi-rs/canvas (no browser needed).
 * Usage: node test/screenshot.mjs <outdir>
 * Renders selected levels mid-playback for visual inspection.
 */
import { createRequire } from 'module';
import path from 'path';
import url from 'url';
import fs from 'fs';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { createCanvas } = require(process.env.NAPI_CANVAS || '@napi-rs/canvas');

const OUT = process.argv[2] || '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

// ── DOM stubs (board canvas is REAL) ─────────────────────────────────────────
const board = createCanvas(968, 572);
board.id = 'board';
board.style = {};
board.classList = { add() { }, remove() { }, toggle() { } };
board.addEventListener = () => { };
board.getBoundingClientRect = () => ({ left: 0, top: 0, width: board.width, height: board.height });

function makeEl(id) {
  return {
    id, children: [], style: {}, _txt: '',
    classList: { add() { }, remove() { }, toggle() { } },
    setAttribute() { }, addEventListener() { },
    append(...k) { this.children.push(...k); }, appendChild(k) { this.children.push(k); },
    querySelector(sel) { return makeEl(sel); }, querySelectorAll() { return []; },
    getContext() { return createCanvas(64, 64).getContext('2d'); },
    set innerHTML(v) { this.children = []; }, get innerHTML() { return ''; },
    set textContent(v) { this._txt = v; }, get textContent() { return this._txt; },
  };
}
const elCache = new Map();
globalThis.document = {
  querySelector(sel) {
    if (sel === '#board') return board;
    if (!elCache.has(sel)) elCache.set(sel, makeEl(sel));
    return elCache.get(sel);
  },
  createElement(tag) {
    if (tag === 'canvas') { const c = createCanvas(64, 64); c.style = {}; c.setAttribute = () => { }; c.addEventListener = () => { }; c.classList = { add() { }, toggle() { }, remove() { } }; return c; }
    return makeEl(tag);
  },
  addEventListener() { },
};
globalThis.window = { addEventListener() { } };
globalThis.localStorage = { getItem: () => null, setItem: () => { } };
let rafCb = null;
globalThis.requestAnimationFrame = cb => { rafCb = cb; return 1; };

for (const f of ['elements.js', 'engine.js', 'levels.js', 'render.js', 'ui.js']) {
  require(path.join(__dirname, '..', 'js', f));
}
const F = globalThis.FLUXON;
const U = F._ui;
const SOLUTIONS = require('./solutions.json');

U.boot();

function applySolution(lv) {
  const sol = SOLUTIONS[lv.id];
  if (!sol) return;
  if (sol.moveFixed) for (const [id, mv] of Object.entries(sol.moveFixed)) Object.assign(U.app.elements.find(e => e.id === id), mv);
  if (sol.dropPrewires) {
    const drop = new Set(sol.dropPrewires.map(i => 'pw' + i));
    U.app.wires = U.app.wires.filter(w => !drop.has(w.id));
  }
  for (const e of (sol.place || [])) {
    const t = F.TYPES[e.type];
    U.app.elements.push({
      id: e.id, type: e.type, x: e.x, y: e.y, rot: e.rot || 0,
      state: 'state' in e ? e.state : (t.states ? t.defaultState : null),
      cfg: e.cfg ? { ...e.cfg } : (t.config ? { ...t.config } : undefined), placed: true,
    });
  }
  for (const w of (sol.wires || [])) {
    U.app.wires.push({ id: 'tw' + Math.random().toString(36).slice(2, 7), a: { el: w[0][0], port: w[0][1] }, b: { el: w[1][0], port: w[1][1] }, via: w[2] || [] });
  }
}

let frameT = 0;
function renderFrame() { frameT += 16; const cb = rafCb; cb(frameT); }

function shoot(levelId, caseIdx, tFrac, name) {
  const lv = levelId === 'sandbox' ? F.SANDBOX : F.LEVELS.find(l => l.id === levelId);
  U.loadLevel(lv);
  applySolution(lv);
  if (lv.cases && lv.cases.length) {
    U.app.caseIdx = Math.min(caseIdx, lv.cases.length - 1);
    U.runCurrentCase();
    const target = U.app.trace.tEnd * tFrac;
    let guard = 0;
    while (U.app.playT < target && U.app.playing && guard++ < 50000) U.advancePlayback(0.02);
  }
  renderFrame(); renderFrame();
  fs.writeFileSync(path.join(OUT, name + '.png'), board.toBuffer('image/png'));
  console.log('wrote', name + '.png', 'playT=' + U.app.playT.toFixed(2));
}

shoot('w1l2', 0, 0.5, '01-roundabout-midrun');
shoot('w1l5', 2, 0.5, '02-threeways-midrun');
shoot('w2l1', 2, 0.45, '03-gatekeeper');
shoot('w2l4', 0, 0.5, '04-duplicator');
shoot('w3l4', 0, 0.55, '05-sorter-heat');
shoot('w3l6', 1, 0.5, '06-comparator');
shoot('w4l3', 0, 0.35, '07-rfsg-early');
shoot('w4l3', 0, 0.75, '08-rfsg-late');
shoot('w4l4', 0, 0.5, '09-beyond');
console.log('done');

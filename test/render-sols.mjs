/* Render each level's reference solution to a built-circuit PNG in ../sols/,
 * using the real game renderer (render.js) via @napi-rs/canvas.
 * Requires: npm install @napi-rs/canvas   (dev-only; not needed to play).
 *   Usage: node test/render-sols.mjs [outdir]
 */
import { createRequire } from 'module'; import path from 'path'; import url from 'url'; import fs from 'fs';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { createCanvas } = require(process.env.NAPI_CANVAS || '@napi-rs/canvas');
const OUT = process.argv[2] || path.join(__dirname, '..', 'sols'); fs.mkdirSync(OUT, { recursive: true });
const board = createCanvas(968, 572); board.id = 'board'; board.style = {}; board.classList = { add() {}, remove() {}, toggle() {} }; board.addEventListener = () => {};
board.getBoundingClientRect = () => ({ left: 0, top: 0, width: board.width, height: board.height });
function makeEl(id) { return { id, children: [], style: {}, _txt: '', classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, addEventListener() {}, append(...k) { this.children.push(...k); }, appendChild(k) { this.children.push(k); }, querySelector(s) { return makeEl(s); }, querySelectorAll() { return []; }, getContext() { return createCanvas(64, 64).getContext('2d'); }, set innerHTML(v) { this.children = []; }, get innerHTML() { return ''; }, set textContent(v) { this._txt = v; }, get textContent() { return this._txt; } }; }
const cache = new Map();
globalThis.document = { querySelector(s) { if (s === '#board') return board; if (!cache.has(s)) cache.set(s, makeEl(s)); return cache.get(s); }, createElement(t) { if (t === 'canvas') { const c = createCanvas(64, 64); c.style = {}; c.setAttribute = () => {}; c.addEventListener = () => {}; c.classList = { add() {}, toggle() {}, remove() {} }; return c; } return makeEl(t); }, addEventListener() {} };
globalThis.window = { addEventListener() {} }; globalThis.localStorage = { getItem: () => null, setItem: () => {} };
let rafCb = null; globalThis.requestAnimationFrame = cb => { rafCb = cb; return 1; };
for (const f of ['elements.js', 'engine.js', 'levels.js', 'render.js', 'ui.js']) require(path.join(__dirname, '..', 'js', f));
const F = globalThis.FLUXON, U = F._ui; const SOL = require('./solutions.json');
U.boot();
function applySolution(lv) { const s = SOL[lv.id]; if (!s) return;
  if (s.moveFixed) for (const [id, mv] of Object.entries(s.moveFixed)) Object.assign(U.app.elements.find(e => e.id === id), mv);
  if (s.dropPrewires) { const d = new Set(s.dropPrewires.map(i => 'pw' + i)); U.app.wires = U.app.wires.filter(w => !d.has(w.id)); }
  for (const e of (s.place || [])) { const t = F.TYPES[e.type]; U.app.elements.push({ id: e.id, type: e.type, x: e.x, y: e.y, rot: e.rot || 0, mir: !!e.mir, state: 'state' in e ? e.state : (t.states ? t.defaultState : null), cfg: e.cfg ? { ...e.cfg } : (t.config ? { ...t.config } : undefined), placed: true }); }
  for (const w of (s.wires || [])) U.app.wires.push({ id: 'tw' + Math.random().toString(36).slice(2, 7), a: { el: w[0][0], port: w[0][1] }, b: { el: w[1][0], port: w[1][1] }, via: w[2] || [] });
}
let t = 0; const frame = () => { t += 16; rafCb(t); };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
for (const lv of F.LEVELS) {
  U.loadLevel(lv); applySolution(lv);
  U.app.trace = null; U.app.playing = false; U.app.banner = null; // static built circuit, no run
  frame(); frame();
  const name = lv.id + '-' + slug(lv.title) + '.png';
  fs.writeFileSync(path.join(OUT, name), board.toBuffer('image/png'));
  console.log('wrote', name);
}
console.log('done ->', OUT);

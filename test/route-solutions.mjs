/* Re-route reference solutions to satisfy the editor's hard wiring rules
 * (no through-element, no overlap, no fold/self-overlap; crossings allowed).
 * Surgical: only wires that violate a rule are re-routed; clean wires are kept.
 * Element PLACEMENTS are authored by hand — if a wire can't be routed (e.g. a
 * port is buried under another element), this reports it for manual fixing.
 * Re-certifies every level (all cases x 7 seeds) and rewrites solutions.json.
 *   Usage: node test/route-solutions.mjs [--write]   (default: dry-run report)
 */
import { createRequire } from 'module'; import path from 'path'; import url from 'url';
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url); const fs = require('fs');
global.FLUXON = {};
for (const f of ['elements.js', 'engine.js', 'levels.js']) require(path.join(__dirname, '..', 'js', f));
const F = globalThis.FLUXON, E = F.engine;
const SOLPATH = path.join(__dirname, 'solutions.json');
const SOL = require(SOLPATH);
const WRITE = process.argv.includes('--write');
const HU = 2;
const key = (a, b) => a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1]) ? `${a[0]},${a[1]}|${b[0]},${b[1]}` : `${b[0]},${b[1]}|${a[0]},${a[1]}`;
function segRect(ax, ay, bx, by, r) { const h = Math.abs(ay - by) < 1e-9; if (h) { if (ay < r.y1 - 1e-9 || ay > r.y2 + 1e-9) return 0; return Math.max(0, Math.min(Math.max(ax, bx), r.x2) - Math.max(Math.min(ax, bx), r.x1)); } if (ax < r.x1 - 1e-9 || ax > r.x2 + 1e-9) return 0; return Math.max(0, Math.min(Math.max(ay, by), r.y2) - Math.max(Math.min(ay, by), r.y1)); }
function segOv(s1, s2) { if (s1.horiz !== s2.horiz) return 0; if (s1.horiz) { if (Math.abs(s1.a.y - s2.a.y) > 1e-9) return 0; return Math.max(0, Math.min(Math.max(s1.a.x, s1.b.x), Math.max(s2.a.x, s2.b.x)) - Math.max(Math.min(s1.a.x, s1.b.x), Math.min(s2.a.x, s2.b.x))); } if (Math.abs(s1.a.x - s2.a.x) > 1e-9) return 0; return Math.max(0, Math.min(Math.max(s1.a.y, s1.b.y), Math.max(s2.a.y, s2.b.y)) - Math.max(Math.min(s1.a.y, s1.b.y), Math.min(s2.a.y, s2.b.y))); }
function crossP(a, b) { if (a.horiz === b.horiz) return false; const H = a.horiz ? a : b, V = a.horiz ? b : a; return V.a.x > Math.min(H.a.x, H.b.x) + 1e-9 && V.a.x < Math.max(H.a.x, H.b.x) - 1e-9 && H.a.y > Math.min(V.a.y, V.b.y) + 1e-9 && H.a.y < Math.max(V.a.y, V.b.y) - 1e-9; }
function segsOf(pts) { const o = []; for (let i = 1; i < pts.length; i++) { const a = pts[i - 1], b = pts[i]; if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) continue; o.push({ a, b, horiz: Math.abs(a.y - b.y) < 1e-9 }); } return o; }
function applyMoves(level, s) { if (!s.moveFixed) return level; return { ...level, fixed: level.fixed.map(e => s.moveFixed[e.id] ? { ...e, ...s.moveFixed[e.id] } : e) }; }
function baseElements(level, s) { const els = level.fixed.map(e => ({ ...e, cfg: e.cfg ? { ...e.cfg } : undefined })); for (const e of (s.place || [])) { const t = F.TYPES[e.type]; els.push({ id: e.id, type: e.type, x: e.x, y: e.y, rot: e.rot || 0, mir: !!e.mir, state: 'state' in e ? e.state : (t.states ? t.defaultState : null), cfg: e.cfg ? { ...e.cfg } : (t.config ? { ...t.config } : undefined) }); } return els; }
function boxesOf(els) { return els.map(el => { const t = F.TYPES[el.type], sz = F.rotatedSize(t, el.rot || 0); return { x1: el.x, y1: el.y, x2: el.x + sz.w, y2: el.y + sz.h }; }); }
const portW = (els, id, port) => { const el = els.find(e => e.id === id); return E.portWorld(el, F.TYPES[el.type], port); };
function addSeg(set, p1, p2) { let x = Math.round(p1.x * HU), y = Math.round(p1.y * HU); const X = Math.round(p2.x * HU), Y = Math.round(p2.y * HU); while (x !== X || y !== Y) { const nx = x + (x !== X ? Math.sign(X - x) : 0), ny = y + (y !== Y ? Math.sign(Y - y) : 0); set.add(key([x, y], [nx, ny])); x = nx; y = ny; } }
function route(sA, sB, W, H, boxList, occE, occN) {
  const blocked = (a, b) => { for (const r of boxList) if (segRect(a[0] / HU, a[1] / HU, b[0] / HU, b[1] / HU, r) > 1e-9) return true; return false; };
  const mX = W * HU, mY = H * HU, dist = new Map(), prev = new Map(); dist.set(sA.join(',') + ':none', 0); const pq = [[0, sA, 'none']];
  const dirs = [[1, 0, 'h'], [-1, 0, 'h'], [0, 1, 'v'], [0, -1, 'v']]; let best = null;
  while (pq.length) { let bi = 0; for (let i = 1; i < pq.length; i++) if (pq[i][0] < pq[bi][0]) bi = i; const [d, n, dir] = pq.splice(bi, 1)[0]; const id = n.join(',') + ':' + dir; if (d > (dist.get(id) ?? Infinity)) continue; if (n[0] === sB[0] && n[1] === sB[1]) { best = id; break; }
    for (const [dx, dy, ax] of dirs) { const nb = [n[0] + dx, n[1] + dy]; if (nb[0] < 0 || nb[1] < 0 || nb[0] > mX || nb[1] > mY) continue; if (occE.has(key(n, nb))) continue; if (blocked(n, nb)) continue; const nd = d + 1 + ((dir !== 'none' && dir !== ax) ? 0.4 : 0) + (occN.has(nb.join(',')) ? 1.5 : 0); const nid = nb.join(',') + ':' + ax; if (nd < (dist.get(nid) ?? Infinity)) { dist.set(nid, nd); prev.set(nid, id); pq.push([nd, nb, ax]); } } }
  if (!best) return null; const ns = []; let c = best; while (c) { const [p] = c.split(':'); ns.push(p.split(',').map(Number)); c = prev.get(c); } ns.reverse(); return ns;
}
const corners = ns => { const o = []; for (let i = 1; i < ns.length - 1; i++) { const a = ns[i - 1], b = ns[i], c = ns[i + 1]; if (((b[0] - a[0]) === 0 ? 'v' : 'h') !== ((c[0] - b[0]) === 0 ? 'v' : 'h')) o.push({ x: b[0] / HU, y: b[1] / HU }); } return o; };
// ---- canonical serializer (stable / readable) ----
const numv = n => Number.isInteger(n) ? String(n) : String(n);
const viaStr = v => '[' + v.map(p => `{ "x": ${numv(p.x)}, "y": ${numv(p.y)} }`).join(', ') + ']';
const wireStr = w => { let s = `[["${w[0][0]}","${w[0][1]}"],["${w[1][0]}","${w[1][1]}"]`; if (w[2] && w[2].length) s += ',' + viaStr(w[2]); return s + ']'; };
function objStr(o) { const parts = []; for (const k of ['id', 'type', 'x', 'y', 'rot', 'mir', 'state']) if (k in o) parts.push(`"${k}": ${JSON.stringify(o[k])}`); if (o.cfg != null) parts.push('"cfg": {' + Object.entries(o.cfg).map(([k, v]) => `"${k}": ${JSON.stringify(v)}`).join(', ') + '}'); return '{ ' + parts.join(', ') + ' }'; }
function serialize(out, order) {
  const segp = []; order.forEach((k, i) => { const e = out[k], inner = [];
    if (e.moveFixed) inner.push('    "moveFixed": {' + Object.entries(e.moveFixed).map(([id, m]) => `"${id}": {` + Object.entries(m).map(([kk, vv]) => `"${kk}": ${JSON.stringify(vv)}`).join(', ') + '}').join(', ') + '}');
    if (e.dropPrewires) inner.push('    "dropPrewires": [' + e.dropPrewires.join(', ') + ']');
    if (e.place && e.place.length) inner.push('    "place": [\n' + e.place.map(o => '      ' + objStr(o)).join(',\n') + '\n    ]');
    if (e.wires) inner.push('    "wires": [\n' + e.wires.map(w => '      ' + wireStr(w)).join(',\n') + '\n    ]');
    segp.push(`  "${k}": {\n` + inner.join(',\n') + '\n  }' + (i < order.length - 1 ? ',' : '')); });
  return '{\n' + segp.join('\n') + '\n}\n';
}
const order = Object.keys(SOL), out = {}, report = [];
for (const level of F.LEVELS) {
  const s0 = SOL[level.id]; if (!s0) continue; const lv = applyMoves(level, s0); const els = baseElements(lv, s0); const boxList = boxesOf(els);
  const keptPre = []; (lv.prewires || []).forEach((pw, i) => { if (!(s0.dropPrewires || []).includes(i)) keptPre.push(pw); });
  const swires = (s0.wires || []).map((w, i) => ({ i, a: { el: w[0][0], port: w[0][1] }, b: { el: w[1][0], port: w[1][1] }, via: w[2] || [] }));
  let wid = 0; const allW = [];
  for (const pw of keptPre) allW.push({ id: 'pw' + (wid++), a: { el: pw.a[0], port: pw.a[1] }, b: { el: pw.b[0], port: pw.b[1] }, via: pw.via || [], pre: true });
  for (const w of swires) allW.push({ id: 'w' + w.i, a: w.a, b: w.b, via: w.via, si: w.i });
  const circ0 = { elements: els, wires: allW }; const seg = new Map(); for (const w of allW) seg.set(w.id, segsOf(E.wirePath(circ0, w)));
  const bad = new Set();
  for (const w of allW) { if (w.pre) continue; for (const r of boxList) { let hit = false; for (const sg of seg.get(w.id)) if (segRect(sg.a.x, sg.a.y, sg.b.x, sg.b.y, r) > 0.05) hit = true; if (hit) { bad.add(w.si); break; } } }
  for (let i = 0; i < allW.length; i++) for (let j = i + 1; j < allW.length; j++) { let f = false; for (const a of seg.get(allW[i].id)) for (const b of seg.get(allW[j].id)) if (segOv(a, b) > 0.15) f = true; if (f) { if (allW[i].si !== undefined) bad.add(allW[i].si); else if (allW[j].si !== undefined) bad.add(allW[j].si); } }
  for (const w of allW) { if (w.pre) continue; const ss = seg.get(w.id); for (let i = 0; i < ss.length; i++) for (let j = i + 2; j < ss.length; j++) if (segOv(ss[i], ss[j]) > 0.15) bad.add(w.si); }
  let newWires = (s0.wires || []).map(w => w.slice()), failRoute = false;
  if (bad.size) {
    const occE = new Set(), occN = new Set();
    const occupy = pts => { for (let i = 1; i < pts.length; i++) addSeg(occE, pts[i - 1], pts[i]); for (const p of pts) occN.add([Math.round(p.x * HU), Math.round(p.y * HU)].join(',')); };
    for (const w of allW) if (w.pre || !bad.has(w.si)) occupy(E.wirePath(circ0, w));
    for (const w of swires) { const pa = portW(els, w.a.el, w.a.port), pb = portW(els, w.b.el, w.b.port); addSeg(occE, { x: pa.x, y: pa.y }, { x: pa.x + pa.ox * 0.5, y: pa.y + pa.oy * 0.5 }); addSeg(occE, { x: pb.x, y: pb.y }, { x: pb.x + pb.ox * 0.5, y: pb.y + pb.oy * 0.5 }); }
    for (const w of swires) { if (!bad.has(w.i)) continue; const pa = portW(els, w.a.el, w.a.port), pb = portW(els, w.b.el, w.b.port); const sA = [Math.round((pa.x + pa.ox * 0.5) * HU), Math.round((pa.y + pa.oy * 0.5) * HU)], sB = [Math.round((pb.x + pb.ox * 0.5) * HU), Math.round((pb.y + pb.oy * 0.5) * HU)]; const ns = route(sA, sB, lv.size.w, lv.size.h, boxList, occE, occN); if (!ns) { failRoute = true; continue; } for (let i = 1; i < ns.length; i++) occE.add(key(ns[i - 1], ns[i])); for (const n of ns) occN.add(n.join(',')); newWires[w.i] = [[w.a.el, w.a.port], [w.b.el, w.b.port], corners(ns)]; }
  }
  const routed = {}; for (const k of Object.keys(s0)) if (k !== 'wires') routed[k] = s0[k]; routed.wires = newWires; out[level.id] = routed;
  // verify
  const elements = baseElements(lv, routed); let w2 = 0; const wires = [];
  for (const pw of keptPre) wires.push({ id: 'pw' + (w2++), a: { el: pw.a[0], port: pw.a[1] }, b: { el: pw.b[0], port: pw.b[1] }, via: pw.via || [] });
  for (const w of newWires) wires.push({ id: 'w' + (w2++), a: { el: w[0][0], port: w[0][1] }, b: { el: w[1][0], port: w[1][1] }, via: w[2] || [] });
  const circuit = { elements, wires }; const res = E.certify(circuit, lv.cases, Array.from({ length: E.CERTIFY_SEEDS }, (_, i) => i), { optional: lv.optionalDetectors || [] });
  const ws = wires.map(w => segsOf(E.wirePath(circuit, w))); let thr = 0, ov = 0, self = 0, xc = 0;
  for (let wi = 0; wi < wires.length; wi++) for (const r of boxList) { let f = false; for (const sg of ws[wi]) if (segRect(sg.a.x, sg.a.y, sg.b.x, sg.b.y, r) > 0.05) f = true; if (f) { thr++; break; } }
  for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) { let f = false; for (const a of ws[i]) for (const b of ws[j]) if (segOv(a, b) > 0.15) f = true; if (f) ov++; }
  for (const ss of ws) { for (let i = 0; i < ss.length; i++) for (let j = i + 2; j < ss.length; j++) if (segOv(ss[i], ss[j]) > 0.15) { self++; break; } }
  const all = [].concat(...ws); for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) if (crossP(all[i], all[j])) xc++;
  report.push({ id: level.id, changed: bad.size > 0, pass: res.pass, thr, ov, self, xc, failRoute });
}
console.log('id      chg cert thru ovlp self cross');
let attention = 0;
for (const r of report) { const att = (!r.pass || r.thr || r.ov || r.self || r.failRoute); if (att) attention++; console.log(r.id.padEnd(7), (r.changed ? 'Y' : '.'), ' ', (r.pass ? 'ok ' : 'FAIL'), String(r.thr).padStart(4), String(r.ov).padStart(4), String(r.self).padStart(4), String(r.xc).padStart(5), (r.failRoute ? 'ROUTEFAIL' : '') + (att ? ' <-- ATTENTION (manual fix needed)' : '')); }
const text = serialize(out, order);
if (WRITE) { fs.writeFileSync(SOLPATH, text); console.log('\nwrote', SOLPATH); }
else { fs.writeFileSync('/tmp/_route_out.json', text); console.log('\n(dry run) wrote /tmp/_route_out.json — re-run with --write to update solutions.json'); }
console.log('levels needing manual attention:', attention);

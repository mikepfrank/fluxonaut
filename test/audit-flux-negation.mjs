// audit-flux-negation.mjs -- which two-state elements obey flux-negation symmetry
// as the barc classifier defines it? (Informational; not part of the suites.)
//
// barc (github.com/sandialabs/barcs, src/symmetryTransform.py) defines flux
// negation F as negating every fluxon AND exchanging the element's two states:
//     (+, port p, state s) -> (+, q, s')   requires   (-, p, S(s)) -> (-, q, S(s')).
// For flux-polarized states (stored +1/-1) this is plain flux negation; for
// flux-neutral states it models a +/- pair of fluxes in two internal loops that
// swap places. A "polarity-blind" element instead routes a negative fluxon exactly
// like a positive one in the same state, which F forbids. See TODO.md
// ("Element semantics -- flux-negation symmetry", 2026-10-22).
//
// Usage: node test/audit-flux-negation.mjs
import { createRequire } from 'module';
import path from 'path';
import url from 'url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
require(path.join(__dirname, '..', 'js', 'elements.js'));
require(path.join(__dirname, '..', 'js', 'engine.js'));
require(path.join(__dirname, '..', 'js', 'levels.js'));
const F = globalThis.FLUXON;

const levels = [...(F.LEVELS || []), ...(F.SANDBOX ? [F.SANDBOX] : [])];
const bipolar = (lv) => !!lv.bipolar || (lv.cases || []).some((c) => (c.inputs || []).some((i) => i.pol === -1));
for (const [id, T] of Object.entries(F.TYPES)) {
  if (!T.states || T.states.length !== 2 || typeof T.transition !== 'function') continue;
  const ports = T.ports.map((p) => p.name), [s0, s1] = T.states;
  const other = (s) => (s === s0 ? s1 : s0);
  let barcF = true, blind = true;
  for (const port of ports) for (const s of T.states) {
    const a = T.transition(port, 1, s, T.config || {});
    const b = T.transition(port, -1, other(s), T.config || {});
    const c = T.transition(port, -1, s, T.config || {});
    if (!(b.port === a.port && b.pol === -a.pol && b.state === other(a.state))) barcF = false;
    if (!(c.port === a.port && c.pol === -a.pol && c.state === a.state)) blind = false;
  }
  const used = levels.filter((lv) => [...(lv.fixed || []).map((e) => e.type), ...Object.keys(lv.palette || {})].includes(id))
    .map((lv) => `${lv.id || 'sandbox'}${bipolar(lv) ? ' (bipolar)' : ''}`);
  console.log(`${id.padEnd(5)} states ${T.states.join('/').padEnd(12)} flux-negation symmetric (barc): ${barcF ? 'yes' : 'NO '}` +
    `  polarity-blind: ${blind ? 'yes' : 'no '}  used in: ${used.join(', ') || '-'}`);
}

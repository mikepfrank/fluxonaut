/* FLUXONAUT — engine.js
 * Event-driven simulation of an abstract BARC network.
 *
 * Circuit data model:
 *   element: { id, type, x, y, rot, mir, state, cfg, locked, stateLocked }
 *   wire:    { id, a:{el,port}, b:{el,port}, via:[{x,y},...] }   (via = waypoints, half-grid units)
 *
 * The simulator runs a full deterministic trace up-front; the UI plays it back.
 * Faithfulness rules (see GAME-DESIGN.md):
 *   - constant pulse speed; bidirectional non-branching wires
 *   - one-in/one-out instantaneous reversible transitions
 *   - head-on collision on a wire => fault
 *   - two arrivals at one element within MIN_GAP => asynchrony fault
 *   - heat bookkeeping for irreversible/biased operations
 * DOM-free.
 */
(function () {
  const F = (globalThis.FLUXON = globalThis.FLUXON || {});

  // Internal time is in abstract sim-units; quote real durations in ps (SFQ scale).
  // Physical scale: 1 cell ≈ 50 µm of LJJ; fluxons at ~c/30 ≈ 10 µm/ps ⇒ ~5 ps/cell
  // ⇒ one sim-unit ≈ 16 ps (PS_PER_UNIT); the game slows real time by ~6×10¹⁰.
  const SPEED = 3.2;        // cells per sim-unit (1 cell ≈ 5 ps)
  const MIN_GAP = 0.22;     // min arrival separation at one element ≈ 3.5 ps
  const PS_PER_UNIT = SPEED * 5;   // ps per sim-unit (= 16)
  const MAX_EVENTS = 30000;
  const MAX_TIME = 600;
  // Certify samples this many seeded jitter draws per case (seed 0 = nominal, the rest
  // scaled ×[0.7,1.5)). The in-game Certify and the test harness share this one count,
  // so a solution that passes in the game passes in the tests and vice-versa. Reference
  // solutions are verified robust (0 fails) well beyond this bar (random + every jitter
  // corner + a factor grid); 100 is the agreed in-product gate.
  const CERTIFY_SEEDS = 100;

  // --- geometry --------------------------------------------------------------
  function portWorld(el, type, portName) {
    const port = type.ports.find(q => q.name === portName);
    const rp = F.rotatedPort(type, F.swappedPort(el, type, port), el.rot || 0, el.mir);
    return { x: el.x + rp.x, y: el.y + rp.y, ox: rp.ox, oy: rp.oy };
  }

  // Build the polyline for a wire: port A pos -> via points (orthogonalized) -> port B pos.
  // Between consecutive points that are not axis-aligned we insert an elbow (H then V).
  function wirePath(circuit, wire) {
    const elA = circuit.elements.find(e => e.id === wire.a.el);
    const elB = circuit.elements.find(e => e.id === wire.b.el);
    const tA = F.TYPES[elA.type], tB = F.TYPES[elB.type];
    const pa = portWorld(elA, tA, wire.a.port);
    const pb = portWorld(elB, tB, wire.b.port);
    const pts = [{ x: pa.x, y: pa.y }];
    // small stub out of the port in its outward direction
    const stubA = { x: pa.x + pa.ox * 0.5, y: pa.y + pa.oy * 0.5 };
    const stubB = { x: pb.x + pb.ox * 0.5, y: pb.y + pb.oy * 0.5 };
    pts.push(stubA);
    let cur = stubA;
    const mids = (wire.via || []).concat([stubB]);
    for (const q of mids) {
      if (q.x !== cur.x && q.y !== cur.y) pts.push({ x: q.x, y: cur.y }); // elbow H-first
      pts.push({ x: q.x, y: q.y });
      cur = q;
    }
    pts.push({ x: pb.x, y: pb.y });
    // de-duplicate consecutive identical points
    const out = [pts[0]];
    for (const q of pts.slice(1)) {
      const l = out[out.length - 1];
      if (q.x !== l.x || q.y !== l.y) out.push(q);
    }
    return out;
  }

  // Rounded wire bends: each 90° corner becomes a quarter arc of radius CORNER_R
  // (clamped to half of each adjoining segment). A curvy LJJ is slightly shorter
  // than a square-cornered one, so this also feeds pathLength (timing) below.
  const CORNER_R = 0.25; // grid cells

  function roundedPath(pts, r) {
    const P = [];
    for (const q of pts) { const l = P[P.length - 1]; if (!l || Math.abs(q.x - l.x) > 1e-9 || Math.abs(q.y - l.y) > 1e-9) P.push({ x: q.x, y: q.y }); }
    const segs = [];
    if (P.length < 2) return { segs, len: 0 };
    let cur = P[0];
    for (let i = 1; i < P.length - 1; i++) {
      const v = P[i], nxt = P[i + 1];
      const ix = v.x - cur.x, iy = v.y - cur.y, ox = nxt.x - v.x, oy = nxt.y - v.y;
      const li = Math.hypot(ix, iy), lo = Math.hypot(ox, oy);
      if (li < 1e-9) continue;
      const idx = ix / li, idy = iy / li, odx = ox / lo, ody = oy / lo;
      const perpendicular = lo > 1e-9 && Math.abs(idx * odx + idy * ody) < 1e-6;
      const rr = Math.min(r, li / 2, lo / 2);
      if (!perpendicular || rr < 1e-6) { segs.push({ kind: 'line', a: cur, b: { x: v.x, y: v.y } }); cur = v; continue; }
      const p1 = { x: v.x - idx * rr, y: v.y - idy * rr };
      const p2 = { x: v.x + odx * rr, y: v.y + ody * rr };
      const c = { x: p1.x + odx * rr, y: p1.y + ody * rr };
      const a0 = Math.atan2(p1.y - c.y, p1.x - c.x);
      let delta = Math.atan2(p2.y - c.y, p2.x - c.x) - a0;
      while (delta > Math.PI) delta -= 2 * Math.PI;
      while (delta < -Math.PI) delta += 2 * Math.PI;
      segs.push({ kind: 'line', a: cur, b: p1 });
      segs.push({ kind: 'arc', c, r: rr, a0, delta });
      cur = p2;
    }
    segs.push({ kind: 'line', a: cur, b: P[P.length - 1] });
    let len = 0;
    for (const s of segs) { s.len = s.kind === 'line' ? Math.hypot(s.b.x - s.a.x, s.b.y - s.a.y) : s.r * Math.abs(s.delta); len += s.len; }
    return { segs, len };
  }

  function pathLength(pts) {
    return Math.max(roundedPath(pts, CORNER_R).len, 0.25);
  }

  // Merge consecutive collinear points so a straight run that happens to carry a via or
  // port-stub vertex is ONE segment. Without this, a crossing landing exactly on such a
  // vertex gets split into two T-touches and is missed by the interior-crossing test.
  function collinearMerge(pts) {
    const p = [];
    for (const q of pts) if (!p.length || Math.abs(q.x - p[p.length - 1].x) > 1e-9 || Math.abs(q.y - p[p.length - 1].y) > 1e-9) p.push(q);
    let i = 1;
    while (i < p.length - 1) {
      const a = p[i - 1], b = p[i], c = p[i + 1];
      if ((Math.abs(a.y - b.y) < 1e-9 && Math.abs(b.y - c.y) < 1e-9) || (Math.abs(a.x - b.x) < 1e-9 && Math.abs(b.x - c.x) < 1e-9)) p.splice(i, 1);
      else i++;
    }
    return p;
  }
  function _xsegs(pts) {
    const m = collinearMerge(pts), o = [];
    for (let i = 1; i < m.length; i++) { const a = m[i - 1], b = m[i]; if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) continue; o.push({ a, b, horiz: Math.abs(a.y - b.y) < 1e-9 }); }
    return o;
  }
  // Count wire crossings used for the planarity star: an interior intersection of a
  // horizontal run of one wire and a vertical run of another. Shared bend vertices and
  // T-touches (an endpoint meeting another wire's interior) do NOT count — only genuine
  // interior-interior crossings. Crossovers absorb a crossing (the two wires meet AT the
  // gadget's ports, so neither has a free segment through the other).
  function countCrossings(circuit) {
    const ws = circuit.wires.map(w => _xsegs(wirePath(circuit, w)));
    let n = 0;
    for (let i = 0; i < ws.length; i++) for (let j = i + 1; j < ws.length; j++) for (const a of ws[i]) for (const b of ws[j]) {
      if (a.horiz === b.horiz) continue;
      const H = a.horiz ? a : b, V = a.horiz ? b : a;
      const hx1 = Math.min(H.a.x, H.b.x), hx2 = Math.max(H.a.x, H.b.x), vy1 = Math.min(V.a.y, V.b.y), vy2 = Math.max(V.a.y, V.b.y);
      if (V.a.x > hx1 + 1e-9 && V.a.x < hx2 - 1e-9 && H.a.y > vy1 + 1e-9 && H.a.y < vy2 - 1e-9) n++;
    }
    return n;
  }

  function pointAlong(pts, d) {
    const rp = roundedPath(pts, CORNER_R);
    if (rp.len < 1e-9) return pts[pts.length - 1];
    let rem = Math.max(0, d);
    for (let i = 0; i < rp.segs.length; i++) {
      const s = rp.segs[i];
      if (rem <= s.len || i === rp.segs.length - 1) {
        const f = s.len <= 1e-9 ? 0 : Math.min(1, Math.max(0, rem / s.len));
        if (s.kind === 'line') return { x: s.a.x + (s.b.x - s.a.x) * f, y: s.a.y + (s.b.y - s.a.y) * f };
        const ang = s.a0 + s.delta * f;
        return { x: s.c.x + s.r * Math.cos(ang), y: s.c.y + s.r * Math.sin(ang) };
      }
      rem -= s.len;
    }
    return pts[pts.length - 1];
  }

  // --- static validation ------------------------------------------------------
  // returns { ok, problems: [{kind, msg, el?, wire?}] }
  function validate(circuit) {
    const problems = [];
    const portUse = new Map(); // "el:port" -> wireId
    for (const w of circuit.wires) {
      for (const end of [w.a, w.b]) {
        const key = end.el + ':' + end.port;
        if (portUse.has(key)) problems.push({ kind: 'doublewire', msg: 'Two wires share one port', wire: w.id });
        portUse.set(key, w.id);
      }
      if (w.a.el === w.b.el && w.a.port === w.b.port) problems.push({ kind: 'loop', msg: 'Wire connects a port to itself', wire: w.id });
    }
    return { ok: problems.length === 0, problems, portUse };
  }

  // --- simulation -------------------------------------------------------------
  // inputs: array of launch events {t, launcher (element id), pol}
  // opts: { record: bool }
  // Returns trace:
  // {
  //   ok, fault: {t,msg,kind,x,y} | null,
  //   tEnd, heat, heatEvents: [{t,x,y,amount,el}],
  //   detections: { detectorId: [{t,pol}] },
  //   backflows: n,
  //   pulses: [{id,pol,segs:[{wire,fromA,t0,t1,len}],fate,fateT}],
  //   stateChanges: [{t,el,from,to}], arrivals: [{t,el,port,pol}],
  //   barriers: points where reverse simulation can't proceed (the reverse playback halts here):
  //     {t,el,elType,elName,kind:'merge',  out:{port,pol,state}, priors:[{port,pol,state}]}  many-to-one (PS/PFG)
  //     {t,el,elType,elName,kind:'absorb', absorbed:{port,pol}}                              dissipated at a sink
  //   finalStates: {elId: state}
  // }
  // A 'merge' barrier is a many-to-one transition: ≥2 distinct inputs (port,pol,state) produce the
  // same output, so reverse simulation can't recover which one happened — the irreversibility of
  // PS/PFG. (CIRC dissipates but is 1-to-1, so it is NOT a merge.) An 'absorb' barrier is a fluxon
  // dissipated at a sink (exhaust/backflow): turned to heat and not remembered, so it can't be
  // re-emitted on rewind. A detector is NOT a barrier — it records its fluxon and spits it back.
  function mergePriors(type, cfg, out) {
    const priors = [];
    for (const st of (type.states || [null]))
      for (const port of (type.ports || []))
        for (const pol of [1, -1]) {
          let r; try { r = type.transition(port.name, pol, st, cfg); } catch (e) { r = null; }
          if (r && !r.absorb && r.port === out.port && r.pol === out.pol && r.state === out.state)
            priors.push({ port: port.name, pol, state: st });
        }
    return priors;
  }
  function simulate(circuit, inputs, opts) {
    opts = opts || {};
    const val = validate(circuit);
    const elById = new Map(circuit.elements.map(e => [e.id, e]));
    const wireById = new Map(circuit.wires.map(w => [w.id, w]));
    const portWire = val.portUse; // "el:port" -> wireId

    // precompute wire geometry
    const geo = new Map();
    for (const w of circuit.wires) {
      const pts = wirePath(circuit, w);
      geo.set(w.id, { pts, len: pathLength(pts) });
    }

    // dynamic state
    const states = new Map(circuit.elements.map(e => [e.id, e.state]));
    const lastArrival = new Map(); // elId -> time
    const onWire = new Map(circuit.wires.map(w => [w.id, []])); // wireId -> live pulse recs

    const trace = {
      ok: true, fault: null, tEnd: 0, heat: 0, heatEvents: [],
      detections: {}, backflows: 0, pulses: [], stateChanges: [], arrivals: [], barriers: [],
      finalStates: {},
    };
    for (const e of circuit.elements) if (F.TYPES[e.type].id === 'DETECTOR') trace.detections[e.id] = [];

    let nextPulseId = 1, nextEvId = 1;
    const queue = []; // {t, seq, kind, ...} kinds: 'launch' | 'arrive' | 'collide'
    function push(ev) { ev.seq = nextEvId++; queue.push(ev); }
    function pop() {
      let bi = -1;
      for (let i = 0; i < queue.length; i++) {
        if (bi < 0 || queue[i].t < queue[bi].t - 1e-12 ||
            (Math.abs(queue[i].t - queue[bi].t) < 1e-12 && queue[i].seq < queue[bi].seq)) bi = i;
      }
      return bi < 0 ? null : queue.splice(bi, 1)[0];
    }

    function fault(t, kind, msg, x, y) {
      trace.ok = false;
      trace.fault = { t, kind, msg, x, y };
      trace.tEnd = t;
    }

    // place a pulse onto a wire from one of its element-ends; schedule arrival & collisions
    function launchOnWire(t, wireId, fromElPort, pol, pulseRec) {
      const w = wireById.get(wireId);
      const g = geo.get(wireId);
      const fromA = (w.a.el + ':' + w.a.port) === fromElPort;
      const t1 = t + g.len / SPEED;
      const live = { pulse: pulseRec, wire: wireId, fromA, t0: t, t1 };
      pulseRec.segs.push({ wire: wireId, fromA, t0: t, t1, len: g.len, pol });
      // head-on collision check against pulses already on this wire
      for (const other of onWire.get(wireId)) {
        if (other.fromA !== fromA) {
          // positions: ours d1(t)=SPEED*(t-t0); theirs d2(t)=len-SPEED*(t-ot0) measured from same end
          // meet when d1 = d2  =>  SPEED*(t - t0) + SPEED*(t - ot0) = len
          const tm = (g.len / SPEED + t + other.t0) / 2;
          if (tm > t - 1e-9 && tm < Math.min(t1, other.t1) + 1e-9) {
            const d = SPEED * (tm - t);
            const pos = pointAlong(fromA ? g.pts : [...g.pts].reverse(), d);
            push({ t: tm, kind: 'collide', x: pos.x, y: pos.y, a: live, b: other });
          }
        }
      }
      onWire.get(wireId).push(live);
      const destEnd = fromA ? w.b : w.a;
      push({ t: t1, kind: 'arrive', wire: wireId, live, el: destEnd.el, port: destEnd.port, pol, pulse: pulseRec });
      return live;
    }

    function emitFrom(t, elId, portName, pol, pulseRec) {
      const key = elId + ':' + portName;
      const wid = portWire.get(key);
      const el = elById.get(elId);
      const type = F.TYPES[el.type];
      if (!wid) {
        const pp = portWorld(el, type, portName);
        fault(t, 'open', `A fluxon flew out of an unwired port (${type.name}). Every used port needs a wire.`, pp.x, pp.y);
        pulseRec.fate = 'lost'; pulseRec.fateT = t;
        return;
      }
      launchOnWire(t, wid, key, pol, pulseRec);
    }

    // schedule input launches
    for (const inp of inputs) {
      push({ t: inp.t, kind: 'launch', el: inp.launcher, pol: inp.pol });
    }

    let events = 0;
    while (true) {
      const ev = pop();
      if (!ev) break;
      if (trace.fault && ev.t > trace.fault.t) break;
      if (++events > MAX_EVENTS || ev.t > MAX_TIME) {
        fault(ev.t, 'runaway', 'The network never settled — fluxons are trapped in an endless loop.', null, null);
        break;
      }

      if (ev.kind === 'launch') {
        const el = elById.get(ev.el);
        const type = F.TYPES[el.type];
        const rec = { id: nextPulseId++, pol: ev.pol, segs: [], fate: null, fateT: null, born: ev.t };
        trace.pulses.push(rec);
        emitFrom(ev.t, ev.el, type.ports[0].name, ev.pol, rec);
        continue;
      }

      if (ev.kind === 'collide') {
        // both live segments must still be current (not already arrived/cancelled)
        if (ev.a.cancelled || ev.b.cancelled) continue;
        if (ev.t > ev.a.t1 + 1e-9 || ev.t > ev.b.t1 + 1e-9) continue;
        ev.a.pulse.fate = 'collided'; ev.a.pulse.fateT = ev.t;
        ev.b.pulse.fate = 'collided'; ev.b.pulse.fateT = ev.t;
        // truncate the trajectory segments at the collision time for playback
        ev.a.pulse.segs[ev.a.pulse.segs.length - 1].t1 = ev.t;
        ev.b.pulse.segs[ev.b.pulse.segs.length - 1].t1 = ev.t;
        fault(ev.t, 'collision',
          'Head-on fluxon collision! Direct pulse interactions amplify timing uncertainty chaotically — exactly what BARC forbids. Re-route so pulses can never meet on a wire.',
          ev.x, ev.y);
        continue;
      }

      if (ev.kind === 'arrive') {
        if (ev.live.cancelled) continue;
        // remove from wire occupancy
        const arr = onWire.get(ev.wire);
        const ix = arr.indexOf(ev.live);
        if (ix >= 0) arr.splice(ix, 1);
        if (trace.fault) continue;

        const el = elById.get(ev.el);
        const type = F.TYPES[el.type];
        const pp = portWorld(el, type, ev.port);

        // asynchrony check
        const last = lastArrival.get(ev.el);
        if (last !== undefined && ev.t - last < MIN_GAP) {
          ev.pulse.fate = 'fault'; ev.pulse.fateT = ev.t;
          fault(ev.t, 'async',
            `Two fluxons reached the same ${type.name} only ${((ev.t - last) * PS_PER_UNIT).toFixed(1)} ps apart. Asynchronous devices need clearly separated, non-overlapping arrivals — give them breathing room (the ORDER matters, the exact timing must not).`,
            pp.x, pp.y);
          continue;
        }
        lastArrival.set(ev.el, ev.t);
        trace.arrivals.push({ t: ev.t, el: ev.el, port: ev.port, pol: ev.pol });

        const st = states.get(ev.el);
        const res = type.transition(ev.port, ev.pol, st, el.cfg || type.config);
        if (!res) {
          fault(ev.t, 'undefined', `${type.name} has no defined behavior for that arrival — this should never happen.`, pp.x, pp.y);
          continue;
        }
        // record a many-to-one merge (irreversible step) so reverse playback knows where to halt
        if (res.port && !res.absorb) {
          const out = { port: res.port, pol: res.pol, state: res.state };
          const priors = mergePriors(type, el.cfg || type.config, out);
          if (priors.length >= 2) trace.barriers.push({ t: ev.t, el: ev.el, elType: type.id, elName: type.name, kind: 'merge', out, priors });
        }
        if (res.heat) {
          trace.heat += res.heat;
          // Spark at the EXIT port: for these biased devices the cost is realized as the
          // fluxon is pumped through (dissipation accompanies transmission, not arrival).
          // Absorbers have no exit port, so they spark where the fluxon dies (input).
          const hp = (res.port && !res.absorb) ? portWorld(el, type, res.port) : pp;
          trace.heatEvents.push({ t: ev.t, x: hp.x, y: hp.y, amount: res.heat, el: ev.el });
        }
        if (res.state !== st) {
          states.set(ev.el, res.state);
          trace.stateChanges.push({ t: ev.t, el: ev.el, from: st, to: res.state });
        }
        if (res.absorb) {
          if (res.detect) {
            // a detector is a remembered output line — it records the arrival and re-emits it on
            // rewind, so it is NOT a reverse barrier.
            trace.detections[ev.el].push({ t: ev.t, pol: ev.pol });
            ev.pulse.fate = 'detected'; ev.pulse.fateT = ev.t; ev.pulse.detector = ev.el;
          } else {
            // a dissipative sink (exhaust / backflow) turns the fluxon to heat and keeps no record
            // of it, so reverse simulation has nothing to re-emit — a hard reverse barrier.
            trace.barriers.push({ t: ev.t, el: ev.el, elType: type.id, elName: type.name, kind: 'absorb', absorbed: { port: ev.port, pol: ev.pol } });
            if (res.backflow) { trace.backflows++; ev.pulse.fate = 'backflow'; }
            else { ev.pulse.fate = 'exhausted'; }
            ev.pulse.fateT = ev.t;
          }
          continue;
        }
        emitFrom(ev.t, ev.el, res.port, res.pol, ev.pulse);
        if (trace.tEnd < ev.t) trace.tEnd = ev.t;
        continue;
      }
    }

    if (!trace.fault) {
      let m = 0;
      for (const p of trace.pulses) for (const s of p.segs) m = Math.max(m, s.t1);
      trace.tEnd = m;
    }
    for (const [id, st] of states) trace.finalStates[id] = st;
    return trace;
  }

  // --- level checking ----------------------------------------------------------
  // case spec: { name, inputs: [{launcher, pol, dt?}], expect: { detectorId: [pol,...] },
  //              finalStates?: {elId: state}, allowHeat?: bool }
  // inputs are given in order; nominal gap GAP ≈ 24 ps, jittered ×[0.7,1.5) by seeded RNG.
  const GAP = 1.5;

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildInputs(caseSpec, seed) {
    const rnd = seed === 0 ? null : mulberry32(seed * 7919 + 17);
    let t = 0.4;
    const out = [];
    for (const inp of caseSpec.inputs) {
      const gap = (inp.dt !== undefined ? inp.dt : GAP);
      const jit = rnd ? (0.7 + 0.8 * rnd()) : 1.0;
      t += gap * jit;
      out.push({ t, launcher: inp.launcher, pol: inp.pol });
    }
    return out;
  }

  // Evaluate one case (one seed). Returns {pass, reasons:[], trace}
  // opts: { optional: [detectorIds whose catches are not checked] }
  function runCase(circuit, caseSpec, seed, opts) {
    opts = opts || {};
    const optional = new Set(opts.optional || []);
    const inputs = buildInputs(caseSpec, seed);
    const trace = simulate(circuit, inputs);
    const reasons = [];
    if (trace.fault) reasons.push(trace.fault.msg);
    // detector expectations
    const expect = caseSpec.expect || {};
    for (const detId of Object.keys(trace.detections)) {
      if (optional.has(detId)) continue;
      const got = trace.detections[detId].map(d => d.pol);
      const want = expect[detId] || [];
      if (got.length !== want.length || got.some((g, i) => g !== want[i])) {
        reasons.push(`detector ${detId}: expected [${want.map(polSym).join(' ')}], got [${got.map(polSym).join(' ')}]`);
      }
    }
    // stray pulses
    if (!trace.fault) {
      for (const p of trace.pulses) {
        if (!p.fate) { reasons.push('a fluxon never reached an output'); break; }
      }
    }
    if (caseSpec.finalStates) {
      for (const [elId, st] of Object.entries(caseSpec.finalStates)) {
        if (trace.finalStates[elId] !== st) {
          reasons.push(`element ${elId} should end in state ${stSym(st)} but ended in ${stSym(trace.finalStates[elId])}`);
        }
      }
    }
    if (trace.backflows > 0) reasons.push('a fluxon flowed back into a launcher (absorbed; heavy heat)');
    return { pass: reasons.length === 0, reasons, trace };
  }

  function polSym(p) { return p === 1 ? '+' : p === -1 ? '−' : String(p); }
  function stSym(s) { return s === 1 ? '+' : s === -1 ? '−' : String(s); }

  // Certify: all cases × seeds. Returns {pass, heatMax, perCase:[{name,pass,reasons,heat,failSeed}]}
  // failSeed = the first seed that failed this case (-1 if it passed). Seed 0 is the nominal,
  // un-jittered timing, so failSeed>0 means "passed nominal but a fuzzed run broke it" — exactly
  // the situation the in-game instant-replay button reproduces for the player.
  function certify(circuit, cases, seeds, opts) {
    seeds = seeds || Array.from({ length: CERTIFY_SEEDS }, (_, i) => i);
    const perCase = [];
    let pass = true, heatMax = 0;
    const used = new Set();   // element ids a fluxon reaches (utilization check)
    for (const cs of cases) {
      let cPass = true, reasons = [], heat = 0, failSeed = -1;
      for (const seed of seeds) {
        const r = runCase(circuit, cs, seed, opts);
        heat = Math.max(heat, r.trace.heat);
        if (seed === seeds[0]) for (const a of r.trace.arrivals) used.add(a.el);
        if (!r.pass) { cPass = false; reasons = r.reasons; failSeed = seed; break; }
      }
      heatMax = Math.max(heatMax, heat);
      if (!cPass) pass = false;
      perCase.push({ name: cs.name, pass: cPass, reasons, heat, failSeed });
    }
    return { pass, heatMax, perCase, usedEls: [...used] };
  }

  F.engine = { SPEED, MIN_GAP, GAP, PS_PER_UNIT, CERTIFY_SEEDS, CORNER_R, portWorld, wirePath, pathLength, pointAlong, roundedPath, countCrossings, validate, simulate, buildInputs, runCase, certify, polSym };
  F.roundedPath = roundedPath; F.CORNER_R = CORNER_R;
})();

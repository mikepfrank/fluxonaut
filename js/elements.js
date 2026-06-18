/* FLUXONAUT — elements.js
 * Element (device) type definitions for the abstract BARC/BARCS network model.
 * Every element is a (conditioned-)reversible Mealy machine:
 *    transition(port, polarity, state) -> { port, pol, state, heat, absorb }
 * Polarity: +1 / -1. Unary-world pulses are all +1 and unary elements ignore polarity.
 * DOM-free: usable from both the browser and Node test harness.
 */
(function () {
  const F = (globalThis.FLUXON = globalThis.FLUXON || {});

  // Port sides (unrotated). Rotation r in {0,1,2,3} = r×90° clockwise.
  // Local port coords are in grid-cell units on the element's bounding box,
  // with outward direction vector.
  const W = { ox: -1, oy: 0 }, E = { ox: 1, oy: 0 }, N = { ox: 0, oy: -1 }, S = { ox: 0, oy: 1 };

  function p(name, x, y, dir) { return { name, x, y, ox: dir.ox, oy: dir.oy }; }

  // --- helper for compact transition tables ---------------------------------
  // tbl: map "port,pol,state" -> [port, pol, state, heat]
  function table(tbl) {
    return function (port, pol, state) {
      const key = port + ',' + pol + ',' + state;
      const r = tbl[key];
      if (!r) return null;
      return { port: r[0], pol: r[1], state: r[2], heat: r[3] || 0 };
    };
  }

  const TYPES = {};
  function def(t) { TYPES[t.id] = t; return t; }

  // ===========================================================================
  // 1-PORT ELEMENTS
  // ===========================================================================
  def({
    id: 'REFLECTOR', name: 'Reflector', glyph: 'V',
    w: 1, h: 1, ports: [p('A', 0, 0.5, W)],
    states: null, reversible: true, heatPerOp: 0,
    blurb: 'Bounces any fluxon straight back the way it came. (A shorted line end.)',
    transition: (port, pol, state) => ({ port: 'A', pol, state }),
  });

  def({
    id: 'IREFLECTOR', name: 'Inverting Reflector', glyph: 'V±',
    w: 1, h: 1, ports: [p('A', 0, 0.5, W)],
    states: null, reversible: true, heatPerOp: 0, bipolarOnly: true,
    blurb: 'Bounces a fluxon back with its polarity flipped. (An open line end.)',
    transition: (port, pol, state) => ({ port: 'A', pol: -pol, state }),
  });

  def({
    id: 'EXHAUST', name: 'Exhaust', glyph: 'X',
    w: 1, h: 1, ports: [p('A', 0, 0.5, W)],
    states: null, reversible: false, heatPerOp: 5,
    blurb: 'A damped termination. Swallows any fluxon — and turns ALL of its energy and information into waste heat. Erasure made visible.',
    transition: (port, pol, state) => ({ absorb: true, heat: 5, state }),
  });

  // ===========================================================================
  // 2-PORT ELEMENTS
  // ===========================================================================
  def({
    id: 'NOT', name: 'Polarity Twist', glyph: '±',
    w: 1, h: 1, ports: [p('A', 0, 0.5, W), p('B', 1, 0.5, E)],
    states: null, reversible: true, heatPerOp: 0, bipolarOnly: true,
    blurb: 'Passes fluxons through, flipping their polarity. Physically: a half-twist in the conductor pair. The cheapest logic gate in the universe.',
    transition: (port, pol, state) => ({ port: port === 'A' ? 'B' : 'A', pol: -pol, state }),
  });

  def({
    id: 'FD', name: 'Flipping Diode', glyph: 'FD',
    w: 1, h: 1, ports: [p('A', 0, 0.5, W), p('B', 1, 0.5, E)],
    states: ['fwd', 'rev'], defaultState: 'fwd', // fwd: conducts A->B ; rev: conducts B->A
    reversible: true, heatPerOp: 0,
    blurb: 'A one-way door that flips direction each time something passes through it. Pulses against the grain just bounce off. The simplest element that REMEMBERS.',
    transition(port, pol, state) {
      if (state === 'fwd') {
        if (port === 'A') return { port: 'B', pol, state: 'rev' };   // pass, flip
        return { port: 'B', pol, state: 'fwd' };                      // reflect
      } else {
        if (port === 'B') return { port: 'A', pol, state: 'fwd' };   // pass, flip
        return { port: 'A', pol, state: 'rev' };                      // reflect
      }
    },
  });

  def({
    id: 'RM2', name: 'Memory Cell (RM2)', glyph: 'RM',
    w: 1, h: 1, ports: [p('A', 0, 0.5, W), p('B', 1, 0.5, E)],
    states: [1, -1], defaultState: -1, stateIsPolarity: true, playerSettable: true,
    reversible: true, heatPerOp: 0, bipolarOnly: true,
    portLabels: { A: 'A', B: 'B' },
    blurb: 'The Reversible Memory cell — a superconducting loop holding one stored fluxon. Matching polarity: the visitor bounces off. Opposite polarity: they SWAP — the stored fluxon is ejected out the same port the visitor came in. Patented for real (US 11,289,156).',
    transition(port, pol, state) {
      if (pol === state) return { port, pol, state };           // reflect
      return { port, pol: state, state: pol };                  // exchange, same port
    },
  });

  def({
    id: 'RM1', name: 'Memory Cell (RM)', glyph: 'RM',
    w: 1, h: 1, ports: [p('A', 0, 0.5, W)],
    states: [1, -1], defaultState: -1, stateIsPolarity: true, playerSettable: true,
    reversible: true, heatPerOp: 0, bipolarOnly: true,
    blurb: 'Single-port Reversible Memory cell. Same rule as RM2: match ⇒ reflect, mismatch ⇒ exchange.',
    transition(port, pol, state) {
      if (pol === state) return { port, pol, state };
      return { port, pol: state, state: pol };
    },
  });

  def({
    id: 'BSR', name: 'Shift Register (BSR)', glyph: 'SR',
    w: 1, h: 1, ports: [p('A', 0, 0.5, W), p('B', 1, 0.5, E)],
    states: [1, -1], defaultState: 1, stateIsPolarity: true, playerSettable: true,
    reversible: true, heatPerOp: 0, bipolarOnly: true,
    blurb: 'The Ballistic Shift Register (Osborn & Wustmann). A fluxon passes straight through — but swaps polarity with the stored one on the way. A bucket brigade for bits.',
    transition(port, pol, state) {
      return { port: port === 'A' ? 'B' : 'A', pol: state, state: pol };
    },
  });

  def({
    id: 'PFG', name: 'Polarity Filter (biased)', glyph: 'PF',
    w: 1, h: 1, ports: [p('A', 0, 0.5, W), p('B', 1, 0.5, E)],
    states: null, reversible: false, heatPerOp: 1, bipolarOnly: true,
    config: { bias: 1 }, // bias polarity is forced toward port B
    blurb: 'A current-biased barrier. The bias shoves its favorite polarity toward one side — regardless of which way the fluxon was going. It dissipates only when it PUMPS a fluxon through (the junction briefly switches to its voltage state); a fluxon it reflects recoils elastically, staying on the supercurrent branch, for free. (ASC’22.)',
    transition(port, pol, state, cfg) {
      const b = (cfg && cfg.bias) || 1;
      const out = (pol === b) ? 'B' : 'A';   // bias forces + toward B, − toward A
      // Heat only when the fluxon is PUMPED through to the other port (the JJ enters
      // the voltage state and quasiparticles tunnel). A reflection (out === entry
      // port) stays superconducting — elastic recoil, ~zero dissipation.
      return { port: out, pol, state, heat: out === port ? 0 : 1 };
    },
  });

  def({
    id: 'RPF', name: 'Reversible Filter (rPF)', glyph: 'rPF',
    w: 1, h: 1, ports: [p('A', 0, 0.5, W), p('B', 1, 0.5, E)],
    states: [1, -1], defaultState: 1, stateIsPolarity: true, playerSettable: true,
    reversible: true, heatPerOp: 0, bipolarOnly: true,
    blurb: 'The reversible Polarity Filter — the unbiased cousin of the biased PF. A trapped flux sets a barrier polarity: a fluxon whose polarity MATCHES the barrier passes straight through; a mismatch reflects straight back the way it came. The entry port is never lost, so it is fully reversible and dissipates nothing — no power supply. This is the data rail of the Controlled Barrier. (JJ Workshop ’25.)',
    transition(port, pol, state) {
      if (pol === state) return { port: port === 'A' ? 'B' : 'A', pol, state };  // match → pass through
      return { port, pol, state };                                                // mismatch → reflect (same port)
    },
  });

  // ===========================================================================
  // 3-PORT ELEMENTS  (unrotated: A=W stem/first, B=N, C=E)
  // ===========================================================================
  const PORTS3 = [p('A', 0, 0.5, W), p('B', 0.5, 0, N), p('C', 1, 0.5, E)];

  function cyc(portsOrder, port, step) {
    const i = portsOrder.indexOf(port);
    return portsOrder[(i + step + 3) % 3];
  }
  const ORDER_CW = ['A', 'B', 'C']; // W -> N -> E -> W is clockwise on screen

  def({
    id: 'ROTARY', name: 'Rotary', glyph: '↻',
    w: 1, h: 1, ports: PORTS3.map(q => ({ ...q })),
    states: null, reversible: true, heatPerOp: 0,
    config: { ccw: false },
    portLabels: { A: 'A', B: 'B', C: 'C' },
    blurb: 'Routes every pulse to the next port around the circle (clockwise, or counter-clockwise for the mirrored variant). Stateless, reversible traffic management.',
    transition(port, pol, state, cfg) {
      const step = cfg && cfg.ccw ? -1 : 1;
      return { port: cyc(ORDER_CW, port, step), pol, state };
    },
  });

  def({
    id: 'TCB', name: 'Toggle Barrier (TCB)', glyph: 'TB',
    w: 1, h: 1,
    ports: [p('A', 0, 0.5, W), p('C', 0.5, 0, N), p('B', 1, 0.5, E)],
    states: ['closed', 'open'], defaultState: 'closed', playerSettable: true,
    reversible: true, heatPerOp: 0,
    portLabels: { A: 'A', B: 'B', C: 'C' },
    blurb: 'The Toggling Controlled Barrier. A pulse hitting the control port C bounces back AND toggles the barrier. The side channel (A↔B) passes when open, reflects when closed. Together with the Rotary, this element is computation-UNIVERSAL (ICRC’17).',
    transition(port, pol, state) {
      if (port === 'C') return { port: 'C', pol, state: state === 'open' ? 'closed' : 'open' };
      if (state === 'open') return { port: port === 'A' ? 'B' : 'A', pol, state };
      return { port, pol, state }; // closed: reflect
    },
  });

  def({
    id: 'PS', name: 'Polarity Separator (biased)', glyph: 'PS',
    w: 1, h: 1,
    ports: [p('S', 0, 0.5, W), p('P', 0.5, 0, N), p('M', 1, 0.5, E)],
    states: null, reversible: false, heatPerOp: 1, bipolarOnly: true,
    portLabels: { S: 'S', P: '+', M: '−' },
    blurb: 'A biased three-way: from the stem, + fluxons go to the + branch and − fluxons to the − branch; a matching fluxon on an arm reflects and a mismatched one crosses to the other arm; nothing returns to the stem. The workhorse router of the real BARCS test circuits (ASC’22) — logically irreversible (the + output can’t tell a stem pass-through from a bounce or a cross), and its bias supply dissipates whenever it pumps a fluxon through, though a fluxon it reflects off its matching arm recoils for free.',
    transition(port, pol, state) {
      // Biased: the bias always pushes + out the + arm and − out the − arm, whatever
      // port the fluxon enters — a matching fluxon reflects, a mismatched one crosses
      // over, and nothing returns to the stem. Non-injective (a + leaving the + arm could
      // have passed from the stem, reflected, or crossed), hence logically irreversible.
      const out = (pol === 1) ? 'P' : 'M';
      // This device's dissipative set: it pays only when it pumps a fluxon through to a
      // different port; a matching fluxon reflecting off its arm (out === entry port)
      // stays on the supercurrent branch and is free. (Per-device property — not a
      // universal law; the Landauer merge-check in the test suite validates the flags.)
      return { port: out, pol, state, heat: out === port ? 0 : 1 };
    },
  });

  def({
    id: 'RPS', name: 'Reversible Separator (rPS)', glyph: 'rPS',
    w: 1, h: 1,
    ports: [p('S', 0, 0.5, W), p('P', 0.5, 0, N), p('M', 1, 0.5, E)],
    states: null, reversible: true, heatPerOp: 0, bipolarOnly: true, conjectural: true,
    portLabels: { S: 'S', P: '+', M: '−' },
    blurb: 'CONJECTURAL. A polarity separator biased by trapped flux instead of a power supply — the same trick that made the polarity filter reversible (rPF). Nobody has designed one yet. If it exists, it routes like a PS while dissipating nothing.',
    transition(port, pol, state) {
      if (port === 'S') return { port: pol === 1 ? 'P' : 'M', pol, state };
      if (port === 'P') return pol === 1 ? { port: 'S', pol, state } : { port: 'P', pol, state };
      return pol === -1 ? { port: 'S', pol, state } : { port: 'M', pol, state };
    },
  });

  def({
    id: 'CIRC', name: 'Circulator (biased)', glyph: 'C↻',
    w: 1, h: 1, ports: PORTS3.map(q => ({ ...q })),
    states: null, reversible: false, heatPerOp: 1, bipolarOnly: true,
    portLabels: { A: 'A', B: 'B', C: 'C' },
    blurb: 'The "partial rotary" from the real RFSG chip: routes pulses clockwise regardless of polarity, using DC bias currents — which dissipate a little on every pass. (JJ Workshop ’25.)',
    transition(port, pol, state) {
      return { port: cyc(ORDER_CW, port, 1), pol, state, heat: 1 };
    },
  });

  def({
    id: 'PR3', name: 'Polarized Rotary', glyph: '±↻',
    w: 1, h: 1, ports: PORTS3.map(q => ({ ...q })),
    states: null, reversible: true, heatPerOp: 0, bipolarOnly: true,
    portLabels: { A: 'A', B: 'B', C: 'C' },
    blurb: 'Routes + fluxons clockwise and − fluxons counter-clockwise. Fully reversible and unpowered — but it would need permanently trapped flux, and no JJ circuit for it has been demonstrated yet. (BARC memo ’24.)',
    transition(port, pol, state) {
      return { port: cyc(ORDER_CW, port, pol === 1 ? 1 : -1), pol, state };
    },
  });

  // ===========================================================================
  // BIG ELEMENTS
  // ===========================================================================
  def({
    id: 'TSG', name: 'Switch Gate chip (TSG)', glyph: 'SG',
    w: 2, h: 2,
    ports: [
      p('Ci', 0.5, 0, N), p('Co', 0.5, 2, S),
      p('I', 0, 1.5, W), p('U', 2, 0.5, E), p('D', 2, 1.5, E),
    ],
    states: ['up', 'down'], defaultState: 'up', playerSettable: true,
    reversible: true, heatPerOp: 0,
    portLabels: { Ci: 'Ci', Co: 'Co', I: 'I', U: 'U', D: 'D' },
    blurb: 'The Toggling Switch Gate you built from a TCB and two rotaries — now sealed as a chip. Control pulses (Ci→Co) toggle it. Data on I is routed to U (up state) or D (down state); pulses arriving on U/D in the matching state route back to I.',
    transition(port, pol, state) {
      const flip = state === 'up' ? 'down' : 'up';
      if (port === 'Ci') return { port: 'Co', pol, state: flip };
      if (port === 'Co') return { port: 'Ci', pol, state };   // one-way rotary: Co bypasses the TCB, no toggle
      if (port === 'I') return { port: state === 'up' ? 'U' : 'D', pol, state };
      if (port === 'U') return state === 'up' ? { port: 'I', pol, state } : { port: 'U', pol, state };
      if (port === 'D') return state === 'down' ? { port: 'I', pol, state } : { port: 'D', pol, state };
      return null;
    },
  });

  def({
    id: 'CB', name: 'Controlled Barrier (CB)', glyph: 'CB',
    w: 2, h: 2,
    ports: [
      p('K1', 0, 0.5, W), p('K2', 2, 0.5, E),   // control rail (RM2)
      p('D1', 0, 1.5, W), p('D2', 2, 1.5, E),   // data rail (rPF)
    ],
    states: [1, -1], defaultState: -1, stateIsPolarity: true, playerSettable: true,
    reversible: true, heatPerOp: 0, bipolarOnly: true,
    portLabels: { K1: 'K1', K2: 'K2', D1: 'D1', D2: 'D2' },
    blurb: 'THE universal BARCS element (JJ Workshop ’25): a two-port memory cell (top rail) magnetically coupled to a reversible polarity filter (bottom rail). Control rule: match ⇒ reflect, mismatch ⇒ exchange (stored fluxon ejected out the same port). Data rule: a fluxon whose polarity MATCHES the stored state passes; otherwise it reflects. Fully reversible.',
    transition(port, pol, state) {
      if (port === 'K1' || port === 'K2') {
        if (pol === state) return { port, pol, state };
        return { port, pol: state, state: pol };
      }
      // data ports
      if (pol === state) return { port: port === 'D1' ? 'D2' : 'D1', pol, state };
      return { port, pol, state };
    },
  });

  // ===========================================================================
  // COMPOSITE CHIPS (idealized zero-delay reversible Mealy machines)
  // ===========================================================================
  def({
    id: 'DUP', name: 'Duplicator (×2)', glyph: 'DUP',
    w: 2, h: 3,
    ports: [
      p('X', 0, 0.5, W), p('M', 0, 1.5, W), p('C', 0, 2.5, W),
      p('XX', 2, 0.5, E), p('MO', 2, 1.5, E), p('NX', 2, 2.5, E),
    ],
    states: ['UU', 'DU', 'DD', 'UD'], defaultState: 'UU',
    reversible: true, partial: true, heatPerOp: 0,
    portLabels: { X: '▸X', M: '▸M', C: '▸1', XX: 'XX▸', MO: 'M▸', NX: '¬X▸' },
    blurb: 'The asynchronous pulse duplicator (ICRC ’17), packaged as a chip. Given data on X (with a control M and a constant 1, in that order) it emits two copies on XX; if X is absent it emits ¬X instead. Two internal switch gates ⇒ two state bits. Arrivals out of the intended order are undefined.',
    transition(port, pol, state) {
      const T = { 'X,UU': ['XX', 'DU'], 'M,DU': ['MO', 'DD'], 'C,DD': ['XX', 'UD'], 'M,UD': ['MO', 'UU'], 'M,UU': ['MO', 'UD'], 'C,UD': ['NX', 'UD'] };
      const r = T[port + ',' + state];
      return r ? { port: r[0], pol, state: r[1] } : null;
    },
  });
  def({
    id: 'RDUP', name: 'Reverse Duplicator', glyph: 'rDUP',
    w: 2, h: 3,
    ports: [
      p('XX', 0, 0.5, W), p('M', 0, 1.5, W), p('NX', 0, 2.5, W),
      p('X', 2, 0.5, E), p('MO', 2, 1.5, E), p('C', 2, 2.5, E),
    ],
    states: ['UU', 'DU', 'DD', 'UD'], defaultState: 'UU',
    reversible: true, partial: true, heatPerOp: 0,
    portLabels: { XX: '▸XX', M: '▸M', NX: '▸¬X', X: 'X▸', MO: 'M▸', C: '1▸' },
    blurb: 'The duplicator run backward: it consumes two copies of X on XX (plus M and the ¬X garbage) and reduces them to a single X out, regenerating the constant 1 — Bennett-style uncomputation. Arrivals out of order are undefined.',
    transition(port, pol, state) {
      const T = { 'XX,DU': ['X', 'UU'], 'M,DD': ['MO', 'DU'], 'XX,UD': ['C', 'DD'], 'M,UU': ['MO', 'UD'], 'M,UD': ['MO', 'UU'], 'NX,UD': ['C', 'UD'] };
      const r = T[port + ',' + state];
      return r ? { port: r[0], pol, state: r[1] } : null;
    },
  });

  // ===========================================================================
  // I/O BOUNDARY
  // ===========================================================================
  def({
    id: 'LAUNCHER', name: 'Launcher', glyph: '▶',
    w: 1, h: 1, ports: [p('A', 1, 0.5, E)],
    states: null, reversible: true, heatPerOp: 0, io: true,
    blurb: 'A DC-to-SFQ converter: kicks fresh fluxons into the network. If a fluxon comes BACK into a launcher, its damping resistors eat it (lots of heat).',
    transition: (port, pol, state) => ({ absorb: true, heat: 5, backflow: true, state }),
  });

  def({
    id: 'DETECTOR', name: 'Detector', glyph: '◉',
    w: 1, h: 1, ports: [p('A', 0, 0.5, W)],
    states: null, reversible: true, heatPerOp: 0, io: true,
    blurb: 'An SFQ-to-DC readout at the network boundary. Catches fluxons and records their polarity and order. (Boundary I/O is heat-free in this game; the bookkeeping happens beyond the edge of the board.)',
    transition: (port, pol, state) => ({ absorb: true, detect: true, state }),
  });

  // --- geometry helpers ------------------------------------------------------
  // Rotate a local port (cell units) about the element's box of size (w,h), r×90° CW.
  function rotatedPort(type, port, rot, mir) {
    let { x, y, ox, oy } = port;
    let w = type.w, h = type.h;
    if (mir) { x = w - x; ox = -ox; }   // horizontal mirror in local (unrotated) space, before rotation
    for (let i = 0; i < (rot % 4 + 4) % 4; i++) {
      const nx = h - y, ny = x;          // 90° CW rotation maps (x,y) -> (h - y, x)
      const nox = -oy, noy = ox;
      x = nx; y = ny; ox = nox; oy = noy;
      const t = w; w = h; h = t;
    }
    return { name: port.name, x, y, ox, oy };
  }
  function rotatedSize(type, rot) {
    return (rot % 2 === 0) ? { w: type.w, h: type.h } : { w: type.h, h: type.w };
  }

  // Verify injectivity of every state-bearing transition table (sanity check).
  function checkReversibility(typeId, cfg) {
    const t = TYPES[typeId];
    const states = t.states || [null];
    const seen = new Map(); let injective = true;
    for (const st of states) for (const port of t.ports) for (const pol of [1, -1]) {
      const r = t.transition(port.name, pol, st, cfg || t.config);
      if (!r || r.absorb) continue;
      const key = r.port + ',' + r.pol + ',' + r.state;
      if (seen.has(key)) injective = false;
      seen.set(key, [port.name, pol, st]);
    }
    return injective;
  }

  F.TYPES = TYPES;
  F.rotatedPort = rotatedPort;
  F.rotatedSize = rotatedSize;
  F.checkReversibility = checkReversibility;
})();

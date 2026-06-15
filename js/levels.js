/* FLUXONAUT — levels.js
 * Level definitions, story text, and the Lab Notebook.
 * Coordinates are grid cells. Fixed elements may be locked (immovable) and/or
 * stateLocked (initial state not editable). Palette lists placeable types.
 * Cases: input pulse sequences (order is the spec; timing gets jittered during
 * Certify) and expected per-detector output sequences.
 */
(function () {
  const F = (globalThis.FLUXON = globalThis.FLUXON || {});

  const P = 1, M = -1; // polarities

  function el(id, type, x, y, rot, opts) {
    const t = F.TYPES[type];
    return Object.assign({
      id, type, x, y, rot: rot || 0,
      state: t.states ? t.defaultState : null,
      cfg: t.config ? { ...t.config } : undefined,
      locked: true, stateLocked: true,
    }, opts || {});
  }

  const LEVELS = [

    // ════════════════════════════ WORLD 1 — BALLISTIC BOOTCAMP ═══════════════════
    {
      id: 'w1l1', world: 1, n: 1, title: 'First Light', size: { w: 22, h: 13 },
      bipolar: false,
      intro: `Welcome to the cryostat, fluxonaut. Those glowing dots are <b>fluxons</b> —
single quanta of magnetic flux, the smallest possible blips of magnetic field.
In a superconductor they ride along transmission lines like frictionless surfers:
no battery, no clock, no loss. We call that <b>ballistic</b> travel.
<br><br>Your first task is pure plumbing: <b>draw a wire</b> from the launcher to the
detector (click one port, then the other; click empty space to add bends), then press <b>▶ Run</b>.
<br><br><i>One honest disclaimer: a real fluxon would cross this whole board in about
a tenth of a nanosecond. The game slows time by a factor of ~10¹¹ so your eyes
can keep up.</i>`,
      hint: 'Click the launcher’s port, then the detector’s port. Then Run.',
      success: 'Notice nothing pushed that fluxon along — it coasted. That free ride is what makes ballistic computing worth chasing.',
      notebook: ['fluxons', 'ballistic'],
      fixed: [
        el('L_in', 'LAUNCHER', 1, 6), el('D_out', 'DETECTOR', 20, 6),
      ],
      labels: { L_in: 'IN', D_out: 'OUT' },
      palette: {},
      cases: [{ name: 'one fluxon', inputs: [{ launcher: 'L_in', pol: P }], expect: { D_out: [P] } }],
      parElements: 0, parHeat: 0,
    },

    {
      id: 'w1l2', world: 1, n: 2, title: 'Roundabout', size: { w: 22, h: 13 },
      bipolar: false,
      intro: `Wires here never branch — every wire joins exactly two ports, and fluxons can
travel along it <i>in either direction</i>. To build junctions you need devices.
<br><br>Meet the <b>Rotary</b>: three ports, and every arriving fluxon leaves by the
<i>next port around the circle</i>. And the <b>Reflector</b>: a dead end that bounces
fluxons straight back.
<br><br>Send the fluxon from IN, off the Reflector, and around to OUT.
A bounce isn’t a failure here — it’s a U-turn you can route.`,
      hint: 'IN → rotary port A. Rotary B → reflector. The bounce re-enters B and leaves by C → OUT.',
      success: 'That bounce-and-continue move is the single most useful idiom in this lab. You’ll use it constantly.',
      notebook: ['rotary'],
      fixed: [
        el('L_in', 'LAUNCHER', 1, 6), el('rot1', 'ROTARY', 10, 6),
        el('D_out', 'DETECTOR', 20, 6),
      ],
      labels: { L_in: 'IN', D_out: 'OUT' },
      palette: { REFLECTOR: 1 },
      cases: [{ name: 'around the bend', inputs: [{ launcher: 'L_in', pol: P }], expect: { D_out: [P] } }],
      parElements: 1, parHeat: 0,
    },

    {
      id: 'w1l3', world: 1, n: 3, title: 'Tailgaters', size: { w: 22, h: 13 },
      bipolar: false,
      intro: `A previous occupant left this rig in a sorry state. Two fluxons launch in
sequence — and the second one slams head-on into the first as it returns from that
absurdly distant reflector. Run it and watch.
<br><br>Direct fluxon-on-fluxon collisions are <b>chaos</b>: tiny timing differences get
amplified exponentially, like billiard balls. Our whole design style exists to make
collisions <i>impossible by construction</i>, no matter how timing wobbles.
<br><br>Fix the circuit: delete the long wire (right-click it), drag the reflector
close to the rotary, and re-wire it short.`,
      hint: 'Right-click deletes a wire. The reflector spur must be short enough that pulse 1 is long gone before pulse 2 arrives — under ANY timing wobble.',
      success: 'Rule one of asynchronous design: pulses must never be able to meet. Keep shared structures tight; give events room to breathe.',
      notebook: ['collision', 'asynchrony'],
      fixed: [
        el('L_in', 'LAUNCHER', 1, 6),
        el('rot1', 'ROTARY', 8, 6),
        el('refl', 'REFLECTOR', 19, 1, 0, { locked: false }),
        el('D_out', 'DETECTOR', 20, 6),
      ],
      prewires: [
        { a: ['L_in', 'A'], b: ['rot1', 'A'], via: [] },
        { a: ['rot1', 'B'], b: ['refl', 'A'], via: [{ x: 8.5, y: 1.5 }] },
        { a: ['rot1', 'C'], b: ['D_out', 'A'], via: [] },
      ],
      labels: { L_in: 'IN', D_out: 'OUT' },
      palette: {},
      cases: [{ name: 'two in a row', inputs: [{ launcher: 'L_in', pol: P }, { launcher: 'L_in', pol: P }], expect: { D_out: [P, P] } }],
      parElements: 0, parHeat: 0,
    },

    {
      id: 'w1l4', world: 1, n: 4, title: 'The One-Way Door', size: { w: 22, h: 13 },
      bipolar: false,
      intro: `Everything so far treats every fluxon identically — stateless devices route
pulse #2 exactly like pulse #1. To tell pulses apart, a device must <b>remember</b>.
<br><br>The <b>Flipping Diode</b> is the simplest rememberer: it conducts one way
(and <i>flips direction</i> each time something passes through), and bounces anything
going against the grain.
<br><br>Pulse 1 should reach PASS. Pulse 2 — arriving to find the door now flipped —
should bounce, and must be routed to BOUNCE.`,
      hint: 'Launcher → rotary → FD. Pulse 2 bounces off the FD, re-enters the rotary, and exits by the next port.',
      success: 'One bit of internal state, and suddenly identical pulses get different treatment. That tiny memory is the seed of all computation here.',
      notebook: ['state'],
      fixed: [
        el('L_in', 'LAUNCHER', 1, 6),
        el('D_pass', 'DETECTOR', 20, 3), el('D_bounce', 'DETECTOR', 20, 9),
      ],
      labels: { L_in: 'IN', D_pass: 'PASS', D_bounce: 'BOUNCE' },
      palette: { FD: 1, ROTARY: 1 },
      cases: [
        { name: 'single', inputs: [{ launcher: 'L_in', pol: P }], expect: { D_pass: [P], D_bounce: [] } },
        { name: 'pair', inputs: [{ launcher: 'L_in', pol: P }, { launcher: 'L_in', pol: P }], expect: { D_pass: [P], D_bounce: [P] } },
      ],
      parElements: 2, parHeat: 0,
    },

    {
      id: 'w1l5', world: 1, n: 5, title: 'Three Ways', size: { w: 22, h: 13 },
      bipolar: false,
      intro: `Boss time. One launcher fires up to <b>three</b> fluxons; deliver the
first to OUT 1, the second to OUT 2, the third to OUT 3.
<br><br>Stateless parts alone provably can’t do this — every reversible stateless
device routes each port to one fixed other port, so all three pulses would march to
the same place. You’ll need doors that remember how many have passed.
<br><br>(Certify runs every case with wobbled timing. Designs that only work for one
exact schedule don’t count in this lab.)`,
      hint: 'FD chain: pulse 1 passes FD₁. Pulse 2 bounces off FD₁, then passes FD₂. Pulse 3 bounces off both. Keep each FD adjacent to its rotary.',
      success: 'A pulse train fanned out, one address each — using nothing but bounces and two bits of memory. Now let’s do real logic.',
      notebook: ['mealy'],
      fixed: [
        el('L_in', 'LAUNCHER', 1, 6),
        el('D1', 'DETECTOR', 20, 2), el('D2', 'DETECTOR', 20, 6), el('D3', 'DETECTOR', 20, 10),
      ],
      labels: { L_in: 'IN', D1: 'OUT 1', D2: 'OUT 2', D3: 'OUT 3' },
      palette: { FD: 2, ROTARY: 2 },
      cases: [
        { name: 'one', inputs: [{ launcher: 'L_in', pol: P }], expect: { D1: [P], D2: [], D3: [] } },
        { name: 'two', inputs: [{ launcher: 'L_in', pol: P }, { launcher: 'L_in', pol: P }], expect: { D1: [P], D2: [P], D3: [] } },
        { name: 'three', inputs: [{ launcher: 'L_in', pol: P }, { launcher: 'L_in', pol: P }, { launcher: 'L_in', pol: P }], expect: { D1: [P], D2: [P], D3: [P] } },
      ],
      parElements: 4, parHeat: 0,
    },

    // ════════════════════════════ WORLD 2 — STATEFUL LOGIC ═══════════════════════
    {
      id: 'w2l1', world: 2, n: 1, title: 'Gatekeeper', size: { w: 22, h: 13 },
      bipolar: false,
      intro: `This is the <b>Toggle Barrier</b> (TCB) — the star of the 2017 theory paper.
A pulse hitting its control port <b>C</b> bounces back <i>and toggles the barrier</i>.
The side channel A↔B passes pulses when open, bounces them when closed. It starts closed.
<br><br>Three test schedules, one circuit. Control pulses must end at CTL;
data that passes ends at PASS; data that bounces ends at BOUNCE.
<br><br>One more thing, and this is the heart of everything: only the <b>order</b> of
arrivals matters. The device sits quietly between pulses — there is no clock here.`,
      hint: 'Give both the control line and the data line their own rotary, so reflected pulses have somewhere to go. (Try the counter-clockwise rotary variant — select a rotary and tap ⟳ to flip its direction.)',
      success: 'Control opens, data passes; no control, data bounces; second control closes again. You may recognize this behavior: it is a SWITCH.',
      notebook: ['tcb'],
      fixed: [
        el('L_C', 'LAUNCHER', 1, 3), el('L_D', 'LAUNCHER', 1, 9),
        el('D_ctl', 'DETECTOR', 20, 3), el('D_pass', 'DETECTOR', 20, 9), el('D_refl', 'DETECTOR', 20, 12),
      ],
      labels: { L_C: 'CTL IN', L_D: 'DATA IN', D_ctl: 'CTL', D_pass: 'PASS', D_refl: 'BOUNCE' },
      palette: { TCB: 1, ROTARY: 2 },
      cases: [
        { name: 'no control', inputs: [{ launcher: 'L_D', pol: P }], expect: { D_ctl: [], D_pass: [], D_refl: [P] } },
        { name: 'control first', inputs: [{ launcher: 'L_C', pol: P }, { launcher: 'L_D', pol: P }], expect: { D_ctl: [P], D_pass: [P], D_refl: [] } },
        { name: 'open, shut', inputs: [{ launcher: 'L_C', pol: P }, { launcher: 'L_D', pol: P }, { launcher: 'L_C', pol: P }, { launcher: 'L_D', pol: P }], expect: { D_ctl: [P, P], D_pass: [P], D_refl: [P] } },
      ],
      parElements: 3, parHeat: 0,
    },

    {
      id: 'w2l2', world: 2, n: 2, title: 'The Sorting Office', size: { w: 22, h: 13 },
      bipolar: false,
      intro: `What you built last level — barrier plus rotaries — is the
<b>Toggling Switch Gate</b>, and the lab now hands it to you as a sealed chip.
Control pulses pass Ci→Co and flip it; data on <b>I</b> exits <b>U</b> (up state)
or <b>D</b> (down state).
<br><br>Use it as a <b>demultiplexer</b>: route X down, then Y up, steered by control
pulses that arrive between them. The control stream looks like a clock — but notice
it isn’t one. Nothing cares <i>when</i> pulses arrive. Only the order is sacred.`,
      hint: 'CTL → Ci. Spent controls leave via Co — catch them at CTL OUT. Data: IN → I; U → UP; D → DOWN.',
      success: 'Demultiplexing, no clock required. Run it backwards in your head: the same circuit is a multiplexer — merging needs state too.',
      notebook: ['tsg'],
      fixed: [
        el('L_ctl', 'LAUNCHER', 1, 2), el('L_dat', 'LAUNCHER', 1, 8),
        el('D_up', 'DETECTOR', 20, 4), el('D_dn', 'DETECTOR', 20, 9), el('D_co', 'DETECTOR', 20, 12),
      ],
      labels: { L_ctl: 'CTL IN', L_dat: 'DATA IN', D_up: 'UP', D_dn: 'DOWN', D_co: 'CTL OUT' },
      palette: { TSG: 1 },
      cases: [
        { name: 'no controls', inputs: [{ launcher: 'L_dat', pol: P }], expect: { D_up: [P], D_dn: [], D_co: [] } },
        {
          name: 'X down, Y up', inputs: [
            { launcher: 'L_ctl', pol: P }, { launcher: 'L_dat', pol: P },
            { launcher: 'L_ctl', pol: P }, { launcher: 'L_dat', pol: P },
          ], expect: { D_up: [P], D_dn: [P], D_co: [P, P] },
        },
      ],
      parElements: 1, parHeat: 0,
    },

    {
      id: 'w2l3', world: 2, n: 3, title: 'Merge Lanes', size: { w: 22, h: 13 },
      bipolar: false,
      intro: `Back in World 1 you proved a frustrating theorem with your own hands:
stateless reversible devices <i>cannot merge</i> two lines onto one. Each input port
goes to its one fixed output port, end of story.
<br><br>The Switch Gate breaks the impasse: run it in reverse. Pulses arriving on U or D
(in the matching state) exit together through <b>I</b> — one shared line.
<br><br>Merge the UPPER and LOWER data pulses onto OUT, flipping the switch between them.`,
      hint: 'Rotate the chip (R key, or ⟳ in the inspector) so U and D face the launchers. Upper data → U while up; control flips it; lower data → D.',
      success: 'When reversible-logic papers draw a Y-shaped merging wire, THIS is what the drawing secretly means: a switch gate plus deliberately ordered control pulses.',
      notebook: ['merge'],
      fixed: [
        el('L_u', 'LAUNCHER', 1, 4), el('L_d', 'LAUNCHER', 1, 8), el('L_ctl', 'LAUNCHER', 1, 1),
        el('D_out', 'DETECTOR', 20, 6), el('D_co', 'DETECTOR', 20, 12),
      ],
      labels: { L_u: 'UPPER', L_d: 'LOWER', L_ctl: 'CTL IN', D_out: 'OUT', D_co: 'CTL OUT' },
      palette: { TSG: 1 },
      cases: [
        { name: 'upper only', inputs: [{ launcher: 'L_u', pol: P }], expect: { D_out: [P], D_co: [] } },
        {
          name: 'both lanes', inputs: [
            { launcher: 'L_u', pol: P }, { launcher: 'L_ctl', pol: P }, { launcher: 'L_d', pol: P, dt: 2.5 },
          ], expect: { D_out: [P, P], D_co: [P] },
        },
        { name: 'lower only', inputs: [{ launcher: 'L_ctl', pol: P }, { launcher: 'L_d', pol: P, dt: 2.5 }], expect: { D_out: [P], D_co: [P] } },
      ],
      parElements: 1, parHeat: 0,
    },

    {
      id: 'w2l4', world: 2, n: 4, title: 'The Duplicator', size: { w: 22, h: 13 },
      bipolar: false,
      intro: `Copying sounds trivial. It isn’t. A fluxon is <i>conserved</i> — you can’t split one pulse into two. To <b>copy</b> a bit you borrow a fresh fluxon from a constant supply and make it retell the same story.
<br><br>This rig is wired-for-you EXCEPT the wires. Two switch gates do it. <b>A</b> is the copier; <b>B</b> is a multiplexer that feeds signals into A’s control line, steered by the <b>M</b> pulses.
<br><br>If <b>X</b> arrives, it routes through B into A’s control: A flips, and the pulse leaves at <b>OUT</b> — copy #1. A is now flipped, so the <b>constant</b> pulse takes A’s other road, loops back through B into A’s control, flips A <i>back</i>, and exits <b>OUT</b> — copy #2. Two pulses out; A and B end exactly as they began.
<br><br>No <b>X</b>? A never flips, so the constant pulse leaves on the <b>¬X</b> line instead — incidental “garbage” you could uncompute later with a mirror circuit.
<br><br>There’s no clock: <b>order</b> is everything. X must reach A before the constant does — so keep the A↔B loop short. (8 wires.)`,
      hint: 'Wire three paths (8 wires). Copy: CONST→A.I, then A.D loops to B.D, B.I→A.Ci, A.Co→OUT, A.U→¬X. Trigger: X→B.U. Mux control: M→B.Ci, B.Co→M OUT. Keep the A↔B loop short so the second copy returns in time.',
      success: 'X in, two X’s out — and both switches end exactly as they began. Copying without erasing, paid for with one constant pulse. (When X is absent you got ¬X — a NOT, for free.)',
      notebook: ['copying'],
      fixed: [
        el('L_X', 'LAUNCHER', 1, 2), el('L_M', 'LAUNCHER', 1, 6), el('L_1', 'LAUNCHER', 17, 2, 2),
        el('tsgB', 'TSG', 4, 2, 2), el('tsgA', 'TSG', 11, 2, 2),
        el('D_out', 'DETECTOR', 20, 5), el('D_notx', 'DETECTOR', 8, 9, 0),
        el('D_mrec', 'DETECTOR', 20, 12),
      ],
      labels: { L_X: 'X IN', L_M: 'M CTL', L_1: 'CONST 1', D_out: 'OUT', D_notx: 'NOT-X', D_mrec: 'M OUT', tsgA: 'A', tsgB: 'B' },
      palette: {},
      cases: [
        {
          name: 'X = 1', inputs: [
            { launcher: 'L_X', pol: P }, { launcher: 'L_M', pol: P },
            { launcher: 'L_1', pol: P }, { launcher: 'L_M', pol: P, dt: 5 },
          ],
          expect: { D_out: [P, P], D_notx: [], D_mrec: [P, P] },
          finalStates: { tsgA: 'up', tsgB: 'up' },
        },
        {
          name: 'X = 0', inputs: [
            { launcher: 'L_M', pol: P }, { launcher: 'L_1', pol: P }, { launcher: 'L_M', pol: P, dt: 5 },
          ],
          expect: { D_out: [], D_notx: [P], D_mrec: [P, P] },
          finalStates: { tsgA: 'up', tsgB: 'up' },
        },
      ],
      parElements: 0, parHeat: 0,
    },

    {
      id: 'w2l5', world: 2, n: 5, title: 'AND Finally', size: { w: 22, h: 13 },
      bipolar: false,
      intro: `The summit of World 2: a logic gate. Signals are single-rail —
“pulse = 1, no pulse = 0.”
<br><br>Route A into the switch’s control and B into its data. If A came, B exits the
low road: that pulse IS <b>A AND B</b>. If A didn’t, B exits the high road: that’s
<b>(NOT A) AND B</b>. Both outputs matter — reversible logic keeps its receipts.
<br><br>One wrinkle: if A toggled the switch, something must toggle it back. The fix is pure Bennett — compute, then uncompute: the upstream circuit lends you A <i>twice</i>
(e.g. by using a <b>Duplicator</b>). Catch both spent A’s at A OUT. Later, if needed, a reversed
version of a <b>Duplicator</b> can reduce the two A’s back to a single copy, plus constant streams.`,
      hint: 'A → Ci, spent A’s out Co → A OUT. B → I. D port → AND, U port → ¬A·B.',
      success: `AND plus NOT is everything — adders, CPUs, all of it. The 2017 paper proved exactly this construction universal: <i>asynchronous ballistic reversible computing can compute anything</i>. Worlds 3 and 4: making it real, in superconductors.`,
      notebook: ['and', 'universality'],
      fixed: [
        el('L_A', 'LAUNCHER', 1, 3), el('L_B', 'LAUNCHER', 1, 9),
        el('D_a', 'DETECTOR', 20, 2), el('D_and', 'DETECTOR', 20, 8), el('D_nab', 'DETECTOR', 20, 11),
      ],
      labels: { L_A: 'A IN', L_B: 'B IN', D_a: 'A OUT', D_and: 'A·B', D_nab: '¬A·B' },
      palette: { TSG: 1 },
      cases: [
        { name: 'A=1 B=1', inputs: [{ launcher: 'L_A', pol: P }, { launcher: 'L_B', pol: P }, { launcher: 'L_A', pol: P }], expect: { D_a: [P, P], D_and: [P], D_nab: [] } },
        { name: 'A=1 B=0', inputs: [{ launcher: 'L_A', pol: P }, { launcher: 'L_A', pol: P }], expect: { D_a: [P, P], D_and: [], D_nab: [] } },
        { name: 'A=0 B=1', inputs: [{ launcher: 'L_B', pol: P }], expect: { D_a: [], D_and: [], D_nab: [P] } },
        { name: 'A=0 B=0', inputs: [], expect: { D_a: [], D_and: [], D_nab: [] } },
      ],
      parElements: 1, parHeat: 0,
    },

    {
      id: 'w2l6', world: 2, n: 6, title: 'Putting It Together', size: { w: 28, h: 15 },
      bipolar: false,
      intro: `The capstone. You built a <b>Duplicator</b> (W2·4) and a switch-gate <b>AND</b> (W2·5); now assemble the whole Bennett construction — compute the duplicated copies of A, use them in the switch gate, <i>then uncompute</i> — so all that remains at the end is the answer plus a single clean copy of A.
<br><br>Three chips are bolted down for you: a <b>Dup</b> (×2), the <b>SG</b>, and an <b>rDup</b> (the Duplicator run backward). Dup copies <b>A</b> into two pulses (it needs <b>M</b> and a constant <b>1</b>). The two copies drive the SG’s control while <b>B</b> slips in between — computing <b>A·B</b> and <b>¬A·B</b>. Then the spent copies, the <b>¬X</b> garbage, and the <b>M</b> passes feed the rDup, which folds it all back into one <b>A</b>, a regenerated <b>1</b>, and the <b>M</b> stream.
<br><br>No clock — <b>order</b> is everything. The rDup only accepts <b>M first</b>, so the copy path (out through the SG and back) must run <i>long enough to fall behind</i> the direct M line. Give the final <b>M</b> a generous gap so the earlier pulses settle before it resets the gates.`,
      hint: 'Dup: A→X, M→M, 1→C. Copies XX→SG.Ci; B→SG.I; SG.D→A·B, SG.U→¬A·B. Spent copies SG.Co→rDup.XX; Dup.M→rDup.M; Dup.¬X→rDup.¬X. Out: rDup.X→A OUT, rDup.M→M OUT, rDup.1→1 OUT. Make the SG.Co→rDup loop long so M beats the copies into the rDup.',
      success: `Universal reversible computing, fully assembled: AND and all its garbage computed, then <i>uncomputed</i>, leaving one clean copy of A. That is the 2017 paper’s construction end to end — Landauer’s limit dodged, Bennett’s trick made physical.`,
      notebook: ['universality'],
      fixed: [
        el('L_A', 'LAUNCHER', 1, 2), el('L_M', 'LAUNCHER', 1, 6), el('L_1', 'LAUNCHER', 1, 10), el('L_B', 'LAUNCHER', 1, 13),
        el('dup', 'DUP', 4, 2), el('sg', 'TSG', 11, 6), el('rdup', 'RDUP', 20, 2),
        el('D_nand', 'DETECTOR', 16, 5), el('D_and', 'DETECTOR', 16, 8),
        el('D_A', 'DETECTOR', 25, 2), el('D_M', 'DETECTOR', 25, 4), el('D_1', 'DETECTOR', 25, 6),
      ],
      labels: {
        L_A: 'A IN', L_M: 'M CTL', L_1: 'CONST 1', L_B: 'B IN', dup: 'Dup', sg: 'SG', rdup: 'rDup',
        D_nand: '¬A·B', D_and: 'A·B', D_A: 'A OUT', D_M: 'M OUT', D_1: '1 OUT',
      },
      palette: {},
      cases: [
        {
          name: 'A=1 · B=1', inputs: [
            { launcher: 'L_A', pol: P }, { launcher: 'L_M', pol: P }, { launcher: 'L_B', pol: P },
            { launcher: 'L_1', pol: P }, { launcher: 'L_M', pol: P, dt: 2.5 },
          ], expect: { D_and: [P], D_nand: [], D_A: [P], D_M: [P, P], D_1: [P] },
        },
        {
          name: 'A=1 · B=0', inputs: [
            { launcher: 'L_A', pol: P }, { launcher: 'L_M', pol: P },
            { launcher: 'L_1', pol: P }, { launcher: 'L_M', pol: P, dt: 2.5 },
          ], expect: { D_and: [], D_nand: [], D_A: [P], D_M: [P, P], D_1: [P] },
        },
        {
          name: 'A=0 · B=1', inputs: [
            { launcher: 'L_M', pol: P }, { launcher: 'L_B', pol: P },
            { launcher: 'L_1', pol: P }, { launcher: 'L_M', pol: P, dt: 2.5 },
          ], expect: { D_and: [], D_nand: [P], D_A: [], D_M: [P, P], D_1: [P] },
        },
        {
          name: 'A=0 · B=0', inputs: [
            { launcher: 'L_M', pol: P }, { launcher: 'L_1', pol: P }, { launcher: 'L_M', pol: P, dt: 2.5 },
          ], expect: { D_and: [], D_nand: [], D_A: [], D_M: [P, P], D_1: [P] },
        },
      ],
      parElements: 0, parHeat: 0,
    },

    // ════════════════════════════ WORLD 3 — POLARITY ═════════════════════════════
    {
      id: 'w3l1', world: 3, n: 1, title: 'Antifluxon', size: { w: 22, h: 13 },
      bipolar: true,
      intro: `New cryostat, new physics. Real superconducting fluxons come in <b>two
polarities</b>: flux up (<span class="pol-p">+</span>, cyan) and flux down
(<span class="pol-m">−</span>, coral) — fluxon and antifluxon. Polarity is real,
conserved magnetic flux: the network can move it and swap it, never delete it.
<br><br>This detector demands the <i>opposite</i> of whatever we launch. The fix is
beautifully cheap: a <b>twist</b> in the line flips polarity. The cheapest logic
gate in the universe — a NOT made of pure geometry.`,
      hint: 'Wire IN → twist → OUT.',
      success: 'Polarity gives every pulse a sign bit it carries for free. World 3 is about spending it wisely.',
      notebook: ['polarity', 'superconductors'],
      fixed: [
        el('L_in', 'LAUNCHER', 1, 6), el('D_out', 'DETECTOR', 20, 6),
      ],
      labels: { L_in: 'IN', D_out: 'OUT' },
      palette: { NOT: 1 },
      cases: [
        { name: 'minus to plus', inputs: [{ launcher: 'L_in', pol: M }], expect: { D_out: [P] } },
        { name: 'plus to minus', inputs: [{ launcher: 'L_in', pol: P }], expect: { D_out: [M] } },
      ],
      parElements: 1, parHeat: 0,
    },

    {
      id: 'w3l2', world: 3, n: 2, title: 'Exchange Rate', size: { w: 22, h: 13 },
      bipolar: true,
      intro: `The crown jewel of the early BARCS work — the <b>Reversible Memory cell</b>.
A superconducting loop holding one stored fluxon (see its color). The rule:
<br>• matching polarity arrives → it <b>bounces off</b>;
<br>• opposite polarity arrives → they <b>swap</b>: the visitor settles in,
the stored one is ejected out the same port.
<br><br>Perfectly reversible, no power, no clock. This exact cell was designed,
simulated, fabricated on chip — and patented. Deliver what the detector expects,
and leave the cell storing <span class="pol-p">+</span>.`,
      hint: 'Launcher → rotary → RM. Whatever the RM emits re-enters the rotary and continues out the next port.',
      success: 'Reflect-or-exchange is how superconductors do "read-modify-write" without erasing anything. Remember this cell — in World 4 it becomes half of the universal element.',
      notebook: ['rmcell'],
      fixed: [
        el('L_in', 'LAUNCHER', 1, 6), el('D_out', 'DETECTOR', 20, 3),
      ],
      labels: { L_in: 'IN', D_out: 'OUT' },
      palette: { RM1: 1, ROTARY: 1 },
      cases: [
        { name: 'swap', inputs: [{ launcher: 'L_in', pol: P }], expect: { D_out: [M] } },
        { name: 'swap, bounce', inputs: [{ launcher: 'L_in', pol: P }, { launcher: 'L_in', pol: P }], expect: { D_out: [M, P] } },
      ],
      parElements: 2, parHeat: 0,
    },

    {
      id: 'w3l3', world: 3, n: 3, title: 'Bucket Brigade', size: { w: 22, h: 13 },
      bipolar: true,
      intro: `A cousin of the RM cell, from collaborators Osborn &amp; Wustmann: the
<b>Ballistic Shift Register</b>. A fluxon passes straight <i>through</i> it — but swaps
polarity with the stored one on the way.
<br><br>Three cells sit preloaded with <span class="pol-p">+</span>
<span class="pol-m">−</span> <span class="pol-p">+</span>. Push three
<span class="pol-m">−</span> pulses through the chain. Watch the stored pattern
march out the far end, replaced cell by cell — a FIFO memory with no moving parts
and no power draw.`,
      hint: 'Just wire the chain: IN → SR1 → SR2 → SR3 → OUT.',
      success: 'The stored word marched out in order, and the new word marched in. Reversible memory you can stream.',
      notebook: ['bsr'],
      fixed: [
        el('L_in', 'LAUNCHER', 1, 6),
        el('sr1', 'BSR', 7, 6, 0, { state: P }), el('sr2', 'BSR', 10, 6, 0, { state: M }), el('sr3', 'BSR', 13, 6, 0, { state: P }),
        el('D_out', 'DETECTOR', 20, 6),
      ],
      labels: { L_in: 'IN', D_out: 'OUT' },
      palette: {},
      cases: [
        { name: 'stream it', inputs: [{ launcher: 'L_in', pol: M }, { launcher: 'L_in', pol: M }, { launcher: 'L_in', pol: M }], expect: { D_out: [P, M, P] }, finalStates: { sr1: M, sr2: M, sr3: M } },
        { name: 'one more in', inputs: [{ launcher: 'L_in', pol: P }], expect: { D_out: [P] }, finalStates: { sr1: P, sr2: P, sr3: M } },
      ],
      parElements: 0, parHeat: 0,
    },

    {
      id: 'w3l4', world: 3, n: 4, title: 'The Sorter', size: { w: 22, h: 13 },
      bipolar: true,
      intro: `A mixed stream arrives: + − + −. Separate it.
<br><br>The lab’s workhorse for this is the <b>Polarity Separator</b> (PS) — a real,
simulated circuit from the 2022 paper. From the stem, + goes one branch, − the other.
But the PS leans on an external <b>bias current</b>, and the bias supply pays a little
energy <i>every single time</i>. Watch the heat counter when you run —
those embers are real entropy, the kind Landauer warned us about.`,
      hint: 'IN → stem. + branch (marked +) → PLUS, − branch → MINUS.',
      success: 'It works — the real chips use it. But four sorted fluxons cost four puffs of waste heat. Surely physics permits better…',
      notebook: ['ps', 'landauer'],
      fixed: [
        el('L_in', 'LAUNCHER', 1, 6),
        el('D_p', 'DETECTOR', 20, 2), el('D_m', 'DETECTOR', 20, 10),
      ],
      labels: { L_in: 'IN', D_p: 'PLUS', D_m: 'MINUS' },
      palette: { PS: 1 },
      cases: [
        { name: 'sort four', inputs: [{ launcher: 'L_in', pol: P }, { launcher: 'L_in', pol: M }, { launcher: 'L_in', pol: P }, { launcher: 'L_in', pol: M }], expect: { D_p: [P, P], D_m: [M, M] } },
      ],
      parElements: 1, parHeat: 4,
    },

    {
      id: 'w3l5', world: 3, n: 5, title: 'Cold Sort', size: { w: 22, h: 13 },
      bipolar: true,
      intro: `Same job. Zero heat allowed.
<br><br>Meet the <b>Polarized Rotary</b>: + fluxons step clockwise around its ports,
− fluxons step counter-clockwise. No bias, no dissipation, fully reversible.
<br><br>Full disclosure from the Lab Notebook: nobody has built one yet. Theory says
it needs permanently trapped flux, and a working JJ design is an open problem.
In this game it’s legal — consider it a glimpse over the horizon.`,
      hint: 'Same wiring shape as before: stem in, + exits the next port clockwise, − the next counter-clockwise.',
      success: 'Sorted, reversibly: the information about each fluxon’s polarity isn’t destroyed — it’s ENCODED in which wire it took. Nothing forgotten, nothing burned.',
      notebook: ['pr3'],
      fixed: [
        el('L_in', 'LAUNCHER', 1, 6),
        el('D_p', 'DETECTOR', 20, 2), el('D_m', 'DETECTOR', 20, 10),
      ],
      labels: { L_in: 'IN', D_p: 'PLUS', D_m: 'MINUS' },
      palette: { PR3: 1 },
      cases: [
        { name: 'sort four, cold', inputs: [{ launcher: 'L_in', pol: P }, { launcher: 'L_in', pol: M }, { launcher: 'L_in', pol: P }, { launcher: 'L_in', pol: M }], expect: { D_p: [P, P], D_m: [M, M] } },
      ],
      parElements: 1, parHeat: 0,
    },

    {
      id: 'w3l6', world: 3, n: 6, title: 'The Comparator', size: { w: 22, h: 13 },
      bipolar: true,
      intro: `A mystery fluxon X arrives and settles into the memory cell (its eviction
notice — the old stored <span class="pol-m">−</span> — pops out; recycle it to TOKEN).
Then a <span class="pol-p">+</span> probe knocks on the cell’s other port.
<br><br>Think it through: the probe <i>bounces back unchanged</i> if X was +, but
<i>swaps to −</i> if X was −. The probe’s answer carries X’s value!
Route + answers to SAME and − answers to DIFF, reversibly.
<br><br>This is a reversible conditional — an if-statement with no eraser.`,
      hint: 'X side: launcher → rotary → RM2 port A; the evicted − re-enters the rotary → TOKEN. Probe side: rotary into port B; route the returning answer into the Polarized Rotary to split by sign.',
      success: 'You just read a memory by ASKING it, and the question itself reset the cell to +. Query and cleanup in one reversible motion.',
      notebook: ['comparator'],
      fixed: [
        el('L_X', 'LAUNCHER', 1, 4), el('L_P', 'LAUNCHER', 1, 10),
        el('rm', 'RM2', 10, 4, 0, { state: M }),
        el('D_rec', 'DETECTOR', 6, 1), el('D_same', 'DETECTOR', 20, 2), el('D_diff', 'DETECTOR', 20, 7),
      ],
      labels: { L_X: 'X IN', L_P: 'PROBE', D_rec: 'TOKEN', D_same: 'SAME (+)', D_diff: 'DIFF (−)', rm: 'MEM' },
      palette: { ROTARY: 2, PR3: 1 },
      cases: [
        { name: 'X = +', inputs: [{ launcher: 'L_X', pol: P }, { launcher: 'L_P', pol: P }], expect: { D_rec: [M], D_same: [P], D_diff: [] }, finalStates: { rm: P } },
        { name: 'X = −', inputs: [{ launcher: 'L_X', pol: M }, { launcher: 'L_P', pol: P }], expect: { D_rec: [M], D_same: [], D_diff: [M] }, finalStates: { rm: P } },
      ],
      parElements: 3, parHeat: 0,
    },

    {
      id: 'w3l7', world: 3, n: 7, title: 'Waste Not', size: { w: 22, h: 13 },
      bipolar: true,
      intro: `Two fluxons arrive: a <span class="pol-p">+</span> you must deliver, and a
<span class="pol-m">−</span> you don’t need.
<br><br>The lazy fix is the <b>Exhaust</b> — a damped termination that swallows
fluxons whole. It works! It also torches everything that fluxon was, as one fat
burst of waste heat. That’s <i>erasure</i>, the exact thing Landauer taxed.
<br><br>Or… route the unwanted fluxon to the RETURN LINE, intact, for the upstream
circuit to reuse. Reversible computing in one choice: <b>never burn what you can
give back</b>. (Both solutions pass. Only one earns the third star.)`,
      hint: 'Split by polarity. Where you point the − branch is between you and your thermodynamic conscience.',
      success: 'Decomputation beats deletion. Every fluxon you hand back is heat that never happens.',
      notebook: ['erasure'],
      fixed: [
        el('L_in', 'LAUNCHER', 1, 6),
        el('D_out', 'DETECTOR', 20, 4), el('D_ret', 'DETECTOR', 20, 12),
      ],
      labels: { L_in: 'IN', D_out: 'DELIVER', D_ret: 'RETURN LINE' },
      palette: { PR3: 1, EXHAUST: 1 },
      optionalDetectors: ['D_ret'],
      cases: [
        { name: 'keep + , return −', inputs: [{ launcher: 'L_in', pol: P }, { launcher: 'L_in', pol: M }], expect: { D_out: [P] } },
      ],
      parElements: 2, parHeat: 0,
    },

    // ════════════════════════════ WORLD 4 — THE UNIVERSAL ELEMENT ════════════════
    {
      id: 'w4l1', world: 4, n: 1, title: 'The Controlled Barrier', size: { w: 22, h: 13 },
      bipolar: true,
      intro: `Here it is — the discovery the whole program built toward (JJ Workshop, 2025).
The <b>Controlled Barrier</b>: a two-port memory cell (top rail) magnetically coupled
to a reversible polarity filter (bottom rail). One device, two personalities:
<br>• <b>Control rail</b> (K1/K2): the RM rule — match bounces, mismatch swaps.
<br>• <b>Data rail</b> (D1/D2): a fluxon <i>passes</i> if its polarity matches the
stored state, else it <i>reflects</i>. The stored fluxon IS the barrier.
<br><br>It starts storing <span class="pol-m">−</span>. Open it with a
<span class="pol-p">+</span> control (catch the evicted token!), then pass data
through. No control, and data bounces.`,
      hint: 'Control: launcher → rotary → K1; the evicted − re-enters the rotary → TOKEN. Data: launcher → polarized rotary → D1; bounced + data re-enters it and exits the next port clockwise → BOUNCE; passed data D2 → PASS.',
      success: 'Fully reversible, no bias, good margins in simulation. One element that stores, gates, and switches. Now we make it COMPUTE.',
      notebook: ['cb'],
      fixed: [
        el('cb', 'CB', 10, 5, 0, { state: M }),
        el('L_C', 'LAUNCHER', 1, 3), el('L_D', 'LAUNCHER', 1, 9),
        el('D_tok', 'DETECTOR', 20, 1), el('D_pass', 'DETECTOR', 20, 7), el('D_refl', 'DETECTOR', 20, 11),
      ],
      labels: { L_C: 'CTL IN', L_D: 'DATA IN', D_tok: 'TOKEN', D_pass: 'PASS', D_refl: 'BOUNCE', cb: 'CB' },
      palette: { ROTARY: 1, PR3: 1 },
      cases: [
        { name: 'open, pass', inputs: [{ launcher: 'L_C', pol: P }, { launcher: 'L_D', pol: P }], expect: { D_tok: [M], D_pass: [P], D_refl: [] }, finalStates: { cb: P } },
        { name: 'closed, bounce', inputs: [{ launcher: 'L_D', pol: P }], expect: { D_tok: [], D_pass: [], D_refl: [P] }, finalStates: { cb: M } },
        { name: 'open only', inputs: [{ launcher: 'L_C', pol: P }], expect: { D_tok: [M], D_pass: [], D_refl: [] }, finalStates: { cb: P } },
      ],
      parElements: 2, parHeat: 0,
    },

    {
      id: 'w4l2', world: 4, n: 2, title: 'Round Trip Token', size: { w: 22, h: 13 },
      bipolar: true,
      intro: `In a real gate, nobody resets the barrier by hand. The published design makes
the barrier reset <b>itself</b>, with one gorgeous trick:
<br><br>The + control opens the CB and evicts the − token. Two biased Polarity
Separators then chaperone that token <i>around a long loop</i> and back into the CB’s
far control port — where it swaps back in, re-closing the barrier and ejecting the
+ control out the far side as C-OUT.
<br><br>While the token is in transit, the barrier stands open: that transit time is
the gate’s <b>logic window</b>. No clock sets it — wire length does. Build the loop.`,
      hint: 'PS stems face the CB. Control + enters the left PS’s + branch → stem → K1. Token − : stem → − branch → the long loop → right PS’s − branch → stem → K2. The recovered + leaves stem → + branch → C OUT.',
      success: 'Open… and shut, all by itself, after exactly one loop-time. You built an asynchronous timer out of pure geometry. The window is open — next, we sneak data through it.',
      notebook: ['token'],
      fixed: [
        el('cb', 'CB', 11, 6, 0, { state: M }),
        el('L_C', 'LAUNCHER', 1, 8),
        el('D_cout', 'DETECTOR', 20, 10),
      ],
      labels: { L_C: 'C IN', D_cout: 'C OUT', cb: 'CB' },
      palette: { PS: 2 },
      cases: [
        { name: 'round trip', inputs: [{ launcher: 'L_C', pol: P }], expect: { D_cout: [P] }, finalStates: { cb: M } },
        { name: 'twice around', inputs: [{ launcher: 'L_C', pol: P }, { launcher: 'L_C', pol: P, dt: 14 }], expect: { D_cout: [P, P] }, finalStates: { cb: M } },
      ],
      parElements: 2, parHeat: 8,
    },

    {
      id: 'w4l3', world: 4, n: 3, title: 'The Switch Gate, For Real', size: { w: 22, h: 13 },
      bipolar: true,
      intro: `Everything converges. The <b>asynchronous Ressler–Feynman Switch Gate</b> —
the universal reversible logic element, as actually designed at the lab and taped out
for fabrication.
<br><br>Control rail: your token loop. Data rail: D-IN enters a biased <b>circulator</b>;
if the barrier is open (C arrived), data passes the CB and exits <b>C·D</b>; if shut,
it bounces back through the circulator to <b>C̄·D</b>. The token re-shuts the door
behind itself and the spent control exits C-OUT. AND and NAND from one gate — and the
data fluxon must catch the logic window in flight.
<br><br>Four test schedules. This is the published milestone. Build it.`,
      hint: 'Token loop exactly as before; keep the data paths short and the loop long, so data always beats the token under timing wobble. Circulator: D-IN → A, B → D1; bounced data re-enters B and exits C → C̄·D.',
      success: `That circuit — the one running on your screen — is, give or take a wire,
the design the BARCS team simulated with wide margins and sent to the foundry.
You have rebuilt the actual frontier of reversible computing. One blemish: the biased
PS cells and circulator still smolder. The papers call replacing them "future work."
The future is the next level.`,
      notebook: ['rfsg'],
      fixed: [
        el('cb', 'CB', 11, 6, 0, { state: M }),
        el('L_C', 'LAUNCHER', 1, 8), el('L_D', 'LAUNCHER', 1, 11),
        el('D_cout', 'DETECTOR', 20, 2), el('D_cd', 'DETECTOR', 20, 8), el('D_ncd', 'DETECTOR', 20, 12),
      ],
      labels: { L_C: 'C IN', L_D: 'D IN', D_cout: 'C OUT', D_cd: 'C·D', D_ncd: 'C̄·D', cb: 'CB' },
      palette: { PS: 2, CIRC: 1 },
      cases: [
        { name: 'C=1 D=1', inputs: [{ launcher: 'L_C', pol: P }, { launcher: 'L_D', pol: P }], expect: { D_cout: [P], D_cd: [P], D_ncd: [] }, finalStates: { cb: M } },
        { name: 'C=0 D=1', inputs: [{ launcher: 'L_D', pol: P }], expect: { D_cout: [], D_cd: [], D_ncd: [P] }, finalStates: { cb: M } },
        { name: 'C=1 D=0', inputs: [{ launcher: 'L_C', pol: P }], expect: { D_cout: [P], D_cd: [], D_ncd: [] }, finalStates: { cb: M } },
        { name: 'C=0 D=0', inputs: [], expect: { D_cout: [], D_cd: [], D_ncd: [] }, finalStates: { cb: M } },
      ],
      parElements: 3, parHeat: 8,
    },

    {
      id: 'w4l4', world: 4, n: 4, title: 'Beyond the Paper', size: { w: 22, h: 13 },
      bipolar: true,
      intro: `The 2025 talk ends with a wish list, and at the top: <i>"replace the
polarity separators with some efficient, logically reversible, unpowered element."</i>
Nobody has designed one. Tonight, the lab is yours, and hypotheses are free.
<br><br>On your bench: the <b>rPS</b> — a <span class="conj">CONJECTURAL</span>
separator biased by trapped flux instead of a power supply, the same trick that made
the polarity filter reversible. And the Polarized Rotary you already trust.
<br><br>Same gate. Same four schedules. <b>Zero heat.</b> Step past the edge of the
literature.`,
      hint: 'Swap each PS for an rPS, and the circulator for a Polarized Rotary (+ data circulates clockwise both coming and going). The topology you built last level is already right.',
      success: `Silence in the heat meter. A universal reversible logic gate, end to end,
with nothing burned anywhere — contingent on one circuit nobody has designed yet.
This is what open research feels like: the gap between "works in the model" and
"works in niobium." If you ever design a real rPS — or a zero-heat switch gate
without one — the BARCS bibliography in the Notebook tells you exactly who to write to.`,
      notebook: ['beyond'],
      fixed: [
        el('cb', 'CB', 11, 6, 0, { state: M }),
        el('L_C', 'LAUNCHER', 1, 8), el('L_D', 'LAUNCHER', 1, 11),
        el('D_cout', 'DETECTOR', 20, 2), el('D_cd', 'DETECTOR', 20, 8), el('D_ncd', 'DETECTOR', 20, 12),
      ],
      labels: { L_C: 'C IN', L_D: 'D IN', D_cout: 'C OUT', D_cd: 'C·D', D_ncd: 'C̄·D', cb: 'CB' },
      palette: { RPS: 2, PR3: 2, RM2: 1, NOT: 2 },
      cases: [
        { name: 'C=1 D=1', inputs: [{ launcher: 'L_C', pol: P }, { launcher: 'L_D', pol: P }], expect: { D_cout: [P], D_cd: [P], D_ncd: [] }, finalStates: { cb: M } },
        { name: 'C=0 D=1', inputs: [{ launcher: 'L_D', pol: P }], expect: { D_cout: [], D_cd: [], D_ncd: [P] }, finalStates: { cb: M } },
        { name: 'C=1 D=0', inputs: [{ launcher: 'L_C', pol: P }], expect: { D_cout: [P], D_cd: [], D_ncd: [] }, finalStates: { cb: M } },
        { name: 'C=0 D=0', inputs: [], expect: { D_cout: [], D_cd: [], D_ncd: [] }, finalStates: { cb: M } },
      ],
      parElements: 3, parHeat: 0,
    },

    {
      id: 'w4l5', world: 4, n: 5, title: 'The Boomerang Theorem', size: { w: 22, h: 13 },
      bonus: true,
      bipolar: true,
      intro: `A bonus puzzle for the theoretically brave. Obvious idea: why conjure a
hypothetical rPS when the reversible Polarized Rotary might route the token loop?
<br><br>Try it — the left rotary is wired in for you. Send the control.
<br><br>You’ll find the evicted token comes straight back along the control’s own
path. Always. It’s a theorem: through any network of polarized rotaries and twists,
the token (always opposite in sign to the control, thanks to flux conservation)
exactly <b>retraces the control’s route</b>. Catch the boomerang at TOKEN — you’ll
need one biased circulator on the inbound line to do even that.`,
      hint: 'L → circulator → polarized rotary → K1. The token retraces to the circulator — which, being biased (not polarity-reversible), finally breaks the symmetry and deflects it to TOKEN.',
      success: `So the obvious fix is provably impossible — polarity-reversible routers
alone can never separate the token from the control line. THAT is why the rPS (or
something genuinely new) is required, and why "replace the separators" sits unsolved
in the literature. You’ve just walked the actual argument. Welcome to research.`,
      notebook: ['boomerang'],
      fixed: [
        el('cb', 'CB', 12, 6, 0, { state: M }),
        el('pr', 'PR3', 8, 6, 0, {}),
        el('L_C', 'LAUNCHER', 1, 6),
        el('D_tok', 'DETECTOR', 20, 11),
      ],
      prewires: [
        { a: ['pr', 'C'], b: ['cb', 'K1'], via: [] },
      ],
      labels: { L_C: 'C IN', D_tok: 'TOKEN', cb: 'CB', pr: 'PR' },
      palette: { CIRC: 1 },
      cases: [
        { name: 'throw it', inputs: [{ launcher: 'L_C', pol: P }], expect: { D_tok: [M] }, finalStates: { cb: P } },
      ],
      parElements: 1, parHeat: 2,
    },
  ];

  // ═══════════════════════════════ SANDBOX ════════════════════════════════════
  const SANDBOX = {
    id: 'sandbox', world: 0, n: 0, title: 'Sandbox', size: { w: 26, h: 15 },
    bipolar: true, sandbox: true,
    intro: `Free bench time. Every element — including the conjectural ones — plus
launchers and detectors you can program yourself (select a launcher to choose its
pulse pattern). No goals, no grades; the heat meter and fault rules still apply,
because physics doesn’t take nights off.`,
    fixed: [],
    labels: {},
    palette: {
      LAUNCHER: 6, DETECTOR: 6, REFLECTOR: 8, IREFLECTOR: 4, NOT: 8, ROTARY: 8,
      FD: 4, TCB: 4, TSG: 3, RM1: 4, RM2: 4, BSR: 6, PS: 4, PR3: 6, CIRC: 4,
      PFG: 4, RPS: 4, CB: 3, EXHAUST: 4,
    },
    cases: [],
    parElements: Infinity, parHeat: Infinity,
  };

  // ════════════════════════════ LAB NOTEBOOK ══════════════════════════════════
  const NOTEBOOK = {
    fluxons: {
      title: 'Fluxons',
      body: `Magnetic flux through a superconducting loop is quantized: it comes in
indivisible units of Φ₀ = h/2e ≈ 2.07×10⁻¹⁵ webers. A <b>fluxon</b> is one such
quantum, living as a tiny swirl of supercurrent. On a <i>long Josephson junction</i>
(LJJ) — two superconducting films sandwiching a thin tunnel barrier — a fluxon
becomes a soliton: a self-reinforcing pulse that races along at a good fraction of
the speed of light, holding its shape. Because flux is conserved, fluxons can't
just vanish: they make naturally robust carriers for bits. In this game, every
glowing dot is one fluxon. <i>Refs: ASC'18 paper; Ustinov, Physica D 123 (1998).</i>`,
    },
    ballistic: {
      title: 'Ballistic computing',
      body: `Ordinary chips push every signal with powered gates, burning energy at
each step — like mailing letters by paying a courier per block. <b>Ballistic</b>
computing instead launches the signal once and lets it coast, reusing its own
kinetic energy through every interaction. The dream goes back to Fredkin &amp;
Toffoli's 1982 <i>Billiard-Ball Model</i>: compute with perfectly elastic colliding
balls. The catch: real trajectories and timing can't be infinitely precise, and
direct collisions amplify every tiny error exponentially. The BBM stayed a thought
experiment for forty years for exactly that reason.`,
    },
    rotary: {
      title: 'The Rotary',
      body: `The only nontrivial stateless 3-port reversible device with one pulse
type: each arrival departs by the next port around (ICRC'17). It can't merge lines
(that would be irreversible!) but it converts reflections into forward progress —
which is why you'll wire one next to nearly every bouncing element. Honesty note:
in the bipolar superconducting world, a fully polarity-blind rotary has no known
unbiased JJ implementation; the lab's real chips use a biased "partial rotary"
(see the Circulator). Treat this one as the abstract model's gift.`,
    },
    collision: {
      title: 'Why collisions are forbidden',
      body: `When two moving things interact directly, the outcome depends sensitively
on exactly when and where they meet. Boltzmann knew it: colliding particles are
entropy factories. Any uncertainty in timing gets <i>amplified</i> at each collision —
the dynamical chaos that doomed billiard-ball computing. The BARC rule: pulses may
interact only <b>indirectly</b>, through a device's stored state, arriving one at a
time with clear gaps. Then timing wobble passes through harmlessly instead of
compounding. The game's collision fault isn't a game rule — it's the physics the
whole architecture exists to avoid. Scale check: at roughly c/30, a fluxon
crosses a 100 µm interconnect in ~10 ps — the picosecond gaps the fault
messages quote are true to the real hardware. <i>Ref: ICRC'17, §II.</i>`,
    },
    asynchrony: {
      title: 'Order, not timing',
      body: `A BARC device's behavior may depend on the <b>order</b> in which pulses
arrive — never on the precise times. That single design rule removes the need for a
global clock (a huge overhead in conventional superconducting logic) and stops
timing uncertainty from snowballing: it accumulates linearly, not exponentially, so
only occasional re-synchronization is needed. The Certify button is this principle
weaponized: it re-runs your circuit under randomized (order-preserving) timing.
If your design secretly relied on a coincidence, Certify will find out.`,
    },
    state: {
      title: 'State: the price of telling pulses apart',
      body: `Since pulses arrive one at a time and devices rest in between, two pulses
can only "interact" if the first one <i>leaves a note</i> for the second — a stored,
stable internal state. That's a theorem about the model, not a preference: stateless
reversible devices are fixed permutations of their ports, treating every pulse
identically. The Flipping Diode is the minimal note-leaver; everything richer —
switches, memory, logic — is built on the same move.`,
    },
    mealy: {
      title: 'Devices = reversible Mealy machines',
      body: `Formally, every BARC element is a finite-state <b>Mealy machine</b>: a
transition function f(input port &amp; pulse type, state) → (new state, output port
&amp; pulse type), applied once per arriving pulse — with one extra demand:
f must be <b>injective</b> (one-to-one), so distinct situations never merge. Merging
would erase information, and erasure costs energy (see Landauer's principle).
Every element in this game satisfies exactly that condition — you can check the
tables yourself in the in-game inspector. <i>Ref: ICRC'17, §II.13.</i>`,
    },
    tcb: {
      title: 'The Toggle Barrier (TCB)',
      body: `Among all 2-state, 3-port reversible single-pulse-type devices, the TCB
is one of only two with time symmetry plus a symmetric data channel (ICRC'17). The
control port toggles between <i>conducting</i> and <i>blocking</i>; the side channel
obeys the current setting. Its claim to fame: {Rotary, TCB} is a computationally
<b>universal</b> set — with enough of these two trinkets you can build any computer.
The rest of World 2 is that proof, played by hand.`,
    },
    tsg: {
      title: 'The Toggling Switch Gate',
      body: `A TCB with a rotary on each side, packaged: control pulses toggle it
between routing data "up" and "down" (and spent controls exit on their own line —
nothing is swallowed). Feynman studied switch gates in his quantum computing
lectures and showed they're universal. The toggling, asynchronous version is the
ICRC'17 paper's Fig. 7. Notice what makes it tick: the control's effect lives on
in device state, so control and data needn't coincide — they only need to arrive
in the right order.`,
    },
    merge: {
      title: 'Merging is a privilege, not a right',
      body: `Two wires flowing into one junction: in conventional electronics, trivial.
Here, provably impossible without state — a stateless merge would map two distinct
inputs to one output, destroying one bit of "which way did it come?" information.
The reversible workaround: a switch gate driven by control pulses that arrive in a
deliberate order, so the gate always knows which lane is live. When reversible-logic
diagrams show innocent Y-shaped wire merges, this machinery is what they're hiding
(ICRC'17, Fig. 8). Information must be paid for, even routing information.`,
    },
    copying: {
      title: 'Copying without erasing',
      body: `You can't split a fluxon, and reversibility forbids overwriting. So a copy
is made by <i>recruitment</i>: a constant pulse (a "1" from the power supply, the
reversible world's only consumable) is routed by the original's stored imprint, then
the imprint is undone by the copy itself looping back — leaving the machinery
exactly as found (ICRC'17, Fig. 9). When the original is absent, the constant exits
the other way, computing ¬X for free. Fan-out, NOT, and self-cleanup, one circuit.`,
    },
    and: {
      title: 'AND, reversibly',
      body: `Feed A to a switch gate's control and B to its data: the two outputs are
A·B and ¬A·B — together, a reversible decomposition of B by A. Nothing was erased:
from the outputs (plus the recycled A) you could reconstruct the inputs exactly.
The control is then <i>uncomputed</i> by sending A again — Bennett's trick (1973):
compute, copy out the answer, run yourself backwards to clean up. That discipline
is what lets reversible machines skip Landauer's tax.`,
    },
    universality: {
      title: 'Universality (the punchline of 2017)',
      body: `AND + NOT + fan-out + routing = any Boolean function = any computer.
That's what you just built from two primitive device types, no clock, no power rail,
every step reversible. The ICRC'17 paper's universality proof is exactly your World 2
toolchain. From here on, the question stops being "can asynchronous ballistic
reversible logic compute?" and becomes "can we build it in actual superconductors?"
— which is Worlds 3 and 4, and most of a decade of lab work.`,
    },
    polarity: {
      title: 'Polarity: the free bit',
      body: `Superconducting fluxons carry a sign — flux up or flux down, fluxon or
antifluxon — and it costs nothing to use it as data. The BARCS classification work
(ICRC'22) catalogued every possible reversible element for these bipolar pulses
with up to 3 ports and 2 states, under the real physical constraints: flux
conservation and <b>flux-negation symmetry</b> (flip every sign in the universe and
the circuit must behave identically, unless it hides trapped flux). Every bipolar
element in this game comes from that catalogue.`,
    },
    superconductors: {
      title: 'Why superconductors?',
      body: `Zero resistance means a current, once started, flows forever — the only
electrical medium where "ballistic" isn't a metaphor. Add the Josephson junction
(a quantum valve between superconductors), and you get: natural quantization of
information (flux quanta), natural storage (persistent currents in loops), natural
transmission lines (LJJs), and operating temperatures where thermal noise is tiny.
The price: 4 kelvin, and engineering at the edge of what's fabricable. <i>Refs:
ASC'18; the BARCS program overview, ICRC'22.</i>`,
    },
    rmcell: {
      title: 'The Reversible Memory cell (a real chip)',
      body: `The first BARCS element to make it all the way: conceived in 2018,
JJ-circuit-designed and simulated in 2019 (ISEC'19) with energy loss per operation
far below the fluxon's own energy, fabricated on a test chip in 2020, and granted
US Patent 11,289,156 in 2022. The mechanic you just used — match bounces, mismatch
swaps, visitor exits where it entered — is its exact digital behavior. Storage with
no standby power and no erasure: the bit you evict leaves intact.`,
    },
    bsr: {
      title: 'The Ballistic Shift Register',
      body: `Discovered by collaborators Osborn &amp; Wustmann (arXiv:2201.12999):
like an RM cell, but the visitor passes <i>through</i>, leaving its polarity behind
and carrying away what was stored. Chain them and a data word streams through in
order — a clockless, powerless FIFO. Together with the RM cell it shows a design
space, not just a trick: the ICRC'22 classification found dozens of distinct
reversible behaviors waiting for circuits to embody them.`,
    },
    ps: {
      title: 'The Polarity Separator (and its bias bill)',
      body: `A real, simulated circuit (ASC'22): three ports around a loop, with DC
bias currents that deflect + one way and − the other (the Magnus force on a vortex,
if you like). It made the lab's test rigs possible. But each routing event draws
work from the bias supply — measured in simulation at roughly a tenth of the
fluxon's rest energy — and a biased element isn't time-reversal honest: run it
backwards and the bias pushes the wrong way. In this game every PS/PFG/Circulator
operation shows you that cost as sparks.`,
    },
    landauer: {
      title: "Landauer's principle",
      body: `Erasing one bit of information unavoidably converts at least kT·ln2 of
useful energy into heat (Landauer, 1961) — at room temperature about 3×10⁻²¹ J,
and today's transistors burn tens of thousands of times that per operation. The
loophole (Bennett, 1973): computation doesn't <i>require</i> erasure. A reversible
computer shuffles information without ever merging two states into one, so the
Landauer tax never comes due. That loophole is the economic reason this entire
research field — and this game — exists.`,
    },
    pr3: {
      title: 'The Polarized Rotary (theory ahead of hardware)',
      body: `+ steps clockwise, − steps counter-clockwise: reversible, unpowered,
and exactly what you want for splitting streams by sign. The catch: plain
flux-negation symmetry forbids it — flip all signs and a clockwise router must
become a counter-clockwise one, i.e., a <i>different</i> circuit. To exist, it must
break the symmetry with permanently trapped flux, like the reversible polarity
filter does. The BARC memo (2024) lists it as a prime target; no verified JJ design
exists yet. In this game it works perfectly — consider that a challenge.`,
    },
    comparator: {
      title: 'Reading by asking',
      body: `The probe trick: store the unknown X, then send a known +. The answer
comes back as the probe itself — unchanged if it matched, swapped if it didn't —
and the act of asking resets the cell. Query, answer, and cleanup in one reversible
exchange. This pattern (interrogate state with a known pulse, route the reply by
polarity) is the bipolar world's version of an if-statement, and you'll find it
hiding inside the Controlled Barrier's operation in World 4.`,
    },
    erasure: {
      title: 'Erasure vs. decomputation',
      body: `Dumping a pulse into a damped termination destroys, physically and
informationally, everything it was — paid in heat. The reversible alternative is to
route unwanted intermediate results <i>back</i>, intact, to whoever can uncompute
them (Bennett's garbage-collection discipline). Real BARCS test circuits do use
exhausts — pragmatism has its place on a lab bench — but every exhaust in a design
is a little flag reading "this part isn't reversible yet." The game's third star
enforces the discipline.`,
    },
    cb: {
      title: 'The Controlled Barrier (the universal element)',
      body: `The capstone result (JJ Workshop 2025; paper in draft): inductively
couple a 2-port RM cell to a reversible polarity filter and you get a 4-port,
2-state element that is simultaneously memory (control rail) and conditional
routing (data rail) — with the stored fluxon itself acting as the barrier. It's
fully reversible, needs no bias, simulated with wide margins, and laid out for
fabrication in a real foundry process. One element, universal computation. The
concept is due to Steve Kaplan; the cell is the heart of the asynchronous RFSG.`,
    },
    token: {
      title: 'The token loop & the logic window',
      body: `The self-resetting trick at the heart of the published switch gate:
opening the barrier evicts a token whose journey around a long loop and back
re-closes it. While the token flies, the gate is open — a <b>logic window</b> whose
duration is set by transmission-line length (90 ps and 360 µm, in the real design),
not by any clock. Data must transit during the window: a timing constraint, but a
<i>one-sided, forgiving</i> one (make the loop generously long), which is exactly
the kind asynchronous design tolerates.`,
    },
    rfsg: {
      title: 'The Ressler–Feynman Switch Gate, asynchronously',
      body: `Proposed independently by Ressler (1981) and Feynman as the universal
reversible primitive: control routes data, control survives. The BARCS realization —
two PS cells, a circulator, and the CB — was simulated end-to-end with ample
margins and taped out on a 5 mm chip at MIT Lincoln Laboratory's foundry (2025-26).
It is, as far as the team knows, the first concrete, fully ballistic physical design
for the gate ever produced: the answer to whether Fredkin &amp; Toffoli's dream
survives contact with real physics. Caveat in the talk's own words: the biased
separators "should be replaced by something reversible" — future work.`,
    },
    beyond: {
      title: 'Where the published trail ends',
      body: `The zero-heat switch gate you (perhaps) just built relies on the rPS —
a separator biased by trapped flux, plausible by analogy to the reversible polarity
filter but <b>not yet designed</b>. That's the actual open frontier: find a
reversible, unpowered element that can split a token from a control line, or prove
some clever topology makes one unnecessary. The Boomerang Theorem (bonus level)
shows the obvious candidates can't work. If you crack it, that's not a game
achievement — that's a publishable result. The bibliography below is your
correspondence list.`,
    },
    boomerang: {
      title: 'The Boomerang Theorem',
      body: `Claim: through any network of polarized rotaries and twists, the token
evicted by a control pulse exits exactly back along the control's own path.
Sketch: flux conservation makes the token's polarity opposite the control's at
every point of the shared path (twists flip both alike). At each polarized rotary,
"next port clockwise for +" and "next port counter-clockwise for −" are inverse
permutations — so the token's exit is precisely the control's entrance, junction by
junction, all the way home. To peel the token off the control line you need an
element whose routing <i>breaks</i> that inverse-pairing: trapped flux, bias, or a
genuinely new idea. Quod erat frustrandum.`,
    },
    refs: {
      title: 'The real papers (go read them!)',
      body: `<b>The BARCS program</b> · M.P. Frank, Sandia National Laboratories, 2016–2026.<br>
• "Asynchronous Ballistic Reversible Computing," IEEE ICRC 2017 — the abstract model &amp; universality.<br>
• "Asynchronous Ballistic Reversible Fluxon Logic," IEEE Trans. Appl. Supercond. 2019 — fluxons as pulses.<br>
• "Semi-Automated Design of Functional Elements…," ISEC 2019 — the RM cell circuit.<br>
• US Patent 11,289,156 (2022) — the Ballistic Reversible Superconducting Memory Element.<br>
• Lewis &amp; Frank, "Two Circuits for Directing and Controlling Ballistic Fluxons," IEEE TAS 2023 — PFG &amp; PS.<br>
• Frank &amp; Lewis, "BARCS in Superconducting Circuits," IEEE ICRC 2022 — the element classification.<br>
• Frank, Lewis &amp; Kaplan, "First-Principles Derivation of Fluxon Viscosity…," ASC 2024.<br>
• Frank &amp; Kaplan, "A Universal Circuit Element for BARCS," JJ Workshop 2025 — the CB cell &amp; asynchronous RFSG.<br>
• Osborn &amp; Wustmann, arXiv:2201.12999 — Ballistic Shift Registers.<br>
<b>Foundations</b> · Landauer 1961 · Bennett 1973 · Fredkin &amp; Toffoli 1982 ·
Ressler 1981 · Feynman 1986.<br><br>
<i>This game idealizes: no fluxon viscosity, perfect device reliability, and a few
abstract elements (Rotary, TCB, PR3, rPS) that real niobium hasn't caught up with
yet. Everything else — the RM cell, BSR, PS, PFG, circulator, CB, and the RFSG —
follows the published designs' digital behavior.</i>`,
    },
  };

  F.LEVELS = LEVELS;
  F.SANDBOX = SANDBOX;
  F.NOTEBOOK = NOTEBOOK;
})();

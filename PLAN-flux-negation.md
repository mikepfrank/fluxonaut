# Plan: negative-fluxon behavior of the game's "unipolar" elements

**Status: planning only — TABLED by Michael (2026-10-22; considerations added 2026-10-24 and
2026-10-25).**
No game code has changed. This document collects the issue, the options, derived definitions,
display and iconography ideas, the teaching text, and an implementation checklist, so the work
can start cleanly when Michael picks it up. Short pointers live in `TODO.md`, `HANDOFF.md` and
`CLAUDE.md`; the research-side record is `../research/WORKLOG.md` (2026-10-22).

## 1. The issue

**The game's convention.** The Flipping Diode (FD), Toggle Barrier (TCB), switch-gate chip (TSG),
the Duplicator chips (DUP, RDUP) that package a switch-gate circuit, and the aspirational STS and
UTR come from the
2017 ABRC model, where pulses had no polarity. The game presents them that way: Worlds 1–2 never
show a polarity, the 🔍 inspector shows their positive-fluxon table only (no polarity column)
before World 3 (`ui.js` ~line 289), and pulses are drawn in a neutral color except in levels
flagged `bipolar`. In code, all of them are **polarity-blind**: a negative fluxon routes exactly
like a positive one in the same state.

**The BARCS convention.** The `barc` classifier (github.com/sandialabs/barcs: `src/barc.py`
lines 77–87 and 252–253, `src/symmetryTransform.py`) and the ICRC ’22 paper assume flux-negation
symmetry F, and for elements whose two states carry no net flux, F also **exchanges the two
states**: for every transition `(+, port p, state s) → (+, q, s')` there must be
`(−, p, S(s)) → (−, q, S(s'))`. ICRC ’22 states this as an initial assumption about how states are
encoded ("we initially assume that the state encoding is such that a flux negation transformation
includes performing a state exchange"), says implementable BARCS devices appear to need F unless
it is explicitly broken (e.g. by trapped flux), and its Fig. 5 names the two variants: a
*Polarized* Controlled Flipping Diode "differs from regular unpolarized CFD behavior just in that
the role of the two states is interchanged for negatively-polarized fluxons." The game's elements
are the *unpolarized* variants, so as complete two-polarity devices they are not in barc's
catalog; only their positive-fluxon halves are.

**Audit** (`node test/audit-flux-negation.mjs`; catalog matches by
`../research/atlas/_game_elements_vs_barc.mjs` and a 2-port lookup on barc's `RESULTS.txt`):

| Element | States | Positive-fluxon half in barc's catalog | Used in |
|---|---|---|---|
| FD | fwd / rev | 2-port neutral group #2 (2 functions) | w1l4, w1l5, sandbox |
| TCB | closed / open | 3-port neutral class 15 = memo #3a PTCB | w2l1, w4l7, sandbox |
| TSG (chip) | up / down | 5-port composite (TCB + rotaries); not in the 3-port catalog | w2l2–w2l6, sandbox |
| DUP, RDUP (chips) | UU / DU / DD / UD | package w2l4's switch-gate circuit; partial; not in the catalog | w2l6, sandbox |
| STS | U / D | class 31 = memo #3d PTSB | w4l7, sandbox |
| UTR | cw / ccw | class 43 = memo #1 PNTR | w4l7, sandbox |

The two-state elements with flux-polarized states (RM1, RM2, BSR, RPF, CB) already obey F (the
rPF models its trapped flux as a ±1 state, which F flips). Stateless polarity-blind elements
(Rotary, Reflector, Inverting Reflector, NOT, Crossover) obey it trivially; the stateless
polarity-dependent ones (PS, PFG, PR3, rPS) break it on purpose, each standing for a hidden bias
(a power supply or trapped flux); CIRC is defined for + fluxons only. **Every level that uses the elements in the table launches positive
fluxons only**, so any change below alters behavior only in the sandbox.

## 2. Physical motivation (the core of the teaching text)

With no DC bias current and no trapped flux, a superconducting circuit's equations are odd in the
phase: Josephson currents go as sin φ, inductor currents as φ/L. So flipping the sign of every
current and every flux turns any possible motion of the circuit into another possible motion. A
fluxon becomes an antifluxon, and every stored flux flips too. A two-state element whose states
carry no net flux can store its bit as, say, a fluxon in one internal loop and an antifluxon in
the other; the two states differ by which loop holds which, so flipping every sign *exchanges*
them. Consequence: **an antifluxon meets the element exactly as a fluxon would meet it in its
other state** — same routing, with the states' roles exchanged. Breaking this symmetry takes a
hidden bias: trapped flux (the game's reversible filter rPF and conjectural separator rPS) or a
power supply (the biased PS and PFG). Michael is the authority on this framing; the wording above
is a draft for his review.

## 3. Options for negative-fluxon inputs

- **A. Undefined.** Declare these elements defined for + fluxons only and stop the run with an
  error when a − fluxon arrives. The engine already faults when a transition returns `null`
  (`engine.js` ~line 373, kind `'undefined'`; used today by the partial CIRC/DUP/RDUP); the message
  ("…this should never happen") would need wording such as "the Toggle Barrier is a single-polarity
  device: its response to a − fluxon is not defined". Honest to the 2017 model, minimal code, but
  sandbox players lose the chance to explore.
- **B. Complete the definitions by F** (Michael's preference, 2026-10-24). Define each element's
  − behavior by the rule in §1, so every element is consistent with barc's catalog and the
  sandbox works with both polarities.
- **C. B, plus display rules** so single-polarity levels look exactly as they do now (§5).
- **D. Per element: keep some deliberately *not* flux-negation symmetric** (Michael's observation,
  2026-10-25 — an option, not a decision). Extend an element to − inputs polarity-blind (or in any
  other non-F-symmetric way) and say so in the game's teaching text. Such an element is not in
  barc's catalog, and building it would need something the flux-negation transformation (acting
  on the I/O fluxons and the dynamic stored states) does not flip: trapped flux or a constant
  bias. For some declared semantics this is the point. The **UTR's name declares exactly the
  polarity-blind semantics** ("unconditional": the same rotation sense for either polarity), and
  its flux-negation-symmetric twin already has a name, the memo's **PNTR**.
  - *Why trapped flux or bias is then unavoidable, within barc's two-state framework.* These
    elements toggle without changing the fluxon's polarity, so by flux conservation their states
    hold no net flux. Exact flux-negation symmetry must map each state to a state. Leaving both
    states unchanged would make each equal to its own negative (no flux in any loop), and two
    such states could not be told apart, so the symmetry must exchange them: barc's convention.
    A polarity-blind version therefore needs the symmetry broken. (Reasoning for Michael to
    confirm.)
  - *Precedent in the game.* PS, PFG, PR3 and rPS already break flux-negation symmetry on purpose,
    each standing for a hidden power supply or trapped flux; a polarity-blind UTR (already
    aspirational) would join them.
  - *Naming rule from the memo and ICRC '22.* "Polarized X" is the symmetric twin and plain "X"
    the polarity-blind one (PCFD vs "unpolarized CFD"; PNTR vs UTR; PTCB vs TCB; PTSB vs STS). The
    sandbox could eventually offer both versions of an element.
  - *Pedagogy rule.* Point it out wherever such an element is first referenced after polarity is
    introduced (World 3 on). For the UTR that is w4l7 (World 4, positive-only), via the
    `threeports` page or the inspector caption, plus the sandbox.

Recommendation: **C** for elements whose declared meaning is about routing and state (FD, TCB,
TSG, DUP/RDUP, STS), with **D available element by element** where the declared semantics
are polarity-independent by design (the UTR is the clear candidate). Polarity cues are shown only
where a − fluxon can occur.

## 4. Derived definitions under F (option B)

Implement once, generically: write each element's transition for + fluxons only and derive the −
branch from it, so the two can never drift apart —

```js
// f(−, p, s) = (−, q, S(s'))  where  f(+, p, S(s)) = (+, q, s')
function fluxNegationSymmetric(posTransition, states) {
  const S = (s) => (s === states[0] ? states[1] : states[0]);
  return (port, pol, state, cfg) => {
    if (pol === 1) return posTransition(port, state, cfg);
    const r = posTransition(port, S(state), cfg);
    return r && { ...r, pol: -1, state: S(r.state) };
  };
}
```

(DUP/RDUP have four states; their S is the bitwise flip UU↔DD, DU↔UD, and their partiality
must be preserved: an undefined + arrival stays undefined for −.)

What a − fluxon does, element by element:

| Element | + fluxon (unchanged) | − fluxon under F |
|---|---|---|
| FD | in `fwd` passes A→B and flips; B reflects | sees the diode reversed: in `fwd` passes B→A and flips; A reflects |
| TCB | C reflects + toggles; `open`: A↔B pass; `closed`: A, B reflect | C reflects + toggles; A↔B pass when `closed`, reflect when `open` |
| TSG | Ci→Co toggles; Co→Ci; I→ the state's arm; that arm →I; the other arm reflects | control path the same; I→ the *other* arm, that arm →I, the state's arm reflects |
| STS | from S exits the arm naming the state; that arm →S; the other reflects; always toggles | from S exits the arm naming the *other* state; that arm →S; the state's arm reflects; always toggles |
| UTR | rotates in the state's sense, then reverses | rotates in the *opposite* sense, then reverses |
| DUP, RDUP | (chip behavior) | per the 4-state rule above |

Patterns worth teaching: under F the TCB's data channel passes **exactly one polarity in each
state** (+ when open, − when closed), so in each state it is an rPF set to one polarity, with C
toggling which; and in each state the STS routes exactly like an rPS whose "+" arm is the port the
state names. These neutral elements act like the trapped-flux polarity devices, with the internal
state standing in for the trapped bias, and they need no trapped flux at all, because F swaps the
state.

## 5. Display: inspector, pulses, icons

**Where to show polarity.** Today two different tests decide this: the inspector shows polarity
when `sandbox || world >= 3`, while pulses get polarity colors only when `level.bipolar`. They
disagree in w4l7 (World 4, positive-only): its inspector shows + and − rows while its pulses are
neutral-colored. Proposal: one test, "can a − fluxon occur here?" (`level.bipolar || sandbox`),
governing the inspector's polarity column and − rows, pulse colors, and the − cues on icons.
Worlds 1–2 and the positive-only capstone then keep today's look, preserving the original
convention for unipolar devices. (Michael's call.)

**Iconography.** One principle, already used by the separators (PS/rPS arm colors), PR3 (cyan +
arc, orange − arc) and rPF (its barrier drawn in the color of the polarity it passes): *draw each state-dependent route in
the color of the polarity that takes it* — `COL.plus` cyan, `COL.minus` orange — with a small
+/− glyph, and swap the colors when the state toggles. Per element, in bipolar contexts:

| Element | Today | With − cues |
|---|---|---|
| STS | solid live path S–(state arm), dashed "reflect" arm | "+" arm cyan, "−" arm orange (rPS idiom); no dashed arm, since for a − fluxon it is the live path |
| UTR | bold arc = current sense, faint dashed arc = the sense it toggles to | bold arc cyan = + sense now, faint arc orange = − sense now (PR3 idiom); still reads as "the sense it toggles to" |
| TCB | open / closed barrier | A–B channel drawn in the color of the polarity it passes now (cyan open, orange closed) + glyph (rPF idiom) |
| FD | one-way arrow | cyan arrow in the + direction, small orange arrow in the − direction (opposite), swapping on each flip |
| TSG | state-colored arm swings to U or D | + route arm cyan, − route arm orange |
| DUP, RDUP | (chip symbols) | follow the TSG |

Next step before deciding: canvas mockups of each symbol in both states, in bipolar and
single-polarity contexts.

## 6. Teaching text

Where it could go (any combination):
1. Extend the **"Polarity: the free bit"** notebook page (World 3, level 1), which already states
   flux-negation symmetry in general, with a paragraph on two-state elements.
2. A new notebook page (working title "Mirror-image fluxons"), attached where these elements first
   meet − fluxons. Today that is only the sandbox, so attach it to w3l1 and the sandbox notebook.
3. In bipolar contexts, an inspector caption for these elements: "− fluxons: the states' roles
   are exchanged (flux-negation symmetry)".
4. Element blurbs (the STS blurb's "one of the 45 open flux-neutral (3,2) behaviors" would become
   "barc class 31, the memo's PTSB"; similarly UTR → class 43 PNTR, TCB → class 15 PTCB).
5. For any element kept non-flux-negation-symmetric (option D): a note, at its first appearance
   after polarity is introduced, that it breaks flux-negation symmetry and so would need trapped
   flux or a bias to build, and where relevant that its symmetric twin is in the catalog. Draft:

   > **Not mirror-symmetric.** This element treats fluxons and antifluxons alike. That breaks
   > flux-negation symmetry, so no circuit without a hidden bias (trapped flux or a bias current)
   > can behave this way. Its mirror-respecting twin, the memo's PNTR, is in the BARCS catalog.

Draft paragraph (for Michael's review):

> **Mirror-image fluxons.** With no bias current and no trapped flux, a superconducting circuit
> can't tell "up" from "down": flip the sign of every current and every flux, and each possible
> motion becomes another possible motion. A two-state device whose states carry no net flux —
> say, a fluxon in one internal loop and an antifluxon in the other — has its two states
> *exchanged* by that flip. So an antifluxon meets the device exactly as a fluxon would meet it in
> its other state. The Toggle Barrier, for instance, opens to fluxons in one state and to
> antifluxons in the other. Breaking the symmetry takes a hidden bias: trapped flux (like the
> reversible filter) or a power supply (like the biased separator).

## 7. Implementation checklist (when un-tabled)

- `js/elements.js`: the generic helper (§4); FD, TCB, TSG, STS, UTR via the helper; DUP/RDUP with
  the 4-state flip, preserving partiality. (Option A instead: return `null` for − arrivals and
  reword the engine's `'undefined'` fault.)
- `test/run-tests.mjs`: full two-polarity tables for these elements, and a generic assertion that
  every two-state flux-neutral element obeys F (promote `test/audit-flux-negation.mjs` into the
  suite). Today's checks cover only + fluxons.
- `js/ui.js`: the single polarity-display test (§5); inspector caption.
- `js/render.js`: icons per §5, gated on the bipolar/sandbox test.
- `js/levels.js`: blurbs; the polarity page or a new notebook page (§6); the `threeports` page if
  its wording assumes polarity-blindness.
- References are unaffected (all positive-only) — confirm with the suites; re-render
  `sols/*.png` if icons change.
- Docs: `CLAUDE.md` element notes, `HANDOFF.md`, `TODO.md`; research side, notes on atlas classes
  15, 31 and 43 (and 2-port group #2) naming the game's elements as their twins — the public
  atlas pages only when Michael decides.
- Manual check in the sandbox: launch − fluxons into each element in each state, and compare
  with the inspector.

## 8. Decisions for Michael

1. Option A, B, C or D (§3), possibly differing per element. Leaning: C, with D for the UTR.
2. Scope: which elements get the symmetric definitions (all five plus DUP/RDUP, or a subset),
   and which, if any, stay deliberately non-symmetric with a note.
3. Polarity-display test (§5): unify on "bipolar level or sandbox"?
4. Icons: approve the principle; review mockups.
5. Teaching text: where (§6) and wording (draft above).
6. Names: under option D the UTR keeps its name, which already declares its polarity-blind
   semantics; under B/C its symmetric version is the memo's PNTR, so it would be renamed (or both
   offered). The same "Polarized X" rule could name any other symmetric twins.

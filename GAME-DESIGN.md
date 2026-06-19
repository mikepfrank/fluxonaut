# FLUXONAUT — Game Design Document

*A single-player browser puzzle game teaching the principles of
Ballistic Asynchronous Reversible Computing in Superconductors (BARCS).*

Design + implementation: Claude (Anthropic), with direction from Michael P. Frank.
Based on the Sandia BARCS research program (2016–2026); see Bibliography.

---

## 1. Premise & tone

You are a **fluxonaut** — a new researcher in a cryogenic lab, learning to
herd single quanta of magnetic flux through superconducting circuits.
Dark "inside the cryostat" aesthetic; glowing pulses on glowing tracks.
Audience: curious general public. All physics is introduced through play,
with an in-game **Lab Notebook** that unlocks deeper entries (with citations
to the real papers) as concepts appear.

## 2. What the game simulates (and what it doesn't)

The simulation operates at the *abstract network level* of the ABRC model
(Frank, ICRC 2017), **not** at the SPICE/JJ-circuit level:

- A circuit is a network of **elements** with named **ports**, joined by
  **non-branching, bidirectional wires** (flavor: LJJ transmission lines).
- **Pulses** (fluxons) travel along wires at a **constant, finite speed**,
  losslessly (idealized: no viscosity, no dispersion).
- When a pulse reaches a port, the element applies its **transition function**
  `(port, polarity, state) → (state′, port′, polarity′)` instantaneously and
  deterministically (100 % reliable). One pulse in → exactly one pulse out
  (except explicitly irreversible absorbers).
- Elements are **quiescent** between arrivals; all interaction between pulses
  is mediated by element state — never direct.

### Rules the player must respect (enforced by the engine, each one a teaching beat)

1. **No overlapping arrivals.** Two pulses reaching the same element within a
   minimum gap δ ⇒ *asynchrony fault* (chaotic-instability animation, run fails).
2. **No head-on wire collisions.** Two pulses meeting on one wire ⇒ *billiard-ball
   fault* (the very failure mode BARC was invented to avoid).
3. **Order, not timing.** The *Certify* button re-runs every test case several
   times with randomized (order-preserving) input timings. Solutions must rely
   only on order of arrival — the central BARC asynchrony principle.
4. **Reversibility is the prize.** Irreversible events emit visible **waste heat**
   (sparks + counter, flavor *kT ln 2*). Four per-level stars: ★ solve ·
   ★★ proper build · ★★★ within heat par · ★★★★ planar (no wire crossings); a used
   hint docks one. Heat sources: dumping a pulse into an exhaust / back into a
   launcher; the **circulator** (a biased partial rotary) on *every* pass; and the
   biased **PS / PFG** only when they *pump* a fluxon through to a different port — a
   fluxon they merely reflect off a matching arm recoils elastically, for free.
   (These biased elements draw on an external bias supply, exactly as in the real
   circuits.)

## 3. Element roster

All transition tables are injective (logically reversible) unless noted.
"Badge" indicates the in-game reversibility badge; "Status" is the honest
real-world implementation status shown in the Notebook.

| Element | Ports | State | Behavior | Badge / Status |
|---|---|---|---|---|
| Reflector (PR) | 1 | – | bounce back | ↺ / trivial (shorted line end) |
| Inverting Reflector | 1 | – | bounce, flip polarity | ↺ / trivial (open line end) |
| NOT twist | 2 | – | pass, flip polarity | ↺ / trivial (conductor half-twist) |
| Rotary R (CW/CCW) | 3 | – | cyclic port routing, polarity-blind | ↺ / *unary model device; polarity-blind version is an open implementation question* |
| Flipping Diode FD | 2 | dir | passes in forward dir (flips dir); reflects in reverse | ↺ / theoretical (ICRC'17) |
| Toggling Controlled Barrier TCB | 3 (L,R,C) | open/closed | C: reflect & toggle; L/R: pass if open, reflect if closed | ↺ / theoretical (ICRC'17); universal with R |
| TSG chip | 5 | up/down | toggling switch gate (earned macro of TCB+2R) | ↺ / construction from ICRC'17 Fig. 7 |
| Duplicator DUP (×2) | 6 | 2 bits | data on X (then M, then 1) ⇒ two copies on XX; X absent ⇒ ¬X out. Out-of-order arrivals fault | ↺ (partial) / construction from ICRC'17 (Fig. 9) |
| Reverse Duplicator rDUP | 6 | 2 bits | the duplicator run backward: two X copies (+ M, ¬X) ⇒ one X, regenerating the constant 1 (Bennett uncompute). Out-of-order arrivals fault | ↺ (partial) / construction from ICRC'17 |
| RM cell (1/2-port) | 1–2 | ± | same polarity: reflect; opposite: exchange (exit **same** port) | ↺ / **simulated & fabricated; patented (US 11,289,156)** |
| Ballistic Shift Register BSR | 2 | ± | pass through, swap polarity with state | ↺ / Osborn & Wustmann (arXiv:2201.12999) |
| Polarity Filter PFG | 2 | bias ± | matching polarity pumped through (heat); mismatch reflects (free) | ⚠ heat/pump / **simulated (ASC'22)**, current-biased |
| Polarity Separator PS | 3 (stem,+,−) | – | + exits the + arm, − the − arm from any port; pump to a different port costs heat, a reflection is free; non-injective ⇒ irreversible | ⚠ heat/pump / **simulated (ASC'22)**, current-biased |
| Circulator (partial rotary) | 3 | – | cyclic CW, polarity-blind; never reflects, so every pass is a pump | ⚠ heat/pass / **simulated (JJ'25)**, biased |
| Polarized Rotary PR3 | 3 | – | + steps CW, − steps CCW | ↺ / theoretical (BARC memo '24); needs trapped flux |
| reversible Polarity Filter rPF | 2 | ± barrier | polarity matches the barrier ⇒ accelerate through; mismatch ⇒ recoil/reflect — unbiased, **zero heat** | ↺ / **buildable (JJ'25)**; the CB data rail, no standalone design yet |
| **Controlled Barrier CB** | 4 (C1,C2 / D1,D2) | ± | control rail (C-ports): RM2 rule (reflect / exchange); data rail (D-ports): pass iff pulse polarity = state, else reflect | ↺ / **simulated with margins (JJ'25); the universal element; patented (US 12,620,993)** |
| rPS (reversible PS) | 3 | – | PS table, unbiased | ↺ / **conjectural** — clearly flagged; finale only |
| Exhaust | 1 | – | absorb (damped termination) | ⚠⚠ big heat / standard |
| Launcher / Detector | 1 | – | level I/O (DC/SFQ & SFQ/DC converters) | boundary, heat-free |

F-symmetry note: bipolar stateful elements obey flux-negation symmetry
(negate all pulse polarities and internal states ⇒ same behavior), per ICRC'22.

Player config (Inspector): any placed element can be rotated (R) and mirrored (F);
some carry an extra toggle — rotary direction (CW/CCW), filter/separator bias sign,
and the PS/rPS **bent-arm** selector (which of the +/−/stem arms exits orthogonally —
geometry only, no behavior change).

## 4. Level progression (4 worlds + bonus + sandbox)

**World 1 — Ballistic Bootcamp** (unary pulses)

1. *First Light* — wires, the run button, constant-speed pulses.
2. *Roundabout* — rotaries route cyclically; plan a path.
3. *Tailgaters* — collision & asynchrony faults; design so pulses can never meet.
4. *The One-Way Door* — the Flipping Diode: the simplest device that **remembers**,
   conducting one way, flipping, and reflecting against the grain.
5. *Three Ways* — stateless networks route every pulse identically (a bijection);
   devices are reversible Mealy machines, so giving a network history is what makes logic.

**World 2 — Stateful Logic** (unary; the ICRC'17 universality arc)

6. *Gatekeeper* — the TCB: a control pulse opens the barrier.
7. *The Sorting Office* — the sealed TSG chip: control toggles it, data routes by state (mux/demux).
8. *Merge Lanes* — stateless devices can't merge two lines into one; do it reversibly with state.
9. *The Duplicator* — copy the presence/absence of a pulse.
10. *AND Finally* — single-rail AND/NOT ⇒ **universality**.
11. *Putting It Together* — the full Bennett construction: compute AND, then **uncompute**
    the garbage, leaving one clean copy of the input — universal reversible computing, end to end (boss).

**World 3 — Polarity** (bipolar fluxons; enter the superconductor)

12. *Antifluxon* — ± polarity, the NOT twist, polarity-typed detectors.
13. *Exchange Rate* — the RM memory cell: reflect-or-exchange; final-state goals.
14. *Bucket Brigade* — the BSR shift-register FIFO.
15. *The Sorter* — the PS separates a mixed stream by sign — **first heat** (it pumps).
16. *Cold Sort* — same spec, zero heat, with the PR3. Reversible vs. biased routing.
17. *The Comparator* — RM + PR3: route by match/mismatch (a reversible conditional).
18. *Waste Not* — exhaust vs. decompute-and-recycle; never erase what you can return.
19. *The Bias Bill* — the Polarity Filter, and the honest dissipation rule: a biased
    element is billed only when it **pumps** a fluxon through, never when it reflects.

**World 4 — The Universal Element** (the BARCS endgame)

20. *The Reversible Barrier* — the **rPF**: the reversible, unpowered cousin of the
    biased filter (match passes, mismatch reflects, zero heat) — the CB's data rail.
21. *The Controlled Barrier* — the **CB**: an RM2 control rail fused to an rPF data rail
    (match bounces / mismatch swaps; pass iff match). One element, universal computation.
22. *Round Trip Token* — the self-resetting token loop & the asynchronous logic window.
23. *The Switch Gate, For Real* (boss) — the published asynchronous RFSG: PS + CB +
    circulator ⇒ AND/NAND. Reproduces the 2025 JJ-workshop milestone, heat and all.
24. *Beyond the Paper* — a zero-heat RFSG using the PR3 and the **conjectural** rPS;
    explicitly past the published frontier.

**Bonus** — 25. *The Boomerang Theorem*: try to peel the evicted token off the control
line with reversible rotaries and twists alone — it always retraces. Only a biased
circulator catches it, at a heat cost: a genuine open problem, walked by hand.

**Sandbox** — every element, free build, save/load + JSON export/import.

## 5. Engine

- Continuous-time, **event-driven** core (no fixed logic timestep); rendering
  interpolates pulse positions per frame. Deterministic event ordering.
- Pure-logic modules (`elements.js`, `engine.js`, `levels.js`) are DOM-free and
  unit-tested in Node: every level's reference solution is verified across all
  test cases × multiple jitter seeds; fault rules and reversibility bookkeeping
  are asserted. UI (`render.js`, `ui.js`) is Canvas-2D, no external dependencies.
- Multi-case levels: each case = input sequences + expected per-detector output
  sequences (+ optional required final element states). Cross-detector ordering
  is deliberately *not* checked (asynchronous spirit), except where a level
  teaches exactly that.

## 6. Future editions (out of scope for v1, per project direction)

Fluxon viscosity/losses & signal-restoration stages; stochastic operation;
error margins; JJ-circuit-level design mode; desktop/mobile ports; level editor
sharing; quantum variant.

## 7. Bibliography surfaced in-game

ICRC 2017 (ABRC model & universality) · ASC 2018 (fluxon logic) · ISEC 2019 (RM cell)
· US 11,289,156 (RM patent) · ASC 2022 (PFG/PS) · ICRC 2022 (BARCS classification)
· BARC memo 2024 · ASC 2024 (viscosity) · JJ workshop 2025 & 2026 draft (CB + RFSG)
· US 12,620,993 (CB patent) · Osborn & Wustmann, Phys. Rev. Applied 2023 (BSR)
· Fredkin & Toffoli 1982 · Landauer 1961 · Bennett 1973 · Ressler 1981 · Feynman 1986.
The in-game **References** popup carries full titles, DOIs, and links.

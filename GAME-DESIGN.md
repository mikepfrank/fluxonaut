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
   (sparks + counter, flavor *kT ln 2*). Per-level stars: ★ solve,
   ★★ within element par, ★★★ **zero heat** (fully reversible).
   Heat sources: dumping a pulse into an exhaust / back into a launcher, and
   every operation of a *biased* element (PS, PFG, partial rotary — these are
   powered by external bias, exactly as in the real circuits).

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
| RM cell (1/2-port) | 1–2 | ± | same polarity: reflect; opposite: exchange (exit **same** port) | ↺ / **simulated & fabricated; patented (US 11,289,156)** |
| Ballistic Shift Register BSR | 2 | ± | pass through, swap polarity with state | ↺ / Osborn & Wustmann (arXiv:2201.12999) |
| Polarity Filter PFG | 2 | bias ± | bias-favored polarity forced toward bias dir; else reflect | ⚠ heat/op / **simulated (ASC'22)**, current-biased |
| Polarity Separator PS | 3 (stem,+,−) | – | routes by polarity stem↔matching branch; wrong-polarity at branch reflects | ⚠ heat/op / **simulated (ASC'22)**, current-biased |
| Circulator (partial rotary) | 3 | – | cyclic CW, polarity-blind | ⚠ heat/op / **simulated (JJ'25)**, biased |
| Polarized Rotary PR3 | 3 | – | + steps CW, − steps CCW | ↺ / theoretical (BARC memo '24); needs trapped flux |
| **Controlled Barrier CB** | 4 (K1,K2,D1,D2) | ± | K-ports: RM2 rule (reflect / exchange); D-ports: pass iff pulse polarity = state, else reflect | ↺ / **simulated with margins (JJ'25); the universal element** |
| rPS (reversible PS) | 3 | – | PS table, unbiased | ↺ / **conjectural** — clearly flagged; finale only |
| Exhaust | 1 | – | absorb (damped termination) | ⚠⚠ big heat / standard |
| Launcher / Detector | 1 | – | level I/O (DC/SFQ & SFQ/DC converters) | boundary, heat-free |

F-symmetry note: bipolar stateful elements obey flux-negation symmetry
(negate all pulse polarities and internal states ⇒ same behavior), per ICRC'22.

## 4. Level progression (4 worlds + bonus + sandbox)

**World 1 — Ballistic Bootcamp** (unary pulses)
1. *First Light* — wires, run button, constant-speed pulses.
2. *Roundabout* — rotaries route cyclically; plan a path.
3. *Echo Chamber* — reflection re-routed through a rotary (the core idiom:
   a bounce is a signal, not a failure).
4. *Rush Hour* — collision & asynchrony faults; design so pulses can never meet.
5. *Photo Finish* — jitter demo: cross-path arrival order is **not** reliable;
   only order at a shared device is meaningful.
6. *Tell Them Apart* — stateless networks route every pulse identically
   (bijection!); two Flipping Diodes give pulses a history ⇒ **state**.

**World 2 — Stateful Logic** (unary; the ICRC'17 universality arc)
7. *Gatekeeper* — TCB: a control pulse opens the barrier.
8. *Toggle Time* — second control closes it; route passes & bounces apart.
9. *The Switch Gate* — build the TSG from TCB + 2 rotaries (Fig. 7). Earns the TSG chip.
10. *The Sorting Office* — asynchronous mux/demux from a TSG (Fig. 8).
11. *The Duplicator* — copy presence/absence with TSG + mux + loopback (Fig. 9).
12. *AND Finally* — single-rail AND/NOT (Fig. 11) ⇒ **universality** (boss; 4 test cases).

**World 3 — Polarity** (bipolar fluxons; enter the superconductor)
13. *Antifluxon* — ± polarity, NOT twist, polarity-typed detectors.
14. *Exchange Rate* — RM cell: reflect-or-exchange; final-state goals.
15. *Bucket Brigade* — BSR FIFO chain.
16. *The Sorter* — PS separates a mixed stream — **first heat** (bias supply).
17. *Cold Sort* — same spec, zero heat: PR3. Reversible vs. biased routing.
18. *The Comparator* — RM + PR3: route by match/mismatch (reversible conditional).
19. *Waste Not* — exhaust vs. decompute-and-recycle; never erase what you can return.

**World 4 — The Universal Element** (the BARCS endgame)
20. *Controlled Barrier* — CB semantics: exchange to open/close; pass iff match.
21. *Round Trip Token* — the self-resetting token loop & the asynchronous logic window.
22. *The Switch Gate, For Real* (boss) — the published asynchronous RFSG:
    PS + CB + PS + circulator, 4 test cases (C,D ∈ {0,1}²) ⇒ AND/NAND.
    Reproduces the milestone of the 2025 JJ-workshop talk, heat and all.
23. *Beyond the Paper* (finale) — zero-heat RFSG using PR3 + the **conjectural** rPS.
    Explicitly labeled as stepping past the published frontier; export-design button
    for players who attempt the *truly* open problem (no rPS).

**Bonus** — *The Boomerang Theorem*: try to replace a PS with a PR3; the token
provably retraces the control's path (catch it back at the entrance to win).
Teaches a real no-go argument interactively.

**Sandbox** — all elements, free build, save/load + JSON export/import.

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
· Osborn & Wustmann arXiv:2201.12999 (BSR) · Fredkin & Toffoli 1982 · Landauer 1961
· Bennett 1973 · Feynman 1986 / Ressler 1981.

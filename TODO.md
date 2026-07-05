# FLUXONAUT — TODO (deferred until Michael finishes his full playtest)

Friction items from the 2026-06-11 live playtest (see HANDOFF.md for context).
None are blockers; do not start a new version until playtesting is complete.

## UX friction to address

1. **Palette stays armed after placement.** Clicking empty space places another
   copy instead of deselecting (caused an accidental placement). Consider: disarm
   after one placement, or make empty-space click deselect; keep shift-click (or
   similar) for intentional multi-place. Esc already disarms.

2. **Rotate button acts on the armed palette ghost, not the just-placed element.**
   Confusing — rotating a placed element requires selecting its body first, and the
   body is a small target (easy to hit a port and start a wire instead). Consider:
   after placing, auto-select the placed element; and/or enlarge the body hit area
   relative to port hit areas.

3. **Wire-length timing feedback — per-wire readout DONE (2026-06-22).** Hovering a wire
   now shows its delay (ps) and physical length (µm) — the "minimally a per-wire readout"
   ask. Still open (optional): the fuller inline "how a wire's length sets timing" hint,
   e.g. a live delay annotation shown along the wire while routing.

4. **Fault banner can cover the top row of the board** (e.g. hides the reflector
   in W1-3 Tailgaters). Reposition, auto-fade, or push the board down.

5. **No skip-to-result when iterating.** Long boards take 10–15 s per run at 1×.
   Add a "skip to result" / instant-evaluate affordance (engine already computes
   the full trace up front, so this is playback-only).

## Research side-thread: fluxon conservation topology (started 2026-07-04)

Sparked by a W3·L1 review question (what does the polarity Twist conserve?), a genuine
research thread is now running alongside the game work. Working memo (+ PDF):
`../notes/fluxon-topology-conservation.md` — proposes: polarity = Z₂-holonomy of the
junction ribbon (the memo's per-port ℳᵢ negations = local frame gauge; ℱ = global flip
with covariant trapped flux); general conservation = an integer fluxoid ledger on the
circuit's homology, with the junction-free/junction-crossing cycle distinction made
structural (exact winding theorem vs. cosine-well labels canonical only at quiescence).
Michael reviewed §§1–2 closely (three refinements recorded in the memo, dated 2026-07-04).

**Agreed working mode (supervision protocol):** (1) Michael finishes reviewing the memo
and clears remaining questions; (2) THEN a full LaTeX research proposal gets written
(MiKTeX 25.12 installed; references to be verified via a literature pass — Devoret/Vool
circuit quantization, sine-Gordon on metric graphs, Gulevich–Kusmartsev flux cloning,
phase-slip theory, Möbius-boundary annular LJJs) — intended to be polished enough to
share with Sandia colleagues; (3) only after proposal sign-off does execution start
(first item: the lumped-ladder twisted-conservation theorem + a Node/JoSIM simulation
with an explicit rail transposition; then the Layer-2 dynamics questions, incl. the
RPS open problem as the flagship case, and the 39+45-class behavioral nomenclature
addressing BARC-memo p. 44's "(TO DO)"). Key sources: `../docs/BARC-memo-2024.pdf`
(145 pp., extracted + key pages rendered under `../docs/extracted/`),
`../docs/BARCS-Cell-Library-0v15.pdf`, github.com/sandialabs/barcs (archived).

## Notes

- Console was clean across the whole session; no engine/UI bugs observed.
- Michael is playtesting the 2026-06-20 build (Crossover feature, w2l6 planar
  redesign, 100-seed certify gate, sandbox per-pulse launch timing) before the next
  deploy. He will flag high-priority issues as he goes.

## Element design — revisit the switch-gate (SG/TSG) symbol port ordering (added 2026-06-20)

Michael's observation: the toggling SG chip/block's I/O port ordering **on the symbol**
doesn't match the port ordering of the corresponding circuit (from w2l1). This mismatch is
likely a cause of the wire-crossing difficulties seen across World 2 — re-arranging the
symbol's ports to match the actual circuit could reduce or eliminate the need for crossovers
in other W2 levels (and bears directly on the duplicator-planarity question below).

**BIG JOB — not now.** Moving port positions on the symbol forces a redesign of the
reference solutions for many levels (every level that wires an SG/TSG), plus re-verifying
robustness and regenerating renders. Do not start without a dedicated pass.

**Agreed next major pass + branch policy (Michael, 2026-07-01):** this is the chosen
centerpiece of the next "debt-clearing" pass, because the Duplicator's timing friction is
the #1 stumbling block reported by every play-tester so far (Michael and Colin included),
and the reorder may loosen w2l4's timing and/or shed its crossovers. Do ALL of this work
on a **new branch** (e.g. `sg-port-reorder`) — the change could plausibly make some levels
worse instead of better; merge back to `main` only as a deliberate decision after thorough
play-testing of the branch build.

**DONE on `sg-port-reorder` (2026-07-01) — awaiting Michael's play-test before merge.**
Chip is 2×3, inputs west (Ci top, I mid), outputs east (Co/U/D); all five TSG levels
rebuilt with per-level I/O rejiggers; suite 479+196 green; gallery regenerated; no
reference needs a CROSS anymore. Full details in CLAUDE.md's current-state entry.

**Michael sign-offs still needed (from the pass):**
- **w2l6 schedule change**: CONST `1` now launches `dt: 2.5` late so the final M can
  thread BETWEEN the returning copies with real margin (the old schedule's feasible
  window was ~empty under the 100-seed gate — natural builds failed by ≤0.5 ps). Also
  intro/hint rewrites there (the old "make the SG loop long" advice was half wrong).
- **w2l4's X IN launches from the right edge** (rot 2) — topologically forced in the
  only certifying planar family, and timing-optimal (short X path); old CONST-from-the-
  right precedent. Also the intro/hint rewrites (no forced crossings anymore).
- **parElements for w2l4 (2) and w2l5 (2)**: references now place 0 and 1 elements.
  Tightening to 0/1 makes the build star honest but turns palette-CROSS use into a
  star cost; bundled with the CROSS-introduction decision below.
- **w2l4 RESOLVED (2026-07-02): Michael's flipped-A variant won** and is merged into
  `sg-port-reorder` (his first hand-wiring passed certification immediately). A is mounted
  upside-down (rot2+mir at (11,6)), OUT/NOT-X swapped, ONE crossing bridged by the single
  palette Crossover, CONST launches dt+2; margin 12.9 ps with a balanced ±4u route envelope.
  To revert to the two-crossover v3: the pre-merge state is commit `268db68` (or revert
  `8d15928`). The `sg-port-reorder-w2l4alt` branch label is now redundant and can be deleted.
- **Timing-margin floor: ADOPTED 2026-07-02 at 0.43 u = 6.88 ps.** certify() now tracks
  the min arrival gap across all seeds (engine `res.minGap`, zero extra simulation) and
  run-tests asserts every reference (and alternate) clears the floor. The floor sits a
  whisker under strict 2×MIN_GAP because the legacy trio w1l5/w3l8/w4l1 measures exactly
  0.4392 u (7.03 ps). Note the floor catches *near-fault* references only — the 9.1 ps
  w2l6 squeaker Michael found by play-testing would have passed it; route-slack for
  players comes from generous schedules (measure with scratchpad sg/ margin() + envelope
  probes). **Planned "margin uplift" pass:** retune the eleven sub-3× levels
  (w1l2/3/4/5, w2l1/3, w3l2/6/8, w4l1/2 — mostly the input-dt spacing lever) and raise
  the floor to 3× (0.66 u ≈ 10.5 ps).
- **The Crossover still needs a home in the level sequence** (Michael, 2026-07-01):
  the rebuilt W2 never forces a crossing, but players must learn CROSS exists (and how
  to use it) for Sandbox builds. The ask: find a *simple, natural puzzle design —
  perhaps a new level — that genuinely forces the player to learn the Crossover*. Not
  urgent, and it may emerge naturally in a future world with bigger, more challenging
  puzzles (a level whose port topology is intrinsically non-planar, e.g. a K3,3-ish
  routing or a swap-two-lanes task). Until then w2l4/w2l5 still OFFER CROSS (palette
  unchanged) and their notebook unlocks still include the 'crossover' page, so the
  element remains discoverable.

## Level design — w4l6: also offer the Polarity Separator (PS) on the palette (added 2026-06-21)

Michael's note: the irreversible PS would ALSO break the boomerang in w4l6 — it routes the
ejected − fluxon around the loop by polarity. That's in fact how the real RFSG test chip (the
one taped out) did it: a polarity-blind (unconditional) reversible rotary wasn't implementable,
so they used the PS. Adding `PS` to w4l6's palette (alongside the theoretical unconditional
ROTARY it now uses) would generalize the lesson — the boomerang can be broken
reversibly-but-theoretically (the rotary) OR irreversibly-but-really (the PS, real silicon's
actual choice). Probably also enrich w4l6's intro/success to name the PS as the real-chip path
(they currently cite the dissipative circulator as the irreversible fallback). Not urgent —
when doing it, verify the PS solution certifies + is robust, and regenerate the render.

## Level design — w2l4: loosen the Duplicator's timing constraints (added 2026-06-21)

Play-test 2026-06-21: w2l4 The Duplicator is too timing-touchy under the 100-seed certify gate.
The player has to match the Const-1→A.I and A.D→B.D / B.I→Ci.A wire lengths almost exactly to
pass every fuzzed seed — frustrating trial-and-error. The instant-replay aid (shipped 2026-06-21)
makes the failing seed *watchable*, and dropping a part on a wire now flags it red instead of
silently mis-connecting — but neither loosens the constraint itself.

Refine the level's design to widen the timing margin. **Michael has specific ideas — revisit with
him before changing anything.** One of them (2026-07-01): **spread out the pre-placed elements'
initial positions** so there are more viable wire routings — possibly a large easing on its own,
independent of (and complementary to) the SG port reorder. Play-test notes also flag w2l4 as
"too many new things at once" and "better without crossovers" — the reorder + spreading combo
should be evaluated against both complaints. NOT the right fix: globally loosening the certify jitter (that
weakens every level's robustness guarantee). The fix belongs in this level's layout / element
choice / par counts, keeping the shared 100-seed gate intact.

## Planarity (no-crossing-wires) — RESOLVED (2026-06-20)

Done. The crossing counter was found to under-count: it split each wire at every via/port-
stub vertex, so a crossing landing exactly on one read as two harmless T-touches and was
missed (a visibly-crossed layout could score "planar"). `engine.countCrossings` now
collinear-merges first, and `run-tests` asserts every reference is 0-crossing.
(2026-07-02: second counter gap found in play-test — a wire crossing ITSELF wasn't
counted, since only inter-wire segment pairs were compared. Fixed + regression-tested.) A `CROSS`
(Crossover) element was added; a level that genuinely can't avoid a crossing is handed
exactly enough crossovers. Final state — every reference 0-crossing, robust at the 100-seed
certify gate + all jitter corners + a factor grid:
- **Genuinely planar (no crossover):** every level except w2l4 — updated after the
  sg-port-reorder pass (2026-07-02): the TSG port reorder made w2l5 and w2l6 planar,
  and w2l4's flipped-A redesign reduced it to a single crossing.
- **Need crossovers:** w2l4 The Duplicator (×1).

(The earlier 2026-06-14 audit above — "6 references cross wires" — was wrong twice over: it
used the buggy counter, and it predated the World-4 PS rebuild. Superseded.)

Open *academic* question (not urgent): is the switch-gate duplicator intrinsically non-planar,
or only in its bolted-down layout? Strong evidence it needs ≥1 crossing as currently laid out,
but no proof over all placements. The SG-symbol item above may be the lever that settles it.

### Known honesty gap: DUP/rDUP chip port order vs the flattened circuit (noted 2026-07-02)

The **Dup** and **rDup** chips' port orderings (X/M/1 stacked west, XX/M/¬X east — three
parallel rails) were chosen in a June session (Opus + Michael) so that w2l6 "Putting It
Together" routes with zero crossings. They do **not** — and likely never did — mirror the
port geometry of the actual switch-gate duplicator the player builds in w2l4 (in the current
w2l4, X even enters from the east, while the DUP chip takes X on the west). Consequence:
World 2 as shown **understates the wiring complexity of a fully flattened, non-hierarchical
w2l6** — the chip abstraction quietly absorbs crossings a real single-layer layout would
need. (Contrast the TSG chip, whose ports were deliberately made faithful to its w2l1
construction in the sg-port-reorder pass.)

Not worth fixing now: re-matching the chip ports would reintroduce crossovers in w2l6 and/or
w2l4 to honor a construction that is deliberately over-complicated to begin with — by the end
of World 4 the game reaches a much simpler non-toggling switch-gate construction anyway.
Revisit only if someone attempts a rigorous minimum-crossing proof for the flattened
w2l6-class circuit (which folds into the academic question above). Acknowledged here and in
comments at the DUP/RDUP definitions in `js/elements.js`.

## Reach / distribution ideas (parked 2026-07-01 — circle back after the SG pass)

- **Shareable solution links.** Encode the placed circuit (elements + wires) into the URL
  (e.g. compressed base64 in the fragment) so players can share/compare constructions.
  Cheap (~a day), and it seeds the community/compare-solutions dynamic the expanded
  edition wants. Alternate-solution culture already exists (`solutions.json` `-tag` keys).
- **Touch / mobile support.** From the original wishlist; widens the audience a lot.
  Port-click wiring needs a tap-friendly rethink (bigger hit targets — synergy with the
  "larger icons" play-test item).
- **itch.io mirror.** Free, discoverable by puzzle-game players, supports HTML5 games
  directly; same zip as Netlify. Low effort, real discovery channel.
- **One-page teacher's guide.** Non-code artifact mapping levels → concepts (Landauer,
  reversibility, asynchrony, universality) with suggested classroom use; serves the
  workforce-development vision. Could live in the repo as `TEACHERS-GUIDE.md`.

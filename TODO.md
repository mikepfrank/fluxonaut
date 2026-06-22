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

3. **No feedback on wire-length timing.** Delay-tuning puzzles (e.g. W2-1
   Gatekeeper) are pure trial and error. Add the planned "how a wire's length sets
   timing" visual hint, or minimally a picosecond-delay tooltip/readout per wire.

4. **Fault banner can cover the top row of the board** (e.g. hides the reflector
   in W1-3 Tailgaters). Reposition, auto-fade, or push the board down.

5. **No skip-to-result when iterating.** Long boards take 10–15 s per run at 1×.
   Add a "skip to result" / instant-evaluate affordance (engine already computes
   the full trace up front, so this is playback-only).

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
him before changing anything.** NOT the right fix: globally loosening the certify jitter (that
weakens every level's robustness guarantee). The fix belongs in this level's layout / element
choice / par counts, keeping the shared 100-seed gate intact.

## Planarity (no-crossing-wires) — RESOLVED (2026-06-20)

Done. The crossing counter was found to under-count: it split each wire at every via/port-
stub vertex, so a crossing landing exactly on one read as two harmless T-touches and was
missed (a visibly-crossed layout could score "planar"). `engine.countCrossings` now
collinear-merges first, and `run-tests` asserts every reference is 0-crossing. A `CROSS`
(Crossover) element was added; a level that genuinely can't avoid a crossing is handed
exactly enough crossovers. Final state — every reference 0-crossing, robust at the 100-seed
certify gate + all jitter corners + a factor grid:
- **Genuinely planar (no crossover):** every level except the two below — incl. w2l1, w2l3,
  w2l6 (w2l6's fixed layout was rearranged: SG flipped on top, Dup/rDup lowered, inputs spread).
- **Need crossovers:** w2l4 The Duplicator (×2), w2l5 AND Finally (×1).

(The earlier 2026-06-14 audit above — "6 references cross wires" — was wrong twice over: it
used the buggy counter, and it predated the World-4 PS rebuild. Superseded.)

Open *academic* question (not urgent): is the switch-gate duplicator intrinsically non-planar,
or only in its bolted-down layout? Strong evidence it needs ≥1 crossing as currently laid out,
but no proof over all placements. The SG-symbol item above may be the lever that settles it.

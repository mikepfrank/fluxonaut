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
- Michael is playtesting all levels himself first (currently at W3-1 Antifluxon,
  resumed after the Twist polarity-color fix). He will flag any high-priority
  issues as he goes.

## Planarity (no-crossing-wires) — open question (added 2026-06-14)

A 4th, optional star now rewards planar solutions (no crossing wires). An audit
of the bundled reference solutions found 16/22 already planar; the Twist level
(w3l1 Antifluxon) is planar — its conductor swap is internal to the element, not
a drawn wire. These 6 reference solutions currently cross wires:
w2l1 Gatekeeper (1), w2l3 Merge Lanes (1), w2l5 AND Finally (3),
w4l3 Round Trip Token (1), w4l4 The Switch Gate For Real (1),
w4l5 Beyond the Paper (1).

TODO: during playtest, determine which of these 6 actually have planar solutions
(expected: most/all, since the BARCS research respected planarity except where
explicitly studying Twist). Where a planar solution exists, update
test/solutions.json so the reference solution earns the 4th star. Flag any that
genuinely cannot be solved without a crossing.

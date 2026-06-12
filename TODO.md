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

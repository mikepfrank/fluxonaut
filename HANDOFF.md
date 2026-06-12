# FLUXONAUT — session handoff notes

For future Claude sessions (or humans) continuing this project. State as of 2026-06-11.

## Status

- Game complete and deployed at **https://fluxonaut.netlify.app** (Netlify drag-and-drop
  of `../fluxonaut-site.zip`, which is rebuilt from runtime files only — no `test/`,
  so no solution spoilers ship).
- All tests green: `node test/run-tests.mjs` (219 checks: element-table audits, every
  level certified solvable within element & heat par across 7 jitter seeds, fault rules,
  per-segment polarity regression) and `node test/smoke-ui.mjs` (99 checks: full UI flow
  with stubbed DOM).
- Michael has playtested through World 3's "Antifluxon"; feedback so far applied:
  picosecond display units (1 cell ≈ 50 µm, ~c/30 ⇒ 16 ps per sim-second), port labels
  on element icons, bottom-edge detector labels drawn beside the element, and
  per-segment pulse polarity so color flips at twists/RM/BSR (with a flash ring).

## Architecture (see GAME-DESIGN.md and README.md first)

- `js/elements.js` + `js/engine.js` + `js/levels.js` are DOM-free (Node-testable).
- Engine runs a full deterministic event-driven trace up front; `ui.js` plays it back.
- Reference solutions for every level live in `test/solutions.json` (shared by both
  test harnesses). If you change level geometry or timing constants, re-run tests —
  the certify step is sensitive to wire lengths vs. the input-gap jitter (0.7–1.5×).

## Environment quirks worth knowing

- **File-sync truncation:** in Cowork, large Write/Edit operations to files in the
  mounted folder sometimes leave the sandbox-side mirror tail-truncated or NUL-padded
  (the canonical Windows file is usually fine — verify with the Read tool before
  "fixing" anything). Remedy: `python3 test/clean.py` strips NUL padding; for truncated
  tails, read the canonical tail via the Read tool and graft it onto the mounted copy
  via a bash heredoc. Always `node --check js/*.js` before running tests.
- **Claude in Chrome:** this conversation acquired a permanently cached navigation
  denial (from a 180 s permission timeout while the extension was wedged). Fresh
  sessions work fine. The extension allows action only on the account-level
  "approved sites" list; fluxonaut.netlify.app is now approved.

## Live playtest results (2026-06-11, fresh session, Chrome integration working)

Played 8 levels end-to-end in the deployed site by clicking: all of World 1 (5/5),
W2-1 Gatekeeper, W3-2 Exchange Rate, W4-1 Controlled Barrier — all certified 3★.
Console clean (only Chrome-extension messaging noise). Progress persisted across levels.

What played well:
- Wiring UX is solid: port-click → bend-clicks → port works precisely; wires follow
  dragged elements; right-click delete reliable. Pulse/polarity colors and the RM/CB
  stored-state icons read clearly. Fault banners are the star: collision, "two in a
  row" separation, and "fluxon flowed back into a launcher (absorbed; heavy heat)"
  
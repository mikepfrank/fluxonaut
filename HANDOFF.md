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
  each teach the rule that was violated, with expected-vs-got detector readouts.
- Difficulty curve felt right: W1 mostly first-try; W2-1 Gatekeeper needed real
  iteration (data-path delay must land between the two control arrivals — trial-and-
  error wire-length tuning, 3 attempts); W4-1 needed one instructive failure to learn
  CB ejects tokens out the SAME K-port.

Friction worth considering:
- Palette stays armed after placing an element; clicking empty space places another
  copy instead of deselecting (caused an accidental placement). Esc disarms.
- The per-element "rotate" button acts on the armed palette ghost, not the just-placed
  element — rotating a placed element requires selecting its body first (small click
  target; easy to click a port and start a wire instead). R key works once selected.
- Wire-length timing puzzles (Gatekeeper) are pure trial and error — no readout of
  path delay. The GAME-DESIGN wishlist item "how a wire's length sets timing" visual
  hint would help a lot; even a ps-length tooltip per wire would do.
- Fault banner at top can cover the topmost row of the board (Tailgaters reflector).
- At 1× speed long boards take 10-15 s per run; fine for watching physics, but a
  "skip to result" affordance would help when iterating.

## Source control (added 2026-06-12)

- Code is now on GitHub: **https://github.com/mikepfrank/fluxonaut** (public).
- NOTE: this local folder is NOT a git clone — the v1 push was staged from a
  sandbox copy. To publish future changes, either re-stage (copy files into a
  fresh clone and push) or convert this folder into a clone. The `docs/` PDFs
  at the BARCS root must never be pushed (not publicly distributable).
- GitHub auth: Michael has the GitHub connector authorized (tools should appear
  in fresh sessions); GitHub's device-login flow via curl also works from the
  sandbox. `api.github.com` is NOT on the sandbox network allowlist — only
  `github.com` — so use git-over-HTTPS, not the REST API, from the shell.

## Sensible next steps

- Live playtest in the browser (works from a fresh session): play several levels
  end-to-end by clicking; evaluate wiring UX, pacing, fault-message clarity.
- Remaining design polish candidates: undo for wire edits, a level-skip affordance,
  touch support, an in-game "how a wire's length sets timing" visual hint.
- Michael's larger wishlist (future editions, per GAME-DESIGN §6): viscosity/losses,
  error margins, JJ-circuit-level design mode, desktop/mobile ports.
- Hosting: Netlify free tier; redeploy = rebuild zip (`python3` zip recipe in session
  history, or just zip index.html + css/ + js/ + README.md + GAME-DESIGN.md) and drag
  onto the site's Deploys page.

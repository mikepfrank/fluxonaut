# FLUXONAUT — session handoff notes

For future Claude sessions (or humans) continuing this project. State as of 2026-06-18.

## Status

- Game complete and deployed at **https://fluxonaut.netlify.app** (Netlify drag-and-drop
  of `../fluxonaut-site.zip`, which is rebuilt from runtime files only — no `test/`,
  so no solution spoilers ship).
- All tests green: `node test/run-tests.mjs` (356 checks: element-table audits, every
  level certified solvable within element & heat par across 7 jitter seeds, fault rules,
  per-segment polarity regression, Landauer merge-law, sandbox coverage) and
  `node test/smoke-ui.mjs` (117 checks: full UI flow with stubbed DOM).
- `ps-physics-fix` is now MERGED into `main` (2026-06-18): the corrected lossy PS plus
  the full World 4 rebuild — new rPF element & level w4l1, redrawn CB symbol, C1/C2
  control ports, w4l3 (Round Trip) and w4l4 (Switch Gate) rebuilt for the real PS
  (w4l4 has a self-resetting "twice" case), the PS/RPS +/−/S bent-arm toggle, a
  complete sandbox, and a regenerated reference gallery. Suite green.
- Not yet redeployed to Netlify — regenerate the zip from `main` HEAD first.
- The W2·6 "Putting It Together" capstone (full Bennett AND from Dup + SG + rDup) is done.
- Michael has playtested through World 3's "Antifluxon"; feedback so far applied:
  picosecond display units (1 cell ≈ 50 µm, ~c/30 ⇒ 16 ps per sim-second), port labels
  on element icons, bottom-edge detector labels drawn beside the element, and
  per-segment pulse polarity so color flips at twists/RM/BSR (with a flash ring).

## Pending — resume here (2026-06-18)
World 4 polish is DONE and pushed to `origin/main` (commits 4f70cc8, d0f3792, 98849f0,
3c2e355, + this HANDOFF). Suite green 356 + 117.

DONE this session
- w4l5 reference solution re-tidied with the rPS bent-port selector (psL mir+bent='M',
  psR bent='M') — fully planar, 0 wire crossings, still certifies at heat 0.
- w4l5 gained the self-reset "C=1 D=1, twice" case; w4l4's same case renamed to match
  (comma, not semicolon); both intros reworded to a coherent "five schedules" (four logic
  cases + one fired twice to prove self-reset).
- Palette fix (Michael spotted stray elements): w4l5 trimmed to its real set `{RPS:2, PR3:1}`
  (it had carried surplus PR3/RM2/NOT); the rotary + twists moved to w4l6 "Boomerang" so
  players can experiment toward the theorem → `{CIRC:1, PR3:1, NOT:2}`.
- w4l6 success text rescoped to rotaries+twists, dropping "provably impossible" (intro/hint/
  notebook were already correctly scoped). Mechanics/solution unchanged.

KEY FINDING — see the erratum atop `../notes/boomerang-theorem-analysis.md`. An exhaustive
circulator-free wiring sweep (1.67M wirings) found that an **RM2 memory cell** enables a robust,
geometry-independent, **zero-heat** peel of the token — so RM2 was deliberately kept OUT of the
w4l6 palette (the PR3+NOT-only space re-verified safe: 0 wins). The notes' old "2-port can't peel"
topology-wall claim was corrected. The RM2 peel only *defers* the cost (the cell ends flipped —
Bennett debt), so whether it's a genuine reversible separator is a real open question for Michael;
intentionally left out of the player-facing text. The narrow PR3+NOT Boomerang theorem stands.

TODO
1. **Deploy** — live Netlify site is still the OLD build. Regenerate the zip from `main` HEAD
   (`git archive HEAD index.html README.md GAME-DESIGN.md css js -o ../netlify-zips/...zip`)
   and drag it to Netlify. Zips live in non-repo `../netlify-zips/`.
2. **`ps-physics-fix` branch** — merged into `main`; its remote is stale. Harmless; delete or leave.

## Architecture (see GAME-DESIGN.md and README.md first)

- `js/elements.js` + `js/engine.js` + `js/levels.js` are DOM-free (Node-testable).
- Engine runs a full deterministic event-driven trace up front; `ui.js` plays it back.
- Reference solutions for every level live in `test/solutions.json` (shared by both
  test harnesses). If you change level geometry or timing constants, re-run tests —
  the certify step is sensitive to wire lengths vs. the input-gap jitter (0.7–1.5×).

## Environment

- Work is now done in the **Claude Code CLI on Windows** (initially via the desktop
  app's CLI tab, also runnable in any terminal). Node.js LTS v24 + npm 11 are installed
  system-wide via `winget install OpenJS.NodeJS.LTS`, so the CLAUDE.md commands run
  verbatim from a normal shell.
- All the old Cowork sandbox quirks (file-sync truncation, NUL-padded writes, mount
  blocking `rm`/`git config`, the `cp`-round-trip workaround, `clean.py`, etc.) NO
  LONGER APPLY and have been removed from this doc. If you ever need them as
  historical reference, see git history for `HANDOFF.md` before 2026-06-16.
- **npm supply-chain caution:** before any `npm install`, `npm update`, or accepting
  a lockfile change, verify each affected package (direct AND transitive) is at least
  14 days old. Tests run on the real OS with real credentials in scope, so a freshly
  hijacked package can exfiltrate secrets or corrupt the remote repo. `@napi-rs/canvas`
  was vetted manually on 2026-06-15 (1.0.0 published 2026-05-04).

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

## Source control

- Code is on GitHub: **https://github.com/mikepfrank/fluxonaut** (public).
- This local folder is a normal git clone tracking `origin/main`. Claude Code sessions
  often run in a worktree under `.claude/worktrees/<name>/` on branch
  `claude/<name>`; commit there, push the branch, fast-forward `main` afterwards.
- The `docs/` PDFs at the BARCS root must NEVER be pushed (not publicly distributable).
  `.gitignore` covers `*.zip`, `node_modules/`, and `.DS_Store`.
- **Pushing now works directly from Claude Code on Windows** — `git push` uses the
  user's authenticated git credentials (no need to hand off to GitHub Desktop /
  VS Code as in the Cowork days).

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

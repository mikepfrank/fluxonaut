# FLUXONAUT — project guide

FLUXONAUT is a browser puzzle game about **BARCS** (asynchronous ballistic
reversible computing). Vanilla JS, **no build system** — `index.html` loads the
scripts directly. Deployed at https://fluxonaut.netlify.app . Repo:
github.com/mikepfrank/fluxonaut (this folder is `fluxon-game/`).

The author, **Michael Frank**, wrote the 2017 paper the game dramatizes — he is
the domain authority on its physics/CS. Defer to him on conceptual correctness;
don't treat in-game text as ground truth.

## Commands
- Tests (keep green): `node test/run-tests.mjs` (293 checks) and
  `node test/smoke-ui.mjs` (105 checks).
- Render reference solutions to `sols/*.png`: `node test/render-sols.mjs`
  (run `npm i` first — dev dep `@napi-rs/canvas`).
- Re-route references to obey the wiring rules: `node test/route-solutions.mjs`.
- Deploy: zip the runtime files only — `index.html README.md GAME-DESIGN.md css js`
  (e.g. `git archive HEAD`) — and drag the zip to Netlify.

## Architecture (load order = index.html)
- `js/elements.js` — element/device types; each is a reversible Mealy machine
  `transition(port, pol, state) -> {port, pol, state, heat, absorb}`. Biased
  elements (PS, PFG, CIRC) are irreversible and cost heat; partial chips
  (DUP/RDUP) fault on out-of-order arrivals.
- `js/engine.js` — deterministic event-driven simulator + `certify` (runs each
  case under 7 jitter seeds; **order must hold, exact timing must not**).
- `js/levels.js` — `LEVELS`, `SANDBOX`, `NOTEBOOK`: fixed elements, palette,
  cases (inputs + expected detector catches), par counts, intro/hint/success.
- `js/render.js` (canvas renderer), `js/ui.js` (app shell), `js/biblio.js` (refs).
- `test/solutions.json` — the reference solution per level (test oracle).
  `test/run-tests.mjs` certifies them + a geometry guard (no through-element /
  overlap / self-overlap; crossings are allowed but cost the planarity star).

## Conventions
- Scoring: 4 stars = pass | proper-build | heat-par | planar. A hint docks one star.
- ASC conference papers appear in the journal the FOLLOWING year — `[ASC 2018]` /
  "Aug. 2019" is correct, NOT a bug. The game cites papers informally, never bib keys.
- `PS` (Polarity Separator) routes by polarity from ANY port: + always exits the
  + arm, − the − arm (a matching fluxon reflects, a mismatched one crosses, and
  nothing returns to the stem). Non-injective ⇒ genuinely irreversible. (The
  arm labeled "+" is biased to push + fluxons OUT, so it pulls − in and reflects +.)

## Current state / pending work
- `main`: the W2·6 "Putting It Together" capstone (full Bennett AND from
  Dup + SG + rDup) is done; suite green.
- Branch `ps-physics-fix` (UNMERGED): applies the correct PS table above + a
  w3l4 irreversibility note. It intentionally BREAKS w4l2 (Round Trip Token) and
  w4l3 (Switch Gate For Real), which route a fluxon into a PS branch and expect
  it out the stem — impossible for the real biased PS. Those two need redesign
  (keep using the real lossy PS, NOT the conjectural rPS) before this branch
  merges to main. The original game design drifted from the true PS behavior, so
  the later PS-using puzzles need a careful review.
- See `TODO.md` for UX-friction items and the planarity (no-crossing) audit.

## Folder layout
This git repo is `fluxon-game/`. Its PARENT (`C:\Users\MikeFrank\BARCS\`) also
holds `docs/` (background PDFs — NOT in the repo; don't add or push them), ZIPs
staged for Netlify, and Michael's working notes on needed improvements. To use
them, launch Claude Code here with `--add-dir ..`, or launch in the parent.

# FLUXONAUT — project guide

FLUXONAUT is a browser puzzle game about **BARCS** (asynchronous ballistic
reversible computing). Vanilla JS, **no build system** — `index.html` loads the
scripts directly. Deployed at https://fluxonaut.netlify.app . Repo:
github.com/mikepfrank/fluxonaut (this folder is `fluxon-game/`).

The author, **Michael Frank**, wrote the 2017 paper (and other references) the game dramatizes — he is
the domain authority on its physics/CS. Defer to him on conceptual correctness;
don't treat in-game text as ground truth.

## Commands
- Tests (keep green): `node test/run-tests.mjs` (412 checks) and
  `node test/smoke-ui.mjs` (144 checks).
- Render reference solutions to `sols/*.png`: `node test/render-sols.mjs`
  (run `npm i` first — dev dep `@napi-rs/canvas`).
- Re-route references to obey the wiring rules: `node test/route-solutions.mjs`.
- Deploy: zip the runtime files only — `index.html README.md GAME-DESIGN.md css js`
  (e.g. `git archive HEAD`) — and drag the zip to Netlify.

## Cost — subordinate models
Subagents are expensive on Opus, and an Opus-heavy multi-agent session has burned
Michael's weekly quota overnight. Default `Agent`/`Workflow` agents to **Sonnet**
(**Haiku** for trivial mechanical passes); reserve **Opus** for synthesis or a
genuinely hard search, and pass the `model:` option explicitly. Prefer doing light
follow-up inline over spawning a subagent.

## Architecture (load order = index.html)
- `js/elements.js` — element/device types; each is a reversible Mealy machine
  `transition(port, pol, state) -> {port, pol, state, heat, absorb}`. The biased
  filter/separator (PFG, PS) and the circulator (CIRC) are irreversible; PFG/PS
  dissipate only when they PUMP a fluxon through (reflections are free). `rPF` is
  the reversible, unpowered filter — the CB's data rail, standalone. Partial chips
  (DUP/RDUP) fault on out-of-order arrivals; `CIRC` is likewise **partial** (only the
  +-routes A→B and B→C are defined — its real chip design was never finalized). PS/RPS have a `cfg.bent` (+/−/S) that
  picks which arm exits orthogonally — geometry only, distinct from rotate/mirror.
- `js/engine.js` — deterministic event-driven simulator + `certify` (runs each
  case under 100 jitter seeds — `CERTIFY_SEEDS`, shared by game + tests;
  **order must hold, exact timing must not**; records the first failing seed per case →
  the in-game instant replay). `engine.countCrossings` = the
  collinear-merged planarity counter; `ui.js` builds the 🔍 transition-table inspector.
- `js/levels.js` — `LEVELS`, `SANDBOX`, `NOTEBOOK`: fixed elements, palette,
  cases (inputs + expected detector catches), par counts, intro/hint/success.
- `js/render.js` (canvas renderer), `js/ui.js` (app shell), `js/biblio.js` (refs).
- `test/solutions.json` — the reference solution per level (test oracle).
  `test/run-tests.mjs` certifies them + a geometry guard (no through-element /
  overlap / self-overlap) + a planarity guard: every reference must be 0-crossing —
  forced crossings are routed through `CROSS` (Crossover) gadgets. (In-game, a player's
  crossings are allowed but cost the planarity star; `engine.countCrossings` collinear-
  merges first, so a crossing can't hide on a via.)

## Conventions
- Scoring: 4 stars = pass | proper-build | heat-par | planar. A hint docks one star.
- ASC conference papers appear in the journal the FOLLOWING year — `[ASC 2018]` /
  "Aug. 2019" is correct, NOT a bug. The game cites papers informally, never bib keys.
- `PS` (Polarity Separator) routes by polarity from ANY port: + always exits the
  + arm, − the − arm (a matching fluxon reflects, a mismatched one crosses, and
  nothing returns to the stem). Non-injective ⇒ genuinely irreversible. (The
  arm labeled "+" is biased to push + fluxons OUT, so it pulls − in and reflects +.)

## Current state / pending work
- `main`: `ps-physics-fix` is **MERGED** in (2026-06-18). The corrected lossy PS is
  live and World 4 was rebuilt around it: new rPF element + level w4l1 "The
  Reversible Barrier"; CB symbol redrawn (RM2 ⊗ rPF coupling lines, no redundant
  "CB"); CB control ports relabeled C1/C2; w4l3 (Round Trip) and w4l4 (Switch Gate)
  rebuilt for the real PS (w4l4 has a self-resetting "twice" case); PS/RPS gained
  the +/−/S bent-arm toggle; the sandbox offers every element (guard-tested);
  reference gallery regenerated. Suite green.
- **Crossover feature** (2026-06-20): new `CROSS` element + a planarity-counter fix
  (`engine.countCrossings` collinear-merges, so a crossing can't hide on a via). All
  references are now 0-crossing — w2·4 (×2 Crossovers) and w2·5 (×1) genuinely need them;
  w2·1 and w2·6 were re-derived planar (w2·6's fixed layout was rearranged). `certify` is a
  shared 100-seed gate (`engine.CERTIFY_SEEDS`) for game + tests; run-tests asserts every
  reference is planar; sandbox launchers gained per-pulse absolute launch times.
- **Inspector + editor UX** (2026-06-21): a 🔍 on any selected device opens its Mealy
  transition table — lossless transitions horizontal (blue), dissipative merges curved
  (red), partial devices flagged; new `condrev` notebook page + GRC 2018 in the biblio.
  `CIRC` is now partial, so w4l6 was reworked around the theoretical unconditional ROTARY
  (text reframed: the boomerang needs *unconditional directionality* — reversible-theoretical
  vs the real dissipative circulator). Dragging/rotating/flipping a wired element now
  auto-reroutes its wires to a legal path (sticky-red if none exists).
- **Instant replay + drop-on-wire flag** (2026-06-21): a fuzzed-timing certification failure now
  offers a "Watch instant replay (run #N)" button that re-plays that exact seed's jittered timing
  on the board — flashing banner, normal play/pause/speed; `certify` records the first failing
  seed; the banner clears on any edit but Reset keeps it armed so the run can be re-watched.
  Separately, dropping a new part onto/grazing an existing wire now flags that wire sticky-red
  (no reroute — its timing is preserved) so the player deletes + redraws it deliberately.
- **Deployed** 2026-06-21 from `main` (`8ebbbf5`) → https://fluxonaut.netlify.app . To
  redeploy: rebuild the runtime zip in `../netlify-zips/` (`git archive HEAD …`) and drag it
  to Netlify.
- Open threads: w4l6 "The Boomerang Theorem" still wants a standalone review; `TODO.md` has
  the w2l4 timing-constraint loosening (play-test friction — Michael has ideas), the SG-symbol
  port-ordering revisit, the "also offer PS on w4l6's palette" idea, and the UX-friction items.

## Folder layout
This git repo is `fluxon-game/`. Its PARENT (`C:\Users\MikeFrank\BARCS\`) also
holds `docs/` (background PDFs — NOT in the repo; don't add or push them), ZIPs
staged for Netlify, and Michael's working notes on needed improvements. To use
them, launch Claude Code here with `--add-dir ..`, or launch in the parent.

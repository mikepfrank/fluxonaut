# FLUXONAUT — session handoff notes

For future Claude sessions (Code or Cowork) or humans continuing this project.
State as of **2026-06-28** (release **v1.1**). `CLAUDE.md` is the technical project guide and
carries a dated changelog; this file is the higher-level *how we work + where things stand*.

## Where things stand

- **Live & released.** Deployed at **https://fluxonaut.netlify.app**. Current GitHub release is
  **v1.1** ("Three Ports Are Enough"), following **v1.0** (2026-06-26) — the deployed `main` HEAD is
  the v1.1 build. Releases: https://github.com/mikepfrank/fluxonaut/releases .
- **Suite green:** `node test/run-tests.mjs` (479 checks) and `node test/smoke-ui.mjs` (196). Keep
  both green — `certify` is sensitive to routed wire lengths vs. the input-gap jitter, so any geometry
  or timing change needs a re-run.
- **Recent arc (mid/late June 2026, newest last)** — full detail in CLAUDE.md's "Current state" list:
  - `CROSS` (Crossover) element + a collinear-merging planarity counter; every reference is 0-crossing.
  - 🔍 Mealy transition-table inspector; `CIRC` made *partial*; w4l6 reworked around the theoretical rotary.
  - Instant replay of a fuzzed-seed failure; drop-on-wire sticky-red flag.
  - Reverse playback (rewind to barriers); per-wire delay/length tooltip; pre-roll skip.
  - Arrow-key transport + element nudge; direction-remembering spacebar.
  - **v1.1 headline — w4l7 "Three Ports Are Enough":** a self-resetting reversible switch gate from
    only reversible ≤3-port devices (a unipolar-universality proof, far simpler than the 2017 paper).
    New aspirational elements **STS** (self-toggling switch) + **UTR** (unconditional toggle rotary)
    with state-driven symbols and the STS `bent` toggle; a planar STS reference + a certified UTR
    alternate; `threeports` notebook page; `[LPS 2023]` reference; and deselect-on-run, Sandbox-finale
    button, and `n★` picker-label fixes.

## How we work with Michael

- **Michael Frank is the domain authority.** He wrote the 2017 ABRC paper and the BARCS references the
  game dramatizes. Defer to him on physics/CS correctness, and **do not treat in-game text as ground
  truth** — if something reads wrong, ask or flag it; don't "correct" the physics from the game's own
  wording.
- **Tight iterative loop.** He proposes a feature or a small tweak; you implement it, keep the suite
  green, and *show the result* — a rendered `sols/*.png`, a mockup via the visualize tool, or a crisp
  diff summary — before or as you land it. He play-tests locally on the `file://` build and returns
  with precise adjustments. Expect many small surgical changes, not big drops.
- **Git rhythm.** Work on **`main` directly** (absolute paths — see the worktree caveat under Source
  control). Commit in logical chunks. He'll usually give a standing "commit + push these fixes" for a
  working session and does the **Netlify deploy himself** (drags the zip); outside an explicit
  go-ahead, don't push, and only tag releases when he asks.
- **Level-construction discipline.** Build a new level's reference in a *throwaway harness* under the
  scratchpad (require `js/elements.js` + `engine.js` + `levels.js`; reuse run-tests' `buildCircuit`),
  and confirm **certify @ 100 jitter seeds** (order must hold, exact timing must not) **+ 0 crossings +
  no through-element/overlap** BEFORE writing it into `test/solutions.json`. A brute-force
  rot/mir/bent search over `swappedPort` is the quick way to place ports for a clean planar layout.
  Store alternate constructions as `solutions.json` key `"<levelId>-<tag>"` — run-tests + render-sols
  handle those generically (certify + planarity + a gallery render).
- **Cost.** Default `Agent`/`Workflow` subagents to **Sonnet** (**Haiku** for trivial passes), reserve
  **Opus** for genuinely hard synthesis/search, pass `model:` explicitly, and prefer inline follow-up
  over spawning a subagent — an Opus-heavy multi-agent session once burned Michael's weekly quota.
- **Scratch files** go in the session scratchpad (never `/tmp`, never the repo).

## Open threads / next steps

- **w4l6 "The Boomerang Theorem"** still wants a standalone review. See the erratum atop
  `../notes/boomerang-theorem-analysis.md`: an exhaustive circulator-free sweep (1.67M wirings) found an
  **RM2 memory cell** enables a robust, geometry-independent, zero-heat token peel — so RM2 is
  deliberately kept OUT of the w4l6 palette (the PR3+NOT-only space re-verified safe, 0 wins). That peel
  only *defers* the cost (the cell ends flipped — Bennett debt); whether it's a genuine reversible
  separator is a real open question for Michael, intentionally left out of player-facing text. The
  narrow PR3+NOT theorem stands.
- **AGREED NEXT MAJOR PASS (2026-07-01): the SG-symbol port reorder, on a new branch** (e.g.
  `sg-port-reorder`) — see TODO.md's "Agreed next major pass + branch policy" for the full brief.
  Motivation: w2l4 Duplicator timing friction is play-testers' #1 stumbling block; the reorder may
  loosen timing and/or shed crossovers, and spreading w2l4's pre-placed elements is a complementary
  easing. Merge to `main` only after play-testing the branch build proves a net win. (The planning-pass
  docs edits are committed — `44dc4a8`. An earlier draft of this line also listed a pending
  CLAUDE.md/GAME-DESIGN.md refresh; that was a phantom of the Cowork mount-staleness bug below —
  those refreshes were already committed in June. Nothing is pending.)
- **`TODO.md`** also carries: the w2l4 timing-constraint loosening details (Michael has ideas),
  the "also offer PS on w4l6's palette" idea, parked reach/distribution ideas, and other UX items.
- **Small consistency nit, flagged not fixed:** the World-2 "Universality" notebook page still opens
  "That's what you just built…" (`js/levels.js`, the `universality:` page). Notebook pages open with the
  puzzle *before* anything is built, so the tense is slightly off — the w4l7 page was just corrected the
  same way ("the gate you build on this level"). Left as-is since it's Michael's existing copy; offer to
  align it if he wants.

## Deploy

Runtime files ONLY:
`git archive HEAD index.html css js -o ../netlify-zips/fluxonaut-site-<date>_<time>.zip`, then copy it
over `../netlify-zips/fluxonaut-site.zip`. **No `.md`** (nothing in the game loads or links to them),
and leaving `test/` out means no solution spoilers ship. Michael then drags the zip onto Netlify's
Deploys page. Zips live in the non-repo `../netlify-zips/`.

## Architecture (see CLAUDE.md, GAME-DESIGN.md, README.md for detail)

- `js/elements.js` + `js/engine.js` + `js/levels.js` are DOM-free and Node-testable; `js/render.js`
  (canvas), `js/ui.js` (app shell), `js/biblio.js` (refs) are the browser layer.
- The engine runs a full deterministic event-driven trace up front; `ui.js` plays it back (forward and
  reverse). Reference solutions per level live in `test/solutions.json` — the shared oracle for both
  test harnesses. Change level geometry/timing → re-run tests.

## Environment

- **Claude Code CLI on Windows** (desktop-app CLI tab, or any terminal). Node.js LTS v24 + npm 11 are
  installed system-wide (`winget install OpenJS.NodeJS.LTS`), so CLAUDE.md commands run verbatim. After
  a winget install, fully quit Claude from the tray to refresh PATH. The old Cowork sandbox quirks no
  longer apply (see git history before 2026-06-16 if ever needed).
- **Cowork sessions: file tools only — NEVER git — for this repo.** Verified live 2026-07-01: the
  Cowork sandbox's mount of the working tree still goes stale/truncated (a file mid-edit appeared
  cut off mid-word on the mount while the Windows-side canonical copy was complete), and the
  sandbox's Linux git sees whole-file CRLF/LF phantom diffs on every tracked file. Any `git add`/
  `commit` from the Cowork mount risks committing truncated, EOL-mangled content. In Cowork:
  edit via the Read/Write/Edit file tools (they act on the canonical Windows files), and leave all
  git operations to a Claude Code session (or Michael) on the host. Read-only `git log`/`ls-remote`
  from the mount is fine.
- `test/render-sols.mjs` needs the dev dep `@napi-rs/canvas` (`npm i`; if "Cannot find native binding",
  `npm ci` restores the vetted lockfile-pinned binary).
- **npm supply-chain caution:** before any `npm install`/`update` or lockfile change, verify each
  affected package (direct AND transitive) is ≥14 days old — tests run on the real OS with real
  credentials in scope, so a freshly hijacked package could exfiltrate secrets or corrupt the repo.
  `@napi-rs/canvas` was vetted 2026-06-15 (1.0.0 published 2026-05-04).

## Source control

- Public repo: **https://github.com/mikepfrank/fluxonaut**, tracking `origin/main`. Pushing works
  directly from Claude Code on Windows (the user's authenticated git credentials).
- **Work on `main` directly via absolute paths.** Claude Code opens a worktree under
  `.claude/worktrees/<name>/` on branch `claude/<name>`, but that checkout has repeatedly gone **stale**
  and will feed OLD code to reads/Grep/subagents — so this session edits the real checkout at
  `C:\Users\MikeFrank\BARCS\fluxon-game\` by absolute path and commits there. If you must use the
  worktree, fast-forward its branch to `main` first.
- The `docs/` PDFs at the BARCS root must **NEVER** be pushed (not publicly distributable). The parent
  `../` also holds working `.md` notes + `netlify-zips/` — none of that is in the repo. `.gitignore`
  covers `*.zip`, `node_modules/`, `.DS_Store`.

## Historical: live playtest (2026-06-11)

Played 8 levels end-to-end in the deployed site (all of World 1, W2-1, W3-2, W4-1 — all 3★, console
clean, progress persisted). Wiring UX solid; fault banners teach the violated rule well; difficulty
curve felt right. Several frictions noted then have since been **addressed**: the per-wire delay/length
tooltip (was "no readout of path delay"), pre-roll skip (was "skip to result"), the deselect-on-run
fix, and drop-on-wire flagging. Still open-ish: the palette stays armed after placing (Esc disarms);
rotating a placed element needs selecting its small body first; the fault banner can overlap the top
board row.

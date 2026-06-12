# FLUXONAUT

*A browser puzzle game that teaches the principles of Ballistic Asynchronous
Reversible Computing in Superconductors (BARCS) — played on the actual physics.*

Based on the BARCS research program at Sandia National Laboratories (2016–2026).
Game design & implementation: Claude (Anthropic), directed by Michael P. Frank.
See `GAME-DESIGN.md` for the full design document.

## Play it

No build step, no dependencies. Either:

- **Just open `index.html`** in any modern browser (Chrome/Edge/Firefox/Safari), or
- serve the folder, which is also exactly how you'd host it publicly:

  ```
  cd fluxon-game
  python -m http.server 8000     # then visit http://localhost:8000
  ```

To host persistently, drop this folder onto any static host (GitHub Pages,
Netlify, itch.io as HTML game, a lab web server). Everything is plain
HTML/CSS/JS with zero external requests.

Progress (stars, notebook unlocks) is saved in the browser's localStorage.

## Controls

| Action | How |
|---|---|
| Place an element | click it in the palette, then click the board (R rotates first) |
| Wire two ports | click a port, optionally click waypoints, click another port |
| Move / configure | click an element; drag to move, use the inspector bar below the board |
| Delete | right-click a wire/element, or select + Delete |
| Run / pause | ▶ button or Space |
| Test properly | **✓ CERTIFY** — runs every test case several times with randomized (order-preserving) input timing |

## What the simulation is (and isn't)

The game implements the *abstract network level* of the ABRC/BARC model
(Frank, ICRC 2017): elements are injective Mealy machines on
(port, fluxon polarity, internal state); fluxons travel at constant speed on
bidirectional non-branching interconnects; devices are quiescent between
arrivals; behavior depends on arrival *order*, never on precise timing.
Overlapping arrivals at a device and head-on wire collisions are faults — the
same constraints the real architecture imposes. Biased elements (PS, PFG,
circulator) and exhausts emit visible waste heat; fully reversible play earns
the third star.

Deliberate idealizations (per project direction): no fluxon viscosity or
dispersion, perfectly reliable devices, no JJ-circuit-level (SPICE) detail.
A few elements (Rotary, TCB, Polarized Rotary, rPS) are theoretical constructs
flagged honestly in the in-game Lab Notebook; the RM cell, BSR, PFG, PS,
circulator, CB cell, and the asynchronous RFSG follow the digital behavior of
the published designs.

## Files

```
index.html          app shell
css/style.css       cryo-lab theme
js/elements.js      element (device) transition tables — DOM-free
js/engine.js        event-driven network simulator + certification — DOM-free
js/levels.js        22 levels + sandbox + Lab Notebook text
js/render.js        canvas renderer
js/ui.js            editor, playback, screens, sound, persistence
test/run-tests.mjs  engine + level verification (reference solution per level)
test/smoke-ui.mjs   headless UI smoke test (stubbed DOM)
test/screenshot.mjs renders gameplay frames to PNG (needs @napi-rs/canvas)
test/solutions.json reference solutions — SPOILERS, obviously
```

## Tests

```
node test/run-tests.mjs    # 217 checks: element tables, every level solvable
                           # within element & heat par across jittered timings,
                           # fault rules fire correctly
node test/smoke-ui.mjs     # 99 checks: full UI flow headlessly
```

## Ideas for later editions

Viscosity & signal-restoration mechanics, error margins, a JJ-circuit design
mode, a level editor with sharing, desktop/mobile builds, and a campaign about
the element classification (ICRC 2022). The finale's open problem — a
reversible, unpowered polarity separator — remains open in real life, too.

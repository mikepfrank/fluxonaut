/* FLUXONAUT — ui.js
 * App shell: screens, level editor, playback, certify, progress, notebook, sound.
 */
(function () {
  const F = globalThis.FLUXON;
  const R = F.render, E = F.engine, CELL = R.CELL;

  // ───────────────────────── persistence ─────────────────────────
  const store = {
    load() { try { return JSON.parse(localStorage.getItem('fluxonaut') || '{}'); } catch (e) { return {}; } },
    save(d) { try { localStorage.setItem('fluxonaut', JSON.stringify(d)); } catch (e) { } },
  };
  let progress = store.load();           // { levels: {id:{stars, done}}, notebook: [ids], muted }
  progress.levels = progress.levels || {};
  progress.notebook = progress.notebook || [];

  // ───────────────────────── sound ─────────────────────────
  let actx = null;
  function beep(freq, dur, type, gain, when) {
    if (progress.muted) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type || 'sine'; o.frequency.value = freq;
      g.gain.value = gain || 0.05;
      const t0 = actx.currentTime + (when || 0);
      g.gain.setValueAtTime(gain || 0.05, t0);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + (dur || 0.1));
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + (dur || 0.1) + 0.02);
    } catch (e) { }
  }
  const SFX = {
    launch: () => beep(660, 0.07, 'triangle', 0.05),
    op: () => beep(330, 0.05, 'sine', 0.035),
    toggle: () => { beep(392, 0.06, 'square', 0.03); beep(523, 0.06, 'square', 0.03, 0.05); },
    detect: () => beep(880, 0.12, 'sine', 0.05),
    heat: () => beep(120, 0.2, 'sawtooth', 0.045),
    fault: () => { beep(220, 0.25, 'sawtooth', 0.06); beep(165, 0.3, 'sawtooth', 0.06, 0.12); },
    win: () => { [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.16, 'triangle', 0.05, i * 0.09)); },
    place: () => beep(440, 0.05, 'sine', 0.04),
    wire: () => beep(550, 0.04, 'sine', 0.03),
  };

  // ───────────────────────── app state ─────────────────────────
  const app = {
    screen: 'title',          // title | levels | game
    level: null,              // active level def
    elements: [], wires: [],  // editor circuit
    nextId: 1,
    selection: null,          // {kind:'el'|'wire', id}
    mode: 'idle',             // idle | placing | wiring | dragging
    placing: null,            // {type, rot}
    wiring: null,             // {from:{el,port}, via:[], mouse:{x,y}}
    hoverPort: null,
    mouse: { x: 0, y: 0 },
    paletteLeft: {},          // counts remaining
    caseIdx: 0,
    // playback
    trace: null, playT: 0, playing: false, speed: 1, playCase: 0,
    evCursor: { state: 0, heat: 0, det: 0, arr: 0 },
    liveStates: new Map(), liveDetections: {},
    particles: [],
    runResult: null,          // after playback ends: {pass, reasons}
    certifyResult: null,
    banner: null,             // {kind, text}
  };

  // ───────────────────────── DOM helpers ─────────────────────────
  const $ = sel => document.querySelector(sel);
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const k in (attrs || {})) {
      if (k === 'onclick') e.addEventListener('click', attrs[k]);
      else if (k === 'html') e.innerHTML = attrs[k];
      else e.setAttribute(k, attrs[k]);
    }
    for (const kid of kids) if (kid != null) e.append(kid);
    return e;
  }

  // ───────────────────────── screens ─────────────────────────
  function showScreen(name) {
    app.screen = name;
    for (const s of ['title', 'levels', 'game']) $('#screen-' + s).classList.toggle('hidden', s !== name);
    if (name === 'levels') buildLevelSelect();
  }

  function starCount(lv) { return (progress.levels[lv.id] || {}).stars || 0; }

  function buildLevelSelect() {
    const wrap = $('#level-grid');
    wrap.innerHTML = '';
    const worlds = [
      { n: 1, name: 'World 1 · Ballistic Bootcamp', tip: 'Pulses, wires, bounces — and why timing must not matter.' },
      { n: 2, name: 'World 2 · Stateful Logic', tip: 'The 2017 universality construction, built by hand.' },
      { n: 3, name: 'World 3 · Polarity', tip: 'Real superconducting fluxons: ±, memory cells, and the first heat.' },
      { n: 4, name: 'World 4 · The Universal Element', tip: 'The Controlled Barrier and the asynchronous switch gate.' },
    ];
    for (const w of worlds) {
      wrap.append(h('div', { class: 'world-head' }, h('span', {}, w.name), h('span', { class: 'world-tip' }, w.tip)));
      const row = h('div', { class: 'level-row' });
      for (const lv of F.LEVELS.filter(l => l.world === w.n)) {
        const stars = starCount(lv);
        const card = h('div', { class: 'level-card' + (lv.bonus ? ' bonus' : '') },
          h('div', { class: 'lv-num' }, lv.bonus ? '★' : String(lv.n)),
          h('div', { class: 'lv-title' }, lv.title),
          h('div', { class: 'lv-stars' }, '★'.repeat(stars) + '☆'.repeat(3 - stars)));
        card.addEventListener('click', () => loadLevel(lv));
        row.append(card);
      }
      wrap.append(row);
    }
    wrap.append(h('div', { class: 'world-head' }, h('span', {}, 'Free Play'), h('span', { class: 'world-tip' }, 'All elements, no rules but physics.')));
    const row = h('div', { class: 'level-row' });
    const card = h('div', { class: 'level-card sandbox' },
      h('div', { class: 'lv-num' }, '∞'), h('div', { class: 'lv-title' }, 'Sandbox'), h('div', { class: 'lv-stars' }, ' '));
    card.addEventListener('click', () => loadLevel(F.SANDBOX));
    row.append(card);
    wrap.append(row);

    // test utility: wipe all saved progress
    wrap.append(h('div', { class: 'reset-wrap' },
      h('button', { class: 'mini warn', onclick: confirmReset }, '⟲ Clear all progress (test)')));
  }

  function confirmReset() {
    const m = $('#modal'); m.classList.remove('hidden');
    const box = $('#modal-box'); box.innerHTML = '';
    box.append(h('h2', { class: 'bad' }, 'Clear all progress?'));
    box.append(h('p', { class: 'story', html: 'This resets every level’s stars and re-locks all Lab Notebook entries. For testing only — it can’t be undone.' }));
    box.append(h('div', { class: 'modal-btns' },
      h('button', { class: 'big', onclick: closeModal }, 'Cancel'),
      h('button', { class: 'big primary', onclick: () => { clearProgress(); closeModal(); } }, 'Clear everything')));
  }

  function clearProgress() {
    progress.levels = {};
    progress.notebook = [];
    store.save(progress);
    buildLevelSelect();
  }

  // ───────────────────────── level load / editor circuit ─────────────────────────
  function loadLevel(lv) {
    app.level = lv;
    app.elements = lv.fixed.map(e => ({ ...e, cfg: e.cfg ? { ...e.cfg } : undefined }));
    app.wires = [];
    let wid = 0;
    for (const pw of (lv.prewires || [])) {
      app.wires.push({ id: 'pw' + (wid++), a: { el: pw.a[0], port: pw.a[1] }, b: { el: pw.b[0], port: pw.b[1] }, via: (pw.via || []).map(v => ({ ...v })) });
    }
    app.nextId = 1;
    app.paletteLeft = { ...(lv.palette || {}) };
    app.selection = null; app.mode = 'idle'; app.placing = null; app.wiring = null;
    app.caseIdx = 0; app.trace = null; app.playing = false; app.runResult = null; app.certifyResult = null;
    app.particles = []; app.banner = null;
    unlockNotebook(lv.notebook);
    showScreen('game');
    buildGameChrome();
    if (lv.intro) showStory(lv.title, lv.intro, lv === F.SANDBOX ? null : 'Got it — to the bench!');
    sizeCanvas();
  }

  function unlockNotebook(ids) {
    let changed = false;
    for (const id of (ids || [])) if (!progress.notebook.includes(id)) { progress.notebook.push(id); changed = true; }
    if (changed) store.save(progress);
  }

  function placedCount() {
    return app.elements.filter(e => e.placed).length;
  }

  function circuit() { return { elements: app.elements, wires: app.wires }; }

  // ───────────────────────── game chrome (DOM panels) ─────────────────────────
  function buildGameChrome() {
    const lv = app.level;
    $('#hud-title').textContent = (lv.sandbox ? '' : `${lv.bonus ? 'BONUS' : 'W' + lv.world + '·' + lv.n} — `) + lv.title;
    // palette
    const pal = $('#palette');
    pal.innerHTML = '';
    const keys = Object.keys(lv.palette || {});
    pal.classList.toggle('hidden', keys.length === 0);
    for (const k of keys) {
      const t = F.TYPES[k];
      const item = h('div', { class: 'pal-item', 'data-type': k, title: t.blurb },
        h('canvas', { width: 64, height: 64, class: 'pal-icon' }),
        h('div', { class: 'pal-name' }, t.name + (t.conjectural ? ' ?' : '')),
        h('div', { class: 'pal-count', id: 'pal-count-' + k }, '×' + app.paletteLeft[k]));
      item.addEventListener('click', () => startPlacing(k));
      pal.append(item);
      const ictx = item.querySelector('canvas').getContext('2d');
      ictx.save(); ictx.translate(8, 8); ictx.scale(48 / (Math.max(t.w, t.h) * CELL), 48 / (Math.max(t.w, t.h) * CELL));
      R.drawElement(ictx, { x: 0, y: 0, rot: 0, cfg: t.config ? { ...t.config } : undefined, type: k }, t.states ? t.defaultState : null, {});
      ictx.restore();
    }
    buildCaseTabs();
    updateHud();
    renderInspector();
  }

  function buildCaseTabs() {
    const lv = app.level;
    const tabs = $('#case-tabs');
    tabs.innerHTML = '';
    if (!lv.cases || lv.cases.length <= 1) { if (lv.cases && lv.cases.length === 1) app.caseIdx = 0; tabs.classList.toggle('hidden', !lv.cases || lv.cases.length < 2); return; }
    tabs.classList.remove('hidden');
    lv.cases.forEach((c, i) => {
      const b = h('button', { class: 'case-tab' + (i === app.caseIdx ? ' active' : '') }, c.name);
      b.addEventListener('click', () => { app.caseIdx = i; stopPlayback(); buildCaseTabs(); });
      tabs.append(b);
    });
  }

  function updateHud() {
    const lv = app.level;
    const heat = app.trace ? countHeatSoFar() : 0;
    $('#hud-heat').innerHTML = `♨ <b>${heat}</b>${lv.parHeat !== undefined && isFinite(lv.parHeat) ? ' / par ' + lv.parHeat : ''}`;
    $('#hud-parts').innerHTML = `▣ <b>${placedCount()}</b>${isFinite(lv.parElements) ? ' / par ' + lv.parElements : ''}`;
    for (const k of Object.keys(app.paletteLeft)) {
      const n = $('#pal-count-' + k); if (n) n.textContent = '×' + app.paletteLeft[k];
    }
    $('#btn-run').textContent = app.playing ? '❚❚ Pause' : '▶ Run';
  }

  // ───────────────────────── inspector ─────────────────────────
  function renderInspector() {
    const box = $('#inspector');
    box.innerHTML = '';
    const sel = app.selection;
    if (!sel) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    if (sel.kind === 'wire') {
      box.append(h('span', { class: 'insp-name' }, 'Wire'));
      box.append(h('button', { class: 'mini warn', onclick: () => { deleteWire(sel.id); } }, '✕ delete'));
      return;
    }
    const el = app.elements.find(e => e.id === sel.id);
    if (!el) { box.classList.add('hidden'); return; }
    const t = F.TYPES[el.type];
    box.append(h('span', { class: 'insp-name' }, t.name + (el.locked ? ' 🔒' : '')));
    if (!el.locked) {
      box.append(h('button', { class: 'mini', title: 'rotate (R)', onclick: () => rotateSelection() }, '⟳ rotate'));
    }
    if (t.id === 'ROTARY' && !el.locked) {
      box.append(h('button', {
        class: 'mini', onclick: () => { el.cfg = el.cfg || {}; el.cfg.ccw = !el.cfg.ccw; SFX.toggle(); renderInspector(); },
      }, el.cfg && el.cfg.ccw ? '↺ CCW' : '↻ CW'));
    }
    if (t.id === 'PFG' && !el.locked) {
      box.append(h('button', {
        class: 'mini', onclick: () => { el.cfg = el.cfg || {}; el.cfg.bias = -(el.cfg.bias || 1); SFX.toggle(); renderInspector(); },
      }, 'bias: ' + ((el.cfg && el.cfg.bias) === -1 ? '−' : '+')));
    }
    if (t.states && t.playerSettable && !el.stateLocked) {
      box.append(h('button', {
        class: 'mini', onclick: () => {
          const states = t.states; const i = states.indexOf(el.state);
          el.state = states[(i + 1) % states.length]; SFX.toggle(); renderInspector();
        },
      }, 'initial state: ' + stateLabel(el.state)));
    }
    if (app.level.sandbox && t.id === 'LAUNCHER') {
      const pats = [[1], [1, 1], [1, 1, 1], [-1], [1, -1], [-1, 1], [1, -1, 1, -1], [1, 1, -1]];
      el.pattern = el.pattern || [1];
      box.append(h('button', {
        class: 'mini', onclick: () => {
          const i = pats.findIndex(p => JSON.stringify(p) === JSON.stringify(el.pattern));
          el.pattern = pats[(i + 1) % pats.length]; renderInspector();
        },
      }, 'fires: ' + el.pattern.map(p => p === 1 ? '+' : '−').join(' ')));
    }
    if (el.placed || (!el.locked && !F.TYPES[el.type].io)) {
      if (el.placed) box.append(h('button', { class: 'mini warn', onclick: () => deleteSelection() }, '✕ delete'));
    }
    box.append(h('span', { class: 'insp-blurb' }, t.blurb));
  }
  function stateLabel(s) { return s === 1 ? '+' : s === -1 ? '−' : String(s); }

  // ───────────────────────── editing ops ─────────────────────────
  function startPlacing(typeId) {
    if (app.paletteLeft[typeId] <= 0) return;
    stopPlayback();
    app.mode = 'placing';
    app.placing = { type: typeId, rot: 0 };
    app.selection = null;
    renderInspector();
  }

  function tryPlace(gx, gy) {
    const tdef = F.TYPES[app.placing.type];
    const sz = F.rotatedSize(tdef, app.placing.rot);
    const lv = app.level;
    if (gx < 0 || gy < 0 || gx + sz.w > lv.size.w || gy + sz.h > lv.size.h) return;
    if (overlapsAny(gx, gy, sz, null)) return;
    const el = {
      id: 'p' + (app.nextId++), type: app.placing.type, x: gx, y: gy, rot: app.placing.rot,
      state: tdef.states ? tdef.defaultState : null,
      cfg: tdef.config ? { ...tdef.config } : undefined,
      locked: false, stateLocked: false, placed: true,
    };
    app.elements.push(el);
    app.paletteLeft[app.placing.type]--;
    SFX.place();
    if (app.paletteLeft[app.placing.type] <= 0) { app.mode = 'idle'; app.placing = null; }
    app.selection = { kind: 'el', id: el.id };
    updateHud(); renderInspector();
  }

  function overlapsAny(gx, gy, sz, ignoreId) {
    for (const e of app.elements) {
      if (e.id === ignoreId) continue;
      const t = F.TYPES[e.type], s2 = F.rotatedSize(t, e.rot || 0);
      if (gx < e.x + s2.w && gx + sz.w > e.x && gy < e.y + s2.h && gy + sz.h > e.y) return true;
    }
    return false;
  }

  function rotateSelection() {
    if (app.mode === 'placing') { app.placing.rot = (app.placing.rot + 1) % 4; return; }
    const sel = app.selection;
    if (!sel || sel.kind !== 'el') return;
    const el = app.elements.find(e => e.id === sel.id);
    if (!el || el.locked) return;
    el.rot = ((el.rot || 0) + 1) % 4;
    SFX.place();
  }

  function deleteSelection() {
    const sel = app.selection;
    if (!sel) return;
    if (sel.kind === 'wire') return deleteWire(sel.id);
    const el = app.elements.find(e => e.id === sel.id);
    if (!el || !el.placed) return;
    app.wires = app.wires.filter(w => w.a.el !== el.id && w.b.el !== el.id);
    app.elements = app.elements.filter(e => e.id !== el.id);
    app.paletteLeft[el.type] = (app.paletteLeft[el.type] || 0) + 1;
    app.selection = null;
    SFX.wire();
    updateHud(); renderInspector();
  }

  function deleteWire(id) {
    app.wires = app.wires.filter(w => w.id !== id);
    if (app.selection && app.selection.kind === 'wire' && app.selection.id === id) app.selection = null;
    SFX.wire();
    renderInspector();
  }

  function portFree(elId, portName) {
    return !app.wires.some(w => (w.a.el === elId && w.a.port === portName) || (w.b.el === elId && w.b.port === portName));
  }

  function finishWire(to) {
    const from = app.wiring.from;
    if (from.el === to.el && from.port === to.port) return;
    if (!portFree(to.el, to.port)) return;
    app.wires.push({
      id: 'w' + (app.nextId++),
      a: { el: from.el, port: from.port }, b: { el: to.el, port: to.port },
      via: app.wiring.via.slice(),
    });
    app.mode = 'idle'; app.wiring = null;
    SFX.wire();
  }

  // ───────────────────────── geometry / hit testing ─────────────────────────
  let canvas, ctx;
  function sizeCanvas() {
    const lv = app.level; if (!lv) return;
    canvas.width = lv.size.w * CELL;
    canvas.height = lv.size.h * CELL;
    canvas.style.aspectRatio = `${lv.size.w} / ${lv.size.h}`;
  }
  function mousePos(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * (canvas.width / r.width) / CELL, y: (ev.clientY - r.top) * (canvas.height / r.height) / CELL };
  }
  function portAt(x, y) {
    for (const el of app.elements) {
      const t = F.TYPES[el.type];
      for (const p of t.ports) {
        const rp = F.rotatedPort(t, p, el.rot || 0);
        const px = el.x + rp.x, py = el.y + rp.y;
        if (Math.hypot(px - x, py - y) < 0.34) return { el: el.id, port: p.name, x: px, y: py };
      }
    }
    return null;
  }
  function elementAt(x, y) {
    for (let i = app.elements.length - 1; i >= 0; i--) {
      const el = app.elements[i];
      const t = F.TYPES[el.type], sz = F.rotatedSize(t, el.rot || 0);
      if (x >= el.x && x <= el.x + sz.w && y >= el.y && y <= el.y + sz.h) return el;
    }
    return null;
  }
  function wireAt(x, y) {
    for (const w of app.wires) {
      const pts = E.wirePath(circuit(), w);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const d = distToSeg(x, y, a, b);
        if (d < 0.22) return w;
      }
    }
    return null;
  }
  function distToSeg(x, y, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const L2 = dx * dx + dy * dy;
    let t = L2 ? ((x - a.x) * dx + (y - a.y) * dy) / L2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t));
  }

  // ───────────────────────── playback ─────────────────────────
  function runCurrentCase() {
    const lv = app.level;
    stopPlayback();
    if (lv.sandbox) return runSandbox();
    if (!lv.cases.length) return;
    const cs = lv.cases[app.caseIdx];
    const r = E.runCase(circuit(), cs, 0, { optional: lv.optionalDetectors || [] });
    beginPlayback(r.trace, { pass: r.pass, reasons: r.reasons });
  }

  function runSandbox() {
    const inputs = [];
    let t = 0.6;
    const launchers = app.elements.filter(e => e.type === 'LAUNCHER');
    const maxLen = Math.max(0, ...launchers.map(l => (l.pattern || [1]).length));
    for (let i = 0; i < maxLen; i++) {
      for (const l of launchers) {
        const pat = l.pattern || [1];
        if (i < pat.length) { inputs.push({ t, launcher: l.id, pol: pat[i] }); t += 1.5; }
      }
    }
    const trace = E.simulate(circuit(), inputs);
    beginPlayback(trace, null);
  }

  function beginPlayback(trace, result) {
    app.trace = trace;
    app.playT = 0;
    app.playing = true;
    app.playCase = app.caseIdx;
    app.evCursor = { state: 0, heat: 0, det: 0, arr: 0, flip: 0 };
    // polarity-flip events: where a pulse's polarity changes between segments
    // (twists, RM/BSR exchanges, inverting reflectors) — for a visual flash
    app.flipEvents = [];
    for (const p of trace.pulses) {
      for (let i = 1; i < p.segs.length; i++) {
        if (p.segs[i].pol !== undefined && p.segs[i].pol !== p.segs[i - 1].pol) {
          app.flipEvents.push({ t: p.segs[i].t0, wire: p.segs[i].wire, fromA: p.segs[i].fromA, pol: p.segs[i].pol });
        }
      }
    }
    app.flipEvents.sort((a, b) => a.t - b.t);
    app.liveStates = new Map(app.elements.map(e => [e.id, e.state]));
    app.liveDetections = {}; for (const k of Object.keys(trace.detections)) app.liveDetections[k] = [];
    app.particles = [];
    app.runResult = null;
    app.banner = null;
    app.pendingResult = result;
    SFX.launch();
    updateHud();
  }

  function stopPlayback() {
    app.trace = null; app.playing = false; app.playT = 0; app.banner = null; app.runResult = null;
    app.liveStates = new Map(app.elements.map(e => [e.id, e.state]));
    app.particles = [];
    updateHud();
  }

  function countHeatSoFar() {
    if (!app.trace) return 0;
    let s = 0;
    for (const hv of app.trace.heatEvents) if (hv.t <= app.playT) s += hv.amount;
    return s;
  }

  function advancePlayback(dt) {
    const tr = app.trace;
    if (!tr || !app.playing) return;
    app.playT += dt * app.speed;
    const T = app.playT;
    // state changes
    while (app.evCursor.state < tr.stateChanges.length && tr.stateChanges[app.evCursor.state].t <= T) {
      const sc = tr.stateChanges[app.evCursor.state++];
      app.liveStates.set(sc.el, sc.to);
      SFX.toggle();
    }
    // arrivals (op clicks)
    while (app.evCursor.arr < tr.arrivals.length && tr.arrivals[app.evCursor.arr].t <= T) {
      app.evCursor.arr++; SFX.op();
    }
    // polarity flips: flash a ring in the NEW color where the change happened
    while (app.evCursor.flip < (app.flipEvents || []).length && app.flipEvents[app.evCursor.flip].t <= T) {
      const fe = app.flipEvents[app.evCursor.flip++];
      const w = app.wires.find(x => x.id === fe.wire);
      if (w) {
        const g = E.wirePath(circuit(), w);
        const pts = fe.fromA ? g : [...g].reverse();
        spawnRing(pts[0].x * CELL, pts[0].y * CELL, R.polColor(fe.pol));
      }
      SFX.toggle();
    }
    // heat
    while (app.evCursor.heat < tr.heatEvents.length && tr.heatEvents[app.evCursor.heat].t <= T) {
      const hv = tr.heatEvents[app.evCursor.heat++];
      spawnHeat(hv.x * CELL, hv.y * CELL, hv.amount);
      SFX.heat();
      updateHud();
    }
    // detections
    let detChanged = false;
    for (const det of Object.keys(tr.detections)) {
      const all = tr.detections[det];
      const live = app.liveDetections[det];
      while (live.length < all.length && all[live.length].t <= T) {
        live.push(all[live.length]); detChanged = true;
        const el = app.elements.find(e => e.id === det);
        if (el) spawnRing((el.x + 0.5) * CELL, (el.y + 0.5) * CELL, R.COL.ok);
        SFX.detect();
      }
    }
    // fault
    if (tr.fault && T >= tr.fault.t && !app.banner) {
      app.playing = false;
      if (tr.fault.x != null) {
        spawnRing(tr.fault.x * CELL, tr.fault.y * CELL, R.COL.bad);
        for (let i = 0; i < 14; i++) spawnSpark(tr.fault.x * CELL, tr.fault.y * CELL, R.COL.bad);
      }
      app.banner = { kind: 'fault', text: tr.fault.msg };
      SFX.fault();
      updateHud();
      return;
    }
    // end of run
    if (!tr.fault && T >= tr.tEnd + 0.6 && !app.banner) {
      app.playing = false;
      if (app.pendingResult) {
        const ok = app.pendingResult.pass;
        app.banner = ok
          ? { kind: 'ok', text: `Case “${app.level.cases[app.playCase].name}” ✓ — now press CERTIFY to test every case under timing wobble.` }
          : { kind: 'fail', text: 'Not quite: ' + app.pendingResult.reasons.join(' · ') };
        if (ok) SFX.detect(); else SFX.fault();
      } else {
        app.banner = { kind: 'ok', text: `Run complete. Heat: ${tr.heat}` };
      }
      updateHud();
    }
  }

  function spawnHeat(x, y, amount) {
    const now = performance.now() / 1000;
    for (let i = 0; i < 4 + amount * 2; i++) {
      app.particles.push({ kind: 'heat', x, y, vx: (Math.random() - 0.5) * 2, vy: -Math.random() * 1.6, t0: now, life: 0.9 });
    }
    app.particles.push({ kind: 'text', x, y: y - 8, text: `+${amount} heat`, t0: now, life: 1.2 });
  }
  function spawnRing(x, y, color) {
    app.particles.push({ kind: 'ring', x, y, color, t0: performance.now() / 1000, life: 0.7 });
  }
  function spawnSpark(x, y, color) {
    const a = Math.random() * 6.28;
    app.particles.push({ kind: 'spark', x, y, vx: Math.cos(a) * (0.5 + Math.random()), vy: Math.sin(a) * (0.5 + Math.random()), color, t0: performance.now() / 1000, life: 0.8 });
  }

  // ───────────────────────── certify ─────────────────────────
  function certify() {
    const lv = app.level;
    if (lv.sandbox) { runSandbox(); return; }
    stopPlayback();
    const res = E.certify(circuit(), lv.cases, [0, 1, 2, 3, 4, 5, 6], { optional: lv.optionalDetectors || [] });
    app.certifyResult = res;
    let stars = 0;
    if (res.pass) {
      stars = 1;
      if (placedCount() <= lv.parElements) stars++;
      if (res.heatMax <= lv.parHeat) stars++;
      const prev = progress.levels[lv.id] || {};
      progress.levels[lv.id] = { done: true, stars: Math.max(prev.stars || 0, stars) };
      store.save(progress);
      SFX.win();
    } else SFX.fault();
    showCertifyModal(res, stars);
  }

  function showCertifyModal(res, stars) {
    const lv = app.level;
    const m = $('#modal'); m.classList.remove('hidden');
    const box = $('#modal-box'); box.innerHTML = '';
    box.append(h('h2', { class: res.pass ? 'ok' : 'bad' }, res.pass ? '✓ CERTIFIED' : '✗ Not yet'));
    if (res.pass) {
      box.append(h('div', { class: 'stars-big' },
        `${'★'.repeat(stars)}${'☆'.repeat(3 - stars)}`));
      const why = [];
      why.push('✓ all cases pass under timing wobble');
      why.push((placedCount() <= lv.parElements ? '✓' : '✗') + ` element budget (${placedCount()} / ${lv.parElements})`);
      why.push((res.heatMax <= lv.parHeat ? '✓' : '✗') + ` heat budget (${res.heatMax} / ${lv.parHeat})`);
      box.append(h('div', { class: 'why' }, ...why.map(w => h('div', {}, w))));
      if (lv.success) box.append(h('p', { class: 'story', html: lv.success }));
    } else {
      for (const c of res.perCase) {
        box.append(h('div', { class: 'case-res ' + (c.pass ? 'ok' : 'bad') },
          h('b', {}, (c.pass ? '✓ ' : '✗ ') + c.name), c.pass ? '' : h('div', { class: 'reasons' }, c.reasons.join(' · '))));
      }
      if (lv.hint) box.append(h('p', { class: 'hint', html: '💡 ' + lv.hint }));
    }
    const row = h('div', { class: 'modal-btns' });
    row.append(h('button', { class: 'big', onclick: closeModal }, res.pass ? 'Stay & tinker' : 'Back to the bench'));
    if (res.pass) {
      const next = nextLevel(lv);
      row.append(h('button', { class: 'big primary', onclick: () => { closeModal(); next ? loadLevel(next) : showScreen('levels'); } },
        next ? 'Next: ' + next.title + ' →' : 'Level select'));
    }
    box.append(row);
  }

  function nextLevel(lv) {
    const i = F.LEVELS.indexOf(lv);
    return i >= 0 && i + 1 < F.LEVELS.length ? F.LEVELS[i + 1] : null;
  }

  // ───────────────────────── modals: story & notebook ─────────────────────────
  function showStory(title, html, btnText) {
    const m = $('#modal'); m.classList.remove('hidden');
    const box = $('#modal-box'); box.innerHTML = '';
    box.append(h('h2', {}, title));
    box.append(h('p', { class: 'story', html }));
    box.append(h('div', { class: 'modal-btns' }, h('button', { class: 'big primary', onclick: closeModal }, btnText || 'Close')));
  }
  function closeModal() { $('#modal').classList.add('hidden'); }

  function showNotebook() {
    const m = $('#modal'); m.classList.remove('hidden');
    const box = $('#modal-box'); box.innerHTML = '';
    box.append(h('h2', {}, '📓 Lab Notebook'));
    const wrap = h('div', { class: 'notebook' });
    const order = Object.keys(F.NOTEBOOK);
    let shown = 0;
    for (const id of order) {
      const entry = F.NOTEBOOK[id];
      if (progress.notebook.includes(id) || id === 'refs') {
        wrap.append(h('details', {}, h('summary', {}, entry.title), h('div', { class: 'nb-body', html: entry.body })));
        shown++;
      } else {
        wrap.append(h('details', { class: 'locked' }, h('summary', {}, '🔒 ' + entry.title)));
      }
    }
    box.append(h('p', { class: 'dim' }, `${shown} of ${order.length} entries unlocked — keep playing to fill the notebook.`));
    box.append(wrap);
    box.append(h('div', { class: 'modal-btns' }, h('button', { class: 'big primary', onclick: closeModal }, 'Close')));
  }

  function exportDesign() {
    const data = JSON.stringify({ level: app.level.id, elements: app.elements, wires: app.wires }, null, 1);
    navigator.clipboard && navigator.clipboard.writeText(data);
    showStory('Design exported', 'Your circuit JSON has been copied to the clipboard.<br><br><textarea style="width:100%;height:180px">' + data.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</textarea>');
  }

  // ───────────────────────── main draw loop ─────────────────────────
  let lastFrame = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (app.screen !== 'game' || !app.level) return;
    const dt = Math.min(0.05, (ts - lastFrame) / 1000 || 0.016);
    lastFrame = ts;
    advancePlayback(dt);

    const lv = app.level;
    R.drawBoard(ctx, lv.size.w, lv.size.h, ts / 1000);

    // wires
    const cir = circuit();
    for (const w of app.wires) {
      const pts = E.wirePath(cir, w);
      R.drawWire(ctx, pts, { selected: app.selection && app.selection.kind === 'wire' && app.selection.id === w.id });
    }
    // wiring preview
    if (app.mode === 'wiring' && app.wiring) {
      const pts = [{ x: app.wiring.fromPos.x, y: app.wiring.fromPos.y }];
      let cur = pts[0];
      for (const v of app.wiring.via.concat([app.mouse])) {
        if (v.x !== cur.x && v.y !== cur.y) pts.push({ x: v.x, y: cur.y });
        pts.push({ x: v.x, y: v.y });
        cur = v;
      }
      R.drawWire(ctx, pts, { preview: true });
    }

    // wired ports set
    const wired = new Set();
    for (const w of app.wires) { wired.add(w.a.el + ':' + w.a.port); wired.add(w.b.el + ':' + w.b.port); }

    // elements
    for (const el of app.elements) {
      const st = app.trace ? app.liveStates.get(el.id) : el.state;
      R.drawElement(ctx, el, st, {
        selected: app.selection && app.selection.kind === 'el' && app.selection.id === el.id,
        time: ts / 1000,
      });
      R.drawPorts(ctx, el, F.TYPES[el.type], app.hoverPort, wired);
    }

    // labels + IO chips
    drawLabelsAndChips();

    // ghost placement
    if (app.mode === 'placing' && app.placing) {
      const t = F.TYPES[app.placing.type];
      const sz = F.rotatedSize(t, app.placing.rot);
      const gx = Math.round(app.mouse.x - sz.w / 2), gy = Math.round(app.mouse.y - sz.h / 2);
      const ghost = { id: 'ghost', type: app.placing.type, x: gx, y: gy, rot: app.placing.rot, cfg: t.config ? { ...t.config } : undefined };
      R.drawElement(ctx, ghost, t.states ? t.defaultState : null, { ghost: true, time: ts / 1000 });
    }

    // pulses
    if (app.trace) {
      const T = app.playT;
      for (const p of app.trace.pulses) {
        for (const s of p.segs) {
          if (T >= s.t0 && T <= s.t1) {
            const g = E.wirePath(cir, app.wires.find(w => w.id === s.wire) || wireById(s.wire));
            const pts = s.fromA ? g : [...g].reverse();
            const d = E.SPEED * (T - s.t0);
            const pos = E.pointAlong(pts, d);
            R.drawPulse(ctx, pos.x, pos.y, s.pol !== undefined ? s.pol : p.pol, !lv.bipolar, ts / 1000);
          }
        }
      }
    }

    // particles
    R.drawParticles(ctx, app.particles, performance.now() / 1000);
    app.particles = app.particles.filter(p => (performance.now() / 1000 - p.t0) < p.life);

    // banner
    drawBanner();
  }
  function wireById(id) { return app.wires.find(w => w.id === id); }

  function drawLabelsAndChips() {
    const lv = app.level;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const el of app.elements) {
      const t = F.TYPES[el.type];
      const sz = F.rotatedSize(t, el.rot || 0);
      const label = (lv.labels || {})[el.id];
      if (label) {
        ctx.fillStyle = R.COL.dim;
        const ly = (el.y + sz.h) * CELL + 12;
        if (ly > canvas.height - 4) {
          // too close to the bottom edge: draw the label beside the element instead
          ctx.textAlign = 'right';
          ctx.fillText(label, el.x * CELL - 7, (el.y + sz.h / 2) * CELL + 4);
          ctx.textAlign = 'center';
        } else {
          ctx.fillText(label, (el.x + sz.w / 2) * CELL, ly);
        }
      }
      // launcher sequence chips
      if (el.type === 'LAUNCHER' && !lv.sandbox && lv.cases.length) {
        const cs = lv.cases[app.caseIdx];
        const seq = cs.inputs.map((inp, i) => ({ ...inp, i })).filter(inp => inp.launcher === el.id);
        seq.forEach((inp, k) => {
          const x = (el.x + 0.5 + (k - (seq.length - 1) / 2) * 0.42) * CELL, y = (el.y - 0.32) * CELL;
          ctx.beginPath(); ctx.arc(x, y, 6, 0, 7);
          ctx.fillStyle = lv.bipolar ? R.polColor(inp.pol) : '#cdeeff';
          ctx.globalAlpha = app.trace && launchedAlready(inp) ? 0.25 : 1;
          ctx.fill(); ctx.globalAlpha = 1;
          ctx.fillStyle = '#08131f'; ctx.font = '700 8px system-ui';
          ctx.fillText(String(inp.i + 1), x, y + 2.6);
          ctx.font = '600 11px system-ui, sans-serif';
        });
      }
      if (el.type === 'LAUNCHER' && lv.sandbox) {
        const pat = el.pattern || [1];
        pat.forEach((pol, k) => {
          const x = (el.x + 0.5 + (k - (pat.length - 1) / 2) * 0.42) * CELL, y = (el.y - 0.32) * CELL;
          ctx.beginPath(); ctx.arc(x, y, 5, 0, 7);
          ctx.fillStyle = R.polColor(pol); ctx.fill();
        });
      }
      // detector expectation chips
      if (el.type === 'DETECTOR' && !lv.sandbox && lv.cases.length) {
        const cs = lv.cases[app.caseIdx];
        const want = (cs.expect || {})[el.id] || [];
        const got = app.trace ? (app.liveDetections[el.id] || []) : [];
        const optional = (lv.optionalDetectors || []).includes(el.id);
        const n = Math.max(want.length, got.length);
        for (let k = 0; k < n; k++) {
          const x = (el.x + 0.5 + (k - (n - 1) / 2) * 0.46) * CELL, y = (el.y - 0.34) * CELL;
          ctx.beginPath(); ctx.arc(x, y, 6.4, 0, 7);
          if (k < got.length) {
            const okPol = k < want.length && got[k].pol === want[k];
            ctx.fillStyle = lv.bipolar ? R.polColor(got[k].pol) : '#cdeeff';
            ctx.fill();
            ctx.strokeStyle = optional ? R.COL.dim : (okPol ? R.COL.ok : R.COL.bad);
            ctx.lineWidth = 2; ctx.stroke();
          } else {
            ctx.strokeStyle = lv.bipolar && k < want.length ? R.polColor(want[k]) : 'rgba(180,210,240,0.5)';
            ctx.setLineDash([2, 2]); ctx.lineWidth = 1.4; ctx.stroke(); ctx.setLineDash([]);
            if (k < want.length) {
              ctx.fillStyle = lv.bipolar ? R.polColor(want[k]) : 'rgba(205,238,255,0.8)';
              ctx.font = '700 9px system-ui';
              ctx.fillText(want[k] === -1 ? '−' : '+', x, y + 3);
              ctx.font = '600 11px system-ui, sans-serif';
            }
          }
        }
        if (optional && n === 0) {
          ctx.fillStyle = R.COL.dim; ctx.fillText('(anything)', (el.x + 0.5) * CELL, (el.y - 0.3) * CELL);
        }
      }
    }
  }

  function launchedAlready(inp) {
    if (!app.trace) return false;
    // pulses are born in input order
    const idx = app.level.cases[app.playCase].inputs.indexOf(inp.i !== undefined ? app.level.cases[app.playCase].inputs[inp.i] : inp);
    const pulse = app.trace.pulses[inp.i];
    return pulse && app.playT >= pulse.born;
  }

  function drawBanner() {
    if (!app.banner) return;
    const lv = app.level;
    const W = lv.size.w * CELL;
    const colors = { fault: 'rgba(120,28,38,0.92)', fail: 'rgba(120,70,28,0.92)', ok: 'rgba(22,90,64,0.92)' };
    ctx.fillStyle = colors[app.banner.kind] || colors.ok;
    const lines = wrapText(app.banner.text, W - 60);
    const hgt = 26 + lines.length * 17;
    ctx.fillRect(20, 16, W - 40, hgt);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.strokeRect(20, 16, W - 40, hgt);
    ctx.fillStyle = '#fff'; ctx.font = '600 12.5px system-ui, sans-serif'; ctx.textAlign = 'left';
    lines.forEach((ln, i) => ctx.fillText(ln, 34, 38 + i * 17));
    ctx.textAlign = 'center';
  }
  function wrapText(text, maxW) {
    const words = String(text).split(' ');
    const lines = []; let cur = '';
    ctx.font = '600 12.5px system-ui, sans-serif';
    for (const w of words) {
      const trial = cur ? cur + ' ' + w : w;
      if (ctx.measureText(trial).width > maxW - 24 && cur) { lines.push(cur); cur = w; }
      else cur = trial;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // ───────────────────────── input events ─────────────────────────
  function onMouseMove(ev) {
    const m = mousePos(ev);
    app.mouse = { x: Math.round(m.x * 2) / 2, y: Math.round(m.y * 2) / 2 };
    app.mouseRaw = m;
    app.hoverPort = portAt(m.x, m.y);
    if (app.mode === 'dragging' && app.dragEl) {
      const t = F.TYPES[app.dragEl.type], sz = F.rotatedSize(t, app.dragEl.rot || 0);
      const gx = Math.round(m.x - app.dragOff.x), gy = Math.round(m.y - app.dragOff.y);
      if (gx >= 0 && gy >= 0 && gx + sz.w <= app.level.size.w && gy + sz.h <= app.level.size.h &&
        !overlapsAny(gx, gy, sz, app.dragEl.id)) {
        app.dragEl.x = gx; app.dragEl.y = gy;
      }
    }
  }

  function onMouseDown(ev) {
    if (ev.button === 2) return;
    const m = mousePos(ev);
    if (app.mode === 'placing') { tryPlace(Math.round(m.x - F.rotatedSize(F.TYPES[app.placing.type], app.placing.rot).w / 2), Math.round(m.y - F.rotatedSize(F.TYPES[app.placing.type], app.placing.rot).h / 2)); return; }
    const port = portAt(m.x, m.y);
    if (app.mode === 'wiring') {
      if (port) { finishWire({ el: port.el, port: port.port }); }
      else { app.wiring.via.push({ x: Math.round(m.x * 2) / 2, y: Math.round(m.y * 2) / 2 }); }
      return;
    }
    if (port && portFree(port.el, port.port)) {
      stopPlayback();
      app.mode = 'wiring';
      app.wiring = { from: { el: port.el, port: port.port }, fromPos: { x: port.x, y: port.y }, via: [] };
      app.selection = null; renderInspector();
      return;
    }
    const el = elementAt(m.x, m.y);
    if (el) {
      app.selection = { kind: 'el', id: el.id };
      renderInspector();
      if (!el.locked) {
        app.mode = 'dragging';
        app.dragEl = el;
        app.dragOff = { x: m.x - el.x, y: m.y - el.y };
        stopPlayback();
      }
      return;
    }
    const w = wireAt(m.x, m.y);
    if (w) { app.selection = { kind: 'wire', id: w.id }; renderInspector(); return; }
    app.selection = null; renderInspector();
  }

  function onMouseUp() {
    if (app.mode === 'dragging') { app.mode = 'idle'; app.dragEl = null; }
  }

  function onContextMenu(ev) {
    ev.preventDefault();
    const m = mousePos(ev);
    if (app.mode === 'placing') { app.mode = 'idle'; app.placing = null; return; }
    if (app.mode === 'wiring') { app.mode = 'idle'; app.wiring = null; return; }
    const w = wireAt(m.x, m.y);
    if (w) { stopPlayback(); deleteWire(w.id); return; }
    const el = elementAt(m.x, m.y);
    if (el && el.placed) { stopPlayback(); app.selection = { kind: 'el', id: el.id }; deleteSelection(); }
  }

  function onKey(ev) {
    if (app.screen !== 'game') return;
    if (ev.target && /INPUT|TEXTAREA/.test(ev.target.tagName)) return;
    if (ev.key === 'r' || ev.key === 'R') rotateSelection();
    else if (ev.key === 'Escape') {
      if (app.mode === 'placing') { app.mode = 'idle'; app.placing = null; }
      else if (app.mode === 'wiring') { app.mode = 'idle'; app.wiring = null; }
      else { app.selection = null; renderInspector(); }
      closeModal();
    }
    else if (ev.key === 'Delete' || ev.key === 'Backspace') { stopPlayback(); deleteSelection(); }
    else if (ev.key === ' ') { ev.preventDefault(); togglePlay(); }
  }

  function togglePlay() {
    if (!app.trace) runCurrentCase();
    else { app.playing = !app.playing; if (app.playing && app.banner) { stopPlayback(); runCurrentCase(); } }
    updateHud();
  }

  // ───────────────────────── boot ─────────────────────────
  function boot() {
    canvas = $('#board');
    ctx = canvas.getContext('2d');

    $('#btn-start').addEventListener('click', () => { showScreen('levels'); });
    $('#btn-levels').addEventListener('click', () => { showScreen('levels'); });
    $('#btn-run').addEventListener('click', togglePlay);
    $('#btn-reset').addEventListener('click', stopPlayback);
    $('#btn-certify').addEventListener('click', certify);
    $('#btn-story').addEventListener('click', () => showStory(app.level.title, app.level.intro));
    $('#btn-hint').addEventListener('click', () => showStory('Hint', app.level.hint || 'No hint for this one — trust the physics.'));
    $('#btn-notebook').addEventListener('click', showNotebook);
    $('#btn-notebook-title').addEventListener('click', showNotebook);
    $('#btn-export').addEventListener('click', exportDesign);
    $('#btn-mute').addEventListener('click', () => {
      progress.muted = !progress.muted; store.save(progress);
      $('#btn-mute').textContent = progress.muted ? '🔇' : '🔊';
    });
    $('#btn-mute').textContent = progress.muted ? '🔇' : '🔊';
    $('#speed').addEventListener('input', ev => { app.speed = Number(ev.target.value); $('#speed-label').textContent = app.speed + '\u00d7'; });
    $('#modal').addEventListener('click', ev => { if (ev.target.id === 'modal') closeModal(); });

    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('contextmenu', onContextMenu);
    window.addEventListener('keydown', onKey);

    showScreen('title');
    requestAnimationFrame(frame);
  }

  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('DOMContentLoaded', boot);
  }

  // test/debug hooks (harmless in production)
  F._ui = { app, boot, loadLevel, runCurrentCase, certify, advancePlayback, frame, showScreen, stopPlayback, buildLevelSelect, showNotebook, startPlacing, tryPlace, deleteSelection, finishWire };
})();

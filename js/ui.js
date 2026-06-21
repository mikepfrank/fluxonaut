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
  progress.notebookUnread = progress.notebookUnread || [];

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
    placing: null,            // {type, rot, mir}
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
      if (k === 'html') e.innerHTML = attrs[k];
      else if (k.startsWith('on') && typeof attrs[k] === 'function') e.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
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
          h('div', { class: 'lv-stars' }, '★'.repeat(stars) + '☆'.repeat(4 - stars)));
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
    app.caseDone = {}; app._tabSig = null;
    app.hintShown = false; app.hintUsed = false;
    app.particles = []; app.banner = null;
    const newPages = unlockNotebook(lv.notebook);
    showScreen('game');
    buildGameChrome();
    renderHintBar();
    renderBriefing();
    sizeCanvas();
    updateNotebookBadge();
    if (newPages.length) showNotebookToast(newPages.length);
  }

  function unlockNotebook(ids) {
    const added = [];
    for (const id of (ids || [])) if (!progress.notebook.includes(id)) { progress.notebook.push(id); added.push(id); }
    if (added.length) {
      progress.notebookUnread = (progress.notebookUnread || []).concat(added);
      store.save(progress);
    }
    return added;
  }
  // The toolbar 📓 button shows a dot while newly-unlocked pages are still unread.
  function updateNotebookBadge() {
    const b = $('#btn-notebook');
    if (b && b.classList) b.classList.toggle('has-unread', (progress.notebookUnread || []).length > 0);
  }
  // A temporary top-of-screen prompt the first time a level reveals new page(s).
  function showNotebookToast(n) {
    if (typeof document === 'undefined') return;
    let t = $('#nb-toast');
    if (!t) {
      t = h('div', { id: 'nb-toast', onclick: () => { hideNotebookToast(); showNotebook(); } });
      if (document.body) document.body.appendChild(t);
    }
    t.innerHTML = `📓 New Lab Notebook ${n > 1 ? 'pages' : 'page'} unlocked! ` +
      `<span class="nb-toast-cue">Tap the 📓 (top-right) to read ${n > 1 ? 'them' : 'it'} — free, no hint penalty.</span>`;
    t.classList.add('show');
    clearTimeout(app._nbToastTimer);
    const timer = setTimeout(hideNotebookToast, 6000);
    if (timer && timer.unref) timer.unref();   // don't keep the headless test process alive
    app._nbToastTimer = timer;
  }
  function hideNotebookToast() { const t = $('#nb-toast'); if (t && t.classList) t.classList.remove('show'); }

  function placedCount() {
    return app.elements.filter(e => e.placed).length;
  }

  function circuit() { return { elements: app.elements, wires: app.wires }; }

  // Compact signature of the simulate-relevant circuit state; used to clear the
  // per-case "passed" highlights whenever anything about the circuit changes.
  function circuitSig() {
    const es = app.elements.map(el => `${el.id}:${el.type}:${el.x},${el.y}:${el.rot || 0}:${el.mir ? 1 : 0}:${el.state}:${el.cfg ? JSON.stringify(el.cfg) : ''}`).join('|');
    const ws = app.wires.map(w => `${w.a.el}.${w.a.port}-${w.b.el}.${w.b.port}:${(w.via || []).map(v => v.x + ',' + v.y).join(';')}`).join('|');
    return es + '#' + ws;
  }

  // ───────────────────────── game chrome (DOM panels) ─────────────────────────
  function buildGameChrome() {
    const lv = app.level;
    $('#hud-title').textContent = (lv.sandbox ? '' : `${lv.bonus ? 'BONUS' : 'W' + lv.world + '·' + lv.n} — `) + lv.title;
    // palette
    const pal = $('#palette');
    pal.innerHTML = '';
    const keys = Object.keys(lv.palette || {});
    pal.classList.toggle('hidden', keys.length === 0);
    pal.classList.toggle('sandbox', !!lv.sandbox);
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
      const done = !!(app.caseDone && app.caseDone[i]);
      const b = h('button', { class: 'case-tab' + (i === app.caseIdx ? ' active' : '') + (done ? ' done' : '') }, (done ? '✓ ' : '') + c.name);
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
    if (t.transition && !t.io) {
      const showPol = !!(app.level && (app.level.sandbox || (app.level.world || 0) >= 3));   // polarity is introduced in World 3
      box.append(h('button', { class: 'mini', title: 'show this device’s transition rule', onclick: () => openRuleModal(t, el.cfg, showPol) }, '🔍 rule'));
    }
    if (!el.locked) {
      box.append(h('button', { class: 'mini', title: 'rotate (R)', onclick: () => rotateSelection() }, '⟳ rotate'));
      box.append(h('button', { class: 'mini', title: 'mirror (F)', onclick: () => { flipSelection(); renderInspector(); } }, '⇄ flip'));
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
    if (t.bentCycle && !el.locked) {
      const lab = { P: '+', M: '−', S: 'S' }, cur = (el.cfg && el.cfg.bent) || t.bentPort;
      box.append(h('button', {
        class: 'mini', title: 'which arm bends out (orthogonal to the other two)', onclick: () => {
          el.cfg = el.cfg || {};
          const cyc = t.bentCycle, i = cyc.indexOf(el.cfg.bent || t.bentPort);
          el.cfg.bent = cyc[(i + 1) % cyc.length]; SFX.toggle(); renderInspector();
        },
      }, 'bent arm: ' + (lab[cur] || cur)));
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
      const pulses = launcherPulses(el);
      box.append(h('div', { class: 'insp-sub' }, 'launch schedule · t in units (1 ≈ 16 ps)'));
      const list = h('div', { class: 'pulse-list' });
      pulses.forEach((p, k) => {
        list.append(h('div', { class: 'pulse-row' },
          h('input', {
            class: 'pulse-t', type: 'number', step: '0.5', min: '0', value: String(p.t),
            oninput: (ev) => { const v = parseFloat(ev.target.value); if (!isNaN(v) && v >= 0) p.t = v; },
          }),
          h('button', { class: 'mini', title: 'flip polarity', onclick: () => { p.pol = -p.pol; SFX.toggle(); renderInspector(); } }, p.pol === 1 ? '+' : '−'),
          h('button', { class: 'mini warn', title: 'remove pulse', onclick: () => { pulses.splice(k, 1); if (!pulses.length) pulses.push({ t: 1.5, pol: 1 }); renderInspector(); } }, '✕')));
      });
      box.append(list);
      box.append(h('button', {
        class: 'mini', onclick: () => { const last = pulses.length ? pulses[pulses.length - 1].t : 0; pulses.push({ t: Math.round((last + 1.5) * 2) / 2, pol: 1 }); renderInspector(); },
      }, '+ pulse'));
    }
    if (el.placed || (!el.locked && !F.TYPES[el.type].io)) {
      if (el.placed) box.append(h('button', { class: 'mini warn', onclick: () => deleteSelection() }, '✕ delete'));
    }
    box.append(h('span', { class: 'insp-blurb' }, t.blurb));
  }
  function stateLabel(s) { return s === 1 ? '+' : s === -1 ? '−' : String(s); }

  // ───────────── element "rule" inspector — the Mealy transition table ────────
  // Enumerate every input syndrome (incoming polarity, entry port, initial state) and the
  // output syndrome (final state, exit port, outgoing polarity) the element maps it to,
  // each tagged with heat (0 = dissipationless — the reversible "right-of-way" lane).
  function ruleRows(t, cfg, showPol) {
    const rows = [];
    for (const st of (t.states || [null])) for (const port of t.ports) for (const pol of (showPol ? [1, -1] : [1])) {
      let r; try { r = t.transition(port.name, pol, st, cfg || t.config); } catch (e) { r = null; }
      rows.push({ pol, port: port.name, st,
        out: (r && !r.absorb) ? { st: r.state, port: r.port, pol: r.pol } : null,
        absorb: !!(r && r.absorb), heat: (r && r.heat) || 0 });
    }
    return rows;
  }
  function _syn(t, kind, o, showPol) {
    const ps = p => p === 1 ? '+' : '−', pt = p => (t.portLabels && t.portLabels[p]) || p, parts = [];
    if (kind === 'in') { if (showPol) parts.push(ps(o.pol)); parts.push(pt(o.port)); if (o.st != null) parts.push(stateLabel(o.st)); }
    else { if (o.st != null) parts.push(stateLabel(o.st)); parts.push(pt(o.port)); if (showPol) parts.push(ps(o.pol)); }
    return `( ${parts.join(' , ')} )`;
  }
  // Lay the table out so lossless transitions are HORIZONTAL: group inputs by the output
  // they yield, anchor each output to its dissipationless (heat-0) input, list the other
  // (dissipative) inputs adjacent, and draw them as curved red "merges" into the shared
  // output row — no output row repeated. Returns an inline SVG string.
  function ruleSVG(t, cfg, showPol = true) {
    const rows = ruleRows(t, cfg, showPol);
    const groups = new Map(), extra = [];
    for (const r of rows) {
      if (!r.out) { extra.push(r); continue; }
      const k = _syn(t, 'out', r.out, showPol);
      if (!groups.has(k)) groups.set(k, { out: r.out, anchor: null, diss: [] });
      const g = groups.get(k);
      if (r.heat === 0 && !g.anchor) g.anchor = r; else g.diss.push(r);
    }
    for (const g of groups.values()) if (!g.anchor) g.anchor = g.diss.shift();   // all-dissipative output
    const inRows = [], outRows = [];
    for (const g of groups.values()) {
      const dIdx = [];
      for (const d of g.diss) { dIdx.push(inRows.length); inRows.push({ r: d, role: 'merge' }); }
      const ai = inRows.length; inRows.push({ r: g.anchor, role: 'anchor' });
      outRows.push({ out: g.out, ai, heat: g.anchor.heat, dIdx });
    }
    for (const e of extra) inRows.push({ r: e, role: e.absorb ? 'absorb' : 'fault' });
    const hasMerges = outRows.some(o => o.dIdx.length), stateful = !!t.states;
    const rowH = 28, top = 30, iR = 224, aL = 236, aR = 356, oL = 368, W = 560, H = top + inRows.length * rowH + 12;
    const ym = i => top + i * rowH + rowH / 2;
    let s = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="ttsvg">`;
    s += `<defs><marker id="mab" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#5fa8ff"/></marker>`;
    s += `<marker id="mar" markerWidth="9" markerHeight="9" refX="6.5" refY="3" orient="auto"><path d="M0,0 L7,3 L0,6 Z" fill="#ff6b6b"/></marker></defs>`;
    s += `<text x="${iR}" y="16" text-anchor="end" class="th">input · (${showPol ? 'pol, ' : ''}port${stateful ? ', state' : ''})</text>`;
    s += `<text x="${oL}" y="16" text-anchor="start" class="th">output · (${stateful ? 'state, ' : ''}port${showPol ? ', pol' : ''})</text>`;
    inRows.forEach((row, i) => {
      const y = ym(i), bad = row.role === 'fault' || row.role === 'absorb';
      s += `<text x="${iR}" y="${y + 4}" text-anchor="end" class="${bad ? 'tf' : 'tt'}">${_syn(t, 'in', row.r, showPol)}</text>`;
      if (row.role === 'fault') s += `<text x="${(aL + aR) / 2}" y="${y + 4}" text-anchor="middle" class="tf">↛ undefined</text>`;
      if (row.role === 'absorb') s += `<text x="${(aL + aR) / 2}" y="${y + 4}" text-anchor="middle" class="tf">⊥ absorbed</text>`;
    });
    outRows.forEach(o => {
      const y = ym(o.ai), blue = o.heat === 0;
      s += `<text x="${oL}" y="${y + 4}" text-anchor="start" class="tt">${_syn(t, 'out', o.out, showPol)}</text>`;
      s += `<line x1="${aL}" y1="${y}" x2="${aR}" y2="${y}" stroke="${blue ? '#5fa8ff' : '#ff6b6b'}" stroke-width="2.3" marker-end="url(#${blue ? 'mab' : 'mar'})"/>`;
      for (const di of o.dIdx) {
        const yd = ym(di), cx = (aL + aR) / 2;
        s += `<path d="M ${aL} ${yd} C ${cx} ${yd}, ${cx} ${y}, ${aR} ${y}" fill="none" stroke="#ff6b6b" stroke-width="2" marker-end="url(#mar)"/>`;
      }
    });
    return { svg: s + `</svg>`, hasMerges };
  }
  function openRuleModal(t, cfg, showPol = true) {
    if (typeof document === 'undefined') return;
    const { svg, hasMerges } = ruleSVG(t, cfg, showPol);
    $('#modal').classList.remove('hidden');
    const box = $('#modal-box'); box.innerHTML = '';
    box.append(h('h2', {}, t.name + ' — transition rule'));
    box.append(h('div', { class: 'rule-svg', html: svg }));
    box.append(h('div', { class: 'rule-note', html: hasMerges
      ? `<b class="cr">Conditionally reversible.</b> A red arrow is a <b>dissipative merge</b>: two distinct inputs collapse to one output, erasing a distinction and so shedding ≥ kT·ln2 of heat (Landauer). Like cars merging onto a highway — the blue lane has the right of way and flows free; the rest must brake to yield. That's the logic of <i>Generalized Reversible Computing</i> (2018).`
      : `<b class="rv">Reversible.</b> Every input maps to its own distinct output — the map is injective, so the device runs free: nothing merged, nothing erased, no heat owed.` }));
    box.append(h('div', { class: 'modal-btns' }, h('button', { class: 'big primary', onclick: closeModal }, 'Close')));
  }

  // ───────────────────────── editing ops ─────────────────────────
  function startPlacing(typeId) {
    if (app.paletteLeft[typeId] <= 0) return;
    stopPlayback();
    app.mode = 'placing';
    app.placing = { type: typeId, rot: 0, mir: false };
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
      mir: app.placing.mir,
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

  function flipSelection() {
    if (app.mode === 'placing') { app.placing.mir = !app.placing.mir; return; }
    const sel = app.selection;
    if (!sel || sel.kind !== 'el') return;
    const el = app.elements.find(e => e.id === sel.id);
    if (!el || el.locked) return;
    el.mir = !el.mir;
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

  // Detect a 180° reversal (a fold / self-overlap) in an orthogonalized polyline.
  function polylineHasReversal(pts) {
    const dirs = [];
    for (let i = 1; i < pts.length; i++) {
      const dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) continue;
      dirs.push({ x: Math.sign(dx), y: Math.sign(dy) });
    }
    for (let i = 1; i < dirs.length; i++) {
      if (dirs[i].x === -dirs[i - 1].x && dirs[i].y === -dirs[i - 1].y) return true;
    }
    return false;
  }
  // Orthogonalized polyline for an in-progress wire (start + waypoints), H-first elbows.
  function orthoFromVias(startPos, vias) {
    const pts = [{ x: startPos.x, y: startPos.y }];
    let cur = pts[0];
    for (const v of vias) {
      if (v.x !== cur.x && v.y !== cur.y) pts.push({ x: v.x, y: cur.y });
      pts.push({ x: v.x, y: v.y });
      cur = v;
    }
    return pts;
  }

  // Collinear-overlap detection so two wires never run on top of each other.
  function pathSegs(pts) {
    const segs = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9) continue;
      segs.push({ a, b, horiz: Math.abs(a.y - b.y) < 1e-9 });
    }
    return segs;
  }
  function segOverlap(s1, s2) {
    if (s1.horiz !== s2.horiz) return 0;
    if (s1.horiz) {
      if (Math.abs(s1.a.y - s2.a.y) > 1e-9) return 0;
      return Math.max(0, Math.min(Math.max(s1.a.x, s1.b.x), Math.max(s2.a.x, s2.b.x)) - Math.max(Math.min(s1.a.x, s1.b.x), Math.min(s2.a.x, s2.b.x)));
    }
    if (Math.abs(s1.a.x - s2.a.x) > 1e-9) return 0;
    return Math.max(0, Math.min(Math.max(s1.a.y, s1.b.y), Math.max(s2.a.y, s2.b.y)) - Math.max(Math.min(s1.a.y, s1.b.y), Math.min(s2.a.y, s2.b.y)));
  }
  function pathsOverlap(ptsA, ptsB) {
    const sa = pathSegs(ptsA), sb = pathSegs(ptsB);
    for (const s1 of sa) for (const s2 of sb) if (segOverlap(s1, s2) > 0.15) return true;  // >0.15 cell ignores point/stub touches
    return false;
  }
  function pathSelfOverlaps(pts) {
    const segs = pathSegs(pts);
    for (let i = 0; i < segs.length; i++)
      for (let j = i + 2; j < segs.length; j++)   // non-adjacent collinear runs = a loop back onto itself
        if (segOverlap(segs[i], segs[j]) > 0.15) return true;
    return false;
  }
  function wireOverlapsExisting(pts, ignoreId) {
    const cir = { elements: app.elements };
    for (const w of app.wires) {
      if (ignoreId && w.id === ignoreId) continue;
      if (pathsOverlap(pts, E.wirePath(cir, w))) return true;
    }
    return false;
  }

  // Wires must not pass through an element's body or skim along its edge over
  // unconnected ports. A legitimate connection only touches a box at its port
  // point (perpendicular, zero-length), so it isn't flagged.
  function segRectOverlapLen(seg, rx1, ry1, rx2, ry2) {
    if (seg.horiz) {
      if (seg.a.y < ry1 - 1e-9 || seg.a.y > ry2 + 1e-9) return 0;
      return Math.max(0, Math.min(Math.max(seg.a.x, seg.b.x), rx2) - Math.max(Math.min(seg.a.x, seg.b.x), rx1));
    }
    if (seg.a.x < rx1 - 1e-9 || seg.a.x > rx2 + 1e-9) return 0;
    return Math.max(0, Math.min(Math.max(seg.a.y, seg.b.y), ry2) - Math.max(Math.min(seg.a.y, seg.b.y), ry1));
  }
  function wireCrossesElements(pts) {
    const segs = pathSegs(pts);
    for (const el of app.elements) {
      const t = F.TYPES[el.type], sz = F.rotatedSize(t, el.rot || 0);
      for (const s of segs) if (segRectOverlapLen(s, el.x, el.y, el.x + sz.w, el.y + sz.h) > 0.05) return true;
    }
    return false;
  }

  function finishWire(to) {
    const from = app.wiring.from;
    if (from.el === to.el && from.port === to.port) return;
    if (!portFree(to.el, to.port)) return;
    const pts = E.wirePath({ elements: app.elements }, { a: { el: from.el, port: from.port }, b: { el: to.el, port: to.port }, via: app.wiring.via.slice() });
    if (polylineHasReversal(pts)) { SFX.fault(); return; }   // refuse wires that double back on themselves
    if (pathSelfOverlaps(pts)) { SFX.fault(); return; }   // refuse wires that loop back over themselves
    if (wireOverlapsExisting(pts)) { SFX.fault(); return; }  // refuse wires that overlay an existing wire
    if (wireCrossesElements(pts)) { SFX.fault(); return; }   // refuse wires that pass through / skim an element
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
        const rp = F.rotatedPort(t, F.swappedPort(el, t, p), el.rot || 0, el.mir);
        const px = el.x + rp.x, py = el.y + rp.y;
        if (Math.hypot(px - x, py - y) < 0.34) return { el: el.id, port: p.name, x: px, y: py, ox: rp.ox, oy: rp.oy };
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

  // Sandbox launchers fire on an absolute schedule: each pulse is {t (units from start),
  // pol}. Migrate the legacy {pattern:[pol,...]} form (an implicit 1.5-unit cadence).
  function launcherPulses(el) {
    if (!el.pulses) {
      el.pulses = (el.pattern || [1]).map((pol, k) => ({ t: 1.5 * (k + 1), pol }));
      delete el.pattern;
    }
    return el.pulses;
  }
  function runSandbox() {
    const inputs = [];
    for (const l of app.elements.filter(e => e.type === 'LAUNCHER'))
      for (const p of launcherPulses(l)) inputs.push({ t: p.t, launcher: l.id, pol: p.pol });
    inputs.sort((a, b) => a.t - b.t);
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
        if (ok && app.level.cases && app.level.cases.length > 1) { app.caseDone[app.playCase] = true; buildCaseTabs(); }
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
  // Build-quality: which placed/pre-placed devices were actually used by a fluxon,
  // and whether all supplied components were placed. `optionalPalette` types
  // (e.g. the Exhaust on Waste Not) don't count toward the required minimum
  // and don't penalize the build star if placed-but-unused.
  function buildQuality(res) {
    const lv = app.level;
    const used = new Set(res.usedEls || []);
    const optionalTypes = new Set(lv.optionalPalette || []);
    const devices = app.elements.filter(e => !F.TYPES[e.type].io);   // non-I/O components
    const unused = devices.filter(e => !used.has(e.id) && !optionalTypes.has(e.type));
    const optionalSupplied = [...optionalTypes].reduce((s, t) => s + ((lv.palette && lv.palette[t]) || 0), 0);
    const supplied = Math.max(0, (isFinite(lv.parElements) ? lv.parElements : 0) - optionalSupplied);
    const placed = placedCount();
    const placedAll = placed >= supplied;
    return { unused, placedAll, placed, supplied, properBuild: placedAll && unused.length === 0 };
  }
  function summarizeTypes(els) {
    const counts = {};
    for (const e of els) { const n = F.TYPES[e.type].name; counts[n] = (counts[n] || 0) + 1; }
    return Object.entries(counts).map(([n, c]) => c > 1 ? `${n} ×${c}` : n).join(', ');
  }
  function buildWarning(build) {
    if (!build || build.properBuild) return null;
    const parts = [];
    if (!build.placedAll) parts.push(`only ${build.placed} of ${build.supplied} supplied component${build.supplied === 1 ? '' : 's'} placed`);
    if (build.unused.length) parts.push(`unused — no fluxon reaches ${build.unused.length === 1 ? 'it' : 'them'} in any case: ${summarizeTypes(build.unused)}`);
    return h('p', { class: 'cert-warn', html: '⚠ ' + parts.join('; ') + '. A clean solution places and uses every component.' });
  }

  // Count orthogonal wire crossings (planarity). Collinear overlaps are already
  // prevented at draw time, so what remains are proper X-crossings (incl. a wire
  // crossing itself). The twist element's internal crossing is part of its glyph,
  // not a drawn wire, so it is never counted.
  function countWireCrossings() {
    return E.countCrossings({ elements: app.elements, wires: app.wires });
  }

  function certify() {
    const lv = app.level;
    if (lv.sandbox) { runSandbox(); return; }
    stopPlayback();
    const res = E.certify(circuit(), lv.cases, Array.from({ length: E.CERTIFY_SEEDS }, (_, i) => i), { optional: lv.optionalDetectors || [] });
    app.certifyResult = res;
    const build = buildQuality(res);
    const crossings = countWireCrossings();
    let stars = 0;
    if (res.pass) {
      stars = 1;
      if (build.properBuild) stars++;
      if (res.heatMax <= lv.parHeat) stars++;
      if (crossings === 0) stars++;
      if (app.hintUsed) stars = Math.max(0, stars - 1);   // hint penalty
      const prev = progress.levels[lv.id] || {};
      progress.levels[lv.id] = { done: true, stars: Math.max(prev.stars || 0, stars) };
      store.save(progress);
      SFX.win();
    } else SFX.fault();
    showCertifyModal(res, stars, build, crossings);
  }

  function showCertifyModal(res, stars, build, crossings) {
    const lv = app.level;
    const m = $('#modal'); m.classList.remove('hidden');
    const box = $('#modal-box'); box.innerHTML = '';
    box.append(h('h2', { class: res.pass ? 'ok' : 'bad' }, res.pass ? '✓ CERTIFIED' : '✗ Not yet'));
    if (res.pass) {
      box.append(h('div', { class: 'stars-big' },
        `${'★'.repeat(stars)}${'☆'.repeat(4 - stars)}`));
      const why = [];
      why.push('✓ all cases pass under timing wobble');
      why.push(build.properBuild ? '✓ every component placed & used' : '✗ not every component placed & used');
      why.push((res.heatMax <= lv.parHeat ? '✓' : '✗') + ` heat budget (${res.heatMax} / ${lv.parHeat})`);
      why.push(crossings === 0 ? '✓ planar — no wire crossings' : `✗ wire crossings make your design harder to manufacture (${crossings})`);
      if (app.hintUsed) why.push('✗ hint used — star deducted');
      box.append(h('div', { class: 'why' }, ...why.map(w => h('div', w.startsWith('✗') ? { class: 'why-bad' } : {}, w))));
      { const warn = buildWarning(build); if (warn) box.append(warn); }
      if (lv.success) box.append(h('p', { class: 'story', html: lv.success }));
    } else {
      for (const c of res.perCase) {
        box.append(h('div', { class: 'case-res ' + (c.pass ? 'ok' : 'bad') },
          h('b', {}, (c.pass ? '✓ ' : '✗ ') + c.name), c.pass ? '' : h('div', { class: 'reasons' }, c.reasons.join(' · '))));
      }
      { const warn = buildWarning(build); if (warn) box.append(warn); }
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
  function renderBriefing() {
    const el = $('#briefing'); if (!el) return;
    const lv = app.level; el.innerHTML = '';
    if (!lv) return;
    const body = lv.intro || 'Free play — every element, no objective. Build whatever you like and watch the physics.';
    const wrap = h('div', { class: 'brief-body' });
    for (const para of body.split(/<br>\s*<br>/i).map(s => s.trim()).filter(Boolean)) wrap.append(h('p', { class: 'brief-p', html: para }));
    el.append(wrap);
  }

  function showStory(title, html, btnText) {
    const m = $('#modal'); m.classList.remove('hidden');
    const box = $('#modal-box'); box.innerHTML = '';
    box.append(h('h2', {}, title));
    box.append(h('p', { class: 'story', html }));
    box.append(h('div', { class: 'modal-btns' }, h('button', { class: 'big primary', onclick: closeModal }, btnText || 'Close')));
  }
  function closeModal() { $('#modal').classList.add('hidden'); }

  function showNotebook() {
    hideNotebookToast();
    const m = $('#modal'); m.classList.remove('hidden');
    const box = $('#modal-box'); box.innerHTML = '';
    box.append(h('h2', {}, '📓 Lab Notebook'));
    const wrap = h('div', { class: 'notebook' });
    const unread = new Set(progress.notebookUnread || []);
    const order = Object.keys(F.NOTEBOOK);
    let shown = 0;
    for (const id of order) {
      const entry = F.NOTEBOOK[id];
      if (progress.notebook.includes(id) || id === 'refs') {
        const isNew = unread.has(id);
        const summary = isNew
          ? h('summary', {}, entry.title, h('span', { class: 'nb-new' }, 'NEW'))
          : h('summary', {}, entry.title);
        wrap.append(h('details', isNew ? { open: '' } : {}, summary, h('div', { class: 'nb-body', html: entry.body })));
        shown++;
      } else {
        wrap.append(h('details', { class: 'locked' }, h('summary', {}, '🔒 ' + entry.title)));
      }
    }
    box.append(h('p', { class: 'dim' }, `${shown} of ${order.length} entries unlocked — keep playing to fill the notebook.`));
    box.append(wrap);
    box.append(h('div', { class: 'modal-btns' }, h('button', { class: 'big primary', onclick: closeModal }, 'Close')));
    // everything currently unlocked has now been seen
    if ((progress.notebookUnread || []).length) { progress.notebookUnread = []; store.save(progress); updateNotebookBadge(); }
  }

  function showReferences() {
    const m = $('#modal'); m.classList.remove('hidden');
    const box = $('#modal-box'); box.innerHTML = '';
    box.append(h('h2', {}, '📚 References'));
    box.append(h('p', { class: 'dim' }, 'Works cited throughout FLUXONAUT — the game dramatizes the real BARCS research program.'));
    const wrap = h('div', { class: 'biblio' });
    for (const entry of (F.BIBLIOGRAPHY || [])) wrap.append(h('div', { class: 'bib-entry', html: formatCitation(entry) }));
    box.append(wrap);
    box.append(h('div', { class: 'modal-btns' }, h('button', { class: 'big primary', onclick: closeModal }, 'Close')));
  }
  function formatCitation(entry) {
    let s = String(entry).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    s = s.replace(/^\[([^\]]+)\]/, '<span class="bib-key">[$1]</span>');
    s = s.replace(/(https?:\/\/[^\s]+)/g, (u) => { const c = u.replace(/[.,;]+$/, ''); return `<a href="${c}" target="_blank" rel="noopener noreferrer">${c}</a>`; });
    s = s.replace(/doi:\s*([^\s,]+)/gi, (mm, d) => { const c = d.replace(/[.,;]+$/, ''); return `doi: <a href="https://doi.org/${c}" target="_blank" rel="noopener noreferrer">${c}</a>`; });
    return s;
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
    if (app.level.cases && app.level.cases.length > 1) {   // a circuit edit clears all case "done" marks
      const sig = circuitSig();
      if (sig !== app._tabSig) { app._tabSig = sig; app.caseDone = {}; buildCaseTabs(); }
    }
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
      const fo = app.wiring.fromOut || { ox: 0, oy: 0 };
      const start = app.wiring.fromPos;
      const pts = [{ x: start.x, y: start.y }, { x: start.x + fo.ox * 0.5, y: start.y + fo.oy * 0.5 }];
      let cur = pts[pts.length - 1];
      for (const v of app.wiring.via.concat([app.mouse])) {
        if (v.x !== cur.x && v.y !== cur.y) pts.push({ x: v.x, y: cur.y });
        pts.push({ x: v.x, y: v.y });
        cur = v;
      }
      const previewBad = polylineHasReversal(pts) || pathSelfOverlaps(pts) || wireOverlapsExisting(pts) || wireCrossesElements(pts);
      R.drawWire(ctx, pts, { preview: true, bad: previewBad });
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
      const ghost = { id: 'ghost', type: app.placing.type, x: gx, y: gy, rot: app.placing.rot, mir: app.placing.mir, cfg: t.config ? { ...t.config } : undefined };
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
          ctx.fillStyle = '#08131f'; ctx.font = '800 10px system-ui, sans-serif'; ctx.textBaseline = 'middle';
          ctx.fillText(String(inp.i + 1), x, y);
          ctx.textBaseline = 'alphabetic'; ctx.font = '600 11px system-ui, sans-serif';
        });
      }
      if (el.type === 'LAUNCHER' && lv.sandbox) {
        const pulses = launcherPulses(el);
        pulses.forEach((p, k) => {
          const x = (el.x + 0.5 + (k - (pulses.length - 1) / 2) * 0.52) * CELL;
          ctx.beginPath(); ctx.arc(x, (el.y - 0.46) * CELL, 5, 0, 7);
          ctx.fillStyle = lv.bipolar ? R.polColor(p.pol) : '#cdeeff'; ctx.fill();
          ctx.fillStyle = 'rgba(205,228,250,0.92)'; ctx.font = '700 8.5px system-ui, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(p.t.toFixed(1), x, (el.y - 0.2) * CELL);
          ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
        });
      }
      // detector readout (sandbox): the sequence of pulse types actually received
      if (el.type === 'DETECTOR' && lv.sandbox) {
        const got = app.trace ? (app.liveDetections[el.id] || []) : [];
        got.forEach((d, k) => {
          const x = (el.x + 0.5 + (k - (got.length - 1) / 2) * 0.46) * CELL, y = (el.y - 0.34) * CELL;
          ctx.beginPath(); ctx.arc(x, y, 6.4, 0, 7);
          ctx.fillStyle = lv.bipolar ? R.polColor(d.pol) : '#cdeeff'; ctx.fill();
          ctx.strokeStyle = R.COL.ok; ctx.lineWidth = 1.4; ctx.stroke();
          if (lv.bipolar) {
            ctx.fillStyle = '#08131f'; ctx.font = '800 9px system-ui'; ctx.textBaseline = 'middle';
            ctx.fillText(d.pol === -1 ? '−' : '+', x, y);
            ctx.textBaseline = 'alphabetic'; ctx.font = '600 11px system-ui, sans-serif';
          }
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

  function renderHintBar() {
    const el = $('#hint-bar');
    if (!el) return;
    if (app.hintShown) {
      el.textContent = '💡 ' + (app.level && app.level.hint ? app.level.hint : 'No hint for this one — trust the physics.');
      el.classList.remove('hidden');
    } else { el.classList.add('hidden'); el.textContent = ''; }
  }

  function drawBanner() {
    const el = $('#banner');
    if (!el) return;                       // (stubbed DOM in tests has no banner node)
    const b = app.banner;
    const sig = b ? b.kind + '|' + b.text : '';
    if (sig === app._bannerSig) return;    // only touch the DOM when it actually changes
    app._bannerSig = sig;
    if (!b) { el.classList.add('hidden'); el.textContent = ''; return; }
    el.className = 'game-banner ' + (b.kind || 'ok');   // shown below the board, never over it
    el.textContent = b.text;
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
      else {
        const nv = { x: Math.round(m.x * 2) / 2, y: Math.round(m.y * 2) / 2 };
        if (!polylineHasReversal(orthoFromVias(app.wiring.fromPos, app.wiring.via.concat([nv])))) app.wiring.via.push(nv);
      }
      return;
    }
    if (port && portFree(port.el, port.port)) {
      stopPlayback();
      app.mode = 'wiring';
      app.wiring = { from: { el: port.el, port: port.port }, fromPos: { x: port.x, y: port.y }, fromOut: { ox: port.ox, oy: port.oy }, via: [] };
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
    else if (ev.key === 'f' || ev.key === 'F') flipSelection();
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
    $('#btn-hint').addEventListener('click', () => { app.hintShown = !app.hintShown; if (app.hintShown) app.hintUsed = true; renderHintBar(); });
    $('#btn-notebook').addEventListener('click', showNotebook);
    $('#btn-notebook-title').addEventListener('click', showNotebook);
    $('#btn-refs').addEventListener('click', showReferences);
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
  F._ui = { app, boot, loadLevel, runCurrentCase, certify, advancePlayback, frame, showScreen, stopPlayback, buildLevelSelect, showNotebook, startPlacing, tryPlace, deleteSelection, finishWire, ruleSVG, openRuleModal };
})();

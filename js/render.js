/* FLUXONAUT — render.js
 * Canvas renderer: cryo-lab look. Pure drawing; state comes from ui.js.
 */
(function () {
  const F = (globalThis.FLUXON = globalThis.FLUXON || {});

  const CELL = 44;
  const COL = {
    bg0: '#0a111e', bg1: '#0d1626',
    grid: 'rgba(110,150,200,0.10)',
    wire: '#2c4666', wireCore: '#48729f', wireSel: '#7fb4e8',
    el: '#142238', elEdge: '#3b5a7e', elEdgeHi: '#9fd2ff', elGlyph: '#cfe6ff',
    lock: 'rgba(170,200,235,0.45)',
    plus: '#3fd4ff', minus: '#ff8a64',
    plusGlow: 'rgba(63,212,255,0.55)', minusGlow: 'rgba(255,138,100,0.5)',
    heat: '#ff5c47', ok: '#52e8a4', bad: '#ff5c69',
    text: '#bcd6f2', dim: '#6f8db0', conj: '#caa6ff',
  };
  F.CELL = CELL; F.COL = COL;

  function polColor(pol) { return pol === -1 ? COL.minus : COL.plus; }
  function polGlow(pol) { return pol === -1 ? COL.minusGlow : COL.plusGlow; }

  // ───────────────────────── board chrome ─────────────────────────
  function drawBoard(ctx, W, H, t) {
    const g = ctx.createLinearGradient(0, 0, 0, H * CELL);
    g.addColorStop(0, COL.bg1); g.addColorStop(1, COL.bg0);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W * CELL, H * CELL);
    ctx.fillStyle = COL.grid;
    for (let x = 0; x <= W; x++) for (let y = 0; y <= H; y++) {
      ctx.fillRect(x * CELL - 1, y * CELL - 1, 2, 2);
    }
  }

  // ───────────────────────── wires ─────────────────────────
  // Trace a wire as a rounded path (quarter arcs at each 90° bend).
  function traceWire(ctx, pts) {
    const rp = F.roundedPath(pts, F.CORNER_R);
    ctx.beginPath();
    if (!rp.segs.length) return;
    ctx.moveTo(rp.segs[0].a.x * CELL, rp.segs[0].a.y * CELL);
    for (const s of rp.segs) {
      if (s.kind === 'line') ctx.lineTo(s.b.x * CELL, s.b.y * CELL);
      else ctx.arc(s.c.x * CELL, s.c.y * CELL, s.r * CELL, s.a0, s.a0 + s.delta, s.delta < 0);
    }
  }
  function drawWire(ctx, pts, opts) {
    opts = opts || {};
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    traceWire(ctx, pts);
    ctx.strokeStyle = opts.selected ? 'rgba(127,180,232,0.32)' : 'rgba(60,100,150,0.28)';
    ctx.lineWidth = 7;
    ctx.stroke();
    traceWire(ctx, pts);
    ctx.strokeStyle = opts.preview ? 'rgba(127,180,232,0.8)' : (opts.selected ? COL.wireSel : COL.wireCore);
    ctx.lineWidth = 2;
    if (opts.preview) ctx.setLineDash([6, 5]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ───────────────────────── pulses ─────────────────────────
  function drawPulse(ctx, x, y, pol, unary, t) {
    const px = x * CELL, py = y * CELL;
    const breathe = 1 + 0.12 * Math.sin(t * 9);
    const r = 6.5 * breathe;
    const grad = ctx.createRadialGradient(px, py, 0, px, py, r * 3.2);
    const glow = unary ? 'rgba(160,225,255,0.5)' : polGlow(pol);
    grad.addColorStop(0, glow); grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(px, py, r * 3.2, 0, 7); ctx.fill();
    ctx.fillStyle = unary ? '#cdeeff' : polColor(pol);
    ctx.beginPath(); ctx.arc(px, py, r * 0.62, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(px, py, r * 0.26, 0, 7); ctx.fill();
    if (!unary) {
      ctx.strokeStyle = 'rgba(8,14,24,0.85)'; ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px - 3, py); ctx.lineTo(px + 3, py);
      if (pol === 1) { ctx.moveTo(px, py - 3); ctx.lineTo(px, py + 3); }
      ctx.stroke();
    }
  }

  // ───────────────────────── element rendering ─────────────────────────
  function withTransform(ctx, el, type, fn) {
    const sz = F.rotatedSize(type, el.rot || 0);
    const cx = (el.x + sz.w / 2) * CELL, cy = (el.y + sz.h / 2) * CELL;
    ctx.save();
    ctx.translate(cx, cy);
    fn(ctx, sz);
    ctx.restore();
  }

  // Apply an element's orientation (rotation + optional mirror) to the context.
  // Directional artwork drawn afterward reflects the mirror; text that must stay
  // readable is drawn outside this block (or counter-mirrored).
  function orient(ctx, el) {
    ctx.rotate((el.rot || 0) * Math.PI / 2);
    if (el.mir) ctx.scale(-1, 1);
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function bodyRect(ctx, sz, opts) {
    const w = sz.w * CELL - 8, h = sz.h * CELL - 8;
    roundRect(ctx, -w / 2, -h / 2, w, h, 9);
    ctx.fillStyle = opts && opts.fill || COL.el;
    ctx.fill();
    if (opts && opts.conj) ctx.setLineDash([5, 4]);
    ctx.strokeStyle = opts && opts.selected ? COL.elEdgeHi : (opts && opts.edge || COL.elEdge);
    ctx.lineWidth = opts && opts.selected ? 2.2 : 1.4;
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawPorts(ctx, el, type, hoverPort, wiredPorts) {
    for (const p of type.ports) {
      const rp = F.rotatedPort(type, p, el.rot || 0, el.mir);
      const px = (el.x + rp.x) * CELL, py = (el.y + rp.y) * CELL;
      const wired = wiredPorts && wiredPorts.has(el.id + ':' + p.name);
      const hov = hoverPort && hoverPort.el === el.id && hoverPort.port === p.name;
      ctx.beginPath();
      ctx.moveTo(px, py); ctx.lineTo(px + rp.ox * 6, py + rp.oy * 6);
      ctx.strokeStyle = hov ? COL.elEdgeHi : COL.elEdge; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(px, py, hov ? 5 : 3.4, 0, 7);
      ctx.fillStyle = hov ? COL.elEdgeHi : (wired ? COL.wireCore : '#1d3350');
      ctx.fill();
      ctx.strokeStyle = hov ? '#fff' : COL.elEdge; ctx.lineWidth = 1; ctx.stroke();
      // port label, inset toward the element body
      const lbl = type.portLabels && type.portLabels[p.name];
      if (lbl) {
        const big = type.w > 1 || type.h > 1;
        const inset = big ? 13 : 11;
        const lx = px - rp.ox * inset, ly = py - rp.oy * inset;
        ctx.font = `700 ${big ? 9.5 : 8.5}px Verdana, Tahoma, system-ui, sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const hadLS = 'letterSpacing' in ctx;
        if (hadLS) ctx.letterSpacing = '0.5px';          // separate letters so e.g. "Ci" doesn't read as "G"
        ctx.lineJoin = 'round';
        if (ctx.strokeText) { ctx.strokeStyle = 'rgba(6,11,20,0.92)'; ctx.lineWidth = 3; ctx.strokeText(lbl, lx, ly); }  // dark halo for contrast over artwork
        ctx.fillStyle = '#ffe14d';                       // bright yellow, stands out
        ctx.fillText(lbl, lx, ly);
        if (hadLS) ctx.letterSpacing = '0px';
      }
    }
  }

  function glyphText(ctx, txt, size, color, dx, dy) {
    ctx.fillStyle = color || COL.elGlyph;
    ctx.font = `600 ${size || 13}px 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, dx || 0, dy || 0);
  }

  function arrowArc(ctx, r, ccw, color, t) {
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    const a0 = ccw ? 2.2 : -0.6, a1 = ccw ? -0.6 : 2.2;
    ctx.beginPath(); ctx.arc(0, 0, r, Math.min(a0, a1) + 0.25, Math.max(a0, a1) - 0.25); ctx.stroke();
    const tip = ccw ? Math.min(a0, a1) + 0.25 : Math.max(a0, a1) - 0.25;
    const tx = r * Math.cos(tip), ty = r * Math.sin(tip);
    const dir = ccw ? tip - Math.PI / 2 : tip + Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(tx + 5 * Math.cos(dir), ty + 5 * Math.sin(dir));
    ctx.lineTo(tx + 4 * Math.cos(dir + 2.5), ty + 4 * Math.sin(dir + 2.5));
    ctx.lineTo(tx + 4 * Math.cos(dir - 2.5), ty + 4 * Math.sin(dir - 2.5));
    ctx.closePath(); ctx.fillStyle = color; ctx.fill();
  }

  // state: current dynamic state for stateful elements
  function drawElement(ctx, el, state, opts) {
    const type = F.TYPES[el.type];
    opts = opts || {};
    const t = opts.time || 0;
    withTransform(ctx, el, type, (ctx, sz) => {
      if (opts.ghost) ctx.globalAlpha = 0.55;
      switch (type.id) {
        case 'LAUNCHER': {
          bodyRect(ctx, sz, { fill: '#16283f', selected: opts.selected });
          ctx.save(); orient(ctx, el);
          ctx.beginPath();
          ctx.moveTo(-5, -8); ctx.lineTo(8, 0); ctx.lineTo(-5, 8); ctx.closePath();
          ctx.fillStyle = '#9fe0ff'; ctx.fill();
          ctx.restore();
          break;
        }
        case 'DETECTOR': {
          bodyRect(ctx, sz, { fill: '#16283f', edge: opts.flash ? COL.ok : undefined, selected: opts.selected });
          ctx.strokeStyle = opts.flash ? COL.ok : '#7fb4e8'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(0, 0, 9, 0, 7); ctx.stroke();
          ctx.fillStyle = opts.flash ? COL.ok : '#7fb4e8';
          ctx.beginPath(); ctx.arc(0, 0, 3.4, 0, 7); ctx.fill();
          break;
        }
        case 'REFLECTOR': case 'IREFLECTOR': {
          bodyRect(ctx, sz, { fill: '#19293f', selected: opts.selected });
          ctx.save(); orient(ctx, el);
          ctx.beginPath();
          ctx.moveTo(2, -9); ctx.lineTo(-8, 0); ctx.lineTo(2, 9);
          ctx.lineTo(8, 9); ctx.lineTo(8, -9); ctx.closePath();
          ctx.fillStyle = '#33567c'; ctx.fill();
          ctx.strokeStyle = '#5a86b3'; ctx.lineWidth = 1.2; ctx.stroke();
          if (type.id === 'IREFLECTOR') glyphText(ctx, '±', 11, '#ffd9a8', 2, 0);
          ctx.restore();
          break;
        }
        case 'EXHAUST': {
          bodyRect(ctx, sz, { fill: '#241620', edge: '#7c4040', selected: opts.selected });
          glyphText(ctx, '♨', 14, '#ff9d8a');
          break;
        }
        case 'NOT': {
          bodyRect(ctx, sz, { selected: opts.selected });
          ctx.save(); orient(ctx, el);
          ctx.strokeStyle = '#9fd2ff'; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(-11, -5); ctx.bezierCurveTo(-2, -5, 2, 5, 11, 5); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(-11, 5); ctx.bezierCurveTo(-2, 5, 2, -5, 11, -5); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'ROTARY': case 'CIRC': {
          bodyRect(ctx, sz, { selected: opts.selected });
          const ccw = !!(el.cfg && el.cfg.ccw);
          ctx.save(); if (el.mir) ctx.scale(-1, 1);
          arrowArc(ctx, 9, type.id === 'ROTARY' ? ccw : false, '#9fd2ff', t);
          ctx.restore();
          if (type.id === 'CIRC') glyphText(ctx, '⚡', 9, '#ffd16e', 0, 12);
          break;
        }
        case 'PR3': {
          bodyRect(ctx, sz, { selected: opts.selected });
          ctx.save(); if (el.mir) ctx.scale(-1, 1);
          arrowArc(ctx, 10.5, false, COL.plus, t);
          arrowArc(ctx, 6, true, COL.minus, t);
          ctx.restore();
          break;
        }
        case 'FD': {
          bodyRect(ctx, sz, { selected: opts.selected });
          ctx.save(); orient(ctx, el);
          const fwd = state === 'fwd';
          ctx.save(); if (!fwd) ctx.scale(-1, 1);
          ctx.beginPath();
          ctx.moveTo(-9, -8); ctx.lineTo(3, 0); ctx.lineTo(-9, 8); ctx.closePath();
          ctx.fillStyle = '#9fd2ff'; ctx.fill();
          ctx.beginPath(); ctx.moveTo(5, -8); ctx.lineTo(5, 8);
          ctx.strokeStyle = '#9fd2ff'; ctx.lineWidth = 2.4; ctx.stroke();
          ctx.restore(); ctx.restore();
          break;
        }
        case 'TCB': {
          bodyRect(ctx, sz, { selected: opts.selected });
          ctx.save(); orient(ctx, el);
          const open = state === 'open';
          ctx.strokeStyle = '#6f93bb'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(-6, 0); ctx.moveTo(6, 0); ctx.lineTo(14, 0); ctx.stroke();
          ctx.strokeStyle = open ? COL.ok : COL.bad; ctx.lineWidth = 2.6;
          ctx.beginPath();
          if (open) { ctx.moveTo(-6, 0); ctx.lineTo(6, 0); }
          else { ctx.moveTo(0, -7); ctx.lineTo(0, 7); }
          ctx.stroke();
          ctx.strokeStyle = '#6f93bb'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(0, -8); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'TSG': {
          bodyRect(ctx, sz, { selected: opts.selected });
          const up = state === 'up';
          glyphText(ctx, 'SG', 13, '#9fd2ff', 0, -12);
          ctx.save(); orient(ctx, el);
          ctx.strokeStyle = up ? COL.plus : '#ffd16e'; ctx.lineWidth = 2.4;
          ctx.beginPath(); ctx.moveTo(-16, 8);
          ctx.lineTo(0, 8); ctx.lineTo(16, up ? -4 : 16); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'RM1': case 'RM2': {
          bodyRect(ctx, sz, { selected: opts.selected });
          ctx.strokeStyle = '#6f93bb'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.stroke();
          ctx.fillStyle = polColor(state);
          ctx.beginPath(); ctx.arc(0, 0, 5.4, 0, 7); ctx.fill();
          glyphText(ctx, state === 1 ? '+' : '−', 10, '#08131f', 0, 0.5);
          break;
        }
        case 'BSR': {
          bodyRect(ctx, sz, { selected: opts.selected });
          ctx.strokeStyle = '#6f93bb'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(-15, 0); ctx.lineTo(-8, 0); ctx.moveTo(8, 0); ctx.lineTo(15, 0); ctx.stroke();
          ctx.fillStyle = polColor(state);
          ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.fill();
          glyphText(ctx, state === 1 ? '+' : '−', 10, '#08131f', 0, 0.5);
          break;
        }
        case 'PFG': {
          bodyRect(ctx, sz, { edge: '#7c6440', selected: opts.selected });
          const b = el.cfg && el.cfg.bias || 1;
          glyphText(ctx, b === 1 ? '+▸' : '−▸', 12, polColor(b));
          glyphText(ctx, '⚡', 9, '#ffd16e', 0, 12);
          break;
        }
        case 'PS': case 'RPS': {
          const conj = type.id === 'RPS';
          bodyRect(ctx, sz, { edge: conj ? COL.conj : '#7c6440', conj, selected: opts.selected });
          ctx.save(); orient(ctx, el);
          ctx.strokeStyle = '#6f93bb'; ctx.lineWidth = 1.8;
          ctx.beginPath(); ctx.moveTo(-14, 0); ctx.lineTo(0, 0); ctx.stroke();
          ctx.strokeStyle = COL.plus;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -13); ctx.stroke();
          ctx.strokeStyle = COL.minus;
          ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(13, 0); ctx.stroke();
          ctx.restore();
          if (conj) glyphText(ctx, '?', 10, COL.conj, 12, 12);
          else glyphText(ctx, '⚡', 9, '#ffd16e', -10, 12);
          break;
        }
        case 'CB': {
          bodyRect(ctx, sz, { edge: '#4f7ec2', selected: opts.selected });
          ctx.save(); orient(ctx, el);
          // control rail (top): RM2 loop with stored fluxon
          ctx.strokeStyle = '#6f93bb'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(-36, -22); ctx.lineTo(-13, -22); ctx.moveTo(13, -22); ctx.lineTo(36, -22); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, -22, 11, 0, 7); ctx.stroke();
          ctx.fillStyle = polColor(state);
          ctx.beginPath(); ctx.arc(0, -22, 6, 0, 7); ctx.fill();
          glyphText(ctx, state === 1 ? '+' : '−', 10, '#08131f', 0, -21.5);
          // coupling
          ctx.strokeStyle = 'rgba(159,210,255,0.5)'; ctx.lineWidth = 1.2;
          ctx.setLineDash([2, 3]);
          ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(0, 10); ctx.stroke();
          ctx.setLineDash([]);
          // data rail (bottom): barrier, open for matching polarity
          ctx.strokeStyle = '#6f93bb'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(-36, 22); ctx.lineTo(-7, 22); ctx.moveTo(7, 22); ctx.lineTo(36, 22); ctx.stroke();
          ctx.strokeStyle = polColor(state); ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.moveTo(-7, 22); ctx.lineTo(7, 22); ctx.stroke();
          ctx.save(); if (el.mir) ctx.scale(-1, 1);
          glyphText(ctx, state === 1 ? '+ passes' : '− passes', 8.5, COL.dim, 0, 33);
          ctx.restore();
          ctx.restore();
          glyphText(ctx, 'CB', 11, '#9fd2ff', 0, 1);
          break;
        }
        default: {
          bodyRect(ctx, sz, { selected: opts.selected });
          glyphText(ctx, type.glyph || '?', 12);
        }
      }
      if (el.locked && !type.io) {
        glyphText(ctx, '🔒', 8, COL.lock, sz.w * CELL / 2 - 11, -sz.h * CELL / 2 + 10);
      }
      ctx.globalAlpha = 1;
    });
  }

  // particles
  function drawParticles(ctx, particles, now) {
    for (const p of particles) {
      const age = (now - p.t0) / p.life;
      if (age >= 1) continue;
      const a = 1 - age;
      ctx.globalAlpha = a;
      if (p.kind === 'heat') {
        ctx.fillStyle = COL.heat;
        const x = p.x + p.vx * age * 30, y = p.y + p.vy * age * 30 - 14 * age * age;
        ctx.beginPath(); ctx.arc(x, y, 2.4 * a + 0.6, 0, 7); ctx.fill();
      } else if (p.kind === 'text') {
        ctx.fillStyle = p.color || COL.heat;
        ctx.font = '600 12px system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(p.text, p.x, p.y - 22 * age);
      } else if (p.kind === 'ring') {
        ctx.strokeStyle = p.color || COL.bad; ctx.lineWidth = 2.5 * a;
        ctx.beginPath(); ctx.arc(p.x, p.y, 6 + 30 * age, 0, 7); ctx.stroke();
      } else if (p.kind === 'spark') {
        ctx.fillStyle = p.color || '#fff';
        const x = p.x + p.vx * age * 46, y = p.y + p.vy * age * 46;
        ctx.beginPath(); ctx.arc(x, y, 2 * a, 0, 7); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  F.render = { drawBoard, drawWire, drawPulse, drawElement, drawParticles, drawPorts, polColor, CELL, COL };
})();

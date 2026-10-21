/* ================================================================
   Cenários isométricos com acabamento realista:
   - chão pintado num canvas grande (materiais procedurais, marcações
     desgastadas, sombras projetadas e oclusão ambiente);
   - peças (prédios, árvores, carros...) desenhadas em canvas com fachadas,
     folhagem e relevo, viram sprites ordenados por profundidade;
   - árvores balançam ao vento; água, fumaça e fogo são animados.
   ================================================================ */
"use strict";
const Scenery = (() => {
  const { HW, HH, HY, shade, css, mix, rgb, lin, rad } = Art;
  const QS = 1.5;                                   // qualidade das peças de cenário
  const SQ2 = Math.SQRT2;
  const rnd = (a, b) => a + Math.random()*(b - a);
  const rint = n => Math.floor(Math.random()*n);
  const pick = a => a[rint(a.length)];
  const rgba = (c, a) => { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; };
  const P = (x, y, z) => GFX.P(x, y, z);

  let env = null;                                   // { objs, keys, ticks, cache, ground }

  function hull(pts) {                                      // envoltória convexa (monotone chain)
    const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0])*(b[1] - o[1]) - (a[1] - o[1])*(b[0] - o[0]);
    const lo = [], up = [];
    p.forEach(q => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); });
    [...p].reverse().forEach(q => { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); });
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }

  /* ================================================================
     CHÃO: um canvas grande em coordenadas de mundo (px)
     ================================================================ */
  const GR = { X0:-1500, Y0:-950, W:3000, H:1900, S:1.2 };
  function newGround(base) {
    const mk = () => { const c = document.createElement("canvas"); c.width = Math.ceil(GR.W*GR.S); c.height = Math.ceil(GR.H*GR.S); const x = c.getContext("2d"); x.scale(GR.S, GR.S); x.translate(-GR.X0, -GR.Y0); x.lineJoin = "round"; x.lineCap = "round"; return [c, x]; };
    const [c, x] = mk(), [sc, sx] = mk();                       // chão e camada de sombras
    x.fillStyle = css(base); x.fillRect(GR.X0, GR.Y0, GR.W, GR.H);
    const path = (ctx, pts) => { ctx.beginPath(); pts.forEach(([a, b], i) => { const q = P(a, 0, b); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }); ctx.closePath(); };
    const patt = {};
    const fillOf = m => {
      if (typeof m === "number") return css(m);
      if (!patt[m]) patt[m] = x.createPattern(Mat.tile(m), "repeat");
      return patt[m];
    };
    let px = null; const paintLayer = [];
    const g = {
      c, x,
      /* polígono em coordenadas de mundo preenchido com material (nome) ou cor (número) */
      poly(pts, m, o = {}) {
        path(x, pts); x.save(); if (o.alpha != null) x.globalAlpha = o.alpha; x.fillStyle = fillOf(m); x.fill();
        if (o.tint) { x.globalAlpha = 1; x.fillStyle = rgba(o.tint, o.tintA ?? .2); x.fill(); }
        x.restore();
      },
      rect(x0, z0, x1, z1, m, o) { g.poly([[x0, z0], [x1, z0], [x1, z1], [x0, z1]], m, o); },
      line(a, b, wpx, color, alpha = 1) {
        const A = P(a[0], 0, a[1]), B = P(b[0], 0, b[1]);
        x.save(); x.globalAlpha = alpha; x.strokeStyle = css(color); x.lineWidth = wpx;
        x.beginPath(); x.moveTo(A[0], A[1]); x.lineTo(B[0], B[1]); x.stroke(); x.restore();
      },
      /* faixa pintada no chão com largura em unidades do mundo (recebe desgaste) */
      paint(a, b, wWorld, color, alpha = .9) {
        const dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz) || 1, nx = -dz/L*wWorld/2, nz = dx/L*wWorld/2;
        paintLayer.push(() => { path(px, [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]]); px.fillStyle = rgba(color, alpha); px.fill(); });
      },
      ring(cx, cz, r, wWorld, color, alpha = .9) {
        paintLayer.push(() => { px.save(); px.strokeStyle = rgba(color, alpha); px.lineWidth = wWorld*HW*SQ2*.7; const q = P(cx, 0, cz); px.beginPath(); px.ellipse(q[0], q[1], r*SQ2*HW, r*SQ2*HH, 0, 0, 7); px.stroke(); px.restore(); });
      },
      /* mancha suave no chão (elipse no mundo) */
      blob(cx, cz, rx, rz, color, alpha) {
        const q = P(cx, 0, cz), r = (rx + rz)/2*SQ2*HW;
        x.save(); x.translate(q[0], q[1]); x.scale(1, HH/HW); const gr = x.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, rgba(color, alpha)); gr.addColorStop(1, rgba(color, 0)); x.fillStyle = gr; x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill(); x.restore();
      },
      /* sombra projetada (luz vinda do alto-esquerdo da tela: a sombra cai para a direita-baixo) */
      shadowBox(cx, cz, w, d, h) {
        const off = [h*.62*HW*1.1, h*.62*HH], base = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => P(cx + a*w/2, 0, cz + b*d/2));
        const pts = hull([...base, ...base.map(q => [q[0] + off[0], q[1] + off[1]])]);
        sx.fillStyle = "#000"; sx.beginPath(); pts.forEach((q, i) => i ? sx.lineTo(q[0], q[1]) : sx.moveTo(q[0], q[1])); sx.closePath(); sx.fill();
      },
      shadowRound(cx, cz, r, h) {
        const q = P(cx, 0, cz), q2 = [q[0] + h*.62*HW*1.1, q[1] + h*.62*HH], rx = r*SQ2*HW*1.05, ry = r*SQ2*HH*1.05;
        sx.fillStyle = "#000"; sx.beginPath(); sx.ellipse(q[0], q[1], rx, ry, 0, 0, 7); sx.fill();
        const dx = q2[0] - q[0], dy = q2[1] - q[1], len = Math.hypot(dx, dy), an = Math.atan2(dy, dx);
        sx.save(); sx.translate(q[0], q[1]); sx.rotate(an); const rr = ry*.95 + rx*.12; sx.beginPath(); sx.moveTo(0, -rr); sx.lineTo(len, -rr*.7); sx.arc(len, 0, rr*.7, -Math.PI/2, Math.PI/2); sx.lineTo(0, rr); sx.closePath(); sx.fill(); sx.restore();
      },
      /* oclusão ambiente: escurecimento suave ao redor da base de objetos */
      ao(cx, cz, rx, rz, a = .35) { g.blob(cx, cz, rx*1.25, rz*1.25, 0x000000, a); },
      done() {
        if (paintLayer.length) {                                  // marcações com desgaste
          const [pc, pxx] = mk(); px = pxx;
          paintLayer.forEach(f => f());
          pxx.globalCompositeOperation = "destination-out";
          for (let i = 0; i < 26000; i++) { pxx.fillStyle = `rgba(0,0,0,${rnd(.25, .9)})`; const r = rnd(.4, 1.7); pxx.fillRect(rnd(GR.X0, GR.X0 + GR.W), rnd(GR.Y0, GR.Y0 + GR.H), r, r*rnd(.5, 1.2)); }
          pxx.globalCompositeOperation = "source-over";
          x.drawImage(pc, GR.X0, GR.Y0, GR.W, GR.H);
        }
        x.save(); if ("filter" in x) x.filter = "blur(3px)"; x.globalAlpha = .38; x.drawImage(sc, GR.X0, GR.Y0, GR.W, GR.H); x.restore();   // sombras suaves
        return g;
      },
    };
    return g;
  }
  /* divide o canvas do chão em blocos (limite de textura) e cria as imagens */
  function bakeGround(g) {
    const cols = 3, rows = 2, cw = Math.ceil(g.c.width/cols), ch = Math.ceil(g.c.height/rows);
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = "scn_ground" + r + c, t = document.createElement("canvas"); t.width = cw; t.height = ch;
      t.getContext("2d").drawImage(g.c, c*cw, r*ch, cw, ch, 0, 0, cw, ch);
      GFX.scene.textures.addCanvas(k, t); env.keys.push(k);
      const im = GFX.scene.add.image(GR.X0 + c*cw/GR.S, GR.Y0 + r*ch/GR.S, k).setOrigin(0, 0).setScale(1/GR.S).setDepth(GFX.D_GROUND);
      env.objs.push(im);
    }
  }

  /* ================================================================
     KIT DE DESENHO ISOMÉTRICO PARA PEÇAS
     ================================================================ */
  function drawKit(ctx, ox, oy) {
    const p = (x, y, z) => { const r = GFX.rot(x, z); return [ox + (r[0] + r[1])*HW, oy + (r[1] - r[0])*HH - y*HY]; };
    const path = pts => { ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); };
    const face = (pts3, fill, stroke = "rgba(0,0,0,.35)", lw = 1) => {
      path(pts3.map(q => p(q[0], q[1], q[2]))); ctx.fillStyle = fill; ctx.fill();
      if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
    };
    /* ordenação de pintor: cada primitiva entra numa fila e é desenhada de trás para frente na vista atual */
    const Q = [];
    const keyOf = (x, y, z) => { const r = GFX.rot(x, z); return (r[1] - r[0]) + y*.001; };
    const enq = (x, y, z, fn) => Q.push({ k:keyOf(x, y, z), n:Q.length, fn });
    const flush = () => { Q.sort((a, b) => a.k - b.k || a.n - b.n).forEach(q => q.fn()); Q.length = 0; };
    /* um lado é visível se a normal (rodada) aponta para o observador */
    const seen = (nx, nz) => { const r = GFX.rot(nx, nz); return r[1] - r[0] > 0 ? (r[0] < 0 ? "L" : "R") : null; };
    const sidesOf = (x0, x1, z0, z1) => [
      { n:[-1, 0], ox:x0, oz:z0, ux:0, uz:1, len:z1 - z0 }, { n:[1, 0], ox:x1, oz:z0, ux:0, uz:1, len:z1 - z0 },
      { n:[0, -1], ox:x0, oz:z0, ux:1, uz:0, len:x1 - x0 }, { n:[0, 1], ox:x0, oz:z1, ux:1, uz:0, len:x1 - x0 },
    ].map(s => ({ ...s, vis:seen(s.n[0], s.n[1]) })).filter(s => s.vis);
    /* plano de fachada: u ao longo do lado, v para cima (unidades do mundo) */
    const onPlane = (ox_, oy_, oz_, ux, uz, draw) => {
      const o = p(ox_, oy_, oz_), r = GFX.rot(ux, uz);
      ctx.save(); ctx.transform((r[0] + r[1])*HW, (r[1] - r[0])*HH, 0, -HY, o[0], o[1]); draw(); ctx.restore();
    };
    const K = { ctx, p, face, flush };

    /* ---- caixa ---- */
    function boxNow(x, z, w, d, y0, h, color, o = {}) {
      const x0 = x - w/2, x1 = x + w/2, z0 = z - d/2, z1 = z + d/2, y1 = y0 + h, style = o.style || "plain";
      const sides = sidesOf(x0, x1, z0, z1);
      sides.forEach(s => {
        const ex = s.ox + s.ux*s.len, ez = s.oz + s.uz*s.len;
        face([[s.ox, y0, s.oz], [ex, y0, ez], [ex, y1, ez], [s.ox, y1, s.oz]], css(s.vis === "L" ? shade(color, 1.05) : shade(color, .84)), null);
        onPlane(s.ox, y0, s.oz, s.ux, s.uz, () => {
          ctx.beginPath(); ctx.rect(0, 0, s.len, h); ctx.clip();
          FACADE[style](ctx, s.len, h, { color, side:s.vis, ...o });
          ctx.fillStyle = s.vis === "L" ? "rgba(255,246,225,.07)" : "rgba(10,14,30,.28)"; ctx.fillRect(0, 0, s.len, h);
          const ao = ctx.createLinearGradient(0, 0, 0, Math.min(2.4, h)); ao.addColorStop(0, "rgba(0,0,0,.42)"); ao.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = ao; ctx.fillRect(0, 0, s.len, Math.min(2.4, h));
          const top = ctx.createLinearGradient(0, h, 0, h - .9); top.addColorStop(0, "rgba(255,255,255,.14)"); top.addColorStop(1, "rgba(255,255,255,0)"); ctx.fillStyle = top; ctx.fillRect(0, h - .9, s.len, .9);
        });
      });
      ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.lineWidth = 1;
      sides.forEach(s => { [[s.ox, s.oz], [s.ox + s.ux*s.len, s.oz + s.uz*s.len]].forEach(([ex, ez]) => { const A = p(ex, y0, ez), B = p(ex, y1, ez); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); }); });
      if (o.roof !== false) roofNow(x0, x1, z0, z1, y1, o.roofStyle || (style === "ruin" ? "ruin" : "flat"), o);
      else face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], css(o.top ?? shade(color, 1.15)), "rgba(0,0,0,.35)");
    }
    function roofNow(x0, x1, z0, z1, y, kind, o = {}) {
      const base = o.roofColor ?? (kind === "ruin" ? 0x3a3530 : 0x8a8d90);
      const A = p(x0, y, z0), B = p(x1, y, z1);
      face([[x0, y, z0], [x1, y, z0], [x1, y, z1], [x0, y, z1]], lin(ctx, A[0], A[1], B[0], B[1], [[0, css(shade(base, 1.2))], [1, css(shade(base, .85))]]), "rgba(0,0,0,.4)");
      ctx.save(); path([p(x0, y, z0), p(x1, y, z0), p(x1, y, z1), p(x0, y, z1)]); ctx.clip();
      for (let i = 0; i < 90; i++) { const q = p(rnd(x0, x1), y, rnd(z0, z1)); ctx.fillStyle = `rgba(${rint(2) ? "255,255,255" : "0,0,0"},${rnd(.03, .1)})`; ctx.fillRect(q[0], q[1], rnd(1, 3), rnd(.6, 1.6)); }
      ctx.restore();
      sidesOf(x0, x1, z0, z1).forEach(s => { const ex = s.ox + s.ux*s.len, ez = s.oz + s.uz*s.len; face([[s.ox, y, s.oz], [ex, y, ez], [ex, y + .22, ez], [s.ox, y + .22, s.oz]], s.vis === "L" ? "rgba(225,225,220,.9)" : "rgba(200,200,196,.9)", "rgba(0,0,0,.3)"); });
      if (kind === "ruin") { const cx = (x0 + x1)/2, cz = (z0 + z1)/2, r = Math.min(x1 - x0, z1 - z0)*.35; for (let i = 0; i < 9; i++) { const a = rnd(0, 6.28), rr = rnd(0, r), w = rnd(.2, .6); boxNow(cx + Math.cos(a)*rr, cz + Math.sin(a)*rr, w, w*rnd(.7, 1.3), y + .2, rnd(.15, .5), pick([0x2a2420, 0x3a332c, 0x4a4238]), { roof:false }); } return; }
      const w = x1 - x0, d = z1 - z0;
      if (w > 2.4 && d > 2.4 && o.rooftop !== false) {
        const n = 1 + rint(3);
        for (let i = 0; i < n; i++) {
          const cx = rnd(x0 + .7, x1 - .7), cz = rnd(z0 + .7, z1 - .7), t = rint(3);
          if (t === 0) boxNow(cx, cz, rnd(.7, 1.2), rnd(.6, 1), y + .22, rnd(.35, .6), 0xb8bcc0, { roof:false });
          else if (t === 1) { cylNow(cx, cz, .42, y + .22, .8, 0xc9c0b0); cylNow(cx, cz, .46, y + 1.0, .08, 0x777777); }
          else for (let k = 0; k < 2; k++) boxNow(cx + k*.55, cz, .45, .45, y + .22, .3, 0xd0d2d4, { roof:false });
        }
        if (Math.random() < .35) cylNow(rnd(x0 + .4, x1 - .4), rnd(z0 + .4, z1 - .4), .03, y + .22, 1.6, 0x888888);
      }
    }
    function cylNow(x, z, r, y0, h, color, o = {}) {
      const rx = r*SQ2*HW, ry = r*SQ2*HH, b = p(x, y0, z), t = p(x, y0 + h, z);
      const g = lin(ctx, b[0] - rx, 0, b[0] + rx, 0, [[0, css(shade(color, 1.28))], [.35, css(shade(color, 1.05))], [.7, css(shade(color, .72))], [1, css(shade(color, .5))]]);
      ctx.beginPath(); ctx.moveTo(b[0] - rx, b[1]); ctx.lineTo(t[0] - rx, t[1]); ctx.ellipse(t[0], t[1], rx, ry, 0, Math.PI, 0, false); ctx.lineTo(b[0] + rx, b[1]); ctx.ellipse(b[0], b[1], rx, ry, 0, 0, Math.PI, false); ctx.closePath();
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = .8; ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(t[0], t[1], rx, ry, 0, 0, 7); ctx.fillStyle = css(o.top ?? shade(color, 1.15)); ctx.fill(); ctx.stroke();
    }
    function coneNow(x, z, r, y0, h, color) {
      const rx = r*SQ2*HW, ry = r*SQ2*HH, b = p(x, y0, z), t = p(x, y0 + h, z);
      const g = lin(ctx, b[0] - rx, 0, b[0] + rx, 0, [[0, css(shade(color, 1.25))], [.5, css(color)], [1, css(shade(color, .5))]]);
      ctx.beginPath(); ctx.moveTo(b[0] - rx, b[1]); ctx.lineTo(t[0], t[1]); ctx.lineTo(b[0] + rx, b[1]); ctx.ellipse(b[0], b[1], rx, ry, 0, 0, Math.PI, false); ctx.closePath();
      ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = .8; ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.stroke();
    }
    function pyrNow(x, z, w, d, y0, h, color, tex) {
      const x0 = x - w/2, x1 = x + w/2, z0 = z - d/2, z1 = z + d/2, ap = [x, y0 + h, z];
      sidesOf(x0, x1, z0, z1).forEach(s => {
        const ex = s.ox + s.ux*s.len, ez = s.oz + s.uz*s.len;
        face([[s.ox, y0, s.oz], [ex, y0, ez], ap], css(shade(color, s.vis === "L" ? 1.0 : .68)), "rgba(0,0,0,.35)");
        if (tex === "tile") for (let i = 1; i < 7; i++) { const t = i/7, a = p(s.ox + (x - s.ox)*t, y0 + h*t, s.oz + (z - s.oz)*t), b = p(ex + (x - ex)*t, y0 + h*t, ez + (z - ez)*t); ctx.strokeStyle = "rgba(0,0,0,.18)"; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      });
    }
    function ballNow(x, y, z, r, color, sy = 1, o = {}) {
      const c = p(x, y, z), R = r*HW*1.12;
      const g = rad(ctx, c[0], c[1], R*.1, R*1.05, [[0, css(shade(color, 1.32))], [.5, css(color)], [1, css(shade(color, .55))]], c[0] - R*.35, c[1] - R*.4*sy);
      ctx.beginPath(); ctx.ellipse(c[0], c[1], R, R*sy, 0, 0, 7); ctx.fillStyle = g; ctx.fill();
      if (o.outline !== false) { ctx.lineWidth = .8; ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.stroke(); }
    }
    /* ---- primitivas públicas (entram na fila de profundidade) ---- */
    K.box = (x, z, w, d, y0, h, color, o) => enq(x, y0 + h, z, () => boxNow(x, z, w, d, y0, h, color, o));
    K.cyl = (x, z, r, y0, h, color, o) => enq(x, y0 + h*.5, z, () => cylNow(x, z, r, y0, h, color, o));
    K.cone = (x, z, r, y0, h, color) => enq(x, y0 + h*.5, z, () => coneNow(x, z, r, y0, h, color));
    K.pyr = (x, z, w, d, y0, h, color, tex) => enq(x, y0 + h*.5, z, () => pyrNow(x, z, w, d, y0, h, color, tex));
    K.ball = (x, y, z, r, color, sy, o) => enq(x, y, z, () => ballNow(x, y, z, r, color, sy, o));
    K.face = (pts3, fill, stroke, lw) => { const c = pts3.reduce((a, q) => [a[0] + q[0]/pts3.length, a[1] + q[1]/pts3.length, a[2] + q[2]/pts3.length], [0, 0, 0]); enq(c[0], c[1], c[2], () => face(pts3, fill, stroke, lw)); };
    K.line = (a, b, w, color, alpha = 1) => enq((a[0] + b[0])/2, (a[1] + b[1])/2, (a[2] + b[2])/2, () => { const A = p(...a), B = p(...b); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineWidth = w; ctx.strokeStyle = rgba(color, alpha); ctx.stroke(); });
    /* desenho num plano vertical (u ao longo de (ux,uz), v para cima): rodas, janelas, faixas */
    K.plane = (x, y, z, ux, uz, fn) => enq(x + ux*.0001, y, z, () => onPlane(x, y, z, ux, uz, () => fn(ctx)));
    return K;
  }

  /* ---------- fachadas (u horizontal, v vertical, em unidades do mundo) ---------- */
  const noise = (ctx, len, h, n, a = .07) => { for (let i = 0; i < n; i++) { ctx.fillStyle = `rgba(${rint(2) ? "255,255,255" : "0,0,0"},${rnd(.02, a)})`; ctx.fillRect(rnd(0, len), rnd(0, h), rnd(.03, .18), rnd(.02, .12)); } };
  const FACADE = {
    plain(ctx, len, h, o) { ctx.fillStyle = css(o.color); ctx.fillRect(0, 0, len, h); noise(ctx, len, h, 160); },
    glass(ctx, len, h, o) {                                   // fachada cortina: reflexo de céu, montantes e pavimentos
      const g = ctx.createLinearGradient(0, h, 0, 0); g.addColorStop(0, css(o.tint0 ?? 0x1e2c3a)); g.addColorStop(.5, css(o.tint1 ?? 0x4f7396)); g.addColorStop(1, css(o.tint2 ?? 0xa7c6e2));
      ctx.fillStyle = g; ctx.fillRect(0, 0, len, h);
      const fl = o.floorH ?? .62, cols = Math.max(2, Math.round(len/(o.colW ?? .8))), cw = len/cols;
      for (let y = 0; y < h; y += fl) { ctx.fillStyle = "rgba(15,22,30,.55)"; ctx.fillRect(0, y, len, .06); ctx.fillStyle = "rgba(190,210,230,.35)"; ctx.fillRect(0, y + .07, len, .03); ctx.fillStyle = "rgba(15,20,28,.34)"; ctx.fillRect(0, y + .1, len, .12); }
      for (let i = 0; i <= cols; i++) { ctx.fillStyle = "rgba(20,26,34,.55)"; ctx.fillRect(i*cw - .025, 0, .05, h); }
      for (let i = 0; i < 4; i++) { const x0 = rnd(0, len), wd = rnd(.2, .9); ctx.fillStyle = `rgba(255,255,255,${rnd(.05, .14)})`; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + wd, 0); ctx.lineTo(x0 + wd + h*.45, h); ctx.lineTo(x0 + h*.45, h); ctx.closePath(); ctx.fill(); }
      const lit = o.lit ?? .14;
      for (let y = 0; y < h - fl; y += fl) for (let i = 0; i < cols; i++) if (Math.random() < lit) { ctx.fillStyle = `rgba(255,${rint(40) + 200},${rint(60) + 120},${rnd(.55, .9)})`; ctx.fillRect(i*cw + .05, y + .24, cw - .1, fl - .3); }
      noise(ctx, len, h, 60, .05);
    },
    concrete(ctx, len, h, o) {                                 // concreto/pintura: janelas emolduradas, sacadas, ar-condicionado
      const c = o.color; ctx.fillStyle = css(c); ctx.fillRect(0, 0, len, h);
      const bl = ctx.createLinearGradient(0, 0, 0, h); bl.addColorStop(0, "rgba(0,0,0,.14)"); bl.addColorStop(1, "rgba(255,255,255,.08)"); ctx.fillStyle = bl; ctx.fillRect(0, 0, len, h);
      noise(ctx, len, h, 420, .09);
      const fl = o.floorH ?? .95, cols = Math.max(1, Math.floor(len/(o.colW ?? 1.05))), cw = len/cols;
      for (let y = .35; y + fl*.7 < h; y += fl) for (let i = 0; i < cols; i++) {
        const wx = i*cw + cw*.2, ww = cw*.6, wy = y + .12, wh = fl*.52;
        ctx.fillStyle = "rgba(20,16,10,.1)"; ctx.fillRect(wx + ww*.1, wy - wh*.2, ww*.8, fl*.8);
        if (o.balconies && (i + Math.round(y/fl))%2 === 0) { ctx.fillStyle = css(shade(c, 1.12)); ctx.fillRect(wx - .1, wy - .08, ww + .2, .1); ctx.fillStyle = "rgba(20,20,24,.7)"; ctx.fillRect(wx - .1, wy - .08, ww + .2, .03); for (let r = 0; r < 5; r++) ctx.fillRect(wx - .08 + r*(ww + .16)/4, wy - .08, .02, -.26); }
        ctx.fillStyle = css(shade(c, .55)); ctx.fillRect(wx - .05, wy - .05, ww + .1, wh + .1);
        const gl = ctx.createLinearGradient(0, wy + wh, 0, wy); gl.addColorStop(0, "#27384a"); gl.addColorStop(1, "#8fb0cf"); ctx.fillStyle = gl; ctx.fillRect(wx, wy, ww, wh);
        if (Math.random() < (o.lit ?? .25)) { ctx.fillStyle = "rgba(255,226,150,.8)"; ctx.fillRect(wx, wy, ww, wh); ctx.fillStyle = "rgba(255,255,255,.2)"; ctx.fillRect(wx, wy, ww, wh*.4); }
        else if (Math.random() < .3) { ctx.fillStyle = "rgba(230,220,200,.55)"; ctx.fillRect(wx, wy, ww*.45, wh); }
        ctx.fillStyle = "rgba(255,255,255,.3)"; ctx.beginPath(); ctx.moveTo(wx, wy + wh*.1); ctx.lineTo(wx + ww*.35, wy); ctx.lineTo(wx + ww*.55, wy); ctx.lineTo(wx, wy + wh*.55); ctx.fill();
        ctx.fillStyle = css(shade(c, 1.25)); ctx.fillRect(wx - .08, wy - .1, ww + .16, .06);
        if (Math.random() < .12) { ctx.fillStyle = "#c9cdd0"; ctx.fillRect(wx + ww*.15, wy - .26, ww*.5, .2); ctx.fillStyle = "#3a3d40"; ctx.fillRect(wx + ww*.2, wy - .22, ww*.4, .05); }
      }
      ctx.fillStyle = "rgba(0,0,0,.15)"; for (let y = 0; y < h; y += fl) ctx.fillRect(0, y, len, .04);
    },
    apart(ctx, len, h, o) { FACADE.concrete(ctx, len, h, { ...o, balconies:true, colW:1.0, lit:.3 }); },
    white(ctx, len, h, o) {                                    // condomínio branco com sacadas de vidro azulado
      ctx.fillStyle = css(o.color); ctx.fillRect(0, 0, len, h); noise(ctx, len, h, 260, .06);
      const fl = .85, cols = Math.max(2, Math.round(len/1.0)), cw = len/cols;
      for (let y = .3; y + fl*.8 < h; y += fl) {
        ctx.fillStyle = "rgba(0,0,0,.18)"; ctx.fillRect(0, y - .04, len, .05);
        for (let i = 0; i < cols; i++) { const wx = i*cw + .1, ww = cw - .2, wy = y + .06, wh = fl*.6;
          const gl = ctx.createLinearGradient(0, wy + wh, 0, wy); gl.addColorStop(0, "#3a7a98"); gl.addColorStop(1, "#bfe6f2"); ctx.fillStyle = gl; ctx.fillRect(wx, wy, ww, wh);
          ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.beginPath(); ctx.moveTo(wx, wy + wh*.5); ctx.lineTo(wx + ww*.5, wy); ctx.lineTo(wx + ww*.75, wy); ctx.lineTo(wx, wy + wh*.9); ctx.fill();
          ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = .03; ctx.strokeRect(wx, wy, ww, wh);
          ctx.fillStyle = "#f4f4f2"; ctx.fillRect(wx - .06, wy - .1, ww + .12, .1); }
      }
    },
    ruin(ctx, len, h, o) {                                     // destruído: buracos, vidro quebrado, fogo e fuligem
      ctx.fillStyle = css(o.color); ctx.fillRect(0, 0, len, h); noise(ctx, len, h, 500, .14);
      const fl = .95, cols = Math.max(1, Math.floor(len/1.05)), cw = len/cols;
      for (let y = .35; y + fl*.7 < h; y += fl) for (let i = 0; i < cols; i++) {
        const wx = i*cw + cw*.2, ww = cw*.6, wy = y + .12, wh = fl*.52;
        ctx.fillStyle = "#0b0807"; ctx.fillRect(wx - .05, wy - .05, ww + .1, wh + .1);
        const r = Math.random();
        if (r < .4) { const gr = ctx.createLinearGradient(0, wy + wh, 0, wy); gr.addColorStop(0, "#ff9a2a"); gr.addColorStop(1, "#6a1a06"); ctx.fillStyle = gr; ctx.fillRect(wx, wy, ww, wh); ctx.fillStyle = "rgba(255,220,120,.7)"; ctx.fillRect(wx + ww*.2, wy + wh*.5, ww*.6, wh*.5); }
        else if (r < .7) { ctx.fillStyle = "rgba(120,150,170,.35)"; ctx.beginPath(); ctx.moveTo(wx, wy); ctx.lineTo(wx + ww*.6, wy); ctx.lineTo(wx + ww*.2, wy + wh); ctx.lineTo(wx, wy + wh); ctx.fill(); }
        ctx.fillStyle = "rgba(0,0,0,.35)"; ctx.fillRect(wx - .05, wy - fl*.7, ww + .1, fl*.7);
      }
      for (let i = 0; i < 5; i++) { ctx.fillStyle = "#0c0908"; ctx.beginPath(); const bx = rnd(0, len), by = rnd(h*.2, h*.95), r = rnd(.2, .6); for (let k = 0; k < 8; k++) { const a = k/8*6.28, rr = r*rnd(.6, 1.2); k ? ctx.lineTo(bx + Math.cos(a)*rr, by + Math.sin(a)*rr*1.2) : ctx.moveTo(bx + Math.cos(a)*rr, by + Math.sin(a)*rr*1.2); } ctx.fill(); }
      const sm = ctx.createLinearGradient(0, 0, 0, h); sm.addColorStop(0, "rgba(0,0,0,.4)"); sm.addColorStop(1, "rgba(0,0,0,0)"); ctx.fillStyle = sm; ctx.fillRect(0, h*.55, len, h*.45);
    },
    adobe(ctx, len, h, o) {
      ctx.fillStyle = css(o.color); ctx.fillRect(0, 0, len, h); noise(ctx, len, h, 420, .16);
      for (let i = 0; i < 18; i++) { ctx.strokeStyle = "rgba(90,60,30,.35)"; ctx.lineWidth = .03; ctx.beginPath(); let x = rnd(0, len), y = rnd(0, h); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += rnd(-.25, .25); y += rnd(-.25, .1); ctx.lineTo(x, y); } ctx.stroke(); }
      const gr = ctx.createLinearGradient(0, 0, 0, 1); gr.addColorStop(0, "rgba(90,60,30,.4)"); gr.addColorStop(1, "rgba(90,60,30,0)"); ctx.fillStyle = gr; ctx.fillRect(0, 0, len, 1);
    },
    stone(ctx, len, h, o) {
      ctx.fillStyle = css(o.color); ctx.fillRect(0, 0, len, h); noise(ctx, len, h, 260, .07);
      ctx.fillStyle = "rgba(0,0,0,.07)"; for (let i = 0; i < 6; i++) ctx.fillRect(rnd(0, len), 0, .04, h);
      if (o.glassBand) { const g = ctx.createLinearGradient(0, o.glassBand[0], 0, o.glassBand[1]); g.addColorStop(0, "#27425a"); g.addColorStop(1, "#8ab6d6"); ctx.fillStyle = g; ctx.fillRect(0, o.glassBand[0], len, o.glassBand[1] - o.glassBand[0]); for (let i = 0; i <= len*1.2; i++) { ctx.fillStyle = "rgba(255,255,255,.5)"; ctx.fillRect(i/1.2, o.glassBand[0], .03, o.glassBand[1] - o.glassBand[0]); } }
    },
    wood(ctx, len, h, o) { ctx.fillStyle = css(o.color); ctx.fillRect(0, 0, len, h); for (let i = 0; i < len*6; i++) { ctx.fillStyle = `rgba(${rint(2) ? "255,230,190" : "40,20,0"},${rnd(.04, .14)})`; ctx.fillRect(rnd(0, len), 0, .03, h); } },
  };

  /* cria (ou reaproveita) uma textura de peça: rx/rz = meia extensão, h = altura */
  function make(key, rx, rz, h, draw) {
    const k = "scn_" + key;
    if (!env.cache[k]) {
      const pad = 10;
      const W = Math.ceil(2*(rx + rz)*HW + pad*2), Hh = Math.ceil(2*(rx + rz)*HH + h*HY + pad*2);
      const c = document.createElement("canvas"); c.width = Math.ceil(W*QS); c.height = Math.ceil(Hh*QS);
      const x = c.getContext("2d"); x.scale(QS, QS); x.lineJoin = "round"; x.lineCap = "round";
      const ox = W/2, oy = (rx + rz)*HH + h*HY + pad;
      const K = drawKit(x, ox, oy); draw(K); K.flush();
      GFX.scene.textures.addCanvas(k, c);
      env.keys.push(k);
      env.cache[k] = { w:W, h:Hh, ox, oy };
    }
    return k;
  }
  function put(key, x, z, y = 0, o = {}) {
    const d = env.cache[key], im = GFX.scene.add.image(0, 0, key).setOrigin(d.ox/d.w, d.oy/d.h);
    const q = GFX.P(x, y, z);
    im.setScale((o.scale || 1)/QS).setPosition(q[0], q[1]);
    if (o.flip) im.scaleX *= -1;
    im.setDepth(GFX.D_SORT + GFX.depthOf(x, z) + (o.bias || 0));
    if (o.alpha != null) im.setAlpha(o.alpha);
    if (o.blend) im.setBlendMode(o.blend);
    env.objs.push(im);
    return im;
  }
  /* peça + sombra projetada no chão (shadowBox: [largura, profundidade, altura]) */
  function piece(key, rx, rz, h, draw, x, z, y, o = {}) {
    const im = put(make(key, rx, rz, h, draw), x, z, y, o);
    if (o.shadowBox && env.ground) { const s = o.scale || 1; env.ground.shadowBox(x, z, o.shadowBox[0]*s, o.shadowBox[1]*s, o.shadowBox[2]*s); }
    return im;
  }

  /* ================================================================
     ÁRVORES REALISTAS (tronco e copa separados para a copa balançar)
     ================================================================ */
  function drawCanopy(x, cx, cy, R, pal, o = {}) {
    const blobs = [], n = o.blobs ?? 7;
    for (let i = 0; i < n; i++) { const a = rnd(0, 6.28), d = i ? rnd(.1, .55)*R : 0; blobs.push({ x:cx + Math.cos(a)*d, y:cy + Math.sin(a)*d*.62 - (i ? R*.05 : 0), r:R*rnd(.5, .78) }); }
    blobs.forEach(b => { x.fillStyle = css(pal[0]); x.beginPath(); x.ellipse(b.x, b.y + b.r*.06, b.r, b.r*.82, 0, 0, 7); x.fill(); });
    const cnt = o.leaves ?? Math.round(R*R/9), lr = o.leafR ?? Math.max(1.6, R/16);
    for (let i = 0; i < cnt; i++) {
      const b = blobs[rint(blobs.length)], a = rnd(0, 6.28), d = Math.sqrt(Math.random())*b.r*.97;
      const px = b.x + Math.cos(a)*d, py = b.y + Math.sin(a)*d*.82;
      const lx = (px - b.x)/b.r, ly = (py - b.y)/(b.r*.82), lit = -lx*.45 - ly*.7 + rnd(-.3, .3) + (d/b.r - .5)*.4;
      const t = Math.max(0, Math.min(1, (lit + 1)/2.0)), ci = Math.min(pal.length - 1, 1 + Math.floor(t*(pal.length - 1.001)));
      x.fillStyle = rgba(pal[ci], rnd(.7, 1));
      x.beginPath(); x.ellipse(px, py, lr*rnd(.8, 1.5), lr*rnd(.55, 1), rnd(0, 3.14), 0, 7); x.fill();
    }
    for (const b of blobs) { const g = x.createRadialGradient(b.x - b.r*.3, b.y - b.r*.4, 0, b.x - b.r*.3, b.y - b.r*.4, b.r*.7); g.addColorStop(0, rgba(pal[pal.length - 1], .35)); g.addColorStop(1, rgba(pal[pal.length - 1], 0)); x.fillStyle = g; x.beginPath(); x.ellipse(b.x, b.y, b.r, b.r*.82, 0, 0, 7); x.fill(); }
    if (o.flowers) for (let i = 0; i < R*R/6; i++) { const b = blobs[rint(blobs.length)], a = rnd(0, 6.28), d = Math.sqrt(Math.random())*b.r*.95; const px = b.x + Math.cos(a)*d, py = b.y + Math.sin(a)*d*.8; if (py < b.y + b.r*.3) { x.fillStyle = rgba(pick(o.flowers), rnd(.6, 1)); x.beginPath(); x.arc(px, py, rnd(.8, 1.7), 0, 7); x.fill(); } }
  }
  function drawTrunk(x, bx, by, h, w0, w1, color, o = {}) {
    const curve = o.curve ?? 0, steps = 12, L = [], Rr = [];
    for (let i = 0; i <= steps; i++) { const t = i/steps, cx = bx + curve*Math.sin(t*Math.PI*.7)*h*.12, cy = by - t*h, w = (w0 + (w1 - w0)*t)*(1 + (1 - t)*.14); L.push([cx - w/2, cy]); Rr.push([cx + w/2, cy]); }
    x.beginPath(); L.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); for (let i = Rr.length - 1; i >= 0; i--) x.lineTo(Rr[i][0], Rr[i][1]); x.closePath();
    x.fillStyle = lin(x, bx - w0, 0, bx + w0, 0, [[0, css(shade(color, 1.3))], [.4, css(color)], [1, css(shade(color, .45))]]); x.fill();
    x.save(); x.clip();
    for (let i = 0; i < h*1.3; i++) { const t = Math.random(), cx = bx + (Math.random() - .5)*w0*1.2, cy = by - t*h; x.strokeStyle = `rgba(${rint(2) ? "20,12,6" : "255,235,200"},${rnd(.08, .3)})`; x.lineWidth = rnd(.4, 1); x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + rnd(-.8, .8), cy - rnd(3, 9)); x.stroke(); }
    x.restore();
    x.strokeStyle = "rgba(0,0,0,.4)"; x.lineWidth = .7; x.stroke();
  }
  const PAL = {
    broad:  [0x143a1c, 0x1f5a28, 0x2e7a34, 0x479a44, 0x6cb754, 0x92d06a],
    broad2: [0x16401f, 0x246a2c, 0x358a3a, 0x58aa4a, 0x80c45a, 0xa4dc72],
    dark:   [0x0c2a12, 0x153a1c, 0x1f5226, 0x2c6a30, 0x3d8240, 0x58a052],
    olive:  [0x2a3a14, 0x3e5220, 0x566e2c, 0x748c3c, 0x94a84c, 0xb4c466],
    ipe:    [0x1f4a22, 0x2f6a30, 0x4a8a38, 0x7aa83a, 0xb4c040, 0xe0d24a],
  };
  function addTex(k, canvas, info) { GFX.scene.textures.addCanvas(k, canvas); env.keys.push(k); env.cache[k] = info; }
  function tree(x, z, o = {}) {
    const R = (o.r ?? rnd(1.0, 1.4))*HW*1.15*1.5, th = (o.h ?? rnd(1.5, 2.3))*.6;
    const pal = PAL[o.pal || pick(["broad", "broad2"])];
    const vk = "tree_" + (o.pal || "b") + Math.round(R) + "_" + rint(o.variants ?? 4) + (o.flowers ? "f" : "");
    const trunkH = th*HY, W = R*2.4, H = R*2.0 + 6;
    if (!env.cache["scn_c" + vk]) {
      const c = document.createElement("canvas"); c.width = Math.ceil(W*QS); c.height = Math.ceil(H*QS); const cx = c.getContext("2d"); cx.scale(QS, QS);
      drawCanopy(cx, W/2, H - R*.95, R, pal, { blobs:o.blobs ?? 7, flowers:o.flowers });
      addTex("scn_c" + vk, c, { w:W, h:H, ox:W/2, oy:H - 2 });
      const tw = R*.5 + 14, tc = document.createElement("canvas"); tc.width = Math.ceil(tw*QS*2); tc.height = Math.ceil((trunkH + 10)*QS); const tx = tc.getContext("2d"); tx.scale(QS, QS);
      drawTrunk(tx, tw, trunkH + 8, trunkH + 3, R*.2 + 3, R*.1 + 2, o.bark ?? 0x6a4a2c, { curve:rnd(-1, 1) });
      addTex("scn_t" + vk, tc, { w:tw*2, h:trunkH + 10, ox:tw, oy:trunkH + 8 });
    }
    const kt = "scn_t" + vk, kc = "scn_c" + vk, sc = o.scale || 1, flip = Math.random() < .5 ? -1 : 1;
    const dt = env.cache[kt], dc = env.cache[kc], q = GFX.P(x, 0, z), dep = GFX.D_SORT + GFX.depthOf(x, z);
    const trunk = GFX.scene.add.image(q[0], q[1], kt).setOrigin(dt.ox/dt.w, dt.oy/dt.h).setScale(sc/QS).setDepth(dep);
    const crown = GFX.scene.add.image(q[0], q[1] - trunkH*sc*.98, kc).setOrigin(dc.ox/dc.w, dc.oy/dc.h).setScale(sc*flip/QS, sc/QS).setDepth(dep + .5);
    env.objs.push(trunk, crown);
    if (env.ground) { env.ground.shadowRound(x, z, R/HW*.7*sc, th*sc + R/HW*1.3*sc); env.ground.ao(x, z, .5*sc, .5*sc, .25); }
    const ph = rnd(0, 6.28), amp = o.wind ?? .012;
    env.ticks.push(t => { const w = Math.sin(t*1.1 + ph + x*.3) + Math.sin(t*2.3 + ph*1.7)*.4; crown.setRotation(w*amp); });
    return { trunk, crown };
  }
  /* palmeira: tronco anelado e frondes arqueadas com folíolos */
  function palm(x, z, h = 3.2, o = {}) {
    const hp = h*HY, W = 150, H = 110, kk = "scn_palmcrown" + rint(3) + Math.round(h);
    if (!env.cache[kk]) {
      const c = document.createElement("canvas"); c.width = Math.ceil(W*QS); c.height = Math.ceil(H*QS); const cx = c.getContext("2d"); cx.scale(QS, QS); cx.lineCap = "round";
      const ox = W/2, oy = H*.62, nf = 11;
      for (let i = 0; i < nf; i++) {
        const a = i/nf*Math.PI*2 + rnd(-.2, .2), len = rnd(46, 62), sx = Math.cos(a), droop = rnd(.28, .55), up = rnd(8, 20);
        const pts = []; for (let k = 0; k <= 12; k++) { const t = k/12; pts.push([ox + sx*len*t, oy - up*Math.sin(t*Math.PI*.8) + t*t*len*droop*(Math.abs(sx)*.9 + .25) + Math.sin(a)*len*.22*t]); }
        const back = Math.sin(a) < 0;
        cx.strokeStyle = back ? "#2a5a24" : "#3f7a2e"; cx.lineWidth = 1.6; cx.beginPath(); pts.forEach(([a1, b1], j) => j ? cx.lineTo(a1, b1) : cx.moveTo(a1, b1)); cx.stroke();
        for (let k = 1; k < 12; k++) { const [px, py] = pts[k], [qx, qy] = pts[k + 1], tx = qx - px, ty = qy - py, tl = Math.hypot(tx, ty) || 1, nx = -ty/tl, ny = tx/tl, ll = (1 - Math.abs(k - 6)/9)*13 + 3;
          [-1, 1].forEach(sd => { const ex = px + nx*sd*ll + tx*.9, ey = py + ny*sd*ll*.6 + ty*.9 + ll*.5; cx.strokeStyle = rgba(pick(back ? [0x24541f, 0x2f6a28] : [0x4a8a34, 0x62a03c, 0x3a7a2c]), .95); cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(px, py); cx.lineTo(ex, ey); cx.stroke(); }); }
      }
      [[-3, 2], [3, 3], [0, 4]].forEach(([dx, dy]) => { const g = cx.createRadialGradient(ox + dx - 1, oy + dy - 1, 0, ox + dx, oy + dy, 4.5); g.addColorStop(0, "#9a7a4a"); g.addColorStop(1, "#4a3418"); cx.fillStyle = g; cx.beginPath(); cx.arc(ox + dx, oy + dy, 4.2, 0, 7); cx.fill(); });
      addTex(kk, c, { w:W, h:H, ox, oy });
    }
    const tk = "scn_palmtrunk" + Math.round(h*10);
    if (!env.cache[tk]) {
      const tw = 24, tc = document.createElement("canvas"); tc.width = Math.ceil(tw*QS); tc.height = Math.ceil((hp + 8)*QS); const tx = tc.getContext("2d"); tx.scale(QS, QS);
      drawTrunk(tx, tw/2, hp + 6, hp + 4, 7, 4.2, 0x8a7a5a, { curve:rnd(-1.2, 1.2) });
      tx.save(); tx.globalCompositeOperation = "source-atop"; tx.strokeStyle = "rgba(40,30,15,.45)"; tx.lineWidth = .8; for (let y = hp; y > 6; y -= 3.4) { tx.beginPath(); tx.moveTo(tw/2 - 6, y); tx.quadraticCurveTo(tw/2, y + 1.6, tw/2 + 6, y); tx.stroke(); } tx.restore();
      addTex(tk, tc, { w:tw, h:hp + 8, ox:tw/2, oy:hp + 6 });
    }
    const dt = env.cache[tk], dc = env.cache[kk], q = GFX.P(x, 0, z), dep = GFX.D_SORT + GFX.depthOf(x, z), s = o.scale || 1;
    const trunk = GFX.scene.add.image(q[0], q[1], tk).setOrigin(dt.ox/dt.w, dt.oy/dt.h).setScale(s/QS).setDepth(dep);
    const crown = GFX.scene.add.image(q[0], q[1] - hp*s*.97, kk).setOrigin(dc.ox/dc.w, dc.oy/dc.h).setScale(s*(Math.random() < .5 ? -1 : 1)/QS, s/QS).setDepth(dep + .5);
    env.objs.push(trunk, crown);
    if (env.ground) env.ground.shadowRound(x, z, .5, h*s + 1.5);
    const ph = rnd(0, 6.28); env.ticks.push(t => crown.setRotation(Math.sin(t*1.5 + ph + x*.4)*.02 + Math.sin(t*3.1 + ph)*.006));
  }
  /* árvore seca (sertão) */
  function deadTree(x, z, h = 3.4) {
    piece("dead" + rint(4) + Math.round(h*10), 2.6, 2.6, h + 1.2, K => {
      const { ctx } = K, base = K.p(0, 0, 0);
      const branch = (x0, y0, ang, len, w, d) => { const x1 = x0 + Math.cos(ang)*len, y1 = y0 + Math.sin(ang)*len; ctx.strokeStyle = css(d > 2 ? 0x5a4a38 : 0x6a5a46); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); ctx.strokeStyle = "rgba(255,240,210,.18)"; ctx.lineWidth = w*.3; ctx.beginPath(); ctx.moveTo(x0 - w*.2, y0); ctx.lineTo(x1 - w*.2, y1); ctx.stroke(); if (d > 0) { branch(x1, y1, ang + rnd(.3, .8), len*.7, w*.65, d - 1); branch(x1, y1, ang - rnd(.3, .8), len*.7, w*.65, d - 1); } };
      branch(base[0], base[1], -Math.PI/2 + rnd(-.08, .08), h*HY*.48, 6, 3);
    }, x, z, 0);
    if (env.ground) env.ground.shadowRound(x, z, .5, h);
  }
  /* mandacaru: cacto colunar com costelas e espinhos */
  function cactus(x, z, h) {
    piece("cac" + Math.round(h*10) + rint(3), 2.2, 1.4, h + .6, K => {
      const { ctx, p } = K;
      const col = (cx, cz, r, y0, hh, tilt = 0) => {
        const b = p(cx, y0, cz), t = p(cx + tilt, y0 + hh, cz), rx = r*SQ2*HW;
        const g = lin(ctx, b[0] - rx, 0, b[0] + rx, 0, [[0, "#6aa05a"], [.35, "#4d8a40"], [.75, "#2f6a2c"], [1, "#1e4a1e"]]);
        ctx.beginPath(); ctx.moveTo(b[0] - rx, b[1]); ctx.lineTo(t[0] - rx, t[1]); ctx.ellipse(t[0], t[1], rx, rx*.5, 0, Math.PI, 0); ctx.lineTo(b[0] + rx, b[1]); ctx.ellipse(b[0], b[1], rx, rx*.5, 0, 0, Math.PI); ctx.closePath(); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,.35)"; ctx.lineWidth = .8; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(t[0], t[1], rx, rx*.5, 0, 0, 7); ctx.fillStyle = "#5c9a50"; ctx.fill();
        for (let i = -2; i <= 2; i++) { ctx.strokeStyle = "rgba(10,40,10,.45)"; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(b[0] + i*rx*.4, b[1] + Math.abs(i)*.8); ctx.lineTo(t[0] + i*rx*.4, t[1] + Math.abs(i)*.8); ctx.stroke();
          for (let s = 0; s < hh*3.2; s++) { const tt = s/(hh*3.2), sx = b[0] + (t[0] - b[0])*tt + i*rx*.4, sy = b[1] + (t[1] - b[1])*tt + Math.abs(i)*.8; ctx.fillStyle = "rgba(235,225,190,.75)"; ctx.fillRect(sx, sy, 1, 1); } }
      };
      col(0, 0, .26, 0, h);
      [[-1, .55], [1, .7]].forEach(([sd, k]) => { const a = p(0, h*k, 0), b = p(sd*.6, h*k, 0), rx = .2*SQ2*HW; ctx.strokeStyle = "#3f7a38"; ctx.lineWidth = rx*1.7; ctx.lineCap = "round"; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); col(sd*.6, 0, .2, h*k, h*.34); });
    }, x, z, 0);
    if (env.ground) env.ground.shadowRound(x, z, .5, h);
  }
  /* arbusto / moita */
  function bush(x, z, r = .7, pal = "broad") {
    const R = r*HW*1.1, k = "scn_bush_" + pal + Math.round(R) + rint(3);
    if (!env.cache[k]) { const W = R*2.8, H = R*1.7, c = document.createElement("canvas"); c.width = Math.ceil(W*QS); c.height = Math.ceil(H*QS); const cx = c.getContext("2d"); cx.scale(QS, QS); drawCanopy(cx, W/2, H - R*.78, R, PAL[pal], { blobs:5, leaves:R*R/6, leafR:1.5 }); addTex(k, c, { w:W, h:H, ox:W/2, oy:H - 1 }); }
    const im = put(k, x, z, 0); if (env.ground) env.ground.shadowRound(x, z, r*.8, r*1.2);
    const ph = rnd(0, 6); env.ticks.push(t => im.setRotation(Math.sin(t*1.3 + ph)*.008));
    return im;
  }
  /* carro (eixo x) */
  function car(x, z, color) {
    piece("car" + color, 1.6, 1.0, 1.4, K => {
      const L = 2.3, Wd = 1.05, cw = 1.2, cd = .9, cx = -.1;
      K.box(0, 0, L, Wd, .22, .46, color, { roof:false });
      K.box(cx, 0, cw, cd, .68, .4, shade(color, 1.05), { roof:false, top:shade(color, 1.18) });
      const glass = (u, v, w, h, c = "#1d2a38") => (ctx) => { ctx.fillStyle = c; ctx.fillRect(u, v, w, h); ctx.fillStyle = "rgba(200,225,245,.3)"; ctx.beginPath(); ctx.moveTo(u, v + h*.5); ctx.lineTo(u + w*.5, v + h); ctx.lineTo(u + w*.78, v + h); ctx.lineTo(u, v + h*.2); ctx.fill(); };
      [-1, 1].forEach(sd => {
        K.plane(cx - cw/2, .68, sd*cd/2 + sd*.004, 1, 0, glass(.08, .06, cw - .16, .28));            // vidros laterais
        K.plane(cx + sd*cw/2 + sd*.004, .68, -cd/2, 0, 1, glass(.08, .06, cd - .16, .28, "#22303f"));   // para-brisa e vidro traseiro
        K.plane(-L/2, 0, sd*Wd/2 + sd*.004, 1, 0, ctx => [.18, .82].forEach(f => { const u = L*f, v = .22; ctx.fillStyle = "#101114"; ctx.beginPath(); ctx.arc(u, v, .24, 0, 7); ctx.fill(); ctx.fillStyle = "#9aa0a8"; ctx.beginPath(); ctx.arc(u, v, .11, 0, 7); ctx.fill(); }));   // rodas
      });
      K.plane(L/2 + .004, .3, -Wd*.3, 0, 1, ctx => { ctx.fillStyle = "rgba(255,245,200,.9)"; ctx.fillRect(0, 0, Wd*.6, .12); });
    }, x, z, 0, { shadowBox:[2.4, 1.1, 1.1] });
  }
  const lamp = (x, z, h = 5) => piece("lamp" + h, .9, .9, h + .6, K => {
    const { ctx, p } = K; K.cyl(0, 0, .09, 0, h, 0x4a4f55); K.cyl(0, 0, .16, 0, .35, 0x3a3f45);
    const a = p(0, h, 0), b = p(.8, h + .1, 0); ctx.strokeStyle = "#4a4f55"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(a[0] + 8, a[1] - 10, b[0], b[1]); ctx.stroke();
    K.box(.9, 0, .8, .3, h, .12, 0x30343a, { roof:false }); K.face([[.55, h, -.12], [1.25, h, -.12], [1.25, h, .12], [.55, h, .12]], "rgba(255,244,200,.95)", null);
  }, x, z, 0, { shadowBox:[.3, .3, h] });

  /* prédio com sombra projetada e oclusão ambiente no chão */
  function building(x, z, w, d, h, o = {}) {
    const style = o.style || pick(["glass", "concrete", "apart"]);
    const color = o.color ?? (style === "glass" ? 0x4f7396 : pick([0xd9d2c2, 0xcfc8b8, 0xe4dccb, 0xb8b2a4, 0xc8bfae, 0xdcd0b8, 0xb4a998]));
    const key = `bld${style}${w.toFixed(1)}_${d.toFixed(1)}_${h.toFixed(1)}_${color}_${rint(6)}`;
    const sc = o.scale || 1;
    const im = piece(key, w/2 + .2, d/2 + .2, h + 1.8, K => {
      K.box(0, 0, w, d, 0, h, color, { style, floorH:o.floorH, colW:o.colW, lit:o.lit, balconies:o.balconies, rooftop:o.rooftop, roofColor:o.roofColor, tint0:o.tint0, tint1:o.tint1, tint2:o.tint2 });
      if (o.antenna) K.cyl(rnd(-w*.2, w*.2), rnd(-d*.2, d*.2), .05, h + .25, 2, 0x777b80);
    }, x, z, 0, { scale:sc });
    if (env.ground && o.noShadow !== true) { env.ground.shadowBox(x, z, w*sc, d*sc, h*sc); env.ground.ao(x, z, w*sc/2, d*sc/2, .3); }
    return im;
  }

  /* ================================================================
     CENÁRIOS
     ================================================================ */
  const SC = {};

  /* ----- São Paulo: Avenida Paulista ----- */
  SC.paulista = (E, g) => {
    g.poly([[-60, -9.4], [60, -9.4], [60, 9.4], [-60, 9.4]], "asfalto");
    g.poly([[-60, -15.2], [60, -15.2], [60, -9.4], [-60, -9.4]], "calcada");
    g.poly([[-60, 9.4], [60, 9.4], [60, 14.2], [-60, 14.2]], "calcada");
    g.poly([[-60, -9.65], [60, -9.65], [60, -9.4], [-60, -9.4]], 0x8a8a84); g.poly([[-60, 9.4], [60, 9.4], [60, 9.65], [-60, 9.65]], 0x8a8a84);
    g.poly([[-60, -15.5], [60, -15.5], [60, -15.2], [-60, -15.2]], 0x4a4a46);
    for (let x = -50; x < 52; x += 3.4) { g.paint([x, -6.6], [x + 1.8, -6.6], .22, 0xf2f2ea, .95); g.paint([x, 6.6], [x + 1.8, 6.6], .22, 0xf2f2ea, .95); }
    g.paint([-60, -9.1], [60, -9.1], .2, 0xf0c020, .9); g.paint([-60, 9.1], [60, 9.1], .2, 0xf0c020, .9);
    for (let i = -4; i <= 4; i++) g.paint([19 + i*.62, -9.2], [19 + i*.62, 9.2], .34, 0xf2f2ea, .92);
    g.paint([17.7, -9.2], [17.7, 9.2], .3, 0xf2f2ea, .9);
    for (let i = 0; i < 18; i++) g.blob(rnd(-30, 30), rnd(-9, 9), rnd(.8, 2.4), rnd(.6, 1.6), 0x111214, rnd(.08, .2));
    for (let i = 0; i < 5; i++) { const x = rnd(-26, 26), z = rnd(-8, 8); g.poly([[x - .5, z - .5], [x + .5, z - .5], [x + .5, z + .5], [x - .5, z + .5]], 0x3e4147, { alpha:.9 }); g.line([x - .5, z], [x + .5, z], 1, 0x1a1b1e, .8); g.line([x, z - .5], [x, z + .5], 1, 0x1a1b1e, .8); }
    for (let i = 0; i < 9; i++) building(-24 + i*4.6 + rnd(-.6, .6), -19 - rnd(0, 4), rnd(3.2, 4.4), rnd(3.4, 4.8), rnd(5, 11), { lit:.12 });
    for (let i = 0; i < 7; i++) building(-30 + i*5.2 + rnd(-.6, .6), -28 - rnd(0, 4), rnd(3.6, 4.8), rnd(3.6, 4.8), rnd(10, 17), { style:"glass", antenna:i%2, lit:.1 });
    for (let i = 0; i < 8; i++) building(24 + rnd(0, 3), -12 + i*3.9 + rnd(-.4, .4), rnd(3, 4.2), rnd(3, 3.8), rnd(5, 10), { lit:.12 });
    for (let i = 0; i < 6; i++) building(32 + rnd(0, 3), -14 + i*4.8 + rnd(-.4, .4), rnd(3.4, 4.4), rnd(3.4, 4.2), rnd(9, 16), { style:"glass", antenna:i%2, lit:.1 });
    piece("masp", 8.5, 3.6, 8, K => {
      K.box(-6.4, 0, 1.3, 4.4, 0, 4.4, 0xb8281e, { style:"stone", roof:false }); K.box(6.4, 0, 1.3, 4.4, 0, 4.4, 0xb8281e, { style:"stone", roof:false });
      K.box(0, 0, 15, 5.4, 3.6, 2.6, 0xb8281e, { style:"stone", glassBand:[.6, 1.7], roofColor:0xe8e8e4, rooftop:false });
    }, 10, -16.5, 0, { scale:.9 });
    g.shadowBox(10, -16.5, 14, 5, 6.4); g.ao(4.5, -16.5, 1, 2, .3); g.ao(15.5, -16.5, 1, 2, .3);
    for (let x = -22; x <= 22; x += 8) lamp(x, -9.9);
    for (let x = -20; x <= 22; x += 9) { tree(x + 2, 11.6, { r:rnd(.8, 1), h:rnd(1.4, 2), pal:"broad" }); tree(x + 4, -11.3, { r:rnd(.8, 1.05), h:rnd(1.4, 2), pal:"broad2" }); }
    [[-18, 8.2, 0xc62828], [25, -7.6, 0xf2c200], [-27, -7.6, 0x1e5aa8], [-26, 7.8, 0xe8e8e8], [6, 8, 0x2a2a2e]].forEach(([x, z, c]) => car(x, z, c));
    piece("bench", 1, .8, 1, K => { K.box(0, 0, 1.5, .4, .3, .1, 0x7a5a3a, { style:"wood", roof:false }); K.box(0, -.18, 1.5, .08, .4, .4, 0x7a5a3a, { style:"wood", roof:false }); K.box(-.6, 0, .08, .4, 0, .3, 0x333333, { roof:false }); K.box(.6, 0, .08, .4, 0, .3, 0x333333, { roof:false }); }, 10, -10.8, 0, { shadowBox:[1.5, .5, .8] });
    E.cloudShadows(.1); E.grade({ sat:1.08, con:1.04, bri:1.12 });
  };

  /* ----- Rio: campo de futebol aos pés do Cristo ----- */
  SC.rio = (E, g) => {
    g.poly([[-34, -22], [34, -22], [34, 22], [-34, 22]], "calcada", { tint:0x8c8470, tintA:.5 });
    const FX = 20, FZ = 8.6;
    g.poly([[-FX - 1.2, -FZ - 1.2], [FX + 1.2, -FZ - 1.2], [FX + 1.2, FZ + 1.2], [-FX - 1.2, FZ + 1.2]], "gramado", { tint:0x103a14, tintA:.35 });
    g.poly([[-FX, -FZ], [FX, -FZ], [FX, FZ], [-FX, FZ]], "gramado");
    for (let i = 0; i < 10; i += 2) g.poly([[-FX + i*4, -FZ], [-FX + i*4 + 4, -FZ], [-FX + i*4 + 4, FZ], [-FX + i*4, FZ]], 0xffffff, { alpha:.07 });
    const L = (a, b) => g.paint(a, b, .2, 0xf4f4ee, .95);
    L([-FX, -FZ], [FX, -FZ]); L([-FX, FZ], [FX, FZ]); L([FX, -FZ], [FX, FZ]); L([-FX, -FZ], [-FX, FZ]); L([0, -FZ], [0, FZ]); g.ring(0, 0, 2.6, .2, 0xf4f4ee, .95);
    [-1, 1].forEach(sx => { const x0 = sx*FX; L([x0 - sx*5.5, -6.5], [x0 - sx*5.5, 6.5]); L([x0, -6.5], [x0 - sx*5.5, -6.5]); L([x0, 6.5], [x0 - sx*5.5, 6.5]); L([x0 - sx*2.2, -3], [x0 - sx*2.2, 3]); L([x0, -3], [x0 - sx*2.2, -3]); L([x0, 3], [x0 - sx*2.2, 3]); });
    for (let i = 0; i < 30; i++) g.blob(rnd(-FX, FX), rnd(-FZ, FZ), rnd(.6, 1.6), rnd(.5, 1.2), 0x4a3418, rnd(.12, .3));
    [-1, 1].forEach(sx => piece("goal" + sx, 1.6, 3.4, 2.8, K => {
      K.face([[0, 0, -2.6], [sx*1.5, 0, -2.6], [sx*1.5, 2.4, -2.6], [0, 2.4, -2.6]], "rgba(255,255,255,.1)", "rgba(255,255,255,.6)"); K.face([[sx*1.5, 0, -2.6], [sx*1.5, 0, 2.6], [sx*1.5, 2.4, 2.6], [sx*1.5, 2.4, -2.6]], "rgba(255,255,255,.1)", "rgba(255,255,255,.6)");
      for (let i = 0; i <= 14; i++) K.line([sx*1.5, 0, -2.6 + i*.37], [sx*1.5, 2.4, -2.6 + i*.37], .6, 0xffffff, .35); for (let j = 0; j <= 8; j++) K.line([sx*1.5, j*.3, -2.6], [sx*1.5, j*.3, 2.6], .6, 0xffffff, .3);
      K.cyl(0, -2.6, .07, 0, 2.4, 0xf4f4f4); K.cyl(0, 2.6, .07, 0, 2.4, 0xf4f4f4); K.box(0, 0, .12, 5.4, 2.4, .12, 0xf4f4f4, { roof:false });
    }, sx*FX, 0));
    piece("cristo", 4.4, 4.4, 13.5, K => {
      const { ctx, p } = K, st = 0xe9e7df;
      K.box(0, 0, 4.4, 4.4, 0, 2.4, 0xb9b3a4, { style:"stone", roof:false }); K.box(0, 0, 3, 3, 2.4, 1.6, 0xcec8b8, { style:"stone", roof:false });
      K.cyl(0, 0, .62, 4, 4.4, st); K.box(0, 0, .85, 8.8, 7.5, .62, st, { style:"stone", roof:false }); K.box(0, 0, 1.2, 2.2, 7.4, .95, st, { style:"stone", roof:false });
      K.ball(0, 8.9, 0, .55, st, 1.05);
    }, -9.5, -17.5, 0, { scale:.72 });
    g.shadowBox(-9.5, -17.5, 3, 3, 6);
    const hill = (x, z, r, hgt, n) => {
      piece("hill" + r + n + rint(3), r + 1, r + 1, hgt + 3, K => {
        const { ctx } = K;
        K.ball(0, 0, 0, r, 0x466f34, hgt/(r*1.12)*.9, { outline:false }); K.flush();
        ctx.save(); ctx.globalAlpha = .9;
        for (let i = 0; i < r*55; i++) { const a = rnd(0, 6.28), d = Math.sqrt(Math.random())*r*.95, hx = Math.cos(a)*d, hz = Math.sin(a)*d*.8, hy = Math.max(0, hgt*(1 - (d/(r*.95))**2)*.9); const q = K.p(hx, hy, hz); ctx.fillStyle = rgba(pick([0x1f5a28, 0x2a6a30, 0x356f2c, 0x4a8a38, 0x16461e]), rnd(.5, .95)); ctx.beginPath(); ctx.ellipse(q[0], q[1], rnd(1.6, 3.6), rnd(1.2, 2.4), 0, 0, 7); ctx.fill(); }
        ctx.restore();
        for (let i = 0; i < n; i++) {
          const th = rnd(0, Math.PI*2), rr = rnd(.15, .75)*r, px = Math.cos(th)*rr, pz = Math.sin(th)*rr*.8;
          if (pz < -r*.15) continue; const py = Math.max(0, hgt*(1 - (rr/(r*.95))**2)*.8), w = rnd(.45, .85);
          K.box(px, pz, w, w*rnd(.8, 1.2), py, rnd(.4, .75), pick([0xe4572e, 0xf3a712, 0xf2e8d0, 0x2e86ab, 0xa8c686, 0xe8a0bf, 0xd9534f, 0x7ecbc2, 0xf2d0a4, 0xc97b4a, 0xe8e8e0]), { style:"concrete", floorH:.4, colW:.4, lit:.1, roof:false });
        }
      }, x, z, 0);
      g.shadowRound(x, z, r*.8, hgt);
    };
    hill(-18, -27, 8, 5, 70); hill(7, -31, 9, 6, 80); hill(-31, -14, 7, 4.5, 60); hill(24, -21, 7, 4.5, 60);
    piece("pao", 5.5, 5.5, 12, K => { const { ctx } = K; K.ball(0, 0, 0, 5, 0x8a867a, 2.1, { outline:false }); K.flush(); for (let i = 0; i < 160; i++) { const q = K.p(rnd(-3, 3), rnd(0, 7), rnd(-2, 2)); ctx.fillStyle = `rgba(${rint(2) ? "255,255,255" : "40,40,35"},${rnd(.05, .14)})`; ctx.fillRect(q[0], q[1], rnd(2, 8), rnd(1, 3)); } K.ball(2.4, 1.2, 1.2, 2.5, 0x3f7a34, .9); K.ball(-1, 3.4, -1, 1.7, 0x978f80, 1); }, 29, -10, 0);
    [[-24, 9], [-30, -3], [-27, 12], [24, 10], [30, -2], [28, 13], [-13, -14], [14, -15], [-33, 5]].forEach(([x, z]) => palm(x, z, rnd(3, 4)));
    [[-22, -9], [-28, 6], [26, 5], [20, 12], [-12, 13]].forEach(([x, z]) => bush(x, z, rnd(.6, .9)));
    E.cloudShadows(.1); E.grade({ sat:1.15, con:1.05, bri:1.02 });
  };

  /* ----- Porto Alegre: Aeroporto Salgado Filho ----- */
  SC.poa = (E, g) => {
    g.poly([[-44, -26], [44, -26], [44, 26], [-44, 26]], "concreto");
    for (let x = -42; x <= 42; x += 6) g.line([x, -26], [x, 26], 1.2, 0x2a2c30, .5);
    for (let z = -24; z <= 24; z += 6) g.line([-44, z], [44, z], 1.2, 0x2a2c30, .5);
    g.paint([-44, -9], [44, -9], .3, 0xf2c200, .9); g.paint([-44, 9], [44, 9], .3, 0xf2c200, .9);
    for (let x = -40; x <= 40; x += 6) { g.paint([x, -9.8], [x, -8.2], .36, 0xf2c200, .9); g.paint([x, 8.2], [x, 9.8], .36, 0xf2c200, .9); }
    g.paint([6, -19], [6, 14], .25, 0xf2f2ea, .8);
    for (let i = 0; i < 24; i++) g.blob(rnd(-30, 30), rnd(-20, 20), rnd(.8, 2.6), rnd(.6, 1.8), 0x15171a, rnd(.12, .3));
    piece("terminal", 12, 4, 6.6, K => {
      K.box(0, 0, 22, 6, 0, 3.6, 0xe9ecf0, { style:"stone", glassBand:[.7, 2.9], rooftop:false });
      K.box(0, 0, 22.8, 6.8, 3.6, .7, 0x2f3a4a, { roofColor:0x2f3a4a, rooftop:false }); K.box(0, 0, 19, 5.2, 4.3, 1.3, 0x5a9fcf, { style:"glass", floorH:1.3, colW:1.6, rooftop:false, tint0:0x2b6f9f, tint1:0x5a9fcf, tint2:0xcfe9ff });
    }, -9, -25, 0); g.shadowBox(-9, -25, 22, 6, 5.6);
    piece("torre", 2, 2, 12, K => { K.cyl(0, 0, .8, 0, 7.4, 0xdadada); K.cyl(0, 0, 1.8, 7.4, 1.7, 0x4a8fbf, { top:0x2f3a4a }); K.cyl(0, 0, 1.95, 9.1, .28, 0x2f3a4a); K.cyl(0, 0, .06, 9.4, 2.2, 0x333333); }, 24, -14, 0); g.shadowRound(24, -14, 1, 9);
    piece("plane", 9, 9, 6, K => {
      const tail = 0x1e6fd1;
      K.box(-4.4, 0, 7.2, 3.2, .8, .26, 0xd5dae0, { roof:false }); K.box(4.4, 0, 7.2, 3.2, .8, .26, 0xd5dae0, { roof:false });
      K.box(0, 0, 1.6, 13, .75, 1.6, 0xf4f5f7, { roof:false });
      K.ball(0, 1.5, 6.6, .85, 0xf4f5f7, 1); K.ball(0, 1.45, -6.6, .8, 0xf0f1f4, .9);
      [-1, 1].forEach(sd => K.plane(sd*.81, 1.5, -5.5, 0, 1, ctx => { for (let i = 0; i < 17; i++) { ctx.fillStyle = "#2a3a4a"; ctx.fillRect(i*.62, 0, .26, .26); } }));
      K.face([[-.2, 1.5, 6.9], [.2, 1.5, 6.9], [.2, 1.8, 6.5], [-.2, 1.8, 6.5]], "#1a2530", "rgba(0,0,0,.5)");
      K.box(0, -6.2, .35, 1.8, 1.5, 3.4, tail, { roof:false }); K.box(0, -6.4, 4.6, 1.4, 1.55, .2, 0xd5dae0, { roof:false });
      K.box(0, 0, 1.62, 13.1, 1.15, .22, tail, { roof:false });
      [-3.4, 3.4].forEach(xx => { K.cyl(xx, .6, .5, .45, 1.35, 0x8a9098); K.cyl(xx, 1.35, .42, .9, .12, 0x1c1e22); });
    }, 7, -18, 0, { scale:.88 }); g.shadowBox(7, -18, 16*.88, 13*.88, 3);
    const cart = (x, z, c) => piece("cart" + c, 3, 1, 1.4, K => { K.box(-1.7, 0, 1.3, .95, .22, .8, c, { roof:false }); [0, 1, 2].forEach(i => K.box(i*1.35 - .1, 0, 1.2, .95, .2, .42, 0x8a9099, { roof:false })); }, x, z, 0, { shadowBox:[4, 1, .8] });
    cart(-15, 12.5, 0xff7a1a); cart(14, 13.2, 0xf2c200);
    piece("fuel", 2.4, 1.4, 2.2, K => { K.cyl(0, 0, .85, .3, 2.6, 0xf2f2f2); K.box(0, 1.8, 1.1, 1.3, .3, 1.3, 0xd32f2f, { roof:false }); }, 22, 14, 0, { shadowBox:[3, 2, 2] });
    [[-12, 3], [13, 4], [-3, 14], [4, 14.5], [27, -2], [-26, 2], [0, -8], [15, -10]].forEach(([x, z]) => piece("tcone", .5, .5, .8, K => { K.cone(0, 0, .22, 0, .62, 0xff7a1a); K.cyl(0, 0, .13, .22, .12, 0xffffff); K.box(0, 0, .5, .5, 0, .04, 0x333333, { roof:false }); }, x, z, 0, { shadowBox:[.3, .3, .6] }));
    for (let x = -22; x <= 22; x += 11) piece("lampA", 1, 1, 8, K => { K.cyl(0, 0, .12, 0, 7, 0x555a60); K.box(.5, 0, 1.6, .4, 7, .26, 0xfff4c2, { roof:false }); }, x, -9.6, 0, { shadowBox:[.3, .3, 7] });
    [-3.52, 3.52].forEach(dx => piece("rsflagpole" + dx, .5, .5, 7, K => K.cyl(0, 0, .06, 0, 5.4, 0xeeeeee), 12 + dx, -12));
    E.flag("rs", 12 - 3.52, 5.4, -12, 36); E.flag("rs", 12 + 3.52, 5.4, -12, 36);
    tree(-27, 9, { pal:"olive" }); tree(30, 8, { pal:"olive" }); tree(-32, -4, { pal:"broad" }); tree(33, -8, { pal:"broad2" });
    E.cloudShadows(.12); E.grade({ sat:.95, con:1.05, bri:1.08 });
  };

  /* ----- Sertão ----- */
  SC.sertao = (E, g) => {
    g.poly([[-44, -34], [44, -34], [44, 34], [-44, 34]], "terra");
    for (let i = 0; i < 40; i++) g.blob(rnd(-34, 34), rnd(-26, 26), rnd(1.2, 3.4), rnd(.9, 2.4), pick([0x8a6234, 0xe0bd82]), rnd(.12, .3));
    [[-26, -26, 9, 5], [-4, -32, 10, 5.5], [20, -28, 9, 5], [32, -12, 8, 4.5], [-34, -8, 8, 4]].forEach(([x, z, r, h]) => {
      piece("serra" + r + rint(3), r + 1, r + 1, h + 1, K => { const { ctx } = K; K.ball(0, 0, 0, r, 0xa8693a, h/(r*1.12)*.9, { outline:false }); K.flush();
        for (let i = 0; i < r*38; i++) { const q = K.p(rnd(-r*.85, r*.85), rnd(0, h*.8), rnd(-r*.5, r*.5)); ctx.fillStyle = `rgba(${pick(["120,70,36", "210,150,90", "90,55,30", "150,100,60"])},${rnd(.08, .3)})`; ctx.fillRect(q[0], q[1], rnd(3, 16), rnd(1, 3)); } }, x, z, 0);
      g.shadowRound(x, z, r*.8, h);
    });
    E.glow(.78, .12, 0xfff0b0, 1.5, .55);
    [[-12, -9, 4.4], [-17, -15, 5.2], [-26, -8, 4], [-3, -15, 5], [14, -10, 5], [22, -17, 5.5], [28, -6, 4.2], [-24, 9, 3.8], [25, 11, 4.2], [-16, 12, 3.4], [10, 14, 3.6], [-30, 2, 4.6], [33, 4, 4.8]].forEach(a => cactus(...a));
    [[-8, 12], [-20, 14], [15, 13], [26, 14], [-30, -2], [32, -2]].forEach(([x, z]) => bush(x, z, .5, "olive"));
    [[-23, -12], [24, -13], [4, -20]].forEach(([x, z]) => deadTree(x, z, rnd(3, 4)));
    for (let i = 0; i < 14; i++) { const x = rnd(-26, 26), z = rnd(-16, 16); if (Math.abs(z) < 7 && Math.abs(x) < 16) continue; piece("rock" + i, 1, 1, 1, K => { K.ball(0, .1, 0, rnd(.3, .6), pick([0x8a7a66, 0x9a8a74, 0x7a6a58]), .75); }, x, z, 0); g.shadowRound(x, z, .4, .5); }
    piece("skull", 1, 1, 1, K => { K.box(0, 0, .7, .5, .1, .4, 0xefe6d4, { roof:false }); K.line([-.3, .4, 0], [-.85, .78, 0], 3, 0xefe6d4); K.line([.3, .4, 0], [.85, .78, 0], 3, 0xefe6d4); }, -14, 6, 0, { shadowBox:[1, .5, .4] });
    piece("taipa", 3.6, 3.2, 4.6, K => { K.box(0, 0, 4.6, 3.6, 0, 2.2, 0xd2b88a, { style:"adobe", roof:false }); K.box(.7, 1.82, 1, .05, 0, 1.6, 0x5d4023, { style:"wood", roof:false }); K.pyr(0, 0, 5.8, 4.8, 2.2, 1.9, 0x9a5a3a, "tile"); }, 20, -22, 0); g.shadowBox(20, -22, 4.6, 3.6, 3.5);
    E.mist(0xffe0a0, .08); E.cloudShadows(.12); E.grade({ sat:1.12, con:1.08, bri:1.03 });
  };

  /* ----- Amazônia ----- */
  SC.amazonia = (E, g) => {
    g.poly([[-44, -34], [44, -34], [44, 34], [-44, 34]], "mata");
    g.poly([[-50, -23], [50, -23], [50, -12.4], [-50, -12.4]], 0x3a5a48);
    g.poly([[-50, -23], [50, -23], [50, -12.4], [-50, -12.4]], 0x6fa08a, { alpha:.35 });
    g.poly([[-50, -12.7], [50, -12.7], [50, -11.4], [-50, -11.4]], 0x9db6a0, { alpha:.7 });
    for (let i = 0; i < 70; i++) { const x = rnd(-34, 34), z = rnd(-22.6, -13); g.line([x, z], [x + rnd(1, 2.6), z], 1.4, 0xb8d8c8, rnd(.12, .3)); }
    E.sparkle([[-34, -22.6], [34, -22.6], [34, -13], [-34, -13]], 40);
    for (let i = 0; i < 50; i++) g.blob(rnd(-34, 34), rnd(-10, 26), rnd(.8, 2.4), rnd(.6, 1.6), pick([0x1c2a12, 0x5a4a22]), rnd(.15, .35));
    const big = (x, z, h, w) => tree(x, z, { r:w*1.2, h, pal:"dark", blobs:9, variants:3 });
    [[-14, -9, 3.2, 1.2], [-20, -15, 3.6, 1.4], [-28, -8, 3.4, 1.2], [-33, -16, 4, 1.5], [14, -9, 3.4, 1.2], [21, -15, 3.8, 1.4], [29, -9, 3.4, 1.2], [-24, 8, 2.8, 1.0], [26, 9, 3, 1.0], [-32, 12, 3.2, 1.1], [33, 12, 3.2, 1.1], [-6, -25, 4.5, 1.8], [8, -27, 5, 1.9], [-36, -26, 4.5, 1.7], [30, -26, 4.5, 1.7], [-16, 14, 2.6, .95], [16, 15, 2.8, .95]].forEach(a => big(...a));
    for (let i = 0; i < 26; i++) { const x = rnd(-30, 30), z = rnd(-10, 22); if (Math.abs(z) < 7 && Math.abs(x) < 17) continue; bush(x, z, rnd(.5, .9), pick(["dark", "broad2", "olive"])); }
    piece("sumauma", 6, 6, 13, K => {
      for (let k = 0; k < 6; k++) { const a = k*1.05 + .2; K.box(Math.cos(a)*1.7, Math.sin(a)*1.7, .5, 2.8, 0, 3.4, 0x6a4a2a, { style:"wood", roof:false }); }
      K.cyl(0, 0, 1.25, 0, 9.4, 0x6a4a2a);
      [[0, 10.6, 0, 4.8], [-3, 9.6, 1, 3.4], [3, 9.9, -1, 3.6], [0, 11.6, 2, 3.1]].forEach(([x, y, z, r]) => K.ball(x, y, z, r, 0x2a6a2e, .7));
    }, 0, -22, 0); g.shadowRound(0, -22, 2, 10);
    [[-22, -12.4], [22, -12.8]].forEach(([x, z]) => { piece("maloca" + x, 3.8, 3, 5, K => { K.box(0, 0, 4.6, 3.8, 0, 2, 0xb48a52, { style:"wood", roof:false }); K.pyr(0, 0, 5.8, 5, 2, 2.6, 0x9a7a3a, "tile"); }, x, z, 0); g.shadowBox(x, z, 4.6, 3.8, 3); });
    [[-6, -17.5], [10, -19.5]].forEach(([x, z]) => piece("canoe" + x, 2.6, 1, 1, K => { K.box(0, 0, 4.4, .9, 0, .4, 0x7a5230, { style:"wood", top:0x8a6240, roof:false }); }, x, z, -.05));
    const cores = [0xff3b30, 0x2f6fe0, 0xffd400, 0x2f9a3f];
    for (let i = 0; i < 6; i++) {
      const c0 = cores[i%4], c1 = cores[(i + 1)%4], kk = make("macaw" + i, 1, 1, .6, K => { K.box(0, 0, .5, .3, .1, .26, c0, { roof:false }); K.box(.3, 0, .2, .2, .22, .2, c1, { roof:false }); K.box(0, .3, .5, .3, .16, .04, cores[(i + 2)%4], { roof:false }); K.box(0, -.3, .5, .3, .16, .04, cores[(i + 2)%4], { roof:false }); });
      const im = put(kk, 0, 0, 0, { bias:3000 }), sp = rnd(.8, 1.5), x0 = rnd(-30, 30), z0 = rnd(-24, -8), y0 = rnd(5, 8), ph = rnd(0, 6);
      E.tick(t => { const u = ((t*sp*2 + x0 + 40)%80) - 40, q = GFX.P(u, y0 + Math.sin(t*3 + ph)*.5, z0 + Math.sin(t*.4 + ph)*3); im.setPosition(q[0], q[1]).setDepth(GFX.D_SORT + 2000); im.scaleY = (1 + Math.sin(t*14 + ph)*.18)/QS; });
    }
    E.rays(); E.mist(0xb8e0c0, .1); E.cloudShadows(.14); E.grade({ sat:1.1, con:1.03, bri:1.06 });
  };

  /* ----- Balneário Camboriú ----- */
  SC.camboriu = (E, g) => {
    g.poly([[-44, -34], [44, -34], [44, 34], [-44, 34]], "areia");
    for (let i = 0; i < 90; i++) g.blob(rnd(-34, 34), rnd(-8, 26), rnd(.3, 1), rnd(.2, .6), 0x9a8450, rnd(.1, .25));
    g.poly([[-50, -20.4], [50, -20.4], [50, -13.8], [-50, -13.8]], "calcada", { tint:0xf0e6d0, tintA:.45 });
    for (let x = -46; x < 46; x += 3) { const w = Math.sin(x*.7)*.35; g.paint([x, -16.4 + w], [x + 1.6, -16.4 + w], .5, 0x2e2e33, .85); g.paint([x, -18 - w], [x + 1.6, -18 - w], .5, 0x2e2e33, .85); g.paint([x + 1.6, -17.2], [x + 3.2, -17.2], .5, 0x2e2e33, .5); }
    g.poly([[-50, -13.8], [50, -13.8], [50, -12.6], [-50, -12.6]], 0xb8a070, { alpha:.8 });
    const sea = [[15, -34], [60, -34], [60, 8], [21, 8]];
    g.poly(sea, 0x2a9ec6); g.poly([[15, -34], [60, -34], [60, -10], [30, -10]], 0x1a78a8, { alpha:.45 });
    g.line([21, 8], [60, 8], 7, 0xffffff, .65); g.line([21, 8], [15, -34], 7, 0xffffff, .5); g.line([22.4, 6.6], [60, 6.6], 3, 0xffffff, .4); g.line([20.2, 5], [14.5, -30], 3, 0xffffff, .35);
    for (let i = 0; i < 60; i++) { const x = rnd(22, 55), z = rnd(-30, 4); g.line([x, z], [x + rnd(1.5, 3.6), z], rnd(1.2, 2.4), 0xe4f8ff, rnd(.18, .45)); }
    E.sparkle(sea, 70);
    for (let i = 0; i < 7; i++) building(-18 - i*3.9 - rnd(0, .8), -24 - rnd(0, 4), rnd(3, 4.2), rnd(3.2, 4.4), rnd(9, 17), { style:"white", color:pick([0xf4f0e6, 0xeae6da, 0xf0eadb]) });
    for (let i = 0; i < 6; i++) building(-30 - i*3.3, -4 + i*3.3, rnd(3, 4), rnd(3, 4), rnd(8, 15), { style:i%2 ? "glass" : "white", color:0xf0eadb, tint1:0x6fa0c0, tint2:0xc6e2f2, lit:.05 });
    const cores = [0xe53935, 0xffc933, 0x2fb4d6, 0xff7aa8, 0x7ed957, 0xf4f4f4];
    [[-14, 10], [-20, 6.5], [-27, 11], [-9, 13], [14, 11], [21, 7], [-4, 14.5], [4, 15], [-32, 3], [28, 12]].forEach(([x, z], i) => piece("sombra" + i, 2.2, 2.2, 3.4, K => {
      const { ctx, p } = K, c = cores[i%cores.length]; K.cyl(0, 0, .04, 0, 2.2, 0xeeeeee);
      for (let s = 0; s < 8; s++) { const a0 = s/8*6.28, a1 = (s + 1)/8*6.28, top = p(0, 2.5, 0), q0 = p(Math.cos(a0)*1.4, 2.0, Math.sin(a0)*1.4), q1 = p(Math.cos(a1)*1.4, 2.0, Math.sin(a1)*1.4); ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.closePath(); ctx.fillStyle = css(s%2 ? c : 0xffffff); ctx.fill(); ctx.strokeStyle = "rgba(0,0,0,.22)"; ctx.lineWidth = .6; ctx.stroke(); }
      K.box(1.3, .55, 1.15, .5, .12, .1, 0xf4f4f4, { roof:false }); K.box(1.85, .55, .4, .5, .12, .35, 0xf4f4f4, { roof:false });
    }, x, z, 0, { shadowBox:[1.6, 1.6, 1.5] }));
    [[-17, -6], [-26, -8], [20, -6], [27, -9]].forEach(([x, z]) => palm(x, z, rnd(3, 4)));
    piece("salvavidas", 1.6, 1.6, 3.4, K => { K.box(0, 0, 2, 2, 0, 2.4, 0xf8f8f4, { roof:false }); K.box(0, 0, 2.5, 2.5, 2.4, .3, 0xd32f2f, { roof:false }); }, -34, -9, 0, { shadowBox:[2, 2, 3] });
    piece("volei", 3.4, 1, 2.6, K => { K.cyl(-3, 0, .06, 0, 2.3, 0xeeeeee); K.cyl(3, 0, .06, 0, 2.3, 0xeeeeee); for (let i = 0; i <= 18; i++) K.line([-3 + i/3, 1.0, 0], [-3 + i/3, 2.2, 0], .6, 0xffffff, .55); for (let j = 0; j <= 4; j++) K.line([-3, 1 + j*.3, 0], [3, 1 + j*.3, 0], .6, 0xffffff, .55); }, 17, 14, 0);
    [[30, -14, 0], [38, -22, 1], [42, -4, 0]].forEach(([x, z, k]) => piece("veleiro" + k + x, 2.4, 1.2, 4.6, K => {
      K.box(0, 0, 3.2, .95, 0, .42, 0xf4f4f4, { roof:false }); K.box(0, 0, 3.3, 1, .38, .05, 0x7a5230, { roof:false }); K.cyl(0, 0, .04, .4, 3.8, 0x555555);
      K.face([[0, .6, 0], [0, 3.9, 0], [1.5, .8, 0]], css(k ? 0xf2c200 : 0xfdfdfd)); K.face([[0, .6, 0], [0, 3.4, 0], [-1.2, .8, 0]], css(0xefefef));
    }, x, z, -.03));
    E.glow(.2, .1, 0xfffbe0, 1.2, .5); E.cloudShadows(.1); E.grade({ sat:1.12, con:1.05, bri:1.05 });
  };

  /* ----- Brasília: Praça dos Três Poderes ----- */
  SC.brasilia = (E, g) => {
    g.poly([[-50, -40], [60, -40], [60, 40], [-50, 40]], "terra", { alpha:.35, tint:0xb4a95e, tintA:.65 });
    g.poly([[-26, -20], [30, -20], [30, 14], [-26, 14]], "granito");
    for (let i = -3; i <= 3; i++) g.line([i*8, -20], [i*8, 14], 2, 0x655f4c, .6);
    for (let z = -18; z <= 12; z += 6) g.line([-26, z], [30, z], 1.5, 0x655f4c, .45);
    g.poly([[-14, -9.6], [14, -9.6], [14, -6.8], [-14, -6.8]], 0x3a7fb0); g.poly([[-14, -9.6], [14, -9.6], [14, -6.8], [-14, -6.8]], 0xbfe3ff, { alpha:.25 });
    g.poly([[-14.5, -10], [14.5, -10], [14.5, -9.6], [-14.5, -9.6]], 0xd2ccb4); g.poly([[-14.5, -6.8], [14.5, -6.8], [14.5, -6.4], [-14.5, -6.4]], 0xd2ccb4);
    for (let i = 0; i < 36; i++) { const x = rnd(-13, 13), z = rnd(-9.3, -7); g.line([x, z], [x + rnd(.6, 1.8), z], 1.2, 0xe4f4ff, rnd(.2, .5)); }
    const lake = [[26, -40], [60, -40], [60, -2], [34, -2]];
    g.poly(lake, 0x3f8fbf); g.line([34, -2], [60, -2], 5, 0xd8e8f0, .6); g.line([34, -2], [26, -40], 5, 0xd8e8f0, .5); E.sparkle(lake, 50);
    piece("congresso", 10.5, 4.2, 14, K => {
      const wh = 0xe6e3da, gl = { style:"glass", roof:false, tint0:0x203a52, tint1:0x4f7ea8, tint2:0xc4def0 };
      K.box(0, 0, 19, 5.6, 0, 1.2, 0xd2cebf, { style:"stone", roof:false }); K.box(0, 0, 15.5, 4.6, 1.2, .3, 0xe4e0d4, { style:"stone", roof:false });
      K.box(0, 0, 15, 4.4, 1.5, .8, 0x4f7ea8, { ...gl, floorH:.8, colW:.9 });
      K.ball(-6.6, 2.3, .6, 2.7, wh, .72); K.cyl(6.6, .6, 2.6, 2.3, .3, 0xdcd8cc); K.cyl(6.6, .6, 2.2, 2.6, .06, 0x6a6a62);
      K.box(-1.15, 0, 1.45, 3.1, 1.5, 9.6, wh, { ...gl, floorH:.55, colW:.4, lit:.06 }); K.box(1.15, 0, 1.45, 3.1, 1.5, 9.6, wh, { ...gl, floorH:.55, colW:.4, lit:.06 });
      K.box(0, 0, 3.4, 1.3, 11.1, .4, 0xd8d4c8, { style:"stone", roof:false });
    }, -3, -22, 0, { scale:.8 }); g.shadowBox(-3, -22, 15, 4.4, 9);
    piece("planalto", 7.5, 4.4, 6.5, K => {
      K.box(0, -.4, 14.4, 3.6, 0, 3, 0x4f93c4, { style:"glass", floorH:3, colW:1.2, roof:false, tint0:0x1f4660, tint1:0x4f93c4, tint2:0xc9e4f4 });
      K.box(0, 0, 15.4, 5.8, 3, .6, 0xe0dccf, { style:"stone", roof:false });
      for (let i = 0; i < 10; i++) { const x = -6.8 + i*1.5; K.cyl(x, 2.5, .44, 0, 3, 0xece8dc); K.ball(x, 3.0, 2.5, .46, 0xece8dc, .5, { outline:false }); }
    }, 19, -14, 0, { scale:.8 }); g.shadowBox(19, -14, 14, 5, 4);
    piece("pole", .5, .5, 8, K => K.cyl(0, 0, .05, 0, 6, 0xeeeeee), 19, -14); E.flag("brasil", 19, 6, -14, 34);
    piece("stf", 6.4, 4.2, 5.4, K => { K.box(0, -.4, 12.4, 3.8, 0, 3, 0xe2decf, { style:"stone", roof:false }); K.box(0, 0, 13.6, 5.6, 3, .55, 0xece8dc, { style:"stone", roof:false }); for (let i = 0; i < 8; i++) K.cyl(-5.4 + i*1.55, 2.7, .52, 0, 3, 0xe6e2d4); }, 22, -1, 0, { scale:.78 }); g.shadowBox(22, -1, 12, 5, 3.6);
    piece("justica", 1.6, 1.6, 4, K => { K.box(0, 0, 1.6, 1.6, 0, .8, 0x8a8478, { style:"stone", roof:false }); K.cyl(0, 0, .3, .8, 1.5, 0x9a9484); K.ball(0, 2.55, 0, .28, 0x9a9484, 1); K.box(.1, .5, .5, .3, 2.5, .12, 0x222222, { roof:false }); }, 16.5, 4, 0, { scale:.8, shadowBox:[1, 1, 2] });
    for (let i = 0; i < 5; i++) building(-14 - i*5.2, -22 - i*2.2, 5.4, 4.2, 3.4, { style:"glass", color:0xf4f1e8, floorH:.9, colW:.9, tint0:0x203a52, tint1:0x5a8cb4, tint2:0xc9e0f0, lit:.04, scale:.8, rooftop:false });
    piece("tvtower", 1.6, 1.6, 17, K => { K.cyl(0, 0, .26, 0, 12.4, 0xdddddd); K.cyl(0, 0, 1.2, 7.4, .5, 0xcfcfcf); K.cyl(0, 0, .9, 8.4, .45, 0xe8e8e8); K.cyl(0, 0, .05, 12.4, 3.6, 0xbbbbbb); }, 8, -26, 0, { scale:.7 }); g.shadowRound(8, -26, .4, 10);
    piece("catedral", 3.4, 3.4, 7, K => { K.cyl(0, 0, 3, 0, .22, 0xdcd7c8);
      for (let k = 0; k < 16; k++) { const a = k/16*Math.PI*2, P2 = (R, y) => [Math.cos(a)*R, y, Math.sin(a)*R]; K.line(P2(3, 0), P2(1.8, 3.4), 3.4, 0xe6e2d4); K.line(P2(1.8, 3.4), P2(2.6, 6.4), 3.4, 0xe6e2d4); }
      K.ball(0, 2.4, 0, 1.5, 0x7fc0e8, .55, { outline:false }); }, 0, 15, 0, { scale:.6 }); g.shadowRound(0, 15, 1.4, 4);
    [[-18, 8], [-4, 15], [14, 14], [24, 10], [-22, -2], [10, -9]].forEach(([x, z]) => tree(x, z, { r:1.0, h:2.2, pal:"ipe", flowers:[0xffd21a, 0xffc400, 0xfff070], scale:.9 }));
    piece("ponte", 9.5, 1.6, 7, K => { K.box(0, 0, 19, 1.3, 1.2, .3, 0x8a8a8e, { roof:false });
      [-5.8, 0, 5.8].forEach((x, i) => { for (let k = 0; k < 16; k++) { const a0 = k/16*Math.PI, a1 = (k + 1)/16*Math.PI, s = i%2 ? -1 : 1; K.line([x + Math.cos(a0)*2.7, 1.4 + Math.sin(a0)*3.8, s*Math.cos(a0)*.5], [x + Math.cos(a1)*2.7, 1.4 + Math.sin(a1)*3.8, s*Math.cos(a1)*.5], 2.8, 0xdcdee2); } }); }, 33, -14, 0, { scale:.8 });
    E.glow(.12, .16, 0xff9a50, 1.6, .6); E.cloudShadows(.1); E.grade({ sat:1.1, con:1.06, bri:1.0, tint:[1.05, .97, .88] });
  };

  /* ----- NG+: Apocalipse ----- */
  SC.apocalipse = (E, g) => {
    g.poly([[-50, -40], [60, -40], [60, 40], [-50, 40]], "queimado");
    for (let i = 0; i < 46; i++) { const x = rnd(-30, 30), z = rnd(-24, 24); g.blob(x, z, rnd(1, 2.2), rnd(.8, 1.6), 0x050403, .9); g.blob(x, z, rnd(1.6, 2.6), rnd(1.2, 2), 0x4a3e34, .35); }
    for (let i = 0; i < 40; i++) g.blob(rnd(-34, 34), rnd(-26, 26), rnd(.6, 2), rnd(.4, 1.4), 0xc4500e, rnd(.05, .14));
    for (let i = 0; i < 26; i++) { const x = rnd(-26, 26), z = rnd(-20, 20); if (Math.abs(z) < 7 && Math.abs(x) < 16) continue; piece("rub" + i, 1.4, 1.4, 1.2, K => { for (let k = 0; k < 4; k++) K.box(rnd(-.5, .5), rnd(-.5, .5), rnd(.5, 1.2), rnd(.5, 1.2), 0, rnd(.3, .9), pick([0x3a312a, 0x4a4036, 0x2e2822]), { style:"concrete", floorH:.3, lit:0, colW:.6, roof:false }); }, x, z, 0, { shadowBox:[1.4, 1.4, .6] }); }
    E.mushroom(0, -20);
    const ruin = (x, z) => building(x, z, rnd(3, 4.4), rnd(3, 4.2), rnd(4, 9), { style:"ruin", color:pick([0x3d3530, 0x4a4038, 0x332d29]) });
    for (let i = 0; i < 6; i++) ruin(-12 + i*4.6, -22 - rnd(0, 4));
    for (let i = 0; i < 6; i++) ruin(18 + rnd(0, 3), -14 + i*3.6);
    for (let i = 0; i < 4; i++) ruin(-26 - rnd(0, 3), -16 + i*4.4);
    [[-14, -9], [14, -9], [-26, 7], [27, 8], [-8, 13], [10, 14], [-30, -12], [32, -14]].forEach(([x, z]) => { g.blob(x, z, 2, 1.6, 0x000000, .6); E.fire(x, z); });
    const tank = (x, z, flip, sc = 1) => piece("tank" + flip, 3.4, 2.2, 3.2, K => {
      const { ctx } = K;
      K.box(0, 1.25, 5, .75, .1, .8, 0x1c1f17, { roof:false }); K.box(0, -1.25, 5, .75, .1, .8, 0x1c1f17, { roof:false });
      [-1, 1].forEach(sd => K.plane(-2.4, .1, sd*1.62 + sd*.004, 1, 0, ctx => { for (let i = 0; i < 9; i++) { ctx.fillStyle = "#3a3f30"; ctx.beginPath(); ctx.arc(.2 + i*.55, .4, .2, 0, 7); ctx.fill(); ctx.strokeStyle = "#111"; ctx.lineWidth = .02; ctx.stroke(); } }));
      K.box(0, 0, 4.6, 2.3, .4, .5, 0x4a5636, { roofColor:0x4a5636, rooftop:false }); K.box(0, 0, 3.1, 1.9, .9, .72, 0x55633f, { rooftop:false });
      K.cyl(.2, 0, .85, 1.6, .5, 0x4f5c3a); K.box(2.2, 0, 3.6, .22, 2.0, .22, 0x22281a, { roof:false }); K.box(-.8, .4, .5, .4, 2.1, .4, 0x66744a, { roof:false });
    }, x, z, 0, { scale:sc*.85, flip });
    [[-16, 3.4, 0], [18, 3.4, 1], [-12, -14, 0], [16, -15, 1], [-4, 12, 0, 1.1]].forEach(a => { tank(...a); g.shadowBox(a[0], a[1], 5, 2.4, 2.6); });
    const jetK = make("jet", 3, 2, 3, K => { K.box(0, 0, 5.4, .8, 1, .6, 0x8a8f94, { roof:false }); K.cone(3.2, 0, .45, 1.3, .1, 0x6a6f74); K.box(-.4, 0, 2.2, 5.6, 1.2, .14, 0x6f747a, { roof:false }); K.box(-2.6, 0, 1, 2, 1.3, .12, 0x6f747a, { roof:false }); K.box(-2.6, 0, 1, .12, 1.3, 1.2, 0x6f747a, { roof:false }); });
    [[-3, 24, 0], [-5, 26, 90], [-2, 19, 170], [-7, 30, 40]].forEach(([z, spd, off], i) => {
      const im = put(jetK, 0, 0, 0, { bias:3500 }), y0 = 9 + i*2;
      E.tick(t => { const u = ((t*spd*.5 + off) % 120) - 60, q = GFX.P(u, y0 + Math.sin(t*.8 + off)*.8, z - 8 - i*3); im.setPosition(q[0], q[1]).setDepth(GFX.D_SORT + 3000); });
    });
    let em = 0; E.tick((t, dt) => { em -= dt; if (em <= 0) { em = .1; GFX.burst({ x:rnd(-30, 30), y:0, z:rnd(-22, 22) }, [0xff7a1a, 0xffd23a, 0x777777], 1, 1.2); } });
    E.mist(0xff5a20, .12); E.cloudShadows(.16); E.grade({ sat:1.1, con:1.1, bri:1.0, tint:[1.12, .92, .85] });
  };

  /* ================================================================
     AMBIENTE
     ================================================================ */
  function clear() {
    if (!env) return;
    env.objs.forEach(o => o.destroy());
    env.keys.forEach(k => { if (GFX.scene.textures.exists(k)) GFX.scene.textures.remove(k); });
    env = null;
  }
  function inPoly(poly, x, z) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, zi] = poly[i], [xj, zj] = poly[j]; if (((zi > z) !== (zj > z)) && (x < (xj - xi)*(z - zi)/(zj - zi) + xi)) c = !c; } return c; }
  const GROUND_BASE = { paulista:0x2b2e33, rio:0x7f7a66, poa:0x6a6e74, sertao:0xc39a5c, amazonia:0x3b3a22, camboriu:0xdcc590, brasilia:0xa39c88, apocalipse:0x2a231e };
  function build(scn) {
    clear();
    env = { objs:[], keys:[], ticks:[], cache:{}, ground:null };
    const bg = GROUND_BASE[scn.id] ?? 0x333333, g = newGround(bg); env.ground = g;
    GFX.cam.setBackgroundColor(bg);
    const E = {
      tick(f) { env.ticks.push(f); },
      glow(fx, fy, color, size, alpha) {
        GFX.tex("glow", () => Art.glow());
        const im = GFX.img("glow").setBlendMode(1).setTint(color).setAlpha(alpha).setDepth(GFX.D_HINT - 10); env.objs.push(im);
        const pin = GFX.pinToScreen(im, fx, fy, 1);
        env.ticks.push(() => { pin(); const z = GFX.view.zoom*GFX.view.dpr; im.setScale(size*4*GFX.view.dpr/z/Art.Q*Math.max(1, GFX.view.H/720)); });
      },
      mist(color, a) {
        const r = GFX.scene.add.rectangle(0, 0, 40000, 40000, color, a).setDepth(GFX.D_HINT - 20); env.objs.push(r);
        const pin = GFX.pinToScreen(r, .5, .5, 1); env.ticks.push(() => { pin(); r.setScale(1); });
      },
      cloudShadows(alpha = .08) {
        GFX.tex("blob", () => Art.blob());
        for (let i = 0; i < 5; i++) {
          const im = GFX.img("blob").setTint(0x000000).setAlpha(alpha).setDepth(GFX.D_FLAT + 50);
          const rx = rnd(5, 9), z0 = rnd(-24, 24), x0 = rnd(-45, 45), sp = rnd(.5, 1.1);
          im.setScale(2*SQ2*rx*HW/(64*.9), 2*SQ2*rx*.7*HH/(64*.9)); env.objs.push(im);
          env.ticks.push(t => { const x = ((t*sp + x0 + 45) % 90) - 45, q = GFX.P(x, 0, z0); im.setPosition(q[0], q[1]); });
        }
      },
      flag(key, x, y, z, w) {                                  // bandeira ondulando num mastro do cenário
        const k = GFX.flagKey(key), d = GFX.texInfo[k], q = GFX.P(x, y, z), n = 7;
        const rope = GFX.scene.add.rope(q[0] + w/2, q[1] + w*.3, k, undefined, n, true).setScale(w/(d.w*(d.q || Art.Q))).setDepth(GFX.D_SORT + GFX.depthOf(x, z) + 50);
        env.objs.push(rope); const ph = rnd(0, 6);
        env.ticks.push(t => { const A = 5/rope.scaleX*(.6 + .5*Math.sin(t*.4 + ph)); for (let i = 0; i < n; i++) { const qq = i/(n - 1); rope.points[i].y = Math.sin(t*6 - qq*5 + ph)*A*qq; } rope.dirty = true; });
      },
      sparkle(poly, n) {                                       // brilho do sol na água
        GFX.tex("glow", () => Art.glow());
        const xs = poly.map(a => a[0]), zs = poly.map(a => a[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
        for (let i = 0; i < n; i++) {
          let px, pz, ok = false;
          for (let t = 0; t < 12 && !ok; t++) { px = rnd(x0, x1); pz = rnd(z0, z1); ok = inPoly(poly, px, pz); }
          if (!ok) continue;
          const q = GFX.P(px, 0, pz), im = GFX.img("glow").setBlendMode(1).setTint(0xfff6d8).setPosition(q[0], q[1]).setDepth(GFX.D_FLAT + 20).setScale(rnd(.05, .12)); env.objs.push(im);
          const ph = rnd(0, 6), sp = rnd(.8, 2.4); env.ticks.push(t => im.setAlpha(Math.max(0, Math.sin(t*sp + ph))**3*.8));
        }
      },
      rays() {                                                 // feixes de luz entre as árvores
        for (let i = 0; i < 4; i++) {
          const x0 = rnd(.05, .95), im = GFX.scene.add.graphics().setDepth(GFX.D_HINT - 15).setBlendMode(1).setScrollFactor(0); env.objs.push(im);
          const ph = rnd(0, 6), wd = rnd(.03, .07);
          env.ticks.push(t => { const v = GFX.view, d = v.dpr, W = v.W*d, H = v.H*d, z = v.zoom*d, w2 = GFX.cam.width/2, h2 = GFX.cam.height/2, T = (px, py) => [w2 + (px - w2)/z, h2 + (py - h2)/z];
            im.clear(); im.fillStyle(0xfff2b8, .03 + .02*Math.sin(t*.4 + ph));
            const p0 = T(W*x0, 0), p1 = T(W*(x0 + wd), 0), p2 = T(W*(x0 + wd - .28), H), p3 = T(W*(x0 - .28), H); im.beginPath(); im.moveTo(...p0); im.lineTo(...p1); im.lineTo(...p2); im.lineTo(...p3); im.closePath(); im.fillPath(); });
        }
      },
      grade(c) { GFX.grade(c); },
      fire(x, z) {                                             // fogueira com chama animada e fumaça
        const fl = GFX.makeFlame(); fl.at(x, 0, z); fl.k = 1.6; env.objs.push({ destroy: () => fl.destroy() });
        env.ticks.push(t => GFX.flicker(fl, t));
        let sm = rnd(0, .5); env.ticks.push((t, dt) => { sm -= dt; if (sm <= 0) { sm = .18; GFX.smoke({ x, y:.8, z }); } });
      },
      mushroom(x, z) {                                         // cogumelo nuclear em camadas de fumaça
        const k = make("nuke", 9, 9, 22, K => {
          const { ctx } = K; K.cyl(0, 0, 3.2, 0, 14, 0x6a4a38); K.flush();
          for (let i = 0; i < 900; i++) { const y = rnd(0, 15), r = 3.2 - y*.05 + rnd(-.4, .6), a = rnd(0, 6.28), q = K.p(Math.cos(a)*r*.8, y, Math.sin(a)*r*.8); ctx.fillStyle = rgba(pick([0x8a5a40, 0x5a3a2a, 0xa06a48, 0x3a2418]), rnd(.2, .6)); ctx.beginPath(); ctx.arc(q[0], q[1], rnd(2, 6), 0, 7); ctx.fill(); }
          [[0, 15, 7, .55], [-5, 17, 5, .6], [5, 17, 5, .6], [0, 19.6, 5.4, .62], [-2.4, 13, 5, .5], [2.4, 13, 5, .5]].forEach(([bx, by, r, sy]) => { K.ball(bx, by, 0, r*.46, 0x7a4a34, sy*2.2, { outline:false }); K.flush();
            for (let i = 0; i < 260; i++) { const a = rnd(0, 6.28), d = Math.sqrt(Math.random())*r*.46*HW*1.1, q = K.p(bx, by, 0); ctx.fillStyle = rgba(pick([0xa6693f, 0x5a3626, 0xc4824a, 0x3a2418, 0xff8a2a]), rnd(.15, .5)); ctx.beginPath(); ctx.ellipse(q[0] + Math.cos(a)*d, q[1] + Math.sin(a)*d*sy*2.2*.6, rnd(2, 6), rnd(1.5, 4), 0, 0, 7); ctx.fill(); } });
          K.ball(0, 15.5, 0, 6, 0xff8a1a, .5, { outline:false });
        });
        const im = put(k, x, z, 0, { bias:-500 });
        GFX.tex("glow", () => Art.glow());
        const g2 = GFX.img("glow").setBlendMode(1).setTint(0xff8a1a).setDepth(GFX.D_SORT + GFX.depthOf(x, z) - 400), q = GFX.P(x, 15, z); g2.setPosition(q[0], q[1]).setScale(2.4/Art.Q*4); env.objs.push(g2);
        env.ticks.push(t => { im.setScale((1 + Math.sin(t*.8)*.02)/QS, (1 + Math.sin(t*1.1)*.025)/QS); g2.setAlpha(.3 + Math.sin(t*2.2)*.1); });
      },
    };
    (SC[scn.id] || SC.paulista)(E, g);
    g.done(); bakeGround(g);
    return env;
  }
  function tick(t, dt) { if (env) env.ticks.forEach(f => f(t, dt)); }

  return { build, clear, tick };
})();

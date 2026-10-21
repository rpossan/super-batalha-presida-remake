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
  /* ================================================================
     CENÁRIOS REGISTRÁVEIS
     Cada cenário é uma função (E, g, K) registrada com Scenery.register(id, fn, corDoChão):
       E = efeitos (luz, névoa, bandeiras, fogo, cogumelo…)   g = chão (poly, rect, paint, ring, blob, shadowBox, ao…)
       K = kit de peças: building, tree, palm, deadTree, cactus, bush, car, lamp, piece, make, put, rnd, rint, pick, css, rgba, P, QS
     Os cenários do Brasil ficam em js/campaigns/br2026.js; veja CAMPANHAS.md para criar novos.
     ================================================================ */
  const SC = {}, GROUND = {};
  const KIT = { css, rgba, rnd, rint, pick, P, QS, SQ2, HW, HH, shade, mix, rgb, lin, rad, make, put, piece, tree, palm, deadTree, cactus, bush, car, lamp, building };
  function register(id, fn, ground) { SC[id] = fn; if (ground != null) GROUND[id] = ground; }
  /* cenário padrão (usado se um cenário não tiver desenho próprio): praça simples com árvores e postes */
  SC.__default = (E, g, K) => {
    g.poly([[-60, -16], [60, -16], [60, 16], [-60, 16]], "calcada");
    for (let i = 0; i < 14; i++) K.tree(-30 + i*4.6, i % 2 ? 13 : -13, { r:K.rnd(.8, 1.1), h:K.rnd(1.4, 2), pal:"broad" });
    for (let x = -24; x <= 24; x += 8) K.lamp(x, -11);
    E.cloudShadows(.08); E.grade({ sat:1.05, con:1.03, bri:1.08 });
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
  function build(scn) {
    clear();
    env = { objs:[], keys:[], ticks:[], cache:{}, ground:null };
    const bg = scn.ground ?? GROUND[scn.id] ?? 0x333333, g = newGround(bg); env.ground = g;
    GFX.cam.setBackgroundColor(bg);
    const E = {
      tick(f) { env.ticks.push(f); },
      glow(fx, fy, color, size, alpha) {
        GFX.tex("glow", () => Art.glow());
        const im = GFX.img("glow").setBlendMode(1).setTint(color).setAlpha(alpha).setDepth(GFX.D_HINT - 10); env.objs.push(im);
        const pin = GFX.pinToScreen(im, fx, fy, 1);
        env.ticks.push(() => { const on = GFX.quality.glow; im.setVisible(on); if (!on) return; pin(); const z = GFX.view.zoom*GFX.view.dpr; im.setScale(size*4*GFX.view.dpr/z/Art.Q*Math.max(1, GFX.view.H/720)); });
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
          env.ticks.push(t => { if (!GFX.quality.fx) { if (im.visible) { im.clear(); im.setVisible(false); } return; } im.setVisible(true); const v = GFX.view, d = v.dpr, W = v.W*d, H = v.H*d, z = v.zoom*d, w2 = GFX.cam.width/2, h2 = GFX.cam.height/2, T = (px, py) => [w2 + (px - w2)/z, h2 + (py - h2)/z];
            im.clear(); im.fillStyle(0xfff2b8, .03 + .02*Math.sin(t*.4 + ph));
            const p0 = T(W*x0, 0), p1 = T(W*(x0 + wd), 0), p2 = T(W*(x0 + wd - .28), H), p3 = T(W*(x0 - .28), H); im.beginPath(); im.moveTo(...p0); im.lineTo(...p1); im.lineTo(...p2); im.lineTo(...p3); im.closePath(); im.fillPath(); });
        }
      },
      /* pessoa animada no cenário (palmas, ginga…). spec: veja People.randomSpec; o.pose: clap | ginga | cheer; o.motion(n, t, dt) roda depois da animação base */
      person(x, z, spec, o = {}) {
        const n = GFX.makePerson(spec, { s:o.s || 1, pose:o.pose || "clap" }); n.at(x, 0, z); if (o.scale) n.sc = o.scale;
        env.objs.push({ destroy: () => n.destroy() });
        env.ticks.push((t, dt) => { GFX.updateFan(n, t, dt); if (o.motion) o.motion(n, t, dt); });
        return n;
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
    (SC[scn.id] || SC.__default)(E, g, KIT);
    g.done(); bakeGround(g);
    return env;
  }
  function tick(t, dt) { if (env) env.ticks.forEach(f => f(t, dt)); }

  return { build, clear, tick, register, get:id => SC[id], kit:KIT };
})();

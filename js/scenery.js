/* ================================================================
   Cenários isométricos: peças 3D desenhadas em canvas (caixas, cilindros,
   cones, esferas) viram sprites; o chão é desenhado em vetor (Graphics).
   Cada cenário só descreve onde cada peça fica no mundo (x, z).
   ================================================================ */
"use strict";
const Scenery = (() => {
  const { HW, HH, HY, shade, css, mix, ell, poly, lin, rad } = Art;
  const QS = 1.5;                                   // qualidade das peças de cenário
  const SQ2 = Math.SQRT2;
  const rnd = (a, b) => a + Math.random()*(b - a);
  const rint = n => Math.floor(Math.random()*n);
  const pick = a => a[rint(a.length)];

  let env = null;                                   // { objs, texKeys, ticks }

  /* ---------- kit de desenho isométrico (usado dentro de make) ---------- */
  function drawKit(ctx, ox, oy) {
    const p = (x, y, z) => [ox + (x + z)*HW, oy + (z - x)*HH - y*HY];
    const path = pts => { ctx.beginPath(); pts.forEach(([a, b], i) => i ? ctx.lineTo(a, b) : ctx.moveTo(a, b)); ctx.closePath(); };
    const face = (pts3, fill, stroke = "rgba(0,0,0,.35)", lw = 1) => {
      const pts = pts3.map(q => p(q[0], q[1], q[2]));
      path(pts); ctx.fillStyle = fill; ctx.fill();
      if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
    };
    const K = {
      ctx, p, face,
      /* caixa: centro (x,z), tamanho w (x) × d (z) × h, base em y0 */
      box(x, z, w, d, y0, h, color, o = {}) {
        const x0 = x - w/2, x1 = x + w/2, z0 = z - d/2, z1 = z + d/2, y1 = y0 + h;
        const cL = o.left ?? shade(color, .9), cR = o.right ?? shade(color, .66), cT = o.top ?? shade(color, 1.16);
        // face esquerda (-x) e direita (+z)
        const gl = (() => { const a = p(x0, y0, z0), b = p(x0, y1, z0); return lin(ctx, a[0], b[1], a[0], a[1], [[0, css(shade(cL, 1.12))], [1, css(shade(cL, .86))]]); })();
        face([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], o.flat ? css(cL) : gl);
        const gr = (() => { const a = p(x1, y0, z1), b = p(x1, y1, z1); return lin(ctx, a[0], b[1], a[0], a[1], [[0, css(shade(cR, 1.1))], [1, css(shade(cR, .84))]]); })();
        face([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], o.flat ? css(cR) : gr);
        face([[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], css(cT));
        if (o.win) K.windows(x0, x1, z0, z1, y0, y1, o.win);
        if (o.stripe) { const [sc, sh, sy] = o.stripe; K.face2(x0, x1, z0, z1, sy, sh, sc); }
      },
      /* faixa horizontal colorida nas duas faces visíveis */
      face2(x0, x1, z0, z1, ya, hh, color) {
        face([[x0, ya, z0], [x0, ya, z1], [x0, ya + hh, z1], [x0, ya + hh, z0]], css(shade(color, .9)), null);
        face([[x0, ya, z1], [x1, ya, z1], [x1, ya + hh, z1], [x0, ya + hh, z1]], css(shade(color, .66)), null);
      },
      windows(x0, x1, z0, z1, y0, y1, o) {
        const rows = o.rows ?? Math.max(1, Math.floor((y1 - y0 - (o.margin ?? .5))/(o.sp ?? .9))), sp = o.sp ?? .9;
        const dark = o.dark ?? "#2a3446", lit = o.lit ?? "#ffe9a0", pl = o.pLit ?? .3, ww = o.w ?? .5, wh = o.h ?? .5;
        const drawFaceH = (fixed, a0, a1, side) => {          // side 'L' (-x, varia z) | 'R' (+z, varia x)
          const n = Math.max(1, Math.floor((a1 - a0)/sp));
          const pad = ((a1 - a0) - (n - 1)*sp - ww)/2;
          for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) {
            const s0 = a0 + pad + i*sp, s1 = s0 + ww, v0 = y0 + (o.margin ?? .5) + j*sp, v1 = v0 + wh;
            const pts = side === "L" ? [[fixed, v0, s0], [fixed, v0, s1], [fixed, v1, s1], [fixed, v1, s0]] : [[s0, v0, fixed], [s1, v0, fixed], [s1, v1, fixed], [s0, v1, fixed]];
            const on = Math.random() < pl;
            face(pts, on ? lit : (o.glass ? css(mix(0x2a4a68, 0x8ab8e0, Math.random()*.6)) : dark), null);
          }
        };
        drawFaceH(x0, z0, z1, "L"); drawFaceH(z1, x0, x1, "R");
      },
      /* cilindro vertical */
      cyl(x, z, r, y0, h, color, o = {}) {
        const rx = r*SQ2*HW, ry = r*SQ2*HH, b = p(x, y0, z), t = p(x, y0 + h, z);
        const g = lin(ctx, b[0] - rx, 0, b[0] + rx, 0, [[0, css(shade(color, 1.22))], [.5, css(color)], [1, css(shade(color, .58))]]);
        ctx.beginPath(); ctx.moveTo(b[0] - rx, b[1]); ctx.lineTo(t[0] - rx, t[1]); ctx.ellipse(t[0], t[1], rx, ry, 0, Math.PI, 0, false); ctx.lineTo(b[0] + rx, b[1]); ctx.ellipse(b[0], b[1], rx, ry, 0, 0, Math.PI, false); ctx.closePath();
        ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.stroke();
        ctx.beginPath(); ctx.ellipse(t[0], t[1], rx, ry, 0, 0, 7); ctx.fillStyle = css(o.top ?? shade(color, 1.18)); ctx.fill(); ctx.stroke();
      },
      cone(x, z, r, y0, h, color) {
        const rx = r*SQ2*HW, ry = r*SQ2*HH, b = p(x, y0, z), t = p(x, y0 + h, z);
        const g = lin(ctx, b[0] - rx, 0, b[0] + rx, 0, [[0, css(shade(color, 1.2))], [.5, css(color)], [1, css(shade(color, .55))]]);
        ctx.beginPath(); ctx.moveTo(b[0] - rx, b[1]); ctx.lineTo(t[0], t[1]); ctx.lineTo(b[0] + rx, b[1]); ctx.ellipse(b[0], b[1], rx, ry, 0, 0, Math.PI, false); ctx.closePath();
        ctx.fillStyle = g; ctx.fill(); ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,.4)"; ctx.stroke();
      },
      /* pirâmide de telhado */
      pyr(x, z, w, d, y0, h, color) {
        const x0 = x - w/2, x1 = x + w/2, z0 = z - d/2, z1 = z + d/2, ap = [x, y0 + h, z];
        face([[x0, y0, z0], [x0, y0, z1], ap], css(shade(color, .95)));
        face([[x0, y0, z1], [x1, y0, z1], ap], css(shade(color, .7)));
      },
      /* esfera / elipsoide (r em unidades do mundo; sy achata) */
      ball(x, y, z, r, color, sy = 1, o = {}) {
        const c = p(x, y, z), R = r*HW*1.12;
        const g = rad(ctx, c[0], c[1], R*.1, R*1.05, [[0, css(shade(color, 1.3))], [.55, css(color)], [1, css(shade(color, .6))]], c[0] - R*.35, c[1] - R*.4*sy);
        ctx.beginPath(); ctx.ellipse(c[0], c[1], R, R*sy, 0, 0, 7); ctx.fillStyle = g; ctx.fill();
        if (o.outline !== false) { ctx.lineWidth = 1; ctx.strokeStyle = "rgba(0,0,0,.32)"; ctx.stroke(); }
      },
      line(a, b, w, color) { const A = p(...a), B = p(...b); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.lineWidth = w; ctx.strokeStyle = css(color); ctx.stroke(); },
      /* vela/painel plano vertical em x (visto de lado) ou z */
      panel(x, z, w, h, y0, color, axis = "z", o = {}) {
        if (axis === "z") face([[x - w/2, y0, z], [x + w/2, y0, z], [x + w/2, y0 + h, z], [x - w/2, y0 + h, z]], css(color), o.stroke ?? "rgba(0,0,0,.35)");
        else face([[x, y0, z - w/2], [x, y0, z + w/2], [x, y0 + h, z + w/2], [x, y0 + h, z - w/2]], css(color), o.stroke ?? "rgba(0,0,0,.35)");
      },
      shadow(x, z, rx, rz, a = .3) {
        const c = p(x, 0, z); ctx.beginPath(); ctx.ellipse(c[0], c[1], (rx + rz)*HW*.8, (rx + rz)*HH*.8, 0, 0, 7);
        ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.fill();
      },
    };
    return K;
  }

  /* cria (ou reaproveita) uma textura de peça: rx/rz = meia extensão no mundo, h = altura */
  function make(key, rx, rz, h, draw) {
    const k = "scn_" + key;
    if (!env.cache[k]) {
      const pad = 8;
      const W = Math.ceil(2*(rx + rz)*HW + pad*2), Hh = Math.ceil(2*(rx + rz)*HH + h*HY + pad*2);
      const c = document.createElement("canvas"); c.width = Math.ceil(W*QS); c.height = Math.ceil(Hh*QS);
      const x = c.getContext("2d"); x.scale(QS, QS); x.lineJoin = "round"; x.lineCap = "round";
      const ox = W/2, oy = (rx + rz)*HH + h*HY + pad;
      const K = drawKit(x, ox, oy);
      K.shadow(0, 0, rx*.9, rz*.9, .22);
      draw(K);
      GFX.scene.textures.addCanvas(k, c);
      env.keys.push(k);
      env.cache[k] = { w:W, h:Hh, ox, oy };
    }
    return k;
  }
  /* coloca a peça no mundo: base em (x, y, z) */
  function put(key, x, z, y = 0, o = {}) {
    const d = env.cache[key], im = GFX.scene.add.image(0, 0, key).setOrigin(d.ox/d.w, d.oy/d.h);
    const p = GFX.P(x, y, z);
    im.setScale(QS ? (o.scale || 1)/QS : 1).setPosition(p[0], p[1]);
    if (o.flip) im.scaleX *= -1;
    im.setDepth(GFX.D_SORT + GFX.depthOf(x, z) + (o.bias || 0));
    if (o.alpha != null) im.setAlpha(o.alpha);
    if (o.blend) im.setBlendMode(o.blend);
    env.objs.push(im);
    return im;
  }
  /* atalho: monta a peça e já coloca */
  function piece(key, rx, rz, h, draw, x, z, y, o) { return put(make(key, rx, rz, h, draw), x, z, y, o); }

  /* ---------- chão em vetor ---------- */
  let gOrder = 0;
  function G() { const g = GFX.scene.add.graphics().setDepth(GFX.D_GROUND + (gOrder++)*.001); env.objs.push(g); return g; }
  const gp = (g, pts, color, alpha = 1) => {
    g.fillStyle(color, alpha); g.beginPath();
    pts.forEach(([x, z], i) => { const q = GFX.P(x, 0, z); i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1]); });
    g.closePath(); g.fillPath();
  };
  const grect = (g, x0, z0, x1, z1, color, alpha = 1) => gp(g, [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], color, alpha);
  const gline = (g, a, b, w, color, alpha = 1) => { const A = GFX.P(a[0], 0, a[1]), B = GFX.P(b[0], 0, b[1]); g.lineStyle(w, color, alpha); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.strokePath(); };
  const gell = (g, x, z, rx, rz, color, alpha = 1) => { const q = GFX.P(x, 0, z); g.fillStyle(color, alpha); g.fillEllipse(q[0], q[1], (rx + rz)*SQ2*HW*1.0, (rx + rz)*SQ2*HH*1.0); };
  const gring = (g, x, z, r, w, color, alpha = 1) => { const q = GFX.P(x, 0, z); g.lineStyle(w, color, alpha); g.strokeEllipse(q[0], q[1], 2*r*SQ2*HW, 2*r*SQ2*HH); };

  /* ---------- peças comuns ---------- */
  const flagImg = (key, x, y, z, w, wave = true) => {
    const k = GFX.flagKey(key), d = GFX.texInfo[k], p = GFX.P(x, y, z);
    const im = GFX.scene.add.image(p[0], p[1], k).setOrigin(0, .1).setScale(w/(d.w*Art.Q)).setDepth(GFX.D_SORT + GFX.depthOf(x, z) + 50);
    env.objs.push(im);
    if (wave) env.ticks.push(t => { im.scaleX = (w/(d.w*Art.Q))*(1 + Math.sin(t*5 + x)*.08); im.skewY = Math.sin(t*5 + x)*.12; });
    return im;
  };
  const lamp = (K, x, z, h = 3.4, c = 0x555a60) => { K.cyl(x, z, .09, 0, h, c); K.box(x + .35, z, .9, .26, h - .05, .16, 0xfff4c2); };
  function tree(x, z, o = {}) {
    const h = o.h ?? rnd(1.6, 2.4), r = o.r ?? rnd(.8, 1.2), g = o.green ?? pick([0x2e8b3a, 0x3a9a44, 0x2a7a35]);
    piece(`tree${h.toFixed(1)}${r.toFixed(1)}${g}`, r + .4, r + .4, h + r*1.3, K => {
      K.cyl(0, 0, .13, 0, h, 0x6b4a2a);
      K.ball(-.15, h + r*.25, .1, r*.9, shade(g, .9), .78); K.ball(.25, h + r*.35, -.1, r*.85, g, .78); K.ball(0, h + r*.65, 0, r, shade(g, 1.15), .8);
    }, x, z);
  }
  function palm(x, z, h = 3.2) {
    piece("palm" + h, 2, 2, h + 1.2, K => {
      K.cyl(0, 0, .17, 0, h, 0x8a6a42);
      for (let k = 0; k < 7; k++) {
        const a = k/7*Math.PI*2, ex = Math.cos(a)*1.8, ez = Math.sin(a)*1.8;
        K.face([[0, h, 0], [ex*.55 + Math.sin(a)*.3, h + .5, ez*.55 - Math.cos(a)*.3], [ex, h - .35, ez], [ex*.55 - Math.sin(a)*.3, h + .5, ez*.55 + Math.cos(a)*.3]], css(pick([0x2f9a3f, 0x3aa84a, 0x278a36])), "rgba(0,0,0,.3)");
      }
      K.ball(.12, h - .05, .1, .22, 0x6b4a2a); K.ball(-.12, h - .05, -.05, .2, 0x6b4a2a);
    }, x, z);
  }
  const tower = (x, z, w, d, h, o = {}) => {
    const hue = o.color ?? hexHSL(rnd(.55, .68), rnd(.1, .25), rnd(.55, .8));
    return piece(`tw${w.toFixed(1)}_${d.toFixed(1)}_${h.toFixed(1)}_${hue}_${o.win?.lit || ""}`, w/2 + .2, d/2 + .2, h + (o.roofH || 0) + .4, K => {
      K.box(0, 0, w, d, 0, h, hue, { win:{ dark:o.dark ?? "#2a3446", lit:o.lit ?? "#ffe9a0", pLit:o.pLit ?? .3, sp:o.sp ?? .85, w:.45, h:.5, glass:o.glass, margin:.7 } });
      K.box(0, 0, w + .15, d + .15, h, .22, shade(hue, .8));
      if (o.roofH) K.pyr(0, 0, w, d, h + .22, o.roofH, o.roof ?? 0x8a4a2a);
      if (o.antenna) K.cyl(0, 0, .05, h + .2, 1.6, 0x888888);
    }, x, z);
  };
  function hexHSL(h, s, l) {
    const a = s*Math.min(l, 1 - l), f = n => { const k = (n + h*12) % 12; return l - a*Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
    return (Math.round(f(0)*255) << 16) | (Math.round(f(8)*255) << 8) | Math.round(f(4)*255);
  }
  const cloud = (x, z, y, s, color = 0xffffff, alpha = .9) => {
    const k = make("cloud" + s.toFixed(1), 3*s, 3*s, 2*s, K => {
      [[-1.2, .1, 1], [0, .5, 1.4], [1.3, .1, 1.1], [.2, .15, 1.2]].forEach(([dx, dy, rr]) => K.ball(dx*s, dy*s + s, 0, rr*s, color, .55, { outline:false }));
    });
    return put(k, x, z, y, { alpha });
  };

  /* ---------- cenários ---------- */
  const SC = {};

  /* São Paulo: Avenida Paulista */
  SC.paulista = (E) => {
    E.bg(0x2d3035);
    const g = G();
    grect(g, -60, -9.3, 60, 9.3, 0x31353b);                       // pista
    for (let x = -50; x < 50; x += 3.2) { gline(g, [x, -6.6], [x + 1.7, -6.6], 3, 0xf4f4f4, .85); gline(g, [x, 6.6], [x + 1.7, 6.6], 3, 0xf4f4f4, .85); }
    gline(g, [-60, -9.2], [60, -9.2], 2, 0xffd400, .9); gline(g, [-60, 9.2], [60, 9.2], 2, 0xffd400, .9);
    grect(g, -60, -15, 60, -9.3, 0x9d9d95); grect(g, -60, 9.3, 60, 13.5, 0x9d9d95);   // calçadas
    grect(g, -60, -15.3, 60, -15, 0x6a6a64); grect(g, -60, 13.5, 60, 13.8, 0x6a6a64);
    for (let x = -50; x < 50; x += 2.2) { gline(g, [x, -9.3], [x, -15], 1, 0x8a8a82, .6); gline(g, [x, 9.3], [x, 13.5], 1, 0x8a8a82, .6); }
    // faixa de pedestres perto do tabuleiro do computador
    for (let i = -4; i <= 4; i++) { grect(g, 18 + i*.55, -9, 18 + i*.55 + .28, 9, 0xf0f0f0, .8); }
    // prédios ao fundo (esquerda-cima)
    for (let i = 0; i < 9; i++) tower(-24 + i*4.6 + rnd(-.6, .6), -18.5 - rnd(0, 4), rnd(3, 4.6), rnd(3.4, 5), rnd(5, 13), { pLit:.35, glass:i%3 === 0 });
    for (let i = 0; i < 6; i++) tower(-30 + i*5.2 + rnd(-.6, .6), -27 - rnd(0, 4), rnd(3.6, 5), rnd(3.6, 5), rnd(10, 19), { pLit:.3, glass:true, antenna:i%2 });
    // prédios ao fundo (direita-cima)
    for (let i = 0; i < 8; i++) tower(23 + rnd(0, 3), -12 + i*3.9 + rnd(-.4, .4), rnd(3, 4.4), rnd(3, 4), rnd(5, 12), { pLit:.35, glass:i%3 === 1 });
    for (let i = 0; i < 6; i++) tower(31 + rnd(0, 3), -14 + i*4.8 + rnd(-.4, .4), rnd(3.4, 4.6), rnd(3.4, 4.4), rnd(9, 17), { pLit:.3, glass:true, antenna:i%2 });
    // MASP: viga vermelha suspensa por dois pilares
    piece("masp", 8, 3.4, 7, K => {
      K.box(-6.4, 0, 1.3, 4.4, 0, 4.4, 0xc8261c); K.box(6.4, 0, 1.3, 4.4, 0, 4.4, 0xc8261c);
      K.box(0, 0, 15, 5.4, 3.6, 2.6, 0xc8261c, { win:{ dark:"#7a1410", lit:"#ffb0a0", pLit:.15, sp:1.1, w:.7, h:.9, rows:1, margin:.9 } });
      K.box(0, 0, 15.2, 5.6, 6.2, .3, 0xf0f0f0);
    }, -9, -12.6);
    // postes, árvores e carros
    for (let x = -22; x <= 22; x += 8) piece("lampP" + (x%16 ? 1 : 0), 1, 1, 4, K => { lamp(K, 0, 0); }, x, -9.9);
    for (let x = -20; x <= 20; x += 9) tree(x + 2, 11.3, { h:rnd(1.4, 2), green:0x3a8a3a });
    for (let x = -20; x <= 20; x += 9) tree(x + 4, -10.9, { h:rnd(1.4, 2), green:0x3a8a3a });
    [[-18, 8, 0xe53935], [24, -7.8, 0xfdd835], [-27, -7.8, 0x1e88e5]].forEach(([x, z, c]) =>
      piece("car" + c, 1.2, .7, 1.3, K => { K.box(0, 0, 2.2, 1.1, .2, .5, c); K.box(-.1, 0, 1.2, .96, .7, .5, shade(c, 1.1), { win:{ dark:"#223", rows:0 } }); K.box(0, .0, 2.2, 1.1, 0, .22, 0x222222); }, x, z));
    // nuvens
    E.tick((t) => {});
  };

  /* Rio: Cristo Redentor, campo de futebol, morros com favela, Pão de Açúcar */
  SC.rio = (E) => {
    E.bg(0x7f7a66);
    const g = G();
    grect(g, -30, -17, 30, 17, 0x8c8470);                                  // mirante de pedra
    for (let i = -30; i < 30; i += 3) gline(g, [i, -17], [i, 17], 1, 0x7d7560, .5);
    // campo
    const FX = 20, FZ = 8.6;
    grect(g, -FX - 1, -FZ - 1, FX + 1, FZ + 1, 0x24742f);
    grect(g, -FX, -FZ, FX, FZ, 0x2e8b3a);
    for (let i = 0; i < 10; i += 2) grect(g, -FX + i*4, -FZ, -FX + i*4 + 4, FZ, 0x36973f);
    const L = (a, b) => gline(g, a, b, 2.2, 0xf4f4f4, .95);
    L([-FX, -FZ], [FX, -FZ]); L([-FX, FZ], [FX, FZ]); L([FX, -FZ], [FX, FZ]); L([-FX, -FZ], [-FX, FZ]); L([0, -FZ], [0, FZ]);
    gring(g, 0, 0, 2.6, 2.2, 0xf4f4f4, .95);
    [-1, 1].forEach(sx => { const x0 = sx*FX; L([x0 - sx*5.5, -6.5], [x0 - sx*5.5, 6.5]); L([x0, -6.5], [x0 - sx*5.5, -6.5]); L([x0, 6.5], [x0 - sx*5.5, 6.5]); L([x0 - sx*2.2, -3], [x0 - sx*2.2, 3]); L([x0, -3], [x0 - sx*2.2, -3]); L([x0, 3], [x0 - sx*2.2, 3]); });
    // traves
    [-1, 1].forEach(sx => piece("goal" + sx, 1.5, 3.4, 2.6, K => {
      K.cyl(0, -2.6, .07, 0, 2.4, 0xffffff); K.cyl(0, 2.6, .07, 0, 2.4, 0xffffff); K.box(0, 0, .12, 5.4, 2.4, .12, 0xffffff);
      K.face([[0, 0, -2.6], [sx*1.4, 0, -2.6], [sx*1.4, 2.4, -2.6], [0, 2.4, -2.6]], "rgba(255,255,255,.18)", "rgba(255,255,255,.5)");
      K.face([[sx*1.4, 0, -2.6], [sx*1.4, 0, 2.6], [sx*1.4, 2.4, 2.6], [sx*1.4, 2.4, -2.6]], "rgba(255,255,255,.14)", "rgba(255,255,255,.5)");
    }, sx*FX, 0));
    // Cristo
    piece("cristo", 3.4, 3.4, 12.6, K => {
      K.box(0, 0, 4.2, 4.2, 0, 2.4, 0xcfc9bb); K.box(0, 0, 2.7, 2.7, 2.4, 1.5, 0xdcd6c8);
      K.cyl(0, 0, .62, 3.9, 4.2, 0xf0eee6); K.box(0, 0, .8, 8.6, 7.4, .7, 0xf0eee6); K.box(0, 0, 1.1, 2.0, 7.4, .9, 0xf0eee6);
      K.ball(0, 8.7, 0, .56, 0xf0eee6, 1);
    }, -9, -17, 0, { scale:.62 });
    // morros com favela
    const hill = (x, z, r, hgt, n) => {
      piece("hill" + r + n, r + 1, r + 1, hgt + 3, K => {
        K.ball(0, 0, 0, r, 0x4f8a3e, hgt/(r*1.12)*.9, { outline:false });
        for (let i = 0; i < n; i++) {
          const th = rnd(0, Math.PI*2), rr = rnd(0, r*.7), px = Math.cos(th)*rr, pz = Math.sin(th)*rr*.8;
          if (pz < -r*.1) continue;
          const py = Math.max(0, hgt*(1 - (rr/(r*.9))**2)*.78) ;
          const w = rnd(.45, .8);
          K.box(px, pz, w, w*rnd(.8, 1.2), py, rnd(.4, .7), pick([0xe4572e, 0xf3a712, 0xf7e7ce, 0x2e86ab, 0xa8c686, 0xe8a0bf, 0xd9534f, 0x7ecbc2, 0xf2d0a4, 0xc97b4a, 0xffffff]), { win:{ rows:1, sp:.4, w:.22, h:.2, margin:.2, lit:"#ffe9a0", pLit:.2 } });
        }
      }, x, z);
    };
    hill(-18, -26, 8, 5, 60); hill(8, -30, 9, 6, 70); hill(-30, -14, 7, 4.5, 50); hill(24, -20, 7, 4.5, 50);
    piece("pao", 5, 5, 11, K => { K.ball(0, 0, 0, 5, 0x8a8478, 2.1, { outline:false }); K.ball(-1, 3.2, -1, 1.7, 0x9a9488, 1); K.ball(2.4, 1.2, 1.2, 2.5, 0x4f8a3e, .9); }, 28, -10);
    // palmeiras
    [[-24, 9], [-30, -3], [-27, 12], [24, 10], [30, -2], [28, 13], [-12, -14], [14, -15], [-33, 5]].forEach(([x, z]) => palm(x, z));
  };

  /* Porto Alegre: Aeroporto Salgado Filho */
  SC.poa = (E) => {
    E.bg(0x575a5f);
    const g = G();
    grect(g, -40, -24, 40, 24, 0x5d6066);
    for (let x = -40; x <= 40; x += 6) gline(g, [x, -24], [x, 24], 1, 0x6b6f75, .55);
    for (let z = -24; z <= 24; z += 6) gline(g, [-40, z], [40, z], 1, 0x6b6f75, .55);
    gline(g, [-40, -9], [40, -9], 4, 0xffd400, .9); gline(g, [-40, 9], [40, 9], 4, 0xffd400, .9);
    for (let x = -36; x <= 36; x += 6) { grect(g, x, -9.6, x + .32, -8.2, 0xffd400, .85); }
    for (let x = -36; x <= 36; x += 6) { grect(g, x, 8.2, x + .32, 9.6, 0xffd400, .85); }
    // terminal (em cima, à esquerda)
    piece("terminal", 11, 3.4, 5.6, K => {
      K.box(0, 0, 20, 5.6, 0, 3.4, 0xe9ecf0, { win:{ dark:"#4a8fc2", lit:"#cfe9ff", pLit:.1, sp:1.25, w:.95, h:1.7, rows:1, margin:.9, glass:true } });
      K.box(0, 0, 20.6, 6.2, 3.4, .6, 0x2f3a4a); K.box(0, 0, 18, 5, 4, 1.2, 0x5a9fcf, { win:{ dark:"#2b6f9f", lit:"#cfe9ff", pLit:.1, sp:1.4, w:1, h:.7, rows:1, margin:.25, glass:true } });
    }, -9, -25);
    // torre
    piece("tower", 1.8, 1.8, 11, K => { K.cyl(0, 0, .75, 0, 7, 0xe8e8e8); K.cyl(0, 0, 1.7, 7, 1.6, 0x5a9fcf); K.cyl(0, 0, 1.85, 8.6, .26, 0x2f3a4a); K.cyl(0, 0, .06, 8.8, 2, 0x333333); }, 24, -14);
    // aviões
    const plane = (x, z, tail) => piece("plane" + tail, 8, 8, 5, K => {
      K.box(0, 0, 15, 3.2, .9, .3, 0xdfe3e8);                                    // asas
      K.box(0, 0, 1.5, 12.5, .8, 1.5, 0xf7f7f7);                                 // fuselagem
      K.box(0, 0, 1.52, 11.5, 1.45, .3, tail);                                   // faixa
      K.ball(0, 1.5, 6.5, .78, 0xf7f7f7, 1);
      K.box(0, -6.6, .3, 1.8, 1.4, 3.2, tail); K.box(0, -6.2, 4.4, 1.4, 1.5, .2, 0xdfe3e8);
      [-3.4, 3.4].forEach(xx => K.cyl(xx, 0.8, .42, .5, 1.1, 0x8f959c));
    }, x, z, 0, { scale:.85 });
    plane(6, -19, 0x1e6fd1);
    // veículos de pista
    const cart = (x, z, c) => piece("cart" + c, 3, 1, 1.2, K => { K.box(-1.7, 0, 1.2, .9, .2, .8, c); [0, 1, 2].forEach(i => K.box(i*1.3 - .1, 0, 1.15, .95, .2, .5, 0x8a9099)); }, x, z);
    cart(-15, 12.5, 0xff7a1a); cart(14, 13.2, 0xffd400);
    piece("fuel", 2, 1, 1.8, K => { K.cyl(0, 0, .8, .3, 2.4, 0xf2f2f2); K.box(0, 1.6, 1, 1.2, .3, 1.2, 0xd32f2f); }, 22, 14);
    [[-12, 3], [13, 4], [-3, 14], [4, 14.5], [27, -2], [-26, 2], [0, -8]].forEach(([x, z]) => piece("tcone", .5, .5, .6, K => { K.cone(0, 0, .22, 0, .56, 0xff7a1a); K.cyl(0, 0, .13, .22, .12, 0xffffff); }, x, z));
    for (let x = -22; x <= 22; x += 11) piece("lampA", 1, 1, 7, K => { K.cyl(0, 0, .12, 0, 6.4, 0x555a60); K.box(.5, 0, 1.4, .4, 6.3, .26, 0xfff4c2); }, x, -9.6);
    [-1.6, 1.6].forEach(dx => { piece("rsflagpole", .5, .5, 7, K => K.cyl(0, 0, .06, 0, 5.4, 0xeeeeee), 12 + dx*2.2, -12); });
    flagImg("rs", 12 + (-1.6)*2.2, 5.4, -12, 40); flagImg("rs", 12 + 1.6*2.2, 5.4, -12, 40);
    tree(-27, 9, { green:0x4a8a3a }); tree(30, 8, { green:0x4a8a3a }); tree(-32, -4, { green:0x4a8a3a });
  };

  /* Sertão */
  SC.sertao = (E) => {
    E.bg(0xc9a05e);
    const g = G();
    for (let i = 0; i < 70; i++) { const x = rnd(-34, 34), z = rnd(-26, 26), a = rnd(0, 3.14), w = rnd(.5, 2); gline(g, [x - Math.cos(a)*w, z - Math.sin(a)*w], [x + Math.cos(a)*w, z + Math.sin(a)*w], 1.4, 0x6f4f28, .5); }
    for (let i = 0; i < 28; i++) gell(g, rnd(-34, 34), rnd(-26, 26), rnd(.8, 2.6), rnd(.6, 1.8), 0xb9904e, .35);
    // serras
    [[-26, -26, 9, 5], [-4, -32, 10, 5.5], [20, -28, 9, 5], [32, -12, 8, 4.5], [-34, -8, 8, 4]].forEach(([x, z, r, h]) => piece("serra" + r, r + 1, r + 1, h + 1, K => K.ball(0, 0, 0, r, 0xa8693a, h/(r*1.12)*.9, { outline:false }), x, z));
    // sol e halo (no canto da tela)
    E.glow(.78, .12, 0xfff0b0, 1.4, .5);
    const cactus = (x, z, h) => piece("cac" + h, 2.2, 1, h + .5, K => {
      const gr = 0x3f7a3a; K.cyl(0, 0, .34, 0, h, gr);
      [[-1, .55], [1, .7]].forEach(([sx, k]) => { K.box(sx*.7, 0, 1.2, .38, h*k, .38, gr); K.cyl(sx*1.3, 0, .22, h*k, h*.38, gr); });
    }, x, z);
    [[-12, -9, 4.4], [-17, -15, 5.2], [-26, -8, 4], [-3, -15, 5], [14, -10, 5], [22, -17, 5.5], [28, -6, 4.2], [-24, 9, 3.8], [25, 11, 4.2], [-16, 12, 3.4], [10, 14, 3.6], [-30, 2, 4.6], [33, 4, 4.8]].forEach(a => cactus(...a));
    [[-8, 12], [-20, 14], [15, 13], [26, 14], [-30, -2], [32, -2]].forEach(([x, z]) => piece("xique" + (x|0), 1.2, 1.2, 1.8, K => { for (let i = 0; i < 4; i++) K.cyl(rnd(-.6, .6), rnd(-.6, .6), .14, 0, rnd(.7, 1.4), 0x5a8a45); }, x, z));
    [[-23, -12], [24, -13], [4, -20]].forEach(([x, z]) => piece("dry" + x, 2.4, 2.4, 4.4, K => {
      K.cyl(0, 0, .2, 0, 3.4, 0x5d4023);
      for (let k = 0; k < 4; k++) { const a = k*1.7; K.line([0, 2.8, 0], [Math.cos(a)*1.3, 3.8 + k*.1, Math.sin(a)*1.3], 4, 0x5d4023); }
    }, x, z));
    piece("skull", 1, 1, 1, K => { K.box(0, 0, .7, .5, .1, .4, 0xf2eadb); K.line([-.3, .4, 0], [-.8, .75, 0], 3, 0xf2eadb); K.line([.3, .4, 0], [.8, .75, 0], 3, 0xf2eadb); }, -14, 6);
    // casa de taipa
    piece("taipa", 3.4, 3, 4, K => {
      K.box(0, 0, 4.4, 3.4, 0, 2.2, 0xdcc79c, { win:{ rows:0 } }); K.pyr(0, 0, 5.4, 4.4, 2.2, 1.8, 0x8a6a3a); K.box(.4, 1.72, .8, .08, 0, 1.6, 0x5d4023);
    }, 20, -22);
    E.heat();
  };

  /* Amazônia */
  SC.amazonia = (E) => {
    E.bg(0x4d6a30);
    const g = G();
    for (let i = 0; i < 80; i++) gell(g, rnd(-34, 34), rnd(-26, 26), rnd(.5, 1.4), rnd(.4, 1), pick([0x2f4a1f, 0x4a6230, 0x37521f]), .7);
    // rio ao fundo
    gp(g, [[-48, -22], [48, -22], [48, -12], [-48, -12]], 0x4a6a52); gp(g, [[-48, -12.4], [48, -12.4], [48, -11.4], [-48, -11.4]], 0x8bb6a0, .8);
    for (let i = 0; i < 40; i++) { const x = rnd(-34, 34), z = rnd(-22, -12.6); gline(g, [x, z], [x + rnd(1, 2.4), z], 1.2, 0x9cc4ae, .35); }
    const tree2 = (x, z, h, w) => piece(`atree${h.toFixed(1)}${w.toFixed(1)}`, w*1.4, w*1.4, h + w*1.6, K => {
      K.cyl(0, 0, w*.22, 0, h, 0x5a3d22);
      for (let k = 0; k < 4; k++) K.ball(rnd(-.5, .5)*w, h + .2 + rnd(0, .6), rnd(-.5, .5)*w, w*rnd(.9, 1.3), pick([0x2a6a2a, 0x357a30, 0x1f5a26]), .76);
    }, x, z);
    [[-14, -9, 4, 1.2], [-20, -15, 5, 1.5], [-28, -8, 4.6, 1.3], [-33, -16, 6, 1.6], [14, -9, 4.4, 1.3], [21, -15, 5.5, 1.5], [29, -9, 4.8, 1.3], [-24, 8, 3.6, 1.1], [26, 9, 4, 1.1], [-32, 12, 4.2, 1.2], [33, 12, 4.4, 1.2], [-6, -24, 7, 1.8], [8, -26, 8, 2], [-36, -26, 7, 1.8], [30, -26, 7, 1.8], [-16, 14, 3.4, 1], [16, 15, 3.6, 1]].forEach(a => tree2(...a));
    piece("sumauma", 5, 5, 12, K => {
      for (let k = 0; k < 5; k++) { const a = k*1.26; K.box(Math.cos(a)*1.6, Math.sin(a)*1.6, .4, 2.4, 0, 3.2, 0x6a4a2a); }
      K.cyl(0, 0, 1.3, 0, 9, 0x6a4a2a);
      [[0, 10.4, 0, 4.6], [-3, 9.3, 1, 3.2], [3, 9.6, -1, 3.4], [0, 11.2, 2, 3]].forEach(([x, y, z, r]) => K.ball(x, y, z, r, 0x2f7030, .7));
    }, 0, -22);
    [[-22, -12.5], [22, -12.8]].forEach(([x, z]) => piece("maloca" + x, 3.4, 2.8, 4.6, K => { K.box(0, 0, 4.4, 3.6, 0, 2, 0xb48a52, { win:{ rows:0 } }); K.pyr(0, 0, 5.4, 4.6, 2, 2.4, 0x8a6a2a); }, x, z));
    [[-6, -17, 1], [10, -19, -1]].forEach(([x, z]) => piece("canoe" + x, 2.4, 1, .8, K => { K.box(0, 0, 4.4, .9, .0, .4, 0x7a5230, { top:0x8a6240 }); }, x, z, -.05));
    // araras voando
    const cores = [0xff3b30, 0x2f6fe0, 0xffd400, 0x2f9a3f];
    for (let i = 0; i < 6; i++) {
      const k = "macaw" + i, c0 = cores[i%4], c1 = cores[(i + 1)%4];
      const kk = make(k, 1, 1, .6, K => { K.box(0, 0, .5, .3, .1, .26, c0); K.box(.3, 0, .2, .2, .22, .2, c1); K.box(0, .3, .5, .3, .16, .04, cores[(i + 2)%4]); K.box(0, -.3, .5, .3, .16, .04, cores[(i + 2)%4]); });
      const im = put(kk, 0, 0, 0, { bias:3000 }); const sp = rnd(.8, 1.5), x0 = rnd(-30, 30), z0 = rnd(-24, -8), y0 = rnd(5, 8), ph = rnd(0, 6);
      E.tick(t => { const u = ((t*sp*2 + x0 + 40)%80) - 40; const p = GFX.P(u, y0 + Math.sin(t*3 + ph)*.5, z0 + Math.sin(t*.4 + ph)*3); im.setPosition(p[0], p[1]).setDepth(GFX.D_SORT + 2000); im.scaleY = (1 + Math.sin(t*14 + ph)*.18)/QS; });
    }
    E.mist(0xb8e0c0, .12);
  };

  /* Balneário Camboriú */
  SC.camboriu = (E) => {
    E.bg(0xf0dba4);
    const g = G();
    for (let i = 0; i < 80; i++) gell(g, rnd(-34, 34), rnd(-6, 26), rnd(.3, 1), rnd(.2, .6), 0xe6cf92, .5);
    gp(g, [[-48, -20], [48, -20], [48, -14], [-48, -14]], 0xefe7d2);                 // calçadão
    for (let x = -46; x < 46; x += 3) { gline(g, [x, -16.6 + Math.sin(x*.7)*.35], [x + 1.6, -16.6 + Math.sin(x*.7)*.35], 2.4, 0x3a3a3f, .9); gline(g, [x, -18.2 - Math.sin(x*.7)*.35], [x + 1.6, -18.2 - Math.sin(x*.7)*.35], 2.4, 0x3a3a3f, .9); }
    gp(g, [[-48, -14], [48, -14], [48, -12.6], [-48, -12.6]], 0xd9c18a);                // areia molhada (faixa)
    // mar (canto direito-cima)
    gp(g, [[15, -34], [60, -34], [60, 8], [21, 8]], 0x2fb4d6, 1);
    gline(g, [21, 8], [60, 8], 6, 0xffffff, .7); gline(g, [21, 8], [15, -34], 6, 0xffffff, .55);
    for (let i = 0; i < 40; i++) { const x = rnd(22, 55), z = rnd(-30, 4); gline(g, [x, z], [x + rnd(1.5, 3.4), z - rnd(0, .2)], 1.6, 0xdff6ff, .45); }
    // prédios nas laterais
    for (let i = 0; i < 7; i++) tower(-18 - i*3.8 - rnd(0, .8), -23 - rnd(0, 4), rnd(3, 4), rnd(3.2, 4.2), rnd(8, 18), { color:hexHSL(rnd(.08, .17), .12, rnd(.78, .92)), dark:"#6e8fb0", lit:"#ffe9a0", pLit:.2, sp:.8, roofH:rnd(0, 1) > .6 ? 1 : 0, glass:true });
    for (let i = 0; i < 6; i++) tower(-30 - i*3.2, -4 + i*3.2, rnd(3, 4), rnd(3, 4), rnd(7, 15), { color:hexHSL(rnd(.08, .17), .12, rnd(.78, .92)), dark:"#6e8fb0", pLit:.2, sp:.8, glass:true });
    // guarda-sóis / espreguiçadeiras
    const cores = [0xff4d4d, 0xffc933, 0x2fb4d6, 0xff7aa8, 0x7ed957, 0xffffff];
    [[-14, 10], [-20, 6.5], [-27, 11], [-9, 13], [14, 11], [21, 7], [-4, 14.5], [4, 15], [-32, 3], [28, 12]].forEach(([x, z], i) => piece("sombra" + i, 2, 2, 3.4, K => {
      K.cyl(0, 0, .04, 0, 2.1, 0xeeeeee); K.cone(0, 0, 1.3, 2.0, .6, cores[i%cores.length]); K.box(1.0, .5, 1.1, .5, .1, .12, 0xffffff);
    }, x, z));
    [[-17, -6], [-26, -8], [18, -9], [26, -7]].forEach(([x, z]) => palm(x, z));
    piece("salvavidas", 1.5, 1.5, 3.2, K => { K.box(0, 0, 2, 2, 0, 2.4, 0xffffff, { win:{ rows:0 } }); K.box(0, 0, 2.4, 2.4, 2.4, .3, 0xd32f2f); }, -34, -9);
    piece("volei", 3.2, 1, 2.4, K => { K.cyl(-3, 0, .06, 0, 2.2, 0xeeeeee); K.cyl(3, 0, .06, 0, 2.2, 0xeeeeee); K.panel(0, 0, 6, 1, 1.2, 0xffffff, "z", { stroke:"rgba(0,0,0,.4)" }); }, 17, 14);
    // veleiros
    [[30, -14, 0], [38, -22, 1], [42, -4, 0]].forEach(([x, z, k]) => piece("veleiro" + k + x, 2.2, 1, 4.2, K => {
      K.box(0, 0, 3, .9, 0, .4, 0x7a5230); K.cyl(0, 0, .04, .4, 3.4, 0x333333);
      K.face([[0, .6, 0], [0, 3.6, 0], [1.4, .8, 0]], css(k ? 0xffd400 : 0xffffff)); K.face([[0, .6, 0], [0, 3.2, 0], [-1.1, .8, 0]], css(0xf4f4f4));
    }, x, z, -.03));
    E.glow(.2, .1, 0xfffbe0, 1.1, .45);
  };

  /* Brasília: Praça dos Três Poderes */
  SC.brasilia = (E) => {
    E.bg(0xb7ab60);
    const g = G();
    grect(g, -26, -20, 30, 14, 0x9d957f); for (let i = -3; i <= 3; i++) gline(g, [i*8, -20], [i*8, 14], 3, 0x857d69, .7);
    for (let z = -18; z <= 12; z += 6) gline(g, [-26, z], [30, z], 1.5, 0x857d69, .4);
    grect(g, -14, -9.6, 14, -6.8, 0x3a7fb0); grect(g, -14.4, -10, 14.4, -9.6, 0xc9c3ac); grect(g, -14.4, -6.8, 14.4, -6.4, 0xc9c3ac);   // espelho d'água
    for (let i = 0; i < 24; i++) { const x = rnd(-13, 13), z = rnd(-9.2, -7.2); gline(g, [x, z], [x + rnd(.6, 1.6), z], 1.2, 0xbfe3ff, .5); }
    // lago ao fundo (canto direito-cima)
    gp(g, [[26, -40], [60, -40], [60, -2], [34, -2]], 0x3f8fbf);
    // Congresso Nacional (ao fundo, à esquerda-cima)
    piece("congresso", 10, 4, 13, K => {
      K.box(0, 0, 18, 5.4, 0, 1.2, 0xd6d2c4); K.box(0, 0, 15, 4.4, 1.2, .3, 0xe0dccf);
      K.ball(-6.5, 1.5, .6, 2.6, 0xf0eee8, .75);                                  // cúpula (Senado)
      K.cyl(6.5, .6, 2.5, 1.5, .3, 0xe2ded0); K.cyl(6.5, .6, 2.1, 1.8, .06, 0x7a7a72);   // bacia (Câmara)
      K.box(-1.1, 0, 1.4, 3, 1.5, 9.2, 0xe9e6dc, { win:{ dark:"#4f93c4", lit:"#cfe9ff", pLit:.1, sp:.55, w:.3, h:.3, margin:.4, glass:true } });
      K.box(1.1, 0, 1.4, 3, 1.5, 9.2, 0xe9e6dc, { win:{ dark:"#4f93c4", lit:"#cfe9ff", pLit:.1, sp:.55, w:.3, h:.3, margin:.4, glass:true } });
      K.box(0, 0, 3.4, 1.2, 10.7, .4, 0xd8d4c8);
    }, -2, -22, 0, { scale:.8 });
    // Planalto (colunas de Niemeyer), no fundo à direita-cima
    piece("planalto", 7, 4, 6, K => {
      K.box(0, -.5, 14, 3.6, 0, 3, 0x4f93c4, { win:{ dark:"#3a7fb0", lit:"#cfe9ff", pLit:.1, sp:.8, w:.55, h:1.2, margin:.9, rows:1, glass:true } });
      K.box(0, 0, 15, 5.6, 3, .6, 0xd6d2c4);
      for (let i = 0; i < 9; i++) K.cyl(-6.4 + i*1.6, 2.4, .42, 0, 3, 0xe8e4d8);
    }, 19, -14, 0, { scale:.8 });
    piece("pole", .5, .5, 7, K => K.cyl(0, 0, .05, 0, 5.4, 0xeeeeee), 19, -14);
    flagImg("brasil", 19, 5.4, -14, 26);
    // STF
    piece("stf", 6, 4, 5, K => {
      K.box(0, -.5, 12, 3.8, 0, 3, 0xd6d2c4, { win:{ rows:0 } }); K.box(0, 0, 13.2, 5.4, 3, .5, 0xe8e4d8);
      for (let i = 0; i < 7; i++) K.cyl(-5 + i*1.65, 2.6, .5, 0, 3, 0xe2ded0);
    }, 22, -1, 0, { scale:.75 });
    piece("justica", 1.5, 1.5, 4, K => { K.box(0, 0, 1.6, 1.6, 0, .8, 0x8a8478); K.cyl(0, 0, .3, .8, 1.4, 0x9a9484); K.ball(0, 2.5, 0, .28, 0x9a9484, 1); K.box(.1, 0, .5, .3, 2.45, .12, 0x222222); }, 16.5, 4, 0, { scale:.8 });
    // Esplanada dos Ministérios (fileira no fundo)
    for (let i = 0; i < 5; i++) piece("min" + i, 2.8, 2.4, 3.6, K => { K.box(0, 0, 5.4, 4.2, 0, 3.2, 0xf4f1e8, { win:{ dark:"#4f93c4", lit:"#cfe9ff", pLit:.1, sp:.9, w:.55, h:.6, rows:2, margin:.5, glass:true } }); K.box(0, 0, 5.5, 4.3, 3.2, .3, 0xd8d4c8); }, -14 + i*0 - i*5.2, -22 + i*0 - i*2.2, 0, { scale:.8 });
    piece("tvtower", 1.4, 1.4, 16, K => { K.cyl(0, 0, .26, 0, 12, 0xdddddd); K.cyl(0, 0, 1.2, 7.2, .5, 0xcfcfcf); K.cyl(0, 0, .9, 8.2, .45, 0xe8e8e8); K.cyl(0, 0, .05, 12, 3.6, 0xbbbbbb); }, 8, -26, 0, { scale:.7 });
    // Catedral (baixa, à frente, longe do tabuleiro)
    piece("catedral", 3.2, 3.2, 6.4, K => {
      K.cyl(0, 0, 2.9, 0, .2, 0xdcd7c8);
      for (let k = 0; k < 16; k++) {
        const a = k/16*Math.PI*2, P2 = (R, y) => [Math.cos(a)*R, y, Math.sin(a)*R];
        K.line(P2(2.9, 0), P2(1.7, 3.2), 3.2, 0xe2ded0); K.line(P2(1.7, 3.2), P2(2.5, 6.2), 3.2, 0xe2ded0);
      }
      K.ball(0, 2, 0, 1.4, 0x7fc0e8, .5, { outline:false });
    }, 0, 15, 0, { scale:.6 });
    // ipês amarelos
    [[-18, 8], [-4, 15], [14, 14], [24, 10], [-22, -2], [10, -9]].forEach(([x, z]) => piece("ipe" + x + z, 2.2, 2.2, 4.6, K => { K.cyl(0, 0, .13, 0, 2.2, 0x5a4028); [[-.5, 2.6, .2], [.5, 2.9, -.2], [0, 3.3, .3]].forEach(([dx, dy, dz]) => K.ball(dx, dy, dz, rnd(1, 1.4), 0xffd21a, .75)); }, x, z, 0, { scale:.8 }));
    // ponte JK ao longe (sobre o lago)
    piece("ponte", 9, 1.4, 6, K => {
      K.box(0, 0, 18, 1.3, 1.2, .3, 0x7d7d80);
      [-5.5, 0, 5.5].forEach((x, i) => { for (let k = 0; k < 14; k++) { const a0 = k/14*Math.PI, a1 = (k + 1)/14*Math.PI, s = i%2 ? -1 : 1;
        K.line([x + Math.cos(a0)*2.6, 1.4 + Math.sin(a0)*3.6, s*Math.cos(a0)*.5], [x + Math.cos(a1)*2.6, 1.4 + Math.sin(a1)*3.6, s*Math.cos(a1)*.5], 2.6, 0xc9ccd0); } });
    }, 33, -14, 0, { scale:.8 });
    E.glow(.12, .16, 0xff9a50, 1.5, .55);
  };

  /* NG+: Apocalipse */
  SC.apocalipse = (E) => {
    E.bg(0x2a221d);
    const g = G();
    for (let i = 0; i < 46; i++) { const x = rnd(-30, 30), z = rnd(-24, 24); gell(g, x, z, rnd(.8, 1.8), rnd(.6, 1.2), 0x100b08, .85); gring(g, x, z, rnd(.9, 1.5), 2, 0x4a3a30, .7); }
    for (let i = 0; i < 40; i++) gell(g, rnd(-34, 34), rnd(-26, 26), rnd(.6, 2), rnd(.4, 1.4), 0x3a312a, .6);
    // entulho
    for (let i = 0; i < 26; i++) { const x = rnd(-26, 26), z = rnd(-20, 20); if (Math.abs(z) < 7 && Math.abs(x) < 16) continue; piece("rub" + i, 1, 1, 1, K => K.box(0, 0, rnd(.6, 1.4), rnd(.6, 1.4), 0, rnd(.3, .9), 0x3a312a), x, z); }
    // cogumelo nuclear (cresce e pulsa)
    const nuke = make("nuke", 8, 8, 20, K => {
      K.cyl(0, 0, 3.2, 0, 14, 0x7a4a32);
      [[0, 15, 7, .55, 0x93573a], [-5, 17, 5, .6, 0x8a4e34], [5, 17, 5, .6, 0x8a4e34], [0, 19.5, 5.4, .62, 0xa8633f], [-2.4, 13, 5, .5, 0x7a4a32], [2.4, 13, 5, .5, 0x7a4a32]].forEach(([x, y, r, sy, c]) => K.ball(x, y, 0, r*.46, c, sy*2.2));
      K.ball(0, 15.5, 0, 6, 0xff8a1a, .5, { outline:false });
    });
    const nk = put(nuke, 0, -18, 0, { bias:-500 });
    const glow = E.addGlowAt(0, 15, -18, 0xff8a1a, 5);
    E.tick(t => { nk.setScale((1 + Math.sin(t*.8)*.02)/QS, (1 + Math.sin(t*1.1)*.025)/QS); glow.alpha = .35 + Math.sin(t*2.2)*.1; });
    // prédios em ruínas (só nos fundos e nas laterais distantes)
    const ruin = (x, z) => tower(x, z, rnd(3, 4.4), rnd(3, 4.2), rnd(4, 9), { color:pick([0x3d3530, 0x4a4038, 0x332d29]), dark:"#1a1512", lit:"#ff8a1a", pLit:.35, sp:.85 });
    for (let i = 0; i < 6; i++) ruin(-12 + i*4.6, -21 - rnd(0, 4));
    for (let i = 0; i < 6; i++) ruin(18 + rnd(0, 3), -14 + i*3.6);
    for (let i = 0; i < 4; i++) ruin(-26 - rnd(0, 3), -16 + i*4.4);
    // fogueiras
    const fires = [];
    [[-14, -9], [14, -9], [-26, 7], [27, 8], [-8, 13], [10, 14], [-30, -12], [32, -14]].forEach(([x, z]) => {
      piece("firepit", 1, 1, .5, K => K.cyl(0, 0, .6, 0, .25, 0x1a1512), x, z);
      const fl = GFX.scene.add.image(0, 0, GFX.flameKey(0)); const p = GFX.P(x, .2, z); fl.setPosition(p[0], p[1]).setScale(1.1/Art.Q*1.5).setOrigin(.5, .93).setDepth(GFX.D_SORT + GFX.depthOf(x, z) + 5).setBlendMode(1);
      env.objs.push(fl); fires.push([fl, x, z]);
      const sm = piece("smoke" + (x|0), 1.4, 1.4, 12, K => K.cyl(0, 0, 1, 0, 10, 0x201a16, { top:0x2a221d }), x, z - 1, 0, { alpha:.35, bias:3000 });
    });
    E.tick(t => fires.forEach(([f], i) => { f.scaleY = (1.3 + Math.sin(t*14 + i*2)*.18)/Art.Q*1.1; f.scaleX = (1.1 + Math.sin(t*19 + i)*.1)/Art.Q*1.1; }));
    // tanques
    const tank = (x, z, flip, sc = 1) => piece("tank" + flip, 3.2, 2, 3, K => {
      K.box(0, 0, 4.4, 2.2, .35, .5, 0x2f3a24); K.box(0, 1.25, 4.6, .6, .1, .75, 0x1c1f17); K.box(0, -1.25, 4.6, .6, .1, .75, 0x1c1f17);
      K.box(0, 0, 3, 1.8, .85, .7, 0x3d4a2e); K.cyl(.2, 0, .85, 1.55, .5, 0x3a4529);
      K.box(1.9, 0, 3.4, .22, 1.8, .22, 0x1f2418);
    }, x, z, 0, { scale:sc*.85, flip });
    [[-16, 3.4, 0], [18, 3.4, 1], [-12, -14, 0], [16, -15, 1], [-4, 12, 0, 1.1]].forEach(a => tank(...a));
    // caças voando
    const jetK = make("jet", 3, 2, 3, K => { K.box(0, 0, 5.4, .8, 1, .6, 0x8a8f94); K.cone(3.2, 0, .45, 1.3, .1, 0x6a6f74); K.box(-.4, 0, 2.2, 5.6, 1.2, .14, 0x6f747a); K.box(-2.6, 0, 1, 2, 1.3, .12, 0x6f747a); K.box(-2.6, 0, 1, .12, 1.3, 1.2, 0x6f747a); });
    [[-3, 24, 0], [-5, 26, 90], [-2, 19, 170], [-7, 30, 40]].forEach(([z, spd, off], i) => {
      const im = put(jetK, 0, 0, 0, { bias:3500 }); const y0 = 9 + i*2;
      E.tick(t => { const u = ((t*spd*.5 + off) % 120) - 60; const p = GFX.P(u, y0 + Math.sin(t*.8 + off)*.8, z - 8 - i*3); im.setPosition(p[0], p[1]).setDepth(GFX.D_SORT + 3000); });
    });
    // brasas
    let em = 0;
    E.tick((t, dt) => { em -= dt; if (em <= 0) { em = .12; GFX.burst({ x:rnd(-30, 30), y:0, z:rnd(-22, 22) }, [0xff7a1a, 0xffd23a, 0x555555], 1, 1.2); } });
    E.mist(0xff5a20, .1);
  };

  /* ---------- ambiente ---------- */
  function clear() {
    if (!env) return;
    env.objs.forEach(o => o.destroy());
    env.keys.forEach(k => { if (GFX.scene.textures.exists(k)) GFX.scene.textures.remove(k); });
    env.extra.forEach(f => f());
  }
  function build(scn) {
    clear(); gOrder = 0;
    env = { objs:[], keys:[], ticks:[], cache:{}, extra:[] };
    const E = {
      bg(c) { GFX.cam.setBackgroundColor(c); },
      tick(f) { env.ticks.push(f); },
      /* brilho fixo do sol numa posição relativa da tela */
      glow(fx, fy, color, size, alpha) {
        GFX.tex("glow", () => Art.glow());
        const im = GFX.img("glow").setBlendMode(1).setTint(color).setAlpha(alpha).setDepth(GFX.D_HINT - 10);
        env.objs.push(im);
        const pin = GFX.pinToScreen(im, fx, fy, 1);
        env.ticks.push(() => { pin(); const z = GFX.view.zoom*GFX.view.dpr; im.setScale(size*4*GFX.view.dpr/z/Art.Q*Math.max(1, GFX.view.H/720)); });
        return im;
      },
      addGlowAt(x, y, z, color, size) {
        GFX.tex("glow", () => Art.glow());
        const im = GFX.img("glow").setBlendMode(1).setTint(color).setDepth(GFX.D_SORT + GFX.depthOf(x, z) + 10);
        const p = GFX.P(x, y, z); im.setPosition(p[0], p[1]).setScale(size*2.4/Art.Q);
        env.objs.push(im);
        return { set alpha(v) { im.setAlpha(v); } };
      },
      heat() { E.mist(0xffe0a0, .09); },
      /* sombras de nuvens deslizando pelo chão */
      cloudShadows(alpha = .08) {
        GFX.tex("blob", () => Art.blob());
        for (let i = 0; i < 5; i++) {
          const im = GFX.img("blob").setTint(0x000000).setAlpha(alpha).setDepth(GFX.D_FLAT + 50);
          const rx = rnd(5, 9), z0 = rnd(-24, 24), x0 = rnd(-45, 45), sp = rnd(.5, 1.1);
          im.setScale(2*SQ2*rx*HW/(64*.9), 2*SQ2*rx*.7*HH/(64*.9));
          env.objs.push(im);
          env.ticks.push(t => { const x = ((t*sp + x0 + 45) % 90) - 45, p = GFX.P(x, 0, z0); im.setPosition(p[0], p[1]); });
        }
      },
      /* véu de cor sobre a cena (neblina, calor, fumaça) */
      mist(color, a) {
        const r = GFX.scene.add.rectangle(0, 0, 40000, 40000, color, a).setDepth(GFX.D_HINT - 20);
        env.objs.push(r);
        const pin = GFX.pinToScreen(r, .5, .5, 1);
        env.ticks.push(() => { pin(); r.setScale(1); });
      },
    };
    (SC[scn.id] || SC.paulista)(E);
    E.cloudShadows(scn.id === "apocalipse" ? .14 : .07);
    return env;
  }
  function tick(t, dt) { if (env) env.ticks.forEach(f => f(t, dt)); }

  return { build, clear, tick };
})();

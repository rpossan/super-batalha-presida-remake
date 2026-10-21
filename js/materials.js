/* ================================================================
   Materiais procedurais (texturas sem emendas) para o chão e as fachadas:
   asfalto, grama, areia, terra rachada, concreto, granito, mata, terra queimada.
   Cada material vira um canvas 256/512 px usado como padrão de preenchimento.
   ================================================================ */
"use strict";
const Mat = (() => {
  const { css, shade, mix, rgb } = Art;
  const rnd = (a, b) => a + Math.random()*(b - a);
  const rint = n => Math.floor(Math.random()*n);
  const pick = a => a[rint(a.length)];
  const rgba = (c, a) => { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; };
  const cache = {};

  function canvas(S) { const c = document.createElement("canvas"); c.width = c.height = S; return [c, c.getContext("2d")]; }
  /* repete o desenho nas 9 vizinhanças para a textura emendar sem costura */
  function wrap(S, fn) { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) fn(dx*S, dy*S); }
  function specks(x, S, n, colors, r0, r1, a0, a1) {
    for (let i = 0; i < n; i++) {
      const px = rnd(0, S), py = rnd(0, S), r = rnd(r0, r1);
      x.fillStyle = rgba(pick(colors), rnd(a0, a1));
      wrap(S, (ox, oy) => { if (px + ox > -r*2 && px + ox < S + r*2 && py + oy > -r*2 && py + oy < S + r*2) { x.beginPath(); x.ellipse(px + ox, py + oy, r, r*rnd(.6, 1), rnd(0, 3), 0, 7); x.fill(); } });
    }
  }
  function blotches(x, S, n, colors, rmin, rmax, a) {
    for (let i = 0; i < n; i++) {
      const px = rnd(0, S), py = rnd(0, S), r = rnd(rmin, rmax), c = pick(colors);
      wrap(S, (ox, oy) => {
        const X = px + ox, Y = py + oy; if (X < -r || X > S + r || Y < -r || Y > S + r) return;
        const g = x.createRadialGradient(X, Y, 0, X, Y, r); g.addColorStop(0, rgba(c, a)); g.addColorStop(1, rgba(c, 0));
        x.fillStyle = g; x.fillRect(X - r, Y - r, r*2, r*2);
      });
    }
  }
  function polyline(x, S, pts, w, color, a) {
    x.strokeStyle = rgba(color, a); x.lineWidth = w; x.lineCap = "round"; x.lineJoin = "round";
    wrap(S, (ox, oy) => { x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px + ox, py + oy) : x.moveTo(px + ox, py + oy)); x.stroke(); });
  }
  function crack(x, S, color, a, w = 1) {
    let px = rnd(0, S), py = rnd(0, S), ang = rnd(0, 6.28); const pts = [[px, py]], n = rint(7) + 5;
    for (let i = 0; i < n; i++) { ang += rnd(-.7, .7); const l = rnd(8, 30); px += Math.cos(ang)*l; py += Math.sin(ang)*l; pts.push([px, py]);
      if (Math.random() < .25) { let bx = px, by = by0(py), ba = ang + rnd(-1.2, 1.2); const bp = [[px, py]]; for (let j = 0; j < 3; j++) { bx += Math.cos(ba)*rnd(5, 14); by += 0; by = by + Math.sin(ba)*rnd(5, 14); bp.push([bx, by]); ba += rnd(-.5, .5); } polyline(x, S, bp, w*.6, color, a*.8); } }
    polyline(x, S, pts, w, color, a);
    function by0(v) { return v; }
  }

  const MAKERS = {
    asfalto(S) {
      const [c, x] = canvas(S); x.fillStyle = "#2b2e33"; x.fillRect(0, 0, S, S);
      blotches(x, S, 40, [0x3a3e45, 0x23262a, 0x32363c], 20, 70, .55);
      specks(x, S, S*S/60, [0x5a5f67, 0x484c53, 0x6b7078, 0x1c1e22, 0x3a3d43], .4, 1.1, .2, .7);
      specks(x, S, S*S/700, [0x8a8f97, 0xa0a4ab], .5, 1.1, .35, .75);
      for (let i = 0; i < 6; i++) crack(x, S, 0x0d0e10, .55, rnd(.6, 1.3));
      blotches(x, S, 5, [0x111214], 10, 24, .4);                 // manchas de óleo
      return c;
    },
    calcada(S) {                                                  // pedra/concreto de calçada
      const [c, x] = canvas(S); x.fillStyle = "#9b9b93"; x.fillRect(0, 0, S, S);
      blotches(x, S, 30, [0xaaa9a0, 0x8a8a82, 0x9f9d93], 20, 60, .5);
      specks(x, S, S*S/90, [0x7c7b74, 0xb7b5ab, 0x6a6a64, 0xc4c2b8], .4, 1, .15, .5);
      x.strokeStyle = "rgba(60,60,55,.55)"; x.lineWidth = 1.4;
      const step = S/4; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i*step, 0); x.lineTo(i*step, S); x.stroke(); x.beginPath(); x.moveTo(0, i*step); x.lineTo(S, i*step); x.stroke(); }
      x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = 1; for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i*step + 1.4, 0); x.lineTo(i*step + 1.4, S); x.stroke(); }
      for (let i = 0; i < 3; i++) crack(x, S, 0x50504a, .35, .8);
      return c;
    },
    grama(S) {
      const [c, x] = canvas(S); x.fillStyle = "#3b7a36"; x.fillRect(0, 0, S, S);
      blotches(x, S, 60, [0x4a8c3e, 0x2f6a2c, 0x558f3a, 0x336e30], 20, 80, .5);
      const greens = [0x2c6a2a, 0x3b7f35, 0x4d9440, 0x62a548, 0x255c27, 0x7ab552];
      for (let i = 0; i < S*S/9; i++) {
        const px = rnd(0, S), py = rnd(0, S), a = -Math.PI/2 + rnd(-.7, .7), l = rnd(2.5, 6.5);
        x.strokeStyle = rgba(pick(greens), rnd(.35, .8)); x.lineWidth = rnd(.5, 1.1);
        wrap(S, (ox, oy) => { if (px + ox > -8 && px + ox < S + 8 && py + oy > -8 && py + oy < S + 8) { x.beginPath(); x.moveTo(px + ox, py + oy); x.quadraticCurveTo(px + ox + Math.cos(a)*l*.5 + rnd(-1, 1), py + oy + Math.sin(a)*l*.5, px + ox + Math.cos(a)*l, py + oy + Math.sin(a)*l); x.stroke(); } });
      }
      blotches(x, S, 8, [0x9a8a3c, 0x7c7a30], 10, 30, .18);
      specks(x, S, 60, [0xf2f2e6, 0xf2d84a], .6, 1.2, .5, .8);
      return c;
    },
    gramado(S) {                                                  // campo de futebol: grama curta e uniforme
      const [c, x] = canvas(S); x.fillStyle = "#2f8a3a"; x.fillRect(0, 0, S, S);
      blotches(x, S, 30, [0x3a9a44, 0x28803a], 20, 60, .35);
      for (let i = 0; i < S*S/5; i++) {
        const px = rnd(0, S), py = rnd(0, S), a = -Math.PI/2 + rnd(-.5, .5), l = rnd(2, 4.4);
        x.strokeStyle = rgba(pick([0x2a7d35, 0x38953f, 0x46a84c, 0x23702e]), rnd(.3, .7)); x.lineWidth = rnd(.5, .9);
        wrap(S, (ox, oy) => { x.beginPath(); x.moveTo(px + ox, py + oy); x.lineTo(px + ox + Math.cos(a)*l, py + oy + Math.sin(a)*l); x.stroke(); });
      }
      return c;
    },
    areia(S) {
      const [c, x] = canvas(S); x.fillStyle = "#dcc590"; x.fillRect(0, 0, S, S);
      blotches(x, S, 50, [0xe8d4a4, 0xcfb87f, 0xd8c08a], 20, 70, .5);
      specks(x, S, S*S/40, [0xf1e2b8, 0xc2aa72, 0xb89c64, 0xffffff, 0x8a7448], .35, 1, .2, .6);
      for (let i = 0; i < 9; i++) { const y0 = rnd(0, S), pts = []; for (let k = 0; k <= 8; k++) pts.push([k*S/8, y0 + Math.sin(k*1.3 + i)*5]); polyline(x, S, pts, rnd(.8, 1.8), 0xb89c64, .18); polyline(x, S, pts.map(([a, b]) => [a, b + 1.6]), 1, 0xfff3d2, .22); }
      return c;
    },
    terra(S) {                                                    // chão rachado do sertão
      const [c, x] = canvas(S); x.fillStyle = "#c39a5c"; x.fillRect(0, 0, S, S);
      blotches(x, S, 50, [0xd0a868, 0xb48a4e, 0xc9a062, 0xa97f46], 20, 80, .5);
      specks(x, S, S*S/70, [0x8a6234, 0xe0bd82, 0x9c7440, 0x6e4c28], .4, 1.2, .2, .6);
      for (let i = 0; i < 16; i++) crack(x, S, 0x4a3016, .75, rnd(.8, 1.9));
      for (let i = 0; i < 28; i++) crack(x, S, 0x5a3c1c, .45, .8);
      return c;
    },
    concreto(S) {                                                 // pátio de aeroporto
      const [c, x] = canvas(S); x.fillStyle = "#6a6e74"; x.fillRect(0, 0, S, S);
      blotches(x, S, 40, [0x74787e, 0x5f6368, 0x6e7278], 20, 70, .5);
      specks(x, S, S*S/70, [0x888c92, 0x50545a, 0x9a9ea4, 0x44474c], .4, 1, .15, .5);
      x.strokeStyle = "rgba(25,27,30,.65)"; x.lineWidth = 1.6; x.beginPath(); x.moveTo(0, S/2); x.lineTo(S, S/2); x.moveTo(S/2, 0); x.lineTo(S/2, S); x.stroke();
      x.strokeStyle = "rgba(255,255,255,.1)"; x.lineWidth = 1; x.beginPath(); x.moveTo(0, S/2 + 1.8); x.lineTo(S, S/2 + 1.8); x.moveTo(S/2 + 1.8, 0); x.lineTo(S/2 + 1.8, S); x.stroke();
      blotches(x, S, 6, [0x15171a, 0x3a3226], 12, 30, .3);       // óleo e borracha
      for (let i = 0; i < 4; i++) crack(x, S, 0x1a1c1f, .45, .8);
      return c;
    },
    granito(S) {                                                  // praça dos Três Poderes
      const [c, x] = canvas(S); x.fillStyle = "#a39c88"; x.fillRect(0, 0, S, S);
      blotches(x, S, 30, [0xb1aa96, 0x948d79, 0xa8a18d], 20, 60, .45);
      specks(x, S, S*S/50, [0x7c7666, 0xc2bba6, 0x6a6556, 0xd8d1bb], .4, 1, .2, .6);
      x.strokeStyle = "rgba(70,65,52,.6)"; x.lineWidth = 1.6; const st = S/2; for (let i = 0; i <= 2; i++) { x.beginPath(); x.moveTo(i*st, 0); x.lineTo(i*st, S); x.stroke(); x.beginPath(); x.moveTo(0, i*st); x.lineTo(S, i*st); x.stroke(); }
      return c;
    },
    mata(S) {                                                     // chão de floresta
      const [c, x] = canvas(S); x.fillStyle = "#3b3a22"; x.fillRect(0, 0, S, S);
      blotches(x, S, 70, [0x4a4a26, 0x2c3a1c, 0x5a4a2a, 0x364a22, 0x26301a], 20, 80, .6);
      for (let i = 0; i < S*S/70; i++) {                         // folhas caídas
        const px = rnd(0, S), py = rnd(0, S), r = rnd(2, 5), c0 = pick([0x6a5a2a, 0x7a5a2a, 0x4a3a1a, 0x5a6a2a, 0x8a6a2a, 0x3a4a1a]);
        x.fillStyle = rgba(c0, rnd(.45, .9)); wrap(S, (ox, oy) => { x.beginPath(); x.ellipse(px + ox, py + oy, r, r*.45, rnd(0, 3), 0, 7); x.fill(); });
      }
      for (let i = 0; i < S*S/200; i++) { const px = rnd(0, S), py = rnd(0, S), a = -Math.PI/2 + rnd(-.9, .9), l = rnd(3, 8); x.strokeStyle = rgba(pick([0x3f8a34, 0x2f7a2c, 0x5aa040]), .6); x.lineWidth = .8; wrap(S, (ox, oy) => { x.beginPath(); x.moveTo(px + ox, py + oy); x.quadraticCurveTo(px + ox + Math.cos(a)*l*.6, py + oy + Math.sin(a)*l*.6 - 2, px + ox + Math.cos(a)*l, py + oy + Math.sin(a)*l); x.stroke(); }); }
      for (let i = 0; i < 5; i++) crack(x, S, 0x1c160c, .5, rnd(1.5, 3));       // raízes e gravetos
      return c;
    },
    queimado(S) {                                                 // terra arrasada do apocalipse
      const [c, x] = canvas(S); x.fillStyle = "#2a231e"; x.fillRect(0, 0, S, S);
      blotches(x, S, 60, [0x362c25, 0x1c1713, 0x3e332a, 0x151210], 20, 80, .6);
      specks(x, S, S*S/50, [0x4a3e34, 0x0e0c0a, 0x5a4a3c, 0x7a6a58], .4, 1.2, .2, .6);
      for (let i = 0; i < 10; i++) crack(x, S, 0x0a0806, .8, rnd(1, 2.4));
      for (let i = 0; i < 6; i++) crack(x, S, 0xc4500e, .28, .8);              // brasas nas fendas
      blotches(x, S, 14, [0x0c0a08, 0x8a8478], 8, 24, .25);
      return c;
    },
  };

  function tile(name, S = 256) {
    const k = name + S;
    if (!cache[k]) cache[k] = MAKERS[name](S);
    return cache[k];
  }
  return { tile, specks, blotches, crack, polyline, wrap, rnd, pick, rgba };
})();

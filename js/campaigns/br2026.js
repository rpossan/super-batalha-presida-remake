/* ================================================================
   CAMPANHA 1 · ELEIÇÕES BRASIL 2026
   Um pacote de campanha é um arquivo só: lados, personagens, cenários (com o desenho), fases, itens, skills,
   frases e final. O motor do jogo é o mesmo para todas as campanhas. Veja CAMPANHAS.md.
   Para ADICIONAR UM CENÁRIO neste pacote: acrescente a função em SCENERY, uma entrada em scenarios
   e (opcional) uma fase em levels. Para um personagem: acrescente em chars e em tracks.
   ================================================================ */
"use strict";
(() => {
/* ---------------- desenho dos cenários (E = efeitos, g = chão, K = kit de peças) ---------------- */
const SCENERY = {
  paulista: (E, g, K) => {
    const { css, QS, rnd, rint, pick, rgba, P, make, put, piece, tree, palm, deadTree, cactus, bush, car, lamp, building } = K;
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
  },
  rio: (E, g, K) => {
    const { css, QS, rnd, rint, pick, rgba, P, make, put, piece, tree, palm, deadTree, cactus, bush, car, lamp, building } = K;
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
  },
  poa: (E, g, K) => {
    const { css, QS, rnd, rint, pick, rgba, P, make, put, piece, tree, palm, deadTree, cactus, bush, car, lamp, building } = K;
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
  },
  sertao: (E, g, K) => {
    const { css, QS, rnd, rint, pick, rgba, P, make, put, piece, tree, palm, deadTree, cactus, bush, car, lamp, building } = K;
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
  },
  amazonia: (E, g, K) => {
    const { css, QS, rnd, rint, pick, rgba, P, make, put, piece, tree, palm, deadTree, cactus, bush, car, lamp, building } = K;
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
  },
  camboriu: (E, g, K) => {
    const { css, QS, rnd, rint, pick, rgba, P, make, put, piece, tree, palm, deadTree, cactus, bush, car, lamp, building } = K;
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
  },
  brasilia: (E, g, K) => {
    const { css, QS, rnd, rint, pick, rgba, P, make, put, piece, tree, palm, deadTree, cactus, bush, car, lamp, building } = K;
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
  },
  apocalipse: (E, g, K) => {
    const { css, QS, rnd, rint, pick, rgba, P, make, put, piece, tree, palm, deadTree, cactus, bush, car, lamp, building } = K;
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
  },
};

SPBCampaigns.register({
  id:"br2026", world:1, status:"ready", emoji:"🇧🇷",
  name:"Eleições Brasil 2026", shortName:"Brasil 2026",
  tagline:"Eleições 2026 em modo campanha: escolha seu lado, vença uma fase por vez e chegue ao chefão final.",
  unlock:{ start:true },
  theme:{ accent:"#ffdf00", bg:"linear-gradient(135deg,#0b5d2a,#143a7a)" },
  sideStep:"1 · Escolha o seu lado",

  /* ---- lados: cores, poderes e bandeira ---- */
  sides:{
    flavio:{ name:"Flávio Bolsonaro", short:"Flávio", party:"PL", main:0x009c3b, alt:0xffdf00,
              cross:"Buzinaço", ultra:"Motociata", ultraDesc:"linha inteira", ultraMode:"row",
              skin:0xf2c9a5, hair:0x2b1d14, beard:false, shirts:[0x009c3b,0xffdf00,0x009c3b,0xffffff],
              textColor:"#ffdf00", bossPower:"heal", followers:{ one:"bolsonarista", many:"Bolsonaristas" },
              tag:"verde e amarelo", flag:{ builtin:"flavio" } },
    lula:   { name:"Lula Molusco", short:"Molusco", party:"PT", main:0xd7191c, alt:0xffdf00,
              cross:"Comício", ultra:"Caravana", ultraDesc:"coluna inteira", ultraMode:"col",
              skin:0xe8b48c, hair:0xf2f2f2, beard:true, shirts:[0xd7191c,0xffffff,0xd7191c,0xb01015],
              textColor:"#ffffff", bossPower:"explode", followers:{ one:"petista", many:"Petistas" },
              tag:"vermelho e estrela", flag:{ builtin:"lula" } },
  },

  /* ---- personagens (o líder de cada lado usa a mesma chave do lado) e adversários por fase ---- */
  chars: {
    flavio:  { name:"Flávio Bolsonaro",    short:"Flávio",   party:"PL",           camp:"flavio", skin:0xf2c9a5, hair:0x2b1d14, hairStyle:"short" },
    lula:    { name:"Lula Molusco",                short:"Molusco",     party:"PT",           camp:"lula",   skin:0xe8b48c, hair:0xf2f2f2, hairStyle:"short", beard:true, age:.9 },
    boulos:  { name:"Guilherme Bolos",    short:"Bolos",   party:"PSOL",         camp:"lula",   skin:0xe0ac82, hair:0x1d1510, hairStyle:"short", beard:true, beardColor:0x3a2a20 },
    gleisi:  { name:"G. Rofman",     short:"Rofman",   party:"PT",           camp:"lula",   skin:0xf2c9a5, hair:0x6b4a2a, hairStyle:"bob", fem:true, age:.3 },
    moraes:  { name:"Alexandre sem Moral", short:"Sem Moral",   party:"STF",          camp:"lula",   skin:0xe8b48c, hair:0x222222, hairStyle:"bald", glasses:true, age:.4 },
    nikolas: { name:"Niko Ferrado",    short:"Niko",  party:"PL",           camp:"flavio", skin:0xf2c9a5, hair:0x2b1d14, hairStyle:"short" },
    tarcisio:{ name:"Tarcizinho", short:"Tarcizinho", party:"Republicanos", camp:"flavio", skin:0xe8b48c, hair:0x2b2018, hairStyle:"short", glasses:true, age:.3 },
    michelle:{ name:"Michela",  short:"Michela", party:"PL",           camp:"flavio", skin:0xf2c9a5, hair:0xd9b36a, hairStyle:"long", fem:true, age:.2 },
    felipe:  { name:"Felipe Feto",         short:"Feto",   party:"Influencer",   camp:"lula",   skin:0xf2c9a5, hair:0x1d1510, hairStyle:"short" },
    hang:    { name:"Véio da Avon",        short:"Véio",     party:"Empresário",   camp:"flavio", skin:0xf2c9a5, hair:0xdcdcdc, hairStyle:"short", age:.85 },
    marina:  { name:"Marina Sílvia",        short:"Sílvia",   party:"Rede",         camp:"lula",   skin:0xe0ac82, hair:0x3a2a1a, hairStyle:"bob", fem:true, age:.5 },
    salles:  { name:"Ricardo Venddas",      short:"Venddas",   party:"PL",           camp:"flavio", skin:0xf2c9a5, hair:0x2b1d14, hairStyle:"short" },
    anitta:  { name:"Pablo Vital",              short:"Vital",   party:"Cantora",      camp:"lula",   skin:0xe0ac82, hair:0x5a2f1c, hairStyle:"long" },
    ditador: { name:"Generalíssimo Tirano", short:"Tirano", party:"Regime", camp:"regime", skin:0xd9b08c, hair:0x151515, hairStyle:"bald", military:true, glasses:true, age:.5 },
    carlos:  { name:"Carlucho",    short:"Carlucho",   party:"PL",           camp:"flavio", skin:0xf2c9a5, hair:0x2b1d14, hairStyle:"short", beard:true, beardColor:0x3a2a20, age:.1 },
  },
  /* adversários por fase, conforme o lado escolhido (o chefão é o líder do outro lado; o último é o vilão do NG+) */
  tracks: {
    flavio: ["boulos","gleisi","moraes","felipe","marina","anitta","lula","ditador"],
    lula:   ["nikolas","tarcisio","michelle","hang","salles","carlos","flavio","ditador"],
  },

  /* ---- torcida: grupos de cada arena (nome e tamanho) ---- */
  fleet:[
    { name:"Trio Elétrico",       len:5 },
    { name:"Bloco de Rua",        len:4 },
    { name:"Caravana",            len:3 },
    { name:"Galera do Churrasco", len:3 },
    { name:"Panfleteiros",        len:2 },
  ],

  /* ---- fases: cenário, dificuldade, torcida adversária (índices de fleet), nível da IA e perigo ---- */
  levels: [
    { scn:"paulista", diff:"Fácil",   ai:1, def:[4,3,2] },
    { scn:"poa",      diff:"Médio",   ai:2, def:[1,2,3,4] },
    { scn:"rio",      diff:"Difícil", ai:3, def:[0,1,2,4], hazard:"bala" },
    { scn:"sertao",   diff:"Muito difícil", ai:3, def:[0,1,2,3], hazard:"fogo" },
    { scn:"amazonia", diff:"Extremo", ai:3, def:[0,1,2,3,4], hazard:"flechas" },
    { scn:"camboriu", diff:"Pré-chefão", ai:3, def:[0,1,2,3,4], calm:true },
    { scn:"brasilia", diff:"CHEFÃO",  ai:4, def:[0,1,2,3,4], boss:true },
    { scn:"apocalipse", diff:"NG+ · Extremo", ai:4, hazard:"bombas", ng:true, cpuBonus:true },
  ],

  /* ---- modo NG+ (opcional): vilão, lado e exército ---- */
  ng:{
    side:{ key:"regime", name:"Regime", short:"Tirano", party:"Regime", main:0x39402a, alt:0xc9c27a,
            cross:"Bombardeio", ultra:"Blitz", ultraDesc:"linha inteira", ultraMode:"row", skin:0xd9b08c, hair:0x151515, shirts:[0x4a5230,0x39402a] },
    defs:[
      { name:"Horda de Zumbis",     len:5, kind:"zombie"  }, { name:"Pelotão de Soldados", len:4, kind:"soldier" },
      { name:"Monstros Mutantes",   len:3, kind:"monster" }, { name:"Esquadrão Blindado",  len:3, kind:"soldier" },
      { name:"Zumbis Rastejantes",  len:2, kind:"zombie"  }, { name:"Besta do Apocalipse", len:3, kind:"monster" }, { name:"Legião Blindada", len:2, kind:"soldier" },
    ],
    winTitle:"SOBREVIVENTE DO APOCALIPSE!",
    winText:"{boss} caiu e a democracia sobreviveu! Você zerou o NG+ em {rounds}. ☢️🏆",
    unlockNote:"☢️ Mas a paz não durou... um ditador surge das cinzas. O modo <b>NG+: Apocalipse</b> foi desbloqueado no menu.",
  },

  /* ---- cenários: metadados + música + desenho (veja SCENERY acima) ---- */
  scenarios: [
    { id:"paulista", name:"Avenida Paulista", short:"Av. Paulista", of:"da Avenida Paulista", emoji:"🏙️", city:"São Paulo · SP",
      thumb:"linear-gradient(170deg,#6a8fc7,#2b3a55 70%)", sky:0x8fc0ef, fog:[0x8fc0ef,60,150], tiles:[0x484e58,0x3d434c],
      music:"urban", ground:0x2b2e33, scenery:SCENERY.paulista },
    { id:"rio", name:"Cristo Redentor", short:"Cristo Redentor", of:"do Cristo Redentor", emoji:"⛰️", city:"Rio de Janeiro · RJ",
      thumb:"linear-gradient(170deg,#7fd0ff,#3d9a4d 75%)", sky:0x86cdfa, fog:[0xcfeaff,70,190], tiles:[0x2a5f35,0x214e2b],
      music:"samba", ground:0x7f7a66, scenery:SCENERY.rio },
    { id:"poa", name:"Aeroporto Salgado Filho", short:"Aeroporto POA", of:"do Aeroporto de Porto Alegre", emoji:"✈️", city:"Porto Alegre · RS",
      thumb:"linear-gradient(170deg,#b5c9da,#4a4f57 75%)", sky:0xa8c0d4, fog:[0xbccbd8,60,160], tiles:[0x666a70,0x5a5e64],
      music:"milonga", ground:0x6a6e74, scenery:SCENERY.poa },
    { id:"sertao", name:"Sertão Nordestino", short:"Sertão", of:"do Sertão", emoji:"🌵", city:"Nordeste · Caatinga",
      thumb:"linear-gradient(170deg,#ffd27a,#c9893a 75%)", sky:0xf7c97a, fog:[0xf6d08c,55,150], tiles:[0xb8925a,0xa98349],
      music:"baiao", ground:0xc39a5c, scenery:SCENERY.sertao },
    { id:"amazonia", name:"Floresta Amazônica", short:"Amazônia", of:"da Floresta Amazônica", emoji:"🌴", city:"Amazônia · Rio Negro",
      thumb:"linear-gradient(170deg,#9fe0a8,#1f5a2c 75%)", sky:0xa6dcc0, fog:[0xa9d9b8,36,115], tiles:[0x5f7d3b,0x516e31],
      music:"tribal", ground:0x3b3a22, scenery:SCENERY.amazonia },
    { id:"camboriu", name:"Balneário Camboriú", short:"Camboriú", of:"de Balneário Camboriú", emoji:"🏖️", city:"Santa Catarina · SC",
      thumb:"linear-gradient(170deg,#7fd0ff,#f2dca6 70%)", sky:0x79c8ff, fog:[0xc3e7ff,75,210], tiles:[0xcdb27a,0xbfa26a],
      music:"tropical", ground:0xdcc590, scenery:SCENERY.camboriu },
    { id:"brasilia", name:"Brasília · Praça dos Três Poderes", short:"Brasília", of:"da Praça dos Três Poderes", emoji:"🏛️", city:"Brasília · DF",
      thumb:"linear-gradient(170deg,#ff9f6a,#e8d9b8 70%)", sky:0xff9f6a, fog:[0xffc79a,60,200], tiles:[0x8a836d,0x7b745f],
      music:"solemn", ground:0xa39c88, scenery:SCENERY.brasilia },
    { id:"apocalipse", name:"Apocalipse · NG+", short:"Apocalipse", of:"do Apocalipse", emoji:"☢️", city:"NG+ · O fim da democracia",
      thumb:"linear-gradient(170deg,#ff6a2a,#2a0d08 75%)", sky:0x3a130c, fog:[0x4a1a10,38,150], tiles:[0x4f453b,0x41382f],
      music:"industrial", ground:0x2a231e, scenery:SCENERY.apocalipse },
  ],

  /* ---- skills: nome, ícone, preço e níveis exigidos (os efeitos vêm do motor; {v}, {a} e {b} são os valores do nível) ---- */
  skills:{
    folego:      { icon:"⚡",  name:"Fôlego de campanha",    price:3000,  req:[1,4,8],   desc:"Você começa cada fase com {v} de energia." },
    instituto:   { icon:"📊", name:"Instituto de pesquisa", price:4000,  req:[2,5,9],   desc:"A Pesquisa custa 1 de energia e revela {a}×{b} casas." },
    guardachuva: { icon:"☂️", name:"Guarda-chuva",          price:6000,  req:[3,6,10],  desc:"{v} torcedores seus começam cada fase protegidos: o adversário gasta um tiro para quebrar o guarda-chuva antes de atingi-los." },
    supertiro:   { icon:"💥", name:"Super tiro",            price:8000,  req:[5,8,12],  desc:"O tiro comum atinge 4 casas (quadrado 2×2), até {v} vezes por fase." },
    empolgacao:  { icon:"🎉", name:"Empolgação",            price:10000, req:[7,10,14], desc:"Ao acertar um alvo, você ganha um turno extra (1 por turno), até {v} vezes por fase." },
  },

  /* ---- itens: nome, descrição, ícone (SVG), preço e chance de cair no saque ---- */
  items: {
      revive:{ name:"Remédio", desc:"revive 1 torcedor caído", key:"5", price:400, weight:0.4,
        svg:`<svg viewBox="0 0 40 40"><rect x="11" y="4" width="18" height="7" rx="2" fill="#d9dde6" stroke="#1a1a1a" stroke-width="2"/><rect x="7" y="10" width="26" height="27" rx="5" fill="#fff" stroke="#1a1a1a" stroke-width="2.4"/><path d="M17 17h6v5h5v6h-5v5h-6v-5h-5v-6h5z" fill="#e0242a"/></svg>` },
      furia:{ name:"Energético", desc:"+2 turnos seguidos", key:"6", price:1000, weight:0.14,
        svg:`<svg viewBox="0 0 40 40"><rect x="9" y="5" width="22" height="31" rx="5" fill="url(#gCan)" stroke="#1a1a1a" stroke-width="2.4"/><rect x="9" y="5" width="22" height="5" rx="2" fill="#c9ced8"/><path d="M22 12l-8 12h6l-2 9 9-13h-6z" fill="#ffe14a" stroke="#1a1a1a" stroke-width="1.4" stroke-linejoin="round"/><defs><linearGradient id="gCan" x1="0" x2="1"><stop offset="0" stop-color="#2f7bff"/><stop offset="1" stop-color="#143c9c"/></linearGradient></defs></svg>` },
      reforco:{ name:"Reforço", desc:"invoca 1 torcedor", key:"7", price:650, weight:0.28,
        svg:`<svg viewBox="0 0 40 40"><path d="M6 15h8l14-8v26l-14-8H6z" fill="#ffd23a" stroke="#1a1a1a" stroke-width="2.4" stroke-linejoin="round"/><rect x="9" y="26" width="6" height="9" rx="2" fill="#555" stroke="#1a1a1a" stroke-width="2"/><path d="M32 14q5 6 0 12M35 10q9 10 0 20" stroke="#fff" stroke-width="2.6" fill="none" stroke-linecap="round"/></svg>` },
      breja:{ name:"Breja", desc:"+1 uso de Super tiro e Empolgação", key:"8", price:500, weight:0.14,
        svg:`<svg viewBox="0 0 40 40"><path d="M9 14h17v21a3 3 0 0 1-3 3H12a3 3 0 0 1-3-3z" fill="url(#gBr)" stroke="#1a1a1a" stroke-width="2.4" stroke-linejoin="round"/><path d="M26 18h5a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-5" fill="none" stroke="#1a1a1a" stroke-width="2.4"/><path d="M8 14q-2-7 5-8 2-4 7-2 4-1 6 3 4 1 2 7z" fill="#fff" stroke="#1a1a1a" stroke-width="2.2" stroke-linejoin="round"/><path d="M14 20v13M19 20v13" stroke="#fff6" stroke-width="2" stroke-linecap="round"/><defs><linearGradient id="gBr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffc83a"/><stop offset="1" stop-color="#d98a0a"/></linearGradient></defs></svg>` },
      plano:{ name:"Plano de Governo", desc:"ganha 1 ponto de skill", key:"9", price:2500, weight:0.04,
        svg:`<svg viewBox="0 0 40 40"><rect x="7" y="4" width="26" height="33" rx="3" fill="#f6f1de" stroke="#1a1a1a" stroke-width="2.4"/><rect x="14" y="2" width="12" height="6" rx="2" fill="#8a8f9c" stroke="#1a1a1a" stroke-width="2"/><path d="M12 15h16M12 20h16M12 25h10" stroke="#8b8573" stroke-width="2" stroke-linecap="round"/><path d="M28 24l2.2 4.4 4.8.7-3.5 3.4.9 4.8-4.4-2.3-4.3 2.3.8-4.8-3.4-3.4 4.8-.7z" fill="#ffd23a" stroke="#1a1a1a" stroke-width="1.6" stroke-linejoin="round"/></svg>` }
    },

  /* ---- frases de reação e objetos arremessados no tiro normal ---- */
  phrases: {
    hit:["Na mosca!","Arribaaaa!","Viva a democracia!","Aprovado por unanimidade!","Maioria absoluta!","Ganhou o debate!",
      "Voto certeiro!","A urna confirmou!","Direto no palanque!","Que comício!","A pesquisa não mentiu!","Vai pro segundo turno!",
      "Eleito no primeiro turno!","Esse é do povo!","Boca de urna certeira!","Mandou bem na campanha!",
      "Acertou em cheio!","Esse voto é nosso!","Contagem confirmada!","Urna eletrônica aprova!","Santinho certeiro!","Subiu nas pesquisas!","Debate ganho!","Discurso afiado!","Candidato do povo!","Palanque cheio!","Carreata na veia!","Apoio garantido!","Aliança fechada!","Papo reto!","Foi cirúrgico!","Quórum batido!","Pesquisa de boca de urna!","Margem de erro: zero!","Voto consciente!","Veio de lavada!","Mandou a real!","Recebeu o apoio!","Direto no alvo, parlamentar!","A militância vibra!","Tá no horário eleitoral!","Mira de campanha!"],
      multi:["Lavada nas urnas!","Maioria esmagadora!","Virada histórica!","Showmício de acertos!","Chapa completa!",
      "Varreu a convenção!","Combo no horário eleitoral!","Aprovado em todas as seções!",
      "Arrasou na apuração!","Votação histórica!","Maioria qualificada!","Três turnos num só!","Tsunami de votos!","Chuva de apoio!","Apuração relâmpago!","Sessão encerrada com goleada!","Virou o placar!","Rodada de aplausos!","Comitê em festa!","Fechou a coligação!"],
      miss:["Não foi desta vez!","Por pouco!","Errrouuuuu!","Voto nulo!","Foi pra urna errada!","Abstenção!",
      "Projeto arquivado!","Vetado!","Pediram vista!","Cadê o quórum?","Sumiu na tramitação!","Passou longe da tribuna!",
      "Caiu no orçamento secreto!","Mira de CPI!","Fake news: não acertou ninguém!",
      "Quase, candidato!","Ficou no quase!","Foi pro segundo turno... do erro!","Voto em branco!","Urna vazia!","Tentou, mas não rolou!","Discurso sem plateia!","Santinho no lixo!","Passou batido!","Foi de arrasto!","Sem quórum pra isso!","Tá difícil, hein?","Desistiu do mandato!","Mandato cassado!","Errou o endereço do comício!","Caiu na tramitação!","Emenda rejeitada!","Rejeitado em plenário!","Foi pro arquivo!","Pesquisa errou a margem!","O eleitor mudou de ideia!","Caiu na pegadinha!","Cadê o voto?","Nem fez cócegas!","Tropeçou no palanque!","Aposta perdida!","Ixi, errou!","Nem chegou perto!","Boato desmentido!","Erro de cálculo eleitoral!"],
      sunk:["TORCIDA DISPERSADA!","COMÍCIO ESVAZIADO!","FOI TUDO PRA CASA!","CABO ELEITORAL DESISTIU!","CARREATA DISSOLVIDA!",
      "PELOTÃO DE APOIADORES DISPERSO!","MILITÂNCIA EM RETIRADA!","ATO ENCERRADO!","BANDEIRAS RECOLHIDAS!","CORREU TUDO PRO ÔNIBUS!","GRUPO DESMOBILIZADO!"],
    },
  throws: [
    { id:"cone",     indef:"um cone",      def:"o cone",      emoji:"🚧", dur:1.0,  H:3.3 },
    { id:"tomate",   indef:"um tomate",    def:"o tomate",    emoji:"🍅", dur:.9,   H:3.0 },
    { id:"bandeira", indef:"uma bandeira", def:"a bandeira",  emoji:"🚩", dur:1.1,  H:2.4 },
    { id:"cavalete", indef:"um cavalete",  def:"o cavalete",  emoji:"🚧", dur:1.25, H:3.9 },
    { id:"chinelo",  indef:"um chinelo",   def:"o chinelo",   emoji:"🩴", dur:.8,   H:2.2 },
    { id:"pedra",    indef:"uma pedra",    def:"a pedra",     emoji:"🪨", dur:.65,  H:1.8 },
    { id:"ovo",      indef:"um ovo",       def:"o ovo",       emoji:"🥚", dur:1.0,  H:3.4 },
  ],

  /* ---- final da campanha (ao vencer o chefão) ---- */
  ending:{
    fx: {
      lula:   [["#ff3b30","#ffb3a8"], ["#ffd23a","#fff3b0"], ["#ffffff","#cfe3ff"], ["#ff5ea8","#ffd0e6"]],
      flavio: [["#18c24a","#b4f7c6"], ["#ffd23a","#fff3b0"], ["#3a86ff","#c4dcff"], ["#ffffff","#e6ffe9"]],
    },
    chapters(side, ch) { return ["Brasília · Praça dos Três Poderes", "O último adversário caiu.", "A torcida inteira vai à loucura…", "E o céu do Planalto se acende.", "Hoje, o Brasil escolheu o seu presidente."]; },
    posse(side, ch) {
      const head = [{ big:"Brasília, 1º de janeiro de 2027.", small:"Dia de posse no Palácio do Planalto" }];
      const mid = side === "lula"
        ? [{ big:`${ch.name} sobe a rampa…`, small:"a multidão toma a Esplanada" }, { big:"…de faixa presidencial no peito.", small:"o povo canta, chora e aplaude" }]
        : [{ big:`${ch.short} chega ao Planalto…`, small:"a multidão toma a Esplanada" }, { big:"…e abraça o pai, Jair Bolsonaro, na rampa.", small:"o povo canta, chora e aplaude" }];
      return head.concat(mid, [{ big:`${ch.name} foi eleito presidente do Brasil!`, small:"" }]);
    },
    /* desenho da cena da posse (SVG 800×500). K = peças de desenho do motor */
    art(side, K) {
  let body = K.artBackground() + K.artPetals();
  if (side === "lula") {
    body += K.artFlag(58, 420, "lula", 1.05) + K.artFlag(730, 450, "lula", .95);
    const lula = K.artPerson({ x:318, y:386, s:1.12, step:true, walk:true, walkCount:14, hair:"#f4f4fa", hairHi:"#fff", hairSh:"#c8ccd8", brow:"#d0d4e0", beard:"#f4f4fa", skin:"#f4cfae", skinShade:"#e0aa84", sash:true, arm:"wave", happyEyes:false });
    // sobe a rampa andando (de baixo-esquerda até o ponto final), com balanço do passo
    body += `<g><animateTransform attributeName="transform" type="translate" from="-340 78" to="0 0" dur="9.8s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".25 .55 .3 1"/>`
          + `<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -7;0 0" dur=".7s" repeatCount="14"/>${lula}</g></g>`;
    body += K.artSparkles([[430,150,1.1],[560,110,.8],[250,120,.7],[640,200,1],[190,300,.8],[520,60,.7]]);
  } else {
    body += K.artFlag(58, 420, "flavio", 1.05) + K.artFlag(730, 450, "flavio", .95);
    const slide = (from, p) => `<g><animateTransform attributeName="transform" type="translate" from="${from} 0" to="0 0" dur="5s" fill="freeze" calcMode="spline" keyTimes="0;1" keySplines=".25 .6 .3 1"/>${p}</g>`;
    const jair = K.artPerson({ x:462, y:342, s:1.02, tilt:5, suitGrad:"url(#gSuit2)", tie:"#ffd400", hair:"#9a9aa6", hairHi:"#e2e2ea", hairSh:"#6b6b78", hairStyle:"side", skin:"#f6d2b4", skinShade:"#e4ad8a", arm:"none", happyEyes:true });
    const flavio = K.artPerson({ x:548, y:342, s:1.06, tilt:-5, tie:"#0a9d3f", hair:"#3a2a22", hairHi:"#8a6a58", hairSh:"#22170f", skin:"#f8d6b8", skinShade:"#e8b390", sash:true, arm:"none", happyEyes:true });
    const hug = (d, c) => `<path d="${d}" stroke="#101830" stroke-width="29" stroke-linecap="round" fill="none"/><path d="${d}" stroke="${c}" stroke-width="22" stroke-linecap="round" fill="none"/><path d="${d}" stroke="#ffffff" stroke-width="4" stroke-linecap="round" fill="none" opacity=".25" transform="translate(0 -4)"/>`;
    const arms = `<g opacity="0"><animate attributeName="opacity" from="0" to="1" begin="4.6s" dur=".8s" fill="freeze"/>`
      + hug("M498 210 Q542 190 580 236", "#2a3552") + `<circle cx="582" cy="240" r="12" fill="#f8d6b8" ${K.ART_STROKE}/>`
      + hug("M516 210 Q472 190 436 236", "#26335f") + `<circle cx="434" cy="240" r="12" fill="#f6d2b4" ${K.ART_STROKE}/></g>`;
    // chegam um de cada lado, se abraçam e balançam de leve
    body += `<g><animateTransform attributeName="transform" type="rotate" values="-1.4 505 342;1.4 505 342;-1.4 505 342" dur="3.2s" begin="5.6s" repeatCount="indefinite"/>`
          + slide(-210, jair) + slide(210, flavio) + arms + `</g>`;
    const heart = (x, y, s, c, i) => `<g opacity="0"><animateTransform attributeName="transform" type="translate" values="0 40;0 -34" dur="3s" begin="${5+i*.9}s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;1;0" dur="3s" begin="${5+i*.9}s" repeatCount="indefinite"/>${K.artHeart(x, y, s, c)}</g>`;
    body += heart(500, 92, 1.9, "#ff4d73", 0) + heart(566, 70, 1.3, "#ff7a9a", 1) + heart(446, 62, 1.1, "#ff5a7e", 2) + heart(520, 120, 1, "#ff93ad", 3);
    body += K.artSparkles([[420,130,1],[600,120,.9],[360,200,.7],[660,210,1],[250,150,.8],[300,90,.7]]);
  }
      return body;
    },
  },
});
})();

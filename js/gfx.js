/* ================================================================
   GFX: camada visual em Phaser 4 (isométrica 2.5D).
   - Mundo lógico em unidades de casa (x, y para cima, z), igual ao jogo original.
   - Projeção isométrica 2:1: x vai para a direita-cima, z para a direita-baixo.
   - Personagens e objetos são sprites (arte procedural em art.js) ordenados por profundidade.
   ================================================================ */
"use strict";
const GFX = (() => {
  const { HW, HH, HY, Q } = Art;
  const D_GROUND = -100000, D_BOARD = -50000, D_FLAT = -40000, D_SORT = 0, D_FX = 60000, D_HINT = 90000;
  const SQ2 = Math.SQRT2;

  let scene = null, game = null, cam = null, cfg = null, ready = false;
  const nodes = new Set();
  const texInfo = {};                              // key -> descritor da arte (origem, tamanho)

  /* ---------- projeção ---------- */
  const P = (x, y, z) => [(x + z)*HW, (z - x)*HH - y*HY];
  const unproj = (sx, sy) => { const u = sx/HW, v = sy/HH; return { x:(u - v)/2, z:(u + v)/2 }; };   // chão (y=0)
  const depthOf = (x, z) => (z - x)*HH;
  const rand = n => Math.floor(Math.random()*n);

  /* ---------- texturas ---------- */
  function tex(key, make) {
    if (!texInfo[key]) {
      const d = make();
      scene.textures.addCanvas(key, d.c);
      texInfo[key] = d;
    }
    return texInfo[key];
  }
  /* imagem posicionada pelo ponto de apoio da arte; w = largura lógica desejada (opcional) */
  function img(key, w) {
    const d = texInfo[key];
    const im = scene.add.image(0, 0, key).setOrigin(d.ox/d.w, d.oy/d.h);
    im.setScale(w ? w/(d.w*Q) : 1/Q);
    return im;
  }
  const flagKey = k => (tex("flag_" + k, () => Art.flag(k)), "flag_" + k);

  /* ================================================================
     Nó: objeto do mundo com posição (x,y,z), escala, rotação e profundidade automática
     ================================================================ */
  class Node {
    constructor(view, layer) {
      this.v = view; this.layer = layer || "sort"; this.bx = view.scaleX; this.by = view.scaleY;
      this.x = 0; this.y = 0; this.z = 0; this.sc = 1; this.rot = 0; this.fx = 1; this.fy = 1;
      this.alpha = 1; this.visible = true; this.bias = 0; this.k = 1; this.u = {};
      nodes.add(this); this.sync();
    }
    at(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
    sync() {
      const v = this.v, p = P(this.x, this.y, this.z);
      v.setPosition(p[0], p[1]);
      v.setScale(this.bx*this.sc*this.k*this.fx, this.by*this.sc*this.k*this.fy);
      v.setRotation(this.rot);
      v.setAlpha(this.alpha);
      v.setVisible(this.visible);
      if (this.layer === "sort") v.setDepth(D_SORT + depthOf(this.x, this.z) + this.bias + this.y*.01);
      else if (this.layer === "fx") v.setDepth(D_FX + this.bias);
      else v.setDepth(D_FLAT + this.bias);
    }
    destroy() { nodes.delete(this); this.v.destroy(); }
  }
  function syncAll() { nodes.forEach(n => n.sync()); }
  function drop(n) { if (n) n.destroy(); }

  /* ================================================================
     Torcedores
     ================================================================ */
  const SKINS = [0xf2c9a5, 0xe0ac82, 0xc68a62, 0x8d5a3b, 0x5e3a24];
  const HAIRS = [0x2b1d14, 0x151515, 0x6b4a2a, 0xd9b36a, 0x3a2a1a];
  function makeFan(sideKey, shirt, skin, withCap) {
    const s = cfg.SIDES[sideKey];
    shirt = shirt ?? s.shirts[rand(s.shirts.length)];
    skin = skin ?? SKINS[rand(SKINS.length)];
    withCap = withCap ?? (Math.random() < .6);
    const hair = HAIRS[rand(HAIRS.length)];
    const trim = shirt === s.alt ? s.main : s.alt;
    const bk = ["fan", sideKey, shirt, skin, withCap ? 1 : 0, withCap ? 0 : hair].join("_");
    tex(bk, () => Art.fanBody({ shirt, skin, trim, cap:withCap, capColor:s.main, hair }));
    const ak = "fanarm_" + shirt + "_" + skin;
    tex(ak, () => Art.fanArm({ shirt, skin }));
    tex("shadow", () => Art.shadow());
    const c = scene.add.container(0, 0);
    const sh = img("shadow", 34); sh.setAlpha(.9);
    const body = img(bk);
    const arm = scene.add.container(12, -25);
    const armImg = img(ak);
    const fl = img(flagKey(sideKey), 21); fl.setOrigin(0, .1); fl.setPosition(3.6, -44);
    arm.add([armImg, fl]);
    c.add([sh, body, arm]);
    const n = new Node(c); n.k = 1.3;
    n.u = { kind:"fan", arm, flag:fl, shadow:sh, phase:Math.random()*6, fall:-1, dir:Math.random() < .5 ? 1 : -1, hop:0 };
    return n;
  }
  function makeUnit(kind) {
    const k = "unit_" + kind;
    tex(k, () => Art.unitBody(kind));
    tex("shadow", () => Art.shadow());
    const c = scene.add.container(0, 0);
    const sh = img("shadow", 34); sh.setAlpha(.9);
    c.add([sh, img(k)]);
    const n = new Node(c); n.k = 1.3;
    if (kind === "monster") n.sc = 1.3;
    n.u = { kind:"fan", arm:null, flag:null, shadow:sh, phase:Math.random()*6, fall:-1, dir:Math.random() < .5 ? 1 : -1, unit:kind };
    return n;
  }
  /* o "chefão" que aparece por um instante: torcedor gigante com coroa */
  function makeBossFan(sideKey) {
    const n = makeFan(sideKey, null, null, false);
    const crown = scene.add.graphics();
    crown.fillStyle(0xffd23a, 1); crown.lineStyle(1.6, 0x14171c, 1);
    crown.beginPath(); crown.moveTo(-9, -48); crown.lineTo(-11, -62); crown.lineTo(-4, -55); crown.lineTo(0, -66); crown.lineTo(4, -55); crown.lineTo(11, -62); crown.lineTo(9, -48); crown.closePath();
    crown.fillPath(); crown.strokePath();
    n.v.add(crown);
    return n;
  }
  function updateFan(n, t, dt) {
    const u = n.u;
    if (u.fall >= 0) {
      u.fall = Math.min(1, u.fall + dt*2.2);
      n.rot = u.dir*u.fall*Math.PI/2; n.y = u.fall*.12;
      if (u.flag) u.flag.setVisible(u.fall < .3);
      if (u.arm) u.arm.setVisible(u.fall < .3);
      u.shadow.setAlpha(.9*(1 - u.fall*.5));
    } else if (n.visible) {
      n.y = Math.abs(Math.sin(t*4 + u.phase))*.1;
      if (u.arm) u.arm.setRotation(-.1 + Math.sin(t*6 + u.phase)*.35);
      if (u.flag) u.flag.setScale(u.flag.scaleX, u.flag.scaleY);
      u.shadow.setScale(34/(texInfo.shadow.w*Q)*(1 - n.y*.5));
    }
  }

  /* ================================================================
     Capitães
     ================================================================ */
  function makeCaptain(sideKey, ch) {
    const s = ch.military ? cfg.NG_SIDE : cfg.SIDES[sideKey];
    const fk = ch.military ? "regime" : sideKey;
    const bk = "cap_" + [ch.name, sideKey].join("_");
    tex(bk, () => Art.captainBody(ch, s, fk));
    const ak = "caparm_" + s.key;
    tex(ak, () => Art.captainArm(s));
    tex("shadow", () => Art.shadow());
    const c = scene.add.container(0, 0);
    const sh = img("shadow", 100); sh.setAlpha(.95);
    const body = img(bk);
    const arm = scene.add.container(38, -88);
    const armImg = img(ak);
    const fl = img(flagKey(fk), 52); fl.setOrigin(0, .06); fl.setPosition(2.5, -100);
    arm.add([armImg, fl]);
    const lk = "lbl_" + ch.short + ch.party + s.css;
    tex(lk, () => Art.label(ch.short + " · " + ch.party, s.css));
    const lab = img(lk); lab.setPosition(0, -178);
    c.add([sh, body, arm, lab]);
    const n = new Node(c);
    n.k = (ch.boss || ch.military) ? 1.3 : 1.12;
    n.u = { kind:"captain", arm, flag:fl, jump:0, shake:0, base:{ x:0, y:0, z:0 }, bx:0 };
    return n;
  }
  function updateCaptain(n, t, dt, b) {
    const u = n.u;
    u.arm.setRotation(-.1 + Math.sin(t*3 + b)*.18);
    let y = u.base.y, x = u.base.x;
    if (u.jump > 0) { u.jump = Math.max(0, u.jump - dt*1.2); y += Math.sin(u.jump*Math.PI)*1.2; }
    if (u.shake > 0) { u.shake = Math.max(0, u.shake - dt*1.5); x += Math.sin(t*50)*.13*u.shake; }
    n.x = x; n.y = y; n.z = u.base.z;
    n.alpha = 1;
  }

  /* ================================================================
     Veículos e peças arremessadas
     ================================================================ */
  function vehicleNode(key, make, w) {
    tex(key, make);
    tex("shadow", () => Art.shadow());
    const c = scene.add.container(0, 0);
    const sh = img("shadow", w || 70); sh.setAlpha(.8);
    c.add([sh, img(key)]);
    return new Node(c);
  }
  /* dir: +1 = anda no sentido +x (visual: direita-cima), -1 = sentido -x */
  function makeMoto(sideKey, dir) {
    const s = cfg.SIDES[sideKey], shirt = s.shirts[rand(s.shirts.length)];
    const fl = tex("flag_" + sideKey, () => Art.flag(sideKey));
    const key = ["moto", sideKey, shirt, dir > 0 ? "R" : "L"].join("_");
    const n = vehicleNode(key, () => Art.sheared(70, 56, 35, 50, -.5, dir < 0, x => Art.drawMoto(x, { main:s.main, alt:s.alt, shirt, flag:fl })), 52);
    n.sc = 1.5; return n;
  }
  /* ônibus que anda no sentido -z (desce a coluna: visual esquerda-cima) */
  function makeBus(sideKey, len) {
    const s = cfg.SIDES[sideKey], L = Math.round(len*52);
    const fl = tex("flag_" + sideKey, () => Art.flag(sideKey));
    const key = ["bus", sideKey, L].join("_");
    const n = vehicleNode(key, () => Art.sheared(L, 56, L/2, 50, .5, true, x => Art.drawBus(x, { main:s.main, alt:s.alt, flag:fl }, L)), L*.7); n.sc = 1.3; return n;
  }
  function makeSoundTruck(sideKey, dir) {
    const s = cfg.SIDES[sideKey];
    const fl = tex("flag_" + sideKey, () => Art.flag(sideKey));
    const key = ["truck", sideKey, dir > 0 ? "R" : "L"].join("_");
    const n = vehicleNode(key, () => Art.sheared(100, 80, 50, 56, -.5, dir < 0, x => Art.drawTruck(x, { main:s.main, alt:s.alt, flag:fl })), 90); n.sc = 1.3; return n;
  }
  function makeHeli(sideKey, dir) {
    const s = cfg.SIDES[sideKey];
    const key = ["heli", sideKey, dir > 0 ? "R" : "L"].join("_");
    tex(key, () => Art.sheared(100, 70, 50, 38, -.5, dir < 0, x => { x.translate(46, 16); Art.drawHeli(x, { main:s.main, alt:s.alt }); }));
    tex("shadow", () => Art.shadow());
    const c = scene.add.container(0, 0);
    const sh = img("shadow", 64); sh.setAlpha(.6);
    const im = img(key);
    tex("rotor", () => Art.rotor(86));
    const ro = img("rotor"); ro.setPosition(-2*dir, -52);
    c.add([sh, im, ro]);
    const n = new Node(c); n.u = { rotor:ro, shadow:sh };
    return n;
  }
  function makeThrow(id, sideKey) {
    const fl = tex("flag_" + sideKey, () => Art.flag(sideKey));
    const key = "throw_" + id + (id === "bandeira" ? "_" + sideKey : "");
    tex(key, () => Art.throwIcon(id, fl));
    const im = img(key, 30);
    const n = new Node(im, "sort"); n.bias = 4000; return n;
  }
  /* objetos que ficam no chão (bala/flecha/bomba) */
  function makeBullet() { tex("bullet", () => Art.bullet()); const n = new Node(img("bullet", 14), "sort"); n.bias = 4000; return n; }
  function makeArrow() { tex("arrow", () => Art.arrow()); const n = new Node(img("arrow", 22), "sort"); n.bias = 4000; return n; }
  function makeBomb() { tex("bomb", () => Art.bomb()); const n = new Node(img("bomb", 28), "sort"); n.bias = 4000; return n; }
  function makeUmbrella() { tex("umbrella", () => Art.umbrella()); const n = new Node(img("umbrella", 50), "sort"); n.bias = 6; return n; }
  const flameKey = l => { tex("flame" + l, () => Art.flame(l)); return "flame" + l; };
  function makeFlame() {
    tex("glow", () => Art.glow());
    const c = scene.add.container(0, 0);
    const gl = img("glow"); gl.setTint(0xff8a1a).setBlendMode(1).setAlpha(.55).setScale(1.2/Q).setPosition(0, -14);
    const ls = [0, 1, 2].map(l => { const im = img(flameKey(l)); im.setScale([.78, .56, .34][l]/Q*1.2); return im; });
    c.add([gl, ...ls]);
    const n = new Node(c); n.u = { ph:Math.random()*6, ls }; return n;
  }
  function flicker(n, t) {
    const ph = n.u.ph;
    n.u.ls.forEach((im, i) => { const s = [.78, .56, .34][i]*1.2/Q; im.setScale(s*(1 + .15*Math.sin(t*19 + ph + i)), s*(1 + .4*Math.sin(t*18 + ph + i*.7))); });
  }
  function makeConeMark() { tex("conemark", () => Art.coneMark()); return new Node(img("conemark", 18), "sort"); }

  /* ---------- marcas planas no chão ---------- */
  function flatScale(n, r) {                           // círculo de raio r (unidades do mundo) projetado no chão
    n.sc = 1; n.fx = n.fy = 1;
    const w = texInfo[n.u.tk].w*.9;
    n.fx = (2*SQ2*r*HW)/w; n.fy = (2*SQ2*r*HH)/w;
  }
  function makeRing(color) {
    tex("ring", () => Art.ring());
    const im = img("ring"); im.setTint(color);
    const n = new Node(im, "flat"); n.u.tk = "ring"; n.bias = 400; n.alpha = 0; flatScale(n, .5); return n;
  }
  function setRing(n, r) { flatScale(n, r); }
  const decals = [];
  function addDecal(x, z, color, r) {
    tex("blob", () => Art.blob());
    const im = img("blob"); im.setTint(color); im.setRotation(0);
    const n = new Node(im, "flat"); n.u.tk = "blob"; n.at(x, 0, z); n.bias = 100 + decals.length*.01; n.alpha = .88;
    flatScale(n, r*(.8 + Math.random()*.4));
    n.rot = 0; n.v.setAngle(0);
    decals.push(n); return n;
  }
  function fixed(node) { markers.push(node); return node; }
  const markers = [];                                   // coisas que ficam na arena até a próxima rodada (cones, flechas, objetos)
  function clearMarkers() {
    markers.forEach(n => n.destroy()); markers.length = 0;
    decals.forEach(n => n.destroy()); decals.length = 0;
  }

  /* ---------- partículas (confete, faíscas, brasas) ---------- */
  const parts = [], free = [];
  function burst(pos, colors, n = 26, power = 4) {
    tex("chip0", () => Art.chip(0)); tex("chip1", () => Art.chip(1)); tex("chip2", () => Art.chip(2));
    for (let i = 0; i < n; i++) {
      let p = free.pop();
      if (!p) { p = { im:scene.add.image(0, 0, "chip0").setDepth(D_FX) }; }
      const k = "chip" + rand(3);
      p.im.setTexture(k); p.im.setTint(colors[rand(colors.length)]).setVisible(true).setAlpha(1);
      p.x = pos.x; p.y = (pos.y || 0) + .5; p.z = pos.z;
      p.vx = (Math.random() - .5)*power; p.vy = 2 + Math.random()*power; p.vz = (Math.random() - .5)*power;
      p.life = p.max = 1 + Math.random()*.7; p.spin = (Math.random() - .5)*14; p.s = .5 + Math.random()*.5;
      p.im.setBlendMode(0);
      parts.push(p);
    }
  }
  /* brilho aditivo (faísca/explosão) */
  function flash(pos, color, size, dur = .35) {
    tex("glow", () => Art.glow());
    const im = img("glow"); im.setTint(color).setBlendMode(1);
    const n = new Node(im, "fx"); n.at(pos.x, pos.y || 0, pos.z); n.alpha = .95;
    n.u.t = 0;
    addFx(dur, t => { const k = t/dur; n.sc = size*(.5 + k); n.alpha = .95*(1 - k); n.sync(); }, () => n.destroy());
    return n;
  }
  function stepParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.life -= dt;
      p.vy -= 9*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt;
      if (p.life <= 0 || p.y < 0) { p.im.setVisible(false); free.push(p); parts.splice(i, 1); continue; }
      const sp = P(p.x, p.y, p.z);
      p.im.setPosition(sp[0], sp[1]).setRotation(p.im.rotation + p.spin*dt).setScale(p.s*.85).setAlpha(Math.min(1, p.life*2.2));
    }
  }

  /* ---------- efeitos temporizados ---------- */
  const fxList = [];
  function addFx(dur, update, end) { fxList.push({ t:0, dur, update, end }); }
  function runFx(dt) {
    for (let i = fxList.length - 1; i >= 0; i--) {
      const f = fxList[i]; f.t += dt; f.update(f.t, dt);
      if (f.t >= f.dur) { f.end && f.end(); fxList.splice(i, 1); }
    }
  }

  /* ================================================================
     Tabuleiros
     ================================================================ */
  const N = () => cfg.N, BXs = () => cfg.BX;
  const tileCol = [[], []], tileMark = [[], []];
  let boardG = null, overG = null, boardDirty = true, frameCols = [0x009c3b, 0xd7191c];
  let previewed = [];
  const tileCenter = (b, r, c) => ({ x:BXs()[b] + (c - (N() - 1)/2), y:0, z:r - (N() - 1)/2 });

  function initBoards() {
    for (let b = 0; b < 2; b++) for (let r = 0; r < N(); r++) { tileCol[b][r] = []; tileMark[b][r] = []; for (let c = 0; c < N(); c++) { tileCol[b][r][c] = 0x444a53; tileMark[b][r][c] = 0; } }
    boardG = scene.add.graphics().setDepth(D_BOARD);
    overG = scene.add.graphics().setDepth(D_BOARD + 10);
  }
  function setTile(b, r, c, color, mark) { tileCol[b][r][c] = color; tileMark[b][r][c] = mark || 0; boardDirty = true; }
  function setFrameColor(b, color) { frameCols[b] = color; boardDirty = true; }
  function diamond(g, cx, cz, h, y = 0) {
    const a = P(cx - h, y, cz - h), b = P(cx + h, y, cz - h), c = P(cx + h, y, cz + h), d = P(cx - h, y, cz + h);
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.lineTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.closePath();
  }
  const sh = Art.shade;
  function drawBoards(t) {
    const g = boardG; g.clear();
    const n = N();
    for (let b = 0; b < 2; b++) {
      const cx = BXs()[b], half = n/2 + .3, thick = .42;
      const fc = frameCols[b];
      // sombra projetada no chão
      g.fillStyle(0x000000, .22); { const a = P(cx - half - .5, 0, -half + .6), bb = P(cx + half + .1, 0, -half + .6), c = P(cx + half + .1, 0, half + .6), d = P(cx - half - .5, 0, half + .6);
        g.beginPath(); g.moveTo(a[0], a[1] + 14); g.lineTo(bb[0], bb[1] + 14); g.lineTo(c[0], c[1] + 14); g.lineTo(d[0], d[1] + 14); g.closePath(); g.fillPath(); }
      // laterais da moldura (faces visíveis: -x e +z)
      const A = P(cx - half, 0, -half), B = P(cx - half, 0, half), C = P(cx + half, 0, half);
      const lift = thick*HY;
      g.fillStyle(sh(fc, .62), 1); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(B[0], B[1] + lift); g.lineTo(A[0], A[1] + lift); g.closePath(); g.fillPath();
      g.fillStyle(sh(fc, .42), 1); g.beginPath(); g.moveTo(B[0], B[1]); g.lineTo(C[0], C[1]); g.lineTo(C[0], C[1] + lift); g.lineTo(B[0], B[1] + lift); g.closePath(); g.fillPath();
      // topo da moldura
      g.fillStyle(sh(fc, .92), 1); diamond(g, cx, 0, half); g.fillPath();
      g.lineStyle(2, sh(fc, 1.25), .9); diamond(g, cx, 0, half); g.strokePath();
      g.fillStyle(0x1a1d22, .92); diamond(g, cx, 0, n/2 + .04); g.fillPath();
      // casas
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const tc = tileCenter(b, r, c), col = tileCol[b][r][c], mk = tileMark[b][r][c];
        g.fillStyle(col, 1); diamond(g, tc.x, tc.z, .47); g.fillPath();
        // brilho no topo e sombra embaixo
        const a = P(tc.x - .47, 0, tc.z - .47), bq = P(tc.x + .47, 0, tc.z - .47), cq = P(tc.x + .47, 0, tc.z + .47), d = P(tc.x - .47, 0, tc.z + .47);
        g.lineStyle(1.6, sh(col, 1.35), .75); g.beginPath(); g.moveTo(d[0], d[1]); g.lineTo(a[0], a[1]); g.lineTo(bq[0], bq[1]); g.strokePath();
        g.lineStyle(1.6, sh(col, .55), .85); g.beginPath(); g.moveTo(bq[0], bq[1]); g.lineTo(cq[0], cq[1]); g.lineTo(d[0], d[1]); g.strokePath();
        if (mk) drawMark(g, tc, mk, t);
      }
    }
    boardDirty = false;
  }
  /* marcas nas casas: 1 = erro (anel), 2 = acerto (X), 3 = revelada vazia (ponto), 4 = revelada com alvo (alvo) */
  function drawMark(g, tc, mk, t) {
    const c0 = P(tc.x, 0, tc.z);
    if (mk === 1) { g.lineStyle(2, 0xffffff, .35); g.strokeEllipse(c0[0], c0[1], 18, 9); g.fillStyle(0xffffff, .18); g.fillEllipse(c0[0], c0[1], 8, 4); }
    else if (mk === 2) {
      const r = .3, a = P(tc.x - r, 0, tc.z - r), b = P(tc.x + r, 0, tc.z + r), c = P(tc.x + r, 0, tc.z - r), d = P(tc.x - r, 0, tc.z + r);
      g.lineStyle(4.5, 0x3a0a08, .9); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.moveTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.strokePath();
      g.lineStyle(2.6, 0xff6a5a, 1); g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.moveTo(c[0], c[1]); g.lineTo(d[0], d[1]); g.strokePath();
    } else if (mk === 3) { g.fillStyle(0xd8c8ff, .5); g.fillEllipse(c0[0], c0[1], 7, 3.5); }
    else if (mk === 4) { g.lineStyle(2.2, 0xfff2a0, .95); g.strokeEllipse(c0[0], c0[1], 20, 10); g.lineStyle(2.2, 0xfff2a0, .95); g.strokeEllipse(c0[0], c0[1], 8, 4); }
  }
  /* pré-visualização de mira/posicionamento (brilho na casa) */
  function clearPreview() { previewed = []; }
  function setPreview(list) { previewed = list.filter(Boolean); }
  function drawPreview(t) {
    const g = overG; g.clear();
    if (!previewed.length) return;
    const pulse = .55 + Math.sin(t*7)*.15;
    previewed.forEach(([b, r, c, ok, aim]) => {
      const tc = tileCenter(b, r, c);
      const col = ok ? (aim ? 0x3d8bff : 0x5ed05e) : 0xff4a4a;
      g.fillStyle(col, pulse*.6); diamond(g, tc.x, tc.z, .47); g.fillPath();
      g.lineStyle(2.6, col, .95); diamond(g, tc.x, tc.z, .47); g.strokePath();
      if (aim && ok) { g.lineStyle(1.6, 0xffffff, .9); diamond(g, tc.x, tc.z, .3); g.strokePath(); }
    });
  }

  /* ================================================================
     Picking e câmera
     ================================================================ */
  const view = { W:0, H:0, dpr:1, cx:0, cy:0, zoom:1, goalCx:0, goalCy:0, goalZoom:1, focus:-1, inited:false };
  function screenToWorld(px, py) {                     // px, py em px CSS
    const d = view.dpr, z = view.zoom*d;
    const wx = cam.scrollX + cam.width/2 + (px*d - cam.width/2)/z;
    const wy = cam.scrollY + cam.height/2 + (py*d - cam.height/2)/z;
    return [wx, wy];
  }
  function pick(clientX, clientY) {
    const rect = game.canvas.getBoundingClientRect();
    const [wx, wy] = screenToWorld(clientX - rect.left, clientY - rect.top);
    const g = unproj(wx, wy), n = N();
    for (let b = 0; b < 2; b++) {
      const lx = g.x - BXs()[b] + n/2, lz = g.z + n/2;
      if (lx >= 0 && lx < n && lz >= 0 && lz < n) return { b, r:Math.floor(lz), c:Math.floor(lx) };
    }
    return null;
  }
  function arenaBox() {                                // caixa (em px de mundo) com tabuleiros + capitães + rótulos
    const pts = [], n = N(), half = n/2 + .8;
    for (let b = 0; b < 2; b++) {
      const cx = BXs()[b];
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => pts.push(P(cx + sx*half, 0, sz*half)));
    }
    cfg.CAPS.forEach(c => { const p = P(c.x, 0, c.z); pts.push([p[0] - 70, p[1] - 215], [p[0] + 70, p[1] + 20]); });
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    return { x0, x1, y0, y1 };
  }
  function boardBox(b) {
    const n = N(), half = n/2 + .8, cx = BXs()[b], pts = [];
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => pts.push(P(cx + sx*half, 0, sz*half)));
    const cp = cfg.CAPS[b]; if (cp) { const p = P(cp.x, 0, cp.z); pts.push([p[0], p[1] - 215]); }
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    pts.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); });
    return { x0, x1, y0, y1 };
  }
  function layoutGoal() {
    const W = view.W, H = view.H, mobile = cfg.isMobile();
    const topH = mobile ? Math.max(70, cfg.hudTop()) : Math.max(100, cfg.hudTop());
    const botH = Math.max(mobile ? 150 : 120, cfg.hudBottom());
    const freeH = Math.max(120, H - topH - botH), pad = mobile ? 6 : 24;
    const box = view.focus >= 0 && mobile ? boardBox(view.focus) : arenaBox();
    const bw = box.x1 - box.x0, bh = box.y1 - box.y0;
    let z = Math.min((W - pad*2)/bw, (freeH - pad)/bh);
    z = Math.max(.28, Math.min(z, mobile ? 1.1 : 1.25));
    view.goalZoom = z;
    view.goalCx = (box.x0 + box.x1)/2;
    // centro do conteúdo no meio da faixa livre (entre HUD e painel)
    const midY = topH + freeH/2;
    view.goalCy = (box.y0 + box.y1)/2 - (midY - H/2)/z;
  }
  function applyCam() {
    const d = view.dpr, z = view.zoom*d;
    cam.setZoom(z);
    cam.setScroll(view.cx - cam.width/2, view.cy - cam.height/2);
  }
  function setFocus(b) { view.focus = b; }
  function resize() {
    view.W = window.innerWidth; view.H = window.innerHeight; view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    game.scale.resize(Math.round(view.W*view.dpr), Math.round(view.H*view.dpr));
    game.canvas.style.width = view.W + "px"; game.canvas.style.height = view.H + "px";
    cam.setSize(game.scale.width, game.scale.height);
    layoutGoal();
    if (!view.inited) { view.cx = view.goalCx; view.cy = view.goalCy; view.zoom = view.goalZoom; view.inited = true; }
    applyCam();
  }
  function shake(ms = 220, k = .006) { cam.shake(ms, k); }

  /* objeto preso à tela (fx, fy em 0..1 da janela); o zoom da câmera é compensado */
  function pinToScreen(go, fx, fy, scale = 1) {
    go.setScrollFactor(0);
    return () => {
      const d = view.dpr, z = view.zoom*d, w2 = cam.width/2, h2 = cam.height/2;
      go.setPosition(w2 + (view.W*d*fx - w2)/z, h2 + (view.H*d*fy - h2)/z);
      if (go.setScale) go.setScale(scale*d/z);
    };
  }

  /* ---------- dicas flutuantes ("clique aqui") ---------- */
  function makeHint(text, color) {
    const key = "hint_" + text;
    tex(key, () => Art.hint(text, color));
    const im = img(key, 300);
    const n = new Node(im, "fx"); n.bias = 1000; n.visible = false; return n;
  }

  /* ================================================================
     Ciclo
     ================================================================ */
  let tAcc = 0;
  function frame(dt, t) {
    stepParts(dt);
    layoutGoal();
    const kf = 1 - Math.exp(-dt*5);
    view.cx += (view.goalCx - view.cx)*kf; view.cy += (view.goalCy - view.cy)*kf; view.zoom += (view.goalZoom - view.zoom)*kf;
    if (view.focus < 0) view.cx += Math.sin(t*.2)*.15;
    applyCam();
    syncAll();
    if (boardDirty) drawBoards(t);
    drawPreview(t);
  }

  function init(phaserScene, config) {
    scene = phaserScene; game = scene.game; cam = scene.cameras.main; cfg = config; ready = true;
    cam.setBackgroundColor(0x1a1d22);
    initBoards();
    resize();
    window.addEventListener("resize", resize);
    try { cam.filters.external.addVignette(.5, .5, .9, .32); } catch (e) { /* filtros indisponíveis: segue sem vinheta */ }
  }

  return {
    init, frame, pinToScreen, runFx, addFx, resize, setFocus, shake, pick, P, unproj, depthOf, tex, img, flagKey, texInfo,
    get scene() { return scene; }, get cam() { return cam; }, get view() { return view; }, get cfg() { return cfg; },
    Node, nodes, drop, fixed, markers, tileCenter,
    makeFan, makeUnit, makeBossFan, makeCaptain, updateFan, updateCaptain,
    makeMoto, makeBus, makeSoundTruck, makeHeli, makeThrow, makeBullet, makeArrow, makeBomb, makeUmbrella, makeConeMark,
    makeRing, setRing, addDecal, clearMarkers, burst, flash, makeHint, makeFlame, flicker, flameKey,
    setTile, setFrameColor, setPreview, clearPreview, D_GROUND, D_BOARD, D_FLAT, D_SORT, D_FX, D_HINT
  };
})();

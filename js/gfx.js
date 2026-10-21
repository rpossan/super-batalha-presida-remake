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
  /* vista: yaw 0..3 gira o mundo em passos de 90° (as peças do cenário são redesenhadas para cada vista) */
  let yaw = 0;
  const rot = (x, z) => yaw === 0 ? [x, z] : yaw === 1 ? [z, -x] : yaw === 2 ? [-x, -z] : [-z, x];
  const P = (x, y, z) => { const r = rot(x, z); return [(r[0] + r[1])*HW, (r[1] - r[0])*HH - y*HY]; };
  const unproj = (sx, sy) => {                                    // chão (y=0)
    const u = sx/HW, v = sy/HH, a = (u - v)/2, b = (u + v)/2;
    return yaw === 0 ? { x:a, z:b } : yaw === 1 ? { x:-b, z:a } : yaw === 2 ? { x:-a, z:-b } : { x:b, z:-a };
  };
  const depthOf = (x, z) => { const r = rot(x, z); return (r[1] - r[0])*HH; };
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
    const q = d.q || Q; im.setScale(w ? w/(d.w*q) : 1/q);
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
     Pessoas articuladas (js/people.js): pernas, tronco, cabeça e braços com pivôs.
     Origem do nó = pés. Medidas em px lógicos (multiplicadas pela escala s).
     ================================================================ */
  const RIG = { neck:-67.5, hip:-40, sh:-64.3, up:15, fore:15.2 };
  const SIGKEYS = ["fem","skin","hair","hairStyle","shirt","collar","stripe","sleeveStripe","pants","pantsType","shoes","beard","beardColor","glasses","eye","age","zombie","helmet","horns","longSleeve","jacket","tie","sash","military","undershirt","pocket","pin","sleeve","legLen","crest","torsoLen"];
  const sigOf = spec => SIGKEYS.map(k => { const v = spec[k]; return Array.isArray(v) ? v.join(".") : (v ?? ""); }).join("|") + (spec.cap ? "c" + spec.cap.color + "_" + (spec.cap.logo || "") : "");
  const sigHash = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };

  /* sombra direcional (sol no alto-esquerdo da tela: a sombra cai para a direita-baixo) */
  function shadowTex() { return tex("shadowdir", () => Art.shadowDir()); }

  const easeOut = k => 1 - (1 - k)*(1 - k), easeIn = k => k*k, clamp01 = k => Math.max(0, Math.min(1, k));
  let chant = 0;                                           // energia da torcida (0..1), sobe com acertos

  /* o: s (escala), hold: "flag"|"rifle"|"none", flagKey, holder: "L"|"R", pose */
  function buildPerson(spec, o = {}) {
    const s = o.s || 1, hold = o.hold || "flag", holder = o.holder || "R";
    const fem = !!spec.fem, sw = (spec.suit ? (fem ? 10.2 : 11.8) : (fem ? 9.6 : 11.2));
    const k = sigHash(sigOf(spec)) + "_" + s;
    const T = (name, make) => { const key = name + k; tex(key, make); return key; };
    const kLegs = T("lg", () => People.legs(spec, s)), kTorso = T("to", () => (spec.jacket ? People.suit : People.torso)(spec, s)), kHead = T("hd", () => People.head(spec, s));
    const kUp = T("ua", () => People.upperArm(spec, s)), kOpen = T("fo", () => People.foreArm(spec, "open", s)), kFist = T("ff", () => People.foreArm(spec, "fist", s));
    shadowTex();
    const c = scene.add.container(0, 0);
    const sh = img("shadowdir"); sh.setScale(s*.62/(texInfo.shadowdir.q || Q)*1.0);
    const up = scene.add.container(0, RIG.hip*s);                // corpo superior (gira a partir do quadril)
    const legs = img(kLegs); legs.setPosition(0, RIG.hip*s);
    const torso = img(kTorso); torso.setPosition(0, (RIG.neck - RIG.hip)*s);
    const headC = scene.add.container(0, (RIG.neck - RIG.hip)*s); const head = img(kHead); headC.add(head);
    const arm = side => {
      const g = scene.add.container(side*(sw - 1)*s, (RIG.sh - RIG.hip)*s), ua = img(kUp);
      const fg = scene.add.container(0, RIG.up*s); const fo = img(side === (holder === "R" ? 1 : -1) && hold !== "none" ? kFist : kOpen); fg.add(fo);
      g.add([ua, fg]); return { g, fg, side };
    };
    const L = arm(-1), R = arm(1), H = holder === "R" ? R : L, F = holder === "R" ? L : R;     // H = braço que segura, F = braço livre
    // objeto segurado: mastro + bandeira (corda) ou fuzil
    let item = null, rope = null, poleLen = 0, fw = 0, fh = 0;
    if (hold === "flag") {
      poleLen = Math.round(56*s);
      const pk = "pole" + poleLen; tex(pk, () => People.pole(poleLen));
      const pole = img(pk); pole.setOrigin(.5, (poleLen + 3 - 13*s)/(poleLen + 6));
      const fk = flagKey(o.flagKey), d = texInfo[fk];
      fw = 24*s; fh = fw*(55/80);
      rope = scene.add.rope(0, 0, fk, undefined, 7, true); rope.setScale(fw/(d.w*(d.q || Q)));
      item = scene.add.container(0, 0); item.add([pole, rope]); item.pole = pole;
    } else if (hold === "rifle") {
      tex("rifle", () => People.rifle());
      const rf = img("rifle"); rf.setScale(s/(texInfo.rifle.q || Q));
      item = scene.add.container(0, 0); item.add(rf); item.pole = rf;
    }
    up.add([L.g, torso, headC, R.g]); if (item) up.add(item);
    c.add([sh, legs, up]);
    const n = new Node(c);
    n.u = { kind:"fan", s, sw, hold, holder, H, F, L, R, up, legs, torso, headC, shadow:sh, item, rope, poleLen, fw, fh, flag:item, arm:null,
            phase:Math.random()*6, ph2:Math.random()*6, fall:-1, dir:Math.random() < .5 ? 1 : -1, pose:o.pose || "cheer", glance:0, nextGlance:rnd(2, 7), cheer:0, flagDropped:false, spec, sideKey:o.flagKey };
    return n;
  }
  const rnd = (a, b) => a + Math.random()*(b - a);
  const choose = a => a[Math.floor(Math.random()*a.length)];

  function makeFan(sideKey, shirt) {
    const side = cfg.SIDES[sideKey], spec = People.randomSpec(side, shirt != null ? { shirt } : {});
    const n = buildPerson(spec, { s:1.0, hold:"flag", flagKey:sideKey, holder:"R", pose:"cheer" }); n.k = 1.0; return n;
  }
  function unitSpec(kind) {
    if (kind === "zombie") return { fem:Math.random() < .35, skin:choose([0x93ad86, 0x8aa07c, 0xa0b090]), hair:0x2a2a22, hairStyle:choose(["short", "bald", "long"]), eye:0x802020, shirt:choose([0x5e6050, 0x6a5a4a, 0x4a5a5a]), pants:0x34362e, pantsType:"dark", shoes:0x2a2620, zombie:true, age:.8 };
    if (kind === "monster") return { skin:0x8a5aae, hair:0x1a1020, hairStyle:"bald", eye:0x802020, shirt:0x3a1e52, pants:0x2a1a3a, pantsType:"dark", shoes:0x20182a, zombie:true, horns:true, age:.5 };
    return { skin:choose(People.SKINS), hair:0x1a1a14, hairStyle:"short", eye:0x3a2418, shirt:choose([0x4e5d2e, 0x56633a, 0x46542a]), pants:0x4a5530, pantsType:"dark", shoes:0x1a1a18, helmet:true, glasses:false, collar:null };
  }
  function makeUnit(kind) {
    const spec = unitSpec(kind);
    const n = buildPerson(spec, { s:kind === "monster" ? 1.3 : 1, hold:kind === "soldier" ? "rifle" : "none", holder:"R", pose:kind });
    n.u.unit = kind; return n;
  }
  /* o "chefão" que aparece por um instante: torcedor gigante com coroa */
  function makeBossFan(sideKey) {
    const n = makeFan(sideKey);
    const crown = scene.add.graphics();
    crown.fillStyle(0xffd23a, 1); crown.lineStyle(1.6, 0x14171c, 1);
    crown.beginPath(); crown.moveTo(-8, -86); crown.lineTo(-10, -100); crown.lineTo(-3.5, -93); crown.lineTo(0, -104); crown.lineTo(3.5, -93); crown.lineTo(10, -100); crown.lineTo(8, -86); crown.closePath();
    crown.fillPath(); crown.strokePath();
    n.v.add(crown);
    return n;
  }

  /* mão (em coords do corpo superior) do braço g, com cotovelo a1 e antebraço a2 */
  function handPos(u, A) {
    const s = u.s, a1 = A.g.rotation, a2 = a1 + A.fg.rotation, L1 = RIG.up*s, L2 = (RIG.fore + 2)*s;
    return [A.g.x - L1*Math.sin(a1) - L2*Math.sin(a2), A.g.y + L1*Math.cos(a1) + L2*Math.cos(a2), a2];
  }
  /* poses dos braços: cada função define a1/a2 de cada braço no instante t */
  function setArm(A, a1, a2) { A.g.rotation = a1; A.fg.rotation = a2; }

  const POSES = {
    cheer(u, t, ph, ch) {                                   // torcedor: braço da bandeira erguido
      const sd = u.holder === "R" ? 1 : -1, w = Math.sin(t*(2.2 + ch*3) + ph);
      setArm(u.H, -sd*(2.3 + ch*.25) + .1*w, -sd*(.55) + sd*(-.2 - ch*.25)*Math.sin(t*(3 + ch*5) + ph));
      setArm(u.F, sd*(.12 + .06*Math.sin(t*1.3 + ph) + ch*(.6 + .5*Math.max(0, Math.sin(t*5 + ph)))), sd*(.14 + .08*Math.sin(t*1.7 + ph)));
    },
    zombie(u, t, ph) {
      const w = Math.sin(t*2.6 + ph);
      setArm(u.L, 2.15 + .12*w, .5 + .2*Math.sin(t*3.1 + ph)); setArm(u.R, -2.15 - .12*w, -.5 - .2*Math.sin(t*3.3 + ph));
    },
    soldier(u, t, ph) {
      setArm(u.R, -.5 + .03*Math.sin(t*1.5 + ph), -1.55 + .04*Math.sin(t*1.2 + ph)); setArm(u.L, .1 + .04*Math.sin(t*1.3 + ph), .2);
    },
    monster(u, t, ph) {
      setArm(u.L, .45 + .15*Math.sin(t*1.7 + ph), .35); setArm(u.R, -.45 - .15*Math.sin(t*1.9 + ph), -.35);
    },
  };

  /* animação de uma pessoa (torcedor, unidade ou capitão) */
  function updateFan(n, t, dt) {
    const u = n.u, s = u.s, ph = u.phase;
    const ch = chant;
    if (u.fall >= 0) {                                       // queda realista: tropeça para trás, desaba e fica deitado
      u.fall = Math.min(1, u.fall + dt*1.15);
      const f = u.fall, dir = u.dir, fl = clamp01(f/.22), tp = clamp01((f - .12)/.88);
      if (!u.flagDropped) { u.flagDropped = true; dropItem(n); }
      const topple = easeIn(tp);
      n.rot = dir*(Math.PI/2)*topple*(1 + .06*Math.sin(clamp01(tp)*Math.PI*1.2)*(1 - tp));
      n.y = .02 + topple*.1;
      u.up.rotation = -dir*.32*easeOut(fl)*(1 - tp);              // balança para trás antes de cair
      u.headC.rotation = dir*.45*easeOut(fl)*(1 - tp*.5);
      u.legs.x = 0;
      const sdL = -1, sdR = 1;
      setArm(u.L, sdL*(-.5 - 1.5*easeOut(fl)) + 0, .35); setArm(u.R, sdR*(-.5 - 1.4*easeOut(fl)), -.3);
      if (tp > .85) { setArm(u.L, 1.1, .3); setArm(u.R, -1.2, -.2); }
      if (u.item) u.item.setVisible(false);
      u.shadow.setAlpha(.9 - .35*f);
      return;
    }
    if (u.flagDropped) { u.flagDropped = false; u.up.rotation = 0; u.headC.rotation = 0; if (u.item) u.item.setVisible(true); u.shadow.setAlpha(1); }
    if (!n.visible) return;
    // respiração e balanço do peso do corpo
    const breath = Math.sin(t*1.9 + ph), sway = Math.sin(t*1.05 + ph*1.7);
    const pose = u.pose;
    let lean = 0, shake = 0;
    if (pose === "zombie") { lean = .1 + .06*Math.sin(t*1.8 + ph); shake = Math.sin(t*5 + ph)*.012; }
    else if (pose === "monster") lean = .12 + .04*Math.sin(t*1.2 + ph);
    u.up.rotation = .022*sway + lean + shake;
    u.up.scaleY = 1 + .011*breath; u.up.scaleX = 1 - .005*breath;
    u.legs.x = .55*s*sway; u.up.x = -.25*s*sway;
    // olhar em volta
    u.nextGlance -= dt;
    if (u.nextGlance <= 0) { u.glance = (Math.random() < .5 ? -1 : 1)*rnd(.1, .22); u.nextGlance = rnd(2.5, 8); u.glanceT = rnd(.6, 1.6); }
    if (u.glanceT > 0) u.glanceT -= dt; else u.glance *= .94;
    u.headC.rotation = .045*Math.sin(t*.8 + u.ph2) + u.glance + (pose === "zombie" ? .2*Math.sin(t*1.3 + ph) : 0) + (pose === "monster" ? .1 : 0);
    // braços
    (POSES[pose] || POSES.cheer)(u, t, ph, ch);
    // reação de comemoração (pulo)
    if (u.cheer > 0) { u.cheer = Math.max(0, u.cheer - dt); n.y = Math.abs(Math.sin((1 - u.cheer)*Math.PI*3))*.22*Math.min(1, u.cheer*3); }
    else n.y = ch > .55 && pose === "cheer" ? Math.max(0, Math.sin(t*6 + ph))*.05*ch : 0;
    n.rot = 0;
    // objeto na mão
    if (u.item) {
      const [hx, hy, ang] = handPos(u, u.H), tilt = (u.hold === "flag" ? clamp01(0) : 0) + (ang + (u.holder === "R" ? 2.9 : -2.9))*.55 + (u.hold === "rifle" ? 0 : .05*Math.sin(t*2.1 + ph));
      u.item.setPosition(hx, hy);
      u.item.pole.setRotation(u.hold === "rifle" ? -.06 : tilt);
      if (u.rope) {
        const L = u.poleLen - 13*s, side = u.holder === "R" ? 1 : -1, ct = Math.cos(tilt), st = Math.sin(tilt);
        const lx = side*u.fw/2, ly = u.fh*.5 - 1.5*s;                         // centro da bandeira em relação ao topo do mastro (eixo do mastro)
        u.rope.setPosition(st*L + lx*ct - ly*st, -ct*L + lx*st + ly*ct);
        u.rope.setRotation(tilt);
        const pts = u.rope.points, N = pts.length, amp = (3.4 + ch*5)*s/u.rope.scaleX;
        for (let i = 0; i < N; i++) { const q = side > 0 ? i/(N - 1) : 1 - i/(N - 1); pts[i].y = Math.sin(t*7 - q*5 + ph)*amp*q*1.1; }
        u.rope.dirty = true;
      }
    }
  }
  /* o mastro cai no chão quando o torcedor é atingido */
  function dropItem(n) {
    const u = n.u; if (!u.item || u.hold !== "flag") return;
    const [hx, hy] = handPos(u, u.H);
    const sp = scene.add.container(0, 0);
    const pk = "pole" + u.poleLen, pole = img(pk); pole.setOrigin(.5, .5);
    const fk = flagKey(u.sideKey), fl = img(fk, u.fw); fl.setOrigin(0, 0); fl.setPosition(0, -u.poleLen*.5);
    sp.add([pole, fl]);
    const m = new Node(sp, "sort"); m.bias = 3;
    const x0 = n.x, z0 = n.z, vx = (Math.random() - .5)*1.6 + u.dir*.8, rot0 = (Math.random() - .5)*.5;
    const y = Math.max(.5, -(RIG.hip*u.s + hy)*n.k*n.sc/HY);
    m.at(x0 + (u.holder === "R" ? .25 : -.25), y, z0); m.rot = rot0;
    const vy0 = 1.2, land = .05;
    addFx(.9, (t) => { const yy = Math.max(land, y + vy0*t - 6*t*t); m.y = yy; m.x = x0 + vx*t*.5; m.rot = rot0 + t*(3.2 + u.dir) * (yy > land + .01 ? 1 : 0); }, () => {
      m.rot = rot0 + 1.5 + Math.random()*.6; m.y = .04; m.bias = 0; m.v.setScale(1, .6); fixed(m);
    });
  }

  /* ================================================================
     Capitães
     ================================================================ */
  function captainSpec(ch, s, fk) {
    const mil = !!ch.military, fem = !!ch.fem;
    return {
      fem, skin:ch.skin, hair:ch.hair, hairStyle:ch.hairStyle || "short", beard:ch.beard ? true : false, beardColor:ch.beardColor ?? null, glasses:!!ch.glasses,
      eye:0x3a2418, age:ch.age ?? 0, jacket:mil ? 0x4b5230 : (ch.suit ?? (fem ? s.main : 0x2c3d5c)), tie:s.main, tieStripe:s.alt, undershirt:fem ? s.alt : 0xf3f3f6,
      pocket:s.alt, pin:[s.main, s.alt], military:mil, sash:mil ? null : [s.main, s.alt], longSleeve:true, sleeve:mil ? 0x4b5230 : (ch.suit ?? (fem ? s.main : 0x2c3d5c)),
      pants:mil ? 0x3a4028 : (fem ? 0x1f2a3d : 0x1b2030), pantsType:"dark", shoes:0x15130f, legLen:38,
    };
  }
  function makeCaptain(sideKey, ch, dirSign = 1) {
    const s = ch.military ? cfg.NG_SIDE : cfg.SIDES[sideKey];
    const fk = ch.military ? "regime" : sideKey;
    const spec = captainSpec(ch, s, fk);
    const n = buildPerson(spec, { s:2.05, hold:"flag", flagKey:fk, holder:dirSign > 0 ? "L" : "R", pose:"captain" });
    n.k = (ch.boss || ch.military) ? 1.08 : 1;
    const lk = "lbl_" + ch.short + ch.party + s.css;
    tex(lk, () => Art.label(ch.short + " · " + ch.party, s.css));
    const lab = img(lk); lab.setPosition(0, (RIG.neck - 24)*1.75);
    n.v.add(lab);
    Object.assign(n.u, { kind:"captain", jump:0, shake:0, throwT:-1, base:{ x:0, y:0, z:0 }, dirSign, ch });
    n.u.pose = "captain";
    return n;
  }
  POSES.captain = function (u, t, ph) {
    const sd = u.holder === "R" ? 1 : -1;
    setArm(u.H, -sd*(2.2 + .05*Math.sin(t*1.4)), -sd*.3 + sd*.1*Math.sin(t*2.2));
    if (u.throwT < 0 && u.jump <= 0 && u.shake <= 0) setArm(u.F, -sd*(.12 + .05*Math.sin(t*1.2 + ph)), -sd*(.15 + .06*Math.sin(t*1.5)));
  };
  function updateCaptain(n, t, dt, b) {
    const u = n.u;
    updateFan(n, t, dt);                                     // respiração, olhar, bandeira
    const sdF = u.holder === "R" ? -1 : 1;                   // lado do braço livre
    let y = u.base.y, x = u.base.x, lean = 0;
    if (u.jump > 0) {
      u.jump = Math.max(0, u.jump - dt*1.1); const k = 1 - u.jump;
      y += Math.abs(Math.sin(k*Math.PI*2))*.55*(u.jump > .05 ? 1 : 0);
      setArm(u.F, sdF*(-2.5 + .2*Math.sin(t*14)), sdF*(-.4));
      setArm(u.H, (u.holder === "R" ? -1 : 1)*(2.6 + .15*Math.sin(t*12)), 0);
      u.headC.rotation = -.1;
    }
    if (u.shake > 0) {
      u.shake = Math.max(0, u.shake - dt*1.4);
      x += Math.sin(t*38)*.06*u.shake;
      lean = -u.dirSign*.14*Math.sin(Math.min(1, u.shake*1.6)*Math.PI*.5);
      setArm(u.F, sdF*(-.9*u.shake - .3), sdF*.6); u.headC.rotation = -u.dirSign*.3*u.shake;
    }
    if (u.throwT >= 0) {                                      // arremesso: prepara, lança, recolhe
      u.throwT += dt; const k = u.throwT, W = .3, R = .5;
      let a1, a2, lz;
      if (k < W) { const q = easeOut(k/W); a1 = sdF*(-1.0 - 1.6*q); a2 = sdF*(.4 + 1.0*q); lz = -.1*q*u.dirSign; }
      else if (k < R) { const q = (k - W)/(R - W); a1 = sdF*(-2.6 + 1.7*easeIn(q)); a2 = sdF*(1.4 - 1.8*q); lz = .2*q*u.dirSign - .1*u.dirSign*(1 - q); }
      else { const q = clamp01((k - R)/.35); a1 = sdF*(-.9 + .8*q); a2 = sdF*(-.4 + .5*q); lz = .1*(1 - q)*u.dirSign; if (q >= 1) u.throwT = -1; }
      setArm(u.F, a1, a2); lean = lz;
    }
    u.up.rotation += lean;
    n.x = x; n.y += y; n.z = u.base.z; n.alpha = 1;
  }
  function captainThrow(cp) { if (cp) cp.u.throwT = 0; }
  function chantBoost(v = .5) { chant = Math.min(1, chant + v); }
  function stepChant(dt) { chant = Math.max(0, chant - dt*.18); }

  /* ================================================================
     Veículos e peças arremessadas
     ================================================================ */
  function vehicleNode(key, make, w) {
    tex(key, make); shadowTex();
    const c = scene.add.container(0, 0);
    const sh = img("shadowdir"); sh.setScale((w || 70)/70/(texInfo.shadowdir.q || Q)); sh.setAlpha(.9);
    c.add([sh, img(key)]);
    return new Node(c);
  }
  /* inclinação/espelho da arte lateral para o eixo (ax, az) de deslocamento no mundo, na vista atual */
  function axisLook(ax, az) { const a = P(0, 0, 0), b = P(ax, 0, az), sx = b[0] - a[0], sy = b[1] - a[1]; return { shear:sy/sx, mirror:sx < 0, tag:(sy/sx > 0 ? "p" : "n") + (sx < 0 ? "m" : "r") }; }
  /* dir: +1 = anda no sentido +x, -1 = sentido -x (a direção na tela depende da vista) */
  function makeMoto(sideKey, dir) {
    const s = cfg.SIDES[sideKey], shirt = s.shirts[rand(s.shirts.length)], L = axisLook(dir, 0);
    const fl = tex("flag_" + sideKey, () => Art.flag(sideKey));
    const key = ["moto", sideKey, shirt, L.tag].join("_");
    const n = vehicleNode(key, () => Art.sheared(96, 70, 48, 63, L.shear, L.mirror, x => Art.drawMoto(x, { main:s.main, alt:s.alt, shirt, flag:fl })), 64);
    n.sc = 1.0; return n;
  }
  /* ônibus que anda no sentido -z (desce a coluna) */
  function makeBus(sideKey, len) {
    const s = cfg.SIDES[sideKey], Ln = Math.round(len*68), L = axisLook(0, -1);
    const fl = tex("flag_" + sideKey, () => Art.flag(sideKey));
    const key = ["bus", sideKey, Ln, L.tag].join("_");
    const n = vehicleNode(key, () => Art.sheared(Ln + 6, 70, (Ln + 6)/2, 63, L.shear, L.mirror, x => Art.drawBus(x, { main:s.main, alt:s.alt, flag:fl }, Ln)), Ln*.7); n.sc = 1.3; return n;
  }
  function makeSoundTruck(sideKey, dir) {
    const s = cfg.SIDES[sideKey], L = axisLook(dir, 0);
    const fl = tex("flag_" + sideKey, () => Art.flag(sideKey));
    const key = ["truck", sideKey, L.tag].join("_");
    const n = vehicleNode(key, () => Art.sheared(124, 90, 62, 70, L.shear, L.mirror, x => Art.drawTruck(x, { main:s.main, alt:s.alt, flag:fl })), 90); n.sc = 1.3; return n;
  }
  function makeHeli(sideKey, dir) {
    const s = cfg.SIDES[sideKey], L = axisLook(dir, 0);
    const key = ["heli", sideKey, L.tag].join("_");
    tex(key, () => Art.sheared(110, 70, 55, 40, L.shear, L.mirror, x => { x.translate(54, 14); Art.drawHeli(x, { main:s.main, alt:s.alt }); }));
    tex("shadow", () => Art.shadow());
    const c = scene.add.container(0, 0);
    const sh = img("shadow", 64); sh.setAlpha(.6);
    const im = img(key);
    tex("rotor", () => Art.rotor(86));
    const ro = img("rotor"); ro.setPosition(-2*(L.mirror ? -1 : 1), -52);
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
  function addDecal(x, z, color, r, kind) {
    const tk = kind === "splat" ? "splat" : "blob";
    tex(tk, () => tk === "splat" ? Art.splat() : Art.blob());
    const im = img(tk); im.setTint(color);
    const n = new Node(im, "flat"); n.u.tk = tk; n.at(x, 0, z); n.bias = 100 + decals.length*.01; n.alpha = kind === "splat" ? .92 : .88;
    flatScale(n, r*(.8 + Math.random()*.4)*(kind === "splat" ? 1.15 : 1));
    n.rot = Math.random()*6.28;
    decals.push(n); return n;
  }
  /* butim: moeda/item salta do corpo, brilha e sobe com o valor */
  function pickup(pos, kind, text, color = "#ffd23a") {
    const isCoin = kind === "coin", key = isCoin ? "coin" : "itemic_" + kind;
    tex(key, () => isCoin ? Art.coin() : Art.itemIcon(kind));
    const n = new Node(img(key, isCoin ? 26 : 34), "fx"); n.bias = 2000;
    const lk = "pk_" + text + color; tex(lk, () => Art.label(text, color));
    const lab = new Node(img(lk), "fx"); lab.bias = 2100; lab.alpha = 0;
    const vx = (Math.random() - .5)*1.2, vz = (Math.random() - .5)*.8;
    flash({ x:pos.x, y:.5, z:pos.z }, isCoin ? 0xffd23a : 0x8cf0ff, .5, .45);
    addFx(1.9, t => {
      const k = Math.min(1, t/.55), bounce = t < .55 ? Math.sin(Math.PI*k)*1.5 : t < .8 ? Math.sin(Math.PI*(t - .55)/.25)*.35 : 0;
      let y = .25 + bounce, a = 1;
      if (t > 1.3) { const q = (t - 1.3)/.6; y += q*2.2; a = 1 - q; }
      n.at(pos.x + vx*k, y, pos.z + vz*k); n.alpha = a; if (isCoin) n.fx = Math.abs(Math.cos(t*9));
      lab.at(pos.x + vx, .6 + t*.9 + .3, pos.z + vz); lab.alpha = Math.min(1, t*4)*(t > 1.5 ? Math.max(0, 1 - (t - 1.5)/.4) : 1);
    }, () => { n.destroy(); lab.destroy(); });
  }
  /* sombra projetada no chão por objetos no ar */
  function makeGroundShadow() {
    tex("blob", () => Art.blob());
    const im = img("blob"); im.setTint(0x000000);
    const n = new Node(im, "flat"); n.u.tk = "blob"; n.bias = 150; n.alpha = .3; flatScale(n, .2); return n;
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
    const m = Math.max(1, Math.round(n*.45));
    for (let i = 0; i < m; i++) {
      let p = free.pop();
      if (!p) { p = { im:scene.add.image(0, 0, "chip0").setDepth(D_FX) }; }
      p.im.setTexture("chip" + rand(3)); p.im.setTint(colors[rand(colors.length)]).setVisible(true).setAlpha(1);
      p.x = pos.x; p.y = (pos.y || 0) + .5; p.z = pos.z;
      p.vx = (Math.random() - .5)*power; p.vy = 2 + Math.random()*power; p.vz = (Math.random() - .5)*power;
      p.life = p.max = .8 + Math.random()*.6; p.spin = (Math.random() - .5)*14; p.s = .3 + Math.random()*.35;
      p.im.setBlendMode(0);
      parts.push(p);
    }
    for (let i = 0, k = Math.min(4, Math.ceil(n/8)); i < k; i++) puff({ x:pos.x + (Math.random() - .5)*.4, y:(pos.y || 0) + .1, z:pos.z + (Math.random() - .5)*.4 }, { color:0x9a8e7c, life:.9 + Math.random()*.5, s0:.12, s1:.42, a:.35, vy:.35 });
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

  /* ---------- fumaça e poeira: nuvens macias que sobem, crescem e somem ---------- */
  const puffs = [], puffFree = [];
  function puff(pos, o = {}) {
    tex("glow", () => Art.glow());
    let p = puffFree.pop(); if (!p) p = { im:scene.add.image(0, 0, "glow").setDepth(D_FX - 10) };
    const sp = P(pos.x, pos.y || 0, pos.z);
    Object.assign(p, { x:pos.x, y:pos.y || 0, z:pos.z, vx:(o.vx ?? (Math.random() - .5)*.5), vy:o.vy ?? (.6 + Math.random()*.6), vz:(o.vz ?? (Math.random() - .5)*.5), life:o.life ?? 1.6, max:o.life ?? 1.6, s0:o.s0 ?? .22, s1:o.s1 ?? .7, a:o.a ?? .35 });
    p.im.setTint(o.color ?? 0x2a2420).setBlendMode(o.add ? 1 : 0).setVisible(true).setPosition(sp[0], sp[1]);
    puffs.push(p);
  }
  const smoke = pos => puff(pos, { color:0x241e1a, life:2.4, s0:.18, s1:.9, a:.38, vy:1.1 });
  function stepPuffs(dt) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]; p.life -= dt;
      if (p.life <= 0) { p.im.setVisible(false); puffFree.push(p); puffs.splice(i, 1); continue; }
      p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt; p.vy *= .985;
      const k = 1 - p.life/p.max, sp = P(p.x, p.y, p.z);
      p.im.setPosition(sp[0], sp[1]).setScale(p.s0 + (p.s1 - p.s0)*k).setAlpha(p.a*Math.sin(Math.min(1, k*5 + .15)*Math.PI*.5)*(1 - k));
    }
  }
  /* ---------- correção de cor da câmera por cenário ---------- */
  let cmFilter = null;
  function grade(c = {}) {
    try {
      if (!cmFilter) cmFilter = cam.filters.internal.addColorMatrix();
      const m = cmFilter.colorMatrix; m.reset();
      m.saturate((c.sat ?? 1) - 1, true); m.contrast((c.con ?? 1) - 1, true); m.brightness(c.bri ?? 1, true);
      if (c.tint) m.multiply([c.tint[0], 0, 0, 0, 0, 0, c.tint[1], 0, 0, 0, 0, 0, c.tint[2], 0, 0, 0, 0, 0, 1, 0], true);
    } catch (e) { /* filtros indisponíveis */ }
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
      // sombra projetada no chão (deslocada na tela)
      { const cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => P(cx + sx*(half + .3), 0, sz*(half + .3)));
        g.fillStyle(0x000000, .22); g.beginPath(); cs.forEach((q, i) => i ? g.lineTo(q[0] + 12, q[1] + 16) : g.moveTo(q[0] + 12, q[1] + 16)); g.closePath(); g.fillPath(); }
      // laterais da moldura: as duas arestas que encostam no canto mais baixo da tela
      const lift = thick*HY, cs = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sz]) => P(cx + sx*half, 0, sz*half));
      let bi = 0; cs.forEach((q, i) => { if (q[1] > cs[bi][1]) bi = i; });
      [(bi + 3)%4, (bi + 1)%4].forEach(oi => {
        const A = cs[oi], B = cs[bi], left = A[0] < B[0];
        g.fillStyle(sh(fc, left ? .62 : .42), 1); g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.lineTo(B[0], B[1] + lift); g.lineTo(A[0], A[1] + lift); g.closePath(); g.fillPath();
      });
      // topo da moldura
      g.fillStyle(sh(fc, .92), 1); diamond(g, cx, 0, half); g.fillPath();
      g.lineStyle(2, sh(fc, 1.25), .9); diamond(g, cx, 0, half); g.strokePath();
      g.fillStyle(0x1a1d22, .92); diamond(g, cx, 0, n/2 + .04); g.fillPath();
      // casas
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        const tc = tileCenter(b, r, c), col = tileCol[b][r][c], mk = tileMark[b][r][c];
        g.fillStyle(col, 1); diamond(g, tc.x, tc.z, .47); g.fillPath();
        // brilho no topo e sombra embaixo
        const q4 = [P(tc.x - .47, 0, tc.z - .47), P(tc.x + .47, 0, tc.z - .47), P(tc.x + .47, 0, tc.z + .47), P(tc.x - .47, 0, tc.z + .47)];
        const top = q4.reduce((m, q) => q[1] < m[1] ? q : m), bot = q4.reduce((m, q) => q[1] > m[1] ? q : m), lef = q4.reduce((m, q) => q[0] < m[0] ? q : m), rig = q4.reduce((m, q) => q[0] > m[0] ? q : m);
        g.lineStyle(1.6, sh(col, 1.35), .75); g.beginPath(); g.moveTo(bot[0], bot[1]); g.lineTo(lef[0], lef[1]); g.lineTo(top[0], top[1]); g.strokePath();
        g.lineStyle(1.6, sh(col, .55), .85); g.beginPath(); g.moveTo(top[0], top[1]); g.lineTo(rig[0], rig[1]); g.lineTo(bot[0], bot[1]); g.strokePath();
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
  const view = { W:0, H:0, dpr:1, cx:0, cy:0, zoom:1, goalCx:0, goalCy:0, goalZoom:1, focus:-1, inited:false, uz:1, panX:0, panY:0 };
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
    z = Math.max(.28, Math.min(z, mobile ? 1.1 : 1.25))*view.uz;
    view.goalZoom = z;
    view.goalCx = (box.x0 + box.x1)/2 + view.panX;
    // centro do conteúdo no meio da faixa livre (entre HUD e painel)
    const midY = topH + freeH/2;
    view.goalCy = (box.y0 + box.y1)/2 - (midY - H/2)/z + view.panY;
  }
  function applyCam() {
    const d = view.dpr, z = view.zoom*d;
    cam.setZoom(z);
    cam.setScroll(view.cx - cam.width/2, view.cy - cam.height/2);
  }
  function setFocus(b) { view.focus = b; }
  /* zoom e deslocamento controlados pelo jogador */
  const clampPan = () => { const m = 900*Math.max(0, view.uz - .7); view.panX = Math.max(-m, Math.min(m, view.panX)); view.panY = Math.max(-m, Math.min(m, view.panY)); };
  function zoomBy(f) { view.uz = Math.max(.55, Math.min(3.2, view.uz*f)); clampPan(); }
  function panBy(dx, dy) { view.panX -= dx/view.zoom; view.panY -= dy/view.zoom; clampPan(); }
  function resetView() { view.uz = 1; view.panX = 0; view.panY = 0; }
  function setYaw(k) { yaw = ((k%4) + 4)%4; boardDirty = true; if (view.inited) { layoutGoal(); view.cx = view.goalCx; view.cy = view.goalCy; view.zoom = view.goalZoom; applyCam(); } }
  /* canto mais baixo (na tela) do tabuleiro b, afastado de pad casas: usado para as dicas flutuantes */
  function boardLowPoint(b, pad = .9) {
    const n = N(), half = n/2, cx = BXs()[b]; let best = null;
    [[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([sx, sz]) => { const q = P(cx + sx*half, 0, sz*half); if (!best || q[1] > best.y) best = { y:q[1], x:cx + sx*(half + pad), z:sz*(half + pad) }; });
    return best;
  }
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
    stepParts(dt); stepPuffs(dt); stepChant(dt);
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
    try { cam.filters.external.addVignette(.5, .5, .95, .26); } catch (e) { /* filtros indisponíveis: segue sem vinheta */ }
  }

  return {
    init, frame, pinToScreen, grade, puff, smoke, zoomBy, panBy, resetView, setYaw, boardLowPoint, rot, get yaw() { return yaw; }, runFx, addFx, resize, setFocus, shake, pick, P, unproj, depthOf, tex, img, flagKey, texInfo,
    get scene() { return scene; }, get cam() { return cam; }, get view() { return view; }, get cfg() { return cfg; },
    Node, nodes, drop, fixed, markers, tileCenter,
    makeFan, makeUnit, makeBossFan, makeCaptain, updateFan, updateCaptain, captainThrow, chantBoost,
    makeMoto, makeBus, makeSoundTruck, makeHeli, makeThrow, makeBullet, makeArrow, makeBomb, makeUmbrella, makeConeMark,
    makeRing, setRing, addDecal, makeGroundShadow, pickup, clearMarkers, burst, flash, makeHint, makeFlame, flicker, flameKey,
    setTile, setFrameColor, setPreview, clearPreview, D_GROUND, D_BOARD, D_FLAT, D_SORT, D_FX, D_HINT
  };
})();

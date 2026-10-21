/* ================================================================
   Pessoas em estilo ilustrado realista (canvas procedural).
   Cada figura é montada por partes articuladas (pernas, tronco, cabeça,
   braços) para o GFX animar com movimento natural. Nada é foto nem retrato
   de pessoa real: os personagens usam só traços genéricos (tom de pele,
   cabelo, barba, óculos) definidos em CHARS.
   ================================================================ */
"use strict";
const People = (() => {
  const { css, shade, mix, rgb, lin, rad } = Art;
  const QP = 3;
  const rnd = (a, b) => a + Math.random()*(b - a);
  const pick = a => a[Math.floor(Math.random()*a.length)];
  const rgba = (c, a) => { const [r, g, b] = rgb(c); return `rgba(${r},${g},${b},${a})`; };

  const SKINS = [0xf6d5bd, 0xf0c4a0, 0xe0ac82, 0xc68a62, 0x9a6540, 0x6e4529];
  const HAIRS = [0x15100c, 0x2b1d14, 0x4a3220, 0x6b4a2a, 0x8a6a3a, 0xc9a46a, 0x3a3a3c, 0xb8b8b8];

  function mk(w, h, ox, oy, draw) { return Art.bake(w, h, ox, oy, draw, QP); }

  /* membro cônico com sombreado transversal (claro à esquerda, escuro à direita) */
  function limb(x, ax, ay, bx, by, wa, wb, base, o = {}) {
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1;
    let nx = -dy/L, ny = dx/L; if (nx > 0) { nx = -nx; ny = -ny; }          // normal do lado iluminado
    const hw = Math.max(wa, wb)/2;
    const gx = (ax + bx)/2, gy = (ay + by)/2;
    const g = lin(x, gx + nx*hw, gy + ny*hw, gx - nx*hw, gy - ny*hw, [[0, css(shade(base, o.hi ?? 1.2))], [.45, css(base)], [1, css(shade(base, o.lo ?? .62))]]);
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(ax + nx*wa/2, ay + ny*wa/2); x.lineTo(bx + nx*wb/2, by + ny*wb/2); x.lineTo(bx - nx*wb/2, by - ny*wb/2); x.lineTo(ax - nx*wa/2, ay - ny*wa/2); x.closePath(); x.fill();
    x.beginPath(); x.arc(ax, ay, wa/2, 0, 7); x.fill();
    x.beginPath(); x.arc(bx, by, wb/2, 0, 7); x.fill();
  }
  /* mechas de cabelo: traços finos seguindo uma direção, recortados pela forma do cabelo */
  function strands(x, clip, base, n, ang, len, spread = 1) {
    x.save(); clip(x); x.clip();
    for (let i = 0; i < n; i++) {
      const k = rnd(.55, 1.5), c = k > 1 ? shade(base, 1 + (k - 1)*.55) : shade(base, k);
      x.strokeStyle = rgba(c, rnd(.25, .6)); x.lineWidth = rnd(.18, .42);
      const px = rnd(-7, 7)*spread, py = rnd(-8, 1), a = ang + rnd(-.35, .35), l = len*rnd(.5, 1);
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a)*l*.5 + rnd(-1, 1), py + Math.sin(a)*l*.5, px + Math.cos(a)*l, py + Math.sin(a)*l); x.stroke();
    }
    x.restore();
  }
  const soft = (x, cx, cy, rx, ry, color, a, rot = 0) => {
    x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(1, ry/rx);
    x.fillStyle = rad(x, 0, 0, 0, rx, [[0, rgba(color, a)], [1, rgba(color, 0)]]); x.beginPath(); x.arc(0, 0, rx, 0, 7); x.fill(); x.restore();
  };

  /* ================================================================
     CABEÇA (origem: base do pescoço)
     spec: skin, hair, hairStyle(short|bald|bob|long|buzz|none), cap{color}, beard, beardColor, glasses, fem, age(0..1), eye
     s = escala (1 = torcedor; ~2.9 = capitão)
     ================================================================ */
  function head(spec, s = 1) {
    const W = 44*s, H = (spec.hairStyle === "long" ? 78 : 54)*s;
    const cx = W/2, cy = 27*s;                           // centro do rosto
    return mk(W, H, cx, cy + 9.6*s, x => {
      x.translate(cx, cy); x.scale(s, s);
      const sk = spec.skin, hr = spec.hair, fem = !!spec.fem, hs = spec.hairStyle || "short";
      const fw = fem ? 5.1 : 5.6, ch = fem ? 6.9 : 6.7;  // meia-largura / meia-altura do rosto
      const facePath = () => {
        x.beginPath(); x.moveTo(0, -6.9);
        x.bezierCurveTo(fw*.98, -6.9, fw*1.04, -2.4, fw*.96, 1.8);
        x.bezierCurveTo(fw*.9, 4.6, fw*.5, ch - .2, 0, ch + .1);
        x.bezierCurveTo(-fw*.5, ch - .2, -fw*.9, 4.6, -fw*.96, 1.8);
        x.bezierCurveTo(-fw*1.04, -2.4, -fw*.98, -6.9, 0, -6.9); x.closePath();
      };
      /* cabelo de trás */
      const backHair = () => {
        if (hs === "long") {
          const lp = c => { c.beginPath(); c.moveTo(-6.2, -3); c.bezierCurveTo(-8.6, 4, -8.2, 14, -6.2, 21); c.quadraticCurveTo(-3, 23.6, 0, 22.4); c.quadraticCurveTo(3, 23.6, 6.2, 21); c.bezierCurveTo(8.2, 14, 8.6, 4, 6.2, -3); c.closePath(); };
          lp(x); x.fillStyle = lin(x, 0, -4, 0, 24, [[0, css(shade(hr, .85))], [1, css(shade(hr, .5))]]); x.fill();
          strands(x, lp, hr, 70, Math.PI/2, 20, .9);
        } else if (hs === "bob") {
          x.beginPath(); x.moveTo(-6.2, -3); x.bezierCurveTo(-8.2, 2, -7.8, 7, -6.6, 9.2); x.lineTo(6.6, 9.2); x.bezierCurveTo(7.8, 7, 8.2, 2, 6.2, -3); x.closePath();
          x.fillStyle = lin(x, 0, -3, 0, 9, [[0, css(shade(hr, .9))], [1, css(shade(hr, .55))]]); x.fill();
        }
      };
      backHair();
      /* orelhas */
      [-1, 1].forEach(sd => {
        x.beginPath(); x.ellipse(sd*(fw + .35), .8, 1.15, 2.1, 0, 0, 7);
        x.fillStyle = css(shade(sk, sd < 0 ? 1 : .85)); x.fill(); x.strokeStyle = rgba(shade(sk, .5), .6); x.lineWidth = .3; x.stroke();
      });
      /* rosto */
      facePath();
      x.fillStyle = rad(x, 0, 0, 1, 9, [[0, css(shade(sk, 1.1))], [.65, css(sk)], [1, css(shade(sk, .74))]], -1.8, -2.4); x.fill();
      x.save(); facePath(); x.clip();
      soft(x, -fw + .4, 1, 2.6, 6.4, shade(sk, .45), .22);                  // sombra lateral
      soft(x, fw - .4, 1.5, 2.6, 6.4, shade(sk, .35), .34);
      soft(x, 0, ch + 1.2, 6, 2.6, shade(sk, .4), .4);                      // sob o queixo
      soft(x, -2.4, -4.6, 3.6, 1.8, 0xffffff, .2);                          // brilho na testa
      soft(x, -3.2, 2.8, 1.8, 1.2, 0xe08070, .17); soft(x, 3.2, 2.8, 1.8, 1.2, 0xd07060, .14);   // bochechas
      x.restore();
      x.lineWidth = .35; x.strokeStyle = rgba(shade(sk, .45), .55); facePath(); x.stroke();
      /* olhos */
      const ey = -.7, ex = fem ? 2.35 : 2.25;
      [-1, 1].forEach(sd => {
        const px = sd*ex;
        soft(x, px, ey - .2, 1.9, 1.1, shade(sk, .45), .3);                                  // cavidade
        x.beginPath(); x.ellipse(px, ey, 1.28, .72, 0, 0, 7); x.fillStyle = "#eee9e2"; x.fill();
        x.beginPath(); x.arc(px + sd*.04, ey + .02, .58, 0, 7); x.fillStyle = css(spec.eye ?? 0x4a3020); x.fill();
        x.beginPath(); x.arc(px + sd*.04, ey + .02, .28, 0, 7); x.fillStyle = "#0c0806"; x.fill();
        x.fillStyle = "rgba(255,255,255,.85)"; x.fillRect(px - .1, ey - .32, .26, .26);
        x.strokeStyle = rgba(shade(hr < 0x444444 ? 0x2a1e16 : mix(hr, 0x222222, .5), 1), .9); x.lineWidth = fem ? .42 : .34;      // pálpebra superior
        x.beginPath(); x.moveTo(px - 1.35, ey + .05); x.quadraticCurveTo(px, ey - 1.15, px + 1.35, ey + .05); x.stroke();
        x.strokeStyle = rgba(shade(sk, .6), .35); x.lineWidth = .22; x.beginPath(); x.moveTo(px - 1.2, ey + .75); x.quadraticCurveTo(px, ey + 1.1, px + 1.2, ey + .75); x.stroke();
        // sobrancelha
        x.strokeStyle = rgba(hs === "bald" && !spec.beard ? mix(hr, 0x222222, .4) : mix(hr, 0x1a1208, .35), .92); x.lineWidth = fem ? .42 : .6; x.lineCap = "round";
        x.beginPath(); x.moveTo(px - sd*1.5, ey - 1.6 + (fem ? .1 : 0)); x.quadraticCurveTo(px + sd*.1, ey - 2.45, px + sd*1.9, ey - 1.55 + sd*0); x.stroke();
      });
      /* nariz */
      x.strokeStyle = rgba(shade(sk, .5), .45); x.lineWidth = .35;
      x.beginPath(); x.moveTo(.55, .4); x.quadraticCurveTo(1.15, 2.1, .2, 2.65); x.stroke();
      soft(x, .3, 2.5, 1.5, 1, shade(sk, .45), .35); soft(x, -.5, 1, .6, 1.8, 0xffffff, .16);
      x.fillStyle = rgba(0x20100a, .55); x.beginPath(); x.ellipse(-.45, 2.9, .32, .2, 0, 0, 7); x.fill(); x.beginPath(); x.ellipse(.95, 2.9, .32, .2, 0, 0, 7); x.fill();
      /* boca */
      const lip = fem ? 0xc8506a : mix(sk, 0xb05060, .45);
      x.fillStyle = css(shade(lip, .9)); x.beginPath(); x.moveTo(-1.95, 4.35); x.quadraticCurveTo(-.9, 3.75, 0, 3.95); x.quadraticCurveTo(.9, 3.75, 1.95, 4.35); x.quadraticCurveTo(0, 4.7, -1.95, 4.35); x.fill();
      x.fillStyle = css(lip); x.beginPath(); x.moveTo(-1.8, 4.4); x.quadraticCurveTo(0, 5.7, 1.8, 4.4); x.quadraticCurveTo(0, 4.7, -1.8, 4.4); x.fill();
      x.strokeStyle = rgba(0x40161c, .65); x.lineWidth = .28; x.beginPath(); x.moveTo(-2, 4.38); x.quadraticCurveTo(0, 4.9, 2, 4.38); x.stroke();
      /* rugas da idade */
      const age = spec.age || 0;
      if (age > 0) {
        x.strokeStyle = rgba(shade(sk, .5), .22 + age*.3); x.lineWidth = .25;
        [-4.1, -3.4, -2.7].forEach(yy => { x.beginPath(); x.moveTo(-3.3, yy); x.quadraticCurveTo(0, yy - .5, 3.3, yy); x.stroke(); });
        [-1, 1].forEach(sd => { x.beginPath(); x.moveTo(sd*2.2, 2.9); x.quadraticCurveTo(sd*3.1, 4.3, sd*2.8, 5.3); x.stroke(); x.beginPath(); x.moveTo(sd*3.8, -.4); x.lineTo(sd*4.6, -.9); x.moveTo(sd*3.8, .3); x.lineTo(sd*4.7, .5); x.stroke(); });
      }
      /* barba */
      if (spec.beard) {
        const bc = spec.beardColor ?? hr, full = spec.beard !== "stubble";
        const bp = () => {
          x.beginPath(); x.moveTo(-fw*.97, .4); x.bezierCurveTo(-fw*1.0, 5.6, -3, ch + 1.2, 0, ch + 1.5); x.bezierCurveTo(3, ch + 1.2, fw*1.0, 5.6, fw*.97, .4);
          x.bezierCurveTo(fw*.7, 2.6, 3.6, 2.6, 2.6, 3.2); x.quadraticCurveTo(0, 2.6, -2.6, 3.2); x.bezierCurveTo(-3.6, 2.6, -fw*.7, 2.6, -fw*.97, .4); x.closePath();
        };
        bp(); x.fillStyle = full ? lin(x, 0, 2, 0, ch + 1.5, [[0, css(shade(bc, .95))], [1, css(shade(bc, .62))]]) : rgba(bc, .35); x.fill();
        if (full) strands(x, c => bp(), bc, 90, Math.PI/2, 4.6, .8);
        // bigode
        x.beginPath(); x.moveTo(-2.9, 3.4); x.quadraticCurveTo(0, 2.5, 2.9, 3.4); x.quadraticCurveTo(0, 4.0, -2.9, 3.4); x.fillStyle = rgba(shade(bc, .8), full ? .95 : .5); x.fill();
        if (full) { x.fillStyle = rgba(lip, .9); x.beginPath(); x.ellipse(0, 4.7, 1.3, .35, 0, 0, 7); x.fill(); }
      }
      /* cabelo da frente */
      const hairShape = () => {
        if (hs === "bald" || hs === "none") return false;
        x.beginPath();
        if (hs === "buzz") { x.moveTo(-fw*.98, -.8); x.bezierCurveTo(-fw*1.25, -10.6, fw*1.25, -10.6, fw*.98, -.8); x.bezierCurveTo(fw*.8, -4.6, fw*.4, -5.2, 0, -5.4); x.bezierCurveTo(-fw*.4, -5.2, -fw*.8, -4.6, -fw*.98, -.8); }
        else if (hs === "short") {
          x.moveTo(-fw*1.02, 1); x.bezierCurveTo(-fw*1.36, -11.2, fw*1.36, -11.2, fw*1.02, 1);
          x.bezierCurveTo(fw*.92, -2.6, fw*.7, -3.7, fw*.2, -4.3); x.bezierCurveTo(-fw*.3, -3.4, -fw*.8, -3.6, -fw*1.02, 1);
        } else if (hs === "bob" || hs === "long") {
          x.moveTo(-fw*1.05, 4.2); x.bezierCurveTo(-fw*1.45, -11.6, fw*1.45, -11.6, fw*1.05, 4.2);
          x.bezierCurveTo(fw*.98, -1.2, fw*.5, -4.6, -fw*.1, -4.8); x.bezierCurveTo(-fw*.55, -4.2, -fw*.95, -1.4, -fw*1.05, 4.2);
        }
        x.closePath(); return true;
      };
      if (hairShape()) {
        x.fillStyle = lin(x, -4, -8, 5, 0, [[0, css(shade(hr, 1.4))], [.5, css(hr)], [1, css(shade(hr, .6))]]); hairShape(); x.fill();
        strands(x, c => hairShape(), hr, hs === "buzz" ? 160 : 110, hs === "long" || hs === "bob" ? Math.PI/2.1 : .5, hs === "buzz" ? 1.2 : 5.2, 1);
        x.strokeStyle = rgba(shade(hr, .45), .55); x.lineWidth = .3; hairShape(); x.stroke();
        soft(x, -1.4, -5.6, 3, 1.1, 0xffffff, hs === "buzz" ? .08 : .22);                   // brilho do cabelo
        if (hs === "long") [-1, 1].forEach(sd => {
          const lock = c => { c.beginPath(); c.moveTo(sd*fw*.98, -1); c.bezierCurveTo(sd*fw*1.5, 5, sd*fw*1.5, 12, sd*fw*1.2, 19); c.quadraticCurveTo(sd*fw*.8, 20, sd*fw*.62, 15); c.bezierCurveTo(sd*fw*.9, 9, sd*fw*.8, 4, sd*fw*.7, 1); c.closePath(); };
          lock(x); x.fillStyle = lin(x, 0, -1, 0, 19, [[0, css(shade(hr, 1.05))], [1, css(shade(hr, .55))]]); x.fill(); strands(x, lock, hr, 28, Math.PI/2, 14, 1); x.strokeStyle = rgba(shade(hr, .4), .5); x.lineWidth = .3; lock(x); x.stroke();
        });
      } else if (hs === "bald") {
        soft(x, -1.4, -5.6, 3.2, 1.6, 0xffffff, .3);
        x.fillStyle = rgba(hr, .75); [-1, 1].forEach(sd => { x.beginPath(); x.ellipse(sd*(fw - .2), -.9, .9, 2.1, sd*.15, 0, 7); x.fill(); });
      }
      if (spec.zombie) {
        [-1, 1].forEach(sd => { soft(x, sd*2.3, ey, 2.2, 1.6, 0x1a0a0a, .55); x.fillStyle = "#ff3a2a"; x.beginPath(); x.ellipse(sd*2.3, ey, .62, .5, 0, 0, 7); x.fill(); });
        x.fillStyle = "rgba(40,10,10,.8)"; x.beginPath(); x.ellipse(0, 4.8, 1.8, 1.1, 0, 0, 7); x.fill();
        x.fillStyle = "rgba(230,230,200,.9)"; for (let i = -1; i <= 1; i++) x.fillRect(i*.9 - .3, 4.0, .55, .7);
        x.strokeStyle = "rgba(90,20,20,.7)"; x.lineWidth = .35; x.beginPath(); x.moveTo(2.4, -5.2); x.lineTo(3.8, -2.6); x.moveTo(-3.6, 1.8); x.lineTo(-2.4, 4); x.stroke();
        x.fillStyle = "rgba(120,30,30,.5)"; x.beginPath(); x.ellipse(3.1, 1.2, .9, .5, .4, 0, 7); x.fill();
      }
      if (spec.horns) [-1, 1].forEach(sd => { x.beginPath(); x.moveTo(sd*3.4, -5.4); x.quadraticCurveTo(sd*7.4, -8.6, sd*5.8, -14); x.quadraticCurveTo(sd*4.6, -9.2, sd*1.8, -6.2); x.closePath(); x.fillStyle = lin(x, 0, -14, 0, -5, [[0, "#f1e8d4"], [1, "#8a7a58"]]); x.fill(); x.strokeStyle = "rgba(40,30,20,.7)"; x.lineWidth = .4; x.stroke(); });
      if (spec.helmet) {
        const hel = () => { x.beginPath(); x.moveTo(-fw*1.2, -.2); x.bezierCurveTo(-fw*1.5, -11.8, fw*1.5, -11.8, fw*1.2, -.2); x.quadraticCurveTo(fw*1.3, 1.4, fw*.9, 1.2); x.lineTo(-fw*.9, 1.2); x.quadraticCurveTo(-fw*1.3, 1.4, -fw*1.2, -.2); x.closePath(); };
        hel(); x.fillStyle = lin(x, -6, -9, 6, 1, [[0, "#6f8348"], [.55, "#4b5c2e"], [1, "#222c14"]]); x.fill(); x.strokeStyle = "rgba(10,14,6,.85)"; x.lineWidth = .45; x.stroke();
        x.save(); hel(); x.clip(); x.fillStyle = "rgba(20,28,10,.55)"; [[-3.4, -6, 2.2], [2.8, -4.2, 1.8], [-.4, -8.2, 1.4], [4.6, -7.4, 1.5]].forEach(([a, b, r]) => { x.beginPath(); x.ellipse(a, b, r*1.5, r, .4, 0, 7); x.fill(); }); x.restore();
        x.strokeStyle = "rgba(20,24,12,.9)"; x.lineWidth = .5; [-1, 1].forEach(sd => { x.beginPath(); x.moveTo(sd*fw*.95, .8); x.lineTo(sd*fw*.6, 5.2); x.stroke(); });
      }
      /* óculos */
      if (spec.glasses) {
        const lw = .55, gy = ey - .05;
        x.strokeStyle = "rgba(14,12,12,.95)"; x.lineWidth = lw*.72;
        [-1, 1].forEach(sd => { x.beginPath(); x.rect(sd*2.3 - 1.9, gy - 1.25, 3.8, 2.5); x.stroke(); x.fillStyle = "rgba(170,205,235,.22)"; x.fill(); x.fillStyle = "rgba(255,255,255,.32)"; x.fillRect(sd*2.3 - 1.4, gy - .9, 1, .5); });
        x.beginPath(); x.moveTo(-.4, gy - .4); x.lineTo(.4, gy - .4); x.moveTo(-4.3, gy - .6); x.lineTo(-fw - .2, gy - .8); x.moveTo(4.3, gy - .6); x.lineTo(fw + .2, gy - .8); x.stroke();
      }
      /* boné */
      if (spec.cap) {
        const cc = spec.cap.color, capShape = () => { x.beginPath(); x.moveTo(-fw*1.12, -.6); x.bezierCurveTo(-fw*1.3, -9.6, fw*1.3, -9.6, fw*1.12, -.6); x.quadraticCurveTo(0, -3.4, -fw*1.12, -.6); x.closePath(); };
        capShape(); x.fillStyle = lin(x, -5, -8, 5, -1, [[0, css(shade(cc, 1.35))], [.55, css(cc)], [1, css(shade(cc, .6))]]); x.fill();
        x.strokeStyle = rgba(shade(cc, .4), .7); x.lineWidth = .35; x.stroke();
        x.strokeStyle = rgba(shade(cc, 1.4), .3); x.lineWidth = .25; [-2.4, 0, 2.4].forEach(a => { x.beginPath(); x.moveTo(a*.35, -7.6); x.quadraticCurveTo(a*1.4, -4.6, a*1.7, -1.6); x.stroke(); });
        x.beginPath(); x.moveTo(-fw*.9, -1.7); x.quadraticCurveTo(0, 2.1, fw*1.1, -1.9); x.quadraticCurveTo(fw*1.9, -.9, fw*1.6, -.4); x.quadraticCurveTo(0, 3.4, -fw*1.1, -.6); x.closePath();
        x.fillStyle = css(shade(cc, .72)); x.fill(); x.strokeStyle = rgba(shade(cc, .35), .8); x.lineWidth = .35; x.stroke();
        if (spec.cap.logo) { x.fillStyle = css(spec.cap.logo); x.beginPath(); x.arc(0, -5.4, .95, 0, 7); x.fill(); }
      }
    });
  }

  /* ================================================================
     TRONCO (origem: base do pescoço, no meio dos ombros)
     ================================================================ */
  function torso(spec, s = 1) {
    const W = 44*s, H = 52*s, fem = !!spec.fem, sw = fem ? 9.6 : 11.2, ww = fem ? 7.4 : 8.8, len = (spec.torsoLen || 26);
    return mk(W, H, W/2, 9*s, x => {
      x.translate(W/2, 9*s); x.scale(s, s);
      const sh = spec.shirt;
      // pescoço
      limb(x, 0, -5.4, 0, 1.6, 4.3, 5.6, spec.skin, { lo: .72 });
      soft(x, 0, -.4, 2.8, 2.4, shade(spec.skin, .4), .4);
      // camisa
      const body = () => {
        x.beginPath(); x.moveTo(-sw*.5, -.6); x.bezierCurveTo(-sw*.8, -.4, -sw*1.02, .6, -sw*1.06, 3.4);
        x.bezierCurveTo(-sw*1.02, 9, -ww - .6, 15, -ww - .2, len); x.lineTo(-ww - .4, len + 2.4);
        x.quadraticCurveTo(0, len + 3.6, ww + .4, len + 2.4); x.lineTo(ww + .2, len);
        x.bezierCurveTo(ww + .6, 15, sw*1.02, 9, sw*1.06, 3.4); x.bezierCurveTo(sw*1.02, .6, sw*.8, -.4, sw*.5, -.6);
        x.quadraticCurveTo(0, 1.2, -sw*.5, -.6); x.closePath();
      };
      body(); x.fillStyle = lin(x, -sw, 0, sw, 0, [[0, css(shade(sh, 1.28))], [.38, css(sh)], [.8, css(shade(sh, .72))], [1, css(shade(sh, .58))]]); x.fill();
      x.save(); body(); x.clip();
      // detalhes (faixas laterais, mangas listradas)
      if (spec.stripe) { x.fillStyle = css(spec.stripe); x.fillRect(-sw - 2, 2.4, sw*2 + 4, 1.7); x.globalAlpha = .9; x.fillRect(-sw - 2, 2.4, sw*2 + 4, 1.7); x.globalAlpha = 1; }
      // dobras do tecido
      x.strokeStyle = "rgba(0,0,0,.2)"; x.lineWidth = .5;
      [[-5.2, 7, -3.2, 17, -4.6, 24], [4.6, 8, 3.2, 17, 4.9, 25], [-1.2, 12, -.6, 19, -1.6, 26]].forEach(([a, b, c, d, e, f]) => { x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(c, d, e, f); x.stroke(); });
      x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = .6; x.beginPath(); x.moveTo(-6.6, 6); x.quadraticCurveTo(-5.6, 15, -6.8, 24); x.stroke();
      if (fem) { soft(x, -3.2, 8.6, 2.6, 2.2, 0xffffff, .12); soft(x, 3.4, 8.6, 2.6, 2.2, 0x000000, .12); }
      else { soft(x, -3.6, 6.4, 3.4, 2.6, 0xffffff, .1); soft(x, 3.8, 6.6, 3.4, 2.6, 0x000000, .12); }
      soft(x, 0, len + 1, 10, 3.2, 0x000000, .26);                                  // sombra na barra
      // gola
      if (spec.collar) {
        const cc = spec.collar;
        x.beginPath(); x.moveTo(-3.4, -.9); x.lineTo(0, 6.4); x.lineTo(3.4, -.9); x.lineTo(2.2, -1.2); x.lineTo(0, 3.6); x.lineTo(-2.2, -1.2); x.closePath();
        x.fillStyle = css(spec.skin); x.fill();
        x.beginPath(); x.moveTo(-3.6, -1); x.lineTo(0, 6.8); x.lineTo(3.6, -1); x.lineTo(5.2, 0); x.lineTo(0, 9); x.lineTo(-5.2, 0); x.closePath(); x.fillStyle = css(cc); x.fill();
        x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = .35; x.stroke();
      }
      // emblema
      if (spec.crest) {
        x.save(); x.translate(-4.4, 8.8); x.fillStyle = css(spec.crest[0]); x.beginPath(); x.moveTo(0, -2.1); x.lineTo(2.2, 0); x.lineTo(0, 2.1); x.lineTo(-2.2, 0); x.closePath(); x.fill();
        x.fillStyle = css(spec.crest[1]); x.beginPath(); x.arc(0, 0, .95, 0, 7); x.fill(); x.restore();
      }
      x.restore();
      x.strokeStyle = rgba(shade(sh, .38), .75); x.lineWidth = .4; body(); x.stroke();
    });
  }

  /* ================================================================
     PERNAS (origem: centro do quadril)
     spec: pants (cor), pantsType(jeans|shorts|dark|skirt), shoes, skin
     ================================================================ */
  function legs(spec, s = 1) {
    const W = 40*s, H = 52*s, pc = spec.pants, fem = !!spec.fem, LEN = spec.legLen || 38;
    return mk(W, H, W/2, 1*s, x => {
      x.translate(W/2, 1*s); x.scale(s, s);
      const sp = fem ? 4.3 : 4.6;
      const type = spec.pantsType || "jeans";
      [1, -1].forEach(sd => {                               // sd=-1: perna da esquerda (mais iluminada)
        const cx = sd*sp, back = sd > 0;
        const skinLeg = type === "shorts" || type === "skirt";
        const knee = skinLeg ? (type === "skirt" ? LEN*.36 : LEN*.46) : LEN;
        // pele (canela) quando bermuda
        if (skinLeg) limb(x, cx*1.05, knee - 1, cx*1.12, LEN - 3.4, 6.2, 4.6, spec.skin);
        // calça
        const w0 = fem ? 8.2 : 9.4, w1 = skinLeg ? 9 : (fem ? 6.2 : 7.4);
        const bx = cx*(skinLeg ? 1.08 : 1.18);
        limb(x, cx, 0, bx, knee, w0, w1, pc, { hi: back ? 1.05 : 1.18, lo: back ? .45 : .6 });
        // dobras da calça
        x.save(); x.strokeStyle = "rgba(0,0,0,.22)"; x.lineWidth = .45;
        const kneeY = LEN*.5;
        if (!skinLeg) { [[-1.8, 2], [1.4, 3.4]].forEach(([dx, dy]) => { x.beginPath(); x.moveTo(cx + dx*sd, kneeY + dy - 2); x.quadraticCurveTo(cx + dx*sd*.2, kneeY + dy, cx + dx*sd*-0.6, kneeY + dy + 1.6); x.stroke(); });
          x.strokeStyle = "rgba(255,255,255,.1)"; x.lineWidth = .8; x.beginPath(); x.moveTo(cx - 2.4*sd*-1, 4); x.quadraticCurveTo(cx, LEN*.4, bx - 2.2*sd*-1, LEN - 6); x.stroke(); }
        x.restore();
        if (type === "jeans") { x.fillStyle = "rgba(255,255,255,.1)"; x.beginPath(); x.ellipse(cx, 8, 2.4, 6, 0, 0, 7); x.fill(); x.fillStyle = css(shade(pc, 1.25)); x.fillRect(bx - 3.6, LEN - 2.6, 7.2, 1.4); }
        // sapato
        const sx = bx + sd*.8, sy = LEN + 1.4;
        x.save(); x.translate(sx, sy); x.scale(sd < 0 ? -1 : 1, 1);
        x.beginPath(); x.moveTo(-3.6, -2.4); x.lineTo(-3.4, 1.6); x.quadraticCurveTo(-3.8, 3.8, -2.4, 3.9); x.lineTo(4.6, 3.9); x.quadraticCurveTo(7.6, 3.6, 7, 1.6); x.quadraticCurveTo(5.4, -.2, 2.8, -.6); x.lineTo(2.2, -2.4); x.closePath();
        x.fillStyle = lin(x, 0, -2, 0, 4, [[0, css(shade(spec.shoes, 1.3))], [1, css(shade(spec.shoes, .6))]]); x.fill(); x.strokeStyle = "rgba(0,0,0,.55)"; x.lineWidth = .4; x.stroke();
        x.fillStyle = "#f2efe8"; x.beginPath(); x.moveTo(-3.6, 2.6); x.lineTo(7.1, 2.6); x.quadraticCurveTo(7.4, 4.6, 5.6, 4.7); x.lineTo(-2.6, 4.7); x.quadraticCurveTo(-4, 4.6, -3.6, 2.6); x.fill();
        x.restore();
      });
      if (type === "skirt") {
        x.beginPath(); x.moveTo(-sp - 5.4, -1); x.lineTo(sp + 5.4, -1); x.lineTo(sp + 7.4, LEN*.4); x.quadraticCurveTo(0, LEN*.46, -sp - 7.4, LEN*.4); x.closePath();
        x.fillStyle = lin(x, -sp - 7, 0, sp + 7, 0, [[0, css(shade(pc, 1.2))], [1, css(shade(pc, .6))]]); x.fill(); x.strokeStyle = rgba(shade(pc, .4), .7); x.lineWidth = .4; x.stroke();
      }
      // pelve / sombra entre as pernas
      soft(x, 0, 6, 3, 8, 0x000000, .3);
    });
  }

  /* ================================================================
     BRAÇOS: braço (origem no ombro) e antebraço+mão (origem no cotovelo)
     ================================================================ */
  function upperArm(spec, s = 1) {
    const W = 14*s, H = 24*s, ul = spec.upperLen || 15, sl = spec.sleeveLen ?? 8;
    return mk(W, H, W/2, 3*s, x => {
      x.translate(W/2, 3*s); x.scale(s, s);
      const wA = spec.fem ? 4.3 : 5.2, wB = spec.fem ? 3.7 : 4.4;
      limb(x, 0, 0, 0, ul, wA, wB, spec.skin);
      // manga
      const sl2 = Math.min(ul, sl);
      limb(x, 0, 0, 0, sl2, wA + 1.1, wB + 1.1 + (sl2 < ul ? .3 : 0), spec.sleeve ?? spec.shirt, { hi: 1.18, lo: .56 });
      x.strokeStyle = "rgba(0,0,0,.28)"; x.lineWidth = .4; x.beginPath(); x.moveTo(-wB/2 - .5, sl2); x.lineTo(wB/2 + .5, sl2); x.stroke();
      if (spec.sleeveStripe && sl2 < ul) { x.fillStyle = css(spec.sleeveStripe); x.fillRect(-wB/2 - .6, sl2 - 2.2, wB + 1.2, 1.1); }
      ell(x, 0, 0, wA*.55, 1.9);                          // volume do ombro
    });
    function ell(x, cx, cy, rx, ry) { x.fillStyle = css(spec.sleeve ?? spec.shirt); x.beginPath(); x.ellipse(cx, cy + .6, rx, ry, 0, 0, 7); x.fill(); }
  }
  /* mão: "fist" (segurando mastro) | "open" (relaxada) | "wave" */
  function foreArm(spec, hand = "open", s = 1) {
    const W = 14*s, H = 28*s, fl = spec.foreLen || 14;
    return mk(W, H, W/2, 2*s, x => {
      x.translate(W/2, 2*s); x.scale(s, s);
      const wA = spec.fem ? 3.7 : 4.3, wB = spec.fem ? 2.9 : 3.4;
      limb(x, 0, 0, 0, fl, wA, wB, spec.skin);
      soft(x, 0, fl*.35, 1.6, 4, 0xffffff, .12);
      if (spec.longSleeve) {
        limb(x, 0, -1, 0, fl - 2.4, wA + 1.2, wB + 1.5, spec.sleeve, { hi: 1.2, lo: .55 });
        x.fillStyle = "#f2f2f4"; x.fillRect(-wB/2 - .9, fl - 2.6, wB + 1.8, 1.9); x.strokeStyle = "rgba(0,0,0,.3)"; x.lineWidth = .3; x.strokeRect(-wB/2 - .9, fl - 2.6, wB + 1.8, 1.9);
      }
      // mão
      const hx = 0, hy = fl + 1.2;
      if (hand === "fist") {
        x.fillStyle = lin(x, -2.6, 0, 2.6, 0, [[0, css(shade(spec.skin, 1.15))], [1, css(shade(spec.skin, .65))]]);
        x.beginPath(); x.ellipse(hx, hy + .8, 2.9, 3.1, 0, 0, 7); x.fill(); x.strokeStyle = rgba(shade(spec.skin, .45), .6); x.lineWidth = .3; x.stroke();
        x.strokeStyle = rgba(shade(spec.skin, .5), .6); x.lineWidth = .28; [0, 1, 2].forEach(i => { x.beginPath(); x.moveTo(-2.2, hy - .2 + i*1.1); x.lineTo(2.1, hy - .2 + i*1.1); x.stroke(); });
        x.fillStyle = css(shade(spec.skin, 1.05)); x.beginPath(); x.ellipse(2.5, hy - 1.2, 1, 1.7, .3, 0, 7); x.fill();
      } else {
        x.fillStyle = lin(x, -2.4, 0, 2.4, 0, [[0, css(shade(spec.skin, 1.15))], [1, css(shade(spec.skin, .68))]]);
        x.beginPath(); x.ellipse(hx, hy + 1.2, 2.5, 3.1, 0, 0, 7); x.fill();
        [-1.7, -.6, .5, 1.6].forEach((dx, i) => { x.beginPath(); x.ellipse(hx + dx, hy + 3.9 + (i === 3 ? -.5 : i === 0 ? -.3 : 0), .7, 1.9, 0, 0, 7); x.fill(); });
        x.beginPath(); x.ellipse(hx + 2.6, hy + .6, .8, 1.8, -.5, 0, 7); x.fill();
        x.strokeStyle = rgba(shade(spec.skin, .5), .5); x.lineWidth = .25;
        [-1.1, 0, 1.1].forEach(dx => { x.beginPath(); x.moveTo(hx + dx, hy + 3.2); x.lineTo(hx + dx, hy + 5.4); x.stroke(); });
      }
    });
  }

  /* ================================================================
     PALETÓ / UNIFORME (tronco dos capitães)
     spec: jacket, tie, sash[main,alt], military, fem, skin
     ================================================================ */
  function suit(spec, s = 1) {
    const W = 48*s, H = 56*s, fem = !!spec.fem, mil = !!spec.military, sw = fem ? 10 : 11.4, ww = fem ? 7.2 : 8.6, len = 27;
    return mk(W, H, W/2, 9*s, x => {
      x.translate(W/2, 9*s); x.scale(s, s);
      const jc = spec.jacket;
      limb(x, 0, -5.4, 0, 1.6, 4.4, 5.8, spec.skin, { lo: .72 });
      const body = () => {
        x.beginPath(); x.moveTo(-sw*.5, -.8); x.bezierCurveTo(-sw*.85, -.6, -sw*1.04, .6, -sw*1.08, 3.6);
        x.bezierCurveTo(-sw*1.04, 9, -ww - .8, 15, -ww - .4, len); x.lineTo(-ww - .6, len + 3.4);
        x.quadraticCurveTo(0, len + 4.4, ww + .6, len + 3.4); x.lineTo(ww + .4, len);
        x.bezierCurveTo(ww + .8, 15, sw*1.04, 9, sw*1.08, 3.6); x.bezierCurveTo(sw*1.04, .6, sw*.85, -.6, sw*.5, -.8);
        x.quadraticCurveTo(0, 1.4, -sw*.5, -.8); x.closePath();
      };
      // camisa (aparece no V do paletó)
      body(); x.fillStyle = css(spec.undershirt ?? 0xf3f3f6); x.fill();
      x.save(); body(); x.clip();
      // paletó: dois lados com abertura em V
      const side = sd => {
        x.beginPath(); x.moveTo(sd*sw*1.2, -2); x.lineTo(sd*sw*1.2, len + 6); x.lineTo(sd*.55, len + 6); x.lineTo(sd*.55, 15.6); x.lineTo(sd*4.4, 6.4); x.lineTo(sd*3.7, -1.2); x.closePath();
      };
      [-1, 1].forEach(sd => {
        side(sd); x.fillStyle = lin(x, -sw, 0, sw, 0, [[0, css(shade(jc, 1.32))], [.4, css(jc)], [.82, css(shade(jc, .66))], [1, css(shade(jc, .52))]]); x.fill();
        x.strokeStyle = "rgba(0,0,0,.4)"; x.lineWidth = .4; x.stroke();
      });
      // lapelas
      [-1, 1].forEach(sd => {
        x.beginPath(); x.moveTo(sd*3.7, -1.2); x.lineTo(sd*4.4, 6.4); x.lineTo(sd*.55, 15.6); x.lineTo(sd*1.6, 6.6); x.lineTo(sd*1.4, -.6); x.closePath();
        x.fillStyle = css(shade(jc, mil ? 1.05 : 1.2)); x.fill(); x.strokeStyle = "rgba(0,0,0,.4)"; x.lineWidth = .35; x.stroke();
      });
      // gravata
      if (spec.tie && !mil) {
        const tc = spec.tie;
        x.beginPath(); x.moveTo(-1.5, -.6); x.lineTo(1.5, -.6); x.lineTo(1.1, 1.8); x.lineTo(-1.1, 1.8); x.closePath(); x.fillStyle = css(shade(tc, .85)); x.fill();
        x.beginPath(); x.moveTo(-1.1, 1.8); x.lineTo(1.1, 1.8); x.lineTo(2.1, 18.4); x.lineTo(0, 20.4); x.lineTo(-2.1, 18.4); x.closePath();
        x.fillStyle = lin(x, -2, 0, 2, 0, [[0, css(shade(tc, 1.25))], [1, css(shade(tc, .65))]]); x.fill(); x.strokeStyle = "rgba(0,0,0,.4)"; x.lineWidth = .3; x.stroke();
        x.strokeStyle = rgba(spec.tieStripe ?? 0xffffff, .55); x.lineWidth = .5; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(-1.6, 6 + i*3.2); x.lineTo(1.6, 4.6 + i*3.2); x.stroke(); }
      } else if (mil) {
        x.fillStyle = "#e0d6b8"; x.beginPath(); x.moveTo(-1.6, -.6); x.lineTo(1.6, -.6); x.lineTo(1.4, 14); x.lineTo(-1.4, 14); x.closePath(); x.fill();
      }
      // dobras / volume
      x.strokeStyle = "rgba(0,0,0,.22)"; x.lineWidth = .5;
      [[-6.4, 8, -5.4, 18, -6.8, 27], [6.2, 8, 6, 18, 7.2, 27]].forEach(([a, b, c, d, e, f]) => { x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(c, d, e, f); x.stroke(); });
      soft(x, -4, 6, 3.8, 3, 0xffffff, .1); soft(x, 4.6, 7, 3.8, 3, 0x000000, .14); soft(x, 0, len + 2, 11, 3.4, 0x000000, .28);
      // botões
      x.fillStyle = mil ? "#e2b83a" : css(shade(jc, .35)); [18.4, 23.6].forEach(yy => { x.beginPath(); x.arc(.5, yy, .62, 0, 7); x.fill(); });
      // lenço no bolso / pin da bandeira
      if (!mil) { x.fillStyle = css(spec.pocket ?? 0xffffff); x.beginPath(); x.moveTo(-8.2, 12.8); x.lineTo(-5.4, 12.2); x.lineTo(-5.6, 13.9); x.lineTo(-8.2, 14); x.closePath(); x.fill(); x.strokeStyle = "rgba(0,0,0,.3)"; x.lineWidth = .3; x.stroke(); }
      if (spec.pin) { x.fillStyle = css(spec.pin[0]); x.beginPath(); x.arc(-4.4, 7.6, 1, 0, 7); x.fill(); x.fillStyle = css(spec.pin[1]); x.beginPath(); x.arc(-4.4, 7.6, .45, 0, 7); x.fill(); }
      if (mil) {                                                  // condecorações, dragonas e cinto
        for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) { x.fillStyle = css([0xd7191c, 0xffd23a, 0x1d3b8f, 0x2f9a3f][(i + r)%4]); x.fillRect(-9 + i*1.8, 9.4 + r*2.2, 1.5, 1.8); }
        x.fillStyle = "#1a1c10"; x.fillRect(-ww - 1, 24, ww*2 + 2, 2); x.fillStyle = "#e2b83a"; x.fillRect(-1.4, 23.6, 2.8, 2.8);
        x.fillStyle = "#c22"; [-1, 1].forEach(sd => x.fillRect(sd*4.2 - 1, 1.6, 2, 4));
      }
      // faixa presidencial
      if (spec.sash) {
        const [m, a] = spec.sash, ax = 6.6, ay = -.4, bx = -9.8, by = len + 1;
        x.beginPath(); x.moveTo(ax - 1.9, ay); x.lineTo(ax + 2.2, ay + 2.4); x.lineTo(bx + 2.6, by + 1.2); x.lineTo(bx - 1.6, by - 2.2); x.closePath();
        x.fillStyle = lin(x, ax, ay, bx, by, [[0, css(shade(m, 1.2))], [1, css(shade(m, .7))]]); x.fill();
        x.strokeStyle = css(a); x.lineWidth = .8; x.beginPath(); x.moveTo(ax - 1.9, ay); x.lineTo(bx - 1.6, by - 2.2); x.moveTo(ax + 2.2, ay + 2.4); x.lineTo(bx + 2.6, by + 1.2); x.stroke();
        x.strokeStyle = "rgba(0,0,0,.45)"; x.lineWidth = .35; x.beginPath(); x.moveTo(ax - 1.9, ay); x.lineTo(ax + 2.2, ay + 2.4); x.lineTo(bx + 2.6, by + 1.2); x.lineTo(bx - 1.6, by - 2.2); x.closePath(); x.stroke();
        Art.ball(x, bx + .6, by - .6, 1.6, a, "rgba(0,0,0,.6)", .4);
      }
      x.restore();
      x.strokeStyle = rgba(shade(jc, .35), .85); x.lineWidth = .45; body(); x.stroke();
      // colarinho
      x.fillStyle = "#fafafc"; x.beginPath(); x.moveTo(-3.7, -1.3); x.lineTo(-1.4, 1.4); x.lineTo(-2.2, 3.8); x.lineTo(-4.8, .4); x.closePath(); x.fill(); x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = .3; x.stroke();
      x.beginPath(); x.moveTo(3.7, -1.3); x.lineTo(1.4, 1.4); x.lineTo(2.2, 3.8); x.lineTo(4.8, .4); x.closePath(); x.fill(); x.stroke();
    });
  }

  /* fuzil (soldados) */
  function rifle() {
    return mk(10, 62, 5, 46, x => {
      x.fillStyle = "#4a3320"; x.beginPath(); x.moveTo(3, 40); x.lineTo(7, 40); x.lineTo(7.4, 58); x.lineTo(2.6, 58); x.closePath(); x.fill(); x.strokeStyle = "rgba(0,0,0,.7)"; x.lineWidth = .4; x.stroke();
      x.fillStyle = lin(x, 3, 0, 7, 0, [[0, "#6c7077"], [1, "#16181c"]]); x.fillRect(3.4, 8, 3.2, 34); x.fillRect(3.9, 2, 2.2, 8);
      x.strokeStyle = "rgba(0,0,0,.7)"; x.lineWidth = .4; x.strokeRect(3.4, 8, 3.2, 34);
      x.fillStyle = "#222"; x.fillRect(2.6, 24, 4.8, 7);
    });
  }

  /* mastro com bandeira (a bandeira é uma textura à parte, animada) */
  function pole(len = 54) {
    return mk(6, len + 6, 3, len + 3, x => {
      x.fillStyle = lin(x, 0, 0, 6, 0, [[0, "#fafafa"], [.5, "#d8dbe0"], [1, "#80858d"]]);
      x.fillRect(2, 3, 2.2, len); x.strokeStyle = "rgba(0,0,0,.45)"; x.lineWidth = .35; x.strokeRect(2, 3, 2.2, len);
      Art.ball(x, 3.1, 3, 1.6, 0xe9c04a, "rgba(0,0,0,.5)", .4);
    });
  }

  /* sorteia as características de um torcedor */
  function randomSpec(side, o = {}) {
    const fem = Math.random() < .42;
    const skin = o.skin ?? pick(SKINS);
    const hair = o.hair ?? pick(HAIRS.slice(0, Math.random() < .85 ? 6 : 8));
    const hairStyle = fem ? pick(["long", "long", "bob", "short"]) : pick(["short", "short", "short", "buzz", "bald"]);
    const shirt = o.shirt ?? pick(side.shirts);
    const white = shirt === 0xffffff;
    return {
      fem, skin, hair, hairStyle, eye: pick([0x3a2418, 0x4a3020, 0x2c4a2c, 0x3a5a7a, 0x1a1210]),
      shirt, collar: white ? side.main : side.alt, crest: [side.alt, side.main], stripe: shirt === side.main ? side.alt : null,
      sleeveStripe: shirt === side.main ? side.alt : side.main,
      pants: pick([0x2f4a78, 0x2a3f68, 0x1f2430, 0x394a62, 0x1c2230, 0xb9a88a]), pantsType: fem ? pick(["jeans", "jeans", "shorts", "skirt"]) : pick(["jeans", "jeans", "jeans", "dark", "shorts"]),
      shoes: pick([0xf2efe8, 0x23262c, 0x8a8f98, 0x3a2a20]),
      beard: !fem && Math.random() < .18 ? (Math.random() < .5 ? "stubble" : true) : false, beardColor: null,
      glasses: Math.random() < .14, age: Math.random() < .25 ? Math.random()*.6 : 0,
      cap: !fem && hairStyle !== "bald" || Math.random() < .3 ? (Math.random() < .55 ? { color: side.main, logo: side.alt } : null) : null,
    };
  }

  return { head, torso, suit, legs, upperArm, foreArm, pole, rifle, randomSpec, SKINS, HAIRS };
})();

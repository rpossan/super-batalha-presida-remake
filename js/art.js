/* ================================================================
   Arte procedural 2D (canvas) para o Phaser: torcedores, capitães,
   veículos, objetos arremessados e pequenas peças de cenário.
   Nada aqui depende do Phaser: cada fábrica devolve um canvas pronto
   ({ c, w, h, ox, oy }), que o GFX registra como textura.
   ================================================================ */
"use strict";
const Art = (() => {
  const Q = 2;                                   // supersampling: textura em 2x, exibida a 0.5
  const INK = "#14171c";
  const HW = 32, HH = 16, HY = 38;               // mesmos valores da projeção isométrica do GFX

  /* ---------- cores ---------- */
  const rgb = c => [(c>>16)&255, (c>>8)&255, c&255];
  const hex = (r,g,b) => (Math.max(0,Math.min(255,r|0))<<16) | (Math.max(0,Math.min(255,g|0))<<8) | Math.max(0,Math.min(255,b|0));
  const css = c => "#" + (c & 0xffffff).toString(16).padStart(6, "0");
  const shade = (c, k) => { const [r,g,b] = rgb(c); return k >= 1 ? hex(r+(255-r)*(k-1), g+(255-g)*(k-1), b+(255-b)*(k-1)) : hex(r*k, g*k, b*k); };
  const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return hex(A[0]+(B[0]-A[0])*t, A[1]+(B[1]-A[1])*t, A[2]+(B[2]-A[2])*t); };
  const rnd = n => Math.floor(Math.random()*n);

  /* ---------- canvas ---------- */
  function make(w, h, q = Q) {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w*q); c.height = Math.ceil(h*q);
    const x = c.getContext("2d"); x.scale(q, q);
    x.lineJoin = "round"; x.lineCap = "round";
    return [c, x];
  }
  /* cria o canvas, chama draw(ctx) e devolve o descritor (ox/oy = ponto de apoio em px lógicos) */
  function bake(w, h, ox, oy, draw, q = Q) {
    const [c, x] = make(w, h, q); draw(x); return { c, w, h, ox, oy, q };
  }
  function rr(x, px, py, w, h, r) {
    x.beginPath();
    if (x.roundRect) x.roundRect(px, py, w, h, r); else x.rect(px, py, w, h);
  }
  function lin(x, x0, y0, x1, y1, stops) {
    const g = x.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([t, c]) => g.addColorStop(t, c));
    return g;
  }
  function rad(x, cx, cy, r0, r1, stops, fx, fy) {
    const g = x.createRadialGradient(fx ?? cx, fy ?? cy, r0, cx, cy, r1);
    stops.forEach(([t, c]) => g.addColorStop(t, c));
    return g;
  }
  function ell(x, cx, cy, rx, ry, fill, stroke, lw) {
    x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, Math.PI*2);
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (stroke) { x.lineWidth = lw || 1.6; x.strokeStyle = stroke; x.stroke(); }
  }
  function poly(x, pts, fill, stroke, lw) {
    x.beginPath(); pts.forEach(([a, b], i) => i ? x.lineTo(a, b) : x.moveTo(a, b)); x.closePath();
    if (fill) { x.fillStyle = fill; x.fill(); }
    if (stroke) { x.lineWidth = lw || 1.4; x.strokeStyle = stroke; x.stroke(); }
  }
  /* esfera "de desenho animado": gradiente radial + contorno */
  function ball(x, cx, cy, r, color, outline = INK, lw = 1.6) {
    ell(x, cx, cy, r, r, rad(x, cx, cy, r*.1, r*1.05, [[0, css(shade(color, 1.28))], [.55, css(color)], [1, css(shade(color, .68))]], cx - r*.35, cy - r*.4), outline, lw);
  }
  function starPath(ctx, cx, cy, R, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI/2 + i*Math.PI/5, rad = i%2 ? r : R;
      ctx[i ? "lineTo" : "moveTo"](cx + Math.cos(a)*rad, cy + Math.sin(a)*rad);
    }
    ctx.closePath();
  }

  /* ---------- bandeiras ---------- */
  function flag(key) {
    return bake(80, 55, 0, 0, x => {
      x.save(); x.scale(.5, .5);
      if (key === "regime") {
        x.fillStyle = "#1b1b1b"; x.fillRect(0, 0, 160, 110);
        x.fillStyle = "#9b0f0f"; x.beginPath(); x.arc(80, 55, 34, 0, 7); x.fill();
        x.fillStyle = "#1b1b1b"; x.fillRect(74, 18, 12, 74); x.fillRect(43, 49, 74, 12);
      } else if (key === "flavio") {
        x.fillStyle = "#009c3b"; x.fillRect(0, 0, 160, 110);
        x.fillStyle = "#ffdf00"; x.beginPath(); x.moveTo(80, 10); x.lineTo(150, 55); x.lineTo(80, 100); x.lineTo(10, 55); x.fill();
        x.fillStyle = "#1d3b8f"; x.beginPath(); x.arc(80, 55, 24, 0, 7); x.fill();
        x.strokeStyle = "#fff"; x.lineWidth = 3; x.beginPath(); x.arc(80, 55, 24, Math.PI*1.1, Math.PI*1.9); x.stroke();
      } else if (key === "rs") {
        x.fillStyle = "#1b8f3a"; x.fillRect(0, 0, 160, 38); x.fillStyle = "#d32f2f"; x.fillRect(0, 37, 160, 38); x.fillStyle = "#ffd400"; x.fillRect(0, 74, 160, 36);
        x.fillStyle = "#fff"; x.beginPath(); x.arc(80, 55, 19, 0, 7); x.fill(); x.strokeStyle = "#1b8f3a"; x.lineWidth = 5; x.stroke();
      } else if (key === "brasil") {
        x.fillStyle = "#009c3b"; x.fillRect(0, 0, 160, 110);
        x.fillStyle = "#ffdf00"; x.beginPath(); x.moveTo(80, 10); x.lineTo(150, 55); x.lineTo(80, 100); x.lineTo(10, 55); x.fill();
        x.fillStyle = "#1d3b8f"; x.beginPath(); x.arc(80, 55, 24, 0, 7); x.fill();
        x.strokeStyle = "#fff"; x.lineWidth = 4; x.beginPath(); x.arc(80, 60, 30, Math.PI*1.18, Math.PI*1.8); x.stroke();
      } else {
        x.fillStyle = "#d7191c"; x.fillRect(0, 0, 160, 110);
        x.fillStyle = "#ffdf00"; starPath(x, 80, 58, 38, 15); x.fill();
      }
      x.restore();
      x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = 1.5; x.strokeRect(.75, .75, 78.5, 53.5);
      x.fillStyle = lin(x, 0, 0, 80, 55, [[0, "rgba(255,255,255,.28)"], [.5, "rgba(255,255,255,0)"], [1, "rgba(0,0,0,.22)"]]);
      x.fillRect(0, 0, 80, 55);
    });
  }

  /* ---------- sombra suave sob os personagens ---------- */
  /* sombra direcional: sol no alto-esquerdo da tela, sombra alongada para a direita-baixo; origem nos pés */
  function shadowDir() {
    return bake(140, 80, 30, 26, x => {
      x.save(); x.translate(30 + 34, 26 + 17); x.rotate(.4636); x.scale(1, .26);
      x.fillStyle = rad(x, 0, 0, 2, 56, [[0, "rgba(0,0,0,.5)"], [.6, "rgba(0,0,0,.3)"], [1, "rgba(0,0,0,0)"]]); x.beginPath(); x.arc(0, 0, 56, 0, 7); x.fill(); x.restore();
      x.fillStyle = rad(x, 30, 26, 1, 15, [[0, "rgba(0,0,0,.6)"], [1, "rgba(0,0,0,0)"]]); x.beginPath(); x.ellipse(30, 26, 15, 8, 0, 0, 7); x.fill();
    });
  }
  function shadow() {
    return bake(64, 32, 32, 16, x => { x.fillStyle = rad(x, 32, 16, 1, 30, [[0, "rgba(0,0,0,.55)"], [1, "rgba(0,0,0,0)"]]); x.beginPath(); x.ellipse(32, 16, 30, 14, 0, 0, 7); x.fill(); });
  }

  /* ================================================================
     Torcedores
     ================================================================ */
  const FAN_W = 44, FAN_H = 60;                   // pés em (22, 58)
  function fanBody(o) {
    return bake(FAN_W, FAN_H, 22, 58, x => {
      // pernas
      x.fillStyle = "#2a2f39";
      [[14.5], [24]].forEach(([lx]) => { rr(x, lx, 49, 6, 9, 2.5); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.4; x.stroke(); });
      x.fillStyle = "#101216"; [[13.5], [23.5]].forEach(([lx]) => { rr(x, lx, 55.5, 8, 3.6, 1.8); x.fill(); });
      // camisa
      const sh = css(o.shirt);
      x.beginPath(); x.moveTo(12.5, 52); x.quadraticCurveTo(11, 40, 14, 30); x.quadraticCurveTo(22, 26, 30, 30); x.quadraticCurveTo(33, 40, 31.5, 52); x.closePath();
      x.fillStyle = lin(x, 12, 0, 33, 0, [[0, css(shade(o.shirt, 1.22))], [.5, sh], [1, css(shade(o.shirt, .66))]]); x.fill();
      x.lineWidth = 1.6; x.strokeStyle = INK; x.stroke();
      // detalhe da camisa (faixa/estrela)
      x.fillStyle = css(o.trim); x.globalAlpha = .9; rr(x, 15.5, 40, 12.5, 3.4, 1.6); x.fill(); x.globalAlpha = 1;
      // braço esquerdo (parado)
      x.fillStyle = lin(x, 8, 0, 14, 0, [[0, css(shade(o.shirt, 1.1))], [1, css(shade(o.shirt, .7))]]);
      rr(x, 8.2, 31, 5.4, 14, 2.6); x.fill(); x.stroke();
      ball(x, 10.9, 46.2, 2.9, o.skin, INK, 1.2);
      // cabeça
      ball(x, 22, 20.5, 10.4, o.skin, INK, 1.7);
      // cabelo / boné
      if (o.cap) {
        x.beginPath(); x.moveTo(11.6, 19); x.quadraticCurveTo(12, 8.6, 22, 8.4); x.quadraticCurveTo(32, 8.6, 32.4, 19); x.quadraticCurveTo(22, 15.5, 11.6, 19); x.closePath();
        x.fillStyle = lin(x, 12, 8, 32, 19, [[0, css(shade(o.capColor, 1.3))], [1, css(shade(o.capColor, .7))]]); x.fill(); x.lineWidth = 1.6; x.stroke();
        x.beginPath(); x.moveTo(20, 17); x.quadraticCurveTo(30, 15, 35.5, 18.5); x.quadraticCurveTo(28, 20.8, 20, 19.4); x.closePath(); x.fillStyle = css(shade(o.capColor, .8)); x.fill(); x.stroke();
      } else {
        x.beginPath(); x.moveTo(11.8, 18.5); x.quadraticCurveTo(12, 8.8, 22, 8.6); x.quadraticCurveTo(32, 8.8, 32.2, 18.5); x.quadraticCurveTo(28, 12.5, 22, 13.2); x.quadraticCurveTo(16, 12.5, 11.8, 18.5); x.closePath();
        x.fillStyle = css(o.hair); x.fill(); x.lineWidth = 1.5; x.stroke();
      }
      // rosto
      x.fillStyle = INK; ell(x, 17.9, 22.3, 1.35, 1.8); x.fill(); ell(x, 26.1, 22.3, 1.35, 1.8); x.fill();
      x.fillStyle = "#fff"; ell(x, 18.3, 21.6, .5, .5, "#fff"); ell(x, 26.5, 21.6, .5, .5, "#fff");
      x.strokeStyle = "#7a1c1c"; x.lineWidth = 1.2; x.beginPath(); x.arc(22, 25.4, 2.6, .15*Math.PI, .85*Math.PI); x.stroke();
      ell(x, 14.8, 25.2, 1.9, 1.2, "rgba(255,90,90,.28)"); ell(x, 29.2, 25.2, 1.9, 1.2, "rgba(255,90,90,.28)");
    });
  }
  /* braço levantado com mastro; pivô no ombro (ox/oy) */
  function fanArm(o) {
    return bake(20, 52, 5, 48, x => {
      // mastro
      x.fillStyle = lin(x, 0, 0, 20, 0, [[0, "#f6f6f6"], [1, "#9aa0a8"]]); rr(x, 7.2, 2, 2.4, 40, 1.2); x.fill(); x.lineWidth = 1; x.strokeStyle = INK; x.stroke();
      ball(x, 8.4, 2.4, 1.9, 0xffd23a, INK, 1);
      // manga + antebraço
      x.fillStyle = lin(x, 3, 0, 12, 0, [[0, css(shade(o.shirt, 1.15))], [1, css(shade(o.shirt, .7))]]);
      rr(x, 3.4, 36, 5.8, 12.4, 2.8); x.fill(); x.lineWidth = 1.4; x.strokeStyle = INK; x.stroke();
      ball(x, 6.3, 33.8, 3.1, o.skin, INK, 1.2);
    });
  }

  function unitBody(kind) {
    const zomb = kind === "zombie", mons = kind === "monster", sold = kind === "soldier";
    const skin = zomb ? 0x8fb87a : mons ? 0x8a52b0 : 0xd2a47c, cloth = zomb ? 0x56684a : mons ? 0x40235a : 0x4e5d2e;
    return bake(FAN_W + 8, FAN_H + 6, 26, 62, x => {
      x.translate(4, 4);
      x.fillStyle = "#16171a"; [[14.5], [24]].forEach(([lx]) => { rr(x, lx, 49, 6, 9, 2.5); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.4; x.stroke(); });
      x.beginPath(); x.moveTo(12, 52); x.quadraticCurveTo(10.5, 40, 14, 30); x.quadraticCurveTo(22, 26, 30, 30); x.quadraticCurveTo(33.5, 40, 32, 52); x.closePath();
      x.fillStyle = lin(x, 12, 0, 33, 0, [[0, css(shade(cloth, 1.25))], [.5, css(cloth)], [1, css(shade(cloth, .6))]]); x.fill(); x.lineWidth = 1.6; x.strokeStyle = INK; x.stroke();
      if (zomb) {                                     // rasgos na roupa e braços esticados
        x.strokeStyle = "rgba(0,0,0,.45)"; x.lineWidth = 1.2; x.beginPath(); x.moveTo(15, 44); x.lineTo(19, 50); x.moveTo(26, 38); x.lineTo(29, 46); x.stroke();
        [[7, 33], [36.5, 33]].forEach(([ax, ay]) => { x.fillStyle = css(skin); rr(x, ax - 2.2, ay, 5, 13, 2.4); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.3; x.stroke(); });
      } else {
        x.fillStyle = css(shade(cloth, .85)); rr(x, 8, 31, 5.4, 14, 2.6); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.4; x.stroke();
        ball(x, 10.7, 46.2, 2.9, skin, INK, 1.2);
      }
      if (sold) {                                     // fuzil + cinto
        x.fillStyle = "#2a2d2a"; rr(x, 26, 36, 4, 20, 1.6); x.fill(); x.strokeStyle = INK; x.lineWidth = 1.2; x.stroke();
        x.fillStyle = "#1f2316"; x.fillRect(12.5, 45, 19, 2.6);
        ball(x, 33.5, 47, 2.9, skin, INK, 1.2);
      } else if (mons) {
        ball(x, 33.5, 46, 4, skin, INK, 1.2);
        x.fillStyle = "#e8dcc0"; [[14, 4, -.35], [30, 4, .35]].forEach(([hx, hy, rot]) => { x.save(); x.translate(hx, 13); x.rotate(rot); poly(x, [[-3, 0], [3, 0], [0, -11]], "#e8dcc0", INK, 1.3); x.restore(); });
      } else { ball(x, 33.5, 44, 3, skin, INK, 1.2); }
      ball(x, 22, 20.5, mons ? 11.6 : 10.4, skin, INK, 1.7);
      if (sold) {                                     // capacete
        x.beginPath(); x.moveTo(11, 19.5); x.quadraticCurveTo(11.4, 7.6, 22, 7.4); x.quadraticCurveTo(32.6, 7.6, 33, 19.5); x.lineTo(11, 19.5); x.closePath();
        x.fillStyle = lin(x, 11, 7, 33, 19, [[0, "#52653a"], [1, "#222c14"]]); x.fill(); x.lineWidth = 1.7; x.strokeStyle = INK; x.stroke();
        x.fillStyle = "#1b2310"; rr(x, 9.5, 18, 25, 3.2, 1.4); x.fill(); x.stroke();
      }
      const eye = zomb || mons ? "#ff2a2a" : INK;
      x.fillStyle = eye; ell(x, 17.8, 22, 1.6, 1.9); x.fill(); ell(x, 26.2, 22, 1.6, 1.9); x.fill();
      if (zomb || mons) { x.shadowColor = "#ff2a2a"; x.shadowBlur = 5; x.fill(); x.shadowBlur = 0; }
      x.strokeStyle = INK; x.lineWidth = 1.3; x.beginPath();
      if (zomb) { x.moveTo(18, 27); x.lineTo(26, 27); x.moveTo(20, 25.6); x.lineTo(20, 28.4); x.moveTo(23, 25.6); x.lineTo(23, 28.4); }
      else if (mons) { x.moveTo(17, 26.6); x.lineTo(19, 29); x.lineTo(22, 26.8); x.lineTo(25, 29); x.lineTo(27, 26.6); }
      else { x.moveTo(19.4, 26.6); x.lineTo(24.6, 26.6); }
      x.stroke();
    });
  }

  /* ================================================================
     Capitães (os dois líderes e os adversários)
     ================================================================ */
  const CAP_W = 132, CAP_H = 176;                 // pés em (66, 170)
  function captainBody(ch, s, sideKey) {
    const main = ch.military ? s.main : s.main, hs = ch.hairStyle || "short";
    return bake(CAP_W, CAP_H, 66, 170, x => {
      // capa
      x.beginPath(); x.moveTo(36, 72); x.quadraticCurveTo(14, 120, 10, 166); x.lineTo(122, 166); x.quadraticCurveTo(118, 120, 96, 72); x.closePath();
      x.fillStyle = lin(x, 10, 70, 122, 166, [[0, css(shade(main, .8))], [1, css(shade(main, .42))]]); x.fill(); x.lineWidth = 2.2; x.strokeStyle = INK; x.stroke();
      // pernas/pés
      x.fillStyle = "#23272f"; rr(x, 40, 148, 52, 20, 7); x.fill(); x.strokeStyle = INK; x.lineWidth = 2.2; x.stroke();
      x.fillStyle = "#15171c"; rr(x, 36, 160, 26, 10, 5); x.fill(); rr(x, 70, 160, 26, 10, 5); x.fill();
      // corpo
      x.beginPath(); x.moveTo(36, 74); x.quadraticCurveTo(66, 66, 96, 74); x.quadraticCurveTo(104, 112, 98, 154); x.lineTo(34, 154); x.quadraticCurveTo(28, 112, 36, 74); x.closePath();
      x.fillStyle = lin(x, 30, 0, 102, 0, [[0, css(shade(main, 1.3))], [.45, css(main)], [1, css(shade(main, .6))]]); x.fill(); x.lineWidth = 2.4; x.strokeStyle = INK; x.stroke();
      // detalhes do traje (faixa dourada)
      x.strokeStyle = css(s.alt); x.lineWidth = 3; x.beginPath(); x.moveTo(36, 78); x.quadraticCurveTo(66, 70, 96, 78); x.stroke();
      x.globalAlpha = .55; x.fillStyle = css(shade(main, .5)); rr(x, 36, 146, 60, 6, 3); x.fill(); x.globalAlpha = 1;
      // emblema no peito (bandeira)
      const fl = flag(ch.military ? "regime" : sideKey);
      x.save(); x.shadowColor = "rgba(0,0,0,.4)"; x.shadowBlur = 4; x.drawImage(fl.c, 51, 96, 30, 21); x.restore();
      x.strokeStyle = INK; x.lineWidth = 1.6; x.strokeRect(51, 96, 30, 21);
      if (ch.military) {                               // medalhas
        for (let i = 0; i < 5; i++) { ball(x, 38 + i*7, 124 + (i%2)*2, 3.4, i%2 ? 0xffd23a : 0xd7191c, INK, 1.2); }
      }
      // braço esquerdo (parado)
      x.fillStyle = lin(x, 22, 0, 40, 0, [[0, css(shade(main, 1.1))], [1, css(shade(main, .65))]]);
      rr(x, 24, 80, 14, 44, 7); x.fill(); x.lineWidth = 2; x.strokeStyle = INK; x.stroke();
      ball(x, 31, 128, 6.5, ch.skin, INK, 1.6);
      // pescoço + cabeça
      x.fillStyle = css(shade(ch.skin, .85)); rr(x, 57, 66, 18, 12, 4); x.fill();
      // cabelo de trás (bob/long)
      if (hs === "bob" || hs === "long") {
        const len = hs === "long" ? 86 : 52;
        x.beginPath(); x.moveTo(36, 54); x.quadraticCurveTo(34, 20, 66, 18); x.quadraticCurveTo(98, 20, 96, 54); x.lineTo(98, 54 + len*.7); x.quadraticCurveTo(66, 54 + len, 34, 54 + len*.7); x.closePath();
        x.fillStyle = lin(x, 30, 20, 100, 54 + len, [[0, css(shade(ch.hair, 1.2))], [1, css(shade(ch.hair, .62))]]); x.fill(); x.lineWidth = 2; x.strokeStyle = INK; x.stroke();
      }
      ball(x, 66, 48, 28, ch.skin, INK, 2.2);
      // barba
      if (ch.beard) {
        const bc = ch.beardColor || ch.hair;
        x.beginPath(); x.moveTo(41, 52); x.quadraticCurveTo(44, 84, 66, 82); x.quadraticCurveTo(88, 84, 91, 52); x.quadraticCurveTo(80, 64, 66, 62); x.quadraticCurveTo(52, 64, 41, 52); x.closePath();
        x.fillStyle = lin(x, 40, 52, 92, 84, [[0, css(shade(bc, 1.2))], [1, css(shade(bc, .65))]]); x.fill(); x.lineWidth = 1.8; x.strokeStyle = INK; x.stroke();
      }
      // cabelo da frente
      if (hs !== "bald") {
        x.beginPath(); x.moveTo(37, 50); x.quadraticCurveTo(34, 16, 66, 14); x.quadraticCurveTo(98, 16, 95, 50);
        x.quadraticCurveTo(90, 34, 80, 31); x.quadraticCurveTo(66, 38, 52, 31); x.quadraticCurveTo(42, 34, 37, 50); x.closePath();
        x.fillStyle = lin(x, 36, 14, 96, 40, [[0, css(shade(ch.hair, 1.35))], [1, css(shade(ch.hair, .7))]]); x.fill(); x.lineWidth = 2; x.strokeStyle = INK; x.stroke();
      } else {
        x.fillStyle = "rgba(255,255,255,.35)"; ell(x, 56, 28, 8, 4.5, "rgba(255,255,255,.3)");
      }
      // olhos, sobrancelhas, nariz, boca
      x.fillStyle = "#fff"; ell(x, 55.5, 49, 6, 6.8, "#fff", INK, 1.5); ell(x, 76.5, 49, 6, 6.8, "#fff", INK, 1.5);
      x.fillStyle = INK; ell(x, 56.6, 50, 3.2, 3.9, INK); ell(x, 77.6, 50, 3.2, 3.9, INK);
      ell(x, 57.6, 48.3, 1.2, 1.2, "#fff"); ell(x, 78.6, 48.3, 1.2, 1.2, "#fff");
      x.strokeStyle = css(shade(ch.hair, .9)); x.lineWidth = 2.8; x.beginPath(); x.moveTo(48, 39); x.quadraticCurveTo(55, 35.5, 62, 38.5); x.moveTo(70, 38.5); x.quadraticCurveTo(77, 35.5, 84, 39); x.stroke();
      x.strokeStyle = css(shade(ch.skin, .68)); x.lineWidth = 1.8; x.beginPath(); x.moveTo(66, 51); x.quadraticCurveTo(70, 59, 65, 60); x.stroke();
      x.strokeStyle = "#7a1c1c"; x.lineWidth = 2.2; x.beginPath(); x.arc(66, 62, 8.5, .18*Math.PI, .82*Math.PI); x.stroke();
      ell(x, 47, 60, 5, 3, "rgba(255,90,90,.22)"); ell(x, 85, 60, 5, 3, "rgba(255,90,90,.22)");
      if (ch.glasses) {
        x.strokeStyle = "#111"; x.lineWidth = 2.4; ell(x, 55.5, 49, 9.6, 9.2, null, "#111", 2.4); ell(x, 76.5, 49, 9.6, 9.2, null, "#111", 2.4);
        x.beginPath(); x.moveTo(65, 48.5); x.lineTo(67, 48.5); x.stroke();
        x.fillStyle = "rgba(180,220,255,.2)"; ell(x, 55.5, 49, 9, 8.6, "rgba(180,220,255,.18)"); ell(x, 76.5, 49, 9, 8.6, "rgba(180,220,255,.18)");
      }
      if (!ch.military) {                              // coroa dourada
        x.beginPath(); x.moveTo(44, 24); x.lineTo(42, 4); x.lineTo(54, 14); x.lineTo(60, -2); x.lineTo(66, 12); x.lineTo(72, -2); x.lineTo(78, 14); x.lineTo(90, 4); x.lineTo(88, 24); x.quadraticCurveTo(66, 30, 44, 24); x.closePath();
        x.fillStyle = lin(x, 40, 0, 92, 28, [[0, "#fff1a0"], [.5, "#ffc928"], [1, "#b57f00"]]); x.fill(); x.lineWidth = 2.2; x.strokeStyle = INK; x.stroke();
        [[42, 4], [60, -2], [72, -2], [90, 4]].forEach(([jx, jy]) => ball(x, jx, jy, 2.6, 0xff4d4d, INK, 1));
        ball(x, 66, 20, 3.4, 0x3da5ff, INK, 1);
      } else {                                         // quepe militar
        x.beginPath(); x.moveTo(36, 28); x.quadraticCurveTo(38, 4, 66, 4); x.quadraticCurveTo(94, 4, 96, 28); x.closePath();
        x.fillStyle = lin(x, 36, 4, 96, 30, [[0, "#4b5230"], [1, "#222816"]]); x.fill(); x.lineWidth = 2.2; x.strokeStyle = INK; x.stroke();
        rr(x, 34, 24, 64, 9, 4); x.fillStyle = "#15160f"; x.fill(); x.stroke();
        poly(x, [[46, 33], [86, 33], [92, 40], [40, 40]], "#0e0f09", INK, 1.5);
        ball(x, 66, 17, 4.6, 0xffd23a, INK, 1.2);
      }
    });
  }
  /* braço levantado com a bandeira do líder: pivô no ombro */
  function captainArm(s) {
    return bake(34, 112, 17, 104, x => {
      x.fillStyle = lin(x, 8, 0, 28, 0, [[0, "#ffffff"], [1, "#98a0aa"]]); rr(x, 15.6, 6, 3.4, 76, 1.7); x.fill(); x.lineWidth = 1.4; x.strokeStyle = INK; x.stroke();
      ball(x, 17.3, 6, 3.6, 0xffd23a, INK, 1.4);
      x.fillStyle = lin(x, 8, 0, 28, 0, [[0, css(shade(s.main, 1.15))], [1, css(shade(s.main, .62))]]);
      rr(x, 9.5, 62, 15, 44, 7.5); x.fill(); x.lineWidth = 2; x.strokeStyle = INK; x.stroke();
      ball(x, 17, 62, 7, 0xf2c9a5, INK, 1.6);
    });
  }

  /* ================================================================
     Veículos: arte lateral desenhada virada para a direita e depois
     "cisalhada" para casar com a face do mundo isométrico
     (shear = -HH/HW para eixo x, +HH/HW para eixo z).
     ================================================================ */
  function sheared(w, h, ox, oy, shear, mirror, draw) {
    const pad = Math.abs(shear) * w;
    const W = w, H = h + pad;
    const [c, x] = make(W, H);
    // origem (ox, oy) do desenho mapeada para (ox, oy + (shear<0 ? pad : 0)); mantém o ponto de apoio
    x.save();
    if (shear < 0) x.translate(0, pad); else x.translate(0, 0);
    x.transform(1, shear, 0, 1, 0, 0);
    if (mirror) { x.translate(w, 0); x.scale(-1, 1); }
    draw(x);
    x.restore();
    const baseY = oy + (shear < 0 ? pad : 0) + (mirror ? 0 : 0);
    return { c, w: W, h: H, ox: mirror ? w - ox : ox, oy: baseY + shear * (mirror ? w - ox : ox) };
  }
  /* roda realista: pneu com relevo, aro metálico com raios e cubo */
  function wheel(x, cx, cy, r) {
    x.fillStyle = rad(x, cx, cy, r*.55, r, [[0, "#2a2c30"], [.85, "#0f1012"], [1, "#050506"]]); x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    x.strokeStyle = "rgba(255,255,255,.12)"; x.lineWidth = .8; x.beginPath(); x.arc(cx, cy, r*.9, Math.PI*1.05, Math.PI*1.7); x.stroke();
    x.fillStyle = lin(x, cx - r, cy - r, cx + r, cy + r, [[0, "#f2f4f7"], [.5, "#9aa0a8"], [1, "#4a4e55"]]); x.beginPath(); x.arc(cx, cy, r*.6, 0, 7); x.fill();
    x.strokeStyle = "rgba(30,32,36,.75)"; x.lineWidth = Math.max(.7, r*.09);
    for (let i = 0; i < 6; i++) { const an = i/6*Math.PI*2 + .3; x.beginPath(); x.moveTo(cx + Math.cos(an)*r*.16, cy + Math.sin(an)*r*.16); x.lineTo(cx + Math.cos(an)*r*.56, cy + Math.sin(an)*r*.56); x.stroke(); }
    x.fillStyle = "#2a2c30"; x.beginPath(); x.arc(cx, cy, r*.17, 0, 7); x.fill();
  }
  const metal = (x, x0, y0, x1, y1, c) => lin(x, x0, y0, x1, y1, [[0, css(shade(c, 1.45))], [.35, css(shade(c, 1.1))], [.6, css(shade(c, .8))], [1, css(shade(c, .45))]]);
  function pennant(x, o, fx, fy, w) {                    // bandeira de tecido ondulada
    x.save(); x.translate(fx, fy);
    const h = w*.68; x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(w*.3, -h*.12, w*.65, h*.14, w, 0); x.lineTo(w, h); x.bezierCurveTo(w*.65, h*1.14, w*.3, h*.88, 0, h); x.closePath(); x.clip();
    x.drawImage(o.flag.c, 0, -h*.15, w, h*1.3);
    x.fillStyle = lin(x, 0, 0, w, 0, [[0, "rgba(255,255,255,.18)"], [.5, "rgba(0,0,0,.18)"], [1, "rgba(255,255,255,.12)"]]); x.fillRect(0, -h*.2, w, h*1.4); x.restore();
    x.fillStyle = "#e8eaee"; x.fillRect(fx - 1.2, fy - 3, 1.8, w*1.5); 
  }
  function drawMoto(x, o) {                              // 96×70, chão em y=63, virada para a direita
    const R = 11, gy = 63, ry = gy - R;
    // rabeta / bagageiro com bandeira
    pennant(x, o, 8, -2, 22);
    // roda traseira e dianteira
    wheel(x, 20, ry, R); wheel(x, 76, ry, R);
    // escapamento cromado
    x.fillStyle = metal(x, 0, 48, 0, 58, 0xc8ccd2); x.beginPath(); x.moveTo(44, 56); x.lineTo(14, 52); x.lineTo(11, 55); x.lineTo(44, 59); x.closePath(); x.fill(); x.strokeStyle = "rgba(0,0,0,.5)"; x.lineWidth = .6; x.stroke();
    // motor
    x.fillStyle = metal(x, 34, 40, 58, 58, 0x3c4048); rr(x, 34, 40, 26, 17, 3); x.fill(); x.strokeStyle = "rgba(0,0,0,.6)"; x.lineWidth = .8; x.stroke();
    x.strokeStyle = "rgba(255,255,255,.18)"; x.lineWidth = .6; for (let i = 0; i < 5; i++) { x.beginPath(); x.moveTo(38 + i*4.4, 42); x.lineTo(38 + i*4.4, 55); x.stroke(); }
    // balança traseira e garfo dianteiro
    x.strokeStyle = "#2a2d33"; x.lineWidth = 3; x.beginPath(); x.moveTo(40, 52); x.lineTo(20, ry); x.stroke();
    x.strokeStyle = metal(x, 70, 30, 78, 52, 0xd8dce2); x.lineWidth = 3.4; x.beginPath(); x.moveTo(69, 26); x.lineTo(76, ry); x.stroke();
    // tanque + banco + rabeta
    x.beginPath(); x.moveTo(38, 38); x.bezierCurveTo(38, 24, 52, 21, 64, 27); x.lineTo(66, 35); x.bezierCurveTo(54, 40, 46, 41, 38, 38); x.closePath();
    x.fillStyle = lin(x, 40, 22, 60, 42, [[0, css(shade(o.main, 1.5))], [.45, css(o.main)], [1, css(shade(o.main, .5))]]); x.fill(); x.strokeStyle = "rgba(0,0,0,.55)"; x.lineWidth = .8; x.stroke();
    x.strokeStyle = "rgba(255,255,255,.5)"; x.lineWidth = 1; x.beginPath(); x.moveTo(42, 29); x.quadraticCurveTo(52, 25, 62, 29); x.stroke();
    x.fillStyle = css(o.alt); x.beginPath(); x.moveTo(45, 36); x.quadraticCurveTo(54, 33, 63, 33); x.lineTo(63, 35); x.quadraticCurveTo(54, 37, 45, 38); x.fill();
    x.fillStyle = "#17181b"; x.beginPath(); x.moveTo(20, 33); x.quadraticCurveTo(30, 30, 40, 33); x.lineTo(40, 38); x.lineTo(20, 38); x.closePath(); x.fill();
    x.fillStyle = lin(x, 14, 30, 30, 40, [[0, css(shade(o.main, 1.2))], [1, css(shade(o.main, .55))]]); x.beginPath(); x.moveTo(14, 36); x.quadraticCurveTo(20, 28, 32, 31); x.lineTo(32, 38); x.lineTo(14, 40); x.closePath(); x.fill(); x.strokeStyle = "rgba(0,0,0,.5)"; x.stroke();
    // guidão + farol + para-brisa
    x.strokeStyle = "#1a1b1e"; x.lineWidth = 2.4; x.beginPath(); x.moveTo(66, 24); x.lineTo(62, 22); x.stroke();
    x.fillStyle = rad(x, 80, 33, 0, 5, [[0, "#ffffff"], [.5, "#fff3b0"], [1, "#a89a5a"]]); x.beginPath(); x.ellipse(80, 33, 4, 5, 0, 0, 7); x.fill(); x.strokeStyle = "#222"; x.lineWidth = .8; x.stroke();
    x.fillStyle = "rgba(170,210,240,.35)"; x.beginPath(); x.moveTo(70, 26); x.quadraticCurveTo(76, 18, 74, 14); x.lineTo(68, 22); x.closePath(); x.fill();
    // piloto: coxa/bota, tronco com jaqueta, braço e capacete
    x.fillStyle = lin(x, 34, 30, 52, 52, [[0, "#4a6a9a"], [1, "#1f3050"]]); x.beginPath(); x.moveTo(30, 28); x.lineTo(44, 28); x.lineTo(54, 40); x.lineTo(51, 53); x.lineTo(44, 52); x.lineTo(44, 42); x.lineTo(32, 36); x.closePath(); x.fill(); x.strokeStyle = "rgba(0,0,0,.5)"; x.lineWidth = .7; x.stroke();
    x.fillStyle = "#151518"; x.beginPath(); x.moveTo(43, 50); x.lineTo(53, 50); x.lineTo(56, 56); x.lineTo(42, 56); x.closePath(); x.fill();
    x.fillStyle = lin(x, 30, 8, 50, 32, [[0, css(shade(o.shirt, 1.4))], [.5, css(o.shirt)], [1, css(shade(o.shirt, .5))]]); x.beginPath(); x.moveTo(30, 30); x.bezierCurveTo(30, 18, 36, 10, 46, 10); x.lineTo(52, 14); x.lineTo(46, 30); x.closePath(); x.fill(); x.strokeStyle = "rgba(0,0,0,.5)"; x.lineWidth = .8; x.stroke();
    x.strokeStyle = css(shade(o.shirt, .6)); x.lineWidth = 4.2; x.lineCap = "round"; x.beginPath(); x.moveTo(48, 14); x.lineTo(60, 20); x.lineTo(65, 24); x.stroke();
    x.strokeStyle = css(shade(o.shirt, 1.25)); x.lineWidth = 1.2; x.beginPath(); x.moveTo(48, 13); x.lineTo(60, 19); x.stroke();
    x.fillStyle = "#1a1a1c"; x.beginPath(); x.arc(65.5, 24.4, 2.2, 0, 7); x.fill();
    x.fillStyle = rad(x, 53, 5, 1, 9, [[0, css(shade(o.main, 1.55))], [.6, css(o.main)], [1, css(shade(o.main, .45))]], 50, 2); x.beginPath(); x.arc(53, 6, 7.4, 0, 7); x.fill(); x.strokeStyle = "rgba(0,0,0,.6)"; x.lineWidth = .9; x.stroke();
    x.fillStyle = lin(x, 54, 2, 60, 10, [[0, "#101820"], [1, "#4a6a8a"]]); x.beginPath(); x.moveTo(53, 3); x.quadraticCurveTo(60, 3, 60.6, 8); x.lineTo(54, 10); x.closePath(); x.fill(); x.fillStyle = "rgba(255,255,255,.45)"; x.fillRect(55, 4, 3, 1.2);
    x.strokeStyle = css(o.alt); x.lineWidth = 1.6; x.beginPath(); x.moveTo(46, 3); x.quadraticCurveTo(52, -3, 59, 1); x.stroke();
  }
  function drawBus(x, o, L) {                            // comprimento L, 70 de altura, chão em y=63
    const top = 14, bot = 52;
    // sombra do chassi e rodas
    x.fillStyle = "#15171a"; rr(x, 3, bot - 2, L - 6, 10, 3); x.fill();
    // carroceria
    rr(x, 0, top, L, bot - top, 7); x.fillStyle = lin(x, 0, top, 0, bot, [[0, "#fbfcfd"], [.45, "#e9edf1"], [.62, css(shade(o.main, 1.15))], [1, css(shade(o.main, .55))]]); x.fill(); x.lineWidth = 1.2; x.strokeStyle = "rgba(0,0,0,.6)"; x.stroke();
    x.fillStyle = css(o.main); x.beginPath(); x.moveTo(0, 33); x.lineTo(L*.7, 31); x.lineTo(L*.7 + 18, 52); x.lineTo(0, 52); x.closePath(); x.save(); rr(x, 0, top, L, bot - top, 7); x.clip(); x.fill(); x.restore();
    x.fillStyle = css(o.alt); x.save(); rr(x, 0, top, L, bot - top, 7); x.clip(); x.beginPath(); x.moveTo(0, 41); x.lineTo(L, 38); x.lineTo(L, 43.5); x.lineTo(0, 46.5); x.closePath(); x.fill(); x.restore();
    // faixa de janelas com passageiros
    const wy = 20, wh = 11, n = Math.max(3, Math.floor((L - 30)/20)), ww = (L - 34)/n;
    x.fillStyle = "#10161d"; rr(x, 6, wy - 1.5, L - 26, wh + 3, 3); x.fill();
    for (let i = 0; i < n; i++) {
      const wx = 8 + i*ww; x.fillStyle = lin(x, wx, wy, wx, wy + wh, [[0, "#9fc0dc"], [1, "#2a4258"]]); rr(x, wx, wy, ww - 2.4, wh, 1.6); x.fill();
      for (let p = 0; p < 2; p++) { const hx = wx + 4.5 + p*(ww*.4), ph = Math.random() > .5; x.fillStyle = css([0xe0b494, 0xa87850, 0x6a4a30, 0xf0c8a8][rnd(4)]); x.beginPath(); x.arc(hx, wy + 7, 2.2, 0, 7); x.fill(); x.fillStyle = css([o.main, o.alt, 0xffffff][rnd(3)]); rr(x, hx - 2.4, wy + 9.2, 4.8, 3, 1); x.fill(); if (ph && p === 0) { x.fillStyle = css(o.alt); x.fillRect(hx + 2.4, wy + 1.6, 3.2, 2.2); x.strokeStyle = "#ddd"; x.lineWidth = .5; x.beginPath(); x.moveTo(hx + 2.4, wy + 1.4); x.lineTo(hx + 2.4, wy + 8); x.stroke(); } }
      x.fillStyle = "rgba(255,255,255,.28)"; x.beginPath(); x.moveTo(wx, wy + wh*.6); x.lineTo(wx + ww*.45, wy); x.lineTo(wx + ww*.7, wy); x.lineTo(wx + ww*.2, wy + wh); x.lineTo(wx, wy + wh); x.closePath(); x.fill();
    }
    // parabrisa dianteiro e porta
    x.fillStyle = lin(x, 0, wy - 2, 0, wy + 16, [[0, "#a8c8e2"], [1, "#2a4258"]]); rr(x, L - 18, wy - 2.5, 14, 18, 3); x.fill(); x.strokeStyle = "rgba(0,0,0,.6)"; x.lineWidth = .8; x.stroke();
    x.fillStyle = "rgba(255,255,255,.3)"; x.beginPath(); x.moveTo(L - 18, wy + 12); x.lineTo(L - 10, wy - 2); x.lineTo(L - 6, wy - 2); x.lineTo(L - 15, wy + 15.5); x.closePath(); x.fill();
    x.fillStyle = "#161b21"; rr(x, L - 24, 34, 3, 17, 1); x.fill();
    // letreiro, faróis, para-choque, retrovisor
    x.fillStyle = "#101010"; rr(x, L - 16, 15.5, 11, 3.4, 1); x.fill(); x.fillStyle = "#ff9a2a"; x.fillRect(L - 14.5, 16.4, 8, 1.2);
    x.fillStyle = rad(x, L - 2.5, 44, 0, 4, [[0, "#fff"], [1, "#b8a860"]]); x.beginPath(); x.ellipse(L - 2.5, 44, 2.4, 3.2, 0, 0, 7); x.fill();
    x.fillStyle = "#1a1c20"; rr(x, L - 3, 49, 6, 5, 2); x.fill(); rr(x, -2, 49, 5, 5, 2); x.fill();
    x.strokeStyle = "#222"; x.lineWidth = 1.4; x.beginPath(); x.moveTo(L - 5, 26); x.lineTo(L + 2, 24); x.stroke(); x.fillStyle = "#1a1c20"; rr(x, L, 20, 3, 8, 1); x.fill();
    // rodas com caixa de roda
    [22, L - 34].forEach(wxx => { x.fillStyle = "#0a0b0d"; x.beginPath(); x.arc(wxx, 52, 11.5, Math.PI, 0); x.fill(); wheel(x, wxx, 52, 9.6); });
    // ar-condicionado e mastro
    x.fillStyle = lin(x, 0, 8, 0, 15, [[0, "#f4f6f8"], [1, "#b8bec6"]]); rr(x, L*.35, 9, L*.22, 6, 2); x.fill(); x.strokeStyle = "rgba(0,0,0,.45)"; x.lineWidth = .7; x.stroke();
    pennant(x, o, L/2 + 2, -16, 26);
  }
  function drawTruck(x, o) {                             // 120×90, chão em y=70
    // chassi e carroceria baixa
    x.fillStyle = "#1c1e22"; rr(x, 2, 52, 116, 9, 2); x.fill();
    // cabine
    x.beginPath(); x.moveTo(78, 52); x.lineTo(78, 22); x.quadraticCurveTo(80, 14, 90, 14); x.lineTo(104, 14); x.quadraticCurveTo(112, 14, 114, 24); x.lineTo(118, 40); x.lineTo(118, 52); x.closePath();
    x.fillStyle = lin(x, 78, 14, 78, 52, [[0, css(shade(o.alt, 1.4))], [.5, css(o.alt)], [1, css(shade(o.alt, .5))]]); x.fill(); x.lineWidth = 1.1; x.strokeStyle = "rgba(0,0,0,.65)"; x.stroke();
    x.fillStyle = lin(x, 0, 18, 0, 38, [[0, "#b4d0e8"], [1, "#2a4258"]]); x.beginPath(); x.moveTo(84, 38); x.lineTo(84, 22); x.quadraticCurveTo(86, 18, 92, 18); x.lineTo(104, 18); x.quadraticCurveTo(108, 18, 110, 24); x.lineTo(113, 38); x.closePath(); x.fill(); x.strokeStyle = "rgba(0,0,0,.6)"; x.stroke();
    x.fillStyle = "rgba(255,255,255,.3)"; x.beginPath(); x.moveTo(88, 36); x.lineTo(95, 18); x.lineTo(100, 18); x.lineTo(93, 36); x.closePath(); x.fill();
    x.fillStyle = "#2a2d33"; rr(x, 112, 42, 7, 8, 2); x.fill(); x.fillStyle = rad(x, 117, 38, 0, 4, [[0, "#fff"], [1, "#b8a860"]]); x.beginPath(); x.ellipse(117, 38, 2.4, 3.2, 0, 0, 7); x.fill();
    x.strokeStyle = "rgba(0,0,0,.35)"; x.lineWidth = .7; x.beginPath(); x.moveTo(97, 20); x.lineTo(97, 50); x.stroke(); x.fillStyle = "#8a8f96"; x.fillRect(99, 36, 4, 1.6);
    // caçamba com paredes na cor do candidato
    x.fillStyle = lin(x, 0, 26, 0, 52, [[0, css(shade(o.main, 1.35))], [.5, css(o.main)], [1, css(shade(o.main, .5))]]); rr(x, 2, 28, 74, 25, 2); x.fill(); x.lineWidth = 1.1; x.strokeStyle = "rgba(0,0,0,.65)"; x.stroke();
    x.fillStyle = css(o.alt); x.fillRect(2, 44, 74, 4);
    // torre de alto-falantes
    x.fillStyle = "#0f1013"; rr(x, 8, 0, 60, 30, 2); x.fill(); x.strokeStyle = "#3a3d44"; x.lineWidth = 1; x.stroke();
    [[10, 2], [39, 2], [10, 16], [39, 16]].forEach(([sx, sy]) => { x.fillStyle = lin(x, sx, sy, sx + 27, sy + 13, [[0, "#2a2c32"], [1, "#101114"]]); rr(x, sx, sy, 27, 13, 1.5); x.fill(); x.strokeStyle = "#4a4d55"; x.lineWidth = .6; x.stroke();
      for (let k = 0; k < 2; k++) { const cx = sx + 7 + k*13, cy = sy + 6.5; x.fillStyle = rad(x, cx, cy, 0, 5.4, [[0, "#6a6e78"], [.35, "#1a1b1f"], [1, "#0a0a0c"]]); x.beginPath(); x.arc(cx, cy, 5.4, 0, 7); x.fill(); x.strokeStyle = "#555a64"; x.lineWidth = .6; x.stroke(); } });
    x.fillStyle = "#ffd23a"; x.beginPath(); x.arc(70, 4, 2.2, 0, 7); x.fill(); x.fillStyle = "#e84040"; x.beginPath(); x.arc(6, 4, 2.2, 0, 7); x.fill();
    pennant(x, o, 12, -22, 26);
    // rodas
    [[22], [52], [98]].forEach(([wxx]) => { x.fillStyle = "#0a0b0d"; x.beginPath(); x.arc(wxx, 56, 12, Math.PI, 0); x.fill(); wheel(x, wxx, 58, 11); });
  }
  function drawHeli(x, o) {                              // origem no centro do corpo (ver chamada)
    x.fillStyle = lin(x, 0, 6, 0, 34, [[0, css(shade(o.alt, 1.5))], [.4, css(o.alt)], [1, css(shade(o.alt, .5))]]);
    x.beginPath(); x.moveTo(-40, 8); x.lineTo(-10, 6); x.lineTo(-8, 18); x.lineTo(-42, 14); x.closePath(); x.fill(); x.strokeStyle = "rgba(0,0,0,.55)"; x.lineWidth = 1; x.stroke();
    x.fillStyle = css(shade(o.main, .9)); x.beginPath(); x.moveTo(-42, -2); x.lineTo(-34, -2); x.lineTo(-30, 14); x.lineTo(-42, 14); x.closePath(); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(-14, 16); x.bezierCurveTo(-14, -2, 4, -4, 22, 2); x.bezierCurveTo(40, 8, 46, 20, 36, 30); x.bezierCurveTo(24, 36, -10, 36, -14, 16); x.closePath();
    x.fillStyle = lin(x, 0, -4, 0, 36, [[0, css(shade(o.main, 1.6))], [.35, css(shade(o.main, 1.1))], [.7, css(shade(o.main, .65))], [1, css(shade(o.main, .35))]]); x.fill(); x.lineWidth = 1.2; x.strokeStyle = "rgba(0,0,0,.65)"; x.stroke();
    x.fillStyle = lin(x, 0, 4, 0, 24, [[0, "#bfe0f6"], [1, "#1c3a52"]]); x.beginPath(); x.moveTo(20, 4); x.bezierCurveTo(34, 8, 42, 16, 40, 24); x.lineTo(22, 24); x.closePath(); x.fill(); x.strokeStyle = "rgba(0,0,0,.6)"; x.lineWidth = .9; x.stroke();
    x.fillStyle = "rgba(255,255,255,.4)"; x.beginPath(); x.moveTo(24, 6); x.lineTo(32, 8); x.lineTo(24, 22); x.lineTo(21, 22); x.closePath(); x.fill();
    x.fillStyle = css(o.alt); x.beginPath(); x.moveTo(-10, 22); x.quadraticCurveTo(10, 26, 36, 26); x.lineTo(35, 29); x.quadraticCurveTo(10, 30, -10, 26); x.fill();
    x.strokeStyle = "#cfd3d9"; x.lineWidth = 2.2; x.beginPath(); x.moveTo(-12, 40); x.quadraticCurveTo(14, 44, 44, 40); x.stroke(); x.lineWidth = 1.6; x.beginPath(); x.moveTo(0, 34); x.lineTo(-2, 40); x.moveTo(30, 34); x.lineTo(32, 40); x.stroke();
    x.fillStyle = "#2a2d33"; rr(x, 2, -8, 8, 8, 2); x.fill(); x.strokeStyle = "#555"; x.stroke();
    x.fillStyle = "#ff3030"; x.beginPath(); x.arc(-41, 6, 1.6, 0, 7); x.fill();
  }
  function rotor(len) {
    return bake(len, 14, len/2, 7, x => {
      x.fillStyle = "rgba(30,34,40,.85)"; x.beginPath(); x.ellipse(len/2, 7, len/2, 2.4, 0, 0, 7); x.fill();
      x.fillStyle = "rgba(255,255,255,.18)"; x.beginPath(); x.ellipse(len/2, 7, len/2 - 4, 1.2, 0, 0, 7); x.fill();
    });
  }

  /* ================================================================
     Objetos arremessados e peças de hazard (ícones pequenos)
     ================================================================ */
  function throwIcon(id, flagC) {
    return bake(44, 44, 22, 22, x => {
      x.translate(22, 22);
      switch (id) {
        case "cone":
          poly(x, [[-12, 14], [12, 14], [12, 18], [-12, 18]], "#ff7a1a", INK, 1.4);
          poly(x, [[-9, 14], [9, 14], [3, -14], [-3, -14]], "#ff7a1a", INK, 1.6);
          poly(x, [[-6.4, 0], [6.4, 0], [4.6, -6], [-4.6, -6]], "#fff", null);
          x.beginPath(); x.moveTo(-9, 14); x.lineTo(9, 14); x.lineTo(3, -14); x.lineTo(-3, -14); x.closePath(); x.lineWidth = 1.6; x.strokeStyle = INK; x.stroke();
          break;
        case "tomate":
          x.fillStyle = rad(x, 0, 2, 1, 14, [[0, "#ff6a52"], [.5, "#d42a1c"], [1, "#7a0e08"]], -4, -3); x.beginPath(); x.moveTo(0, -9); x.bezierCurveTo(14, -12, 15, 8, 0, 13); x.bezierCurveTo(-15, 8, -14, -12, 0, -9); x.fill(); x.lineWidth = 1.2; x.strokeStyle = "rgba(60,5,0,.7)"; x.stroke();
          x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.ellipse(-5, -3, 2.6, 4, -.5, 0, 7); x.fill();
          x.fillStyle = "#3f8a2c"; for (let k = 0; k < 5; k++) { x.save(); x.translate(0, -9); x.rotate(-1.2 + k*.6); x.beginPath(); x.ellipse(0, -3.4, 1.6, 4.2, 0, 0, 7); x.fill(); x.restore(); }
          break;
        case "bandeira": {
          x.fillStyle = "#f2f2f2"; rr(x, -17, 8, 34, 2.6, 1); x.fill(); x.lineWidth = 1; x.strokeStyle = INK; x.stroke();
          x.save(); x.translate(-14, -14); x.drawImage(flagC.c, 0, 0, 30, 21); x.strokeStyle = INK; x.strokeRect(0, 0, 30, 21); x.restore();
          x.fillStyle = "#f2f2f2"; rr(x, -16, -16, 2.6, 28, 1); x.fill(); x.strokeStyle = INK; x.stroke();
          break; }
        case "cavalete":
          x.strokeStyle = INK; x.lineWidth = 4; x.beginPath(); x.moveTo(-12, 16); x.lineTo(-8, -10); x.moveTo(12, 16); x.lineTo(8, -10); x.stroke();
          x.strokeStyle = "#f4f4f4"; x.lineWidth = 2; x.beginPath(); x.moveTo(-12, 16); x.lineTo(-8, -10); x.moveTo(12, 16); x.lineTo(8, -10); x.stroke();
          [[-10, "#d32f2f"], [-2, "#ffffff"], [6, "#d32f2f"]].forEach(([yy, cc]) => { rr(x, -13, yy, 26, 7, 1.5); x.fillStyle = cc; x.fill(); x.lineWidth = 1.2; x.strokeStyle = INK; x.stroke(); });
          break;
        case "chinelo":
          x.beginPath(); x.ellipse(0, 0, 8.5, 16, 0, 0, 7); x.fillStyle = "#1e88e5"; x.fill(); x.lineWidth = 1.6; x.strokeStyle = INK; x.stroke();
          x.strokeStyle = "#fff"; x.lineWidth = 3; x.beginPath(); x.moveTo(-6, -2); x.lineTo(0, -8); x.lineTo(6, -2); x.stroke();
          break;
        case "pedra":
          x.beginPath(); x.moveTo(-13, 5); x.lineTo(-10, -7); x.lineTo(-2, -12); x.lineTo(9, -9); x.lineTo(13, 0); x.lineTo(10, 9); x.lineTo(0, 12); x.lineTo(-9, 10); x.closePath();
          x.fillStyle = lin(x, -12, -12, 12, 12, [[0, "#b9bdc4"], [.5, "#7d828a"], [1, "#43474e"]]); x.fill(); x.lineWidth = 1.2; x.strokeStyle = "rgba(0,0,0,.65)"; x.stroke();
          x.strokeStyle = "rgba(255,255,255,.3)"; x.lineWidth = .8; x.beginPath(); x.moveTo(-9, -6); x.lineTo(-2, -10); x.lineTo(5, -7); x.stroke();
          x.strokeStyle = "rgba(0,0,0,.35)"; x.beginPath(); x.moveTo(-3, -2); x.lineTo(2, 3); x.lineTo(1, 9); x.moveTo(5, -1); x.lineTo(9, 5); x.stroke();
          for (let i = 0; i < 30; i++) { x.fillStyle = `rgba(${i%2 ? "255,255,255" : "0,0,0"},${Math.random()*.18})`; x.fillRect(Math.random()*20 - 10, Math.random()*20 - 10, 1.2, 1.2); }
          break;
        case "ovo":
          x.beginPath(); x.ellipse(0, 0, 9, 12, 0, 0, 7); x.fillStyle = rad(x, 0, 0, 1, 12, [[0, "#ffffff"], [1, "#e8d9b0"]], -3, -4); x.fill(); x.lineWidth = 1.6; x.strokeStyle = INK; x.stroke();
          break;
      }
    });
  }
  function bullet() {                                // cai de ponta-cabeça
    return bake(18, 56, 9, 56, x => {
      x.fillStyle = lin(x, 0, 0, 0, 40, [[0, "rgba(255,255,255,0)"], [1, "rgba(255,255,255,.7)"]]); rr(x, 7.5, 0, 3, 34, 1.5); x.fill();
      rr(x, 3, 22, 12, 22, 3); x.fillStyle = lin(x, 3, 0, 15, 0, [[0, "#ffe27a"], [1, "#a8741a"]]); x.fill(); x.lineWidth = 1.6; x.strokeStyle = INK; x.stroke();
      poly(x, [[3, 43], [15, 43], [9, 55]], "#c97a35", INK, 1.6);
    });
  }
  function arrow() {                                 // ponta para baixo
    return bake(26, 72, 13, 72, x => {
      x.fillStyle = "#7a5230"; rr(x, 11.6, 6, 2.8, 52, 1.2); x.fill(); x.lineWidth = 1; x.strokeStyle = INK; x.stroke();
      poly(x, [[8, 58], [18, 58], [13, 72]], "#a4aab2", INK, 1.4);
      [[8, "#ff3b30"], [14, "#2f9a3f"]].forEach(([yy, cc]) => poly(x, [[13, yy], [21, yy - 6], [21, yy + 4], [13, yy + 12]], cc, INK, 1));
      poly(x, [[13, 8], [5, 2], [5, 12], [13, 18]], "#ff3b30", INK, 1);
    });
  }
  function bomb() {                                   // cai com a ponta para baixo
    return bake(40, 74, 20, 74, x => {
      poly(x, [[8, 4], [20, 12], [32, 4], [32, 18], [8, 18]], "#555a55", INK, 1.5);
      rr(x, 9, 12, 22, 40, 10); x.fillStyle = lin(x, 9, 0, 31, 0, [[0, "#4a4f4a"], [.45, "#2f332f"], [1, "#151715"]]); x.fill(); x.lineWidth = 1.8; x.strokeStyle = INK; x.stroke();
      poly(x, [[9, 48], [31, 48], [20, 74]], "#2a2d2a", INK, 1.8);
      x.fillStyle = "#d7191c"; rr(x, 9, 24, 22, 6, 2); x.fill(); x.lineWidth = 1.2; x.stroke();
      x.fillStyle = "rgba(255,255,255,.2)"; rr(x, 13, 18, 4, 28, 2); x.fill();
    });
  }
  function umbrella() {
    return bake(64, 62, 32, 58, x => {
      x.fillStyle = "#eee"; rr(x, 31, 16, 2.4, 40, 1.2); x.fill(); x.lineWidth = 1; x.strokeStyle = INK; x.stroke();
      x.beginPath(); x.moveTo(4, 26); x.quadraticCurveTo(8, 2, 32, 2); x.quadraticCurveTo(56, 2, 60, 26); x.quadraticCurveTo(52, 20, 46, 26); x.quadraticCurveTo(39, 20, 32, 26); x.quadraticCurveTo(25, 20, 18, 26); x.quadraticCurveTo(12, 20, 4, 26); x.closePath();
      x.fillStyle = lin(x, 4, 2, 60, 26, [[0, "#ff6b6e"], [1, "#a8070b"]]); x.fill(); x.lineWidth = 2; x.strokeStyle = INK; x.stroke();
      x.strokeStyle = "rgba(255,255,255,.55)"; x.lineWidth = 3; x.beginPath(); x.moveTo(24, 4); x.quadraticCurveTo(20, 14, 18, 25); x.moveTo(40, 4); x.quadraticCurveTo(44, 14, 46, 25); x.stroke();
      ball(x, 32, 2, 2.4, 0xffffff, INK, 1);
    });
  }
  function coneMark() {                               // cone de "erro" que marca a casa
    return bake(24, 30, 12, 28, x => {
      poly(x, [[2, 26], [22, 26], [22, 29], [2, 29]], "#ff7a1a", INK, 1.2);
      poly(x, [[5, 26], [19, 26], [14, 3], [10, 3]], "#ff7a1a", INK, 1.5);
      poly(x, [[7.4, 16], [16.6, 16], [15.4, 11], [8.6, 11]], "#fff", INK, 1);
      poly(x, [[5, 26], [19, 26], [14, 3], [10, 3]], null, INK, 1.5);
    });
  }
  function flame(layer) {                             // 3 camadas de chama (grande, média, miolo)
    const cols = [["#ff6a10", "#ff2a00"], ["#ffc21a", "#ff8a00"], ["#fff3a0", "#ffd23a"]][layer];
    return bake(40, 62, 20, 58, x => {
      x.beginPath(); x.moveTo(20, 2); x.quadraticCurveTo(34, 24, 36, 40); x.quadraticCurveTo(36, 58, 20, 58); x.quadraticCurveTo(4, 58, 4, 40); x.quadraticCurveTo(6, 26, 20, 2); x.closePath();
      x.fillStyle = lin(x, 0, 4, 0, 58, [[0, cols[1]], [1, cols[0]]]); x.fill();
    });
  }
  /* manchas no chão / anéis / pontos de luz */
  function blob() {
    return bake(64, 64, 32, 32, x => {
      x.fillStyle = "#fff"; x.beginPath();
      const n = 16; for (let i = 0; i < n; i++) { const a = i/n*Math.PI*2, r = 26 + Math.random()*5; x[i ? "lineTo" : "moveTo"](32 + Math.cos(a)*r, 32 + Math.sin(a)*r); }
      x.closePath(); x.fill();
    });
  }
  /* moeda e ícones de item (butim) */
  function coin() {
    return bake(40, 40, 20, 20, x => {
      x.fillStyle = rad(x, 20, 20, 2, 19, [[0, "#fff6b0"], [.55, "#f2b92a"], [1, "#9a6a08"]], 14, 12); x.beginPath(); x.arc(20, 20, 17, 0, 7); x.fill(); x.lineWidth = 2; x.strokeStyle = "#5a3a00"; x.stroke();
      x.strokeStyle = "rgba(255,246,190,.9)"; x.lineWidth = 1.6; x.beginPath(); x.arc(20, 20, 12.4, 0, 7); x.stroke();
      x.fillStyle = "#7a4a00"; x.font = "900 17px 'Segoe UI',Arial,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText("$", 20, 21.5);
      x.fillStyle = "rgba(255,255,255,.55)"; x.beginPath(); x.ellipse(13, 12, 5, 2.4, -.6, 0, 7); x.fill();
    });
  }
  function itemIcon(id) {
    return bake(44, 44, 22, 22, x => {
      x.translate(22, 22);
      if (id === "revive") {                                       // frasco de remédio
        x.fillStyle = lin(x, -12, -16, 12, 16, [[0, "#ffffff"], [1, "#c8ccd6"]]); rr(x, -12, -9, 24, 24, 5); x.fill(); x.lineWidth = 1.8; x.strokeStyle = INK; x.stroke();
        x.fillStyle = "#cfd3dc"; rr(x, -8, -16, 16, 8, 2.5); x.fill(); x.stroke();
        x.fillStyle = "#e0242a"; x.fillRect(-2.6, -2, 5.2, 14); x.fillRect(-7.5, 2.6, 15, 5.2);
      } else if (id === "furia") {                                 // lata de energético
        x.fillStyle = lin(x, -11, 0, 11, 0, [[0, "#6fbfff"], [.5, "#2a7fe0"], [1, "#16407a"]]); rr(x, -11, -14, 22, 30, 4); x.fill(); x.lineWidth = 1.8; x.strokeStyle = INK; x.stroke();
        x.fillStyle = "#d9dde6"; rr(x, -11, -14, 22, 5, 2); x.fill(); x.fillStyle = "#ffe14a"; x.beginPath(); x.moveTo(2, -6); x.lineTo(-6, 5); x.lineTo(-1, 5); x.lineTo(-3, 13); x.lineTo(6, 1); x.lineTo(1, 1); x.closePath(); x.fill(); x.stroke();
      } else {                                                      // megafone
        x.fillStyle = "#ffd23a"; x.beginPath(); x.moveTo(-14, -4); x.lineTo(-4, -4); x.lineTo(14, -14); x.lineTo(14, 14); x.lineTo(-4, 4); x.lineTo(-14, 4); x.closePath(); x.fill(); x.lineWidth = 1.8; x.strokeStyle = INK; x.stroke();
        x.fillStyle = "#555"; rr(x, -12, 3, 7, 12, 2); x.fill(); x.stroke();
        x.strokeStyle = "#ffe9a0"; x.lineWidth = 2; x.beginPath(); x.arc(14, 0, 6, -1, 1); x.stroke();
      }
    });
  }
  /* mancha de impacto irregular com respingos (tomate, ovo, poeira) */
  function splat() {
    return bake(96, 96, 48, 48, x => {
      x.fillStyle = "#fff"; x.beginPath();
      const n = 22; for (let i = 0; i < n; i++) { const an = i/n*Math.PI*2, r = (i%3 === 0 ? 30 : 17) + Math.random()*8; const px = 48 + Math.cos(an)*r, py = 48 + Math.sin(an)*r; i ? x.lineTo(px, py) : x.moveTo(px, py); }
      x.closePath(); x.fill();
      for (let i = 0; i < 16; i++) { const an = Math.random()*6.28, r = 26 + Math.random()*18, rr = 1 + Math.random()*3.4; x.beginPath(); x.arc(48 + Math.cos(an)*r, 48 + Math.sin(an)*r, rr, 0, 7); x.fill(); }
      for (let i = 0; i < 9; i++) { const an = Math.random()*6.28, l = 26 + Math.random()*16; x.lineWidth = 1.6 + Math.random()*1.6; x.strokeStyle = "#fff"; x.beginPath(); x.moveTo(48 + Math.cos(an)*14, 48 + Math.sin(an)*14); x.lineTo(48 + Math.cos(an)*l, 48 + Math.sin(an)*l); x.stroke(); }
      x.fillStyle = "rgba(0,0,0,.18)"; x.beginPath(); x.arc(46, 46, 9, 0, 7); x.fill();
    });
  }
  function ring() {
    return bake(96, 96, 48, 48, x => {
      x.strokeStyle = "#fff"; x.lineWidth = 6; x.beginPath(); x.arc(48, 48, 41, 0, 7); x.stroke();
      x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 12; x.beginPath(); x.arc(48, 48, 40, 0, 7); x.stroke();
    });
  }
  function glow() {
    return bake(128, 128, 64, 64, x => {
      x.fillStyle = rad(x, 64, 64, 0, 64, [[0, "rgba(255,255,255,1)"], [.35, "rgba(255,255,255,.45)"], [1, "rgba(255,255,255,0)"]]); x.fillRect(0, 0, 128, 128);
    });
  }
  function chip(shape) {                              // confete
    return bake(16, 16, 8, 8, x => {
      x.fillStyle = "#fff";
      if (shape === 0) { rr(x, 3, 3, 10, 6, 1.5); x.fill(); }
      else if (shape === 1) { ell(x, 8, 8, 4.5, 4.5, "#fff"); }
      else { starPath(x, 8, 8.5, 6.5, 2.8); x.fill(); }
    });
  }

  /* ---------- rótulos ---------- */
  function label(text, color) {
    const [m] = make(10, 10); const mx = m.getContext("2d"); mx.font = "800 15px 'Segoe UI',Arial,sans-serif";
    const tw = Math.ceil(mx.measureText(text).width) + 30, w = Math.min(280, tw), h = 30;
    return bake(w, h + 4, w/2, h + 4, x => {
      x.fillStyle = "rgba(10,14,20,.85)"; rr(x, 1.5, 1.5, w - 3, h - 3, 11); x.fill();
      x.lineWidth = 2.4; x.strokeStyle = color; x.stroke();
      x.fillStyle = "#fff"; x.font = "800 15px 'Segoe UI',Arial,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, w/2, h/2 + 1, w - 14);
    });
  }
  function hint(text, color) {
    return bake(420, 64, 210, 0, x => {
      x.fillStyle = "rgba(10,14,22,.92)"; rr(x, 3, 3, 414, 58, 29); x.fill();
      x.lineWidth = 3.4; x.strokeStyle = color; x.stroke();
      x.fillStyle = "#fff"; x.font = "800 22px 'Segoe UI',Arial,sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(text, 210, 33, 380);
    });
  }

  return { Q, INK, HW, HH, HY, css, shade, mix, rgb, hex, rnd, make, bake, rr, lin, rad, ell, poly, ball, starPath,
           flag, shadow, shadowDir, fanBody, fanArm, unitBody, captainBody, captainArm,
           sheared, drawMoto, drawBus, drawTruck, drawHeli, rotor, throwIcon, bullet, arrow, bomb, umbrella, coneMark, flame,
           blob, splat, coin, itemIcon, ring, glow, chip, label, hint };
})();

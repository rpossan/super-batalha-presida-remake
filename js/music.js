/* ================================================================
   Trilha sonora e efeitos (WebAudio, sem arquivos de áudio)
   Motor de síntese moderno: pads, baixos 808/elétrico, piano elétrico (FM),
   cordas, metais, flauta, sanfona, violão, percussão brasileira e orquestral,
   reverb, delay, compressor e limitador. Cada cenário tem a sua música:
   - menu: hino épico de campanha        - paulista: trap/lo-fi urbano
   - rio: samba moderno                  - poa: milonga gaúcha
   - sertao: baião                       - amazonia: ambiente tribal
   - camboriu: tropical house            - brasilia: cinema solene
   - apocalipse: híbrido orquestral/industrial
   ================================================================ */
"use strict";
const MusicEngine = (() => {
  const mf = n => 440*Math.pow(2, (n - 69)/12);
  const CH = { maj:[0,4,7], min:[0,3,7], m7:[0,3,7,10], M7:[0,4,7,11], d7:[0,4,7,10], sus:[0,2,7], m9:[0,3,7,10,14], six:[0,4,7,9], dim:[0,3,6], pw:[0,7,12] };
  const chord = (root, q, oct = 0) => CH[q].map(x => root + x + 12*oct);
  const rnd = (a, b) => a + Math.random()*(b - a);

  /* notação de melodia: "76*2 74 r*3": nota[*duração em passos] ; r = pausa. Retorna lista indexada por passo */
  function parse(str) {
    const ev = Array(16).fill(null); let p = 0;
    str.trim().split(/\s+/).forEach(tok => {
      const [a, b] = tok.split("*"), l = b ? +b : 1;
      if (a !== "r" && a !== ".") ev[p] = { n:+a, l };
      p += l;
    });
    return ev;
  }
  const mel = (...bars) => bars.map(parse);

  function make(ctx, dest, opt = {}) {
    const out = ctx.createGain(); out.gain.value = opt.vol ?? .22;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3.2; comp.attack.value = .004; comp.release.value = .2;
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = .001; lim.release.value = .06;
    out.connect(comp); comp.connect(lim); lim.connect(dest);
    // ruído compartilhado
    const nb = ctx.createBuffer(1, ctx.sampleRate*2, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random()*2 - 1;
    // reverb por convolução (resposta gerada)
    const irLen = Math.floor(ctx.sampleRate*(opt.rev ?? 2.2)), ir = ctx.createBuffer(2, irLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < irLen; i++) { const k = i/irLen; d[i] = (Math.random()*2 - 1)*Math.pow(1 - k, 2.6)*(k < .02 ? k/.02 : 1); } }
    const revIn = ctx.createGain(), conv = ctx.createConvolver(), revWet = ctx.createGain(); conv.buffer = ir; revWet.gain.value = opt.revWet ?? .5;
    const revHp = ctx.createBiquadFilter(); revHp.type = "highpass"; revHp.frequency.value = 220;
    revIn.connect(revHp); revHp.connect(conv); conv.connect(revWet); revWet.connect(out);
    // delay com realimentação filtrada
    const dlyIn = ctx.createGain(), dly = ctx.createDelay(2), fb = ctx.createGain(), dlp = ctx.createBiquadFilter(), dWet = ctx.createGain();
    dly.delayTime.value = .375; fb.gain.value = .36; dlp.type = "lowpass"; dlp.frequency.value = 2400; dWet.gain.value = .5;
    dlyIn.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly); dlp.connect(dWet); dWet.connect(out);
    // curva de distorção
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i/512 - 1; curve[i] = Math.tanh(x*3.2); }

    const NY = ctx.sampleRate*.45, fq = x => Math.max(30, Math.min(NY, x));
    const E = { ctx, out, dlyTime(sec) { dly.delayTime.value = sec; }, revSend(node) { node.connect(revIn); } };

    /* ----- voz genérica ----- */
    function voice(o) {
      const t = o.t, f = o.f, dur = Math.max(.03, o.dur), a = Math.min(o.a ?? .01, dur), r = o.r ?? .1, vol = o.vol ?? .2;
      const dec = Math.min(o.d ?? 0, Math.max(0, dur - a - .005)), sus = o.s ?? 1, hold = dec > 0 ? Math.max(.0002, vol*sus) : vol, end = t + dur;
      const g = ctx.createGain();
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + a);
      if (dec > 0) g.gain.exponentialRampToValueAtTime(hold, t + a + dec);
      g.gain.setValueAtTime(hold, end); g.gain.exponentialRampToValueAtTime(.0001, end + r);
      const oscs = o.oscs || [{ type:o.type || "sine" }], stopAt = end + r + .08, srcs = [];
      const lpN = o.lp ? ctx.createBiquadFilter() : null;
      if (lpN) { lpN.type = "lowpass"; lpN.Q.value = o.q ?? .7; lpN.frequency.setValueAtTime(fq(o.lp[0]), t); lpN.frequency.exponentialRampToValueAtTime(fq(o.lp[1]), t + (o.lp[2] ?? .3)); }
      const hpN = o.hp ? ctx.createBiquadFilter() : null;
      if (hpN) { hpN.type = "highpass"; hpN.frequency.value = fq(o.hp); }
      // mixer -> [shaper] -> lp -> hp -> g
      const mix = ctx.createGain(); mix.gain.value = 1/Math.sqrt(oscs.length);
      let node = mix;
      if (o.shape) { const sh = ctx.createWaveShaper(); sh.curve = curve; sh.oversample = "2x"; node.connect(sh); node = sh; }
      if (lpN) { node.connect(lpN); node = lpN; }
      if (hpN) { node.connect(hpN); node = hpN; }
      node.connect(g);
      oscs.forEach(od => {
        const os = ctx.createOscillator(), og = ctx.createGain(); os.type = od.type || "sine";
        const ff = f*(od.mul ?? 1);
        if (o.glide) { os.frequency.setValueAtTime(ff*o.glide.from, t); os.frequency.exponentialRampToValueAtTime(ff, t + o.glide.time); } else os.frequency.setValueAtTime(ff, t);
        os.detune.value = od.det ?? 0; og.gain.value = od.gain ?? 1;
        if (o.vib) { const lf = ctx.createOscillator(), lg = ctx.createGain(); lf.frequency.value = o.vib.rate ?? 5.5; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(o.vib.depth ?? 8, t + (o.vib.delay ?? .15) + .2); lf.connect(lg); lg.connect(os.detune); lf.start(t); lf.stop(stopAt); }
        os.connect(og); og.connect(mix); os.start(t); os.stop(stopAt);
      });
      let outNode = g;
      if (o.trem) { const tg = ctx.createGain(), lf = ctx.createOscillator(), lg = ctx.createGain(); tg.gain.value = 1 - o.trem.depth/2; lf.frequency.value = o.trem.rate; lg.gain.value = o.trem.depth/2; lf.connect(lg); lg.connect(tg.gain); lf.start(t); lf.stop(stopAt); g.connect(tg); outNode = tg; }
      if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; outNode.connect(p); outNode = p; }
      outNode.connect(o.dest || out);
      if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; outNode.connect(s); s.connect(revIn); }
      if (o.dly) { const s = ctx.createGain(); s.gain.value = o.dly; outNode.connect(s); s.connect(dlyIn); }
    }
    /* ----- ruído filtrado ----- */
    function noise(o) {
      const t = o.t, dur = o.dur, a = o.a ?? .002, vol = o.vol ?? .2;
      const src = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      src.buffer = nb; src.loop = true; f.type = o.type || "bandpass"; f.Q.value = o.q ?? .8;
      f.frequency.setValueAtTime(fq(o.f ?? 3000), t); if (o.f2) f.frequency.exponentialRampToValueAtTime(fq(o.f2), t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(f); f.connect(g);
      let nd = g; if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; g.connect(p); nd = p; }
      nd.connect(o.dest || out);
      if (o.rev) { const s = ctx.createGain(); s.gain.value = o.rev; nd.connect(s); s.connect(revIn); }
      src.start(t, Math.random()*1.5); src.stop(t + dur + .05);
    }
    E.voice = voice; E.noise = noise;

    /* ----- bateria e percussão ----- */
    E.kick = (t, v = 1, o = {}) => { voice({ t, f:o.low ?? 48, dur:o.len ?? .3, vol:.95*v, a:.001, r:.09, glide:{ from:(o.hi ?? 160)/(o.low ?? 48), time:.055 } }); noise({ t, dur:.012, vol:.18*v, type:"highpass", f:2500 }); };
    E.snare = (t, v = 1, o = {}) => { noise({ t, dur:o.len ?? .2, vol:.42*v, type:"bandpass", f:o.f ?? 1900, q:.7, rev:.12 }); voice({ t, f:o.tone ?? 190, dur:.12, vol:.3*v, a:.001, r:.05, glide:{ from:1.4, time:.05 }, oscs:[{ type:"triangle" }] }); };
    E.clap = (t, v = 1) => { [0, .011, .024].forEach(d => noise({ t:t + d, dur:.03, vol:.3*v, type:"bandpass", f:1500, q:1.2 })); noise({ t:t + .03, dur:.22, vol:.2*v, type:"bandpass", f:1300, q:.9, rev:.35 }); };
    E.hat = (t, v = 1, open = false, pan = 0) => noise({ t, dur:open ? .24 : .045, vol:(open ? .1 : .13)*v, type:"highpass", f:open ? 7000 : 8500, q:.5, pan });
    E.shaker = (t, v = 1) => noise({ t, dur:.06, a:.012, vol:.12*v, type:"bandpass", f:6500, q:1.4, pan:rnd(-.3, .3) });
    E.rim = (t, v = 1) => { voice({ t, f:900, dur:.04, vol:.18*v, a:.001, r:.02, oscs:[{ type:"square" }], lp:[3000, 1500, .03] }); noise({ t, dur:.03, vol:.1*v, type:"highpass", f:3000 }); };
    E.tom = (t, f, v = 1, len = .3) => { voice({ t, f, dur:len, vol:.6*v, a:.002, r:.1, glide:{ from:1.5, time:.08 } }); noise({ t, dur:.05, vol:.14*v, type:"bandpass", f:f*6, q:1 }); };
    E.conga = (t, f, v = 1) => { voice({ t, f, dur:.16, vol:.45*v, a:.001, r:.05, glide:{ from:1.18, time:.04 } }); noise({ t, dur:.02, vol:.12*v, type:"bandpass", f:1800, q:1.2 }); };
    E.surdo = (t, v = 1, o = {}) => { voice({ t, f:o.f ?? 68, dur:o.len ?? .55, vol:.85*v, a:.003, r:.2, glide:{ from:1.25, time:.09 } }); noise({ t, dur:.04, vol:.12*v, type:"lowpass", f:400 }); };
    E.zabumba = (t, v = 1, accent = false) => { voice({ t, f:accent ? 92 : 110, dur:accent ? .32 : .2, vol:.7*v, a:.002, r:.08, glide:{ from:1.3, time:.05 } }); noise({ t, dur:.03, vol:.16*v, type:"bandpass", f:500, q:1 }); };
    E.slap = (t, v = 1) => { noise({ t, dur:.06, vol:.2*v, type:"bandpass", f:2400, q:1.4 }); voice({ t, f:260, dur:.06, vol:.14*v, a:.001, r:.03, glide:{ from:1.4, time:.03 } }); };
    E.triangle = (t, v = 1, open = false) => voice({ t, f:1, dur:open ? .5 : .12, vol:.1*v, a:.001, r:.1, oscs:[{ type:"sine", mul:4700, gain:1 }, { type:"sine", mul:7400, gain:.6 }, { type:"sine", mul:9870, gain:.4 }], rev:.2 });
    E.tamborim = (t, v = 1) => { noise({ t, dur:.05, vol:.22*v, type:"bandpass", f:3400, q:1.3 }); voice({ t, f:1250, dur:.05, vol:.12*v, a:.001, r:.02, glide:{ from:1.2, time:.02 } }); };
    E.pandeiro = (t, v = 1, jingle = false) => { noise({ t, dur:jingle ? .16 : .07, vol:(jingle ? .12 : .16)*v, type:"highpass", f:jingle ? 9000 : 4500, q:.6, pan:.2 }); if (!jingle) voice({ t, f:380, dur:.06, vol:.1*v, a:.001, r:.03 }); };
    E.agogo = (t, v = 1, hi = false) => voice({ t, f:hi ? 1180 : 790, dur:.2, vol:.09*v, a:.001, r:.1, oscs:[{ type:"sine" }, { type:"sine", mul:2.76, gain:.35 }], rev:.15 });
    E.taiko = (t, v = 1, o = {}) => { voice({ t, f:o.f ?? 58, dur:.95, vol:.95*v, a:.003, r:.25, glide:{ from:1.9, time:.12 }, rev:.25 }); noise({ t, dur:.2, vol:.3*v, type:"bandpass", f:220, q:.8, rev:.3 }); noise({ t, dur:.03, vol:.2*v, type:"highpass", f:2000 }); };
    E.timpani = (t, f, v = 1, len = .8) => { voice({ t, f, dur:len, vol:.75*v, a:.004, r:.3, glide:{ from:1.1, time:.1 }, oscs:[{ type:"sine" }, { type:"triangle", gain:.3, mul:1.5 }], rev:.35 }); noise({ t, dur:.04, vol:.1*v, type:"lowpass", f:900 }); };
    E.roll = (t, f, dur, v = 1) => { const n = Math.floor(dur/.06); for (let i = 0; i < n; i++) E.timpani(t + i*.06, f, v*(.3 + .7*i/n), .25); };
    E.milSnare = (t, v = 1, ghost = false) => { noise({ t, dur:ghost ? .05 : .13, vol:(ghost ? .16 : .34)*v, type:"bandpass", f:3200, q:.9, rev:.12 }); if (!ghost) voice({ t, f:210, dur:.07, vol:.2*v, a:.001, r:.03 }); };
    E.crash = (t, v = 1, len = 1.8) => { noise({ t, dur:len, vol:.2*v, type:"highpass", f:5200, q:.4, rev:.4 }); noise({ t, dur:len*.6, vol:.1*v, type:"bandpass", f:9000, q:.5 }); };
    E.clang = (t, v = 1) => voice({ t, f:1, dur:1.2, vol:.1*v, a:.001, r:.4, oscs:[{ mul:420 }, { mul:677, gain:.7 }, { mul:1180, gain:.5 }, { mul:1630, gain:.35 }, { mul:2410, gain:.2 }], rev:.5 });
    E.riser = (t, dur, v = 1) => { noise({ t, dur, a:dur*.9, vol:.3*v, type:"bandpass", f:300, f2:7000, q:1.5, rev:.4 }); voice({ t, f:110, dur, vol:.1*v, a:dur*.9, r:.05, glide:{ from:.5, time:dur }, oscs:[{ type:"sawtooth", det:-6 }, { type:"sawtooth", det:6 }], lp:[300, 4000, dur] }); };

    /* ----- baixos ----- */
    E.sub808 = (t, f, dur, v = 1) => { voice({ t, f, dur, vol:.9*v, a:.003, r:.2, glide:{ from:1.7, time:.045 }, oscs:[{ type:"sine" }, { type:"triangle", mul:2, gain:.12 }] }); };
    E.pluckBass = (t, f, dur, v = 1) => voice({ t, f, dur, vol:.3*v, a:.003, d:.14, s:.55, r:.05, oscs:[{ type:"sawtooth" }, { type:"square", mul:.5, gain:.9 }], lp:[f*9, f*2.2, .14], q:3 });
    E.acBass = (t, f, dur, v = 1) => voice({ t, f, dur, vol:.55*v, a:.004, d:.3, s:.25, r:.1, oscs:[{ type:"triangle" }, { type:"sine", mul:2, gain:.3 }, { type:"sawtooth", gain:.12 }], lp:[f*7, f*2.4, .25] });
    E.distBass = (t, f, dur, v = 1) => voice({ t, f, dur, vol:.28*v, a:.003, d:.1, s:.7, r:.04, oscs:[{ type:"sawtooth", det:-8 }, { type:"sawtooth", det:8 }, { type:"square", mul:.5, gain:.8 }], shape:true, lp:[f*8, f*3, .2], q:2 });

    /* ----- harmonia e solos ----- */
    E.pad = (t, notes, dur, v = 1, o = {}) => notes.forEach((n, i) => voice({ t, f:mf(n), dur, vol:.06*v, a:o.a ?? .7, r:o.r ?? 1.1, oscs:[{ type:"sawtooth", det:-10 }, { type:"sawtooth", det:10 }, { type:"sawtooth", gain:.6 }], lp:[o.lp0 ?? 500, o.lp1 ?? 2200, dur*.85], q:.5, pan:(i%2 ? 1 : -1)*.35, rev:.55 }));
    E.strings = (t, notes, dur, v = 1, o = {}) => notes.forEach((n, i) => voice({ t, f:mf(n), dur, vol:.05*v, a:o.a ?? .5, r:o.r ?? .9, oscs:[{ type:"sawtooth", det:-7 }, { type:"sawtooth", det:7 }, { type:"sawtooth", det:0, mul:2, gain:.25 }], lp:[1100, 3400, dur*.7], q:.4, vib:{ rate:5.2, depth:7, delay:.3 }, pan:(i%2 ? 1 : -1)*.4, rev:.5 }));
    E.stab = (t, notes, len, v = 1) => notes.forEach((n, i) => voice({ t, f:mf(n), dur:len, vol:.05*v, a:.004, d:.08, s:.4, r:.05, oscs:[{ type:"sawtooth", det:-6 }, { type:"sawtooth", det:6 }], lp:[3600, 700, .13], pan:(i%2 ? 1 : -1)*.3, rev:.2 }));
    E.rhodes = (t, f, dur, v = 1, o = {}) => {
      const car = ctx.createOscillator(), mod = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      car.type = "sine"; mod.type = "sine"; car.frequency.value = f; mod.frequency.value = f*(o.ratio ?? 1);
      mg.gain.setValueAtTime(f*(o.idx ?? 1.7), t); mg.gain.exponentialRampToValueAtTime(f*.12, t + .55);
      const end = t + dur;
      g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.2*v, t + .004); g.gain.exponentialRampToValueAtTime(.05*v, t + .35); g.gain.setValueAtTime(.05*v, Math.max(t + .36, end)); g.gain.exponentialRampToValueAtTime(.0001, Math.max(t + .36, end) + .5);
      lp.type = "lowpass"; lp.frequency.value = fq(o.lp ?? 3800);
      mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(lp);
      let nd = lp; if (o.pan) { const p = ctx.createStereoPanner(); p.pan.value = o.pan; lp.connect(p); nd = p; } nd.connect(out);
      const s = ctx.createGain(); s.gain.value = o.rev ?? .3; nd.connect(s); s.connect(revIn);
      if (o.dly) { const d = ctx.createGain(); d.gain.value = o.dly; nd.connect(d); d.connect(dlyIn); }
      const stopAt = Math.max(t + .36, end) + .6; car.start(t); mod.start(t); car.stop(stopAt); mod.stop(stopAt);
    };
    E.marimba = (t, f, v = 1, pan = 0) => voice({ t, f, dur:.3, vol:.24*v, a:.002, d:.28, s:.001, r:.08, oscs:[{ type:"sine" }, { type:"sine", mul:4, gain:.22 }, { type:"sine", mul:10, gain:.06 }], pan, rev:.3, dly:.12 });
    E.bell = (t, f, dur, v = 1) => voice({ t, f, dur, vol:.14*v, a:.002, d:.5, s:.05, r:.5, oscs:[{ type:"sine" }, { type:"sine", mul:2.76, gain:.35 }, { type:"sine", mul:5.4, gain:.15 }], rev:.45, dly:.3 });
    E.pluck = (t, f, dur, v = 1, o = {}) => voice({ t, f, dur, vol:.3*v, a:.002, d:.4, s:.18, r:.1, oscs:[{ type:"triangle" }, { type:"sawtooth", gain:.5 }], lp:[f*10, f*1.5, .22], pan:o.pan, rev:o.rev ?? .18, dly:o.dly });
    E.strum = (t, notes, v = 1, dir = 1, spread = .013, o = {}) => (dir > 0 ? notes : [...notes].reverse()).forEach((n, i) => E.pluck(t + i*spread, mf(n), .45, v*(.7 + .3*(i/notes.length)), o));
    E.lead = (t, f, dur, v = 1, o = {}) => voice({ t, f, dur, vol:.17*v, a:.012, d:.3, s:.65, r:.18, oscs:[{ type:"sawtooth", det:-9 }, { type:"sawtooth", det:9 }, { type:"square", mul:.5, gain:.5 }], lp:[f*7, f*2.6, .3], q:1.2, vib:{ rate:5.5, depth:9, delay:.18 }, pan:o.pan, rev:.28, dly:.32 });
    E.brass = (t, f, dur, v = 1) => voice({ t, f, dur, vol:.17*v, a:.035, r:.14, oscs:[{ type:"sawtooth", det:-5 }, { type:"sawtooth", det:5 }, { type:"square", gain:.35 }], lp:[500, 3600, .1], q:.9, vib:{ rate:5, depth:6, delay:.25 }, rev:.3, dly:.15 });
    E.flute = (t, f, dur, v = 1) => { voice({ t, f, dur, vol:.2*v, a:.07, r:.14, oscs:[{ type:"sine" }, { type:"sine", mul:2, gain:.12 }, { type:"triangle", mul:.5, gain:.08 }], vib:{ rate:5, depth:14, delay:.22 }, rev:.5, dly:.22 }); noise({ t, dur:Math.min(.25, dur), a:.05, vol:.04*v, type:"bandpass", f:f*2.2, q:2, rev:.4 }); };
    E.accordion = (t, f, dur, v = 1, o = {}) => voice({ t, f, dur, vol:.16*v, a:.03, r:.08, oscs:[{ type:"sawtooth", det:-8 }, { type:"sawtooth", det:8 }, { type:"square", gain:.6 }, { type:"sawtooth", mul:2, gain:.28 }], lp:[3000, 2200, .2], hp:180, q:.6, trem:{ rate:5.6, depth:.22 }, pan:o.pan, rev:.2 });
    E.drone = (t, f, dur, v = 1) => voice({ t, f, dur, vol:.1*v, a:2, r:2.5, oscs:[{ type:"sawtooth", det:-12 }, { type:"sawtooth", det:12 }, { type:"sine", mul:.5, gain:.8 }], lp:[220, 700, dur*.6], q:1, vib:{ rate:.18, depth:14, delay:.5 }, rev:.4 });
    E.siren = (t, dur, v = 1) => { const o = ctx.createOscillator(), lf = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(), lp = ctx.createBiquadFilter(); o.type = "triangle"; o.frequency.value = 640; lf.frequency.value = .16; lg.gain.value = 240; lf.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.06*v, t + 1.5); g.gain.setValueAtTime(.06*v, t + dur - 1.5); g.gain.linearRampToValueAtTime(.0001, t + dur); lp.type = "lowpass"; lp.frequency.value = 1800; o.connect(lp); lp.connect(g); g.connect(out); const s = ctx.createGain(); s.gain.value = .5; g.connect(s); s.connect(revIn); o.start(t); lf.start(t); o.stop(t + dur + .1); lf.stop(t + dur + .1); };
    E.chirp = (t, f, v = 1) => { for (let i = 0; i < 3; i++) voice({ t:t + i*.09, f, dur:.06, vol:.05*v, a:.005, r:.03, glide:{ from:.8, time:.06 }, oscs:[{ type:"sine" }], pan:rnd(-.7, .7), rev:.5 }); };
    E.bed = (kind, t) => {                                              // camadas contínuas de ambiente
      const mk = (type, f, q, vol, lfoRate, lfoDepth) => {
        const src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
        src.buffer = nb; src.loop = true; flt.type = type; flt.frequency.value = f; flt.Q.value = q; g.gain.value = vol;
        if (lfoRate) { const lf = ctx.createOscillator(), lg = ctx.createGain(); lf.frequency.value = lfoRate; lg.gain.value = lfoDepth; lf.connect(lg); lg.connect(g.gain); lf.start(t); }
        src.connect(flt); flt.connect(g); g.connect(out); src.start(t);
      };
      if (kind === "waves") { mk("lowpass", 700, .5, .05, .11, .04); mk("highpass", 2500, .4, .012, .11, .01); }
      else if (kind === "jungle") { mk("bandpass", 5200, 3, .006, 9, .004); mk("lowpass", 500, .4, .018, .08, .012); mk("bandpass", 1200, .8, .008, .2, .005); }
      else if (kind === "city") { mk("lowpass", 260, .5, .03, .05, .01); }
      else if (kind === "vinyl") { mk("highpass", 6000, .4, .004); }
      else if (kind === "wind") { mk("bandpass", 600, 1.2, .02, .07, .014); }
    };
    return E;
  }

  /* ----------------------------------------------------------------
     Músicas. Cada uma: bpm, swing, bed (ambiente), step(c) por 16º de nota.
     c = { t, st (0..15), bar (0..7), L (volta), sd (s por passo), E }
     ---------------------------------------------------------------- */
  const third = map => n => n ? n - (map[n%12] ?? 4) : 0;
  const SONGS = {};

  /* Menu: hino épico de campanha, Dó maior (I–V–vi–IV) */
  (() => {
    const roots = [36, 43, 45, 41, 36, 43, 41, 43], types = ["maj", "maj", "min", "maj", "maj", "maj", "maj", "maj"];
    const M = mel("76*2 79*2 76*2 74 72 76*4 r*4", "74*2 79*2 74*2 71 74 79*4 r*4", "72*2 76*2 72*2 69 72 76*4 r*4", "72*2 77*2 72*2 69 72 77*4 r*4", "76*2 79*2 84*4 79*2 76*2 r*4", "83*2 79*2 74*4 79*2 83*2 r*4", "81*2 77*2 72*4 77*2 81*2 r*4", "79*2 83*2 86*4 83*2 79*2 r*4");
    SONGS.menu = { gain:.9, bpm:124, swing:0, step(c) {
      const { t, st, bar, L, sd, E } = c, r = roots[bar], q = types[bar], full = bar >= 4 || L > 0;
      if (st === 0) { E.pad(t, chord(r + 24, q), 16*sd, full ? 1 : .8); if (bar === 0 || bar === 4) E.crash(t, .8); }
      if (st%2 === 0) { const ch = chord(r + 36, q); E.stab(t, [ch[(st/2)%3]], sd*1.6, full ? .8 : .5); }
      if (full) { if (st%4 === 0) E.kick(t, 1); if (st === 4 || st === 12) E.clap(t, .8); if (st%4 === 2) E.hat(t, .9, true); else if (st%2 === 1) E.hat(t, .5); }
      else { if (st === 0) E.kick(t, .7); if (st%4 === 2) E.rim(t, .5); }
      if (full ? [0, 3, 6, 8, 10, 12, 14].includes(st) : st === 0 || st === 8) E.pluckBass(t, mf(r + (st >= 8 ? 12 : 0)), sd*1.8, full ? 1 : .8);
      if (bar === 7 && st === 0) E.riser(t, 16*sd, .8);
      const n = M[bar][st]; if (n) E.brass(t, mf(n.n), n.l*sd*.95, full ? 1 : .8);
    } };
  })();

  /* Paulista: trap / lo-fi urbano, Lá menor */
  (() => {
    const roots = [45, 41, 48, 43, 45, 41, 38, 40], types = ["m7", "M7", "M7", "six", "m7", "M7", "m7", "d7"];
    const M = mel("r*4 76*2 74*2 72*3 r 69*4", "r*2 72*2 74*2 72*2 69*3 r*5", "r*4 79*2 76*2 74*3 r 72*4", "r*2 74*2 76*2 79*4 76*2 r*4", "r*4 76*2 79*2 81*3 r 76*4", "r*2 77*2 76*2 72*2 69*3 r*5", "r*4 74*2 77*2 76*3 r 74*4", "r*2 71*2 74*2 76*4 80*2 r*4");
    SONGS.paulista = { gain:.85, bpm:90, swing:.1, bed:"city", step(c) {
      const { t, st, bar, L, sd, E } = c, r = roots[bar], q = types[bar], ch = chord(r + 12, q);
      if (st === 0 || st === 7 || st === 10) E.rhodes(t, mf(ch[0 + (st === 7 ? 1 : 0)]), (st === 0 ? 6 : 3)*sd, .7);
      if (st === 0) ch.slice(1).forEach((n, i) => E.rhodes(t + i*.012, mf(n), 6*sd, .5, { pan:i%2 ? .3 : -.3 }));
      if (st === 7 || st === 10) ch.slice(1, 3).forEach(n => E.rhodes(t, mf(n), 3*sd, .35));
      if (st === 0) E.sub808(t, mf(r - 12), 6*sd, 1);
      if (st === 6) E.sub808(t, mf(r - 12 + (bar%2 ? 7 : 0)), 3*sd, .8);
      if (st === 10) E.sub808(t, mf(r - 12), 4*sd, .85);
      if (st === 0 || st === 7 || st === 10 || (st === 14 && bar%2)) E.kick(t, st === 0 ? 1 : .85, { low:44, hi:140, len:.35 });
      if (st === 8) { E.snare(t, .9, { f:1700 }); E.clap(t, .5); }
      if (st%2 === 0) E.hat(t, st%4 === 0 ? .8 : .55, st === 14, st%4 === 0 ? -.2 : .2);
      else if (bar%4 === 3 && st > 11) { E.hat(t, .5); E.hat(t + sd*.5, .4); }
      else if (Math.random() < .25) E.hat(t, .3);
      if (L > 0 && st%4 === 0) E.pad(t, chord(r + 24, q).slice(0, 3), 4*sd, .35, { lp0:300, lp1:900 });
      const n = M[bar][st]; if (n) E.bell(t, mf(n.n), n.l*sd, L > 0 ? 1.1 : .9);
      if (Math.random() < .035) E.hat(t + sd*.5, .2);
    } };
  })();

  /* Rio: samba moderno, Lá menor */
  (() => {
    const roots = [45, 38, 40, 45, 45, 41, 40, 45], types = ["m7", "m7", "d7", "m7", "m7", "M7", "d7", "m7"];
    const M = mel("r*2 69*2 72*2 76*2 74 72 69*2 r*4", "74*2 77*2 74*2 72*2 69*2 r*2 74*2 r*2", "76*2 74*2 71*2 68*2 71*4 r*4", "69*6 r*2 72*2 76*2 81*2 r*2", "r*2 81*2 79*2 76*2 72*2 76*2 79*2 r*2", "77*2 81*2 77*2 74*2 72*4 r*4", "76*2 71*2 74*2 76*2 80*4 r*4", "81*4 76*2 72*2 69*6");
    const TAM = [1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0];
    SONGS.rio = { bpm:100, swing:.06, bed:"waves", step(c) {
      const { t, st, bar, L, sd, E } = c, r = roots[bar], q = types[bar];
      if (st === 4 || st === 12) E.surdo(t, 1, { f:66 }); else if (st === 0 || st === 8) E.surdo(t, .45, { f:80, len:.25 });
      if (TAM[st]) E.tamborim(t, .9);
      E.pandeiro(t, st%4 === 0 ? 1 : .5); if (st%4 === 2) E.pandeiro(t, .6, true);
      if (st%4 === 0 && st) E.shaker(t, .7);
      if ([0, 3, 6, 8, 11, 14].includes(st)) E.strum(t, chord(r + 36, q === "d7" ? "d7" : "m7").slice(0, 3), .45, st%2 ? -1 : 1, .008, { rev:.1, pan:.3 });
      if (st === 0) E.acBass(t, mf(r), 5*sd, 1); if (st === 6) E.acBass(t, mf(r + (q === "d7" ? 7 : 3)), 2*sd, .8); if (st === 8) E.acBass(t, mf(r + 7), 3*sd, .9); if (st === 12) E.acBass(t, mf(r), 3*sd, .85); if (st === 14) E.acBass(t, mf(r + 7), 2*sd, .7);
      if (L > 0 && [0, 6, 10].includes(st)) E.agogo(t, .9, st === 6);
      if (st === 0 && L > 0) E.pad(t, chord(r + 24, q).slice(0, 3), 16*sd, .4, { lp0:400, lp1:1400 });
      const n = M[bar][st]; if (n) E.flute(t, mf(n.n), n.l*sd*.95, 1);
    } };
  })();

  /* Porto Alegre: milonga gaúcha, Sol maior */
  (() => {
    const roots = [43, 48, 50, 43, 43, 40, 50, 43], types = ["maj", "maj", "d7", "maj", "maj", "min", "d7", "maj"];
    const M = mel("74*3 71 74*2 79*2 76*2 74*2 71*4", "72*3 76 79*2 76*2 72*2 76*2 r*4", "74*3 78 81*2 78*2 74*2 78*2 r*4", "79*4 76*2 74*2 71*4 r*4", "79*3 83 86*2 83*2 79*2 83*2 r*4", "76*3 79 83*2 79*2 76*2 79*2 r*4", "78*3 74 78*2 81*2 78*2 74*2 r*4", "74*2 76*2 79*4 74*4 r*4");
    const T = third({ 7:3, 9:3, 11:4, 0:3, 2:3, 4:4, 6:4 });
    SONGS.poa = { bpm:92, swing:0, bed:"wind", step(c) {
      const { t, st, bar, L, sd, E } = c, r = roots[bar], q = types[bar];
      if ([0, 8].includes(st)) E.zabumba(t, 1, true); else if ([3, 6, 11, 14].includes(st)) E.zabumba(t, .6);
      if ([4, 12].includes(st)) E.slap(t, .5);
      if (st%2 === 0) E.shaker(t, .55);
      if ([0, 3, 6, 8, 11, 14].includes(st)) E.strum(t, chord(r + 24, q), st === 0 || st === 8 ? .7 : .5, [0, 6, 11].includes(st) ? 1 : -1, .011, { rev:.12, pan:-.25 });
      if (st === 0 || st === 8) E.acBass(t, mf(r), 4*sd, 1); if (st === 6 || st === 14) E.acBass(t, mf(r + 7), 2*sd, .8); if (st === 11) E.acBass(t, mf(r + 7), 2*sd, .6);
      if (L > 0 && st === 0) E.pad(t, chord(r + 24, q).slice(0, 3), 16*sd, .3, { lp0:350, lp1:1200 });
      const n = M[bar][st]; if (n) { E.accordion(t, mf(n.n), n.l*sd*.95, 1, { pan:.2 }); E.accordion(t, mf(T(n.n)), n.l*sd*.95, .6, { pan:-.2 }); }
    } };
  })();

  /* Sertão: baião, Ré mixolídio */
  (() => {
    const roots = [38, 36, 43, 38, 38, 36, 43, 38];
    const M = mel("74*2 78*2 81*2 79*2 78*2 74*2 r*4", "72*2 76*2 79*2 76*2 74*2 72*2 r*4", "71*2 74*2 79*2 74*2 71*2 67*2 r*4", "74*4 78*2 74*2 69*4 r*4", "81*2 79*2 78*2 74*2 78*2 81*2 r*4", "79*2 76*2 72*2 76*2 79*2 84*2 r*4", "83*2 79*2 74*2 79*2 83*2 79*2 r*4", "81*2 78*2 74*2 78*2 81*6 r*2");
    const T = third({ 2:3, 4:3, 6:4, 7:3, 9:3, 11:4, 0:4 });
    SONGS.sertao = { bpm:108, swing:0, bed:"wind", step(c) {
      const { t, st, bar, L, sd, E } = c, r = roots[bar];
      if (st === 0) E.zabumba(t, 1, true); if (st === 6 || st === 14) E.zabumba(t, .75); if (st === 8) E.zabumba(t, .85, true);
      if (st === 4 || st === 12) E.slap(t, .6); if (st === 10) E.slap(t, .3);
      if (st%4 === 0) E.triangle(t, .8); else if (st%4 === 2) E.triangle(t, .7, true); else if (st%2 === 1) E.triangle(t, .25);
      if ([0, 6, 8, 14].includes(st)) E.strum(t, chord(r + 24, "maj"), .5, st%2 ? -1 : 1, .01, { rev:.1, pan:-.3 });
      if (st === 0 || st === 8) E.acBass(t, mf(r), 4*sd, 1); if (st === 6 || st === 14) E.acBass(t, mf(r + 7), 2*sd, .8);
      if (L > 0 && st === 0) E.pad(t, chord(r + 24, "sus").slice(0, 3), 16*sd, .3, { lp0:350, lp1:1000 });
      const n = M[bar][st]; if (n) { E.accordion(t, mf(n.n), n.l*sd*.95, 1, { pan:.15 }); E.accordion(t, mf(T(n.n)), n.l*sd*.95, .55, { pan:-.25 }); }
    } };
  })();

  /* Amazônia: ambiente tribal, Lá menor pentatônico */
  (() => {
    const pads = [[45, 52, 57], [45, 52, 57], [43, 50, 55], [45, 52, 57], [45, 52, 57], [41, 48, 53], [43, 50, 55], [45, 52, 57]];
    const M = mel("69*6 72*2 74*4 r*4", "76*6 74*2 72*4 r*4", "r*2 69*2 72*2 74*2 76*4 74*2 r*2", "72*6 69*2 67*8", "74*4 76*4 79*4 76*4", "81*6 79*2 76*4 r*4", "79*2 76*2 74*2 72*2 76*8", "69*12 r*4");
    SONGS.amazonia = { bpm:88, swing:0, bed:"jungle", step(c) {
      const { t, st, bar, L, sd, E } = c;
      if (st === 0) { E.drone(t, mf(pads[bar][0] - 12), 16*sd, 1); E.pad(t, pads[bar], 16*sd, .8, { lp0:300, lp1:1300, a:1.4, r:1.8 }); }
      if ([0, 3, 6, 10].includes(st)) E.tom(t, st === 0 ? 62 : st === 6 ? 78 : 92, st === 0 ? 1 : .65, .4);
      if (L > 0 && [4, 12].includes(st)) E.tom(t, 120, .4, .22);
      if (st%2 === 0) E.shaker(t, .5);
      if (st === 8 && bar%2 === 0) E.zabumba(t, .6, true);
      if (Math.random() < .03) E.chirp(t, rnd(2400, 3600), .8);
      if (st === 0 && Math.random() < .25) E.chirp(t + rnd(.1, 1.5), rnd(1800, 2800), .7);
      const n = M[bar][st]; if (n) E.flute(t, mf(n.n), n.l*sd*.97, 1);
    } };
  })();

  /* Camboriú: tropical house, Sol maior */
  (() => {
    const roots = [43, 40, 48, 50, 43, 40, 48, 50], types = ["maj", "min", "maj", "maj", "maj", "min", "maj", "maj"];
    const M = mel("74*2 76*2 79*4 76*2 74*2 71*4", "71*2 74*2 76*4 74*2 71*2 67*4", "72*2 76*2 79*4 76*2 72*2 76*4", "74*2 78*2 81*4 78*2 74*2 69*4", "79*2 81*2 83*4 81*2 79*2 74*4", "76*2 79*2 83*4 79*2 76*2 71*4", "76*2 79*2 84*4 79*2 76*2 72*4", "78*2 81*2 86*4 81*2 78*6");
    SONGS.camboriu = { gain:.9, bpm:108, swing:0, bed:"waves", step(c) {
      const { t, st, bar, L, sd, E } = c, r = roots[bar], q = types[bar], ch = chord(r + 24, q);
      if (st%4 === 0) E.kick(t, .85, { low:50, hi:130, len:.26 });
      if (st === 4 || st === 12) E.clap(t, .6);
      if (st%4 === 2) E.hat(t, .8, true, .15); else if (st%2 === 1) E.hat(t, .3, false, -.15);
      if (st%2 === 0) E.shaker(t, .45);
      if (st%2 === 0) E.marimba(t, mf(ch[[0, 1, 2, 1][(st/2)%4]] + 12), .8, ((st/2)%2 ? .3 : -.3));
      if (st === 0) E.pad(t, ch, 16*sd, .9, { lp0:500, lp1:1800 });
      if ([0, 6, 10].includes(st)) E.pluckBass(t, mf(r), (st === 0 ? 5 : 3)*sd, .9);
      if (L > 0 && st === 14) E.hat(t, .7, true);
      const n = M[bar][st]; if (n) E.lead(t, mf(n.n), n.l*sd*.95, L > 0 || bar >= 4 ? 1 : .8, { pan:.1 });
      if (bar === 7 && st === 0) E.riser(t, 16*sd, .6);
    } };
  })();

  /* Brasília: cinema solene, Dó maior */
  (() => {
    const bass = [36, 35, 33, 29, 40, 29, 31, 36], chords = [[60, 64, 67], [59, 62, 67], [57, 60, 64], [60, 65, 69], [64, 67, 72], [60, 65, 69], [62, 67, 71], [60, 64, 67]];
    const M = mel("72*3 r 72 76 79*3 r 84*4 r*2", "83*3 r 83 79 74*3 r 79*4 r*2", "81*3 r 81 76 72*3 r 76*4 r*2", "77*3 r 77 81 84*3 r 81*2 77*2 r*2", "76*2 79*2 84*4 88*4 84*4", "84*2 81*2 77*4 81*4 84*4", "83*2 86*2 83*4 79*4 83*4", "84*8 79*4 72*4");
    SONGS.brasilia = { gain:.85, bpm:96, swing:0, bed:"wind", step(c) {
      const { t, st, bar, L, sd, E } = c;
      if (st === 0) { E.strings(t, chords[bar], 16*sd, 1); E.strings(t, chords[bar].map(n => n - 12), 16*sd, .7); if (bar%4 === 0) E.crash(t, .6, 2.6); }
      if (st%2 === 0) E.voice({ t, f:mf(bass[bar] + 12), dur:sd*1.6, vol:.14, a:.01, d:.12, s:.5, r:.06, oscs:[{ type:"sawtooth" }, { type:"sawtooth", det:8 }], lp:[1500, 420, .15], rev:.15 });
      if (st === 0 || st === 8) E.timpani(t, mf(bass[bar] + 12), 1, .9); if (st === 12 && bar%2) E.timpani(t, mf(bass[bar] + 19), .6, .5);
      if (bar === 3 && st === 8) E.roll(t, mf(bass[bar] + 12), 8*sd, .9); if (bar === 7 && st === 8) E.roll(t, mf(36 + 12), 8*sd, 1);
      if (st === 4 || st === 12) E.milSnare(t, .8); if ((st === 14 || st === 15) && L > 0) E.milSnare(t, .6, true);
      const n = M[bar][st]; if (n) E.brass(t, mf(n.n), n.l*sd*.97, 1);
      if (L > 0 && n && n.l >= 3) E.brass(t, mf(n.n - 12), n.l*sd*.97, .5);
    } };
  })();

  /* Apocalipse: híbrido orquestral/industrial, Ré menor */
  (() => {
    const roots = [38, 38, 34, 33, 38, 38, 31, 33], chordsN = [[50, 53, 57], [50, 53, 57], [46, 50, 53], [45, 49, 52], [50, 53, 57], [50, 53, 57], [43, 46, 50], [45, 49, 52]];
    const M = mel("62*3 r 65*2 64*2 62*4 r*4", "62*2 65*2 69*4 68*2 65*2 r*4", "58*3 r 62*2 61*2 58*4 r*4", "57*2 61*2 64*4 62*2 61*2 r*4", "74*3 r 77*2 76*2 74*4 r*4", "74*2 77*2 81*4 80*2 77*2 r*4", "70*3 r 74*2 73*2 70*4 r*4", "69*2 73*2 76*4 74*2 73*2 r*4");
    const BASSP = [0, 2, 3, 4, 6, 8, 10, 11, 12, 14];
    SONGS.apocalipse = { gain:.55, bpm:138, swing:0, bed:"wind", step(c) {
      const { t, st, bar, L, sd, E } = c, r = roots[bar];
      if (st === 0) { E.strings(t, chordsN[bar], 16*sd, .9, { a:.2 }); E.drone(t, mf(r), 16*sd, .8); if (bar%4 === 0) { E.clang(t, .8); E.crash(t, .7, 2.6); } }
      if ([0, 3, 6, 8, 10, 14].includes(st)) E.kick(t, st === 0 || st === 8 ? 1 : .8, { low:42, hi:170, len:.3 });
      if (st === 4 || st === 12) { E.snare(t, 1, { f:1500, tone:170, len:.22 }); E.clap(t, .5); }
      if (st%2 === 0) E.hat(t, st%4 === 0 ? .8 : .55, false); if (st === 14) E.hat(t, .9, true);
      if (BASSP.includes(st)) E.distBass(t, mf(r + (st === 6 || st === 14 ? 12 : 0)), sd*.9, st%4 === 0 ? 1 : .8);
      if (st === 0 || st === 8) E.taiko(t, 1); if (st === 6 || st === 14) E.taiko(t, .6, { f:70 });
      if (bar === 7 && st >= 8) E.taiko(t, .6 + (st - 8)*.07, { f:60 + (st - 8)*2 });
      if (st === 0 && bar === 0) E.riser(t, 8*sd, 1);
      if (bar === 0 && st === 0 && L%2 === 0) E.siren(t, 16*sd*2, 1);
      if (st === 0 && bar%2 === 1) E.clang(t, .5);
      const n = M[bar][st]; if (n) { E.voice({ t, f:mf(n.n), dur:n.l*sd*.95, vol:.2, a:.03, r:.15, oscs:[{ type:"sawtooth", det:-6 }, { type:"sawtooth", det:6 }, { type:"square", mul:.5, gain:.5 }], lp:[400, 2400, .1], q:1.2, shape:true, rev:.3, dly:.2 }); }
    } };
  })();

  /* ----------------------------------------------------------------
     Executor: agenda os passos usando o relógio do WebAudio
     ---------------------------------------------------------------- */
  function createPlayer(ctx, dest) {
    let E = null, song = null, id = null, i = 0, next = 0, timer = null, ready = false;
    return {
      get timer() { return timer; },
      get gain() { return E && E.out; },
      level: .22,
      start(songId, on) {
        this.stop();
        song = SONGS[songId] || SONGS.paulista; id = songId; this.level = .22*(song.gain ?? 1);
        E = make(ctx, dest, { vol:on ? this.level : 0, rev:2.4 }); E.dlyTime(60/song.bpm*.75);
        if (song.bed) E.bed(song.bed, ctx.currentTime + .05);
        i = 0; next = ctx.currentTime + .12;
        timer = setInterval(() => this.tick(), 40);
      },
      tick() {
        if (!song || !E) return;
        const sd = 60/song.bpm/4;
        while (next < ctx.currentTime + .22) {
          const st = i%16, bar = ((i/16)|0)%8, L = Math.floor(i/128);
          song.step({ t:next + (st%2 ? sd*(song.swing || 0) : 0), st, bar, L, sd, E });
          next += sd; i++;
        }
      },
      stop() {
        if (timer) { clearInterval(timer); timer = null; }
        if (E) { const o = E.out, c = ctx; try { o.gain.cancelScheduledValues(c.currentTime); o.gain.setValueAtTime(o.gain.value, c.currentTime); o.gain.linearRampToValueAtTime(0, c.currentTime + .35); setTimeout(() => { try { o.disconnect(); } catch (e) {} }, 600); } catch (e) {} E = null; }
      },
    };
  }
  /* renderização offline (testes): devolve um AudioBuffer com N segundos da música */
  async function renderOffline(songId, seconds, sr = 22050) {
    const ctx = new OfflineAudioContext(2, Math.floor(sr*seconds), sr);
    const song = SONGS[songId], E = make(ctx, ctx.destination, { vol:.22*(song.gain ?? 1), rev:2.2 }); E.dlyTime(60/song.bpm*.75);
    if (song.bed) E.bed(song.bed, 0);
    const sd = 60/song.bpm/4; let i = 0;
    for (let t = .05; t < seconds - .5; t += sd, i++) { const st = i%16, bar = ((i/16)|0)%8, L = Math.floor(i/128); song.step({ t:t + (st%2 ? sd*(song.swing || 0) : 0), st, bar, L, sd, E }); }
    return ctx.startRendering();
  }
  return { SONGS, make, createPlayer, renderOffline, mf, chord };
})();

/* ================================================================
   API usada pelo jogo (substitui a trilha antiga em chiptune)
   ================================================================ */
const Music = { player:null, on:true, get gain() { return this.player && this.player.gain; }, get timer() { return this.player && this.player.timer; } };
function musicVol() { if (Music.gain) Music.gain.gain.value = (muted || !Music.on) ? 0 : Music.player.level; }
function musicStop() { if (Music.player) Music.player.stop(); }
function musicStart(id) {
  try {
    const c = audioCtx();
    if (!Music.player) Music.player = MusicEngine.createPlayer(c, c.destination);
    Music.player.start(id, !(muted || !Music.on));
  } catch (e) {}
}

/* ================================================================
   Efeitos sonoros (mesmo motor, barramento próprio)
   ================================================================ */
const Sfx = (() => {
  let E = null;
  const get = () => { if (!E) { const c = audioCtx(); E = MusicEngine.make(c, c.destination, { vol:.9, rev:1.4, revWet:.3 }); } return E; };
  const now = () => get().ctx.currentTime + .005;
  const engine = get;
  const mf = MusicEngine.mf;
  return {
    engine,
    /* substitui os bipes antigos: onda suavizada por filtro, com reverb leve */
    tone(freq, dur = .15, type = "square", vol = .07, slide = 0, delay = 0) {
      const e = get(), t = now() + delay, end = Math.max(30, freq + slide);
      const soft = type === "square" || type === "sawtooth";
      e.voice({ t, f:end, dur, vol:vol*2.4, a:.004, r:.06, glide:slide ? { from:freq/end, time:dur*.9 } : null,
        oscs:soft ? [{ type:"triangle" }, { type:type === "square" ? "square" : "sawtooth", gain:.35 }] : [{ type }], lp:soft ? [Math.min(5200, end*7), Math.min(2600, end*3), dur] : null, rev:.18 });
    },
    hit() { const e = get(), t = now(); e.voice({ t, f:62, dur:.2, vol:.9, a:.002, r:.08, glide:{ from:3.2, time:.07 } }); e.noise({ t, dur:.1, vol:.3, type:"bandpass", f:900, f2:300, q:.9, rev:.15 }); e.noise({ t:t + .01, dur:.05, vol:.12, type:"highpass", f:3500 }); },
    miss() { const e = get(), t = now(); e.noise({ t, dur:.28, a:.08, vol:.2, type:"bandpass", f:1500, f2:380, q:.8, rev:.2 }); e.voice({ t:t + .12, f:90, dur:.12, vol:.4, a:.003, r:.05, glide:{ from:1.6, time:.06 } }); },
    sunk() { const e = get(), t = now(); [67, 72, 76, 79].forEach((n, i) => e.brass(t + i*.09, mf(n), .3, .9)); e.crash(t + .27, .45, 1.2); e.taiko(t, .6); },
    power() { const e = get(), t = now(); e.riser(t, .7, .8); e.voice({ t, f:880, dur:.7, vol:.14, a:.05, r:.1, glide:{ from:.25, time:.65 }, oscs:[{ type:"sawtooth", det:-7 }, { type:"sawtooth", det:7 }], lp:[400, 5000, .65], rev:.3 }); },
    radar() { const e = get(), t = now(); [0, .34].forEach((d, i) => e.voice({ t:t + d, f:i ? 1100 : 1480, dur:.5, vol:i ? .1 : .16, a:.004, d:.4, s:.02, r:.3, oscs:[{ type:"sine" }, { type:"sine", mul:2.01, gain:.2 }], rev:.55 })); },
    tick() { const e = get(), t = now(); e.voice({ t, f:1480, dur:.03, vol:.07, a:.001, r:.02, oscs:[{ type:"square" }], lp:[4000, 2500, .03] }); },
    coin(item) { const e = get(), t = now(); [item ? 1568 : 1318, item ? 2093 : 1760].forEach((f, i) => e.voice({ t:t + i*.065, f, dur:.16, vol:.11, a:.001, d:.14, s:.01, r:.1, oscs:[{ type:"sine" }, { type:"sine", mul:2.01, gain:.25 }], rev:.3 })); },
    sp() { const e = get(), t = now(); [1568, 2349].forEach((f, i) => e.bell(t + i*.07, f, .5, 1.1)); },
    /* fanfarra de vitória (original): metais, tímpano e brilho de sinos */
    fanfare() {
      const e = get(), t = now() + .02, B = (d, n, l, v = 1) => e.brass(t + d, mf(n), l, v);
      [0, .11, .22].forEach(d => B(d, 72, .1, .9)); B(.33, 76, .5, 1); B(.88, 74, .16, .9); B(1.04, 76, .16, .9); B(1.2, 79, .8, 1.1);
      B(2.1, 77, .16, .9); B(2.26, 79, .16, .9); B(2.42, 81, .16, .9); B(2.58, 84, .9, 1.15);
      [0, 1.2, 2.58].forEach((d, i) => { e.timpani(t + d, mf(48), 1, .8); e.crash(t + d + .02, .5 + i*.1, 1.8); });
      e.strings(t + 2.58, [60, 64, 67, 72], 2.2, 1.3); e.strings(t + 1.2, [57, 60, 64], 1.2, .8);
      [84, 88, 91, 96].forEach((n, i) => e.bell(t + 2.65 + i*.09, mf(n), 1.4, .9));
    },
    /* subiu de nível: harpa ascendente com brilho */
    levelUp() {
      const e = get(), t = now(); [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => { e.pluck(t + i*.07, mf(n), .6, .9, { rev:.4 }); e.bell(t + i*.07, mf(n + 12), .9, .6); });
      e.brass(t + .5, mf(84), .9, 1); e.brass(t + .5, mf(79), .9, .8); e.timpani(t, mf(48), 1, .7); e.crash(t + .45, .6, 1.8); e.strings(t + .5, [64, 67, 72, 76], 1.6, 1.1);
    },
    defeat() {
      const e = get(), t = now() + .02; [[57, 0, .55], [55, .6, .55], [53, 1.2, 1.5]].forEach(([n, d, l]) => { e.brass(t + d, mf(n), l, .9); e.brass(t + d, mf(n - 12), l, .6); });
      e.timpani(t, mf(33), 1, 1); e.timpani(t + 1.2, mf(29), 1, 1.4); e.strings(t + .6, [45, 48, 53], 2, .9);
    },
    place() { const e = get(), t = now(); e.voice({ t, f:420, dur:.07, vol:.4, a:.001, r:.04, glide:{ from:2, time:.03 } }); e.noise({ t, dur:.03, vol:.12, type:"bandpass", f:2200, q:1.2 }); },
  };
})();

/* ================================================================
   Vozes de quem é acertado: falas curtas (voz do navegador, pt-BR) e gritos sintetizados
   ================================================================ */
const Voices = (() => {
  const WORDS = ["Ai!", "Ui!", "Ah, não!", "Socorro!", "Minha bandeira!", "Aaaah!", "Uuuf!", "Tomei!", "Ai, meu pé!", "Que isso!", "Eita!", "Ai, ai, ai!", "Me acertaram!", "Ô, calma!", "Ai, minha costela!", "Não vale!"];
  const ZOMBIE = ["Uuurgh…", "Grrrr…", "Aaargh…"];
  let last = 0, ptVoices = [];
  const loadVoices = () => { try { ptVoices = (speechSynthesis.getVoices() || []).filter(v => /pt[-_]BR/i.test(v.lang)); } catch (e) { ptVoices = []; } };
  try { loadVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener("voiceschanged", loadVoices); } catch (e) {}
  const rnd = (a, b) => a + Math.random()*(b - a);
  const pick = a => a[Math.floor(Math.random()*a.length)];

  /* grito/gemido sintetizado com formantes (vogal "a" caindo de tom) */
  function scream(pitch, dur, vol = 1) {
    const e = Sfx.engine(), c = e.ctx, t = c.currentTime + .01;
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lf = c.createOscillator(), lg = c.createGain();
    o.type = "sawtooth"; o2.type = "square"; o.frequency.setValueAtTime(pitch*1.25, t); o.frequency.exponentialRampToValueAtTime(pitch*.72, t + dur); o2.frequency.setValueAtTime(pitch*1.25, t); o2.frequency.exponentialRampToValueAtTime(pitch*.72, t + dur);
    lf.frequency.value = 6.5; lg.gain.value = pitch*.03; lf.connect(lg); lg.connect(o.frequency); lg.connect(o2.frequency);
    const mix = c.createGain(); mix.gain.value = .5; o.connect(mix); o2.connect(mix);
    [[800, 1.0, 12], [1250, .7, 12], [2600, .25, 10]].forEach(([f, k, q]) => { const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.setValueAtTime(f, t); bp.frequency.exponentialRampToValueAtTime(f*.78, t + dur); bp.Q.value = q; const bg = c.createGain(); bg.gain.value = k; mix.connect(bp); bp.connect(bg); bg.connect(g); });
    g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.55*vol, t + .04); g.gain.setValueAtTime(.5*vol, t + dur*.5); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    g.connect(e.out); const s = c.createGain(); s.gain.value = .3; g.connect(s); e.revSend(s);
    [o, o2, lf].forEach(n => { n.start(t); n.stop(t + dur + .05); });
    e.noise({ t, dur:Math.min(.3, dur), vol:.05*vol, type:"bandpass", f:1800, q:1 });
  }
  function speak(text) {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR"; const v = ptVoices.length ? pick(ptVoices) : null; if (v) u.voice = v;
    u.pitch = rnd(.5, 1.9); u.rate = rnd(1.05, 1.5); u.volume = .85;
    speechSynthesis.speak(u);
  }
  return {
    /* uma pessoa foi acertada */
    hit(opts = {}) {
      const nowT = performance.now(); if (nowT - last < 140) return; last = nowT;     // evita um coral quando vários caem juntos
      try {
        if (opts.zombie) { scream(rnd(70, 120), rnd(.6, 1.0), .8); return; }
        const speech = typeof speechSynthesis !== "undefined" && typeof SpeechSynthesisUtterance !== "undefined";
        if (speech && Math.random() < .55 && !(speechSynthesis.speaking && speechSynthesis.pending)) speak(pick(WORDS));
        else scream(Math.random() < .5 ? rnd(110, 170) : rnd(210, 330), rnd(.45, .85), 1);
      } catch (e) {}
    },
  };
})();
function voiceHit(opts) { if (!muted) Voices.hit(opts); }

/* ================================================================
   CAMPANHA DE EXEMPLO · COPA DO MUNDO (fictícia)
   Modelo completo e funcional de pacote de campanha: copie este arquivo, troque o id e o conteúdo.
   Para testar sem mexer no jogo:  abra  index.html?pack=js/campaigns/examples/copa-exemplo.js
   Valide com:  node tools/check-campaigns.mjs js/campaigns/examples/copa-exemplo.js
   Guia completo: CAMPANHAS.md
   ================================================================ */
"use strict";
(() => {
/* ---------------- desenho dos cenários ----------------
   Cada função recebe  E (efeitos: grade, cloudShadows, glow, mist, flag, fire…),
                       g (chão: poly, rect, paint, ring, blob, shadowBox, ao…)
                       K (peças: building, tree, palm, cactus, bush, car, lamp, piece…).
   O jogo desenha as duas arenas no meio (x entre -14 e 14, z entre -12 e 12): deixe essa área livre. */
const SCENERY = {
  /* gramado de treino com arquibancada de um lado */
  copa_treino: (E, g, K) => {
    const { rnd, lamp, tree, building } = K;
    g.poly([[-70, -30], [70, -30], [70, 30], [-70, 30]], "calcada");
    g.poly([[-34, -18], [34, -18], [34, 18], [-34, 18]], "gramado");
    for (let i = 0; i < 12; i += 2) g.poly([[-34 + i*5.7, -18], [-34 + (i + 1)*5.7, -18], [-34 + (i + 1)*5.7, 18], [-34 + i*5.7, 18]], 0xffffff, { alpha:.07 });
    g.paint([-34, -18], [34, -18], .22, 0xf4f4ee); g.paint([-34, 18], [34, 18], .22, 0xf4f4ee); g.paint([-34, -18], [-34, 18], .22, 0xf4f4ee); g.paint([34, -18], [34, 18], .22, 0xf4f4ee);
    g.paint([0, -18], [0, 18], .22, 0xf4f4ee); g.ring(0, 0, 4, .22, 0xf4f4ee);
    for (let i = 0; i < 9; i++) building(-36 + i*8.5, -28 - rnd(0, 2), 7, 4, rnd(4, 7), { lit:.1 });
    for (let x = -30; x <= 30; x += 10) lamp(x, -20);
    for (let i = 0; i < 8; i++) tree(-40 + i*11, 24, { r:rnd(.8, 1), h:rnd(1.4, 2), pal:"broad" });
    E.cloudShadows(.08); E.grade({ sat:1.08, con:1.04, bri:1.1 });
  },
  /* estádio à noite com holofotes */
  copa_arena: (E, g, K) => {
    const { rnd, lamp, building } = K;
    g.poly([[-70, -34], [70, -34], [70, 34], [-70, 34]], "concreto");
    g.poly([[-32, -17], [32, -17], [32, 17], [-32, 17]], "gramado", { tint:0x103a14, tintA:.3 });
    g.paint([-32, -17], [32, -17], .22, 0xf4f4ee); g.paint([-32, 17], [32, 17], .22, 0xf4f4ee); g.paint([0, -17], [0, 17], .22, 0xf4f4ee); g.ring(0, 0, 4, .22, 0xf4f4ee);
    for (let i = 0; i < 10; i++) { building(-40 + i*8.8, -29, 8, 5, rnd(7, 11), { lit:.25, style:"glass" }); building(-40 + i*8.8, 29, 8, 5, rnd(7, 11), { lit:.25, style:"glass" }); }
    for (let x = -36; x <= 36; x += 12) { lamp(x, -22, 9); lamp(x, 22, 9); }
    E.mist(0x0a1230, .18); E.glow(.5, .1, 0xfff1c4, 70, .35); E.grade({ sat:1.1, con:1.1, bri:.95 });
  },
  /* futebol de praia */
  copa_praia: (E, g, K) => {
    const { rnd, palm, bush } = K;
    g.poly([[-70, -34], [70, -34], [70, 34], [-70, 34]], "areia");
    g.poly([[-70, -34], [70, -34], [70, -22], [-70, -22]], 0x2f8fd1, { alpha:.9 });
    for (let i = 0; i < 24; i++) g.blob(rnd(-40, 40), rnd(-14, 14), rnd(.8, 2), rnd(.6, 1.4), 0x9c7f4a, rnd(.1, .22));
    for (let i = 0; i < 7; i++) palm(-34 + i*11, 24 + rnd(0, 3), 3.4);
    for (let i = 0; i < 5; i++) bush(-28 + i*14, -18, .8);
    E.sparkle([[-60, -33], [60, -33], [60, -23], [-60, -23]], 40); E.cloudShadows(.06); E.grade({ sat:1.15, con:1.05, bri:1.15 });
  },
  /* a final: estádio lotado ao pôr do sol */
  copa_final: (E, g, K) => {
    const { rnd, lamp, building } = K;
    g.poly([[-70, -34], [70, -34], [70, 34], [-70, 34]], "granito");
    g.poly([[-34, -18], [34, -18], [34, 18], [-34, 18]], "gramado");
    g.ring(0, 0, 4.5, .24, 0xf4f4ee); g.paint([0, -18], [0, 18], .24, 0xf4f4ee);
    for (let i = 0; i < 11; i++) { building(-44 + i*8.8, -30, 8, 6, rnd(9, 14), { lit:.3 }); building(-44 + i*8.8, 30, 8, 6, rnd(9, 14), { lit:.3 }); }
    for (let x = -40; x <= 40; x += 10) lamp(x, -23, 8);
    E.glow(.2, .15, 0xff9a4a, 80, .4); E.grade({ sat:1.12, con:1.06, bri:1.05 });
  },
};

SPBCampaigns.register({
  id:"copa-exemplo", world:2, status:"ready", emoji:"⚽",
  name:"Copa do Mundo (exemplo)", shortName:"Copa (exemplo)",
  tagline:"Duas seleções fictícias, um campeonato: escolha a sua torcida e chegue à grande final.",
  unlock:{ start:true },                                           // exemplo: aberta. Numa campanha real: { campaigns:["br2026"], level:8 }
  theme:{ accent:"#ffd23a", bg:"linear-gradient(135deg,#0a7a3d,#0d3b8c)" },
  sideStep:"1 · Escolha a sua seleção",

  /* ---- lados (cores: "#rrggbb"). ultraMode: "row" = linha inteira, "col" = coluna inteira ---- */
  sides:{
    azul:    { name:"Seleção Azul", short:"Azul", party:"Azul", tag:"azul e branco", main:"#1d5fd1", alt:"#ffffff",
               cross:"Chute colocado", ultra:"Contra-ataque", ultraMode:"row", bossPower:"explode", followers:{ one:"fã azul", many:"Fãs azuis" },
               skin:"#e8b48c", hair:"#2b1d14", shirts:["#1d5fd1", "#ffffff", "#1d5fd1", "#143c8f"],
               flag:{ bg:"#1d5fd1", shapes:[{ type:"diamond", x:80, y:55, w:62, h:40, color:"#ffffff" }, { type:"circle", x:80, y:55, r:20, color:"#1d5fd1" }] } },
    dourado: { name:"Seleção Dourada", short:"Dourada", party:"Dourada", tag:"dourado e marinho", main:"#e0a800", alt:"#13294b",
               cross:"Cobrança de falta", ultra:"Bola longa", ultraMode:"col", bossPower:"heal", followers:{ one:"fã dourado", many:"Fãs dourados" },
               textColor:"#13294b", skin:"#f2c9a5", hair:"#3a2a1a", shirts:["#e0a800", "#13294b", "#e0a800", "#b88500"],
               flag:{ bg:"#e0a800", stripes:{ dir:"h", colors:["#e0a800", "#13294b", "#e0a800"] }, shapes:[{ type:"star", x:80, y:55, r:30, inner:12, color:"#ffffff" }] } },
  },

  /* ---- personagens: o líder de cada lado usa a MESMA chave do lado. camp = lado a que pertence ---- */
  chars:{
    azul:    { name:"Capitão Azul",     short:"Cap. Azul",    party:"Azul",    camp:"azul",    skin:"#e8b48c", hair:"#2b1d14", hairStyle:"short" },
    dourado: { name:"Capitã Dourada",   short:"Cap. Dourada", party:"Dourada", camp:"dourado", skin:"#f2c9a5", hair:"#d9b36a", hairStyle:"long", fem:true },
    dg1:     { name:"Zagueiro Dourado", short:"Zagueiro",     party:"Dourada", camp:"dourado", skin:"#a8734a", hair:"#15110e", hairStyle:"buzz", beard:true },
    dg2:     { name:"Meia Dourada",     short:"Meia",         party:"Dourada", camp:"dourado", skin:"#e0ac82", hair:"#6b4a2a", hairStyle:"bob", fem:true },
    dg3:     { name:"Goleiro Dourado",  short:"Goleiro",      party:"Dourada", camp:"dourado", skin:"#f2c9a5", hair:"#8a8a92", hairStyle:"short", glasses:true, age:.5 },
    ag1:     { name:"Zagueira Azul",    short:"Zagueira",     party:"Azul",    camp:"azul",    skin:"#6e4a30", hair:"#15110e", hairStyle:"long", fem:true },
    ag2:     { name:"Volante Azul",     short:"Volante",      party:"Azul",    camp:"azul",    skin:"#e8b48c", hair:"#2b1d14", hairStyle:"short", beard:true },
    ag3:     { name:"Goleiro Azul",     short:"Goleiro",      party:"Azul",    camp:"azul",    skin:"#f8d6b8", hair:"#c2185b", hairStyle:"bald", glasses:true },
  },
  /* adversários por fase (um por fase); o chefão é o líder do lado oposto */
  tracks:{
    azul:    ["dg1", "dg2", "dg3", "dourado"],
    dourado: ["ag1", "ag2", "ag3", "azul"],
  },

  /* ---- torcida: 5 grupos (nome e tamanho 1 a 5). Os tamanhos padrão são 5, 4, 3, 3 e 2 ---- */
  fleet:[
    { name:"Torcida Organizada", len:5 }, { name:"Bateria", len:4 }, { name:"Charanga", len:3 }, { name:"Bandeirão", len:3 }, { name:"Cornetas", len:2 },
  ],

  /* ---- fases: scn = cenário; def = índices de fleet da torcida adversária; ai de 1 a 4; hazard opcional; boss:true no chefão ---- */
  levels:[
    { scn:"copa_treino", diff:"Fácil",   ai:1, def:[4, 3, 2] },
    { scn:"copa_arena",  diff:"Médio",   ai:2, def:[1, 2, 3, 4] },
    { scn:"copa_praia",  diff:"Difícil", ai:3, def:[0, 1, 2, 4], hazard:"bala" },
    { scn:"copa_final",  diff:"FINAL",   ai:4, def:[0, 1, 2, 3, 4], boss:true },
  ],

  scenarios:[
    { id:"copa_treino", name:"Campo de treino", short:"Treino", of:"do campo de treino", emoji:"🏟️", city:"Centro de treinamento",
      thumb:"linear-gradient(170deg,#7fd0ff,#3d9a4d 75%)", sky:"#86cdfa", fog:["#cfeaff", 70, 190], tiles:["#2a5f35", "#214e2b"], ground:"#7f7a66", music:"tropical", scenery:SCENERY.copa_treino },
    { id:"copa_arena", name:"Arena da Copa", short:"Arena", of:"da Arena da Copa", emoji:"🌃", city:"Estádio · noite de jogo",
      thumb:"linear-gradient(170deg,#1b2a5a,#0a0f24 75%)", sky:"#12204a", fog:["#1a2a5a", 50, 150], tiles:["#2f5a36", "#264a2c"], ground:"#4a4d55", music:"urban", scenery:SCENERY.copa_arena },
    { id:"copa_praia", name:"Futebol de praia", short:"Praia", of:"da praia", emoji:"🏖️", city:"Beira-mar",
      thumb:"linear-gradient(170deg,#7fd0ff,#f2dca6 70%)", sky:"#79c8ff", fog:["#c3e7ff", 75, 210], tiles:["#cdb27a", "#bfa26a"], ground:"#dcc590", music:"samba", scenery:SCENERY.copa_praia },
    { id:"copa_final", name:"A grande final", short:"Final", of:"da grande final", emoji:"🏆", city:"Estádio lotado · pôr do sol",
      thumb:"linear-gradient(170deg,#ff9f6a,#5a3a6a 75%)", sky:"#ff9f6a", fog:["#ffc79a", 60, 200], tiles:["#2f5a36", "#264a2c"], ground:"#6a6a6a", music:"solemn", scenery:SCENERY.copa_final },
  ],

  /* ---- skills: o EFEITO é do motor (folego, instituto, guardachuva, supertiro, empolgacao); o resto é da campanha ---- */
  skills:{
    folego:      { icon:"🔋", name:"Aquecimento",        price:3000,  req:[1, 4, 8],   desc:"Você começa cada fase com {v} de energia." },
    instituto:   { icon:"📋", name:"Prancheta tática",   price:4000,  req:[2, 5, 9],   desc:"A Pesquisa custa 1 de energia e revela {a}×{b} casas." },
    guardachuva: { icon:"🧤", name:"Barreira",           price:6000,  req:[3, 6, 10],  desc:"{v} torcedores seus começam protegidos por uma barreira: o adversário gasta um tiro para quebrá-la." },
    supertiro:   { icon:"🚀", name:"Chute potente",      price:8000,  req:[5, 8, 12],  desc:"O tiro comum atinge 4 casas (2×2), até {v} vezes por fase." },
    empolgacao:  { icon:"🔥", name:"Jogada ensaiada",    price:10000, req:[7, 10, 14], desc:"Ao acertar, você joga de novo (1 por turno), até {v} vezes por fase." },
  },
  /* ---- itens: efeito do motor (revive, furia, reforco, breja, plano). Sem svg, o jogo usa o emoji ---- */
  items:{
    revive:  { name:"Massagista",   emoji:"🩹", desc:"levanta 1 torcedor caído",        price:400,  weight:.40 },
    furia:   { name:"Prorrogação",  emoji:"⏱️", desc:"+2 turnos seguidos",              price:1000, weight:.14 },
    reforco: { name:"Reserva",      emoji:"🧢", desc:"chama 1 torcedor do banco",       price:650,  weight:.28 },
    breja:   { name:"Isotônico",    emoji:"🥤", desc:"+1 uso de Chute potente e Jogada ensaiada", price:500, weight:.14 },
    plano:   { name:"Esquema tático", emoji:"📐", desc:"ganha 1 ponto de skill",        price:2500, weight:.04 },
  },

  phrases:{
    hit:["Gol!", "Na trave e dentro!", "Que lançamento!", "Passe perfeito!", "Torcida em êxtase!"],
    multi:["Hat-trick!", "Goleada!", "Jogada de craque!"],
    miss:["Pra fora!", "Bateu na zaga!", "Impedido!", "Isso foi na arquibancada!"],
    sunk:["TORCIDA DISPERSADA!", "ARQUIBANCADA VAZIA!"],
  },
  throws:[
    { id:"bola",   indef:"uma bola",     def:"a bola",     emoji:"⚽", dur:.9,  H:3.0 },
    { id:"chuteira", indef:"uma chuteira", def:"a chuteira", emoji:"👟", dur:.8, H:2.4 },
    { id:"luva",   indef:"uma luva",     def:"a luva",     emoji:"🧤", dur:1.0, H:3.2 },
    { id:"apito",  indef:"um apito",     def:"o apito",    emoji:"📣", dur:.7,  H:2.0 },
  ],

  /* ---- final: tudo opcional. Sem ending.art o jogo desenha uma cena padrão com o líder vencedor ---- */
  ending:{
    chapters(side, ch) { return ["A grande final", "O apito final soa.", "A torcida canta o hino.", "A taça sobe aos céus.", `${ch.name} é campeã!`]; },
    posse(side, ch)    { return [{ big:"Estádio lotado, pôr do sol.", small:"A final da Copa do Mundo" }, { big:`${ch.name} levanta a taça…`, small:"e o mundo todo comemora" }, { big:`${ch.name} é a campeã do mundo!`, small:"" }]; },
  },
});
})();

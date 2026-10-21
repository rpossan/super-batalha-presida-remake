/* ================================================================
   Registro de campanhas
   Cada campanha é um "pacote" (arquivo em js/campaigns/) que descreve: lados, personagens, cenários,
   fases, itens, skills, frases e final. O motor do jogo (tabuleiro, poderes, energia, loja, online…)
   é o mesmo para todas. Veja CAMPANHAS.md para o passo a passo e o prompt de criação.

   Uso num pacote:   SPBCampaigns.register({ id:"minha-campanha", ... });
   O registro valida o pacote e normaliza cores ("#rrggbb" ou 0xRRGGBB) e campos opcionais.
   ================================================================ */
const SPBCampaigns = (() => {
  const packs = new Map();        // id -> { raw, norm } (norm é recalculado quando o idioma muda)
  let locale = "pt";

  /* ---------------- catálogos do motor: o que um pacote pode escolher ---------------- */
  /* Efeitos de skill que o motor sabe executar. O pacote dá o nome, o ícone, o preço, os níveis exigidos e o texto. */
  const SKILL_KINDS = {
    folego:      { effect:"começa cada fase com mais energia",                          values:[4, 6, 8],                 tokens:["v"],      req:[1, 4, 8],   price:3000,
                   name:"Fôlego inicial",       icon:"⚡",  desc:"Você começa cada fase com {v} de energia." },
    instituto:   { effect:"a Pesquisa fica mais barata (custo 1) e revela uma área maior", values:[[1, 1], [1, 2], [2, 2]], tokens:["a", "b"], req:[2, 5, 9],   price:4000,
                   name:"Pesquisa avançada",    icon:"📊", desc:"A Pesquisa custa 1 de energia e revela {a}×{b} casas." },
    guardachuva: { effect:"alguns torcedores seus começam protegidos por um escudo",    values:[3, 5, 7],                 tokens:["v"],      req:[3, 6, 10],  price:6000,
                   name:"Escudo",               icon:"🛡️", desc:"{v} torcedores seus começam cada fase protegidos: o adversário gasta um tiro para quebrar a proteção antes de atingi-los." },
    supertiro:   { effect:"o tiro comum atinge 4 casas (2×2) um número limitado de vezes", values:[3, 4, 5],               tokens:["v"],      req:[5, 8, 12],  price:8000,
                   name:"Tiro duplo",           icon:"💥", desc:"O tiro comum atinge 4 casas (quadrado 2×2), até {v} vezes por fase." },
    empolgacao:  { effect:"ao acertar, ganha um turno extra, um número limitado de vezes", values:[3, 4, 5],               tokens:["v"],      req:[7, 10, 14], price:10000,
                   name:"Embalo",               icon:"🎉", desc:"Ao acertar um alvo, você ganha um turno extra (1 por turno), até {v} vezes por fase." },
  };
  /* Efeitos de item que o motor sabe executar. */
  const ITEM_KINDS = {
    revive:  { effect:"revive 1 torcedor caído",                                  price:400,  weight:.40, key:"5", name:"Cura",      emoji:"💊", desc:"revive 1 torcedor caído" },
    furia:   { effect:"turnos seguidos: joga mais 2 vezes sem o adversário agir",  price:1000, weight:.14, key:"6", name:"Turbo",     emoji:"🥫", desc:"+2 turnos seguidos" },
    reforco: { effect:"invoca 1 torcedor novo na sua arena (+1 de vida)",          price:650,  weight:.28, key:"7", name:"Reforço",   emoji:"📢", desc:"invoca 1 torcedor" },
    breja:   { effect:"+1 uso das skills de uso limitado (tiro duplo e embalo)",   price:500,  weight:.14, key:"8", name:"Combustível", emoji:"🍺", desc:"+1 uso de Tiro duplo e Embalo" },
    plano:   { effect:"ganha 1 ponto de skill",                                    price:2500, weight:.04, key:"9", name:"Manual",    emoji:"📜", desc:"ganha 1 ponto de skill" },
  };
  /* Poder do chefão de cada lado (o chefão é o líder do lado oposto). */
  const BOSS_POWERS = {
    explode: "com N seguidores reunidos, eles explodem 4 casas da arena do jogador",
    heal:    "com N seguidores reunidos, o chefão recarrega toda a vida",
  };
  /* Perigos de cenário que o motor sabe aplicar numa fase (campo `hazard` da fase). */
  const HAZARDS = {
    bala:    "uma bala perdida cai numa casa da arena de quem joga, todo turno",
    fogo:    "a cada 2 turnos o sol incendeia 4 casas de cada arena",
    flechas: "4 flechas caem por turno na arena de quem joga",
    bombas:  "bombas em cruz caem a cada turno (só no modo NG+)",
  };
  /* Músicas disponíveis (apelido → faixa do motor). */
  const MUSIC = {
    anthem:"menu", urban:"paulista", samba:"rio", milonga:"poa", baiao:"sertao", tribal:"amazonia", tropical:"camboriu", solemn:"brasilia", industrial:"apocalipse",
  };
  const HAIR_STYLES = ["short", "buzz", "bob", "long", "bald"];
  const ULTRA_MODES = ["row", "col"];
  const FLAG_PATTERNS = ["solid", "hstripes", "vstripes", "cross", "diagonal", "star", "diamond", "circle", "custom"];
  const MATERIALS = ["asfalto", "calcada", "grama", "gramado", "areia", "terra", "concreto", "granito", "mata", "queimado"];   // g.poly(pontos, "material")
  const TREE_PALETTES = ["broad", "broad2", "dark", "olive", "ipe"];
  const SCENE_PIECES = ["building", "tree", "palm", "deadTree", "cactus", "bush", "car", "lamp", "piece", "make", "put"];

  /* ---------------- utilidades ---------------- */
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  const hexToInt = c => typeof c === "number" ? c : (typeof c === "string" && /^#[0-9a-f]{6}$/i.test(c) ? parseInt(c.slice(1), 16) : NaN);
  const intToCss = n => "#" + (n >>> 0).toString(16).padStart(6, "0").slice(-6);
  const col = c => hexToInt(c);

  /* ---------------- idiomas ----------------
     Qualquer texto de um pacote pode ser uma string ("Olá") ou um objeto por idioma ({ pt:"Olá", en:"Hello" }).
     O registro escolhe o idioma ativo (com queda para pt, en e o primeiro disponível). Funções do pacote
     (capítulos do final etc.) recebem o idioma como último argumento. */
  const isLocaleObj = o => isObj(o) && Object.keys(o).length > 0 && Object.keys(o).every(k => /^[a-z]{2}(-[A-Za-z]{2})?$/.test(k)) && Object.values(o).every(v => typeof v === "string");
  function localize(v) {
    if (Array.isArray(v)) return v.map(localize);
    if (isLocaleObj(v)) return v[locale] ?? v[locale.split("-")[0]] ?? v.pt ?? v.en ?? Object.values(v)[0];
    if (isObj(v)) { const o = {}; for (const k of Object.keys(v)) o[k] = localize(v[k]); return o; }
    return v;
  }

  /* ---------------- normalização ---------------- */
  function normalize(rawDef) {
    const def = localize(rawDef);
    const o = { ...def };
    o.status = o.status || "ready";
    o.world = o.world || 1;
    o.unlock = o.unlock || { start: true };
    o.tagline = o.tagline || "Escolha o seu lado, vença uma fase por vez e chegue ao chefão final.";
    o.theme = { accent:"#ffdf00", bg:"linear-gradient(135deg,#1c2a3a,#0a0f18)", ...(o.theme || {}) };
    o.sides = {};
    Object.entries(def.sides || {}).forEach(([k, s]) => {
      const main = col(s.main), alt = col(s.alt);
      o.sides[k] = { key:k, bossPower:"explode", followers:{ one:"seguidor", many:"Seguidores" }, textColor:"#ffffff", ultraDesc:s.ultraMode === "col" ? "coluna inteira" : "linha inteira", ...s,
        main, alt, css:intToCss(main), cssAlt:intToCss(alt), skin:col(s.skin ?? 0xf2c9a5), hair:col(s.hair ?? 0x2b1d14),
        shirts:(s.shirts && s.shirts.length ? s.shirts : [s.main, s.alt]).map(col), hasFlag:!!s.flag };
    });
    o.chars = {};
    Object.entries(def.chars || {}).forEach(([k, c]) => { o.chars[k] = { ...c, skin:col(c.skin ?? 0xf2c9a5), hair:col(c.hair ?? 0x2b1d14), ...(c.beardColor != null ? { beardColor:col(c.beardColor) } : {}) }; });
    o.scenarios = (def.scenarios || []).map(s => ({ ...s, sky:col(s.sky), fog:[col(s.fog[0]), s.fog[1], s.fog[2]], tiles:[col(s.tiles[0]), col(s.tiles[1])], ground:col(s.ground ?? s.tiles[1]) }));
    o.fleet = (def.fleet && def.fleet.length ? def.fleet : [{ name:"Grupo 1", len:5 }, { name:"Grupo 2", len:4 }, { name:"Grupo 3", len:3 }, { name:"Grupo 4", len:3 }, { name:"Grupo 5", len:2 }]).map(f => ({ ...f }));
    o.levels = (def.levels || []).map(l => ({ ...l }));
    o.tracks = {}; Object.entries(def.tracks || {}).forEach(([k, v]) => o.tracks[k] = v.slice());
    o.skills = def.skills || {}; o.items = def.items || {};
    o.phrases = { hit:[], multi:[], miss:[], sunk:[], ...(def.phrases || {}) };
    o.throws = def.throws || [];
    if (def.ng) o.ng = { ...def.ng, side:{ ...def.ng.side, key:def.ng.side.key || "regime", main:col(def.ng.side.main), alt:col(def.ng.side.alt), css:intToCss(col(def.ng.side.main)), cssAlt:intToCss(col(def.ng.side.alt)),
      skin:col(def.ng.side.skin ?? 0xd9b08c), hair:col(def.ng.side.hair ?? 0x151515), shirts:(def.ng.side.shirts || [def.ng.side.main, def.ng.side.alt]).map(col), ultraDesc:def.ng.side.ultraDesc || "linha inteira", ultraMode:def.ng.side.ultraMode || "row" } };
    o.ending = def.ending || {};
    o.lang = locale;
    return o;
  }

  /* ---------------- validação ---------------- */
  function validate(def) {
    const errors = [], warns = [], err = m => errors.push(m), warn = m => warns.push(m);
    if (!isObj(def)) return { errors:["o pacote precisa ser um objeto"], warns };
    if (!/^[a-z0-9][a-z0-9-]{1,30}$/.test(def.id || "")) err("id: use minúsculas, números e hífen (ex.: copa-2026)");
    if (!def.name) err("name é obrigatório");
    if (!def.emoji) warn("emoji: sem ele o cartão do mapa fica sem ícone");
    if ((def.status || "ready") === "soon") return { errors, warns };               // vaga "em breve": só os metadados importam
    const sideKeys = Object.keys(def.sides || {});
    if (sideKeys.length !== 2) err("sides: precisa ter exatamente 2 lados (hoje o motor é de duelo entre dois lados), achei " + sideKeys.length);
    sideKeys.forEach(k => {
      const s = def.sides[k];
      ["name", "short", "party", "cross", "ultra"].forEach(f => { if (!s[f]) err(`sides.${k}.${f} é obrigatório`); });
      ["main", "alt"].forEach(f => { if (isNaN(hexToInt(s[f]))) err(`sides.${k}.${f}: cor inválida (use "#rrggbb")`); });
      if (!ULTRA_MODES.includes(s.ultraMode)) err(`sides.${k}.ultraMode: use "row" ou "col"`);
      if (s.bossPower && !BOSS_POWERS[s.bossPower]) err(`sides.${k}.bossPower: use ${Object.keys(BOSS_POWERS).join(" ou ")}`);
      if (!s.flag) warn(`sides.${k}.flag: sem bandeira o jogo usa uma bandeira lisa da cor do lado`);
      if (!def.chars || !def.chars[k]) err(`chars.${k}: o líder de cada lado precisa existir em chars com a mesma chave do lado`);
    });
    Object.entries(def.chars || {}).forEach(([k, c]) => {
      if (!c.name || !c.short) err(`chars.${k}: name e short são obrigatórios`);
      if (c.hairStyle && !HAIR_STYLES.includes(c.hairStyle)) err(`chars.${k}.hairStyle: use ${HAIR_STYLES.join(", ")}`);
      if (c.camp && !(def.sides[c.camp] || (def.ng && c.camp === (def.ng.side.key || "regime")))) err(`chars.${k}.camp: "${c.camp}" não é um lado`);
      if (isNaN(hexToInt(c.skin ?? 0xf2c9a5)) || isNaN(hexToInt(c.hair ?? 0x2b1d14))) err(`chars.${k}: skin/hair precisam ser cores`);
    });
    const scnIds = new Set();
    (def.scenarios || []).forEach(s => {
      ["id", "name", "short", "of", "emoji", "city", "thumb"].forEach(f => { if (!s[f]) err(`scenarios[${s.id || "?"}].${f} é obrigatório`); });
      if (scnIds.has(s.id)) err(`scenarios: id repetido "${s.id}"`); scnIds.add(s.id);
      if (!s.fog || s.fog.length !== 3) err(`scenarios.${s.id}.fog: [corCéu, perto, longe]`);
      if (!s.tiles || s.tiles.length !== 2) err(`scenarios.${s.id}.tiles: duas cores`);
      if (isNaN(hexToInt(s.sky))) err(`scenarios.${s.id}.sky: cor inválida`);
      if (typeof s.scenery !== "function" && typeof s.scenery !== "string") err(`scenarios.${s.id}.scenery: função (E, g, K) que desenha o cenário, ou o id de um cenário já registrado para reaproveitar`);
      if (s.music && !MUSIC[s.music] && !Object.values(MUSIC).includes(s.music)) err(`scenarios.${s.id}.music: use ${Object.keys(MUSIC).join(", ")}`);
    });
    if (!def.scenarios || def.scenarios.length < 1) err("scenarios: precisa de pelo menos 1 cenário");
    const fleet = def.fleet || [];
    if (fleet.length && (fleet.length !== 5 || fleet.some(f => !f.name || !(f.len >= 1 && f.len <= 5)))) err("fleet: use 5 grupos, cada um com name e len de 1 a 5 (padrão: 5,4,3,3,2)");
    const L = def.levels || [];
    if (L.length < 2) err("levels: precisa de pelo menos 2 fases");
    if (L.filter(l => l.boss).length !== 1) err("levels: precisa de exatamente 1 fase com boss:true (o chefão)");
    L.forEach((l, i) => {
      if (!scnIds.has(l.scn)) err(`levels[${i}].scn: cenário "${l.scn}" não existe em scenarios`);
      if (!l.diff) err(`levels[${i}].diff é obrigatório (ex.: "Fácil")`);
      if (l.hazard && !HAZARDS[l.hazard]) err(`levels[${i}].hazard: use ${Object.keys(HAZARDS).join(", ")}`);
      if (!l.ng && !l.boss && !(l.def && l.def.length) && !l.defs) err(`levels[${i}]: informe def (índices de fleet) para a torcida adversária`);
      if (l.def && l.def.some(ix => !Number.isInteger(ix) || ix < 0 || ix >= (fleet.length || 5))) err(`levels[${i}].def: índice fora de fleet (0 a ${(fleet.length || 5) - 1})`);
      if (l.ai != null && !(l.ai >= 1 && l.ai <= 4)) err(`levels[${i}].ai: de 1 a 4`);
      if (l.ng && !def.ng) err(`levels[${i}]: fase ng:true exige o bloco ng no pacote`);
    });
    sideKeys.forEach(k => {
      const t = (def.tracks || {})[k];
      if (!t) return err(`tracks.${k}: lista de adversários por fase (um personagem por fase)`);
      if (t.length !== L.length) err(`tracks.${k}: tem ${t.length} adversários mas há ${L.length} fases`);
      t.forEach((c, i) => { if (!(def.chars || {})[c]) err(`tracks.${k}[${i}]: personagem "${c}" não existe em chars`); });
      const bi = L.findIndex(l => l.boss); const other = sideKeys.find(x => x !== k);
      if (bi >= 0 && other && t[bi] !== other) warn(`tracks.${k}[${bi}]: o chefão costuma ser o líder do lado oposto ("${other}")`);
    });
    Object.entries(def.skills || {}).forEach(([k, s]) => {
      if (!SKILL_KINDS[k]) return err(`skills.${k}: efeito desconhecido. Efeitos do motor: ${Object.keys(SKILL_KINDS).join(", ")}`);
      if (s.req && (s.req.length !== 3 || s.req.some(n => !(n >= 1 && n <= 15)))) err(`skills.${k}.req: 3 níveis de jogador (1 a 15)`);
      const tk = SKILL_KINDS[k].tokens; const text = s.desc || SKILL_KINDS[k].desc;
      (text.match(/\{(\w+)\}/g) || []).forEach(m => { if (!tk.includes(m.slice(1, -1))) err(`skills.${k}.desc: marcador ${m} inválido (use ${tk.map(t => "{" + t + "}").join(", ")})`); });
    });
    Object.entries(def.items || {}).forEach(([k, it]) => {
      if (!ITEM_KINDS[k]) return err(`items.${k}: efeito desconhecido. Efeitos do motor: ${Object.keys(ITEM_KINDS).join(", ")}`);
      if (it.price != null && !(it.price >= 50)) err(`items.${k}.price: mínimo 50`);
    });
    if (def.ng) { if (!def.ng.defs || !def.ng.defs.length) err("ng.defs: lista de grupos do exército do NG+"); if (!def.ng.side) err("ng.side: lado do vilão do NG+"); }
    return { errors, warns };
  }

  function register(def) {
    const { errors, warns } = validate(def);
    if (errors.length) { console.error(`[campanha ${def && def.id}] ${errors.length} erro(s):\n - ` + errors.join("\n - ")); throw new Error(`Campanha "${def && def.id}" inválida: ${errors[0]}`); }
    warns.forEach(w => console.warn(`[campanha ${def.id}] ${w}`));
    if (packs.has(def.id)) throw new Error(`Campanha "${def.id}" já registrada`);
    const n = normalize(def);
    if (n.status === "ready") {                                                 // chaves de lado e ids de cenário não podem se repetir entre campanhas
      for (const e of packs.values()) {
        const p = e.norm; if (p.status !== "ready") continue;
        Object.keys(n.sides).forEach(k => { if (p.sides[k]) throw new Error(`Campanha "${def.id}": o lado "${k}" já existe em "${p.id}". Use chaves únicas (ex.: "${def.id.split("-")[0]}_${k}")`); });
        n.scenarios.forEach(s => { if (p.scenarios.some(x => x.id === s.id)) throw new Error(`Campanha "${def.id}": cenário "${s.id}" já existe em "${p.id}". Use ids únicos (ex.: "${def.id.split("-")[0]}_${s.id}")`); });
      }
    }
    packs.set(def.id, { raw:def, norm:n });
    return n;
  }
  const norm = e => e ? (e.norm.lang === locale ? e.norm : (e.norm = normalize(e.raw))) : null;
  return {
    register, validate, normalize,
    get: id => norm(packs.get(id)),
    list: () => [...packs.values()].map(norm).sort((a, b) => a.world - b.world),
    get locale() { return locale; },
    setLocale(l) { locale = String(l || "pt"); },
    localize,
    catalog: { SKILL_KINDS, ITEM_KINDS, BOSS_POWERS, HAZARDS, MUSIC, HAIR_STYLES, ULTRA_MODES, FLAG_PATTERNS, SCENE_PIECES, MATERIALS, TREE_PALETTES },
    hexToInt, intToCss,
    _reset() { packs.clear(); },
  };
})();
if (typeof module !== "undefined") module.exports = SPBCampaigns;

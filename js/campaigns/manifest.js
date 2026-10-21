/* Lista das campanhas carregadas pelo jogo, na ordem do mapa.
   Para publicar uma campanha nova: salve o pacote em js/campaigns/<id>.js e acrescente "<id>" na lista abaixo
   (e remova a vaga correspondente de soon.js). Para só testar: abra index.html?pack=js/campaigns/<arquivo>.js */
"use strict";
const SPB_CAMPAIGN_FILES = ["br2026", "soon"];
SPB_CAMPAIGN_FILES.forEach(id => document.write(`<script src="js/campaigns/${id}.js"><\/script>`));
try {                                                                   // ?pack=js/campaigns/... carrega um pacote extra (teste local)
  const extra = new URLSearchParams(location.search).get("pack");
  if (extra && /^js\/campaigns\/[\w./-]+\.js$/.test(extra) && !extra.includes("..")) document.write(`<script src="${extra}"><\/script>`);
} catch (e) {}

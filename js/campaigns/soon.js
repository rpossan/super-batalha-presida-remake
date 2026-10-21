/* Vagas "em breve" do mapa de campanhas: só metadados (aparecem bloqueadas no mapa).
   Quando uma campanha ficar pronta, crie o pacote dela (veja CAMPANHAS.md) e apague a vaga daqui. */
"use strict";
[
  { id:"copa-2026",  world:2, emoji:"⚽", name:"Copa do Mundo 2026",  shortName:"Copa 2026",
    tagline:"Torcidas do mundo inteiro em campo.",           unlock:{ campaigns:["br2026"], level:8 },  theme:{ bg:"linear-gradient(135deg,#0a7a3d,#0d3b8c)" } },
  { id:"usa-2028",   world:3, emoji:"🇺🇸", name:"Eleições EUA 2028",   shortName:"EUA 2028",
    tagline:"Convenções, debates e a Casa Branca.",          unlock:{ campaigns:["br2026"], level:11 }, theme:{ bg:"linear-gradient(135deg,#8b1e2d,#1c3f7a)" } },
  { id:"mundo-x",    world:4, emoji:"🌍", name:"Mais campanhas",       shortName:"Mais",
    tagline:"Novos mundos a caminho.",                       unlock:{ campaigns:["copa-2026"], level:14 }, theme:{ bg:"linear-gradient(135deg,#3a3f4b,#171b24)" } },
].forEach(c => SPBCampaigns.register({ status:"soon", ...c }));

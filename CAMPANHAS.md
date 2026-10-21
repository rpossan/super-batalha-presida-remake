# 🗺️ Guia de campanhas

O jogo é dividido em **motor** e **campanhas**.

- **Motor** (tabuleiro, poderes, energia, loja, nível, online, ranking, final): é o mesmo para todas as campanhas e não muda quando você cria conteúdo.
- **Campanha** (um *mundo* do mapa): um arquivo em [`js/campaigns/`](js/campaigns) com **lados, personagens, cenários (inclusive o desenho), fases, itens, skills, frases e final**.

A primeira campanha é [`br2026.js`](js/campaigns/br2026.js) (Eleições Brasil 2026). Um exemplo pequeno e completo, para copiar, está em [`examples/copa-exemplo.js`](js/campaigns/examples/copa-exemplo.js).

```
js/campaigns/
  registry.js      registro e validação (não mexa)
  manifest.js      lista das campanhas carregadas, na ordem do mapa
  br2026.js        campanha 1: Eleições Brasil 2026
  soon.js          vagas "em breve" do mapa
  examples/        pacotes de exemplo (modelo)
tools/check-campaigns.mjs   valida os pacotes sem abrir o navegador
```

## O que é de cada campanha e o que é do motor

| Muda por campanha | Fica no motor (igual para todas) |
|---|---|
| Nomes, cores, bandeira e poderes dos 2 lados | Regras do tabuleiro 10×10, energia, turnos, poderes (tiro, pesquisa, cruz, linha/coluna) |
| Personagens e adversários de cada fase | IA do adversário, chefão, NG+ |
| Cenários (desenho, música, cores) | Níveis, votos, grana, loja, ranking, online |
| Nome, ícone, preço e texto de **skills** e **itens** | O **efeito** das skills e dos itens |
| Frases de reação, objetos arremessados, final | Fogos, câmera e créditos do final |

> **Skills e itens:** o jogador evolui uma vez só (nível, pontos, skills aprendidas e mochila valem em todas as campanhas). Cada campanha só muda o *tema* deles: o mesmo efeito "começa a fase com mais energia" pode se chamar *Fôlego de campanha* no Brasil e *Aquecimento* na Copa. Um efeito **novo** exige código no motor (veja o fim deste guia).

## Receitas rápidas

### Adicionar um cenário ao Brasil 2026
1. Em [`br2026.js`](js/campaigns/br2026.js), acrescente a função de desenho em `SCENERY`:
   ```js
   minha_praca: (E, g, K) => {
     const { rnd, tree, lamp, building } = K;
     g.poly([[-70, -34], [70, -34], [70, 34], [-70, 34]], "calcada");     // chão
     for (let x = -30; x <= 30; x += 10) lamp(x, -20);                    // peças
     for (let i = 0; i < 8; i++) tree(-40 + i*11, 24, { r:rnd(.8, 1), h:rnd(1.4, 2), pal:"broad" });
     E.cloudShadows(.08); E.grade({ sat:1.08, con:1.04, bri:1.1 });       // acabamento
   },
   ```
2. Acrescente a entrada em `scenarios` (id **único em todas as campanhas**; sugestão: prefixo da campanha, ex.: `br_praca`):
   ```js
   { id:"minha_praca", name:"Praça Central", short:"Praça", of:"da Praça Central", emoji:"⛲", city:"Cidade · UF",
     thumb:"linear-gradient(170deg,#7fd0ff,#3d9a4d 75%)", sky:0x86cdfa, fog:[0xcfeaff, 70, 190], tiles:[0x2a5f35, 0x214e2b],
     ground:0x7f7a66, music:"tropical", scenery:SCENERY.minha_praca },
   ```
3. Para usar o cenário numa fase, acrescente em `levels` (e um adversário em `tracks` de cada lado). Se for só para o online, não precisa de fase.
4. Rode `node tools/check-campaigns.mjs`.

### Adicionar personagem
1. Em `chars`: `{ name, short, party, camp:"<lado a que pertence>", skin, hair, hairStyle, … }`.
2. Em `tracks`, coloque a chave dele na fase em que ele aparece (um adversário por fase, para cada lado).

### Adicionar fase
Acrescente em `levels` (antes do chefão, que fica sempre na posição da fase com `boss:true`) e um adversário nessa posição em `tracks` dos **dois** lados.

### Criar uma campanha nova
1. Copie `examples/copa-exemplo.js` para `js/campaigns/<id>.js` e troque o conteúdo (ou peça a uma IA, veja os prompts abaixo).
2. `node tools/check-campaigns.mjs js/campaigns/<id>.js` até ficar verde.
3. Teste no navegador sem publicar: `index.html?pack=js/campaigns/<id>.js`.
4. Para publicar: acrescente `"<id>"` na lista de [`manifest.js`](js/campaigns/manifest.js) e apague a vaga correspondente em [`soon.js`](js/campaigns/soon.js).

## Referência do pacote

```js
SPBCampaigns.register({
  id:"copa-2026",              // minúsculas, números e hífen; único
  world:2,                     // posição no mapa (Mundo 2)
  status:"ready",              // "soon" = só aparece bloqueada no mapa (veja soon.js)
  emoji:"⚽", name:"Copa do Mundo 2026", shortName:"Copa 2026",
  tagline:"texto abaixo do logo", sideStep:"1 · Escolha a sua seleção",
  unlock:{ start:true },       // ou { campaigns:["br2026"], level:8 }: zerar outras campanhas e/ou nível do jogador
  theme:{ bg:"linear-gradient(135deg,#0a7a3d,#0d3b8c)" },   // cartão do mapa
  sides:{ … }, chars:{ … }, tracks:{ … }, fleet:[ … ], levels:[ … ], scenarios:[ … ],
  ng:{ … },                    // opcional: modo extra pós-final
  skills:{ … }, items:{ … },   // opcional: se omitir, usa os nomes padrão do motor
  phrases:{ hit, multi, miss, sunk }, throws:[ … ],         // opcionais
  ending:{ chapters, posse, art, fx },                      // opcionais
});
```

**`sides`**: exatamente **2** lados. A chave é única em todas as campanhas (ex.: `azul`, `dourado`).

| Campo | O que é |
|---|---|
| `name`, `short`, `party`, `tag` | nome completo, nome curto, sigla/grupo, descrição curta |
| `main`, `alt` | cores principais (`"#rrggbb"`) da torcida e do destaque |
| `cross`, `ultra`, `ultraMode` | nome do poder em cruz, nome do poder final e `"row"` (linha) ou `"col"` (coluna) |
| `skin`, `hair`, `shirts` | aparência da torcida (camisas sorteadas de `shirts`) |
| `bossPower` | `"explode"` (explode 4 casas) ou `"heal"` (recarrega a vida) |
| `followers` | `{ one, many }`: como chamar os seguidores do chefão |
| `textColor` | cor do nome no placar (padrão branco) |
| `flag` | bandeira: `{ bg, stripes:{dir:"h"|"v", colors:[…]}, shapes:[{type:"circle|ring|star|diamond|rect|cross|diagonal", x, y, r, w, h, color}] }` em 160×110 |

**`chars`**: o **líder de cada lado usa a mesma chave do lado**. Campos: `name`, `short`, `party`, `camp`, `skin`, `hair`, `hairStyle` (`short`, `buzz`, `bob`, `long`, `bald`), `beard`, `beardColor`, `glasses`, `fem`, `age` (0 a 1).

**`tracks`**: `{ ladoA:[personagem da fase 1, 2, …], ladoB:[…] }` (um por fase; o chefão é o líder do lado oposto).

**`fleet`**: 5 grupos `{ name, len }` com `len` de 1 a 5 (padrão 5, 4, 3, 3, 2). **`levels[].def`** usa índices desta lista.

**`levels`**: `{ scn, diff, ai (1 a 4), def:[índices], hazard?, boss?, calm? }`. Exatamente uma fase com `boss:true`. Perigos (`hazard`): `bala`, `fogo`, `flechas`, `bombas`.

**`scenarios`**: `{ id, name, short, of, emoji, city, thumb (CSS), sky, fog:[cor, perto, longe], tiles:[cor1, cor2], ground, music, scenery }`. `music`: `anthem`, `urban`, `samba`, `milonga`, `baiao`, `tribal`, `tropical`, `solemn` ou `industrial`. `scenery`: a função de desenho ou o id de um cenário já registrado (para reaproveitar).

**`skills`** (efeitos do motor: `folego`, `instituto`, `guardachuva`, `supertiro`, `empolgacao`): `{ icon, name, price, req:[nível1, nível2, nível3], desc }`. No texto use `{v}` (valor do nível) e, no `instituto`, `{a}×{b}`.

**`items`** (efeitos do motor: `revive`, `furia`, `reforco`, `breja`, `plano`): `{ name, desc, price, weight, emoji | svg }`. Sem `svg`, o jogo usa o `emoji` como ícone. Omitir um efeito = ele não existe nessa campanha.

**`ng`** (opcional): `{ side:{…lado do vilão…}, defs:[{name,len,kind}], winTitle, winText, unlockNote }` e uma fase com `ng:true` em `levels` (com o personagem vilão no fim de cada `tracks`).

**`ending`** (opcional): `chapters(side, ch, idioma)` → 5 textos do ato da festa; `posse(side, ch, idioma)` → lista `{ big, small }` da cena final; `art(side, K, idioma)` → SVG 800×500 da cena (sem isto o jogo desenha uma cena padrão com o líder); `fx` → cores dos fogos por lado.

## Desenhar um cenário

`scenery: (E, g, K) => { … }`. O jogo desenha as duas arenas no meio (x de −14 a 14, z de −12 a 12): deixe essa área livre. Coordenadas são do mundo (x e z); o chão vai de ±70 em x e ±34 em z.

- **Chão `g`**: `poly(pontos, material|cor, {alpha, tint, tintA})`, `rect(x0,z0,x1,z1,…)`, `paint(a,b,largura,cor,alpha)` (faixa pintada), `ring(cx,cz,r,largura,cor)`, `blob(cx,cz,rx,rz,cor,alpha)` (mancha), `line`, `shadowBox(cx,cz,w,d,h)`, `ao(…)`. Materiais: `asfalto`, `calcada`, `grama`, `gramado`, `areia`, `terra`, `concreto`, `granito`, `mata`, `queimado`.
- **Peças `K`**: `building(x,z,w,d,h,{style,lit,antenna,color})` (estilos `glass`, `concrete`, `apart`, `white`, `ruin`, `adobe`, `stone`, `wood`), `tree(x,z,{r,h,pal})` (paletas `broad`, `broad2`, `dark`, `olive`, `ipe`), `palm(x,z,h)`, `deadTree`, `cactus`, `bush`, `car(x,z,cor)`, `lamp(x,z,h)`. Para peças próprias: `piece(chave, rx, rz, h, K => {…}, x, z)`. Veja os cenários do Brasil em `br2026.js`.
- **Efeitos `E`**: `grade({sat,con,bri})` (cor final), `cloudShadows(a)`, `mist(cor,a)`, `glow(fx,fy,cor,tam,a)`, `rays()`, `sparkle(poligono,n)`, `flag(chave,x,y,z,w)`, `fire(x,z)`, `mushroom(x,z)`, `tick(fn)`.

## Idiomas

Qualquer texto do pacote pode ser uma string ou um objeto por idioma. O jogo usa o idioma do jogador (`spb_lang` ou o do navegador) e cai para `pt`, depois `en`:

```js
name:{ pt:"Copa do Mundo", en:"World Cup", es:"Copa del Mundo" },
```
Funções do pacote (`ending.chapters` etc.) recebem o idioma como último argumento.

## Prompts para criar conteúdo com IA

> Para **cenários**, use o roteiro padronizado em **[PROMPTS-CENARIOS.md](PROMPTS-CENARIOS.md)**: ficha, prompts prontos (cenário completo, só dados, ajustes, variações, revisão e tradução) e checklist de aceite. Os prompts abaixo cobrem campanhas inteiras, personagens, skills e itens.

Dê à IA estes arquivos como referência: `CAMPANHAS.md`, `js/campaigns/examples/copa-exemplo.js` e `js/campaigns/br2026.js`.

**Nova campanha completa**
> Leia `CAMPANHAS.md` e `js/campaigns/examples/copa-exemplo.js`. Crie o arquivo `js/campaigns/<id>.js` para a campanha **«TEMA»** (descreva: período, país/evento, os 2 lados e seus líderes, tom). Requisitos: 2 lados; 4 a 8 fases com um chefão final (o líder do lado oposto); personagens fictícios ou parodiados com humor e sem ofensas; cenários novos com desenho em `scenery` usando só o kit descrito no guia; skills e itens tematizados (use apenas os efeitos do motor); frases de reação no tom do tema; textos em `pt` e `en` ({pt, en}); ids únicos prefixados por `<id>`; sem violência real. Entregue **um único arquivo** e o resultado de `node tools/check-campaigns.mjs js/campaigns/<id>.js`.

**Novos cenários para uma campanha existente**
> Leia a seção «Desenhar um cenário» do `CAMPANHAS.md` e os cenários de `js/campaigns/br2026.js`. Acrescente à campanha **«ID»** os cenários: «descreva cada um (local, clima, hora do dia, elementos)». Para cada um entregue: a função em `SCENERY`, a entrada em `scenarios` (id único) e, se pedir, a fase em `levels` com o adversário em `tracks` dos dois lados.

**Novos personagens**
> Acrescente à campanha **«ID»** os personagens: «descreva». Entregue as entradas de `chars` (com `camp`, cores e `hairStyle` válidos) e onde entram em `tracks`.

**Retematizar skills e itens**
> Reescreva `skills` e `items` da campanha **«ID»** com o tema «TEMA»: mesmos efeitos do motor, nomes, ícones/emojis e textos novos. Não invente efeitos.

Depois de qualquer geração: `node tools/check-campaigns.mjs` e teste com `?pack=`.

## Quando for preciso mexer no motor

Só se você quiser algo que o pacote não descreve: um **efeito novo** de skill ou item, um **poder** novo, um perigo de cenário novo, mais de 2 lados ou outro tamanho de tabuleiro. Isso é código em `index.html`, e o catálogo correspondente em `js/campaigns/registry.js` (`SKILL_KINDS`, `ITEM_KINDS`, `HAZARDS`) precisa ser atualizado junto.

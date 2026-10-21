# 🎨 Prompts prontos para criar cenários

Roteiro para criar um **cenário novo completo** (desenho, cores, música, fase e adversário) com uma IA, sempre no mesmo padrão. Vale para qualquer campanha: o Brasil 2026 (`js/campaigns/br2026.js`), a Copa de exemplo ou uma campanha nova. O guia técnico completo está em [CAMPANHAS.md](CAMPANHAS.md).

## Como usar (5 passos)
1. **Preencha a ficha** (seção 1) com o que você quer. Se preferir, use o **Prompt 0** e deixe a IA entrevistar você.
2. **Cole o Prompt 1** (cenário completo), troque o que está entre «» e anexe os arquivos de contexto abaixo.
3. **Cole o resultado** nos lugares indicados (a IA diz onde; resumo na seção 8).
4. **Valide:** `node tools/check-campaigns.mjs`.
5. **Teste no navegador** (`localhost`) e passe pelo checklist da seção 9. Se algo ficar ruim, use o **Prompt 3** (ajustar).

**Anexe sempre à IA:**
- [`CAMPANHAS.md`](CAMPANHAS.md) (guia e referência do pacote);
- a campanha onde o cenário vai entrar (ex.: `js/campaigns/br2026.js`), principalmente o objeto `SCENERY` e a lista `scenarios`;
- [`js/campaigns/examples/copa-exemplo.js`](js/campaigns/examples/copa-exemplo.js) (exemplo pequeno e completo).

---

## 1. Ficha do cenário (preencha antes)

```
id:                «prefixo_do_mundo + nome_curto», minúsculas e _ (ex.: br_orla, copa_estadio)
nome:              «Orla de Copacabana»
nome curto:        «Orla»
"of" (para frases): «da Orla de Copacabana»   ← precisa fechar a frase "… foi dispersado ____"
emoji:             «🏖️»
cidade/local:      «Rio de Janeiro · RJ»
hora e clima:      «fim de tarde, céu alaranjado, sem chuva»
paleta:            «areia clara, mar azul-turquesa, calçadão preto e branco, prédios claros»
elementos que DEVEM aparecer:   «calçadão em ondas, quiosques, palmeiras, mar ao fundo, bandeiras»
elementos que NÃO podem:        «marcas reais, logotipos, pessoas, texto, violência»
música:            «tropical»   (anthem | urban | samba | milonga | baiao | tribal | tropical | solemn | industrial)
perigo da fase:    «nenhum»     (nenhum | bala | fogo | flechas | bombas)
dificuldade:       «Médio»      (texto livre, aparece na fase; ex.: Fácil, Médio, Difícil, CHEFÃO)
adversário (personagem): «novo: nome, partido/grupo, cabelo, óculos…» ou «já existe: <chave de chars>»
posição na campanha: «fase 3 de 7» ou «só para o duelo online (sem fase)»
```

---

## 2. Regras fixas do projeto (valem para todos os prompts)

- O cenário é **uma função `(E, g, K) => { … }`** que só usa o que o motor oferece (abaixo). **Sem imagens, sem arquivos externos, sem bibliotecas.** Tudo é desenhado por código.
- **Área livre das arenas:** o jogo desenha as duas arenas no centro. Mantenha **x entre −16 e 16 e z entre −13 e 13 sem nenhuma peça alta** (prédio, árvore, poste, carro). Ali só entra chão pintado e marcações (`g.poly`, `g.paint`, `g.ring`, `g.blob`).
- **Extensão:** o chão pode ir até cerca de **±70 em x e ±34 em z**. Cubra a tela inteira para não aparecer vazio nas bordas.
- **Orçamento de peças (para não pesar no celular):** até ~40 `building`, ~60 `tree/palm/bush`, ~15 `car`, ~30 `lamp`, ~60 `g.blob`. Repita dimensões arredondadas (ex.: largura 4, 4.5, 5) para as peças reaproveitarem textura.
- **Identificadores:** `id` do cenário **único em todas as campanhas** (prefixo do mundo). Chaves novas de `chars` também únicas.
- **Cores:** números hexadecimais nas funções de desenho (`0x8a836d`), `"#rrggbb"` nos metadados.
- **Conteúdo:** sem marcas, logotipos, pessoas reais retratadas, texto na tela, violência real. Paródia leve, tom do jogo.
- **Código:** português nos comentários, indentação de 2 espaços, estilo igual ao de `br2026.js`. Sem `console.log`.

### Kit de desenho que a IA pode usar
**Chão `g`** (coordenadas do mundo `[x, z]`):
- `g.poly(pontos, material | cor, { alpha, tint, tintA })`, `g.rect(x0, z0, x1, z1, material | cor, opções)`, `g.line(a, b, larguraPx, cor, alpha)`
- `g.paint(a, b, largura, cor, alpha)` faixa pintada com desgaste (ruas, linhas de campo), `g.ring(cx, cz, r, largura, cor, alpha)`
- `g.blob(cx, cz, rx, rz, cor, alpha)` mancha suave (sujeira, areia, sombra), `g.shadowBox(cx, cz, w, d, h)`, `g.shadowRound(cx, cz, r, h)`, `g.ao(cx, cz, rx, rz, alpha)`
- Materiais: `asfalto`, `calcada`, `grama`, `gramado`, `areia`, `terra`, `concreto`, `granito`, `mata`, `queimado`

**Peças `K`** (desenham e posicionam):
- `building(x, z, w, d, h, { style, lit, antenna, color, scale, balconies, rooftop, roofColor })` com `style`: `glass`, `concrete`, `apart`, `white`, `ruin`, `adobe`, `stone`, `wood`
- `tree(x, z, { r, h, pal })` (`pal`: `broad`, `broad2`, `dark`, `olive`, `ipe`), `palm(x, z, h)`, `deadTree(x, z, h)`, `cactus(x, z, h)`, `bush(x, z, r, pal)`, `car(x, z, cor)`, `lamp(x, z, h)`
- Utilitários: `rnd(a, b)`, `rint(n)`, `pick(lista)`, `css`, `rgba`
- **Avançado (monumentos próprios):** `piece(chave, rx, rz, altura, K2 => { K2.box(...); K2.cyl(...); K2.ball(...); K2.face(...); K2.line(...) }, x, z, 0, { scale })`. Copie o padrão dos monumentos de `br2026.js` (ex.: o Cristo, o MASP, o Congresso).

**Efeitos `E`:** `E.grade({ sat, con, bri })` (correção de cor final, **sempre use**), `E.cloudShadows(alpha)`, `E.mist(cor, alpha)`, `E.glow(fx, fy, cor, tamanho, alpha)` (sol/holofote, `fx` e `fy` de 0 a 1 na tela), `E.rays()`, `E.sparkle(poligono, n)` (brilho na água), `E.flag(chaveDoLado, x, y, z, largura)`, `E.fire(x, z)`, `E.tick((t, dt) => …)` (animação)

---

## Prompt 0 · A IA monta a ficha com você
```
Você vai me ajudar a criar um cenário para o jogo (batalha naval isométrica, campanhas temáticas).
Leia o CAMPANHAS.md em anexo. Depois me entreviste, uma pergunta de cada vez, para preencher esta ficha:
id, nome, nome curto, "of" (frase: "… foi dispersado ____"), emoji, cidade/local, hora e clima, paleta,
elementos que devem e que não devem aparecer, música (anthem|urban|samba|milonga|baiao|tribal|tropical|solemn|industrial),
perigo da fase (nenhum|bala|fogo|flechas|bombas), dificuldade, adversário e posição na campanha.
Sugira 2 opções quando eu estiver em dúvida. No fim, devolva a ficha preenchida em bloco de código.
```

## Prompt 1 · Cenário completo (o principal)
```
Você é o artista técnico do jogo em anexo. Crie UM cenário completo para a campanha «ID_DA_CAMPANHA»
(arquivo js/campaigns/«ARQUIVO».js), seguindo exatamente o padrão dos cenários que já existem nele.

FICHA DO CENÁRIO
«cole aqui a ficha preenchida da seção 1»

REGRAS (obrigatórias)
1. Use SOMENTE o kit descrito no CAMPANHAS.md (E, g, K). Sem imagens, sem libs, sem texto desenhado.
2. Área livre: x de −16 a 16 e z de −13 a 13 sem peças altas (só chão pintado e marcações).
3. O chão cobre até ±70 em x e ±34 em z (sem bordas vazias). Termine com E.grade({...}).
4. Orçamento: ≤ 40 building, ≤ 60 árvores/arbustos, ≤ 15 car, ≤ 30 lamp, ≤ 60 g.blob; repita medidas arredondadas.
5. Sem marcas, logotipos, pessoas, texto, violência. Tom de paródia leve.
6. IDs únicos e prefixados pelo mundo da campanha. Comentários em português. Estilo do br2026.js.
7. Música e perigo só entre os valores permitidos.

ENTREGUE, nesta ordem, em blocos de código prontos para colar:
(A) a função para o objeto SCENERY:      «id»: (E, g, K) => { const {…} = K; … },
(B) o objeto para a lista scenarios:     { id, name, short, of, emoji, city, thumb, sky, fog:[cor, perto, longe], tiles:[c1, c2], ground, music, scenery:SCENERY.«id» }
(C) a entrada para levels (se a ficha pedir fase) e as entradas para tracks dos DOIS lados (e para chars, se o adversário for novo)
(D) 3 frases novas para phrases.hit/miss no tom do cenário (opcional)
Depois liste, em 5 linhas, o que desenhou e a contagem aproximada de peças.
Não altere nada além do que pedi e não renomeie ids existentes.
```

## Prompt 2 · Só os metadados, a fase e o adversário (sem desenho)
```
Na campanha «ID_DA_CAMPANHA» (arquivo em anexo), preciso das entradas de dados para um cenário que será desenhado depois.
FICHA: «ficha preenchida»
Entregue: (B) o objeto de scenarios (com scenery:SCENERY.«id» e um comentário "// desenho pendente"),
(C) a fase em levels, os adversários em tracks dos dois lados e os novos chars (com camp, cores, hairStyle válidos:
short|buzz|bob|long|bald), mantendo o chefão como o líder do lado oposto, e (D) 3 frases de reação.
Escolha cores de céu, névoa e tiles coerentes com a hora e o clima da ficha, e um gradiente CSS para thumb.
```

## Prompt 3 · Ajustar um cenário que já existe
```
Ajuste o cenário «id» da campanha «ID_DA_CAMPANHA» (função em SCENERY, arquivo em anexo).
Problema visto no jogo: «ex.: ficou escuro demais / vazio nas laterais / peças cobrem as arenas / pesado no celular / chão sem textura».
Mantenha o estilo, a área livre (x ±16, z ±13) e o orçamento de peças. Mude só o necessário.
Entregue a função inteira reescrita e uma lista curta do que alterou (antes → depois).
```

## Prompt 4 · Variações do mesmo cenário
```
A partir do cenário «id» (função em anexo), crie uma variação «noite | amanhecer | nublado | chuvoso | festa» chamada «novo_id».
Reaproveite a estrutura; mude paleta, E.grade, E.mist/E.glow, luzes (lit nos prédios), lâmpadas e detalhes do clima.
Entregue (A) a nova função e (B) a nova entrada de scenarios (música coerente com o clima).
```

## Prompt 5 · Revisão (antes de aceitar o que a IA fez)
```
Revise o código abaixo como revisor do projeto. Verifique, item por item, e responda "OK" ou "PROBLEMA: …":
1. usa só E, g, K do kit (nenhuma função inventada)?  2. nada alto na área livre x ±16, z ±13?
3. orçamento de peças respeitado?  4. ids únicos e com prefixo?  5. termina com E.grade?
6. cores válidas (hex numérico nas funções, "#rrggbb" nos metadados)?  7. campos obrigatórios de scenarios presentes
(id, name, short, of, emoji, city, thumb, sky, fog, tiles, ground, music, scenery)?  8. sem marcas/logotipos/texto/violência?
9. a frase "… foi dispersado " + of fecha em português?  10. levels e tracks consistentes (tracks tem um adversário por fase nos DOIS lados)?
Ao final, liste as correções mínimas.
«cole o código»
```

## Prompt 6 · Traduzir os textos do cenário
```
Converta os textos do cenário «id» para vários idiomas no formato do projeto: { pt:"…", en:"…", es:"…" }
em name, short, of, city e nas frases novas. Mantenha emoji e ids. O campo "of" deve fechar a frase
"… foi dispersado ____" em cada idioma (ajuste artigo/preposição). Entregue só o objeto scenarios atualizado.
```

---

## 8. Onde colar o resultado
| O que a IA entrega | Onde colar |
|---|---|
| (A) função do cenário | dentro de `const SCENERY = { … }` no arquivo da campanha |
| (B) objeto do cenário | na lista `scenarios: [ … ]` da mesma campanha |
| (C) fase / adversários | `levels`, `tracks` (dos dois lados) e `chars` |
| (D) frases | `phrases.hit` e `phrases.miss` |

Cenário só para o **duelo online** não precisa de fase: basta estar em `scenarios`.

## 9. Checklist de aceite (marque antes de publicar)
- [ ] `node tools/check-campaigns.mjs` mostra ✓ sem erros.
- [ ] No `localhost`, a fase abre sem erro no console (F12) e as duas arenas aparecem inteiras.
- [ ] Nenhuma peça alta cobre as arenas nem os capitães (x ±16, z ±13).
- [ ] Sem bordas vazias ao dar zoom para fora e girar a câmera (`Q`/`E`).
- [ ] Legível no **celular**: modo de simulação de celular do navegador e, se possível, um aparelho de verdade (sem engasgar).
- [ ] Música combina com o clima; o perigo da fase (se houver) funciona.
- [ ] Textos fecham em português: "… foi dispersado **da Orla de Copacabana**".
- [ ] Sem marcas, logotipos, texto desenhado ou conteúdo ofensivo.
- [ ] Uma captura de tela do cenário foi guardada em `docs/img/` (opcional, para o README).

## 10. Exemplo de ficha preenchida
```
id:                br_orla
nome:              Orla de Copacabana
nome curto:        Orla
"of":              da Orla de Copacabana
emoji:             🏖️
cidade/local:      Rio de Janeiro · RJ
hora e clima:      fim de tarde, céu alaranjado, brisa leve
paleta:            areia clara, mar turquesa, calçadão preto e branco em ondas, prédios claros
DEVEM aparecer:    calçadão em ondas, quiosques, palmeiras, mar ao fundo com brilho do sol, bandeiras ao vento
NÃO podem:         marcas, logotipos, pessoas, texto
música:            tropical
perigo da fase:    nenhum
dificuldade:       Médio
adversário:        novo: «Cadu do Quiosque», grupo «Quiosque», cabelo curto, óculos
posição:           fase 3 de 7
```
Use essa ficha no **Prompt 1** para ver o formato esperado da resposta.

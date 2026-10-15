# Super Presida Batalha

> **Posicione a torcida. Acerte o adversário. Domine a avenida!**

Batalha naval das eleições 2026, em 3D, direto no navegador. Flávio Bolsonaro (PL) contra Lula (PT):
duas torcidas disputam o território, cada acerto derruba um torcedor do adversário. Paródia bem-humorada,
sem violência: quem é "atingido" só senta, cansado de tanto gritar.

## Jogar
Abra o `index.html` no navegador, ou acesse a versão publicada no GitHub Pages:
https://rpossan.github.io/super-presida-batalha/

## Como funciona
- Tabuleiros 10×10; posicione 5 grupos de torcedores (5, 4, 3, 3 e 2).
- Em cada turno, arremesse um objeto de protesto (cone, tomate, bandeira, cavalete, chinelo, pedra ou ovo).
- Energia: +1 por turno e +1 por torcedor atingido. Gaste em poderes:
  📊 Pesquisa (2) · 📣 Buzinaço/Comício (3) · 🏍️ Motociata / 🚌 Caravana (6).
- Partida sem limite de tempo (para limitar, ajuste `MATCH_TIME` no `index.html`), sem limite por jogada (ajuste `TURN_TIME`), contador de rodadas e adversário controlado pelo computador.
- Controles: mouse/toque · `R` gira · `1–4` poderes · `Esc` cancela.

## Cenários
Av. Paulista (SP), Cristo Redentor (RJ), Aeroporto Salgado Filho (RS), ou aleatório.
Para criar um novo, adicione um objeto em `SCENARIOS` no `index.html`
(há um comentário `ADICIONE NOVOS CENÁRIOS AQUI`); as lacunas "Em breve" do menu somem sozinhas.

## Tecnologia
Arquivo único (`index.html`) com [Three.js](https://threejs.org/) via CDN; sem build, sem servidor.

# Super Presida Batalha

> **Posicione a torcida. Acerte o adversário. Domine a avenida!**

Batalha naval das eleições 2026, em 3D, direto no navegador. Flávio Bolsonaro (PL) contra Lula (PT):
duas torcidas disputam o território, cada acerto derruba um torcedor do adversário. Paródia bem-humorada,
sem violência: quem é "atingido" só senta, cansado de tanto gritar.

## Jogar
Abra o `index.html` no navegador, ou acesse a versão publicada no GitHub Pages:
https://rpossan.github.io/super-presida-batalha/

## Como funciona
- Campanha em fases: escolha o lado (Flávio ou Lula) e vença uma fase por vez; cada vitória libera a próxima.
- Cada fase tem um cenário, um adversário (figura política da trilha) e dificuldade crescente:
  a torcida adversária começa pequena (8 torcedores) e chega a 17 no chefão, e a IA fica mais esperta.
- O chefão final é sempre o líder do outro lado (Lula para quem joga com Flávio, Flávio para quem joga com Lula).
- O progresso fica só em memória: recarregar a página recomeça.
- Tabuleiros 10×10; posicione 5 grupos de torcedores (5, 4, 3, 3 e 2).
- Em cada turno, arremesse um objeto de protesto (cone, tomate, bandeira, cavalete, chinelo, pedra ou ovo).
- Energia: +1 por turno e +1 por torcedor atingido. Gaste em poderes:
  📊 Pesquisa (2) · 📣 Buzinaço/Comício (3) · 🏍️ Motociata / 🚌 Caravana (6).
- Votos: cada acerto vale 100 pontos × combo (2x, 3x, 4x e, no 5º acerto seguido, 50x). Errar o tiro zera o combo.
- Sem limite de tempo, contador de rodadas; vence quem dispersar toda a torcida adversária.
- Controles: mouse/toque · `R` gira · `1–4` poderes · `Esc` cancela. No celular a câmera acompanha o turno.

## Trilhas
| Fase | Cenário | Contra Flávio (PL) | Contra Lula (PT) | Dificuldade |
|---|---|---|---|---|
| 1 | Av. Paulista (SP) | Boulos | Nikolas Ferreira | Fácil |
| 2 | Aeroporto Salgado Filho (RS) | Gleisi Hoffmann | Tarcísio de Freitas | Médio |
| 3 | Cristo Redentor (RJ) | Alexandre de Moraes | Michelle Bolsonaro | Difícil |
| 4 | Esplanada dos Ministérios (DF) | **Lula (chefão)** | **Flávio (chefão)** | Chefão |

As fases e os adversários ficam em `LEVELS`, `TRACKS` e `CHARS` no `index.html`.

## Cenários
Av. Paulista (SP), Aeroporto Salgado Filho (RS), Cristo Redentor (RJ) e Esplanada dos Ministérios (DF).
Para criar um novo, adicione um objeto em `SCENARIOS` no `index.html`
(há um comentário `ADICIONE NOVOS CENÁRIOS AQUI`); depois inclua o cenário em `LEVELS` para virar uma fase.

## Tecnologia
Arquivo único (`index.html`) com [Three.js](https://threejs.org/) via CDN; sem build, sem servidor.

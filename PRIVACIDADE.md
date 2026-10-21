# Política de Privacidade · Super Presida Batalha

**Versão 2026-10 · atualizada em 21/10/2026**

Este jogo é um projeto independente e de entretenimento. Aqui está, em linguagem simples, quais dados ele guarda, por quê, por quanto tempo e como você controla tudo isso.

## 1. Quem é o responsável
O responsável pelo tratamento dos dados é o autor do jogo, **rpossan**. Para qualquer pedido ou dúvida sobre os seus dados, abra uma *issue* em [github.com/rpossan/super-batalha-presida-remake](https://github.com/rpossan/super-batalha-presida-remake/issues).

## 2. O que é guardado
**Você cria e fornece**
| Dado | Para quê |
|---|---|
| Nome de jogador (nick) e avatar | Aparecer no ranking, nos duelos e nos créditos |
| Progresso: nível, votos, grana, skills, itens, fases vencidas, tempos, estatísticas, preferências de som | Salvar o jogo e permitir continuar de onde parou |
| Resultados de duelos online (quem venceu, rodadas) e o rating | Montar o ranking online |

**Coletados automaticamente quando você abre o jogo**
| Dado | Detalhe |
|---|---|
| País | Aproximado, pelo cabeçalho da hospedagem. **Não** guardamos cidade nem localização precisa (o jogo nunca pede GPS) |
| Endereço IP | **Não é guardado.** Guardamos só um *hash* (código irreversível) combinado com um sal que muda todo dia, para detectar abuso e contas em massa. Não dá para voltar ao seu IP |
| Aparelho e navegador | Tipo (celular, tablet, computador), sistema e navegador com a versão principal, tamanho da tela, idioma, fuso horário, se a tela é de toque, número de núcleos e memória aproximada. Nunca o texto completo do navegador |
| Versão do jogo e campanha | Para saber onde corrigir erros |

O jogo **não** usa cookies de publicidade nem rastreadores de terceiros, e **não** vende dados.

## 3. Por que usamos (base legal)
- **Consentimento** (você marca o aceite ao criar o perfil): guardar o seu perfil e progresso e registrar os dados técnicos de acesso.
- **Legítimo interesse**: manter o ranking justo, impedir fraudes e abuso, corrigir erros e entender em que aparelhos o jogo precisa funcionar bem.

## 4. Por quanto tempo
- **Perfil, progresso e resultados:** enquanto você mantiver a conta. Você pode excluir tudo a qualquer momento (veja o item 6).
- **Dados técnicos de acesso:** **90 dias**; depois são apagados automaticamente.
- **Cópia temporária no navegador:** só se a internet cair no meio do jogo, e é apagada assim que o progresso é enviado.

## 5. Quem recebe os dados
- **Supabase** (banco de dados, login anônimo e tempo real): armazena e processa os dados. Os servidores podem ficar fora do Brasil (transferência internacional), com as garantias do próprio provedor.
- **GitHub Pages** (hospeda o site) e **jsDelivr** (entrega bibliotecas): como em qualquer site, recebem o seu IP quando você abre a página.
- **Outros jogadores:** nick, avatar, votos, nível, vitórias, derrotas, tempos e rating aparecem no **ranking público**. No duelo online o adversário vê o seu nick, avatar e ID de jogador.
- O seu progresso completo (save) **só você** consegue ler.

## 6. Os seus direitos (LGPD, art. 18) e como exercer
No jogo, em **Perfil → Backup e transferência**:
- **Acesso e portabilidade:** *⬇️ Baixar os meus dados (servidor)* gera um arquivo com tudo o que o servidor tem sobre você.
- **Correção:** edite o nick e o avatar no perfil.
- **Eliminação:** *🗑 Excluir a minha conta e os meus dados* apaga o perfil, o progresso, o ranking e os registros de acesso do servidor.
- **Revogar o consentimento:** exclua a conta ou deixe de usar o jogo; o botão *Jogar sem salvar* da tela de entrada não envia nada ao servidor.
Para qualquer outro pedido, use o contato do item 1.

## 7. O que fica no seu navegador
A sessão anônima do Supabase (identifica a sua conta), a época dos dados, o idioma e, temporariamente, uma pendência de salvamento. Só enquanto a aba está aberta, guarda também o nível de qualidade gráfica escolhido automaticamente para o seu aparelho. Limpar os dados do site apaga a sessão: você passa a ser um jogador novo (use o backup para levar o progresso).

## 8. Segurança
O acesso ao banco é restrito por regras de segurança (RLS): ninguém altera as tabelas diretamente, os dados técnicos de acesso e o sal do hash não são legíveis pela internet, e as funções validam o que recebem. Nenhum sistema é 100% seguro; se houver incidente relevante, os afetados serão avisados.

## 9. Crianças e adolescentes
O jogo não é direcionado a crianças. Quem tiver menos de 18 anos deve usar com o conhecimento e a autorização dos responsáveis.

## 10. Mudanças nesta política
Se a política mudar de forma relevante, a versão acima muda e o jogo pede um **novo aceite** antes de continuar.

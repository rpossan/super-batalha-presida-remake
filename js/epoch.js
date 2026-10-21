/* Época dos dados: quando a época muda, tudo o que versões antigas guardaram neste navegador (progresso, perfil,
   recordes e a sessão do servidor) é apagado, e o jogador começa do zero (agora o progresso mora na nuvem).
   Para forçar um novo "zerar" no futuro, basta trocar o texto de EPOCH. */
(() => {
  const EPOCH = "2026-10-nuvem-1";
  try {
    if (localStorage.getItem("spb_epoch") === EPOCH) return;
    Object.keys(localStorage).forEach(k => { if (/^(spb_|sb-)/.test(k)) localStorage.removeItem(k); });
    localStorage.setItem("spb_epoch", EPOCH);
  } catch (e) { /* armazenamento bloqueado: segue sem ele */ }
})();

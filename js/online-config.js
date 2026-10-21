/* Configuração do modo online (Supabase Realtime, ranking e save na nuvem).
   A chave "anon" é PÚBLICA por desenho (pode ficar no código do navegador): a segurança vem das regras (RLS)
   e das funções de supabase/schema.sql.
   NUNCA coloque aqui a chave "service_role" nem a senha do banco.
   Deixe vazio para jogar sem servidor: as partidas aleatórias passam a ser contra jogadores simulados. */
window.SPB_ONLINE = {
  supabaseUrl: "https://mibpoaktxsbjgqeslxbn.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pYnBvYWt0eHNiamdxZXNseGJuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI2MDgxMDksImV4cCI6MjEwODE4NDEwOX0.ZfJuV_JepojVCQ8w-uiRJ6de6jq9IC_WId7I9858HgQ",
};

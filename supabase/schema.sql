-- Super Presida Batalha REMAKE · esquema do Supabase (ranking + save na nuvem)
-- Cole no SQL Editor do Supabase e execute. É seguro rodar mais de uma vez.
--
-- Contém: perfis e ranking da CAMPANHA (votos), save na nuvem e ranking do MODO ONLINE (rating tipo ELO).
--
-- Modelo de segurança (o jogo roda no navegador, então a chave "anon" é pública):
--   * cada jogador entra com login ANÔNIMO do Supabase (auth.uid() identifica o navegador);
--   * ninguém escreve direto nas tabelas: só pelas funções (RPC) abaixo, que validam tudo;
--   * o ranking é público (só leitura); o save é privado (só o dono lê).

create extension if not exists unaccent with schema extensions;

-- ---------------------------------------------------------------- tabelas
create table if not exists public.players (
  id               uuid primary key references auth.users (id) on delete cascade,
  code             text        not null check (code ~ '^[0-9A-F]{4}$'),            -- código curto do perfil (#4F2A)
  friend_id        text        unique check (friend_id ~ '^[0-9a-f]{8}$'),          -- ID de 8 caracteres que o jogador passa aos amigos
  nick             text        not null check (char_length(nick) between 3 and 14),
  avatar           jsonb       not null default '{}'::jsonb,
  votes            bigint      not null default 0 check (votes >= 0),
  level            int         not null default 0 check (level between 0 and 15),
  wins             int         not null default 0 check (wins >= 0),
  losses           int         not null default 0 check (losses >= 0),
  best_time_flavio numeric     check (best_time_flavio > 0),                        -- segundos
  best_time_lula   numeric     check (best_time_lula > 0),
  banned           boolean     not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.players add column if not exists friend_id text unique check (friend_id ~ '^[0-9a-f]{8}$');   -- (para quem já tinha rodado a versão anterior)
create index if not exists players_votes_idx on public.players (votes desc, updated_at asc) where not banned;

create table if not exists public.saves (
  player_id  uuid primary key references public.players (id) on delete cascade,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

-- modo online: rating de cada jogador e registro das partidas (cada lado reporta o resultado)
create table if not exists public.online_ratings (
  player_id  uuid primary key references public.players (id) on delete cascade,
  rating     int         not null default 1000 check (rating >= 100),
  wins       int         not null default 0,
  losses     int         not null default 0,
  games      int         not null default 0,
  flags      int         not null default 0,                                         -- denúncias de trapaça recebidas (para você revisar)
  updated_at timestamptz not null default now()
);
create table if not exists public.online_matches (
  match_id   text primary key check (match_id ~ '^[0-9a-f]{12}$'),                  -- id da sala
  a_id       uuid not null references public.players (id) on delete cascade,        -- quem reportou primeiro
  b_id       uuid not null references public.players (id) on delete cascade,
  a_report   jsonb,
  b_report   jsonb,
  status     text not null default 'open' check (status in ('open', 'rated', 'disputed', 'void')),
  winner_id  uuid,
  delta_a    int,
  delta_b    int,
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check (a_id <> b_id)
);
create index if not exists online_matches_open_idx on public.online_matches (created_at) where status = 'open';
create index if not exists online_matches_pair_idx on public.online_matches (a_id, b_id, settled_at);
create index if not exists online_ratings_rank_idx on public.online_ratings (rating desc, wins desc);

create table if not exists public.blocked_words (word text primary key);            -- palavras proibidas em nicks (sem acento, minúsculas)
insert into public.blocked_words (word) values
  ('caralho'), ('buceta'), ('arrombad'), ('porra'), ('merda'), ('foder'), ('fodase'), ('viado'),
  ('bosta'), ('otario'), ('retardad'), ('nazi'), ('estupr'), ('pedofil')
on conflict do nothing;

-- ---------------------------------------------------------------- permissões (RLS)
alter table public.players       enable row level security;
alter table public.saves         enable row level security;
alter table public.online_ratings enable row level security;
alter table public.online_matches enable row level security;                          -- sem policy: só as funções acessam
alter table public.blocked_words enable row level security;                           -- sem policy: ninguém lê pela API

drop policy if exists "ranking publico" on public.players;
create policy "ranking publico" on public.players for select to anon, authenticated using (not banned);

drop policy if exists "rating publico" on public.online_ratings;
create policy "rating publico" on public.online_ratings for select to anon, authenticated using (true);

drop policy if exists "save do dono" on public.saves;
create policy "save do dono" on public.saves for select to authenticated using (player_id = auth.uid());

-- nenhuma escrita direta: tudo passa pelas funções abaixo
revoke insert, update, delete, truncate on public.players, public.saves, public.online_ratings from anon, authenticated;
revoke all on public.online_matches from anon, authenticated;
revoke all on public.saves from anon;
revoke all on public.blocked_words from anon, authenticated;

-- ---------------------------------------------------------------- funções
create or replace function public.nick_ok(p text) returns boolean
language sql stable set search_path = public, extensions as $$
  select p ~ '^[[:alnum:] _.-]{3,14}$'
     and not exists (
       select 1 from public.blocked_words w
       where replace(replace(replace(extensions.unaccent(lower(p)), ' ', ''), '_', ''), '.', '') like '%' || w.word || '%');
$$;

-- cria ou atualiza o perfil do jogador logado
drop function if exists public.upsert_profile(text, jsonb, text);                    -- assinatura antiga (sem friend_id)
create or replace function public.upsert_profile(p_nick text, p_avatar jsonb, p_code text, p_friend text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'não autenticado'; end if;
  if not public.nick_ok(p_nick) then raise exception 'nick inválido'; end if;
  if p_code !~ '^[0-9A-F]{4}$' then raise exception 'código inválido'; end if;
  if p_friend !~ '^[0-9a-f]{8}$' then raise exception 'id inválido'; end if;
  if jsonb_typeof(p_avatar) is distinct from 'object' or pg_column_size(p_avatar) > 600 then raise exception 'avatar inválido'; end if;
  if exists (select 1 from public.players where friend_id = p_friend and id <> uid) then raise exception 'friend_id_taken'; end if;
  insert into public.players (id, code, nick, avatar, friend_id) values (uid, p_code, p_nick, p_avatar, p_friend)
  on conflict (id) do update set nick = excluded.nick, avatar = excluded.avatar, code = excluded.code, friend_id = excluded.friend_id
  where not public.players.banned;
end $$;

-- envia o progresso: valida, nunca deixa os números diminuírem e limita o ganho por envio
create or replace function public.submit_progress(
  p_votes bigint, p_wins int, p_losses int,
  p_best_flavio numeric, p_best_lula numeric, p_save jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur public.players%rowtype;
  max_gain bigint;
begin
  if uid is null then raise exception 'não autenticado'; end if;
  select * into cur from public.players where id = uid for update;
  if not found then raise exception 'perfil inexistente'; end if;
  if cur.banned then raise exception 'jogador bloqueado'; end if;

  max_gain := case when cur.votes = 0 then 500000 else 30000 end;                  -- 1º envio aceita um save antigo; depois, ganho plausível por fase
  if p_votes < cur.votes then p_votes := cur.votes; end if;                         -- votos (experiência) nunca diminuem
  if p_votes - cur.votes > max_gain then raise exception 'ganho de votos implausível'; end if;
  if cur.votes > 0 and p_votes > cur.votes and now() - cur.updated_at < interval '15 seconds' then raise exception 'envio rápido demais'; end if;   -- (o 1º envio não conta)
  p_wins   := greatest(coalesce(p_wins, 0),   cur.wins);
  p_losses := greatest(coalesce(p_losses, 0), cur.losses);
  if p_wins - cur.wins > 50 or p_losses - cur.losses > 50 then raise exception 'estatística implausível'; end if;

  if p_best_flavio between 120 and 360000 then p_best_flavio := least(p_best_flavio, coalesce(cur.best_time_flavio, p_best_flavio)); else p_best_flavio := cur.best_time_flavio; end if;
  if p_best_lula   between 120 and 360000 then p_best_lula   := least(p_best_lula,   coalesce(cur.best_time_lula,   p_best_lula));   else p_best_lula   := cur.best_time_lula;   end if;

  update public.players set
    votes = p_votes, wins = p_wins, losses = p_losses,
    level = least(15, floor((-1 + sqrt(1 + 4 * p_votes / 500.0)) / 2))::int,        -- mesma curva do jogo: 500·n·(n+1) votos
    best_time_flavio = p_best_flavio, best_time_lula = p_best_lula, updated_at = now()
  where id = uid;

  if p_save is not null then
    if jsonb_typeof(p_save) is distinct from 'object' or pg_column_size(p_save) > 20000 then raise exception 'save inválido'; end if;
    insert into public.saves (player_id, data) values (uid, p_save)
    on conflict (player_id) do update set data = excluded.data, updated_at = now();
  end if;
end $$;

-- ELO: aplica o resultado de uma partida já validada (uso interno)
create or replace function public._apply_rating(p_match text, p_winner uuid, p_loser uuid)
returns void language plpgsql security definer set search_path = public as $$
declare rw int; rl int; ew numeric; dw int; dl int; m public.online_matches%rowtype;
begin
  insert into public.online_ratings (player_id) values (p_winner), (p_loser) on conflict do nothing;
  select rating into rw from public.online_ratings where player_id = p_winner for update;
  select rating into rl from public.online_ratings where player_id = p_loser  for update;
  ew := 1 / (1 + power(10, (rl - rw) / 400.0));
  dw := greatest(1, round(32 * (1 - ew))::int);                                       -- quem vence sempre ganha pelo menos 1
  dl := -least(rl - 100, round(32 * ew)::int);                                        -- o rating nunca cai de 100
  update public.online_ratings set rating = rating + dw, wins = wins + 1, games = games + 1, updated_at = now() where player_id = p_winner;
  update public.online_ratings set rating = rating + dl, losses = losses + 1, games = games + 1, updated_at = now() where player_id = p_loser;
  select * into m from public.online_matches where match_id = p_match;
  update public.online_matches set status = 'rated', winner_id = p_winner, settled_at = now(),
         delta_a = case when a_id = p_winner then dw else dl end, delta_b = case when b_id = p_winner then dw else dl end
   where match_id = p_match;
end $$;

-- fecha partidas abertas em que só um lado reportou:
--   * relato de DERROTA ("perdi", inclusive por desistência): vale depois de 2 min (ninguém ganha nada mentindo que perdeu);
--   * relato de VITÓRIA sem confirmação do outro lado: nunca vale (senão alguém poderia "derrotar" qualquer ID) e some em 10 min
create or replace function public._settle_stale() returns void language plpgsql security definer set search_path = public as $$
declare m public.online_matches%rowtype; rep jsonb; reporter uuid; other uuid;
begin
  for m in select * from public.online_matches where status = 'open' and created_at < now() - interval '2 minutes' for update skip locked loop
    if m.a_report is not null and m.b_report is null then rep := m.a_report; reporter := m.a_id; other := m.b_id;
    elsif m.b_report is not null and m.a_report is null then rep := m.b_report; reporter := m.b_id; other := m.a_id;
    else continue; end if;
    if not (rep->>'won')::boolean and (rep->>'rounds')::int >= 8 and rep->>'verdict' is distinct from 'cheat' then
      perform public._apply_rating(m.match_id, other, reporter);
    elsif m.created_at < now() - interval '10 minutes' then
      update public.online_matches set status = 'void', settled_at = now() where match_id = m.match_id;
    end if;
  end loop;
end $$;

-- cada jogador reporta o resultado de um duelo online contra outro jogador (nunca contra simulado)
create or replace function public.report_online_match(
  p_match text, p_opponent text, p_won boolean, p_reason text, p_rounds int, p_verdict text)
returns text language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); me public.players%rowtype; opp public.players%rowtype; m public.online_matches%rowtype;
  mine jsonb; theirs jsonb; recent int; a_won boolean; b_won boolean;
begin
  if uid is null then raise exception 'não autenticado'; end if;
  if p_match !~ '^[0-9a-f]{12}$' or p_opponent !~ '^[0-9a-f]{8}$' then raise exception 'dados inválidos'; end if;
  if p_reason not in ('normal', 'resign', 'disconnect', 'idle', 'cheat') or p_verdict not in ('ok', 'cheat', 'missing', 'skipped') then raise exception 'dados inválidos'; end if;
  select * into me from public.players where id = uid;
  select * into opp from public.players where friend_id = p_opponent;
  if me.id is null or opp.id is null or me.banned or opp.banned or me.id = opp.id then raise exception 'jogadores inválidos'; end if;
  perform public._settle_stale();

  mine := jsonb_build_object('won', p_won, 'reason', p_reason, 'rounds', greatest(0, least(coalesce(p_rounds, 0), 500)), 'verdict', p_verdict);
  select * into m from public.online_matches where match_id = p_match for update;
  if not found then
    insert into public.online_matches (match_id, a_id, b_id, a_report) values (p_match, uid, opp.id, mine);
    return 'aguardando o adversário';
  end if;
  if m.status <> 'open' then return m.status; end if;
  if not (m.b_id = uid and m.a_id = opp.id) or m.b_report is not null then return 'ignorado'; end if;   -- só o outro lado da mesma partida, uma vez
  update public.online_matches set b_report = mine where match_id = p_match returning * into m;
  theirs := m.a_report; a_won := (theirs->>'won')::boolean; b_won := p_won;

  if a_won is distinct from b_won and (mine->>'verdict') <> 'cheat' and (theirs->>'verdict') <> 'cheat' then   -- um venceu, o outro perdeu: normal
    if (mine->>'rounds')::int < 8 and p_reason <> 'normal' then
      update public.online_matches set status = 'void', settled_at = now() where match_id = p_match; return 'void';       -- desistência logo no começo não vale
    end if;
    select count(*) into recent from public.online_matches
      where status = 'rated' and settled_at > now() - interval '24 hours' and ((a_id = m.a_id and b_id = m.b_id) or (a_id = m.b_id and b_id = m.a_id));
    if recent >= 5 then update public.online_matches set status = 'void', settled_at = now() where match_id = p_match; return 'void'; end if;   -- treino repetido com a mesma pessoa
    if b_won then perform public._apply_rating(p_match, m.b_id, m.a_id); else perform public._apply_rating(p_match, m.a_id, m.b_id); end if;
    return 'valendo rating';
  end if;
  -- relatos conflitantes (os dois dizem que venceram ou há acusação de trapaça): ninguém pontua e o acusado fica marcado
  update public.online_matches set status = 'disputed', settled_at = now() where match_id = p_match;
  if (theirs->>'verdict') = 'cheat' then insert into public.online_ratings (player_id, flags) values (m.b_id, 1) on conflict (player_id) do update set flags = public.online_ratings.flags + 1; end if;
  if (mine->>'verdict')   = 'cheat' then insert into public.online_ratings (player_id, flags) values (m.a_id, 1) on conflict (player_id) do update set flags = public.online_ratings.flags + 1; end if;
  return 'disputada';
end $$;

-- apaga o perfil e o save do jogador logado (direito de exclusão)
create or replace function public.delete_my_data() returns void
language sql security definer set search_path = public as $$
  delete from public.players where id = auth.uid();
$$;

revoke all on function public.nick_ok(text), public.upsert_profile(text, jsonb, text, text),
  public.submit_progress(bigint, int, int, numeric, numeric, jsonb), public.delete_my_data(),
  public._apply_rating(text, uuid, uuid), public._settle_stale(),
  public.report_online_match(text, text, boolean, text, int, text) from public, anon, authenticated;
grant execute on function public.upsert_profile(text, jsonb, text, text),
  public.submit_progress(bigint, int, int, numeric, numeric, jsonb), public.delete_my_data(),
  public.report_online_match(text, text, boolean, text, int, text) to authenticated;

-- ---------------------------------------------------------------- ranking (leitura pública)
create or replace view public.ranking with (security_invoker = true) as
select id, code, nick, avatar, votes, level, wins, losses, best_time_flavio, best_time_lula,
       row_number() over (order by votes desc, updated_at asc) as rank                -- 1º, 2º e 3º: ouro, prata e bronze
from public.players
where not banned;
grant select on public.ranking to anon, authenticated;

-- ranking do modo online: só aparece quem já jogou pelo menos uma partida valendo rating
create or replace view public.ranking_online with (security_invoker = true) as
select p.id, p.code, p.nick, p.avatar, r.rating, r.wins, r.losses, r.games,
       row_number() over (order by r.rating desc, r.wins desc, r.updated_at asc) as rank
from public.online_ratings r
join public.players p on p.id = r.player_id
where not p.banned and r.games >= 1;
grant select on public.ranking_online to anon, authenticated;

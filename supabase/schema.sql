-- Super Presida Batalha REMAKE · esquema do Supabase (ranking + save na nuvem)
-- Cole no SQL Editor do Supabase e execute. É seguro rodar mais de uma vez.
--
-- Contém: perfis, save na nuvem (o jogo guarda o progresso aqui, não no navegador), ranking da CAMPANHA (votos)
-- e ranking do MODO ONLINE (rating tipo ELO).
--
-- Modelo de segurança (o jogo roda no navegador, então a chave "anon" é pública):
--   * cada jogador entra com login ANÔNIMO do Supabase (auth.uid() identifica o navegador);
--   * ninguém escreve direto nas tabelas: só pelas funções (RPC) abaixo, que validam tudo;
--   * o ranking é público (só leitura); o save é privado (só o dono lê).

create extension if not exists unaccent with schema extensions;
create extension if not exists pgcrypto with schema extensions;

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
  best_times       jsonb       not null default '{}'::jsonb,                        -- melhor tempo (segundos) por campanha e lado: {"br2026/flavio": 4277.5}
  banned           boolean     not null default false,
  consent_at       timestamptz,                                                     -- aceite da Política de Privacidade
  consent_version  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.players add column if not exists best_times jsonb not null default '{}'::jsonb;
alter table public.players add column if not exists consent_at timestamptz;
alter table public.players add column if not exists consent_version text;
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

-- dados técnicos de acesso (privados: nenhuma policy, só as funções escrevem e só o dono do projeto lê pelo painel)
create table if not exists public.player_sessions (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references public.players (id) on delete cascade,
  created_at  timestamptz not null default now(),
  country     text,                          -- país (2 letras), vindo do cabeçalho da hospedagem
  ip_hash     text,                          -- IP "picotado": hash com sal que muda todo dia (não dá para voltar ao IP)
  device      text,                          -- mobile | tablet | desktop | other
  os          text, os_ver text,
  browser     text, browser_ver text,
  screen      text, dpr numeric,
  lang        text, tz text,
  touch       boolean, cores int, memory numeric,
  campaign    text, app_version text
);
create index if not exists player_sessions_player_idx on public.player_sessions (player_id, created_at desc);
create index if not exists player_sessions_date_idx on public.player_sessions (created_at);
create table if not exists public.app_secrets (key text primary key, value text not null);          -- sal do hash do IP (nunca exposto)
insert into public.app_secrets (key, value) values ('ip_salt', encode(extensions.gen_random_bytes(16), 'hex')) on conflict do nothing;

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
alter table public.player_sessions enable row level security;                        -- sem policy: ninguém lê pela API
alter table public.app_secrets enable row level security;
alter table public.blocked_words enable row level security;                           -- sem policy: ninguém lê pela API

drop policy if exists "ranking publico" on public.players;
create policy "ranking publico" on public.players for select to anon, authenticated using (not banned);

drop policy if exists "rating publico" on public.online_ratings;
create policy "rating publico" on public.online_ratings for select to anon, authenticated using (true);

drop policy if exists "save do dono" on public.saves;
create policy "save do dono" on public.saves for select to authenticated using (player_id = auth.uid());

-- nenhuma escrita direta: tudo passa pelas funções abaixo
revoke insert, update, delete, truncate on public.players, public.saves, public.online_ratings from anon, authenticated;
-- leitura pública de players: só as colunas do ranking (friend_id e banned não são expostos)
revoke select on public.players from anon, authenticated;
grant select (id, code, nick, avatar, votes, level, wins, losses, best_times, created_at, updated_at) on public.players to anon, authenticated;
revoke all on public.online_matches from anon, authenticated;
revoke all on public.saves from anon;
revoke all on public.blocked_words, public.player_sessions, public.app_secrets from anon, authenticated;

-- ---------------------------------------------------------------- funções
create or replace function public.nick_ok(p text) returns boolean
language sql stable set search_path = public, extensions as $$
  select p ~ '^[[:alnum:] _.-]{3,14}$'
     and not exists (
       select 1 from public.blocked_words w
       where replace(replace(replace(extensions.unaccent(lower(p)), ' ', ''), '_', ''), '.', '') like '%' || w.word || '%');
$$;

-- cria ou atualiza o perfil do jogador logado
drop function if exists public.upsert_profile(text, jsonb, text);                    -- assinaturas antigas
drop function if exists public.upsert_profile(text, jsonb, text, text);
create or replace function public.upsert_profile(p_nick text, p_avatar jsonb, p_code text, p_friend text, p_consent text default null)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'não autenticado'; end if;
  if not public.nick_ok(p_nick) then raise exception 'nick inválido'; end if;
  if p_code !~ '^[0-9A-F]{4}$' then raise exception 'código inválido'; end if;
  if p_friend !~ '^[0-9a-f]{8}$' then raise exception 'id inválido'; end if;
  if jsonb_typeof(p_avatar) is distinct from 'object' or pg_column_size(p_avatar) > 600 then raise exception 'avatar inválido'; end if;
  if exists (select 1 from public.players where friend_id = p_friend and id <> uid) then raise exception 'friend_id_taken'; end if;
  if p_consent is not null and p_consent !~ '^[0-9a-z.-]{3,20}$' then raise exception 'consentimento inválido'; end if;
  if p_consent is null and not exists (select 1 from public.players where id = uid) then raise exception 'consentimento necessário'; end if;           -- conta nova exige o aceite da política
  insert into public.players (id, code, nick, avatar, friend_id, consent_at, consent_version) values (uid, p_code, p_nick, p_avatar, p_friend, now(), p_consent)
  on conflict (id) do update set nick = excluded.nick, avatar = excluded.avatar, code = excluded.code, friend_id = excluded.friend_id,
    consent_at = case when p_consent is not null and public.players.consent_version is distinct from p_consent then now() else public.players.consent_at end,
    consent_version = coalesce(p_consent, public.players.consent_version)
  where not public.players.banned;
end $$;

-- envia o progresso: valida, nunca deixa os números diminuírem e limita o ganho por envio
-- p_best: melhores tempos por campanha e lado, ex.: {"br2026/flavio": 4277.5, "br2026/lula": 5120}
drop function if exists public.submit_progress(bigint, int, int, numeric, numeric, jsonb);
drop function if exists public.submit_progress(bigint, int, int, jsonb, jsonb);
create or replace function public.submit_progress(
  p_votes bigint, p_wins int, p_losses int, p_best jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur public.players%rowtype;
  max_gain bigint;
  merged jsonb;
  k text; v jsonb;
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

  merged := coalesce(cur.best_times, '{}'::jsonb);
  if p_best is not null and jsonb_typeof(p_best) = 'object' then
    if (select count(*) from jsonb_object_keys(p_best)) > 40 then raise exception 'melhores tempos demais'; end if;
    for k, v in select * from jsonb_each(p_best) loop
      if k ~ '^[a-z0-9_-]{2,32}/[a-z0-9_-]{2,32}$' and jsonb_typeof(v) = 'number' and (v #>> '{}')::numeric between 120 and 360000 then   -- tempo da campanha: de 2 min a 100 h
        if not (merged ? k) or (v #>> '{}')::numeric < (merged ->> k)::numeric then merged := merged || jsonb_build_object(k, v); end if;
      end if;
    end loop;
  end if;

  update public.players set
    votes = p_votes, wins = p_wins, losses = p_losses,
    level = least(15, floor((-1 + sqrt(1 + 4 * p_votes / 500.0)) / 2))::int,        -- mesma curva do jogo: 500·n·(n+1) votos
    best_times = merged, updated_at = now()
  where id = uid;

end $$;

-- salva o progresso do jogador (o save inteiro do jogo, em JSON). Só guarda: o ranking só muda via submit_progress
create or replace function public.save_game(p_save jsonb)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); last timestamptz; t timestamptz := now();
begin
  if uid is null then raise exception 'não autenticado'; end if;
  if not exists (select 1 from public.players where id = uid and not banned) then raise exception 'perfil inexistente'; end if;
  if jsonb_typeof(p_save) is distinct from 'object' or pg_column_size(p_save) > 40000 then raise exception 'save inválido'; end if;
  select updated_at into last from public.saves where player_id = uid;
  if last is not null and t - last < interval '1 second' then raise exception 'salvando rápido demais'; end if;
  insert into public.saves (player_id, data, updated_at) values (uid, p_save, t)
  on conflict (player_id) do update set data = excluded.data, updated_at = t;
  return t;
end $$;

-- devolve o perfil do próprio jogador (inclui o friend_id, que não é público) ou null se ainda não existe
create or replace function public.get_my_profile() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nick', nick, 'avatar', avatar, 'friend_id', friend_id, 'code', code, 'consent_version', consent_version)
  from public.players where id = auth.uid() and not banned;
$$;

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

-- registra o acesso (dados técnicos mínimos). IP e país vêm dos cabeçalhos da hospedagem; o IP só é guardado como hash diário.
-- Só registra quem já aceitou a política, no máximo 1 vez a cada 30 min, e apaga registros com mais de 90 dias.
drop function if exists public.log_session(jsonb);
create or replace function public.log_session(p_info jsonb) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  uid uuid := auth.uid(); h jsonb; ip text; salt text; cty text; i jsonb := coalesce(p_info, '{}'::jsonb);
  v_device text; v_screen text; v_dpr numeric; v_cores int; v_mem numeric;
begin
  if uid is null then raise exception 'não autenticado'; end if;
  if not exists (select 1 from public.players where id = uid and consent_at is not null and not banned) then return 'sem aceite'; end if;
  if random() < .05 then delete from public.player_sessions where created_at < now() - interval '90 days'; end if;      -- retenção: 90 dias (limpeza ocasional)
  if exists (select 1 from public.player_sessions where player_id = uid and created_at > now() - interval '30 minutes') then return 'recente'; end if;

  begin h := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb); exception when others then h := '{}'::jsonb; end;
  ip := nullif(trim(split_part(coalesce(h ->> 'x-forwarded-for', h ->> 'x-real-ip', ''), ',', 1)), '');
  cty := upper(nullif(h ->> 'cf-ipcountry', ''));
  if cty is null or cty !~ '^[A-Z]{2}$' or cty in ('XX', 'T1') then cty := null; end if;
  select value into salt from public.app_secrets where key = 'ip_salt';

  v_device := i ->> 'device'; if v_device not in ('mobile', 'tablet', 'desktop') then v_device := 'other'; end if;
  v_screen := i ->> 'screen'; if v_screen !~ '^[0-9]{3,5}x[0-9]{3,5}$' then v_screen := null; end if;
  v_dpr := case when (i ->> 'dpr') ~ '^[0-9]{1,2}(\.[0-9]{1,2})?$' then (i ->> 'dpr')::numeric end; if v_dpr is not null and (v_dpr < .5 or v_dpr > 6) then v_dpr := null; end if;
  v_cores := case when (i ->> 'cores') ~ '^[0-9]{1,3}$' then (i ->> 'cores')::int end;
  v_mem := case when (i ->> 'memory') ~ '^[0-9]{1,3}(\.[0-9]{1,2})?$' then (i ->> 'memory')::numeric end;

  insert into public.player_sessions (player_id, country, ip_hash, device, os, os_ver, browser, browser_ver, screen, dpr, lang, tz, touch, cores, memory, campaign, app_version)
  values (uid, cty,
    case when ip is null then null else substr(encode(extensions.digest(ip || ':' || coalesce(salt, '') || ':' || current_date::text, 'sha256'), 'hex'), 1, 16) end,
    v_device,
    case when (i ->> 'os') ~ '^[A-Za-z0-9 ._-]{1,24}$' then i ->> 'os' end, case when (i ->> 'os_ver') ~ '^[0-9._]{1,12}$' then i ->> 'os_ver' end,
    case when (i ->> 'browser') ~ '^[A-Za-z0-9 ._-]{1,24}$' then i ->> 'browser' end, case when (i ->> 'browser_ver') ~ '^[0-9._]{1,12}$' then i ->> 'browser_ver' end,
    v_screen, v_dpr,
    case when (i ->> 'lang') ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})?$' then i ->> 'lang' end,
    case when (i ->> 'tz') ~ '^[A-Za-z0-9_+/-]{2,40}$' then i ->> 'tz' end,
    case when (i ->> 'touch') in ('true', 'false') then (i ->> 'touch')::boolean end, v_cores, v_mem,
    case when (i ->> 'campaign') ~ '^[a-z0-9-]{2,32}$' then i ->> 'campaign' end, case when (i ->> 'app_version') ~ '^[0-9.]{1,12}$' then i ->> 'app_version' end);

  return 'ok';
end $$;

-- devolve ao jogador tudo o que o servidor tem sobre ele (direito de acesso)
create or replace function public.export_my_data() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'perfil', (select to_jsonb(p) - 'banned' from public.players p where p.id = auth.uid()),
    'save', (select data from public.saves where player_id = auth.uid()),
    'rating_online', (select to_jsonb(r) from public.online_ratings r where r.player_id = auth.uid()),
    'acessos', coalesce((select jsonb_agg(to_jsonb(s) - 'id' - 'player_id' order by s.created_at desc) from public.player_sessions s where s.player_id = auth.uid()), '[]'::jsonb));
$$;

-- apaga o perfil e o save do jogador logado (direito de exclusão)
create or replace function public.delete_my_data() returns void
language sql security definer set search_path = public as $$
  delete from public.players where id = auth.uid();
$$;

revoke all on function public.nick_ok(text), public.upsert_profile(text, jsonb, text, text, text),
  public.submit_progress(bigint, int, int, jsonb), public.save_game(jsonb), public.get_my_profile(), public.delete_my_data(),
  public.log_session(jsonb), public.export_my_data(),
  public._apply_rating(text, uuid, uuid), public._settle_stale(),
  public.report_online_match(text, text, boolean, text, int, text) from public, anon, authenticated;
grant execute on function public.upsert_profile(text, jsonb, text, text, text),
  public.submit_progress(bigint, int, int, jsonb), public.save_game(jsonb), public.get_my_profile(), public.delete_my_data(),
  public.log_session(jsonb), public.export_my_data(),
  public.report_online_match(text, text, boolean, text, int, text) to authenticated;

-- ---------------------------------------------------------------- ranking (leitura pública)
drop view if exists public.ranking;
create view public.ranking with (security_invoker = true) as
select id, code, nick, avatar, votes, level, wins, losses, best_times,
       row_number() over (order by votes desc, updated_at asc) as rank                -- 1º, 2º e 3º: ouro, prata e bronze
from public.players;                                                                  -- a policy "ranking publico" já esconde os bloqueados
grant select on public.ranking to anon, authenticated;

-- ranking do modo online: só aparece quem já jogou pelo menos uma partida valendo rating
create or replace view public.ranking_online with (security_invoker = true) as
select p.id, p.code, p.nick, p.avatar, r.rating, r.wins, r.losses, r.games,
       row_number() over (order by r.rating desc, r.wins desc, r.updated_at asc) as rank
from public.online_ratings r
join public.players p on p.id = r.player_id
where r.games >= 1;                                                                   -- (jogadores bloqueados somem pela policy de players)
grant select on public.ranking_online to anon, authenticated;

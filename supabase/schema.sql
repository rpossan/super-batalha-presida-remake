-- Super Presida Batalha REMAKE · esquema do Supabase (ranking + save na nuvem)
-- Cole no SQL Editor do Supabase e execute. É seguro rodar mais de uma vez.
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
create index if not exists players_votes_idx on public.players (votes desc, updated_at asc) where not banned;

create table if not exists public.saves (
  player_id  uuid primary key references public.players (id) on delete cascade,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.blocked_words (word text primary key);            -- palavras proibidas em nicks (sem acento, minúsculas)
insert into public.blocked_words (word) values
  ('caralho'), ('buceta'), ('arrombad'), ('porra'), ('merda'), ('foder'), ('fodase'), ('viado'),
  ('bosta'), ('otario'), ('retardad'), ('nazi'), ('estupr'), ('pedofil')
on conflict do nothing;

-- ---------------------------------------------------------------- permissões (RLS)
alter table public.players       enable row level security;
alter table public.saves         enable row level security;
alter table public.blocked_words enable row level security;                           -- sem policy: ninguém lê pela API

drop policy if exists "ranking publico" on public.players;
create policy "ranking publico" on public.players for select to anon, authenticated using (not banned);

drop policy if exists "save do dono" on public.saves;
create policy "save do dono" on public.saves for select to authenticated using (player_id = auth.uid());

-- nenhuma escrita direta: tudo passa pelas funções abaixo
revoke insert, update, delete, truncate on public.players, public.saves from anon, authenticated;
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
create or replace function public.upsert_profile(p_nick text, p_avatar jsonb, p_code text)
returns void language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'não autenticado'; end if;
  if not public.nick_ok(p_nick) then raise exception 'nick inválido'; end if;
  if p_code !~ '^[0-9A-F]{4}$' then raise exception 'código inválido'; end if;
  if jsonb_typeof(p_avatar) is distinct from 'object' or pg_column_size(p_avatar) > 600 then raise exception 'avatar inválido'; end if;
  insert into public.players (id, code, nick, avatar) values (uid, p_code, p_nick, p_avatar)
  on conflict (id) do update set nick = excluded.nick, avatar = excluded.avatar, code = excluded.code
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

-- apaga o perfil e o save do jogador logado (direito de exclusão)
create or replace function public.delete_my_data() returns void
language sql security definer set search_path = public as $$
  delete from public.players where id = auth.uid();
$$;

revoke all on function public.nick_ok(text), public.upsert_profile(text, jsonb, text),
  public.submit_progress(bigint, int, int, numeric, numeric, jsonb), public.delete_my_data() from public, anon;
grant execute on function public.upsert_profile(text, jsonb, text),
  public.submit_progress(bigint, int, int, numeric, numeric, jsonb), public.delete_my_data() to authenticated;

-- ---------------------------------------------------------------- ranking (leitura pública)
create or replace view public.ranking with (security_invoker = true) as
select id, code, nick, avatar, votes, level, wins, losses, best_time_flavio, best_time_lula,
       row_number() over (order by votes desc, updated_at asc) as rank                -- 1º, 2º e 3º: ouro, prata e bronze
from public.players
where not banned;
grant select on public.ranking to anon, authenticated;

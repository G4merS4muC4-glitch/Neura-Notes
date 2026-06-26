-- Neural — preferências por usuário (cores das tags, etc.)
-- Rode no SQL Editor do Supabase depois da 0001.

create table if not exists public.prefs (
  user_id     uuid primary key references auth.users on delete cascade,
  tag_colors  jsonb not null default '{}',
  updated_at  bigint not null default 0
);

alter table public.prefs enable row level security;

drop policy if exists "prefs_select_own" on public.prefs;
create policy "prefs_select_own" on public.prefs
  for select using (auth.uid() = user_id);

drop policy if exists "prefs_insert_own" on public.prefs;
create policy "prefs_insert_own" on public.prefs
  for insert with check (auth.uid() = user_id);

drop policy if exists "prefs_update_own" on public.prefs;
create policy "prefs_update_own" on public.prefs
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Realtime: cores das tags sincronizam ao vivo entre dispositivos
alter publication supabase_realtime add table public.prefs;

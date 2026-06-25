-- Neural — schema inicial das notas
-- Rode no SQL Editor do Supabase (ou via `supabase db push`).

create table if not exists public.notes (
  id          uuid primary key,
  user_id     uuid not null references auth.users on delete cascade,
  title       text not null default '',
  content     text not null default '',
  links       jsonb not null default '[]',
  created_at  bigint not null,
  updated_at  bigint not null,
  deleted     boolean not null default false
);

-- consultas por dono e por data
create index if not exists notes_user_id_idx on public.notes (user_id);
create index if not exists notes_updated_at_idx on public.notes (updated_at desc);

-- Row Level Security: cada usuário só enxerga as próprias notas
alter table public.notes enable row level security;

drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own" on public.notes
  for select using (auth.uid() = user_id);

drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own" on public.notes
  for insert with check (auth.uid() = user_id);

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own" on public.notes
  for delete using (auth.uid() = user_id);

-- Realtime: sincroniza alterações entre dispositivos/abas
alter publication supabase_realtime add table public.notes;

begin;

create extension if not exists pgcrypto;

create table if not exists public.user_files (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  kind text not null check (kind in ('page', 'spreadsheet', 'database')),
  title text not null default 'Untitled',
  author text not null default 'You',
  created_at_ms bigint not null,
  updated_at_ms bigint not null,
  cover_image_url text,
  tags jsonb not null default '[]'::jsonb,
  view_kind text check (view_kind in ('table', 'board', 'calendar', 'gallery', 'list')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id)
);

create table if not exists public.user_pages (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  blocks jsonb not null default '[]'::jsonb,
  citations jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id),
  foreign key (user_id, id) references public.user_files(user_id, id) on delete cascade
);

create table if not exists public.user_spreadsheets (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  columns jsonb not null default '[]'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id),
  foreign key (user_id, id) references public.user_files(user_id, id) on delete cascade
);

create table if not exists public.user_databases (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  view_kind text not null check (view_kind in ('table', 'board', 'calendar', 'gallery', 'list')),
  schema jsonb not null default '[]'::jsonb,
  records jsonb not null default '[]'::jsonb,
  group_by_field text,
  date_field text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, id),
  foreign key (user_id, id) references public.user_files(user_id, id) on delete cascade
);

create table if not exists public.user_app_meta (
  user_id uuid not null primary key references auth.users(id) on delete cascade,
  is_seeded boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_user_files_user_updated
  on public.user_files(user_id, updated_at_ms desc);

create index if not exists idx_user_files_user_kind
  on public.user_files(user_id, kind);

alter table public.user_files enable row level security;
alter table public.user_pages enable row level security;
alter table public.user_spreadsheets enable row level security;
alter table public.user_databases enable row level security;
alter table public.user_app_meta enable row level security;

drop policy if exists "user_files_select_own" on public.user_files;
drop policy if exists "user_files_insert_own" on public.user_files;
drop policy if exists "user_files_update_own" on public.user_files;
drop policy if exists "user_files_delete_own" on public.user_files;

create policy "user_files_select_own"
  on public.user_files
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_files_insert_own"
  on public.user_files
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_files_update_own"
  on public.user_files
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_files_delete_own"
  on public.user_files
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_pages_select_own" on public.user_pages;
drop policy if exists "user_pages_insert_own" on public.user_pages;
drop policy if exists "user_pages_update_own" on public.user_pages;
drop policy if exists "user_pages_delete_own" on public.user_pages;

create policy "user_pages_select_own"
  on public.user_pages
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_pages_insert_own"
  on public.user_pages
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_pages_update_own"
  on public.user_pages
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_pages_delete_own"
  on public.user_pages
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_spreadsheets_select_own" on public.user_spreadsheets;
drop policy if exists "user_spreadsheets_insert_own" on public.user_spreadsheets;
drop policy if exists "user_spreadsheets_update_own" on public.user_spreadsheets;
drop policy if exists "user_spreadsheets_delete_own" on public.user_spreadsheets;

create policy "user_spreadsheets_select_own"
  on public.user_spreadsheets
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_spreadsheets_insert_own"
  on public.user_spreadsheets
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_spreadsheets_update_own"
  on public.user_spreadsheets
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_spreadsheets_delete_own"
  on public.user_spreadsheets
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_databases_select_own" on public.user_databases;
drop policy if exists "user_databases_insert_own" on public.user_databases;
drop policy if exists "user_databases_update_own" on public.user_databases;
drop policy if exists "user_databases_delete_own" on public.user_databases;

create policy "user_databases_select_own"
  on public.user_databases
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_databases_insert_own"
  on public.user_databases
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_databases_update_own"
  on public.user_databases
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_databases_delete_own"
  on public.user_databases
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_app_meta_select_own" on public.user_app_meta;
drop policy if exists "user_app_meta_insert_own" on public.user_app_meta;
drop policy if exists "user_app_meta_update_own" on public.user_app_meta;
drop policy if exists "user_app_meta_delete_own" on public.user_app_meta;

create policy "user_app_meta_select_own"
  on public.user_app_meta
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_app_meta_insert_own"
  on public.user_app_meta
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_app_meta_update_own"
  on public.user_app_meta
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_app_meta_delete_own"
  on public.user_app_meta
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete
  on table public.user_files
  to authenticated;

grant select, insert, update, delete
  on table public.user_pages
  to authenticated;

grant select, insert, update, delete
  on table public.user_spreadsheets
  to authenticated;

grant select, insert, update, delete
  on table public.user_databases
  to authenticated;

grant select, insert, update, delete
  on table public.user_app_meta
  to authenticated;

commit;

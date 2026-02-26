begin;

create extension if not exists pgcrypto;

-- Preflight sanity checks. Fail fast before applying constraints/policies.
do $$
declare
  invalid_required_count integer;
  invalid_position_count integer;
  duplicate_position_count integer;
begin
  select count(*) into invalid_required_count
  from public.user_dashboard_components
  where coalesce(trim(dashboard_key), '') = ''
    or coalesce(trim(component_type), '') = ''
    or coalesce(trim(title), '') = ''
    or body is null;

  if invalid_required_count > 0 then
    raise exception 'Migration aborted: user_dashboard_components has % rows with missing required values.', invalid_required_count;
  end if;

  select count(*) into invalid_position_count
  from public.user_dashboard_components
  where position < 0;

  if invalid_position_count > 0 then
    raise exception 'Migration aborted: user_dashboard_components has % rows with negative position.', invalid_position_count;
  end if;

  select count(*) into duplicate_position_count
  from (
    select user_id, dashboard_key, position
    from public.user_dashboard_components
    group by user_id, dashboard_key, position
    having count(*) > 1
  ) dupes;

  if duplicate_position_count > 0 then
    raise exception 'Migration aborted: found % duplicate (user_id, dashboard_key, position) groups.', duplicate_position_count;
  end if;
end $$;

-- Schema hardening for dashboard persistence.
alter table public.user_dashboard_components
  alter column id set default gen_random_uuid(),
  alter column dashboard_key set default 'dashboard-2',
  alter column created_at set default timezone('utc', now()),
  alter column updated_at set default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_dashboard_components_position_non_negative'
      and conrelid = 'public.user_dashboard_components'::regclass
  ) then
    alter table public.user_dashboard_components
      add constraint user_dashboard_components_position_non_negative check (position >= 0);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'user_dashboard_components_user_dashboard_position_key'
      and conrelid = 'public.user_dashboard_components'::regclass
  ) then
    alter table public.user_dashboard_components
      add constraint user_dashboard_components_user_dashboard_position_key
      unique (user_id, dashboard_key, position);
  end if;
end $$;

create index if not exists idx_user_dashboard_components_user_dashboard_position
  on public.user_dashboard_components(user_id, dashboard_key, position);

create index if not exists idx_user_dashboard_components_user_dashboard
  on public.user_dashboard_components(user_id, dashboard_key);

create index if not exists idx_user_dashboard_components_user
  on public.user_dashboard_components(user_id);

-- Enable row-level security.
alter table public.user_dashboard_components enable row level security;
alter table public.user_google_tokens enable row level security;
alter table public.user_weather_locations enable row level security;

-- Recreate per-user policies for predictable deploys.
drop policy if exists "user_dashboard_components_select_own" on public.user_dashboard_components;
drop policy if exists "user_dashboard_components_insert_own" on public.user_dashboard_components;
drop policy if exists "user_dashboard_components_update_own" on public.user_dashboard_components;
drop policy if exists "user_dashboard_components_delete_own" on public.user_dashboard_components;

create policy "user_dashboard_components_select_own"
  on public.user_dashboard_components
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_dashboard_components_insert_own"
  on public.user_dashboard_components
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_dashboard_components_update_own"
  on public.user_dashboard_components
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_dashboard_components_delete_own"
  on public.user_dashboard_components
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_google_tokens_select_own" on public.user_google_tokens;
drop policy if exists "user_google_tokens_insert_own" on public.user_google_tokens;
drop policy if exists "user_google_tokens_update_own" on public.user_google_tokens;
drop policy if exists "user_google_tokens_delete_own" on public.user_google_tokens;

create policy "user_google_tokens_select_own"
  on public.user_google_tokens
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_google_tokens_insert_own"
  on public.user_google_tokens
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_google_tokens_update_own"
  on public.user_google_tokens
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_google_tokens_delete_own"
  on public.user_google_tokens
  for delete
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_weather_locations_select_own" on public.user_weather_locations;
drop policy if exists "user_weather_locations_insert_own" on public.user_weather_locations;
drop policy if exists "user_weather_locations_update_own" on public.user_weather_locations;
drop policy if exists "user_weather_locations_delete_own" on public.user_weather_locations;

create policy "user_weather_locations_select_own"
  on public.user_weather_locations
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "user_weather_locations_insert_own"
  on public.user_weather_locations
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "user_weather_locations_update_own"
  on public.user_weather_locations
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "user_weather_locations_delete_own"
  on public.user_weather_locations
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Client role permissions used by current frontend flow.
grant usage on schema public to authenticated;

grant select, insert, update, delete
  on table public.user_dashboard_components
  to authenticated;

grant select, insert, update
  on table public.user_google_tokens
  to authenticated;

grant select, insert, update
  on table public.user_weather_locations
  to authenticated;

commit;

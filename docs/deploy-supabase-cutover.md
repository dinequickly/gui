# Supabase Deploy Cutover Checklist

## 1) Prepare
- Confirm deploy env vars are set:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Confirm Supabase Auth redirect URLs include:
  - local dev URL you plan to use (prefer `http://localhost:5173`)
  - production app URL
- Make a DB snapshot/backup before applying migration.

## 2) Apply migration
- Run migration:
  - `supabase/migrations/20260226185322_deploy_prep_hardening.sql`
- This migration:
  - validates existing dashboard data
  - hardens constraints and indexes
  - enables RLS on dashboard/token/location tables
  - adds per-user policies
  - grants `authenticated` role permissions needed by frontend

## 3) Verify data compatibility
Run these queries after migration:

```sql
-- Existing widget rows are still readable and sorted.
select id, user_id, dashboard_key, component_type, position, metadata
from public.user_dashboard_components
where user_id = '20fc03ad-256e-4933-a3b4-9f965bef79bf'
order by dashboard_key, position;

-- Metadata shape still present.
select
  id,
  metadata ->> 'local_widget_id' as local_widget_id,
  jsonb_typeof(metadata -> 'local_widget') as local_widget_type
from public.user_dashboard_components
where user_id = '20fc03ad-256e-4933-a3b4-9f965bef79bf'
order by position
limit 20;

-- Dashboard keys still discoverable for user.
select distinct dashboard_key
from public.user_dashboard_components
where user_id = '20fc03ad-256e-4933-a3b4-9f965bef79bf'
order by dashboard_key;
```

## 4) Smoke test app flows
- Sign in and load `/widgets`.
- Create/sync a new view and refresh.
- Run content edit + reorder flow and refresh.
- Rename/copy a view and verify persisted layout.
- Verify data isolation with second test user.

## 5) Rollback playbook
- If writes fail because of policy mismatch:
  1. Temporarily disable RLS on the affected table.
  2. Restore or patch policies.
  3. Re-enable RLS.
- If migration fails preflight checks:
  - Fix reported rows (null/empty fields, negative position, duplicate position per dashboard) and rerun.

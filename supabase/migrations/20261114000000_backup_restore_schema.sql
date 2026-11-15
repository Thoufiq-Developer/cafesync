-- ==============================================================================
-- CafeSync / CafeLedger - Migration 20261114000000
-- Backup Log, Import Batches & Batch Tracking Schema
-- Idempotent with guards: safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BACKUP LOG TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.backup_log (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  scope text not null check (scope in ('all', 'brand')),
  brand_id uuid references public.brands(id) on delete cascade,
  date_range text,
  file_size bigint,
  row_counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.backup_log enable row level security;

-- Index for speedy listing in master / admin panels
create index if not exists idx_backup_log_created_at on public.backup_log (created_at desc);
create index if not exists idx_backup_log_brand_id on public.backup_log (brand_id, created_at desc);

-- ------------------------------------------------------------------------------
-- 2. IMPORT BATCHES TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  file_names text[] not null default '{}',
  mode text not null check (mode in ('add_only', 'add_update', 'legacy')),
  rows_added integer not null default 0,
  rows_updated integer not null default 0,
  status text not null default 'completed' check (status in ('completed', 'undone', 'failed')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.import_batches enable row level security;

create index if not exists idx_import_batches_created_at on public.import_batches (created_at desc);

-- ------------------------------------------------------------------------------
-- 3. IMPORT_BATCH_ID TRACKING COLUMNS ON CORE TABLES
-- ------------------------------------------------------------------------------
alter table public.transactions
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;

alter table public.items
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;

alter table public.shops
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;

alter table public.employees
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;

alter table public.assets
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;

alter table public.asset_service_logs
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;

alter table public.salary_records
  add column if not exists import_batch_id uuid references public.import_batches(id) on delete set null;

create index if not exists idx_transactions_import_batch on public.transactions (import_batch_id) where import_batch_id is not null;

-- ------------------------------------------------------------------------------
-- 4. RLS POLICIES FOR BACKUP_LOG & IMPORT_BATCHES
-- ------------------------------------------------------------------------------

-- BACKUP_LOG POLICIES
drop policy if exists "platform_admin_backup_log_all" on public.backup_log;
create policy "platform_admin_backup_log_all"
  on public.backup_log for all to authenticated
  using (public.auth_role() in ('master', 'platform_admin'))
  with check (public.auth_role() in ('master', 'platform_admin'));

drop policy if exists "brand_admin_backup_log_select" on public.backup_log;
create policy "brand_admin_backup_log_select"
  on public.backup_log for select to authenticated
  using (
    public.auth_role() in ('admin', 'brand_admin')
    and brand_id = public.auth_brand_id()
  );

drop policy if exists "brand_admin_backup_log_insert" on public.backup_log;
create policy "brand_admin_backup_log_insert"
  on public.backup_log for insert to authenticated
  with check (
    public.auth_role() in ('admin', 'brand_admin')
    and (brand_id is null or brand_id = public.auth_brand_id())
  );

-- IMPORT_BATCHES POLICIES
drop policy if exists "platform_admin_import_batches_all" on public.import_batches;
create policy "platform_admin_import_batches_all"
  on public.import_batches for all to authenticated
  using (public.auth_role() in ('master', 'platform_admin'))
  with check (public.auth_role() in ('master', 'platform_admin'));

drop policy if exists "brand_admin_import_batches_select" on public.import_batches;
create policy "brand_admin_import_batches_select"
  on public.import_batches for select to authenticated
  using (
    public.auth_role() in ('admin', 'brand_admin')
    and created_by = auth.uid()
  );

drop policy if exists "brand_admin_import_batches_insert" on public.import_batches;
create policy "brand_admin_import_batches_insert"
  on public.import_batches for insert to authenticated
  with check (
    public.auth_role() in ('admin', 'brand_admin')
    and created_by = auth.uid()
  );

-- ------------------------------------------------------------------------------
-- 5. PERMISSIONS & SCHEMA RELOAD
-- ------------------------------------------------------------------------------
grant all on public.backup_log to authenticated, service_role;
grant all on public.import_batches to authenticated, service_role;

notify pgrst, 'reload schema';


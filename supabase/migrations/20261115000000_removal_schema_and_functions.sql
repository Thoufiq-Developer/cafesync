-- ==============================================================================
-- CafeSync / CafeLedger - Migration 20261115000000
-- Removal Engine: removal_log, batch indexes, and master-only deletion RPCs
-- Idempotent with guards: safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. REMOVAL LOG TABLE & AUDIT LEDGER
-- ------------------------------------------------------------------------------
create table if not exists public.removal_log (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  scope text not null check (scope in ('undo_upload', 'remove_month', 'remove_shop', 'remove_brand')),
  brand_id uuid references public.brands(id) on delete set null,
  brand_name text,
  target_name text,
  details jsonb not null default '{}'::jsonb,
  counts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.removal_log enable row level security;

create index if not exists idx_removal_log_created_at on public.removal_log (created_at desc);
create index if not exists idx_removal_log_scope on public.removal_log (scope, created_at desc);
create index if not exists idx_removal_log_brand_id on public.removal_log (brand_id, created_at desc);

drop policy if exists "platform_admin_removal_log_all" on public.removal_log;
create policy "platform_admin_removal_log_all"
  on public.removal_log for all to authenticated
  using (public.auth_role() in ('master', 'platform_admin'))
  with check (public.auth_role() in ('master', 'platform_admin'));

grant all on public.removal_log to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. INDEXES FOR HIGH-PERFORMANCE IMPORT BATCH ROLLBACKS
-- ------------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.salary_records') is not null then
    create index if not exists idx_salary_records_import_batch on public.salary_records (import_batch_id) where import_batch_id is not null;
  end if;
  if to_regclass('public.items') is not null then
    create index if not exists idx_items_import_batch on public.items (import_batch_id) where import_batch_id is not null;
  end if;
  if to_regclass('public.shops') is not null then
    create index if not exists idx_shops_import_batch on public.shops (import_batch_id) where import_batch_id is not null;
  end if;
  if to_regclass('public.employees') is not null then
    create index if not exists idx_employees_import_batch on public.employees (import_batch_id) where import_batch_id is not null;
  end if;
  if to_regclass('public.assets') is not null then
    create index if not exists idx_assets_import_batch on public.assets (import_batch_id) where import_batch_id is not null;
  end if;
  if to_regclass('public.asset_service_logs') is not null then
    create index if not exists idx_asset_service_logs_import_batch on public.asset_service_logs (import_batch_id) where import_batch_id is not null;
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 3. PREVIEW RPC: PREVIEW UNDO IMPORT BATCH
-- ------------------------------------------------------------------------------
create or replace function public.rpc_preview_undo_batch(p_batch_id uuid)
returns jsonb as $$
declare
  v_res jsonb;
  v_batch record;
  c_txns integer := 0;
  c_salary integer := 0;
  c_items integer := 0;
  c_employees integer := 0;
  c_assets integer := 0;
  c_asset_logs integer := 0;
  c_shops integer := 0;
begin
  if not (public.auth_role() in ('master', 'platform_admin') or current_user in ('postgres', 'service_role')) then
    raise exception 'Unauthorized: Only platform_admin can preview removal.' using errcode = '42501';
  end if;

  select * into v_batch from public.import_batches where id = p_batch_id;
  if not found then
    raise exception 'Import batch % not found.', p_batch_id;
  end if;

  select count(*) into c_txns from public.transactions where import_batch_id = p_batch_id;
  select count(*) into c_salary from public.salary_records where import_batch_id = p_batch_id;
  select count(*) into c_items from public.items where import_batch_id = p_batch_id;
  select count(*) into c_employees from public.employees where import_batch_id = p_batch_id;
  select count(*) into c_assets from public.assets where import_batch_id = p_batch_id;
  select count(*) into c_asset_logs from public.asset_service_logs where import_batch_id = p_batch_id;
  select count(*) into c_shops from public.shops where import_batch_id = p_batch_id;

  v_res := jsonb_build_object(
    'batch_id', p_batch_id,
    'status', v_batch.status,
    'created_at', v_batch.created_at,
    'mode', v_batch.mode,
    'file_names', v_batch.file_names,
    'counts', jsonb_build_object(
      'transactions', c_txns,
      'salary_records', c_salary,
      'items', c_items,
      'employees', c_employees,
      'assets', c_assets,
      'asset_service_logs', c_asset_logs,
      'shops', c_shops,
      'total', (c_txns + c_salary + c_items + c_employees + c_assets + c_asset_logs + c_shops)
    )
  );

  return v_res;
end;
$$ language plpgsql security definer set search_path = public;

-- ------------------------------------------------------------------------------
-- 4. EXECUTE RPC: UNDO IMPORT BATCH (ONE TRANSACTION)
-- ------------------------------------------------------------------------------
create or replace function public.rpc_undo_import_batch(p_batch_id uuid)
returns jsonb as $$
declare
  v_batch record;
  c_txns integer := 0;
  c_salary integer := 0;
  c_items integer := 0;
  c_employees integer := 0;
  c_assets integer := 0;
  c_asset_logs integer := 0;
  c_shops integer := 0;
  r_rec record;
  v_counts jsonb;
begin
  if not (public.auth_role() in ('master', 'platform_admin') or current_user in ('postgres', 'service_role')) then
    raise exception 'Unauthorized: Only platform_admin can execute data rollback.' using errcode = '42501';
  end if;

  select * into v_batch from public.import_batches where id = p_batch_id;
  if not found then
    raise exception 'Import batch % not found.', p_batch_id;
  end if;

  if v_batch.status = 'undone' then
    raise exception 'Import batch % has already been undone.', p_batch_id;
  end if;

  -- 1. Identify affected dates, shops, and employees before deleting transactions
  create temp table _tmp_affected_txns on commit drop as
    select distinct shop_id, txn_date, employee_id, to_char(txn_date, 'YYYY-MM') as month
    from public.transactions
    where import_batch_id = p_batch_id;

  -- 2. Reverse dependency deletion:
  -- A. Salary records
  with del as (
    delete from public.salary_records where import_batch_id = p_batch_id returning id
  ) select count(*) into c_salary from del;

  -- B. Transactions
  with del as (
    delete from public.transactions where import_batch_id = p_batch_id returning id
  ) select count(*) into c_txns from del;

  -- C. Asset service logs
  with del as (
    delete from public.asset_service_logs where import_batch_id = p_batch_id returning id
  ) select count(*) into c_asset_logs from del;

  -- D. Assets
  with del as (
    delete from public.assets where import_batch_id = p_batch_id returning id
  ) select count(*) into c_assets from del;

  -- E. Employees
  with del as (
    delete from public.employees where import_batch_id = p_batch_id returning id
  ) select count(*) into c_employees from del;

  -- F. Items
  with del as (
    delete from public.items where import_batch_id = p_batch_id returning id
  ) select count(*) into c_items from del;

  -- G. Shops
  with del as (
    delete from public.shops where import_batch_id = p_batch_id returning id
  ) select count(*) into c_shops from del;

  -- 3. Post-deletion recomputations
  for r_rec in select distinct shop_id, txn_date from _tmp_affected_txns loop
    perform public.recalculate_shop_daily_summary(r_rec.shop_id, r_rec.txn_date);
  end loop;

  for r_rec in select distinct shop_id, employee_id, month from _tmp_affected_txns where employee_id is not null loop
    perform public.recalculate_salary_record(r_rec.shop_id, r_rec.employee_id, r_rec.month);
  end loop;

  for r_rec in select distinct shop_id, month from _tmp_affected_txns loop
    perform public.ensure_month_opening(r_rec.shop_id, r_rec.month);
  end loop;

  -- 4. Mark batch as undone
  update public.import_batches
  set status = 'undone'
  where id = p_batch_id;

  v_counts := jsonb_build_object(
    'transactions', c_txns,
    'salary_records', c_salary,
    'items', c_items,
    'employees', c_employees,
    'assets', c_assets,
    'asset_service_logs', c_asset_logs,
    'shops', c_shops,
    'total', (c_txns + c_salary + c_items + c_employees + c_assets + c_asset_logs + c_shops)
  );

  -- 5. Record removal_log and audit_log
  insert into public.removal_log (
    created_by, scope, brand_name, target_name, details, counts
  ) values (
    auth.uid(), 'undo_upload', 'All Brands', 'Batch ' || p_batch_id::text,
    jsonb_build_object('batch_id', p_batch_id, 'file_names', v_batch.file_names),
    v_counts
  );

  insert into public.audit_log (
    user_id, action, table_name, record_id, new_data
  ) values (
    auth.uid(), 'UNDO_IMPORT_BATCH', 'import_batches', p_batch_id::text,
    jsonb_build_object('batch_id', p_batch_id, 'deleted_counts', v_counts)
  );

  return jsonb_build_object(
    'success', true,
    'batch_id', p_batch_id,
    'counts', v_counts
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ------------------------------------------------------------------------------
-- 5. PREVIEW RPC: REMOVE MONTH DATA
-- ------------------------------------------------------------------------------
create or replace function public.rpc_preview_remove_month(
  p_brand_id uuid,
  p_shop_id uuid default null,
  p_start_date date default null,
  p_end_date date default null
)
returns jsonb as $$
declare
  v_brand record;
  v_shop_name text := 'All Outlets';
  c_txns integer := 0;
  c_salary integer := 0;
  v_start_month text := to_char(p_start_date, 'YYYY-MM');
  v_end_month text := to_char(p_end_date, 'YYYY-MM');
begin
  if not (public.auth_role() in ('master', 'platform_admin') or current_user in ('postgres', 'service_role')) then
    raise exception 'Unauthorized: Only platform_admin can preview removal.' using errcode = '42501';
  end if;

  select * into v_brand from public.brands where id = p_brand_id;
  if not found then
    raise exception 'Brand % not found.', p_brand_id;
  end if;

  if p_shop_id is not null then
    select name into v_shop_name from public.shops where id = p_shop_id and brand_id = p_brand_id;
    if not found then
      raise exception 'Shop % not found in brand %.', p_shop_id, p_brand_id;
    end if;
  end if;

  select count(*) into c_txns
  from public.transactions
  where brand_id = p_brand_id
    and (p_shop_id is null or shop_id = p_shop_id)
    and (p_start_date is null or txn_date >= p_start_date)
    and (p_end_date is null or txn_date <= p_end_date);

  select count(*) into c_salary
  from public.salary_records sr
  inner join public.shops s on s.id = sr.shop_id
  where s.brand_id = p_brand_id
    and (p_shop_id is null or sr.shop_id = p_shop_id)
    and (p_start_date is null or sr.month >= v_start_month)
    and (p_end_date is null or sr.month <= v_end_month);

  return jsonb_build_object(
    'brand_id', p_brand_id,
    'brand_name', v_brand.name,
    'shop_id', p_shop_id,
    'shop_name', v_shop_name,
    'start_date', p_start_date,
    'end_date', p_end_date,
    'counts', jsonb_build_object(
      'transactions', c_txns,
      'salary_records', c_salary,
      'total', (c_txns + c_salary)
    )
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ------------------------------------------------------------------------------
-- 6. EXECUTE RPC: REMOVE MONTH DATA (ONE TRANSACTION)
-- ------------------------------------------------------------------------------
create or replace function public.rpc_remove_month_data(
  p_brand_id uuid,
  p_shop_id uuid default null,
  p_start_date date default null,
  p_end_date date default null
)
returns jsonb as $$
declare
  v_brand record;
  v_shop_name text := 'All Outlets';
  c_txns integer := 0;
  c_salary integer := 0;
  v_start_month text := to_char(p_start_date, 'YYYY-MM');
  v_end_month text := to_char(p_end_date, 'YYYY-MM');
  r_rec record;
  v_counts jsonb;
begin
  if not (public.auth_role() in ('master', 'platform_admin') or current_user in ('postgres', 'service_role')) then
    raise exception 'Unauthorized: Only platform_admin can remove month data.' using errcode = '42501';
  end if;

  select * into v_brand from public.brands where id = p_brand_id;
  if not found then
    raise exception 'Brand % not found.', p_brand_id;
  end if;

  if p_shop_id is not null then
    select name into v_shop_name from public.shops where id = p_shop_id and brand_id = p_brand_id;
  end if;

  -- 1. Identify affected shops and dates
  create temp table _tmp_month_shops on commit drop as
    select distinct shop_id, txn_date
    from public.transactions
    where brand_id = p_brand_id
      and (p_shop_id is null or shop_id = p_shop_id)
      and (p_start_date is null or txn_date >= p_start_date)
      and (p_end_date is null or txn_date <= p_end_date);

  -- 2. Delete salary records
  with del as (
    delete from public.salary_records sr
    using public.shops s
    where s.id = sr.shop_id
      and s.brand_id = p_brand_id
      and (p_shop_id is null or sr.shop_id = p_shop_id)
      and (p_start_date is null or sr.month >= v_start_month)
      and (p_end_date is null or sr.month <= v_end_month)
    returning sr.id
  ) select count(*) into c_salary from del;

  -- 3. Delete transactions
  with del as (
    delete from public.transactions
    where brand_id = p_brand_id
      and (p_shop_id is null or shop_id = p_shop_id)
      and (p_start_date is null or txn_date >= p_start_date)
      and (p_end_date is null or txn_date <= p_end_date)
    returning id
  ) select count(*) into c_txns from del;

  -- 4. Delete daily_summary in deleted date range
  delete from public.daily_summary ds
  using public.shops s
  where s.id = ds.shop_id
    and s.brand_id = p_brand_id
    and (p_shop_id is null or ds.shop_id = p_shop_id)
    and (p_start_date is null or ds.summary_date >= p_start_date)
    and (p_end_date is null or ds.summary_date <= p_end_date);

  -- 5. Recompute opening balances for following months
  for r_rec in select distinct id as s_id from public.shops where brand_id = p_brand_id and (p_shop_id is null or id = p_shop_id) loop
    perform public.ensure_month_opening(r_rec.s_id, v_end_month);
  end loop;

  v_counts := jsonb_build_object(
    'transactions', c_txns,
    'salary_records', c_salary,
    'total', (c_txns + c_salary)
  );

  -- 6. Log removal
  insert into public.removal_log (
    created_by, scope, brand_id, brand_name, target_name, details, counts
  ) values (
    auth.uid(), 'remove_month', p_brand_id, v_brand.name,
    v_shop_name || ' (' || v_start_month || ' to ' || v_end_month || ')',
    jsonb_build_object('shop_id', p_shop_id, 'start_date', p_start_date, 'end_date', p_end_date),
    v_counts
  );

  insert into public.audit_log (
    user_id, action, table_name, record_id, new_data
  ) values (
    auth.uid(), 'REMOVE_MONTH_DATA', 'transactions', coalesce(p_shop_id::text, p_brand_id::text),
    jsonb_build_object('brand_id', p_brand_id, 'start', p_start_date, 'end', p_end_date, 'deleted', v_counts)
  );

  return jsonb_build_object(
    'success', true,
    'brand_id', p_brand_id,
    'counts', v_counts
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ------------------------------------------------------------------------------
-- 7. PREVIEW RPC: REMOVE SHOP DATA
-- ------------------------------------------------------------------------------
create or replace function public.rpc_preview_remove_shop(p_shop_id uuid)
returns jsonb as $$
declare
  v_shop record;
  v_brand record;
  c_txns integer := 0;
  c_salary integer := 0;
  c_employees integer := 0;
  c_assets integer := 0;
  c_asset_logs integer := 0;
  c_daily integer := 0;
  c_openings integer := 0;
  c_managers integer := 0;
begin
  if not (public.auth_role() in ('master', 'platform_admin') or current_user in ('postgres', 'service_role')) then
    raise exception 'Unauthorized: Only platform_admin can preview removal.' using errcode = '42501';
  end if;

  select * into v_shop from public.shops where id = p_shop_id;
  if not found then
    raise exception 'Shop % not found.', p_shop_id;
  end if;

  select * into v_brand from public.brands where id = v_shop.brand_id;

  select count(*) into c_txns from public.transactions where shop_id = p_shop_id;
  select count(*) into c_salary from public.salary_records where shop_id = p_shop_id;
  select count(*) into c_employees from public.employees where shop_id = p_shop_id;
  select count(*) into c_assets from public.assets where shop_id = p_shop_id;
  select count(*) into c_asset_logs from public.asset_service_logs where asset_id in (select id from public.assets where shop_id = p_shop_id);
  select count(*) into c_daily from public.daily_summary where shop_id = p_shop_id;
  select count(*) into c_openings from public.month_openings where shop_id = p_shop_id;
  select count(*) into c_managers from public.profiles where shop_id = p_shop_id and role in ('manager', 'shop_manager');

  return jsonb_build_object(
    'shop_id', p_shop_id,
    'shop_name', v_shop.name,
    'shop_code', v_shop.code,
    'brand_id', v_shop.brand_id,
    'brand_name', v_brand.name,
    'counts', jsonb_build_object(
      'transactions', c_txns,
      'salary_records', c_salary,
      'employees', c_employees,
      'assets', c_assets,
      'asset_service_logs', c_asset_logs,
      'daily_summary', c_daily,
      'month_openings', c_openings,
      'managers_count', c_managers,
      'total', (c_txns + c_salary + c_employees + c_assets + c_asset_logs + c_daily + c_openings)
    )
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ------------------------------------------------------------------------------
-- 8. EXECUTE RPC: REMOVE SHOP DATA (ONE TRANSACTION)
-- ------------------------------------------------------------------------------
create or replace function public.rpc_remove_shop_data(p_shop_id uuid)
returns jsonb as $$
declare
  v_shop record;
  v_brand record;
  c_txns integer := 0;
  c_salary integer := 0;
  c_employees integer := 0;
  c_assets integer := 0;
  c_asset_logs integer := 0;
  c_daily integer := 0;
  c_openings integer := 0;
  v_managers uuid[];
  v_counts jsonb;
begin
  if not (public.auth_role() in ('master', 'platform_admin') or current_user in ('postgres', 'service_role')) then
    raise exception 'Unauthorized: Only platform_admin can remove shop data.' using errcode = '42501';
  end if;

  select * into v_shop from public.shops where id = p_shop_id;
  if not found then
    raise exception 'Shop % not found.', p_shop_id;
  end if;

  select * into v_brand from public.brands where id = v_shop.brand_id;

  -- Collect manager user IDs for auth user deletion
  select array_agg(id) into v_managers
  from public.profiles
  where shop_id = p_shop_id and role in ('manager', 'shop_manager');

  -- 1. Reverse dependency deletion:
  -- A. Salary records
  with del as (delete from public.salary_records where shop_id = p_shop_id returning id)
  select count(*) into c_salary from del;

  -- B. Transactions
  with del as (delete from public.transactions where shop_id = p_shop_id returning id)
  select count(*) into c_txns from del;

  -- C. Daily Summary
  with del as (delete from public.daily_summary where shop_id = p_shop_id returning id)
  select count(*) into c_daily from del;

  -- D. Month Openings
  with del as (delete from public.month_openings where shop_id = p_shop_id returning id)
  select count(*) into c_openings from del;

  -- E. Asset service logs
  with del as (
    delete from public.asset_service_logs
    where asset_id in (select id from public.assets where shop_id = p_shop_id)
    returning id
  ) select count(*) into c_asset_logs from del;

  -- F. Assets
  with del as (delete from public.assets where shop_id = p_shop_id returning id)
  select count(*) into c_assets from del;

  -- G. Employees
  with del as (delete from public.employees where shop_id = p_shop_id returning id)
  select count(*) into c_employees from del;

  -- H. Shop items
  delete from public.items where shop_id = p_shop_id;

  -- I. Profiles (shop managers)
  delete from public.profiles where shop_id = p_shop_id;

  -- J. The Shop itself
  delete from public.shops where id = p_shop_id;

  v_counts := jsonb_build_object(
    'transactions', c_txns,
    'salary_records', c_salary,
    'employees', c_employees,
    'assets', c_assets,
    'asset_service_logs', c_asset_logs,
    'daily_summary', c_daily,
    'month_openings', c_openings,
    'shops', 1,
    'total', (c_txns + c_salary + c_employees + c_assets + c_asset_logs + c_daily + c_openings + 1)
  );

  -- 2. Log removal
  insert into public.removal_log (
    created_by, scope, brand_id, brand_name, target_name, details, counts
  ) values (
    auth.uid(), 'remove_shop', v_shop.brand_id, v_brand.name,
    v_shop.name || ' (' || v_shop.code || ')',
    jsonb_build_object('shop_id', p_shop_id, 'manager_ids', coalesce(v_managers, '{}'::uuid[])),
    v_counts
  );

  insert into public.audit_log (
    user_id, action, table_name, record_id, new_data
  ) values (
    auth.uid(), 'REMOVE_SHOP', 'shops', p_shop_id::text,
    jsonb_build_object('shop_id', p_shop_id, 'brand_id', v_shop.brand_id, 'deleted_counts', v_counts)
  );

  return jsonb_build_object(
    'success', true,
    'shop_id', p_shop_id,
    'manager_user_ids', coalesce(v_managers, '{}'::uuid[]),
    'counts', v_counts
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ------------------------------------------------------------------------------
-- 9. PREVIEW RPC: REMOVE WHOLE BRAND
-- ------------------------------------------------------------------------------
create or replace function public.rpc_preview_remove_brand(p_brand_id uuid)
returns jsonb as $$
declare
  v_brand record;
  c_shops integer := 0;
  c_txns integer := 0;
  c_salary integer := 0;
  c_items integer := 0;
  c_employees integer := 0;
  c_assets integer := 0;
  c_payment_modes integer := 0;
  c_profiles integer := 0;
begin
  if not (public.auth_role() in ('master', 'platform_admin') or current_user in ('postgres', 'service_role')) then
    raise exception 'Unauthorized: Only platform_admin can preview removal.' using errcode = '42501';
  end if;

  select * into v_brand from public.brands where id = p_brand_id;
  if not found then
    raise exception 'Brand % not found.', p_brand_id;
  end if;

  select count(*) into c_shops from public.shops where brand_id = p_brand_id;
  select count(*) into c_txns from public.transactions where brand_id = p_brand_id;
  select count(*) into c_salary
  from public.salary_records sr
  inner join public.shops s on s.id = sr.shop_id
  where s.brand_id = p_brand_id;
  select count(*) into c_items from public.items where brand_id = p_brand_id;
  select count(*) into c_employees from public.employees where brand_id = p_brand_id;
  select count(*) into c_assets from public.assets where brand_id = p_brand_id;
  select count(*) into c_payment_modes from public.payment_modes where brand_id = p_brand_id;
  select count(*) into c_profiles from public.profiles where brand_id = p_brand_id;

  return jsonb_build_object(
    'brand_id', p_brand_id,
    'brand_name', v_brand.name,
    'brand_slug', v_brand.slug,
    'counts', jsonb_build_object(
      'shops', c_shops,
      'transactions', c_txns,
      'salary_records', c_salary,
      'items', c_items,
      'employees', c_employees,
      'assets', c_assets,
      'payment_modes', c_payment_modes,
      'profiles', c_profiles,
      'total', (c_shops + c_txns + c_salary + c_items + c_employees + c_assets + c_payment_modes + c_profiles)
    )
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ------------------------------------------------------------------------------
-- 10. EXECUTE RPC: REMOVE WHOLE BRAND (ONE TRANSACTION)
-- ------------------------------------------------------------------------------
create or replace function public.rpc_remove_brand_data(p_brand_id uuid)
returns jsonb as $$
declare
  v_brand record;
  c_shops integer := 0;
  c_txns integer := 0;
  c_salary integer := 0;
  c_items integer := 0;
  c_employees integer := 0;
  c_assets integer := 0;
  c_asset_logs integer := 0;
  c_modes integer := 0;
  c_daily integer := 0;
  c_openings integer := 0;
  v_user_ids uuid[];
  v_counts jsonb;
begin
  if not (public.auth_role() in ('master', 'platform_admin') or current_user in ('postgres', 'service_role')) then
    raise exception 'Unauthorized: Only platform_admin can remove a brand.' using errcode = '42501';
  end if;

  select * into v_brand from public.brands where id = p_brand_id;
  if not found then
    raise exception 'Brand % not found.', p_brand_id;
  end if;

  -- Collect all brand user IDs (admins & managers) for auth deletion
  select array_agg(id) into v_user_ids
  from public.profiles
  where brand_id = p_brand_id;

  -- Reverse dependency deletion:
  -- A. Salary records
  with del as (
    delete from public.salary_records sr
    using public.shops s
    where s.id = sr.shop_id and s.brand_id = p_brand_id
    returning sr.id
  ) select count(*) into c_salary from del;

  -- B. Transactions
  with del as (delete from public.transactions where brand_id = p_brand_id returning id)
  select count(*) into c_txns from del;

  -- C. Daily Summary
  with del as (
    delete from public.daily_summary ds
    using public.shops s
    where s.id = ds.shop_id and s.brand_id = p_brand_id
    returning ds.id
  ) select count(*) into c_daily from del;

  -- D. Month Openings
  with del as (
    delete from public.month_openings mo
    using public.shops s
    where s.id = mo.shop_id and s.brand_id = p_brand_id
    returning mo.id
  ) select count(*) into c_openings from del;

  -- E. Asset service logs
  with del as (
    delete from public.asset_service_logs
    where asset_id in (select id from public.assets where brand_id = p_brand_id)
    returning id
  ) select count(*) into c_asset_logs from del;

  -- F. Assets
  with del as (delete from public.assets where brand_id = p_brand_id returning id)
  select count(*) into c_assets from del;

  -- G. Employees
  with del as (delete from public.employees where brand_id = p_brand_id returning id)
  select count(*) into c_employees from del;

  -- H. Items
  with del as (delete from public.items where brand_id = p_brand_id returning id)
  select count(*) into c_items from del;

  -- I. Payment modes
  with del as (delete from public.payment_modes where brand_id = p_brand_id returning id)
  select count(*) into c_modes from del;

  -- J. Shops
  with del as (delete from public.shops where brand_id = p_brand_id returning id)
  select count(*) into c_shops from del;

  -- K. Brand Settings
  delete from public.brand_settings where brand_id = p_brand_id;

  -- L. Backup log records for this brand
  delete from public.backup_log where brand_id = p_brand_id;

  -- M. Profiles
  delete from public.profiles where brand_id = p_brand_id;

  -- N. The Brand itself
  delete from public.brands where id = p_brand_id;

  v_counts := jsonb_build_object(
    'brands', 1,
    'shops', c_shops,
    'transactions', c_txns,
    'salary_records', c_salary,
    'items', c_items,
    'employees', c_employees,
    'assets', c_assets,
    'asset_service_logs', c_asset_logs,
    'payment_modes', c_modes,
    'daily_summary', c_daily,
    'month_openings', c_openings,
    'users_count', coalesce(array_length(v_user_ids, 1), 0),
    'total', (1 + c_shops + c_txns + c_salary + c_items + c_employees + c_assets + c_asset_logs + c_modes + c_daily + c_openings)
  );

  -- Log removal
  insert into public.removal_log (
    created_by, scope, brand_name, target_name, details, counts
  ) values (
    auth.uid(), 'remove_brand', v_brand.name,
    v_brand.name || ' (' || v_brand.slug || ')',
    jsonb_build_object('brand_id', p_brand_id, 'slug', v_brand.slug, 'user_ids', coalesce(v_user_ids, '{}'::uuid[])),
    v_counts
  );

  insert into public.audit_log (
    user_id, action, table_name, record_id, new_data
  ) values (
    auth.uid(), 'REMOVE_BRAND', 'brands', p_brand_id::text,
    jsonb_build_object('brand_id', p_brand_id, 'deleted_counts', v_counts)
  );

  return jsonb_build_object(
    'success', true,
    'brand_id', p_brand_id,
    'brand_slug', v_brand.slug,
    'user_ids', coalesce(v_user_ids, '{}'::uuid[]),
    'counts', v_counts
  );
end;
$$ language plpgsql security definer set search_path = public;

-- ------------------------------------------------------------------------------
-- 11. GRANT PERMISSIONS & RELOAD SCHEMA CACHE
-- ------------------------------------------------------------------------------
grant execute on function public.rpc_preview_undo_batch(uuid) to authenticated, service_role;
grant execute on function public.rpc_undo_import_batch(uuid) to authenticated, service_role;
grant execute on function public.rpc_preview_remove_month(uuid, uuid, date, date) to authenticated, service_role;
grant execute on function public.rpc_remove_month_data(uuid, uuid, date, date) to authenticated, service_role;
grant execute on function public.rpc_preview_remove_shop(uuid) to authenticated, service_role;
grant execute on function public.rpc_remove_shop_data(uuid) to authenticated, service_role;
grant execute on function public.rpc_preview_remove_brand(uuid) to authenticated, service_role;
grant execute on function public.rpc_remove_brand_data(uuid) to authenticated, service_role;

notify pgrst, 'reload schema';


-- ==============================================================================
-- CafeSync / CafeLedger - Migration 20261113000000
-- Database Hardening: Closed-Month Lock, Manager Edit Window,
-- Unique Item Names, Platform Admin Universal RLS, and Storage Policies
-- Idempotent with guards: safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 0. ROLE & COLUMN COMPATIBILITY GUARDS
-- ------------------------------------------------------------------------------

-- Allow both legacy ('master', 'admin', 'manager') and modern ('platform_admin', 'brand_admin', 'shop_manager')
alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('master', 'admin', 'manager', 'platform_admin', 'brand_admin', 'shop_manager'));

-- Helper: auth_role() supporting both role naming styles
create or replace function public.auth_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- Provide auth.user_role() if permitted in the environment
do $$
begin
  begin
    execute 'create or replace function auth.user_role() returns text as $f$ select role from public.profiles where id = auth.uid(); $f$ language sql stable security definer set search_path = public;';
  exception when others then
    null;
  end;
end $$;

-- Support both column naming conventions:
-- month_openings.year_month (alias of month)
alter table public.month_openings
  add column if not exists year_month text;

update public.month_openings
  set year_month = month
  where year_month is null or year_month <> month;

-- Keep month and year_month synchronized
create or replace function public.sync_month_openings_month()
returns trigger as $$
begin
  if new.month is null and new.year_month is not null then
    new.month := new.year_month;
  elsif new.year_month is null and new.month is not null then
    new.year_month := new.month;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_month_openings_month on public.month_openings;
create trigger trg_sync_month_openings_month
  before insert or update on public.month_openings
  for each row execute function public.sync_month_openings_month();

-- transactions.transaction_date (alias of txn_date)
alter table public.transactions
  add column if not exists transaction_date date;

update public.transactions
  set transaction_date = txn_date
  where transaction_date is null or transaction_date <> txn_date;

create or replace function public.sync_transactions_date()
returns trigger as $$
begin
  if new.txn_date is null and new.transaction_date is not null then
    new.txn_date := new.transaction_date;
  elsif new.transaction_date is null and new.txn_date is not null then
    new.transaction_date := new.txn_date;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_transactions_date on public.transactions;
create trigger trg_sync_transactions_date
  before insert or update on public.transactions
  for each row execute function public.sync_transactions_date();

-- ------------------------------------------------------------------------------
-- 1. BEFORE INSERT/UPDATE/DELETE TRIGGER ON TRANSACTIONS
--    a. Closed-month lock: reject changes when month_openings.closed_at is set.
--       Checks OLD and NEW dates on updates & soft deletes.
--    b. Shop manager edit window: maximum 2 days past, never in the future.
--    c. Plain-language error messages.
--    d. platform_admin / service_role skips both rules.
--       brand_admin subject to closed month, exempt from 2-day window.
--       shop_manager subject to both rules.
-- ------------------------------------------------------------------------------

create or replace function public.check_transaction_locks()
returns trigger as $$
declare
  v_jwt_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_user_id uuid := auth.uid();
  v_role text := null;
  v_today date := current_date;
  v_is_closed boolean := false;
  v_check_date date;
  v_check_month text;
  v_check_shop uuid;
begin
  -- 1. Service role (backend scripts/cron) bypasses all locks
  if v_jwt_role = 'service_role' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  -- 2. Resolve role of the current user
  if v_user_id is not null then
    select role into v_role from public.profiles where id = v_user_id;
  end if;

  -- 3. platform_admin / master bypasses all locks
  if v_role in ('platform_admin', 'master') then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;

  -- 4. RULE A: Closed-Month Lock
  -- Check OLD date / shop on UPDATE and DELETE
  if tg_op in ('UPDATE', 'DELETE') then
    v_check_date := old.txn_date;
    v_check_shop := old.shop_id;
    v_check_month := to_char(old.txn_date, 'YYYY-MM');

    select exists (
      select 1 from public.month_openings
      where shop_id = v_check_shop
        and (month = v_check_month or year_month = v_check_month)
        and closed_at is not null
    ) into v_is_closed;

    if v_is_closed then
      if tg_op = 'DELETE' then
        raise exception 'This month is closed. Entries cannot be deleted.';
      else
        raise exception 'This month is closed. Entries cannot be changed.';
      end if;
    end if;
  end if;

  -- Check NEW date / shop on INSERT and UPDATE
  if tg_op in ('INSERT', 'UPDATE') then
    v_check_shop := new.shop_id;
    v_check_month := to_char(new.txn_date, 'YYYY-MM');

    select exists (
      select 1 from public.month_openings
      where shop_id = v_check_shop
        and (month = v_check_month or year_month = v_check_month)
        and closed_at is not null
    ) into v_is_closed;

    if v_is_closed then
      raise exception 'This month is closed. Entries cannot be changed.';
    end if;
  end if;

  -- 5. RULE B: Shop Manager Edit Window (2-Day Window & No Future Dates)
  -- Applies strictly to shop_manager / manager role
  if v_role in ('shop_manager', 'manager') then
    if tg_op = 'INSERT' then
      if new.txn_date > v_today then
        raise exception 'Transaction date cannot be in the future.';
      end if;
      if (v_today - new.txn_date) > 2 then
        raise exception 'Transactions older than 2 days are locked and can only be modified by a Brand Admin.';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.txn_date > v_today then
        raise exception 'Transaction date cannot be in the future.';
      end if;
      if (v_today - old.txn_date) > 2 or (v_today - new.txn_date) > 2 then
        raise exception 'Transactions older than 2 days are locked and can only be modified by a Brand Admin.';
      end if;
    elsif tg_op = 'DELETE' then
      if (v_today - old.txn_date) > 2 then
        raise exception 'Transactions older than 2 days are locked and can only be deleted by a Brand Admin.';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_check_transaction_locks on public.transactions;
create trigger trg_check_transaction_locks
  before insert or update or delete on public.transactions
  for each row execute function public.check_transaction_locks();

-- ------------------------------------------------------------------------------
-- 2. UNIQUE INDEX ON ITEMS (Brand scope, Shop scope, Lowercased Name)
-- ------------------------------------------------------------------------------
create unique index if not exists uq_items_brand_shop_name
  on public.items (
    brand_id,
    coalesce(shop_id, '00000000-0000-0000-0000-000000000000'::uuid),
    lower(trim(name))
  );

-- ------------------------------------------------------------------------------
-- 3. PLATFORM_ADMIN UNIVERSAL RLS POLICIES (All Core Tables + Audit Log + Storage)
-- ------------------------------------------------------------------------------

-- Core tables universal policy with table-existence guard
do $$
declare
  t text;
  tables text[] := array[
    'payment_modes', 'items', 'employees', 'shops',
    'transactions', 'daily_summary', 'month_openings', 'salary_records',
    'assets', 'asset_service_logs', 'brand_settings', 'profiles', 'brands'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists "platform_admin_%s_all" on public.%I', t, t);
      execute format('create policy "platform_admin_%s_all" on public.%I for all to authenticated using (public.auth_role() in (''master'', ''platform_admin'')) with check (public.auth_role() in (''master'', ''platform_admin''))', t, t);
    end if;
  end loop;
end $$;

-- Audit Log (Read-only for Platform Admin)
do $$
begin
  if to_regclass('public.audit_log') is not null then
    execute 'drop policy if exists "platform_admin_audit_log_select" on public.audit_log';
    execute 'create policy "platform_admin_audit_log_select" on public.audit_log for select to authenticated using (public.auth_role() in (''master'', ''platform_admin''))';
  end if;
end $$;

-- Storage Bucket: brand-assets
do $$
begin
  if to_regclass('storage.objects') is not null then
    execute 'drop policy if exists "platform_admin_storage_brand_assets_all" on storage.objects';
    execute 'create policy "platform_admin_storage_brand_assets_all" on storage.objects for all to authenticated using (bucket_id = ''brand-assets'' and public.auth_role() in (''master'', ''platform_admin'')) with check (bucket_id = ''brand-assets'' and public.auth_role() in (''master'', ''platform_admin''))';
  end if;
exception when others then
  null;
end $$;

-- ------------------------------------------------------------------------------
-- 4. PERMISSIONS & SCHEMA RELOAD
-- ------------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated, service_role;

-- Flush PostgREST schema cache
notify pgrst, 'reload schema';

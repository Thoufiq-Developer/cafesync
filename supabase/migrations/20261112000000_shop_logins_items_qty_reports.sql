-- ==============================================================================
-- CafeLedger - Migration 20261112000000
-- Shop Logins (Usernames), Bidirectional Items with Units,
-- Transaction Quantity/Rate, Item-wise Summary & Progress Series RPCs
-- Strictly additive & idempotent: preserves all existing data.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. PROFILES: username + per-user activity read cursor
-- ------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists username text;

alter table public.profiles
  add column if not exists activity_read_at timestamptz;

create unique index if not exists idx_profiles_brand_username
  on public.profiles(brand_id, lower(trim(username)))
  where username is not null and trim(username) <> '' and brand_id is not null;

-- ------------------------------------------------------------------------------
-- 2. ITEMS: shop scope (nullable = brand-wide), creator, unit, default_rate
-- ------------------------------------------------------------------------------
alter table public.items
  add column if not exists shop_id uuid references public.shops(id) on delete cascade;

alter table public.items
  add column if not exists created_by uuid references auth.users(id) on delete set null;

alter table public.items
  add column if not exists unit text not null default 'pcs';

alter table public.items
  drop constraint if exists items_unit_check;

alter table public.items
  add constraint items_unit_check
  check (unit in ('L', 'kg', 'g', 'ml', 'pcs', 'packet', 'dozen', 'box', 'other'));

alter table public.items
  add column if not exists default_rate numeric(12,2);

create index if not exists idx_items_brand_shop_active
  on public.items(brand_id, shop_id, is_active);

create index if not exists idx_items_brand_lower_name
  on public.items(brand_id, lower(trim(name)));

-- Replace overly broad "Items access policy" with role-scoped policies
drop policy if exists "Items access policy" on public.items;
drop policy if exists "Items select policy" on public.items;
drop policy if exists "Items insert policy" on public.items;
drop policy if exists "Items update policy" on public.items;
drop policy if exists "Items delete policy" on public.items;

create policy "Items select policy"
  on public.items for select to authenticated
  using (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin' and brand_id = public.auth_brand_id())
    or (
      public.auth_role() = 'manager'
      and brand_id = public.auth_brand_id()
      and (shop_id is null or shop_id = public.auth_shop_id())
    )
  );

create policy "Items insert policy"
  on public.items for insert to authenticated
  with check (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin' and brand_id = public.auth_brand_id())
    or (
      public.auth_role() = 'manager'
      and brand_id = public.auth_brand_id()
      and shop_id = public.auth_shop_id()
    )
  );

create policy "Items update policy"
  on public.items for update to authenticated
  using (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin' and brand_id = public.auth_brand_id())
    or (
      public.auth_role() = 'manager'
      and brand_id = public.auth_brand_id()
      and shop_id = public.auth_shop_id()
    )
  )
  with check (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin' and brand_id = public.auth_brand_id())
    or (
      public.auth_role() = 'manager'
      and brand_id = public.auth_brand_id()
      and shop_id = public.auth_shop_id()
    )
  );

create policy "Items delete policy"
  on public.items for delete to authenticated
  using (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin' and brand_id = public.auth_brand_id())
    or (
      public.auth_role() = 'manager'
      and brand_id = public.auth_brand_id()
      and shop_id = public.auth_shop_id()
    )
  );

-- ------------------------------------------------------------------------------
-- 3. TRANSACTIONS: quantity, unit_snapshot, rate
-- ------------------------------------------------------------------------------
alter table public.transactions
  add column if not exists quantity numeric(12,3);

alter table public.transactions
  add column if not exists unit_snapshot text;

alter table public.transactions
  add column if not exists rate numeric(12,2);

alter table public.transactions
  drop constraint if exists transactions_quantity_check;

alter table public.transactions
  add constraint transactions_quantity_check
  check (quantity is null or quantity > 0);

create index if not exists idx_transactions_item_summary
  on public.transactions(brand_id, shop_id, txn_date, kind)
  where not is_deleted;

create or replace function public.compute_transaction_rate()
returns trigger as $$
begin
  if new.quantity is not null and new.quantity > 0 then
    new.rate := round((new.amount / new.quantity)::numeric, 2);
  else
    new.rate := null;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_compute_transaction_rate on public.transactions;
create trigger trg_compute_transaction_rate
  before insert or update on public.transactions
  for each row execute function public.compute_transaction_rate();

-- ------------------------------------------------------------------------------
-- 4. RPC: Item-wise Summary Report (SQL GROUP BY item + unit)
-- ------------------------------------------------------------------------------
create or replace function public.get_item_wise_summary(
  p_brand_id uuid,
  p_shop_id uuid default null,
  p_start date default null,
  p_end date default null,
  p_kind text default 'expense',
  p_category text default null,
  p_search text default null
)
returns table (
  item_key text,
  item_id uuid,
  item_name text,
  kind text,
  category text,
  unit text,
  total_quantity numeric(14,3),
  quantified_amount numeric(14,2),
  total_amount numeric(14,2),
  purchase_count bigint,
  qty_entry_count bigint,
  avg_rate numeric(12,2)
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_jwt_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_role text := public.auth_role();
  v_brand uuid := public.auth_brand_id();
  v_shop uuid := public.auth_shop_id();
begin
  if v_jwt_role <> 'service_role' then
    if v_role = 'master' then
      null;
    elsif v_role = 'admin' and p_brand_id = v_brand then
      null;
    elsif v_role = 'manager' and p_brand_id = v_brand and p_shop_id is not null and p_shop_id = v_shop then
      null;
    else
      raise exception 'Unauthorized';
    end if;
  end if;

  return query
  with base as (
    select
      coalesce(t.item_id::text, 'name:' || lower(trim(t.item_name_snapshot))) as grp_item_key,
      t.item_id as row_item_id,
      coalesce(nullif(trim(i.name), ''), nullif(trim(t.item_name_snapshot), ''), 'Other') as resolved_name,
      t.kind as row_kind,
      coalesce(
        nullif(trim(i.category), ''),
        case
          when t.txn_type in ('salary_advance', 'salary_payment') then 'Payroll'
          else 'General'
        end
      ) as resolved_category,
      coalesce(
        nullif(trim(t.unit_snapshot), ''),
        case when t.quantity is not null and t.quantity > 0 then nullif(trim(i.unit), '') else null end,
        ''
      ) as resolved_unit,
      t.quantity as row_qty,
      t.amount as row_amount
    from public.transactions t
    left join public.items i on i.id = t.item_id
    where t.brand_id = p_brand_id
      and not t.is_deleted
      and (p_shop_id is null or t.shop_id = p_shop_id)
      and (p_start is null or t.txn_date >= p_start)
      and (p_end is null or t.txn_date <= p_end)
      and (p_kind is null or p_kind = 'both' or t.kind = p_kind)
  ),
  filtered as (
    select *
    from base b
    where (p_category is null or trim(p_category) = '' or lower(b.resolved_category) = lower(trim(p_category)))
      and (
        p_search is null
        or trim(p_search) = ''
        or b.resolved_name ilike '%' || trim(p_search) || '%'
        or b.resolved_category ilike '%' || trim(p_search) || '%'
      )
  )
  select
    f.grp_item_key as item_key,
    max(f.row_item_id::text)::uuid as item_id,
    max(f.resolved_name) as item_name,
    f.row_kind as kind,
    max(f.resolved_category) as category,
    f.resolved_unit as unit,
    case
      when count(*) filter (where f.row_qty is not null and f.row_qty > 0) > 0
      then round(coalesce(sum(f.row_qty), 0)::numeric, 3)
      else null
    end as total_quantity,
    round(coalesce(sum(case when f.row_qty is not null and f.row_qty > 0 then f.row_amount else 0 end), 0)::numeric, 2) as quantified_amount,
    round(coalesce(sum(f.row_amount), 0)::numeric, 2) as total_amount,
    count(*) as purchase_count,
    count(*) filter (where f.row_qty is not null and f.row_qty > 0) as qty_entry_count,
    case
      when coalesce(sum(f.row_qty), 0) > 0
      then round((coalesce(sum(case when f.row_qty is not null and f.row_qty > 0 then f.row_amount else 0 end), 0) / sum(f.row_qty))::numeric, 2)
      else null
    end as avg_rate
  from filtered f
  group by f.grp_item_key, f.row_kind, f.resolved_unit
  order by sum(f.row_amount) desc, max(f.resolved_name) asc;
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. RPC: Daily Progress Line Chart Series (from daily_summary)
-- ------------------------------------------------------------------------------
create or replace function public.get_daily_progress_series(
  p_brand_id uuid,
  p_shop_id uuid default null,
  p_start date default null,
  p_end date default null
)
returns table (
  summary_date date,
  total_income numeric(14,2),
  total_expense numeric(14,2),
  net_profit numeric(14,2)
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_jwt_role text := coalesce(auth.role(), current_setting('request.jwt.claim.role', true), '');
  v_role text := public.auth_role();
  v_brand uuid := public.auth_brand_id();
  v_shop uuid := public.auth_shop_id();
begin
  if v_jwt_role <> 'service_role' then
    if v_role = 'master' then
      null;
    elsif v_role = 'admin' and p_brand_id = v_brand then
      null;
    elsif v_role = 'manager' and p_brand_id = v_brand and p_shop_id is not null and p_shop_id = v_shop then
      null;
    else
      raise exception 'Unauthorized';
    end if;
  end if;

  return query
  select
    ds.summary_date,
    round(coalesce(sum(ds.income), 0)::numeric, 2) as total_income,
    round(coalesce(sum(ds.expense), 0)::numeric, 2) as total_expense,
    round(coalesce(sum(ds.income - ds.expense), 0)::numeric, 2) as net_profit
  from public.daily_summary ds
  inner join public.shops s on s.id = ds.shop_id
  where s.brand_id = p_brand_id
    and (p_shop_id is null or ds.shop_id = p_shop_id)
    and (p_start is null or ds.summary_date >= p_start)
    and (p_end is null or ds.summary_date <= p_end)
  group by ds.summary_date
  order by ds.summary_date asc;
end;
$$;

-- ------------------------------------------------------------------------------
-- 6. GRANTS & AUDIT LOG RLS ENHANCEMENTS (IDEMPOTENT)
-- ------------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;

grant execute on function public.get_item_wise_summary(uuid, uuid, date, date, text, text, text) to authenticated, service_role;
grant execute on function public.get_daily_progress_series(uuid, uuid, date, date) to authenticated, service_role;

drop policy if exists "Audit log access policy" on public.audit_log;
create policy "Audit log access policy"
  on public.audit_log for select to authenticated
  using (
    public.auth_role() = 'master'
    or (
      public.auth_role() = 'admin'
      and (
        user_id in (select p.id from public.profiles p where p.brand_id = public.auth_brand_id())
        or record_id = public.auth_brand_id()
        or record_id in (select s.id from public.shops s where s.brand_id = public.auth_brand_id())
        or record_id in (select i.id from public.items i where i.brand_id = public.auth_brand_id())
        or record_id in (select t.id from public.transactions t where t.brand_id = public.auth_brand_id())
        or record_id in (select a.id from public.assets a where a.brand_id = public.auth_brand_id())
      )
    )
  );

drop policy if exists "Audit log insert policy" on public.audit_log;
create policy "Audit log insert policy"
  on public.audit_log for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.auth_role() in ('master', 'admin', 'manager')
  );

-- Refresh PostgREST schema cache immediately so new columns/RPCs are visible right away
notify pgrst, 'reload schema';

-- ==============================================================================
-- CafeLedger - Triggers, Functions & RLS Policies
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. UPDATED_AT TRIGGER FUNCTION
-- ------------------------------------------------------------------------------
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger trg_brands_updated_at before update on public.brands for each row execute function public.handle_updated_at();
create trigger trg_shops_updated_at before update on public.shops for each row execute function public.handle_updated_at();
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.handle_updated_at();
create trigger trg_items_updated_at before update on public.items for each row execute function public.handle_updated_at();
create trigger trg_payment_modes_updated_at before update on public.payment_modes for each row execute function public.handle_updated_at();
create trigger trg_employees_updated_at before update on public.employees for each row execute function public.handle_updated_at();
create trigger trg_transactions_updated_at before update on public.transactions for each row execute function public.handle_updated_at();
create trigger trg_month_openings_updated_at before update on public.month_openings for each row execute function public.handle_updated_at();
create trigger trg_daily_summary_updated_at before update on public.daily_summary for each row execute function public.handle_updated_at();
create trigger trg_salary_records_updated_at before update on public.salary_records for each row execute function public.handle_updated_at();
create trigger trg_assets_updated_at before update on public.assets for each row execute function public.handle_updated_at();
create trigger trg_asset_service_logs_updated_at before update on public.asset_service_logs for each row execute function public.handle_updated_at();
create trigger trg_item_requests_updated_at before update on public.item_requests for each row execute function public.handle_updated_at();

-- ------------------------------------------------------------------------------
-- 2. AUTH & RLS HELPER FUNCTIONS (SECURITY DEFINER, CACHED STABLE)
-- ------------------------------------------------------------------------------
create or replace function public.auth_role()
returns text as $$
    select role from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

create or replace function public.auth_brand_id()
returns uuid as $$
    select brand_id from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

create or replace function public.auth_shop_id()
returns uuid as $$
    select shop_id from public.profiles where id = auth.uid();
$$ language sql stable security definer set search_path = public;

-- ------------------------------------------------------------------------------
-- 3. DAILY SUMMARY RECALCULATION & PROPAGATION
-- ------------------------------------------------------------------------------
-- Recalculates daily summary for a given shop and date range
create or replace function public.recalculate_shop_daily_summary(
    p_shop_id uuid,
    p_date date
)
returns void as $$
declare
    v_month text;
    v_prev_date date;
    v_opening numeric(12,2) := 0.00;
    v_income numeric(12,2) := 0.00;
    v_expense numeric(12,2) := 0.00;
    v_closing numeric(12,2) := 0.00;
begin
    v_month := to_char(p_date, 'YYYY-MM');

    -- Determine Opening Balance
    if extract(day from p_date) = 1 then
        -- First day of the month: get from month_openings or 0
        select coalesce(opening_balance, 0.00)
        into v_opening
        from public.month_openings
        where shop_id = p_shop_id and month = v_month;

        if not found then
            -- Fallback to closing of previous day if month_openings not yet seeded
            v_prev_date := p_date - interval '1 day';
            select coalesce(closing, 0.00)
            into v_opening
            from public.daily_summary
            where shop_id = p_shop_id and summary_date = v_prev_date;
        end if;
    else
        -- Regular day: check closing of immediate previous day recorded
        v_prev_date := p_date - interval '1 day';
        select coalesce(closing, 0.00)
        into v_opening
        from public.daily_summary
        where shop_id = p_shop_id and summary_date = v_prev_date;

        -- If not recorded yesterday, find the latest recorded closing in current month
        if v_opening is null then
            select coalesce(closing, 0.00)
            into v_opening
            from public.daily_summary
            where shop_id = p_shop_id 
              and summary_date < p_date 
              and to_char(summary_date, 'YYYY-MM') = v_month
            order by summary_date desc
            limit 1;
        end if;
    end if;

    v_opening := coalesce(v_opening, 0.00);

    -- Sum of Income on p_date
    select coalesce(sum(amount), 0.00)
    into v_income
    from public.transactions
    where shop_id = p_shop_id
      and txn_date = p_date
      and kind = 'income'
      and not is_deleted;

    -- Sum of Expense on p_date
    select coalesce(sum(amount), 0.00)
    into v_expense
    from public.transactions
    where shop_id = p_shop_id
      and txn_date = p_date
      and kind = 'expense'
      and not is_deleted;

    -- Daily Closing = Opening + Income - Expense
    v_closing := v_opening + v_income - v_expense;

    -- Upsert into daily_summary
    insert into public.daily_summary (shop_id, summary_date, opening, income, expense, closing, updated_at)
    values (p_shop_id, p_date, v_opening, v_income, v_expense, v_closing, now())
    on conflict (shop_id, summary_date)
    do update set
        opening = excluded.opening,
        income = excluded.income,
        expense = excluded.expense,
        closing = excluded.closing,
        updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;

-- Transaction trigger to update daily_summary immediately
create or replace function public.trg_transactions_daily_summary_sync()
returns trigger as $$
begin
    if tg_op = 'INSERT' then
        perform public.recalculate_shop_daily_summary(new.shop_id, new.txn_date);
    elsif tg_op = 'UPDATE' then
        perform public.recalculate_shop_daily_summary(new.shop_id, new.txn_date);
        if old.txn_date <> new.txn_date or old.shop_id <> new.shop_id then
            perform public.recalculate_shop_daily_summary(old.shop_id, old.txn_date);
        end if;
    elsif tg_op = 'DELETE' then
        perform public.recalculate_shop_daily_summary(old.shop_id, old.txn_date);
    end if;
    return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_sync_daily_summary_on_txn
after insert or update or delete on public.transactions
for each row execute function public.trg_transactions_daily_summary_sync();

-- ------------------------------------------------------------------------------
-- 4. MONTH OPENING CARRY-FORWARD HELPER FUNCTION
-- ------------------------------------------------------------------------------
create or replace function public.ensure_month_opening(
    p_shop_id uuid,
    p_target_month text -- 'YYYY-MM'
)
returns numeric as $$
declare
    v_opening numeric(12,2);
    v_prev_month text;
    v_prev_closing numeric(12,2);
    v_prev_date date;
begin
    -- 1. If opening already exists, return it
    select opening_balance into v_opening
    from public.month_openings
    where shop_id = p_shop_id and month = p_target_month;

    if found then
        return v_opening;
    end if;

    -- 2. Compute previous month
    v_prev_date := (to_date(p_target_month || '-01', 'YYYY-MM-DD') - interval '1 day')::date;
    v_prev_month := to_char(v_prev_date, 'YYYY-MM');

    -- Look for last recorded closing in previous month
    select closing into v_prev_closing
    from public.daily_summary
    where shop_id = p_shop_id and to_char(summary_date, 'YYYY-MM') = v_prev_month
    order by summary_date desc
    limit 1;

    -- If no daily summary, look for previous month_opening
    if v_prev_closing is null then
        select opening_balance into v_prev_closing
        from public.month_openings
        where shop_id = p_shop_id and month = v_prev_month;
    end if;

    v_prev_closing := coalesce(v_prev_closing, 0.00);

    -- Insert auto carried-forward month opening
    insert into public.month_openings (shop_id, month, opening_balance, is_manual, note)
    values (p_shop_id, p_target_month, v_prev_closing, false, 'Auto carried forward from ' || v_prev_month)
    on conflict (shop_id, month) do nothing;

    return v_prev_closing;
end;
$$ language plpgsql security definer set search_path = public;

-- ------------------------------------------------------------------------------
-- 5. SALARY RECALCULATION FUNCTION
-- ------------------------------------------------------------------------------
create or replace function public.recalculate_salary_record(
    p_shop_id uuid,
    p_employee_id uuid,
    p_month text -- 'YYYY-MM'
)
returns void as $$
declare
    v_advances numeric(12,2) := 0.00;
    v_paid numeric(12,2) := 0.00;
    v_days numeric(5,1) := 0.0;
    v_rate numeric(10,2) := 0.00;
    v_gross numeric(12,2) := 0.00;
    v_balance numeric(12,2) := 0.00;
begin
    -- Calculate advances in this month
    select coalesce(sum(amount), 0.00)
    into v_advances
    from public.transactions
    where shop_id = p_shop_id
      and employee_id = p_employee_id
      and to_char(txn_date, 'YYYY-MM') = p_month
      and txn_type = 'salary_advance'
      and not is_deleted;

    -- Calculate salary payments in this month
    select coalesce(sum(amount), 0.00)
    into v_paid
    from public.transactions
    where shop_id = p_shop_id
      and employee_id = p_employee_id
      and to_char(txn_date, 'YYYY-MM') = p_month
      and txn_type = 'salary_payment'
      and not is_deleted;

    -- Get employee current rate if record not found
    select rate_per_day into v_rate
    from public.employees
    where id = p_employee_id;
    v_rate := coalesce(v_rate, 0.00);

    -- Check if record exists to keep existing days_worked
    select days_worked, rate_snapshot
    into v_days, v_rate
    from public.salary_records
    where shop_id = p_shop_id and employee_id = p_employee_id and month = p_month;

    v_days := coalesce(v_days, 0.0);
    v_gross := round(v_days * v_rate, 2);
    v_balance := v_gross - v_advances - v_paid;

    insert into public.salary_records (
        shop_id, employee_id, month, days_worked, rate_snapshot, gross, advances_total, paid_total, balance, updated_at
    )
    values (
        p_shop_id, p_employee_id, p_month, v_days, v_rate, v_gross, v_advances, v_paid, v_balance, now()
    )
    on conflict (shop_id, employee_id, month)
    do update set
        advances_total = excluded.advances_total,
        paid_total = excluded.paid_total,
        gross = round(salary_records.days_worked * salary_records.rate_snapshot, 2),
        balance = round(salary_records.days_worked * salary_records.rate_snapshot, 2) - excluded.advances_total - excluded.paid_total,
        updated_at = now();
end;
$$ language plpgsql security definer set search_path = public;

-- Sync salary on salary_advance / salary_payment txn
create or replace function public.trg_transactions_salary_sync()
returns trigger as $$
begin
    if (new.employee_id is not null and new.txn_type in ('salary_advance', 'salary_payment')) then
        perform public.recalculate_salary_record(new.shop_id, new.employee_id, to_char(new.txn_date, 'YYYY-MM'));
    end if;

    if (tg_op = 'UPDATE' and old.employee_id is not null and (old.employee_id <> new.employee_id or old.txn_date <> new.txn_date)) then
        perform public.recalculate_salary_record(old.shop_id, old.employee_id, to_char(old.txn_date, 'YYYY-MM'));
    elsif (tg_op = 'DELETE' and old.employee_id is not null and old.txn_type in ('salary_advance', 'salary_payment')) then
        perform public.recalculate_salary_record(old.shop_id, old.employee_id, to_char(old.txn_date, 'YYYY-MM'));
    end if;
    return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger trg_sync_salary_on_txn
after insert or update or delete on public.transactions
for each row execute function public.trg_transactions_salary_sync();

-- ------------------------------------------------------------------------------
-- 6. AUDIT LOG TRIGGER
-- ------------------------------------------------------------------------------
create or replace function public.log_audit_event()
returns trigger as $$
declare
    v_rec_id uuid;
begin
    if tg_op = 'DELETE' then
        v_rec_id := old.id;
        insert into public.audit_log (user_id, action, table_name, record_id, old_data, at)
        values (auth.uid(), 'DELETE', tg_table_name, v_rec_id, to_jsonb(old), now());
        return old;
    elsif tg_op = 'UPDATE' then
        v_rec_id := new.id;
        insert into public.audit_log (user_id, action, table_name, record_id, old_data, new_data, at)
        values (auth.uid(), 'UPDATE', tg_table_name, v_rec_id, to_jsonb(old), to_jsonb(new), now());
        return new;
    elsif tg_op = 'INSERT' then
        v_rec_id := new.id;
        insert into public.audit_log (user_id, action, table_name, record_id, new_data, at)
        values (auth.uid(), 'INSERT', tg_table_name, v_rec_id, to_jsonb(new), now());
        return new;
    end if;
    return null;
end;
$$ language plpgsql security definer set search_path = public;

create trigger audit_brands after insert or update or delete on public.brands for each row execute function public.log_audit_event();
create trigger audit_shops after insert or update or delete on public.shops for each row execute function public.log_audit_event();
create trigger audit_transactions after insert or update or delete on public.transactions for each row execute function public.log_audit_event();
create trigger audit_month_openings after insert or update or delete on public.month_openings for each row execute function public.log_audit_event();
create trigger audit_assets after insert or update or delete on public.assets for each row execute function public.log_audit_event();

-- ------------------------------------------------------------------------------
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- Master: sees all
-- Admin: sees only their brand_id
-- Manager: sees only their shop_id
-- ------------------------------------------------------------------------------

-- Enable RLS on all tables
alter table public.brands enable row level security;
alter table public.profiles enable row level security;
alter table public.shops enable row level security;
alter table public.items enable row level security;
alter table public.payment_modes enable row level security;
alter table public.employees enable row level security;
alter table public.transactions enable row level security;
alter table public.month_openings enable row level security;
alter table public.daily_summary enable row level security;
alter table public.salary_records enable row level security;
alter table public.assets enable row level security;
alter table public.asset_service_logs enable row level security;
alter table public.item_requests enable row level security;
alter table public.audit_log enable row level security;

-- PROFILES
create policy "Profiles access policy" on public.profiles
for all using (
    public.auth_role() = 'master'
    or id = auth.uid()
    or (public.auth_role() = 'admin' and brand_id = public.auth_brand_id())
);

-- BRANDS
create policy "Brands access policy" on public.brands
for all using (
    public.auth_role() = 'master'
    or (public.auth_role() in ('admin', 'manager') and id = public.auth_brand_id())
);

-- SHOPS
create policy "Shops access policy" on public.shops
for all using (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin' and brand_id = public.auth_brand_id())
    or (public.auth_role() = 'manager' and id = public.auth_shop_id())
);

-- ITEMS
create policy "Items access policy" on public.items
for all using (
    public.auth_role() = 'master'
    or (brand_id = public.auth_brand_id())
);

-- PAYMENT MODES
create policy "Payment modes access policy" on public.payment_modes
for all using (
    public.auth_role() = 'master'
    or (brand_id = public.auth_brand_id())
);

-- EMPLOYEES
create policy "Employees access policy" on public.employees
for all using (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin' and brand_id = public.auth_brand_id())
    or (public.auth_role() = 'manager' and shop_id = public.auth_shop_id())
);

-- TRANSACTIONS
create policy "Transactions access policy" on public.transactions
for all using (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin' and brand_id = public.auth_brand_id())
    or (public.auth_role() = 'manager' and shop_id = public.auth_shop_id())
);

-- MONTH OPENINGS
create policy "Month openings access policy" on public.month_openings
for all using (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin' and shop_id in (select id from public.shops where brand_id = public.auth_brand_id()))
    or (public.auth_role() = 'manager' and shop_id = public.auth_shop_id())
);

-- DAILY SUMMARY
create policy "Daily summary access policy" on public.daily_summary
for all using (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin' and shop_id in (select id from public.shops where brand_id = public.auth_brand_id()))
    or (public.auth_role() = 'manager' and shop_id = public.auth_shop_id())
);

-- SALARY RECORDS
create policy "Salary records access policy" on public.salary_records
for all using (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin' and shop_id in (select id from public.shops where brand_id = public.auth_brand_id()))
    or (public.auth_role() = 'manager' and shop_id = public.auth_shop_id())
);

-- ASSETS
create policy "Assets access policy" on public.assets
for all using (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin' and brand_id = public.auth_brand_id())
    or (public.auth_role() = 'manager' and shop_id = public.auth_shop_id())
);

-- ASSET SERVICE LOGS
create policy "Asset service logs access policy" on public.asset_service_logs
for all using (
    public.auth_role() = 'master'
    or (asset_id in (
        select a.id from public.assets a 
        where (public.auth_role() = 'admin' and a.brand_id = public.auth_brand_id())
           or (public.auth_role() = 'manager' and a.shop_id = public.auth_shop_id())
    ))
);

-- ITEM REQUESTS
create policy "Item requests access policy" on public.item_requests
for all using (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin' and shop_id in (select id from public.shops where brand_id = public.auth_brand_id()))
    or (public.auth_role() = 'manager' and shop_id = public.auth_shop_id())
);

-- AUDIT LOG
create policy "Audit log access policy" on public.audit_log
for select using (
    public.auth_role() = 'master'
    or (public.auth_role() = 'admin')
);


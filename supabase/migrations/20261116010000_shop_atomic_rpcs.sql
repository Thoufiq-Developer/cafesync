-- ==============================================================================
-- CafeSync: Shop Atomic Operations RPC Migration (Static Site Support)
-- All procedures are SECURITY INVOKER so PostgreSQL Row Level Security (RLS) applies.
-- Enables static client applications to perform multi-step atomic operations
-- without multiple network roundtrips or server-side Next.js endpoints.
-- ==============================================================================

-- 1. ADD DAILY TRANSACTION
create or replace function public.rpc_shop_add_daily_transaction(
    p_kind text,
    p_amount numeric,
    p_item_id uuid default null,
    p_mode_id uuid default null,
    p_employee_id uuid default null,
    p_note text default '',
    p_txn_type text default 'normal',
    p_txn_date date default current_date,
    p_quantity numeric default null,
    p_unit_snapshot text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_role text := public.auth_role();
    v_brand_id uuid := public.auth_brand_id();
    v_shop_id uuid := public.auth_shop_id();
    v_today date := (now() at time zone 'Asia/Kolkata')::date;
    v_month text;
    v_is_closed boolean := false;
    v_item_name text := 'Counter Item';
    v_item_unit text := 'pcs';
    v_mode_name text := 'CASH';
    v_emp_name text := 'Staff';
    v_final_note text;
    v_computed_qty numeric := null;
    v_computed_unit text := null;
    v_computed_rate numeric := null;
    v_inserted_id uuid;
begin
    if v_user_id is null or v_role != 'manager' or v_shop_id is null or v_brand_id is null then
        raise exception 'Unauthorized: Only assigned shop managers can record transactions.';
    end if;

    if p_amount is null or p_amount <= 0 then
        raise exception 'Validation Error: Amount must be greater than ₹0.';
    end if;

    if p_quantity is not null and p_quantity <= 0 then
        raise exception 'Validation Error: Quantity must be greater than 0 (or leave blank).';
    end if;

    if p_txn_date > v_today then
        raise exception 'Validation Error: Transaction date cannot be in the future.';
    end if;

    v_month := to_char(p_txn_date, 'YYYY-MM');

    select (closed_at is not null) into v_is_closed
    from public.month_openings
    where shop_id = v_shop_id and month = v_month;

    if v_is_closed then
        raise exception 'Financial Period Closed: Month % is closed and locked by Brand Admin.', v_month;
    end if;

    -- Resolve item snapshot
    if p_item_id is not null then
        select name, coalesce(unit, 'pcs')
        into v_item_name, v_item_unit
        from public.items
        where id = p_item_id and brand_id = v_brand_id and (shop_id is null or shop_id = v_shop_id);

        if v_item_name is null then
            v_item_name := 'Counter Item';
            v_item_unit := 'pcs';
        end if;
    end if;

    -- Resolve payment mode
    if p_mode_id is not null then
        select name into v_mode_name
        from public.payment_modes
        where id = p_mode_id and brand_id = v_brand_id;

        if v_mode_name is null then
            v_mode_name := 'CASH';
        end if;
    end if;

    -- Resolve employee name & note formatting
    v_final_note := coalesce(trim(p_note), '');
    if p_txn_type = 'salary_advance' and p_employee_id is not null then
        select name into v_emp_name
        from public.employees
        where id = p_employee_id and shop_id = v_shop_id;

        v_item_name := 'Salary Advance';
        if v_final_note = '' then
            v_final_note := 'ADVANCE-' || coalesce(v_emp_name, 'Staff');
        else
            v_final_note := 'ADVANCE-' || coalesce(v_emp_name, 'Staff') || ' (' || v_final_note || ')';
        end if;
    elsif p_txn_type = 'salary_payment' and p_employee_id is not null then
        select name into v_emp_name
        from public.employees
        where id = p_employee_id and shop_id = v_shop_id;

        v_item_name := 'Salary Payment';
        if v_final_note = '' then
            v_final_note := 'SALARY-' || coalesce(v_emp_name, 'Staff');
        else
            v_final_note := 'SALARY-' || coalesce(v_emp_name, 'Staff') || ' (' || v_final_note || ')';
        end if;
    end if;

    if p_quantity is not null and p_quantity > 0 then
        v_computed_qty := round(p_quantity, 3);
        v_computed_unit := coalesce(nullif(trim(p_unit_snapshot), ''), v_item_unit, 'pcs');
        v_computed_rate := round((p_amount / v_computed_qty)::numeric, 2);
    end if;

    insert into public.transactions (
        brand_id,
        shop_id,
        txn_date,
        kind,
        item_id,
        item_name_snapshot,
        mode_id,
        mode_name_snapshot,
        amount,
        quantity,
        unit_snapshot,
        rate,
        note,
        employee_id,
        txn_type,
        created_by,
        is_deleted
    ) values (
        v_brand_id,
        v_shop_id,
        p_txn_date,
        p_kind,
        p_item_id,
        v_item_name,
        p_mode_id,
        v_mode_name,
        p_amount,
        v_computed_qty,
        v_computed_unit,
        v_computed_rate,
        nullif(v_final_note, ''),
        p_employee_id,
        p_txn_type,
        v_user_id,
        false
    ) returning id into v_inserted_id;

    insert into public.audit_log (
        user_id,
        action,
        table_name,
        record_id,
        new_data,
        at
    ) values (
        v_user_id,
        'INSERT',
        'transactions',
        v_inserted_id::text,
        jsonb_build_object(
            'kind', p_kind,
            'amount', p_amount,
            'txn_date', p_txn_date,
            'txn_type', p_txn_type,
            'item_name', v_item_name,
            'mode_name', v_mode_name
        ),
        now()
    );

    return jsonb_build_object(
        'success', true,
        'id', v_inserted_id,
        'message', initcap(p_kind) || ' entry of ₹' || p_amount::text || ' added!'
    );
end;
$$;

-- 2. UPDATE DAILY TRANSACTION
create or replace function public.rpc_shop_update_daily_transaction(
    p_txn_id uuid,
    p_amount numeric,
    p_mode_id uuid default null,
    p_note text default '',
    p_quantity numeric default null,
    p_unit_snapshot text default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_shop_id uuid := public.auth_shop_id();
    v_brand_id uuid := public.auth_brand_id();
    v_today date := (now() at time zone 'Asia/Kolkata')::date;
    v_txn record;
    v_is_closed boolean := false;
    v_mode_name text;
    v_next_qty numeric;
    v_next_unit text;
    v_next_rate numeric;
begin
    if v_user_id is null or v_shop_id is null then
        raise exception 'Unauthorized.';
    end if;

    if p_amount is null or p_amount <= 0 then
        raise exception 'Validation Error: Amount must be greater than ₹0.';
    end if;

    select * into v_txn
    from public.transactions
    where id = p_txn_id and shop_id = v_shop_id and is_deleted = false;

    if not found then
        raise exception 'Transaction not found or not owned by your shop.';
    end if;

    -- Check EDIT_WINDOW_DAYS (2 days)
    if (v_today - v_txn.txn_date) > 2 then
        raise exception 'Policy Restriction: Transactions older than 2 days are locked and can only be modified by a Brand Admin.';
    end if;

    -- Check month closed
    select (closed_at is not null) into v_is_closed
    from public.month_openings
    where shop_id = v_shop_id and month = to_char(v_txn.txn_date, 'YYYY-MM');

    if v_is_closed then
        raise exception 'Period Locked: Month % is closed.', to_char(v_txn.txn_date, 'YYYY-MM');
    end if;

    -- Resolve mode name
    v_mode_name := v_txn.mode_name_snapshot;
    if p_mode_id is not null and p_mode_id != v_txn.mode_id then
        select name into v_mode_name
        from public.payment_modes
        where id = p_mode_id and brand_id = v_brand_id;
    end if;

    if p_quantity is not null and p_quantity > 0 then
        v_next_qty := round(p_quantity, 3);
        v_next_unit := coalesce(nullif(trim(p_unit_snapshot), ''), v_txn.unit_snapshot, 'pcs');
        v_next_rate := round((p_amount / v_next_qty)::numeric, 2);
    else
        v_next_qty := null;
        v_next_unit := null;
        v_next_rate := null;
    end if;

    update public.transactions
    set
        amount = p_amount,
        mode_id = coalesce(p_mode_id, mode_id),
        mode_name_snapshot = coalesce(v_mode_name, mode_name_snapshot),
        note = nullif(trim(p_note), ''),
        quantity = v_next_qty,
        unit_snapshot = v_next_unit,
        rate = v_next_rate,
        updated_at = now()
    where id = p_txn_id and shop_id = v_shop_id;

    insert into public.audit_log (
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        at
    ) values (
        v_user_id,
        'UPDATE',
        'transactions',
        p_txn_id::text,
        row_to_json(v_txn)::jsonb,
        jsonb_build_object(
            'amount', p_amount,
            'quantity', v_next_qty,
            'unit_snapshot', v_next_unit,
            'rate', v_next_rate,
            'note', p_note
        ),
        now()
    );

    return jsonb_build_object(
        'success', true,
        'message', 'Entry updated and closing balance recalculated.'
    );
end;
$$;

-- 3. DELETE DAILY TRANSACTION (SOFT-DELETE)
create or replace function public.rpc_shop_delete_daily_transaction(
    p_txn_id uuid
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_shop_id uuid := public.auth_shop_id();
    v_today date := (now() at time zone 'Asia/Kolkata')::date;
    v_txn record;
    v_is_closed boolean := false;
begin
    if v_user_id is null or v_shop_id is null then
        raise exception 'Unauthorized.';
    end if;

    select * into v_txn
    from public.transactions
    where id = p_txn_id and shop_id = v_shop_id and is_deleted = false;

    if not found then
        raise exception 'Transaction not found.';
    end if;

    if (v_today - v_txn.txn_date) > 2 then
        raise exception 'Policy Restriction: Transactions older than 2 days are locked and cannot be deleted.';
    end if;

    select (closed_at is not null) into v_is_closed
    from public.month_openings
    where shop_id = v_shop_id and month = to_char(v_txn.txn_date, 'YYYY-MM');

    if v_is_closed then
        raise exception 'Period Locked: Month % is closed.', to_char(v_txn.txn_date, 'YYYY-MM');
    end if;

    update public.transactions
    set is_deleted = true, updated_at = now()
    where id = p_txn_id and shop_id = v_shop_id;

    insert into public.audit_log (
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        at
    ) values (
        v_user_id,
        'DELETE',
        'transactions',
        p_txn_id::text,
        row_to_json(v_txn)::jsonb,
        jsonb_build_object('is_deleted', true),
        now()
    );

    return jsonb_build_object(
        'success', true,
        'message', 'Entry removed.'
    );
end;
$$;

-- 4. RESTORE DAILY TRANSACTION
create or replace function public.rpc_shop_restore_daily_transaction(
    p_txn_id uuid
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_shop_id uuid := public.auth_shop_id();
    v_txn record;
    v_is_closed boolean := false;
begin
    if v_user_id is null or v_shop_id is null then
        raise exception 'Unauthorized.';
    end if;

    select * into v_txn
    from public.transactions
    where id = p_txn_id and shop_id = v_shop_id and is_deleted = true;

    if not found then
        raise exception 'Entry could not be found to restore.';
    end if;

    select (closed_at is not null) into v_is_closed
    from public.month_openings
    where shop_id = v_shop_id and month = to_char(v_txn.txn_date, 'YYYY-MM');

    if v_is_closed then
        raise exception 'Period Locked: Month % is closed.', to_char(v_txn.txn_date, 'YYYY-MM');
    end if;

    update public.transactions
    set is_deleted = false, updated_at = now()
    where id = p_txn_id and shop_id = v_shop_id;

    insert into public.audit_log (
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        at
    ) values (
        v_user_id,
        'UPDATE',
        'transactions',
        p_txn_id::text,
        jsonb_build_object('is_deleted', true),
        jsonb_build_object('is_deleted', false, 'restored', true),
        now()
    );

    return jsonb_build_object(
        'success', true,
        'message', 'Entry restored!'
    );
end;
$$;

-- 5. SAVE SHOP ITEM
create or replace function public.rpc_shop_save_item(
    p_id uuid default null,
    p_name text default '',
    p_kind text default 'expense',
    p_category text default null,
    p_unit text default 'pcs',
    p_default_rate numeric default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_shop_id uuid := public.auth_shop_id();
    v_brand_id uuid := public.auth_brand_id();
    v_trimmed_name text := trim(coalesce(p_name, ''));
    v_category text;
    v_duplicate record;
    v_existing record;
    v_result record;
begin
    if v_user_id is null or v_shop_id is null or v_brand_id is null then
        raise exception 'Unauthorized: Only assigned shop managers can manage shop items.';
    end if;

    if length(v_trimmed_name) < 2 then
        raise exception 'Please enter an item name (minimum 2 characters).';
    end if;

    v_category := coalesce(nullif(trim(p_category), ''), case when p_kind = 'income' then 'Sales' else 'General' end);

    -- Duplicate check across brand-wide and caller shop
    select id, name, shop_id into v_duplicate
    from public.items
    where brand_id = v_brand_id
      and (shop_id is null or shop_id = v_shop_id)
      and lower(trim(name)) = lower(v_trimmed_name)
      and (p_id is null or id != p_id);

    if found then
        raise exception '"%" already exists (%). Pick that item or choose a distinct name.',
            v_duplicate.name,
            case when v_duplicate.shop_id is not null then 'your shop' else 'brand-wide' end;
    end if;

    if p_id is not null then
        select * into v_existing
        from public.items
        where id = p_id and brand_id = v_brand_id;

        if not found then
            raise exception 'Item not found.';
        end if;
        if v_existing.shop_id is null then
            raise exception 'Brand-wide items are read-only for shop managers.';
        end if;
        if v_existing.shop_id != v_shop_id then
            raise exception 'You can only edit items belonging to your own shop.';
        end if;

        update public.items
        set
            name = v_trimmed_name,
            category = v_category,
            unit = coalesce(nullif(trim(p_unit), ''), 'pcs'),
            default_rate = p_default_rate,
            updated_at = now()
        where id = p_id and shop_id = v_shop_id
        returning * into v_result;

        insert into public.audit_log (user_id, action, table_name, record_id, old_data, new_data, at)
        values (v_user_id, 'UPDATE', 'items', p_id::text, row_to_json(v_existing)::jsonb, row_to_json(v_result)::jsonb, now());

        return jsonb_build_object(
            'success', true,
            'item', row_to_json(v_result),
            'message', 'Updated "' || v_trimmed_name || '".'
        );
    else
        insert into public.items (
            brand_id,
            shop_id,
            created_by,
            name,
            kind,
            category,
            unit,
            default_rate,
            is_active
        ) values (
            v_brand_id,
            v_shop_id,
            v_user_id,
            v_trimmed_name,
            p_kind,
            v_category,
            coalesce(nullif(trim(p_unit), ''), 'pcs'),
            p_default_rate,
            true
        ) returning * into v_result;

        insert into public.audit_log (user_id, action, table_name, record_id, new_data, at)
        values (v_user_id, 'INSERT', 'items', v_result.id::text, row_to_json(v_result)::jsonb, now());

        return jsonb_build_object(
            'success', true,
            'item', row_to_json(v_result),
            'message', 'Added "' || v_trimmed_name || '" to your shop!'
        );
    end if;
end;
$$;

-- 6. UPDATE DAYS WORKED
create or replace function public.rpc_shop_update_days_worked(
    p_employee_id uuid,
    p_days_worked numeric,
    p_month text
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_shop_id uuid := public.auth_shop_id();
    v_is_closed boolean := false;
    v_emp record;
    v_existing record;
    v_rate numeric;
    v_gross numeric;
    v_advances numeric := 0;
    v_paid numeric := 0;
    v_balance numeric;
begin
    if v_user_id is null or v_shop_id is null then
        raise exception 'Unauthorized.';
    end if;

    if p_days_worked is null or p_days_worked < 0 or p_days_worked > 31 then
        raise exception 'Please enter valid days worked between 0 and 31.';
    end if;

    select (closed_at is not null) into v_is_closed
    from public.month_openings
    where shop_id = v_shop_id and month = p_month;

    if v_is_closed then
        raise exception 'Period Locked: Month % is closed.', p_month;
    end if;

    select name, rate_per_day into v_emp
    from public.employees
    where id = p_employee_id and shop_id = v_shop_id;

    if not found then
        raise exception 'Employee not found.';
    end if;

    v_rate := coalesce(v_emp.rate_per_day, 0);
    v_gross := round(p_days_worked * v_rate, 2);

    select advances_total, paid_total into v_existing
    from public.salary_records
    where shop_id = v_shop_id and employee_id = p_employee_id and month = p_month;

    if found then
        v_advances := coalesce(v_existing.advances_total, 0);
        v_paid := coalesce(v_existing.paid_total, 0);
    end if;

    v_balance := round(v_gross - v_advances - v_paid, 2);

    insert into public.salary_records (
        shop_id,
        employee_id,
        month,
        days_worked,
        rate_snapshot,
        gross,
        advances_total,
        paid_total,
        balance,
        updated_at
    ) values (
        v_shop_id,
        p_employee_id,
        p_month,
        p_days_worked,
        v_rate,
        v_gross,
        v_advances,
        v_paid,
        v_balance,
        now()
    )
    on conflict (shop_id, employee_id, month)
    do update set
        days_worked = excluded.days_worked,
        rate_snapshot = excluded.rate_snapshot,
        gross = excluded.gross,
        balance = excluded.balance,
        updated_at = now();

    insert into public.audit_log (user_id, action, table_name, record_id, new_data, at)
    values (
        v_user_id,
        'UPDATE',
        'salary_records',
        p_employee_id::text || '_' || p_month,
        jsonb_build_object(
            'days_worked', p_days_worked,
            'gross', v_gross,
            'balance', v_balance,
            'month', p_month
        ),
        now()
    );

    return jsonb_build_object(
        'success', true,
        'message', 'Updated ' || v_emp.name || ': ' || p_days_worked::text || ' days worked (Gross: ₹' || v_gross::text || ')'
    );
end;
$$;

-- 7. RECORD SALARY TRANSACTION
create or replace function public.rpc_shop_record_salary_transaction(
    p_employee_id uuid,
    p_amount numeric,
    p_mode_id uuid default null,
    p_txn_type text default 'salary_advance',
    p_note text default '',
    p_txn_date date default current_date
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_shop_id uuid := public.auth_shop_id();
    v_brand_id uuid := public.auth_brand_id();
    v_today date := (now() at time zone 'Asia/Kolkata')::date;
    v_is_closed boolean := false;
    v_emp_name text;
    v_mode_name text := 'CASH';
    v_final_note text;
    v_inserted_id uuid;
begin
    if v_user_id is null or v_shop_id is null or v_brand_id is null then
        raise exception 'Unauthorized.';
    end if;

    if p_amount is null or p_amount <= 0 then
        raise exception 'Please select an employee and enter an amount greater than ₹0.';
    end if;

    if p_txn_date > v_today then
        raise exception 'Transaction date cannot be in the future.';
    end if;

    select (closed_at is not null) into v_is_closed
    from public.month_openings
    where shop_id = v_shop_id and month = to_char(p_txn_date, 'YYYY-MM');

    if v_is_closed then
        raise exception 'Period Locked: Month % is closed.', to_char(p_txn_date, 'YYYY-MM');
    end if;

    select name into v_emp_name
    from public.employees
    where id = p_employee_id and shop_id = v_shop_id;

    if not found then
        raise exception 'Employee not found.';
    end if;

    if p_mode_id is not null then
        select name into v_mode_name
        from public.payment_modes
        where id = p_mode_id and brand_id = v_brand_id;
        v_mode_name := coalesce(v_mode_name, 'CASH');
    end if;

    if p_txn_type = 'salary_advance' then
        if trim(coalesce(p_note, '')) = '' then
            v_final_note := 'ADVANCE-' || v_emp_name;
        else
            v_final_note := 'ADVANCE-' || v_emp_name || ' (' || trim(p_note) || ')';
        end if;
    else
        if trim(coalesce(p_note, '')) = '' then
            v_final_note := 'SALARY-' || v_emp_name;
        else
            v_final_note := 'SALARY-' || v_emp_name || ' (' || trim(p_note) || ')';
        end if;
    end if;

    insert into public.transactions (
        brand_id,
        shop_id,
        txn_date,
        kind,
        item_id,
        item_name_snapshot,
        mode_id,
        mode_name_snapshot,
        amount,
        note,
        employee_id,
        txn_type,
        created_by,
        is_deleted
    ) values (
        v_brand_id,
        v_shop_id,
        p_txn_date,
        'expense',
        null,
        case when p_txn_type = 'salary_advance' then 'Salary Advance' else 'Salary Payment' end,
        p_mode_id,
        v_mode_name,
        p_amount,
        v_final_note,
        p_employee_id,
        p_txn_type,
        v_user_id,
        false
    ) returning id into v_inserted_id;

    insert into public.audit_log (user_id, action, table_name, record_id, new_data, at)
    values (
        v_user_id,
        'INSERT',
        'transactions',
        v_inserted_id::text,
        jsonb_build_object(
            'amount', p_amount,
            'txn_type', p_txn_type,
            'employee', v_emp_name,
            'txn_date', p_txn_date
        ),
        now()
    );

    return jsonb_build_object(
        'success', true,
        'id', v_inserted_id,
        'message', (case when p_txn_type = 'salary_advance' then 'Salary Advance' else 'Salary Payment' end) ||
                   ' of ₹' || p_amount::text || ' recorded for ' || v_emp_name || '!'
    );
end;
$$;

-- 8. LOG ASSET SERVICE
create or replace function public.rpc_shop_log_asset_service(
    p_asset_id uuid,
    p_service_date date,
    p_vendor text,
    p_cost numeric default 0,
    p_notes text default '',
    p_next_due date default null
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_shop_id uuid := public.auth_shop_id();
    v_brand_id uuid := public.auth_brand_id();
    v_today date := (now() at time zone 'Asia/Kolkata')::date;
    v_asset record;
    v_inserted_log_id uuid;
begin
    if v_user_id is null or v_shop_id is null or v_brand_id is null then
        raise exception 'Unauthorized.';
    end if;

    if p_asset_id is null or p_service_date is null or p_next_due is null then
        raise exception 'Please enter service date, vendor, and next service due date.';
    end if;

    if p_service_date > v_today then
        raise exception 'Service date cannot be in the future.';
    end if;

    select * into v_asset
    from public.assets
    where id = p_asset_id and shop_id = v_shop_id;

    if not found then
        raise exception 'Asset not found.';
    end if;

    insert into public.asset_service_logs (
        asset_id,
        service_date,
        vendor,
        cost,
        notes,
        next_due
    ) values (
        p_asset_id,
        p_service_date,
        coalesce(nullif(trim(p_vendor), ''), 'Internal Technician'),
        coalesce(p_cost, 0),
        nullif(trim(p_notes), ''),
        p_next_due
    ) returning id into v_inserted_log_id;

    update public.assets
    set
        last_service_date = p_service_date,
        next_service_due = p_next_due,
        status = 'working',
        notes = coalesce(nullif(trim(p_notes), ''), notes),
        updated_at = now()
    where id = p_asset_id and shop_id = v_shop_id;

    if p_cost is not null and p_cost > 0 then
        insert into public.transactions (
            brand_id,
            shop_id,
            txn_date,
            kind,
            item_id,
            item_name_snapshot,
            mode_id,
            mode_name_snapshot,
            amount,
            note,
            employee_id,
            txn_type,
            created_by,
            is_deleted
        ) values (
            v_brand_id,
            v_shop_id,
            p_service_date,
            'expense',
            null,
            'Minor Machine Repairs',
            null,
            'CASH',
            p_cost,
            'Service: ' || v_asset.name || ' (' || coalesce(nullif(trim(p_vendor), ''), 'Internal Technician') || ')',
            null,
            'normal',
            v_user_id,
            false
        );
    end if;

    insert into public.audit_log (user_id, action, table_name, record_id, new_data, at)
    values (
        v_user_id,
        'INSERT',
        'asset_service_logs',
        v_inserted_log_id::text,
        jsonb_build_object(
            'asset_id', p_asset_id,
            'cost', p_cost,
            'vendor', p_vendor,
            'next_due', p_next_due
        ),
        now()
    );

    return jsonb_build_object(
        'success', true,
        'message', 'Service logged successfully! Asset status set to working, next due on ' || p_next_due::text || '.'
    );
end;
$$;


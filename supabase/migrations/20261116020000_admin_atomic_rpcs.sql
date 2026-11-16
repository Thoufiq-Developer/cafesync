-- ==============================================================================
-- CafeSync: Admin Atomic Operations RPC Migration (Static Site Support)
-- All procedures are SECURITY INVOKER so PostgreSQL Row Level Security (RLS) applies.
-- Enables static brand admin client applications to execute multi-step operations
-- atomically with full tenant isolation, audit logging, and duplicate prevention.
-- ==============================================================================

-- 1. CLOSE MONTH ACTION RPC
create or replace function public.rpc_admin_close_month(
    p_shop_id uuid,
    p_month text
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_role text := public.auth_role();
    v_brand_id uuid := public.auth_brand_id();
    v_shop_brand_id uuid;
    v_now timestamptz := now();
begin
    if v_user_id is null or not (v_role in ('admin', 'brand_admin', 'master', 'platform_admin')) then
        raise exception 'Unauthorized: Admin credentials required to lock accounting periods.' using errcode = '42501';
    end if;

    if p_shop_id is null or p_month is null or p_month !~ '^\d{4}-\d{2}$' then
        raise exception 'Validation Error: Valid shop ID and month (YYYY-MM) are required.';
    end if;

    -- Tenant isolation check
    select brand_id into v_shop_brand_id from public.shops where id = p_shop_id;
    if v_shop_brand_id is null then
        raise exception 'Outlet not found.';
    end if;

    if v_role in ('admin', 'brand_admin') and v_shop_brand_id != v_brand_id then
        raise exception 'Unauthorized: Outlet does not belong to your brand.' using errcode = '42501';
    end if;

    -- Upsert month_openings with closed_at
    insert into public.month_openings (
        shop_id,
        month,
        closed_at,
        updated_at
    ) values (
        p_shop_id,
        p_month,
        v_now,
        v_now
    )
    on conflict (shop_id, month) do update set
        closed_at = v_now,
        updated_at = v_now;

    -- Audit log
    insert into public.audit_log (
        user_id,
        action,
        table_name,
        record_id,
        new_data
    ) values (
        v_user_id,
        'CLOSE_MONTH',
        'month_openings',
        p_shop_id,
        jsonb_build_object('shop_id', p_shop_id, 'month', p_month, 'closed_at', v_now)
    );

    return jsonb_build_object(
        'success', true,
        'shop_id', p_shop_id,
        'month', p_month,
        'closed_at', v_now
    );
end;
$$;

revoke all on function public.rpc_admin_close_month(uuid, text) from public;
grant execute on function public.rpc_admin_close_month(uuid, text) to authenticated, service_role;


-- 2. OVERRIDE MONTH OPENING BALANCE RPC
create or replace function public.rpc_admin_override_month_opening(
    p_shop_id uuid,
    p_month text,
    p_opening_balance numeric,
    p_note text
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_role text := public.auth_role();
    v_brand_id uuid := public.auth_brand_id();
    v_shop_brand_id uuid;
    v_now timestamptz := now();
    v_trimmed_note text;
begin
    if v_user_id is null or not (v_role in ('admin', 'brand_admin', 'master', 'platform_admin')) then
        raise exception 'Unauthorized: Admin credentials required to override opening balances.' using errcode = '42501';
    end if;

    v_trimmed_note := coalesce(trim(p_note), '');
    if p_shop_id is null or p_month is null or p_month !~ '^\d{4}-\d{2}$' or v_trimmed_note = '' then
        raise exception 'Validation Error: Shop, valid month (YYYY-MM), opening balance, and an audit note are required.';
    end if;

    -- Tenant isolation check
    select brand_id into v_shop_brand_id from public.shops where id = p_shop_id;
    if v_shop_brand_id is null then
        raise exception 'Outlet not found.';
    end if;

    if v_role in ('admin', 'brand_admin') and v_shop_brand_id != v_brand_id then
        raise exception 'Unauthorized: Outlet does not belong to your brand.' using errcode = '42501';
    end if;

    -- Upsert opening balance with is_manual = true
    insert into public.month_openings (
        shop_id,
        month,
        opening_balance,
        is_manual,
        note,
        updated_at
    ) values (
        p_shop_id,
        p_month,
        coalesce(p_opening_balance, 0),
        true,
        v_trimmed_note,
        v_now
    )
    on conflict (shop_id, month) do update set
        opening_balance = coalesce(p_opening_balance, 0),
        is_manual = true,
        note = v_trimmed_note,
        updated_at = v_now;

    -- Audit log
    insert into public.audit_log (
        user_id,
        action,
        table_name,
        record_id,
        new_data
    ) values (
        v_user_id,
        'OVERRIDE_OPENING',
        'month_openings',
        p_shop_id,
        jsonb_build_object(
            'shop_id', p_shop_id,
            'month', p_month,
            'opening_balance', coalesce(p_opening_balance, 0),
            'note', v_trimmed_note
        )
    );

    return jsonb_build_object(
        'success', true,
        'shop_id', p_shop_id,
        'month', p_month,
        'opening_balance', coalesce(p_opening_balance, 0)
    );
end;
$$;

revoke all on function public.rpc_admin_override_month_opening(uuid, text, numeric, text) from public;
grant execute on function public.rpc_admin_override_month_opening(uuid, text, numeric, text) to authenticated, service_role;


-- 3. PROMOTE ITEM BRAND-WIDE RPC
create or replace function public.rpc_admin_promote_item_brand_wide(
    p_item_id uuid
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_role text := public.auth_role();
    v_brand_id uuid := public.auth_brand_id();
    v_item record;
begin
    if v_user_id is null or not (v_role in ('admin', 'brand_admin', 'master', 'platform_admin')) then
        raise exception 'Unauthorized: Admin credentials required.' using errcode = '42501';
    end if;

    select * into v_item from public.items where id = p_item_id;
    if v_item.id is null then
        raise exception 'Item not found.';
    end if;

    if v_role in ('admin', 'brand_admin') and v_item.brand_id != v_brand_id then
        raise exception 'Unauthorized: Item does not belong to your brand.' using errcode = '42501';
    end if;

    update public.items
    set shop_id = null,
        updated_at = now()
    where id = p_item_id;

    insert into public.audit_log (
        user_id,
        action,
        table_name,
        record_id,
        old_data,
        new_data
    ) values (
        v_user_id,
        'PROMOTE_BRAND_WIDE',
        'items',
        p_item_id,
        jsonb_build_object('shop_id', v_item.shop_id),
        jsonb_build_object('shop_id', null, 'name', v_item.name)
    );

    return jsonb_build_object(
        'success', true,
        'item_id', p_item_id,
        'name', v_item.name
    );
end;
$$;

revoke all on function public.rpc_admin_promote_item_brand_wide(uuid) from public;
grant execute on function public.rpc_admin_promote_item_brand_wide(uuid) to authenticated, service_role;


-- 4. BULK TOGGLE ITEM STATUS RPC
create or replace function public.rpc_admin_bulk_toggle_item_status(
    p_item_ids uuid[],
    p_is_active boolean
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_role text := public.auth_role();
    v_brand_id uuid := public.auth_brand_id();
    v_updated_count integer := 0;
begin
    if v_user_id is null or not (v_role in ('admin', 'brand_admin', 'master', 'platform_admin')) then
        raise exception 'Unauthorized: Admin credentials required.' using errcode = '42501';
    end if;

    if p_item_ids is null or array_length(p_item_ids, 1) = 0 then
        return jsonb_build_object('success', true, 'count', 0);
    end if;

    if v_role in ('master', 'platform_admin') then
        update public.items
        set is_active = p_is_active,
            updated_at = now()
        where id = any(p_item_ids);
    else
        update public.items
        set is_active = p_is_active,
            updated_at = now()
        where id = any(p_item_ids) and brand_id = v_brand_id;
    end if;

    get diagnostics v_updated_count = row_count;

    insert into public.audit_log (
        user_id,
        action,
        table_name,
        record_id,
        new_data
    ) values (
        v_user_id,
        'BULK_UPDATE_STATUS',
        'items',
        v_brand_id,
        jsonb_build_object('item_ids', p_item_ids, 'is_active', p_is_active, 'count', v_updated_count)
    );

    return jsonb_build_object(
        'success', true,
        'count', v_updated_count,
        'is_active', p_is_active
    );
end;
$$;

revoke all on function public.rpc_admin_bulk_toggle_item_status(uuid[], boolean) from public;
grant execute on function public.rpc_admin_bulk_toggle_item_status(uuid[], boolean) to authenticated, service_role;


-- 5. ATOMIC EXCEL TRANSACTION CHUNK IMPORTER WITH DUPLICATE DETECTION & BATCH TAGGING
create or replace function public.rpc_admin_import_excel_chunk(
    p_shop_id uuid,
    p_month text,
    p_opening_balance numeric default null,
    p_import_batch_id uuid default null,
    p_rows jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security invoker
as $$
declare
    v_user_id uuid := auth.uid();
    v_role text := public.auth_role();
    v_brand_id uuid := public.auth_brand_id();
    v_shop_brand_id uuid;
    v_is_closed boolean := false;
    v_row jsonb;
    v_date date;
    v_desc text;
    v_mop text;
    v_income numeric;
    v_expense numeric;
    v_is_sa boolean;
    v_emp_name text;
    v_imported_count integer := 0;
    v_skipped_count integer := 0;
    v_duplicates jsonb := '[]'::jsonb;
    v_affected_dates date[] := array[]::date[];
    v_d date;
    v_day_income numeric;
    v_day_expense numeric;
    v_prev_closing numeric;
    v_item_id uuid;
    v_mode_id uuid;
begin
    if v_user_id is null or not (v_role in ('admin', 'brand_admin', 'master', 'platform_admin')) then
        raise exception 'Unauthorized: Admin credentials required to import financial statements.' using errcode = '42501';
    end if;

    if p_shop_id is null or p_month is null or p_month !~ '^\d{4}-\d{2}$' then
        raise exception 'Validation Error: Valid shop ID and month (YYYY-MM) are required.';
    end if;

    -- Tenant isolation check
    select brand_id into v_shop_brand_id from public.shops where id = p_shop_id;
    if v_shop_brand_id is null then
        raise exception 'Outlet not found.';
    end if;

    if v_role in ('admin', 'brand_admin') and v_shop_brand_id != v_brand_id then
        raise exception 'Unauthorized: Outlet does not belong to your brand.' using errcode = '42501';
    end if;

    -- Check if accounting month is locked
    select (closed_at is not null) into v_is_closed
    from public.month_openings
    where shop_id = p_shop_id and month = p_month;

    if v_is_closed then
        raise exception 'Financial Period Closed: Month % is closed and locked.', p_month;
    end if;

    -- If opening balance is provided, record it in month_openings if not already manually customized
    if p_opening_balance is not null then
        insert into public.month_openings (
            shop_id,
            month,
            opening_balance,
            is_manual,
            note,
            updated_at
        ) values (
            p_shop_id,
            p_month,
            p_opening_balance,
            true,
            'Imported from Monthly Excel Statement (' || p_month || ')',
            now()
        )
        on conflict (shop_id, month) do update set
            opening_balance = case when public.month_openings.is_manual then public.month_openings.opening_balance else excluded.opening_balance end,
            note = case when public.month_openings.is_manual then public.month_openings.note else excluded.note end,
            updated_at = now();
    end if;

    -- Iterate and insert non-duplicate rows
    for v_row in select * from jsonb_array_elements(p_rows)
    loop
        v_date := (v_row->>'date')::date;
        v_desc := coalesce(trim(v_row->>'description'), 'Counter Billing');
        v_mop := upper(coalesce(trim(v_row->>'mop'), 'CASH'));
        v_income := coalesce((v_row->>'income')::numeric, 0);
        v_expense := coalesce((v_row->>'expense')::numeric, 0);
        v_is_sa := coalesce((v_row->>'isSalaryAdvance')::boolean, false) or v_desc ~* '^SA-';
        v_emp_name := nullif(trim(v_row->>'employeeName'), '');

        -- 1. Check Income Row
        if v_income > 0 then
            if exists (
                select 1 from public.transactions
                where shop_id = p_shop_id
                  and txn_date = v_date
                  and kind = 'income'
                  and amount = v_income
                  and item_name_snapshot = v_desc
                  and mode_name_snapshot = v_mop
                  and is_deleted = false
            ) then
                v_skipped_count := v_skipped_count + 1;
                v_duplicates := v_duplicates || jsonb_build_object(
                    'date', v_date,
                    'kind', 'income',
                    'amount', v_income,
                    'description', v_desc,
                    'mop', v_mop
                );
            else
                -- Resolve optional matching item
                select id into v_item_id from public.items
                where brand_id = v_shop_brand_id
                  and (shop_id is null or shop_id = p_shop_id)
                  and lower(trim(name)) = lower(v_desc)
                limit 1;

                -- Resolve optional matching payment mode
                select id into v_mode_id from public.payment_modes
                where brand_id = v_shop_brand_id
                  and lower(trim(name)) = lower(v_mop)
                limit 1;

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
                    txn_type,
                    import_batch_id,
                    created_by,
                    is_deleted
                ) values (
                    v_shop_brand_id,
                    p_shop_id,
                    v_date,
                    'income',
                    v_item_id,
                    v_desc,
                    v_mode_id,
                    v_mop,
                    v_income,
                    'Excel Import',
                    'normal',
                    p_import_batch_id,
                    v_user_id,
                    false
                );

                v_imported_count := v_imported_count + 1;
                if not (v_date = any(v_affected_dates)) then
                    v_affected_dates := array_append(v_affected_dates, v_date);
                end if;
            end if;
        end if;

        -- 2. Check Expense Row
        if v_expense > 0 then
            declare
                v_item_snapshot text := case when v_is_sa then 'Salary Advance' else v_desc end;
                v_txn_type text := case when v_is_sa then 'salary_advance' else 'normal' end;
                v_note text := case when v_is_sa and v_emp_name is not null then 'ADVANCE-' || v_emp_name else v_desc end;
            begin
                if exists (
                    select 1 from public.transactions
                    where shop_id = p_shop_id
                      and txn_date = v_date
                      and kind = 'expense'
                      and amount = v_expense
                      and item_name_snapshot = v_item_snapshot
                      and mode_name_snapshot = v_mop
                      and is_deleted = false
                ) then
                    v_skipped_count := v_skipped_count + 1;
                    v_duplicates := v_duplicates || jsonb_build_object(
                        'date', v_date,
                        'kind', 'expense',
                        'amount', v_expense,
                        'description', v_desc,
                        'mop', v_mop
                    );
                else
                    select id into v_item_id from public.items
                    where brand_id = v_shop_brand_id
                      and (shop_id is null or shop_id = p_shop_id)
                      and lower(trim(name)) = lower(v_item_snapshot)
                    limit 1;

                    select id into v_mode_id from public.payment_modes
                    where brand_id = v_shop_brand_id
                      and lower(trim(name)) = lower(v_mop)
                    limit 1;

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
                        txn_type,
                        import_batch_id,
                        created_by,
                        is_deleted
                    ) values (
                        v_shop_brand_id,
                        p_shop_id,
                        v_date,
                        'expense',
                        v_item_id,
                        v_item_snapshot,
                        v_mode_id,
                        v_mop,
                        v_expense,
                        v_note,
                        v_txn_type,
                        p_import_batch_id,
                        v_user_id,
                        false
                    );

                    v_imported_count := v_imported_count + 1;
                    if not (v_date = any(v_affected_dates)) then
                        v_affected_dates := array_append(v_affected_dates, v_date);
                    end if;
                end if;
            end;
        end if;
    end loop;

    -- Synchronize daily aggregates for all affected dates
    if array_length(v_affected_dates, 1) > 0 then
        foreach v_d in array v_affected_dates
        loop
            select
                coalesce(sum(case when kind = 'income' then amount else 0 end), 0),
                coalesce(sum(case when kind = 'expense' then amount else 0 end), 0)
            into v_day_income, v_day_expense
            from public.transactions
            where shop_id = p_shop_id and txn_date = v_d and is_deleted = false;

            -- Find previous day closing or month opening
            select closing into v_prev_closing
            from public.daily_summary
            where shop_id = p_shop_id and date < v_d
            order by date desc
            limit 1;

            if v_prev_closing is null then
                select coalesce(opening_balance, 0) into v_prev_closing
                from public.month_openings
                where shop_id = p_shop_id and month = to_char(v_d, 'YYYY-MM');
            end if;

            insert into public.daily_summary (
                brand_id,
                shop_id,
                date,
                opening,
                income,
                expense,
                closing,
                updated_at
            ) values (
                v_shop_brand_id,
                p_shop_id,
                v_d,
                coalesce(v_prev_closing, 0),
                v_day_income,
                v_day_expense,
                coalesce(v_prev_closing, 0) + v_day_income - v_day_expense,
                now()
            )
            on conflict (shop_id, date) do update set
                income = excluded.income,
                expense = excluded.expense,
                closing = public.daily_summary.opening + excluded.income - excluded.expense,
                updated_at = now();
        end loop;
    end if;

    -- If import_batch_id was provided, increment rows_added in import_batches
    if p_import_batch_id is not null and v_imported_count > 0 then
        update public.import_batches
        set rows_added = rows_added + v_imported_count,
            metadata = jsonb_set(
                coalesce(metadata, '{}'::jsonb),
                '{last_chunk_at}',
                to_jsonb(now()::text)
            )
        where id = p_import_batch_id;
    end if;

    -- Audit log
    insert into public.audit_log (
        user_id,
        action,
        table_name,
        record_id,
        new_data
    ) values (
        v_user_id,
        'IMPORT_EXCEL',
        'transactions',
        p_shop_id,
        jsonb_build_object(
            'shop_id', p_shop_id,
            'month', p_month,
            'imported_count', v_imported_count,
            'skipped_count', v_skipped_count,
            'import_batch_id', p_import_batch_id
        )
    );

    return jsonb_build_object(
        'success', true,
        'imported_count', v_imported_count,
        'skipped_count', v_skipped_count,
        'duplicates', v_duplicates
    );
end;
$$;

revoke all on function public.rpc_admin_import_excel_chunk(uuid, text, numeric, uuid, jsonb) from public;
grant execute on function public.rpc_admin_import_excel_chunk(uuid, text, numeric, uuid, jsonb) to authenticated, service_role;


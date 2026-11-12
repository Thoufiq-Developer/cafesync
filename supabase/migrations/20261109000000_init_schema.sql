-- ==============================================================================
-- CafeLedger - Initial Schema Migration
-- Multi-tenant, White-Label Cafe Accounts Web App
-- ==============================================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. BRANDS
-- ------------------------------------------------------------------------------
create table public.brands (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    registration_no text unique not null,
    logo_url text,
    primary_color text not null default '#ea580c', -- warm cafe orange
    secondary_color text not null default '#9a3412',
    address text,
    phone text,
    email text,
    gstin text,
    status text not null default 'active' check (status in ('active', 'suspended')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 2. SHOPS
-- ------------------------------------------------------------------------------
create table public.shops (
    id uuid primary key default gen_random_uuid(),
    brand_id uuid not null references public.brands(id) on delete cascade,
    name text not null,
    code text not null,
    address text,
    phone text,
    status text not null default 'active' check (status in ('active', 'inactive')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (brand_id, code)
);

-- ------------------------------------------------------------------------------
-- 3. PROFILES (Linked to auth.users)
-- ------------------------------------------------------------------------------
create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('master', 'admin', 'manager')),
    brand_id uuid references public.brands(id) on delete set null,
    shop_id uuid references public.shops(id) on delete set null,
    full_name text not null,
    phone text,
    is_active boolean not null default true,
    must_change_password boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 4. ITEMS (Income & Expense categories, soft-delete only)
-- ------------------------------------------------------------------------------
create table public.items (
    id uuid primary key default gen_random_uuid(),
    brand_id uuid not null references public.brands(id) on delete cascade,
    name text not null,
    kind text not null check (kind in ('income', 'expense')),
    category text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 5. PAYMENT MODES (CASH, GPAY, BANK, CARD, etc., soft-delete only)
-- ------------------------------------------------------------------------------
create table public.payment_modes (
    id uuid primary key default gen_random_uuid(),
    brand_id uuid not null references public.brands(id) on delete cascade,
    name text not null,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (brand_id, name)
);

-- ------------------------------------------------------------------------------
-- 6. EMPLOYEES
-- ------------------------------------------------------------------------------
create table public.employees (
    id uuid primary key default gen_random_uuid(),
    brand_id uuid not null references public.brands(id) on delete cascade,
    shop_id uuid not null references public.shops(id) on delete cascade,
    name text not null,
    phone text,
    role_title text,
    rate_per_day numeric(10,2) not null default 0.00,
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 7. TRANSACTIONS
-- ------------------------------------------------------------------------------
create table public.transactions (
    id uuid primary key default gen_random_uuid(),
    brand_id uuid not null references public.brands(id) on delete cascade,
    shop_id uuid not null references public.shops(id) on delete cascade,
    txn_date date not null,
    kind text not null check (kind in ('income', 'expense')),
    item_id uuid references public.items(id) on delete set null,
    item_name_snapshot text not null,
    mode_id uuid references public.payment_modes(id) on delete set null,
    mode_name_snapshot text not null,
    amount numeric(12,2) not null check (amount >= 0),
    note text,
    employee_id uuid references public.employees(id) on delete set null,
    txn_type text not null default 'normal' check (txn_type in ('normal', 'salary_advance', 'salary_payment')),
    created_by uuid references auth.users(id) on delete set null,
    is_deleted boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 8. MONTH OPENINGS (Carried forward closing or manual override)
-- ------------------------------------------------------------------------------
create table public.month_openings (
    id uuid primary key default gen_random_uuid(),
    shop_id uuid not null references public.shops(id) on delete cascade,
    month text not null check (month ~ '^\d{4}-\d{2}$'),
    opening_balance numeric(12,2) not null default 0.00,
    is_manual boolean not null default false,
    note text,
    closed_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (shop_id, month)
);

-- ------------------------------------------------------------------------------
-- 9. DAILY SUMMARY (Maintained via trigger/functions)
-- ------------------------------------------------------------------------------
create table public.daily_summary (
    id uuid primary key default gen_random_uuid(),
    shop_id uuid not null references public.shops(id) on delete cascade,
    summary_date date not null,
    opening numeric(12,2) not null default 0.00,
    income numeric(12,2) not null default 0.00,
    expense numeric(12,2) not null default 0.00,
    closing numeric(12,2) not null default 0.00,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (shop_id, summary_date)
);

-- ------------------------------------------------------------------------------
-- 10. SALARY RECORDS
-- ------------------------------------------------------------------------------
create table public.salary_records (
    id uuid primary key default gen_random_uuid(),
    shop_id uuid not null references public.shops(id) on delete cascade,
    employee_id uuid not null references public.employees(id) on delete cascade,
    month text not null check (month ~ '^\d{4}-\d{2}$'),
    days_worked numeric(5,1) not null default 0.0,
    rate_snapshot numeric(10,2) not null default 0.00,
    gross numeric(12,2) not null default 0.00,
    advances_total numeric(12,2) not null default 0.00,
    paid_total numeric(12,2) not null default 0.00,
    balance numeric(12,2) not null default 0.00,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (shop_id, employee_id, month)
);

-- ------------------------------------------------------------------------------
-- 11. ASSETS
-- ------------------------------------------------------------------------------
create table public.assets (
    id uuid primary key default gen_random_uuid(),
    brand_id uuid not null references public.brands(id) on delete cascade,
    shop_id uuid not null references public.shops(id) on delete cascade,
    name text not null,
    category text not null check (category in ('freezer', 'fryer', 'lights', 'chiller', 'grinder', 'other')),
    model text,
    serial_no text,
    purchase_date date,
    cost numeric(12,2),
    vendor text,
    status text not null default 'working' check (status in ('working', 'needs_repair', 'out_of_service')),
    last_service_date date,
    service_interval_days integer,
    next_service_due date,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 12. ASSET SERVICE LOGS
-- ------------------------------------------------------------------------------
create table public.asset_service_logs (
    id uuid primary key default gen_random_uuid(),
    asset_id uuid not null references public.assets(id) on delete cascade,
    service_date date not null,
    vendor text,
    cost numeric(12,2) not null default 0.00,
    notes text,
    next_due date,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 13. ITEM REQUESTS (Shop managers request brand admins for new item categories)
-- ------------------------------------------------------------------------------
create table public.item_requests (
    id uuid primary key default gen_random_uuid(),
    shop_id uuid not null references public.shops(id) on delete cascade,
    requested_by uuid references auth.users(id) on delete set null,
    name text not null,
    kind text not null check (kind in ('income', 'expense')),
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 14. AUDIT LOG
-- ------------------------------------------------------------------------------
create table public.audit_log (
    id uuid primary key default gen_random_uuid(),
    user_id uuid references auth.users(id) on delete set null,
    action text not null,
    table_name text not null,
    record_id uuid not null,
    old_data jsonb,
    new_data jsonb,
    at timestamptz not null default now()
);

-- ==============================================================================
-- REQUIRED INDEXES (PERFORMANCE & SCALE RULES)
-- ==============================================================================
create index idx_transactions_shop_txn_date on public.transactions(shop_id, txn_date desc) where not is_deleted;
create index idx_transactions_brand_txn_date on public.transactions(brand_id, txn_date desc) where not is_deleted;
create index idx_assets_shop_next_service on public.assets(shop_id, next_service_due);
create index idx_salary_records_shop_month on public.salary_records(shop_id, month);
create index idx_daily_summary_shop_date on public.daily_summary(shop_id, summary_date desc);
create index idx_profiles_role on public.profiles(role);
create index idx_profiles_brand_id on public.profiles(brand_id);
create index idx_profiles_shop_id on public.profiles(shop_id);
create index idx_shops_brand_id on public.shops(brand_id);


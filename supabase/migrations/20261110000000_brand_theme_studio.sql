-- ==============================================================================
-- CafeLedger - Brand Theme Engine & Master Theme Studio Migration
-- Adds brands.slug, profiles.theme_mode, brand_settings, strict RLS,
-- Storage bucket "brand-assets", and public login RPC.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BRANDS.SLUG (Unique, auto-generated from brand name, editable by master)
-- ------------------------------------------------------------------------------
alter table public.brands
  add column if not exists slug text;

create or replace function public.slugify_brand_name(p_name text)
returns text as $$
declare
  v_base text;
begin
  v_base := lower(trim(coalesce(p_name, '')));
  v_base := regexp_replace(v_base, '&', ' and ', 'g');
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '-', 'g');
  v_base := regexp_replace(v_base, '^-+|-+$', '', 'g');
  if v_base = '' then
    v_base := 'brand';
  end if;
  return v_base;
end;
$$ language plpgsql immutable;

create or replace function public.generate_unique_brand_slug(
  p_name text,
  p_exclude_brand_id uuid default null
)
returns text as $$
declare
  v_base text;
  v_candidate text;
  v_suffix int := 1;
begin
  v_base := public.slugify_brand_name(p_name);
  v_candidate := v_base;

  while exists (
    select 1
    from public.brands b
    where b.slug = v_candidate
      and (p_exclude_brand_id is null or b.id <> p_exclude_brand_id)
  ) loop
    v_suffix := v_suffix + 1;
    v_candidate := v_base || '-' || v_suffix::text;
  end loop;

  return v_candidate;
end;
$$ language plpgsql stable;

-- Backfill existing brands without slugs
do $$
declare
  rec record;
begin
  for rec in
    select id, name
    from public.brands
    where slug is null or trim(slug) = ''
    order by created_at asc
  loop
    update public.brands
    set slug = public.generate_unique_brand_slug(rec.name, rec.id)
    where id = rec.id;
  end loop;
end $$;

alter table public.brands
  alter column slug set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'brands_slug_unique'
  ) then
    alter table public.brands add constraint brands_slug_unique unique (slug);
  end if;
end $$;

alter table public.brands
  drop constraint if exists brands_slug_format_check;

alter table public.brands
  add constraint brands_slug_format_check
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');

create or replace function public.trg_brands_ensure_slug()
returns trigger as $$
begin
  if new.slug is null or trim(new.slug) = '' then
    new.slug := public.generate_unique_brand_slug(new.name, new.id);
  else
    new.slug := public.slugify_brand_name(new.slug);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_brands_auto_slug on public.brands;
create trigger trg_brands_auto_slug
before insert or update on public.brands
for each row execute function public.trg_brands_ensure_slug();

-- ------------------------------------------------------------------------------
-- 2. PROFILES.THEME_MODE (Only honored when allow_user_mode_switch is true)
-- ------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists theme_mode text not null default 'light';

alter table public.profiles
  drop constraint if exists profiles_theme_mode_check;

alter table public.profiles
  add constraint profiles_theme_mode_check
  check (theme_mode in ('light', 'dark'));

-- ------------------------------------------------------------------------------
-- 3. BRAND_SETTINGS TABLE
-- ------------------------------------------------------------------------------
create table if not exists public.brand_settings (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  logo_url text,
  logo_dark_url text,
  icon_url text,
  login_bg_url text,
  login_bg_color text,
  display_name text not null,
  tagline text,
  welcome_message text,
  primary_color text not null default '#ea580c',
  secondary_color text not null default '#9a3412',
  accent_color text not null default '#f59e0b',
  font_family text not null default 'Inter',
  radius text not null default 'rounded' check (radius in ('sharp', 'rounded', 'pill')),
  sidebar_style text not null default 'light' check (sidebar_style in ('light', 'dark', 'brand')),
  density text not null default 'comfortable' check (density in ('comfortable', 'compact')),
  default_mode text not null default 'light' check (default_mode in ('light', 'dark')),
  allow_user_mode_switch boolean not null default false,
  login_layout text not null default 'split' check (login_layout in ('split', 'centered')),
  login_logo_size text not null default 'md' check (login_logo_size in ('sm', 'md', 'lg')),
  pdf_header_style text not null default 'left' check (pdf_header_style in ('left', 'centered')),
  pdf_footer_text text,
  pdf_show_address boolean not null default true,
  pdf_show_gstin boolean not null default true,
  pdf_show_registration_no boolean not null default true,
  pdf_signature_line boolean not null default false,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_brand_settings_updated_at on public.brand_settings;
create trigger trg_brand_settings_updated_at
before update on public.brand_settings
for each row execute function public.handle_updated_at();

-- Backfill brand_settings for all existing brands
insert into public.brand_settings (
  brand_id,
  logo_url,
  display_name,
  tagline,
  welcome_message,
  primary_color,
  secondary_color,
  accent_color
)
select
  b.id,
  b.logo_url,
  b.name,
  'Multi-Outlet Cafe Accounts & Operations',
  'Welcome back to ' || b.name,
  coalesce(nullif(b.primary_color, ''), '#ea580c'),
  coalesce(nullif(b.secondary_color, ''), '#9a3412'),
  '#f59e0b'
from public.brands b
on conflict (brand_id) do nothing;

-- Auto-seed brand_settings whenever master creates a new brand
create or replace function public.trg_brands_seed_settings()
returns trigger as $$
begin
  insert into public.brand_settings (
    brand_id,
    logo_url,
    display_name,
    tagline,
    welcome_message,
    primary_color,
    secondary_color,
    accent_color
  )
  values (
    new.id,
    new.logo_url,
    new.name,
    'Cafe Operations & Financial Ledger',
    'Welcome back to ' || new.name,
    coalesce(nullif(new.primary_color, ''), '#ea580c'),
    coalesce(nullif(new.secondary_color, ''), '#9a3412'),
    '#f59e0b'
  )
  on conflict (brand_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_brands_auto_settings on public.brands;
create trigger trg_brands_auto_settings
after insert on public.brands
for each row execute function public.trg_brands_seed_settings();

-- Dedicated audit trigger for brand_settings (PK is brand_id)
create or replace function public.log_brand_settings_audit()
returns trigger as $$
begin
  if tg_op = 'DELETE' then
    insert into public.audit_log (user_id, action, table_name, record_id, old_data, at)
    values (auth.uid(), 'DELETE', 'brand_settings', old.brand_id, to_jsonb(old), now());
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_log (user_id, action, table_name, record_id, old_data, new_data, at)
    values (auth.uid(), 'UPDATE', 'brand_settings', new.brand_id, to_jsonb(old), to_jsonb(new), now());
    return new;
  elsif tg_op = 'INSERT' then
    insert into public.audit_log (user_id, action, table_name, record_id, new_data, at)
    values (auth.uid(), 'INSERT', 'brand_settings', new.brand_id, to_jsonb(new), now());
    return new;
  end if;
  return null;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists audit_brand_settings on public.brand_settings;
create trigger audit_brand_settings
after insert or update or delete on public.brand_settings
for each row execute function public.log_brand_settings_audit();

-- ------------------------------------------------------------------------------
-- 4. STRICT RLS POLICIES (MASTER WRITE ONLY, TENANT READ-ONLY OWN BRAND)
-- ------------------------------------------------------------------------------

-- Tighten brands policy (previously "for all" allowed tenant updates!)
drop policy if exists "Brands access policy" on public.brands;
drop policy if exists "Master full access brands" on public.brands;
drop policy if exists "Tenant read own brand" on public.brands;

create policy "Master full access brands"
  on public.brands for all to authenticated
  using (public.auth_role() = 'master')
  with check (public.auth_role() = 'master');

create policy "Tenant read own brand"
  on public.brands for select to authenticated
  using (
    public.auth_role() in ('admin', 'manager')
    and id = public.auth_brand_id()
  );

-- brand_settings RLS: master all, admin/manager read own brand only
alter table public.brand_settings enable row level security;

drop policy if exists "Master full access brand_settings" on public.brand_settings;
drop policy if exists "Tenant read own brand_settings" on public.brand_settings;

create policy "Master full access brand_settings"
  on public.brand_settings for all to authenticated
  using (public.auth_role() = 'master')
  with check (public.auth_role() = 'master');

create policy "Tenant read own brand_settings"
  on public.brand_settings for select to authenticated
  using (
    public.auth_role() in ('admin', 'manager')
    and brand_id = public.auth_brand_id()
  );

-- ------------------------------------------------------------------------------
-- 5. SUPABASE STORAGE BUCKET "brand-assets" + GRANULAR RLS
-- ------------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  true,
  2097152, -- 2MB max
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

drop policy if exists "Master upload brand-assets" on storage.objects;
drop policy if exists "Master update brand-assets" on storage.objects;
drop policy if exists "Master delete brand-assets" on storage.objects;
drop policy if exists "Public logo read brand-assets" on storage.objects;
drop policy if exists "Authenticated scoped read brand-assets" on storage.objects;

create policy "Master upload brand-assets"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'brand-assets'
    and public.auth_role() = 'master'
  );

create policy "Master update brand-assets"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'brand-assets'
    and public.auth_role() = 'master'
  )
  with check (
    bucket_id = 'brand-assets'
    and public.auth_role() = 'master'
  );

create policy "Master delete brand-assets"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'brand-assets'
    and public.auth_role() = 'master'
  );

-- Publicly readable brand login visual assets for /login/[slug]
create policy "Public logo read brand-assets"
  on storage.objects for select to anon
  using (
    bucket_id = 'brand-assets'
    and (
      name ~ '/logo[^/]*$'
      or name ~ '/icon[^/]*$'
      or name ~ '/login-bg[^/]*$'
    )
  );

-- Authenticated admins & managers can only inspect objects inside their own {brand_id}/ folder
create policy "Authenticated scoped read brand-assets"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'brand-assets'
    and (
      public.auth_role() = 'master'
      or (storage.foldername(name))[1] = public.auth_brand_id()::text
    )
  );

-- ------------------------------------------------------------------------------
-- 6. SAFE PUBLIC LOGIN LOOKUP RPC (BY SLUG ONLY — PREVENTS CROSS-TENANT READS)
-- ------------------------------------------------------------------------------
create or replace function public.get_public_brand_login(p_slug text)
returns table (
  brand_id uuid,
  brand_name text,
  slug text,
  status text,
  display_name text,
  tagline text,
  welcome_message text,
  logo_url text,
  logo_dark_url text,
  icon_url text,
  login_bg_url text,
  login_bg_color text,
  primary_color text,
  secondary_color text,
  accent_color text,
  font_family text,
  radius text,
  default_mode text,
  login_layout text,
  login_logo_size text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.id as brand_id,
    b.name as brand_name,
    b.slug,
    b.status,
    coalesce(bs.display_name, b.name) as display_name,
    bs.tagline,
    bs.welcome_message,
    coalesce(bs.logo_url, b.logo_url) as logo_url,
    bs.logo_dark_url,
    bs.icon_url,
    bs.login_bg_url,
    bs.login_bg_color,
    coalesce(bs.primary_color, b.primary_color, '#ea580c') as primary_color,
    coalesce(bs.secondary_color, b.secondary_color, '#9a3412') as secondary_color,
    coalesce(bs.accent_color, '#f59e0b') as accent_color,
    coalesce(bs.font_family, 'Inter') as font_family,
    coalesce(bs.radius, 'rounded') as radius,
    coalesce(bs.default_mode, 'light') as default_mode,
    coalesce(bs.login_layout, 'split') as login_layout,
    coalesce(bs.login_logo_size, 'md') as login_logo_size
  from public.brands b
  left join public.brand_settings bs on bs.brand_id = b.id
  where b.slug = lower(trim(p_slug))
  limit 1;
$$;

revoke all on function public.get_public_brand_login(text) from public;
grant execute on function public.get_public_brand_login(text) to anon, authenticated;


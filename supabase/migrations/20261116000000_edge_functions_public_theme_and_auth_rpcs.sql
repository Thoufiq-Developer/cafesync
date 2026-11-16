-- ==============================================================================
-- CafeSync - Migration 20261116000000
-- Zero-Service-Role Edge Functions & Secure RPC Support
-- Provides get_public_brand_theme(slug), get_auth_user_emails(), and
-- get_login_email_for_username(username, brand_id).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. RPC: get_public_brand_theme(slug)
-- Returns public-safe theme styling and brand identity fields without requiring
-- any privileged keys. Accessible to anonymous and authenticated users.
-- Accepts either parameter name 'slug' or 'p_slug'.
-- ------------------------------------------------------------------------------
create or replace function public.get_public_brand_theme(slug text default null, p_slug text default null)
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
  where b.slug = lower(trim(coalesce(slug, p_slug, '')))
  limit 1;
$$;

revoke all on function public.get_public_brand_theme(text, text) from public;
grant execute on function public.get_public_brand_theme(text, text) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. RPC: get_auth_user_emails()
-- Returns user_id -> email for users within the caller's authorized scope:
-- - Platform Master ('master', 'platform_admin'): returns all users
-- - Brand Admin ('admin', 'brand_admin'): returns only users belonging to caller's brand
-- - Others: returns empty set
-- ------------------------------------------------------------------------------
create or replace function public.get_auth_user_emails()
returns table (
  user_id uuid,
  email text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_brand_id uuid;
begin
  select role, brand_id into v_role, v_brand_id
  from public.profiles
  where id = auth.uid();

  if v_role in ('master', 'platform_admin') then
    return query
    select u.id, u.email::text
    from auth.users u;
  elsif v_role in ('admin', 'brand_admin') and v_brand_id is not null then
    return query
    select u.id, u.email::text
    from auth.users u
    join public.profiles p on p.id = u.id
    where p.brand_id = v_brand_id;
  else
    return;
  end if;
end;
$$;

revoke all on function public.get_auth_user_emails() from public;
grant execute on function public.get_auth_user_emails() to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. RPC: get_login_email_for_username(p_username, p_brand_id)
-- Allows the sign-in form to resolve a manager/admin username to their auth email
-- safely without needing a service role key in the client or Next.js server action.
-- ------------------------------------------------------------------------------
create or replace function public.get_login_email_for_username(
  p_username text,
  p_brand_id uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_email text;
  v_count integer;
begin
  if p_username is null or trim(p_username) = '' then
    return null;
  end if;

  if p_brand_id is not null then
    select p.id, u.email::text
    into v_user_id, v_email
    from public.profiles p
    join auth.users u on u.id = p.id
    where lower(trim(p.username)) = lower(trim(p_username))
      and p.brand_id = p_brand_id
    limit 1;

    return v_email;
  else
    select count(*), max(p.id)
    into v_count, v_user_id
    from public.profiles p
    where lower(trim(p.username)) = lower(trim(p_username));

    if v_count = 1 then
      select u.email::text into v_email
      from auth.users u
      where u.id = v_user_id;

      return v_email;
    else
      -- 0 or multiple matches across brands -> caller must specify brand
      return null;
    end if;
  end if;
end;
$$;

revoke all on function public.get_login_email_for_username(text, uuid) from public;
grant execute on function public.get_login_email_for_username(text, uuid) to anon, authenticated, service_role;

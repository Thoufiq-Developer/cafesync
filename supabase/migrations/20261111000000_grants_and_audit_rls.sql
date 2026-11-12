-- ==============================================================================
-- CafeLedger - Schema Grants & Audit Log Insert Policy Fix
-- Ensures PostgreSQL schema/table/sequence/function privileges are explicitly
-- granted to authenticated & service_role, and lets authenticated users insert
-- audit_log rows scoped to their own auth.uid().
-- ==============================================================================

-- 1. Schema & object privileges (safe alongside strict RLS on every table)
grant usage on schema public to anon, authenticated, service_role;

grant all on all tables in schema public to service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;

grant all on all sequences in schema public to authenticated, service_role;
grant execute on all functions in schema public to authenticated, service_role;
grant execute on function public.get_public_brand_login(text) to anon, authenticated;

alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant all on sequences to authenticated, service_role;
alter default privileges in schema public
  grant execute on functions to authenticated, service_role;

-- 2. Audit log RLS: master sees all; admin sees only their own brand's events;
-- authenticated master/admin/manager can insert rows scoped to their own auth.uid().
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

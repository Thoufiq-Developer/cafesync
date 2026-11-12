import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUserContext } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { tryGetAdminClient } from '@/lib/supabase/admin';
import { DEMO_GLOBAL_AUDIT_LOGS } from '@/lib/demo-master-data';
import { DEMO_AUDIT_LOGS, DEMO_ADMIN_SHOPS } from '@/lib/demo-admin-data';
import { readDemoThemeAudits } from '@/lib/theme/store';
import {
  formatActivityEntry,
  normalizeJsonPayload,
  RawAuditRow,
  ActivityTypeFilter,
} from '@/lib/audit/format-activity';

export const dynamic = 'force-dynamic';

const DEMO_READ_AT_COOKIE = 'cafeledger_activity_read_at';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserContext();
    if (!user || (user.role !== 'master' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const shopFilter = searchParams.get('shopId') || 'all';
    const userFilter = searchParams.get('userId') || 'all';
    const typeFilter = (searchParams.get('type') || 'all') as ActivityTypeFilter;
    const brandFilter = searchParams.get('brandId') || 'all';

    const cookieStore = await cookies();
    let readAt: string | null = cookieStore.get(DEMO_READ_AT_COOKIE)?.value || null;

    if (!isSupabaseConfigured()) {
      const rawRows: RawAuditRow[] =
        user.role === 'master'
          ? [
              ...readDemoThemeAudits().map((a) => ({
                id: a.id,
                action: a.action,
                table_name: a.table_name,
                record_id: a.brand_id,
                new_data: { brand_name: a.brand_name, details: a.details },
                at: a.at,
                user_name: a.user_name,
                user_role: 'master',
                brand_id: a.brand_id,
                brand_name: a.brand_name,
              })),
              ...DEMO_GLOBAL_AUDIT_LOGS.map((g, i) => ({
                id: g.id,
                action: g.action,
                table_name: g.table_name,
                record_id: g.record_id,
                new_data: { details: g.details },
                at: new Date(Date.now() - i * 3600 * 1000 * 6).toISOString(),
                user_name: g.user_name,
                user_role: g.user_role,
                brand_name: g.brand_name,
              })),
            ]
          : DEMO_AUDIT_LOGS.map((l, i) => ({
              id: l.id,
              action: l.action,
              table_name: l.table_name,
              record_id: l.record_id,
              new_data: { details: l.details },
              at: new Date(Date.now() - i * 3600 * 1000 * 5).toISOString(),
              user_name: l.user_name,
              brand_id: user.brandId || 'demo-brand-1',
            }));

      const formatted = rawRows.map((row) => {
        const entry = formatActivityEntry(row, user.role);
        return {
          ...entry,
          isUnread: !readAt || new Date(entry.at).getTime() > new Date(readAt).getTime(),
        };
      });

      const unreadCount = formatted.filter((x) => x.isUnread).length;
      const filtered = formatted.filter((x) => {
        if (shopFilter !== 'all' && x.shopId !== shopFilter) return false;
        if (userFilter !== 'all' && x.actorName !== userFilter && x.actorId !== userFilter) return false;
        if (typeFilter !== 'all' && x.type !== typeFilter) return false;
        return true;
      });

      return NextResponse.json({
        items: filtered,
        unreadCount,
        readAt,
        shops: DEMO_ADMIN_SHOPS.map((s) => ({ id: s.id, name: s.name })),
        users: Array.from(new Set(formatted.map((i) => i.actorName))).map((n) => ({
          id: n,
          name: n,
        })),
      });
    }

    const adminDb = (tryGetAdminClient() || (await createClient())) as any;

    // Fetch readAt for current profile
    const { data: myProfile } = await adminDb
      .from('profiles')
      .select('activity_read_at')
      .eq('id', user.id)
      .maybeSingle();

    if (myProfile?.activity_read_at) {
      readAt = myProfile.activity_read_at;
    }

    // Build lookups for clean names (brand, shop, profile)
    const [brandsRes, shopsRes, profilesRes, logsRes] = await Promise.all([
      user.role === 'master'
        ? adminDb.from('brands').select('id, name')
        : adminDb.from('brands').select('id, name').eq('id', user.brandId),
      user.role === 'master'
        ? adminDb.from('shops').select('id, name, brand_id')
        : adminDb.from('shops').select('id, name, brand_id').eq('brand_id', user.brandId),
      user.role === 'master'
        ? adminDb.from('profiles').select('id, full_name, role, brand_id, shop_id')
        : adminDb.from('profiles').select('id, full_name, role, brand_id, shop_id').eq('brand_id', user.brandId),
      adminDb
        .from('audit_log')
        .select('*')
        .order('at', { ascending: false })
        .limit(user.role === 'master' ? 80 : 120),
    ]);

    const brandMap = new Map<string, string>();
    (brandsRes.data || []).forEach((b: any) => brandMap.set(b.id, b.name));

    const shopMap = new Map<string, { name: string; brandId: string }>();
    (shopsRes.data || []).forEach((s: any) => shopMap.set(s.id, { name: s.name, brandId: s.brand_id }));

    const profileMap = new Map<string, { id: string; full_name: string; role: string; brand_id: string | null; shop_id: string | null }>();
    (profilesRes.data || []).forEach((p: any) => profileMap.set(p.id, p));

    const rawLogs: any[] = logsRes.data || [];

    // Collect any foreign actor IDs not yet in profileMap (for Master inspecting Master logs)
    const missingIds = Array.from(
      new Set(rawLogs.map((l) => l.user_id).filter((id: string | null) => id && !profileMap.has(id)))
    );
    if (missingIds.length > 0 && user.role === 'master') {
      const { data: extraProfs } = await adminDb
        .from('profiles')
        .select('id, full_name, role, brand_id, shop_id')
        .in('id', missingIds);
      (extraProfs || []).forEach((p: any) => profileMap.set(p.id, p));
    }

    const enriched: RawAuditRow[] = [];

    for (const log of rawLogs) {
      const newObj = normalizeJsonPayload(log.new_data);
      const oldObj = normalizeJsonPayload(log.old_data);
      const payload = newObj || oldObj || {};
      const actorProf = log.user_id ? profileMap.get(log.user_id) : null;

      let resolvedShopId: string | null =
        payload.shop_id ||
        actorProf?.shop_id ||
        (log.table_name === 'shops' ? log.record_id : null) ||
        null;

      let resolvedBrandId: string | null =
        payload.brand_id ||
        (resolvedShopId ? shopMap.get(resolvedShopId)?.brandId || null : null) ||
        actorProf?.brand_id ||
        (log.table_name === 'brands' || log.table_name === 'brand_settings' ? log.record_id : null) ||
        null;

      // Strict tenant isolation for Brand Admin
      if (user.role === 'admin') {
        const belongsToBrand =
          resolvedBrandId === user.brandId ||
          (resolvedShopId !== null && shopMap.has(resolvedShopId)) ||
          (log.user_id !== null && profileMap.has(log.user_id));

        if (!belongsToBrand) {
          continue;
        }
        resolvedBrandId = user.brandId!;
      }

      if (user.role === 'master' && brandFilter !== 'all' && resolvedBrandId !== brandFilter) {
        continue;
      }

      const resolvedShopName = resolvedShopId ? shopMap.get(resolvedShopId)?.name || null : null;
      const resolvedBrandName = resolvedBrandId ? brandMap.get(resolvedBrandId) || null : null;

      enriched.push({
        id: log.id,
        user_id: log.user_id,
        action: log.action,
        table_name: log.table_name,
        record_id: log.record_id,
        old_data: oldObj,
        new_data: newObj,
        at: log.at,
        user_name: actorProf?.full_name || null,
        user_role: actorProf?.role || null,
        brand_id: resolvedBrandId,
        brand_name: resolvedBrandName,
        shop_id: resolvedShopId,
        shop_name: resolvedShopName,
      });
    }

    const formatted = enriched.slice(0, 60).map((row) => {
      const item = formatActivityEntry(row, user.role);
      return {
        ...item,
        isUnread: !readAt || new Date(item.at).getTime() > new Date(readAt).getTime(),
      };
    });

    const unreadCount = formatted.filter((x) => x.isUnread).length;

    const filtered = formatted.filter((item) => {
      if (shopFilter !== 'all' && item.shopId !== shopFilter) return false;
      if (userFilter !== 'all' && item.actorId !== userFilter && item.actorName !== userFilter) return false;
      if (typeFilter !== 'all' && item.type !== typeFilter) return false;
      return true;
    });

    const uniqueUsers = new Map<string, string>();
    formatted.forEach((f) => {
      const key = f.actorId || f.actorName;
      if (!uniqueUsers.has(key)) uniqueUsers.set(key, f.actorName);
    });

    return NextResponse.json({
      items: filtered,
      unreadCount,
      readAt,
      shops: (shopsRes.data || []).map((s: any) => ({ id: s.id, name: s.name })),
      users: Array.from(uniqueUsers.entries()).map(([id, name]) => ({ id, name })),
    });
  } catch (err: any) {
    console.error('Activity API GET error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to load activity' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await getCurrentUserContext();
    if (!user || (user.role !== 'master' && user.role !== 'admin')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const nowIso = new Date().toISOString();

    if (isSupabaseConfigured()) {
      const adminDb = (tryGetAdminClient() || (await createClient())) as any;
      await adminDb
        .from('profiles')
        .update({ activity_read_at: nowIso })
        .eq('id', user.id);
    }

    const res = NextResponse.json({ success: true, readAt: nowIso });
    res.cookies.set(DEMO_READ_AT_COOKIE, nowIso, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });
    return res;
  } catch (err: any) {
    console.error('Activity API POST error:', err);
    return NextResponse.json({ error: err?.message || 'Failed to update read status' }, { status: 500 });
  }
}

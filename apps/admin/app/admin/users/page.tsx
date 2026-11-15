import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { UsersManager, ManagerUserRecord } from '@/components/admin/users-manager';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getAuthEmailMap } from '@/lib/supabase/user-emails';
import { DEMO_ADMIN_SHOPS, DemoShop } from '@/lib/demo-admin-data';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    redirect('/login');
  }

  const isLive = isSupabaseConfigured();
  const supabase = (await createClient()) as any;

  const fetchShops = async () => {
    const res = await supabase
      .from('shops')
      .select('*, profiles!shop_id(id, full_name, username, phone, is_active)')
      .eq('brand_id', user.brandId)
      .order('name', { ascending: true });
    if (!res.error) return res.data as any[] | null;

    const legacy = await supabase
      .from('shops')
      .select('*, profiles!shop_id(id, full_name, phone, is_active)')
      .eq('brand_id', user.brandId)
      .order('name', { ascending: true });
    return (legacy.data as any[] | null) || null;
  };

  const [emailMap, dbShops, dbProfilesRes] = await Promise.all([
    isLive ? getAuthEmailMap() : Promise.resolve(new Map<string, string>()),
    fetchShops(),
    supabase
      .from('profiles')
      .select('*, shops!shop_id(name, code)')
      .eq('brand_id', user.brandId)
      .eq('role', 'manager')
      .order('created_at', { ascending: false }),
  ]);

  // 1. Shops
  let shops: DemoShop[] = isLive ? [] : DEMO_ADMIN_SHOPS;

  if (dbShops && dbShops.length > 0) {
    shops = dbShops.map((s) => ({
      id: s.id,
      brand_id: s.brand_id,
      name: s.name,
      code: s.code,
      address: s.address || '',
      phone: s.phone || '',
      status: s.status,
      created_at: s.created_at,
      managers: Array.isArray(s.profiles)
        ? s.profiles.map((p: any) => ({
            id: p.id,
            full_name: p.full_name,
            phone: p.phone || '',
            email: emailMap.get(p.id) || '',
            username: p.username || null,
            is_active: p.is_active !== false,
          }))
        : [],
    }));
  }

  // 2. Manager profiles
  let users: ManagerUserRecord[] = [];
  const dbProfiles = dbProfilesRes?.data as any[] | null;

  if (dbProfiles && dbProfiles.length > 0) {
    users = dbProfiles.map((p) => {
      const authEmail = emailMap.get(p.id) || '';
      return {
        id: p.id,
        fullName: p.full_name,
        username: p.username || (authEmail ? authEmail.split('@')[0] : ''),
        email: authEmail,
        phone: p.phone,
        shopId: p.shop_id || shops[0]?.id || '',
        shopName: p.shops?.name || 'Unassigned',
        shopCode: p.shops?.code || 'UNASSIGNED',
        isActive: p.is_active,
        mustChangePassword: p.must_change_password,
        createdAt: p.created_at,
      };
    });
  } else if (!isLive) {
    // Demo Fallback Managers across shops
    users = shops.map((s, idx) => {
      const demoEmail = s.managers[0]?.email || `manager.${s.code.toLowerCase()}@snaxia.in`;
      return {
        id: s.managers[0]?.id || `demo-mgr-${idx + 1}`,
        fullName: s.managers[0]?.full_name || `Manager ${s.name}`,
        username: s.managers[0]?.username || demoEmail.split('@')[0],
        email: demoEmail,
        phone: s.managers[0]?.phone || s.phone,
        shopId: s.id,
        shopName: s.name,
        shopCode: s.code,
        isActive: true,
        mustChangePassword: idx % 3 === 0,
        createdAt: '2025-01-15T00:00:00Z',
      };
    });
  }

  let brandSlug = user.brand?.slug || '';
  if (!brandSlug && isLive) {
    const { data: brandRow } = (await supabase
      .from('brands')
      .select('slug')
      .eq('id', user.brandId)
      .maybeSingle()) as { data: { slug?: string } | null };
    brandSlug = brandRow?.slug || '';
  }
  if (!brandSlug) brandSlug = 'brand';

  const adminUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    phone: user.phone,
    brandId: user.brandId,
    mustChangePassword: user.mustChangePassword,
    role: 'admin' as const,
  };

  return (
    <SharedAppLayout user={adminUser} brand={user.brand}>
      <UsersManager initialUsers={users} shops={shops} brandSlug={brandSlug} />
    </SharedAppLayout>
  );
}


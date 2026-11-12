import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { ShopsList } from '@/components/admin/shops-list';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getAuthEmailMap } from '@/lib/supabase/user-emails';
import { DEMO_ADMIN_SHOPS, DemoShop } from '@/lib/demo-admin-data';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminShopsPage() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    redirect('/login');
  }

  const isLive = isSupabaseConfigured();
  const supabase = (await createClient()) as any;

  let shops: DemoShop[] = isLive ? [] : DEMO_ADMIN_SHOPS;

  const fetchShops = async () => {
    const res = await supabase
      .from('shops')
      .select('*, profiles!shop_id(id, full_name, username, phone, is_active, must_change_password)')
      .eq('brand_id', user.brandId)
      .order('name', { ascending: true });
    if (!res.error) return res.data as any[] | null;

    // Fallback if optional migration columns (username) are not yet applied
    const legacy = await supabase
      .from('shops')
      .select('*, profiles!shop_id(id, full_name, phone, is_active, must_change_password)')
      .eq('brand_id', user.brandId)
      .order('name', { ascending: true });
    return (legacy.data as any[] | null) || null;
  };

  const [dbShops, emailMap] = await Promise.all([
    fetchShops(),
    isLive ? getAuthEmailMap() : Promise.resolve(new Map<string, string>()),
  ]);

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
        ? s.profiles.map((p: any) => {
            const authEmail = emailMap.get(p.id) || '';
            return {
              id: p.id,
              full_name: p.full_name,
              phone: p.phone || '',
              email: authEmail,
              username: p.username || (authEmail ? authEmail.split('@')[0] : null),
              is_active: p.is_active !== false,
              must_change_password: Boolean(p.must_change_password),
            };
          })
        : [],
    }));
  } else if (!isLive) {
    shops = DEMO_ADMIN_SHOPS.map((s) => ({
      ...s,
      managers: (s.managers || []).map((m) => ({
        ...m,
        username: m.username || (m.email ? m.email.split('@')[0] : null),
        is_active: m.is_active !== false,
      })),
    }));
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
      <ShopsList initialShops={shops} brandSlug={brandSlug} />
    </SharedAppLayout>
  );
}


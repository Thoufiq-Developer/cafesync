'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { ShopsList } from '@/components/admin/shops-list';
import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_ADMIN_SHOPS, DemoShop } from '@/lib/demo-admin-data';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export default function AdminShopsPage() {
  const { profile, brand } = useAuth();
  const isLive = isSupabaseConfigured();
  const brandId = profile?.brand_id || brand?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-shops', brandId],
    queryFn: async () => {
      let shops: DemoShop[] = isLive ? [] : DEMO_ADMIN_SHOPS;

      if (isLive && brandId) {
        const res = await (supabase as any)
          .from('shops')
          .select('*, profiles!shop_id(id, full_name, username, phone, is_active, must_change_password)')
          .eq('brand_id', brandId)
          .order('name', { ascending: true });

        const dbShops = res.data as any[] | null;

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
                  email: p.username ? `${p.username}@${brand?.slug || 'brand'}.cafesync.app` : '',
                  username: p.username || null,
                  is_active: p.is_active !== false,
                  must_change_password: Boolean(p.must_change_password),
                }))
              : [],
          }));
        }
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

      const brandSlug = brand?.slug || 'brand';
      return { shops, brandSlug };
    },
    enabled: Boolean(brandId || !isLive),
  });

  const adminUser = {
    id: profile?.id,
    fullName: profile?.full_name || 'Admin',
    email: profile?.email || '',
    username: profile?.username,
    phone: profile?.phone || '',
    brandId: profile?.brand_id,
    mustChangePassword: profile?.must_change_password,
    role: 'admin' as const,
  };

  return (
    <SharedAppLayout user={adminUser} brand={brand as any}>
      {isLoading || !data ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary,#ea580c)]" />
          <span>Loading outlets register...</span>
        </div>
      ) : (
        <ShopsList initialShops={data.shops} brandSlug={data.brandSlug} />
      )}
    </SharedAppLayout>
  );
}

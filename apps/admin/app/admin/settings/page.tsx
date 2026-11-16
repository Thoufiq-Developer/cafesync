'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { AdminSettingsView } from '@/components/admin/admin-settings-view';
import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_ADMIN_SHOPS, DemoShop } from '@/lib/demo-admin-data';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export default function AdminSettingsPage() {
  const { profile, brand } = useAuth();
  const isLive = isSupabaseConfigured();
  const brandId = profile?.brand_id || brand?.id;

  const { data: shops, isLoading } = useQuery({
    queryKey: ['admin-settings-shops', brandId],
    queryFn: async () => {
      let result: DemoShop[] = isLive ? [] : DEMO_ADMIN_SHOPS;

      if (isLive && brandId) {
        const { data: dbShops } = (await (supabase as any)
          .from('shops')
          .select('*, profiles!shop_id(id, full_name, phone)')
          .eq('brand_id', brandId)
          .order('name', { ascending: true })) as { data: any[] | null; error: any };

        if (dbShops && dbShops.length > 0) {
          result = dbShops.map((s) => ({
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
                  phone: p.phone,
                  email: '',
                }))
              : [],
          }));
        }
      }

      return result;
    },
    enabled: Boolean(brandId || !isLive),
  });

  const brandData = {
    id: brand?.id || brandId || '',
    name: brand?.name || 'Brand',
    primary_color: brand?.primary_color || '#ea580c',
    secondary_color: brand?.secondary_color || '#9a3412',
  };

  const adminUser = {
    id: profile?.id,
    fullName: profile?.full_name || 'Admin',
    email: profile?.email || '',
    username: profile?.username,
    phone: profile?.phone || '',
    role: 'admin' as const,
    brandId: profile?.brand_id,
    mustChangePassword: profile?.must_change_password,
  };

  return (
    <SharedAppLayout user={adminUser} brand={brand as any}>
      {isLoading || !shops ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary,#ea580c)]" />
          <span>Loading administration settings...</span>
        </div>
      ) : (
        <AdminSettingsView brand={brandData} shops={shops} />
      )}
    </SharedAppLayout>
  );
}

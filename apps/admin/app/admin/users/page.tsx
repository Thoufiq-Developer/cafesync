'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { UsersManager, ManagerUserRecord } from '@/components/admin/users-manager';
import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_ADMIN_SHOPS, DemoShop } from '@/lib/demo-admin-data';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export default function AdminUsersPage() {
  const { profile, brand } = useAuth();
  const isLive = isSupabaseConfigured();
  const brandId = profile?.brand_id || brand?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', brandId],
    queryFn: async () => {
      let shops: DemoShop[] = isLive ? [] : DEMO_ADMIN_SHOPS;
      let users: ManagerUserRecord[] = [];

      if (isLive && brandId) {
        const [dbShopsRes, dbProfilesRes] = await Promise.all([
          (supabase as any)
            .from('shops')
            .select('*, profiles!shop_id(id, full_name, username, phone, is_active)')
            .eq('brand_id', brandId)
            .order('name', { ascending: true }),
          (supabase as any)
            .from('profiles')
            .select('*, shops!shop_id(name, code)')
            .eq('brand_id', brandId)
            .eq('role', 'manager')
            .order('created_at', { ascending: false }),
        ]);

        const dbShops = dbShopsRes.data as any[] | null;
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
                }))
              : [],
          }));
        }

        const dbProfiles = dbProfilesRes?.data as any[] | null;
        if (dbProfiles && dbProfiles.length > 0) {
          users = dbProfiles.map((p) => {
            const authEmail = p.username ? `${p.username}@${brand?.slug || 'brand'}.cafesync.app` : '';
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
        }
      } else if (!isLive) {
        users = shops.map((s, idx) => {
          const demoEmail = s.managers[0]?.email || `manager.${s.code.toLowerCase()}@snaxia.in`;
          return {
            id: `usr-${idx + 1}`,
            fullName: s.managers[0]?.full_name || 'Outlet Manager',
            username: s.managers[0]?.username || demoEmail.split('@')[0],
            email: demoEmail,
            phone: s.managers[0]?.phone || '+91 98450 11223',
            shopId: s.id,
            shopName: s.name,
            shopCode: s.code,
            isActive: s.status === 'active',
            mustChangePassword: false,
            createdAt: '2026-01-15T10:00:00Z',
          };
        });
      }

      return { shops, users };
    },
    enabled: Boolean(brandId || !isLive),
  });

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
      {isLoading || !data ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary,#ea580c)]" />
          <span>Loading managers & staff access...</span>
        </div>
      ) : (
        <UsersManager initialUsers={data.users} shops={data.shops} />
      )}
    </SharedAppLayout>
  );
}

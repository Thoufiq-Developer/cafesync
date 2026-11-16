'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { AssetsRegisterManager, AdminAssetItem } from '@/components/admin/assets-register-manager';
import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getTodayKolkata } from '@/lib/calculations/dates';
import { DEMO_ADMIN_SHOPS, DemoShop } from '@/lib/demo-admin-data';
import { DEMO_ASSETS } from '@/lib/demo-shop-data';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export default function AdminAssetsPage() {
  const { profile, brand } = useAuth();
  const isLive = isSupabaseConfigured();
  const brandId = profile?.brand_id || brand?.id;
  const today = getTodayKolkata();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-assets', brandId],
    queryFn: async () => {
      let shops: DemoShop[] = isLive ? [] : DEMO_ADMIN_SHOPS;
      let assets: AdminAssetItem[] = [];

      if (isLive && brandId) {
        const [{ data: dbShops }, { data: dbAssets }] = await Promise.all([
          (supabase as any)
            .from('shops')
            .select('*, profiles!shop_id(id, full_name, phone)')
            .eq('brand_id', brandId)
            .order('name', { ascending: true }),
          (supabase as any)
            .from('assets')
            .select('*, shops!shop_id(name, code), asset_service_logs(*)')
            .eq('brand_id', brandId)
            .order('next_service_due', { ascending: true }),
        ]);

        if (dbShops && dbShops.length > 0) {
          shops = dbShops.map((s: any) => ({
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

        if (dbAssets && dbAssets.length > 0) {
          assets = dbAssets.map((a: any) => ({
            id: a.id,
            shop_id: a.shop_id,
            shop_name: a.shops?.name || 'Cafe Branch',
            shop_code: a.shops?.code || 'SHOP',
            name: a.name,
            category: a.category as any,
            model: a.model,
            serial_no: a.serial_no,
            purchase_date: a.purchase_date,
            cost: a.cost ? Number(a.cost) : null,
            vendor: a.vendor,
            status: a.status as any,
            last_service_date: a.last_service_date,
            service_interval_days: a.service_interval_days,
            next_service_due: a.next_service_due,
            notes: a.notes,
            service_logs: Array.isArray(a.asset_service_logs)
              ? a.asset_service_logs.map((l: any) => ({
                  id: l.id,
                  service_date: l.service_date,
                  vendor: l.vendor,
                  cost: Number(l.cost),
                  notes: l.notes,
                  next_due: l.next_due,
                }))
              : [],
          }));
        }
      } else if (!isLive) {
        assets = [];
        shops.forEach((s, sIdx) => {
          DEMO_ASSETS.forEach((da, daIdx) => {
            let due = da.next_service_due;
            if (sIdx === 0 && daIdx === 0) {
              const d = new Date(`${today}T00:00:00Z`);
              d.setUTCDate(d.getUTCDate() - 3);
              due = d.toISOString().split('T')[0];
            } else if (sIdx === 0 && daIdx === 1) {
              const d = new Date(`${today}T00:00:00Z`);
              d.setUTCDate(d.getUTCDate() + 4);
              due = d.toISOString().split('T')[0];
            }
            assets.push({
              id: `${s.id}-${da.id}`,
              shop_id: s.id,
              shop_name: s.name,
              shop_code: s.code,
              name: da.name,
              category: da.category as any,
              model: da.model,
              serial_no: da.serial_no,
              purchase_date: da.purchase_date,
              cost: da.cost,
              vendor: da.vendor,
              status: da.status as any,
              last_service_date: da.last_service_date,
              service_interval_days: da.service_interval_days,
              next_service_due: due,
              notes: da.notes,
              service_logs: [
                {
                  id: `log-${s.id}-${da.id}`,
                  service_date: da.last_service_date || today,
                  vendor: da.vendor || 'Authorized Service',
                  cost: 1800,
                  notes: 'Quarterly preventative service and calibration',
                },
              ],
            });
          });
        });
      }

      return { shops, assets };
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
          <span>Loading equipment & maintenance register...</span>
        </div>
      ) : (
        <AssetsRegisterManager initialAssets={data.assets} shops={data.shops} todayDate={new Date().toISOString().split('T')[0]} />
      )}
    </SharedAppLayout>
  );
}

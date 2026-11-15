import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { AssetsRegisterManager, AdminAssetItem } from '@/components/admin/assets-register-manager';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getTodayKolkata } from '@/lib/calculations/dates';
import { DEMO_ADMIN_SHOPS, DemoShop } from '@/lib/demo-admin-data';
import { DEMO_ASSETS } from '@/lib/demo-shop-data';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminAssetsPage() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    redirect('/login');
  }

  const isLive = isSupabaseConfigured();
  const today = getTodayKolkata();
  const supabase = await createClient();

  const [{ data: dbShops }, { data: dbAssets }] = (await Promise.all([
    supabase
      .from('shops')
      .select('*, profiles!shop_id(id, full_name, phone)')
      .eq('brand_id', user.brandId)
      .order('name', { ascending: true }),
    supabase
      .from('assets')
      .select('*, shops!shop_id(name, code), asset_service_logs(*)')
      .eq('brand_id', user.brandId)
      .order('next_service_due', { ascending: true }),
  ])) as [{ data: any[] | null; error: any }, { data: any[] | null; error: any }];

  // 1. Format shops
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
            phone: p.phone,
            email: '',
          }))
        : [],
    }));
  }

  // 2. Format Assets with service logs
  let assets: AdminAssetItem[] = [];

  if (dbAssets && dbAssets.length > 0) {
    assets = dbAssets.map((a) => ({
      id: a.id,
      shop_id: a.shop_id,
      shop_name: a.shops?.name || 'Cafe Branch',
      shop_code: a.shops?.code || 'SHOP',
      name: a.name,
      category: a.category,
      model: a.model,
      serial_no: a.serial_no,
      purchase_date: a.purchase_date,
      cost: a.cost ? Number(a.cost) : null,
      vendor: a.vendor,
      status: a.status,
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
  } else if (!isLive) {
    // Populate demo assets across all shops
    assets = [];
    shops.forEach((s, sIdx) => {
      DEMO_ASSETS.forEach((da, daIdx) => {
        // Vary the next_service_due slightly to have overdue, due in 7 days, and normal
        let due = da.next_service_due;
        if (sIdx === 0 && daIdx === 0) {
          // Overdue
          due = '2026-11-02';
        } else if (sIdx === 1 && daIdx === 1) {
          // Due in 4 days
          due = '2026-11-13';
        }

        assets.push({
          id: `${s.id}-${da.id}`,
          shop_id: s.id,
          shop_name: s.name,
          shop_code: s.code,
          name: da.name,
          category: da.category as any,
          model: da.model,
          serial_no: `${s.code}-${daIdx + 101}`,
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
              id: 'log-1',
              service_date: da.last_service_date,
              vendor: da.vendor,
              cost: 4500,
              notes: 'Descaling & pressure calibration',
              next_due: due,
            },
          ],
        });
      });
    });
  }

  const adminUser = {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: 'admin' as const,
  };

  return (
    <SharedAppLayout user={adminUser} brand={user.brand}>
      <AssetsRegisterManager
        initialAssets={assets}
        shops={shops}
        todayDate={today}
      />
    </SharedAppLayout>
  );
}


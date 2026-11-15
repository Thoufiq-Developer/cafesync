import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { AssetsManagerClient } from '@/components/shop/assets-manager-client';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getTodayKolkata } from '@/lib/calculations/dates';
import { DEMO_ASSETS } from '@/lib/demo-shop-data';
import { redirect } from 'next/navigation';
import { Wrench } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ShopAssetsPage() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'manager') {
    redirect('/login');
  }

  const isLive = isSupabaseConfigured();
  const today = getTodayKolkata();
  const supabase = await createClient();

  // 1. Fetch Assets for this shop
  let assets = isLive ? [] : DEMO_ASSETS;
  if (user.shopId) {
    const { data: dbAssets } = (await supabase
      .from('assets')
      .select('*')
      .eq('shop_id', user.shopId)
      .order('next_service_due', { ascending: true })) as { data: any[] | null; error: any };

    if (dbAssets && (dbAssets.length > 0 || isLive)) {
      assets = dbAssets;
    }
  }

  const managerUser = {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: 'manager' as const,
    shopName: user.shop?.name || 'Shop Counter',
    shopCode: user.shop?.code || 'SHOP-01',
  };

  return (
    <SharedAppLayout user={managerUser} brand={user.brand}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Wrench className="h-6 w-6 text-[var(--brand-primary,#ea580c)]" />
              <span>Shop Equipment & Preventive Maintenance</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Track maintenance schedules. Overdue services are highlighted in red; services due within 7 days in amber.
            </p>
          </div>
        </div>

        {/* Client Manager with Log Service Dialog */}
        <AssetsManagerClient assets={assets} today={today} />
      </div>
    </SharedAppLayout>
  );
}


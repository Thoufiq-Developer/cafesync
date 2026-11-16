'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { AssetsManagerClient } from '@/components/shop/assets-manager-client';
import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getTodayKolkata } from '@/lib/calculations/dates';
import { DEMO_ASSETS } from '@/lib/demo-shop-data';
import { Wrench } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export default function ShopAssetsPage() {
  const { profile, shop, brand } = useAuth();
  const shopId = profile?.shop_id || shop?.id;
  const isLive = isSupabaseConfigured();
  const today = getTodayKolkata();

  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['shop-assets', shopId],
    queryFn: async () => {
      if (!isLive) return DEMO_ASSETS;
      if (!shopId) return [];

      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .eq('shop_id', shopId)
        .order('next_service_due', { ascending: true });

      if (error) {
        console.warn('Error fetching shop assets:', error);
        return [];
      }
      return data || [];
    },
    enabled: Boolean(!isLive || shopId),
  });

  const managerUser = {
    fullName: profile?.full_name || 'Shop Manager',
    email: profile?.email || '',
    phone: '',
    role: 'manager' as const,
    shopName: shop?.name || 'Shop Counter',
    shopCode: shop?.code || 'SHOP-01',
  };

  return (
    <SharedAppLayout user={managerUser} brand={brand as any}>
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

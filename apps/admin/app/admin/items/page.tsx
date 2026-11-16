'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import {
  ItemsPaymentModesManager,
  PaymentModeItem,
} from '@/components/admin/items-payment-modes-manager';
import { CatalogItemRecord } from '@/components/shared/items-manager';
import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_ITEMS, DEMO_PAYMENT_MODES } from '@/lib/demo-shop-data';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export default function AdminItemsPage() {
  const { profile, brand } = useAuth();
  const isLive = isSupabaseConfigured();
  const brandId = profile?.brand_id || brand?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-items-modes', brandId],
    queryFn: async () => {
      let items: CatalogItemRecord[] = isLive
        ? []
        : DEMO_ITEMS.map((i, idx) => ({
            id: i.id,
            name: i.name,
            kind: i.kind as 'income' | 'expense',
            category: i.category,
            unit: i.kind === 'expense' ? 'kg' : 'pcs',
            default_rate: null,
            shop_id: null,
            shop_name: null,
            is_active: i.is_active,
            usage_count: 45 + idx * 8,
          }));

      let paymentModes: PaymentModeItem[] = isLive
        ? []
        : DEMO_PAYMENT_MODES.map((m, idx) => ({
            id: m.id,
            name: m.name,
            is_active: m.is_active,
            usage_count: 120 - idx * 25,
          }));

      if (isLive && brandId) {
        const [txnRefsRes, dbItemsRes, dbModesRes] = await Promise.all([
          (supabase as any)
            .from('transactions')
            .select('item_id, mode_id')
            .eq('brand_id', brandId)
            .eq('is_deleted', false),
          (supabase as any)
            .from('items')
            .select('*, shops!shop_id(name, code)')
            .eq('brand_id', brandId)
            .order('name', { ascending: true }),
          (supabase as any)
            .from('payment_modes')
            .select('*')
            .eq('brand_id', brandId)
            .order('name', { ascending: true }),
        ]);

        const itemUsageMap = new Map<string, number>();
        const modeUsageMap = new Map<string, number>();
        (txnRefsRes.data || []).forEach((t: any) => {
          if (t.item_id) itemUsageMap.set(t.item_id, (itemUsageMap.get(t.item_id) || 0) + 1);
          if (t.mode_id) modeUsageMap.set(t.mode_id, (modeUsageMap.get(t.mode_id) || 0) + 1);
        });

        const dbItems = dbItemsRes.data as any[] | null;
        if (dbItems && dbItems.length > 0) {
          items = dbItems.map((i: any) => ({
            id: i.id,
            name: i.name,
            kind: i.kind,
            category: i.category,
            unit: i.unit || 'pcs',
            default_rate:
              i.default_rate !== null && i.default_rate !== undefined
                ? Number(i.default_rate)
                : null,
            shop_id: i.shop_id || null,
            shop_name: i.shops?.name || null,
            shop_code: i.shops?.code || null,
            is_active: i.is_active,
            usage_count: itemUsageMap.get(i.id) || 0,
          }));
        }

        const dbModes = dbModesRes.data as any[] | null;
        if (dbModes && dbModes.length > 0) {
          paymentModes = dbModes.map((m: any) => ({
            id: m.id,
            name: m.name,
            type: m.type,
            is_active: m.is_active,
            is_system: m.is_system,
            display_order: m.display_order,
            usage_count: modeUsageMap.get(m.id) || 0,
          }));
        }
      }

      return { items, paymentModes };
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
          <span>Loading catalog items & payment modes...</span>
        </div>
      ) : (
        <ItemsPaymentModesManager initialItems={data.items} initialPaymentModes={data.paymentModes} />
      )}
    </SharedAppLayout>
  );
}

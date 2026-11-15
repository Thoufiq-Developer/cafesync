import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import {
  ItemsPaymentModesManager,
  PaymentModeItem,
} from '@/components/admin/items-payment-modes-manager';
import { CatalogItemRecord } from '@/components/shared/items-manager';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_ITEMS, DEMO_PAYMENT_MODES } from '@/lib/demo-shop-data';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminItemsPage() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    redirect('/login');
  }

  const isLive = isSupabaseConfigured();
  const supabase = (await createClient()) as any;

  const [txnRefsRes, dbItemsRes, dbModesRes] = await Promise.all([
    isLive
      ? supabase
          .from('transactions')
          .select('item_id, mode_id')
          .eq('brand_id', user.brandId)
          .eq('is_deleted', false)
      : Promise.resolve({ data: null }),
    supabase
      .from('items')
      .select('*, shops!shop_id(name, code)')
      .eq('brand_id', user.brandId)
      .order('name', { ascending: true }),
    supabase
      .from('payment_modes')
      .select('*')
      .eq('brand_id', user.brandId)
      .order('name', { ascending: true }),
  ]);

  const itemUsageMap = new Map<string, number>();
  const modeUsageMap = new Map<string, number>();
  if (isLive) {
    (txnRefsRes.data || []).forEach((t: any) => {
      if (t.item_id) itemUsageMap.set(t.item_id, (itemUsageMap.get(t.item_id) || 0) + 1);
      if (t.mode_id) modeUsageMap.set(t.mode_id, (modeUsageMap.get(t.mode_id) || 0) + 1);
    });
  }

  // 1. Format Items (including brand-wide and shop-created)
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

  // Pre-migration fallback if items!shop_id foreign key wasn't added yet
  let dbItems = dbItemsRes.data;
  if (dbItemsRes.error) {
    const legacyItems = await supabase
      .from('items')
      .select('*')
      .eq('brand_id', user.brandId)
      .order('name', { ascending: true });
    dbItems = legacyItems.data;
  }

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
      usage_count: isLive ? itemUsageMap.get(i.id) || 0 : 12,
    }));
  }

  // 2. Format Payment Modes
  let paymentModes: PaymentModeItem[] = isLive
    ? []
    : DEMO_PAYMENT_MODES.map((m, idx) => ({
        id: m.id,
        name: m.name,
        is_active: m.is_active,
        usage_count: 120 + idx * 45,
      }));

  const dbModes = dbModesRes.data;

  if (dbModes && dbModes.length > 0) {
    paymentModes = dbModes.map((m: any) => ({
      id: m.id,
      name: m.name,
      is_active: m.is_active,
      usage_count: isLive ? modeUsageMap.get(m.id) || 0 : 50,
    }));
  }

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
      <ItemsPaymentModesManager
        initialItems={items}
        initialPaymentModes={paymentModes}
      />
    </SharedAppLayout>
  );
}

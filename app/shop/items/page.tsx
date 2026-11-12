import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import {
  ItemsManager,
  CatalogItemRecord,
} from '@/components/shared/items-manager';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_ITEMS } from '@/lib/demo-shop-data';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ShopItemsPage() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'manager' || !user.brandId || !user.shopId) {
    redirect('/login');
  }

  const isLive = isSupabaseConfigured();
  const supabase = (await createClient()) as any;

  let items: CatalogItemRecord[] = isLive
    ? []
    : DEMO_ITEMS.map((i, idx) => ({
        id: i.id,
        name: i.name,
        kind: i.kind as 'income' | 'expense',
        category: i.category,
        unit: i.kind === 'expense' ? 'kg' : 'pcs',
        default_rate: null,
        shop_id: idx % 5 === 4 ? user.shopId : null,
        shop_name: idx % 5 === 4 ? (user.shop?.name || 'This Shop') : null,
        is_active: i.is_active,
        usage_count: 8 + idx * 3,
      }));

  if (isLive) {
    const fetchItems = async () => {
      const res = await supabase
        .from('items')
        .select('*')
        .eq('brand_id', user.brandId)
        .or(`shop_id.is.null,shop_id.eq.${user.shopId}`)
        .order('name', { ascending: true });
      if (!res.error) return res.data;

      // Fallback if items.shop_id column is not yet added in database
      const legacy = await supabase
        .from('items')
        .select('*')
        .eq('brand_id', user.brandId)
        .order('name', { ascending: true });
      return legacy.data || null;
    };

    const [{ data: txns }, dbItems] = await Promise.all([
      supabase
        .from('transactions')
        .select('item_id')
        .eq('shop_id', user.shopId)
        .eq('is_deleted', false),
      fetchItems(),
    ]);

    const usageMap = new Map<string, number>();
    (txns || []).forEach((t: any) => {
      if (t.item_id) usageMap.set(t.item_id, (usageMap.get(t.item_id) || 0) + 1);
    });

    if (dbItems) {
      items = dbItems.map((i: any) => ({
        id: i.id,
        name: i.name,
        kind: i.kind,
        category: i.category,
        unit: i.unit || 'pcs',
        default_rate: i.default_rate !== null && i.default_rate !== undefined ? Number(i.default_rate) : null,
        shop_id: i.shop_id || null,
        shop_name: i.shop_id ? (user.shop?.name || 'My Shop') : null,
        is_active: i.is_active,
        usage_count: usageMap.get(i.id) || 0,
      }));
    }
  }

  const managerUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    phone: user.phone,
    role: 'manager' as const,
    brandId: user.brandId,
    shopName: user.shop?.name || 'Shop Counter',
    shopCode: user.shop?.code || 'SHOP-01',
    mustChangePassword: user.mustChangePassword,
  };

  return (
    <SharedAppLayout user={managerUser} brand={user.brand}>
      <ItemsManager
        role="manager"
        shopId={user.shopId}
        shopName={user.shop?.name || 'My Shop'}
        initialItems={items}
      />
    </SharedAppLayout>
  );
}

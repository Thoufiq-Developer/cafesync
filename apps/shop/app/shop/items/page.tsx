'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import {
  ItemsManager,
  CatalogItemRecord,
} from '@/components/shared/items-manager';
import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_ITEMS } from '@/lib/demo-shop-data';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export default function ShopItemsPage() {
  const { profile, shop, brand } = useAuth();
  const shopId = profile?.shop_id || shop?.id;
  const brandId = profile?.brand_id || brand?.id;
  const isLive = isSupabaseConfigured();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['shop-items', brandId, shopId],
    queryFn: async () => {
      if (!isLive) {
        return DEMO_ITEMS.map((i, idx) => ({
          id: i.id,
          name: i.name,
          kind: i.kind as 'income' | 'expense',
          category: i.category,
          unit: i.kind === 'expense' ? 'kg' : 'pcs',
          default_rate: null,
          shop_id: idx % 5 === 4 ? shopId : null,
          shop_name: idx % 5 === 4 ? (shop?.name || 'This Shop') : null,
          is_active: i.is_active,
          usage_count: 8 + idx * 3,
        }));
      }

      if (!brandId) return [];

      let q = supabase
        .from('items')
        .select('*')
        .eq('brand_id', brandId)
        .order('name', { ascending: true });

      if (shopId) {
        q = q.or(`shop_id.is.null,shop_id.eq.${shopId}`);
      } else {
        q = q.is('shop_id', null);
      }

      const [itemsRes, txnsRes] = await Promise.all([
        q,
        shopId
          ? supabase
              .from('transactions')
              .select('item_id')
              .eq('shop_id', shopId)
              .eq('is_deleted', false)
          : Promise.resolve({ data: [] }),
      ]);

      const usageMap = new Map<string, number>();
      (txnsRes.data || []).forEach((t: any) => {
        if (t.item_id) usageMap.set(t.item_id, (usageMap.get(t.item_id) || 0) + 1);
      });

      const dbItems = itemsRes.data || [];
      return dbItems.map((i: any) => ({
        id: i.id,
        name: i.name,
        kind: i.kind,
        category: i.category,
        unit: i.unit || 'pcs',
        default_rate: i.default_rate !== null && i.default_rate !== undefined ? Number(i.default_rate) : null,
        shop_id: i.shop_id || null,
        shop_name: i.shop_id ? (shop?.name || 'My Shop') : null,
        is_active: i.is_active,
        usage_count: usageMap.get(i.id) || 0,
      }));
    },
    enabled: Boolean(!isLive || brandId),
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
        {isLoading ? (
          <div className="py-12 flex items-center justify-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-xs">Loading items catalog...</span>
          </div>
        ) : (
          <ItemsManager
            role="manager"
            shopId={shopId || undefined}
            shopName={shop?.name || undefined}
            initialItems={items}
          />
        )}
      </div>
    </SharedAppLayout>
  );
}

'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { ReportsManager } from '@/components/shop/reports-manager';
import { FileSpreadsheet } from 'lucide-react';

export default function ShopReportsPage() {
  const { profile, shop, brand } = useAuth();

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
        <div className="pb-3 border-b border-slate-200">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-[var(--brand-primary,#ea580c)]" />
            <span>Shop Financial Reports & Statements</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Download comprehensive Excel ledgers with live formula totals and polished PDF financial statements.
          </p>
        </div>

        <ReportsManager
          shopId={profile?.shop_id || shop?.id || ''}
          shopName={shop?.name || 'Outlet Counter'}
          brandName={brand?.name || 'CafeSync'}
        />
      </div>
    </SharedAppLayout>
  );
}

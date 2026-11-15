import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { ReportsManager } from '@/components/shop/reports-manager';
import { redirect } from 'next/navigation';
import { FileSpreadsheet } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ShopReportsPage() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'manager') {
    redirect('/login');
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
          shopId={user.shopId || ''}
          shopName={user.shop?.name || 'Outlet Counter'}
          brandName={user.brand?.name || 'CafeLedger'}
        />
      </div>
    </SharedAppLayout>
  );
}


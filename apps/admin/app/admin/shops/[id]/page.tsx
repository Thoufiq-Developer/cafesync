import React, { Suspense } from 'react';
import { ShopDetailClient } from './shop-detail-client';

export function generateStaticParams() {
  return [{ id: '_placeholder' }];
}

export default function AdminShopDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 flex items-center justify-center text-slate-500 text-sm">
          Loading outlet data...
        </div>
      }
    >
      <ShopDetailClient />
    </Suspense>
  );
}

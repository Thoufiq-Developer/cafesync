'use client';

import React from 'react';
import { RequireRole } from '@/lib/auth-context';

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireRole role="manager">
      {children}
    </RequireRole>
  );
}

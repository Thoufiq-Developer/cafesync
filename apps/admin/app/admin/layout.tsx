'use client';

import React from 'react';
import { RequireRole } from '@/lib/auth-context';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireRole allowedRoles={['admin', 'brand_admin', 'master', 'platform_admin']}>
      {children}
    </RequireRole>
  );
}

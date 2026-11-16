'use client';

import React from 'react';
import { RequireRole } from '@/lib/auth-context';

export default function MasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireRole allowedRoles={['master']}>
      {children}
    </RequireRole>
  );
}


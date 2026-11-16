'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { MasterSettingsView } from '@/components/master/master-settings-view';

export default function MasterSettingsPage() {
  const { profile } = useAuth();

  const masterUser = {
    id: profile?.id,
    fullName: profile?.full_name || 'Platform Master',
    email: profile?.email || 'master@cafeledger.io',
    phone: profile?.phone || '',
    role: 'master' as const,
  };

  return (
    <SharedAppLayout user={masterUser}>
      <MasterSettingsView masterEmail={masterUser.email} />
    </SharedAppLayout>
  );
}

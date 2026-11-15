import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { MasterSettingsView } from '@/components/master/master-settings-view';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MasterSettingsPage() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    redirect('/login');
  }

  const masterUser = {
    fullName: user.fullName || 'Platform Master',
    email: user.email || '',
    phone: user.phone,
    role: 'master' as const,
  };

  return (
    <SharedAppLayout user={masterUser}>
      <MasterSettingsView masterEmail={masterUser.email} />
    </SharedAppLayout>
  );
}


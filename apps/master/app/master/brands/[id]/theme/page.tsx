import React from 'react';
import { redirect, notFound } from 'next/navigation';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { findBrandThemeById, listAllBrandThemes } from '@/lib/theme/server';
import { ThemeStudioClient } from './theme-studio-client';

export const dynamic = 'force-dynamic';

export default async function BrandThemeStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    redirect('/login');
  }

  const { id } = await params;
  const [bundle, allBundles] = await Promise.all([
    findBrandThemeById(id),
    listAllBrandThemes(),
  ]);

  if (!bundle) {
    notFound();
  }

  const masterUser = {
    fullName: user.fullName || 'Platform Master',
    email: user.email || '',
    phone: user.phone,
    role: 'master' as const,
  };

  return (
    <SharedAppLayout user={masterUser}>
      <ThemeStudioClient
        brand={bundle.brand}
        initialSettings={bundle.settings}
        allBrands={allBundles}
      />
    </SharedAppLayout>
  );
}

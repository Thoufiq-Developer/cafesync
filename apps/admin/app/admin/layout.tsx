import React from 'react';
import type { Metadata, Viewport } from 'next';
import { getCurrentUserContext } from '@/lib/auth';
import {
  getBrandThemeById,
  resolveEffectiveThemeMode,
} from '@/lib/theme/server';
import { buildBrandCssVariables, cssVarsToStyleText } from '@/lib/theme/css-vars';
import { BrandThemeServerProvider } from '@/components/shared/brand-provider';
import { ForcePasswordChangeModal } from '@/components/shared/force-password-change-modal';

export async function generateMetadata(): Promise<Metadata> {
  const user = await getCurrentUserContext();
  const bundle = await getBrandThemeById(user?.brandId);
  const brandName = bundle.settings.display_name || bundle.brand.name;
  const iconUrl =
    bundle.settings.icon_url || `/api/brand-icon/${bundle.brand.id}`;

  return {
    title: `${brandName} | CafeLedger`,
    description:
      bundle.settings.tagline || `${brandName} Multi-Outlet Cafe Ledger`,
    icons: {
      icon: iconUrl,
      shortcut: iconUrl,
      apple: `/api/brand-icon/${bundle.brand.id}?format=png&size=192`,
    },
    manifest: `/api/manifest?brand=${encodeURIComponent(bundle.brand.slug)}&role=admin`,
  };
}

export async function generateViewport(): Promise<Viewport> {
  const user = await getCurrentUserContext();
  const bundle = await getBrandThemeById(user?.brandId);
  return {
    themeColor: bundle.settings.primary_color,
  };
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUserContext();
  const bundle = await getBrandThemeById(user?.brandId);
  const effectiveMode = await resolveEffectiveThemeMode(
    bundle.settings,
    user?.id,
    user?.themeMode
  );
  const cssVars = buildBrandCssVariables(bundle.settings, effectiveMode);
  const inlineCss = cssVarsToStyleText(cssVars, [':root', '.brand-portal-root']);

  return (
    <>
      <style
        id="brand-ssr-theme"
        dangerouslySetInnerHTML={{ __html: inlineCss }}
      />
      <BrandThemeServerProvider bundle={bundle} initialMode={effectiveMode}>
        {children}
        {user && user.role !== 'master' && user.mustChangePassword && (
          <ForcePasswordChangeModal initialRequired={true} userName={user.fullName} />
        )}
      </BrandThemeServerProvider>
    </>
  );
}


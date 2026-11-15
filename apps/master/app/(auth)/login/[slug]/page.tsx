import React from 'react';
import Link from 'next/link';
import type { Metadata, Viewport } from 'next';
import { getBrandLoginBySlug } from '@/lib/theme/server';
import { buildBrandCssVariables, cssVarsToStyleText } from '@/lib/theme/css-vars';
import { pickReadableTextColor } from '@/lib/theme/colors';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_USERS } from '@/lib/demo-data';
import { BrandLoginClient, type DemoQuickAccount } from './brand-login-client';
import { AlertTriangle, Building2, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const brandLogin = await getBrandLoginBySlug(slug);

  if (!brandLogin) {
    return {
      title: 'Brand Not Found | CafeLedger',
      description: 'The requested brand workspace could not be located.',
    };
  }

  const brandName = brandLogin.display_name || brandLogin.brand_name;
  const iconUrl =
    brandLogin.icon_url || `/api/brand-icon/${brandLogin.brand_id}`;

  return {
    title: `${brandName} | CafeLedger`,
    description: brandLogin.tagline || `Sign in to ${brandName}`,
    icons: {
      icon: iconUrl,
      shortcut: iconUrl,
      apple: `/api/brand-icon/${brandLogin.brand_id}?format=png&size=192`,
    },
    manifest: `/api/manifest?brand=${encodeURIComponent(brandLogin.slug)}`,
  };
}

export async function generateViewport({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Viewport> {
  const { slug } = await params;
  const brandLogin = await getBrandLoginBySlug(slug);
  return {
    themeColor: brandLogin?.primary_color || '#0f172a',
  };
}

export default async function BrandSlugLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const brandLogin = await getBrandLoginBySlug(slug);

  // Neutral "Brand not found" screen for unknown slugs
  if (!brandLogin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <Building2 className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-slate-900">Brand Not Found</h1>
            <p className="text-sm text-slate-500">
              No active cafe organization matches the link{' '}
              <span className="font-mono text-slate-700">/login/{slug}</span>. Please check the URL shared by your administrator.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Go to Platform Login</span>
          </Link>
        </div>
        <div className="mt-6 text-xs text-slate-400">Powered by CafeLedger</div>
      </div>
    );
  }

  // Suspended brand notice
  if (brandLogin.status === 'suspended') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-8 shadow-sm text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-xl font-bold text-slate-900">
              {brandLogin.display_name} Portal Suspended
            </h1>
            <p className="text-sm text-slate-500">
              Access for this organization has been temporarily suspended by Platform Administration.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Login Hub</span>
          </Link>
        </div>
      </div>
    );
  }

  const cssVars = buildBrandCssVariables(
    {
      primary_color: brandLogin.primary_color,
      secondary_color: brandLogin.secondary_color,
      accent_color: brandLogin.accent_color,
      font_family: brandLogin.font_family,
      radius: brandLogin.radius,
      sidebar_style: 'light',
      density: 'comfortable',
      default_mode: brandLogin.default_mode,
    },
    brandLogin.default_mode
  );
  const inlineCss = cssVarsToStyleText(cssVars, [':root', '.brand-portal-root']);
  const primaryFg = pickReadableTextColor(brandLogin.primary_color, '#ffffff', '#0f172a');

  const showDemoFill = !isSupabaseConfigured();
  const demoAccounts: DemoQuickAccount[] = showDemoFill
    ? Object.values(DEMO_USERS)
        .filter(
          (u) => u.role !== 'master' && u.brand?.id === brandLogin.brand_id
        )
        .map((u) => ({
          email: u.email,
          role: u.role,
          label:
            u.role === 'admin'
              ? `🏢 ${u.fullName} (Admin)`
              : `☕ ${u.shop?.name || u.fullName} (Manager)`,
        }))
    : [];

  return (
    <>
      <style
        id="brand-login-ssr-theme"
        dangerouslySetInnerHTML={{ __html: inlineCss }}
      />
      <div
        className="brand-portal-root min-h-screen"
        data-brand-mode={brandLogin.default_mode}
        data-brand-radius={brandLogin.radius}
        style={cssVars as React.CSSProperties}
      >
        <BrandLoginClient
          brandLogin={brandLogin}
          demoAccounts={demoAccounts}
          showDemoFill={showDemoFill}
          primaryFg={primaryFg}
        />
      </div>
    </>
  );
}


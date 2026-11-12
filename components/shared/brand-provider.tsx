'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { buildBrandCssVariables } from '@/lib/theme/css-vars';
import { buildDefaultBrandSettings } from '@/lib/theme/presets';
import type { BrandSettings, BrandThemeBundle, ThemeMode } from '@/lib/theme/types';
import { toast } from 'sonner';

export interface BrandTheme {
  id?: string;
  name: string;
  slug?: string;
  logoUrl?: string | null;
  logo_url?: string | null;
  primaryColor?: string;
  primary_color?: string;
  secondaryColor?: string;
  secondary_color?: string;
  registrationNo?: string;
  registration_no?: string;
  gstin?: string | null;
}

interface RichBrandContextValue {
  isThemed: boolean;
  bundle: BrandThemeBundle | null;
  mode: ThemeMode;
  canSwitchMode: boolean;
  isSwitchingMode: boolean;
  toggleUserMode: () => Promise<void>;
  brand: BrandTheme;
}

const neutralDefaultBrand: BrandTheme = {
  name: 'CafeLedger',
  primaryColor: '#0f172a',
  secondaryColor: '#334155',
};

const RichBrandContext = createContext<RichBrandContextValue>({
  isThemed: false,
  bundle: null,
  mode: 'light',
  canSwitchMode: false,
  isSwitchingMode: false,
  toggleUserMode: async () => {},
  brand: neutralDefaultBrand,
});

export function BrandThemeServerProvider({
  bundle,
  initialMode,
  children,
}: {
  bundle: BrandThemeBundle;
  initialMode: ThemeMode;
  children: React.ReactNode;
}) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);

  // Sync CSS variables when user toggles light/dark mode
  const cssVars = useMemo(
    () => buildBrandCssVariables(bundle.settings, mode),
    [bundle.settings, mode]
  );

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    for (const [key, val] of Object.entries(cssVars)) {
      root.style.setProperty(key, val);
    }
  }, [cssVars]);

  const toggleUserMode = useCallback(async () => {
    if (!bundle.settings.allow_user_mode_switch) return;
    const nextMode: ThemeMode = mode === 'dark' ? 'light' : 'dark';
    setMode(nextMode);
    setIsSwitchingMode(true);
    try {
      const res = await fetch('/api/theme/mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: nextMode }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Could not update display mode');
      }
      toast.success(`Switched to ${nextMode} mode`);
    } catch (err: any) {
      setMode(mode);
      toast.error(err?.message || 'Failed to save mode preference');
    } finally {
      setIsSwitchingMode(false);
    }
  }, [bundle.settings.allow_user_mode_switch, mode]);

  const legacyBrand: BrandTheme = useMemo(
    () => ({
      id: bundle.brand.id,
      name: bundle.settings.display_name || bundle.brand.name,
      slug: bundle.brand.slug,
      logoUrl: bundle.settings.logo_url,
      logo_url: bundle.settings.logo_url,
      primaryColor: bundle.settings.primary_color,
      primary_color: bundle.settings.primary_color,
      secondaryColor: bundle.settings.secondary_color,
      secondary_color: bundle.settings.secondary_color,
      registrationNo: bundle.brand.registration_no,
      registration_no: bundle.brand.registration_no,
      gstin: bundle.brand.gstin,
    }),
    [bundle]
  );

  const value = useMemo<RichBrandContextValue>(
    () => ({
      isThemed: true,
      bundle,
      mode,
      canSwitchMode: Boolean(bundle.settings.allow_user_mode_switch),
      isSwitchingMode,
      toggleUserMode,
      brand: legacyBrand,
    }),
    [bundle, mode, isSwitchingMode, toggleUserMode, legacyBrand]
  );

  return (
    <RichBrandContext.Provider value={value}>
      <div
        className="brand-portal-root min-h-screen flex flex-col"
        data-brand-mode={mode}
        data-brand-density={bundle.settings.density || 'comfortable'}
        data-brand-radius={bundle.settings.radius || 'rounded'}
        style={cssVars as React.CSSProperties}
      >
        {children}
      </div>
    </RichBrandContext.Provider>
  );
}

export function BrandProvider({
  brand,
  children,
}: {
  brand?: BrandTheme | null;
  children: React.ReactNode;
}) {
  const existing = useContext(RichBrandContext);

  const fallbackValue = useMemo<RichBrandContextValue>(() => {
    const resolvedBrand: BrandTheme = brand
      ? {
          ...brand,
          name: brand.name || neutralDefaultBrand.name,
          logoUrl: brand.logoUrl || brand.logo_url || null,
          primaryColor: brand.primaryColor || brand.primary_color || '#ea580c',
          secondaryColor: brand.secondaryColor || brand.secondary_color || '#9a3412',
        }
      : neutralDefaultBrand;

    // If explicitly neutral (Master panel), never attach rich tenant settings
    if (!brand) {
      return {
        isThemed: false,
        bundle: null,
        mode: 'light',
        canSwitchMode: false,
        isSwitchingMode: false,
        toggleUserMode: async () => {},
        brand: resolvedBrand,
      };
    }

    const fallbackSettings: BrandSettings = buildDefaultBrandSettings({
      id: resolvedBrand.id || 'default',
      name: resolvedBrand.name,
      logo_url: resolvedBrand.logoUrl,
      primary_color: resolvedBrand.primaryColor,
      secondary_color: resolvedBrand.secondaryColor,
    });

    return {
      isThemed: true,
      bundle: {
        brand: {
          id: resolvedBrand.id || 'default',
          name: resolvedBrand.name,
          slug: resolvedBrand.slug || 'brand',
          registration_no: resolvedBrand.registrationNo || resolvedBrand.registration_no || '',
          address: null,
          phone: null,
          email: null,
          gstin: resolvedBrand.gstin || null,
          status: 'active',
        },
        settings: fallbackSettings,
      },
      mode: 'light',
      canSwitchMode: false,
      isSwitchingMode: false,
      toggleUserMode: async () => {},
      brand: resolvedBrand,
    };
  }, [brand]);

  if (existing.isThemed) {
    return <>{children}</>;
  }

  return (
    <RichBrandContext.Provider value={fallbackValue}>
      {children}
    </RichBrandContext.Provider>
  );
}

export function useBrand(): BrandTheme {
  return useContext(RichBrandContext).brand;
}

export function useBrandTheme() {
  return useContext(RichBrandContext);
}

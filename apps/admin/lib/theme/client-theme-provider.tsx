'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { buildBrandCssVariables } from '@/lib/theme/css-vars';
import { buildDefaultBrandSettings } from '@/lib/theme/presets';
import { DEMO_BRAND, DEMO_BRANDS } from '@/lib/demo-data';
import type { BrandSettings, BrandThemeBundle, ThemeMode, BrandStatus } from '@/lib/theme/types';
import { BrandThemeServerProvider } from '@/components/shared/brand-provider';
import { useAuth } from '@/lib/auth-context';

interface ClientThemeContextType {
  settings: BrandSettings;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  brandName: string;
}

const defaultSettings = buildDefaultBrandSettings({
  id: DEMO_BRAND.id,
  name: DEMO_BRAND.name,
  primary_color: DEMO_BRAND.primary_color,
  secondary_color: DEMO_BRAND.secondary_color,
});

const ClientThemeContext = createContext<ClientThemeContextType>({
  settings: defaultSettings,
  mode: 'light',
  setMode: () => {},
  brandName: 'CafeSync',
});

export function ClientThemeProvider({
  children,
  initialSlug,
}: {
  children: React.ReactNode;
  initialSlug?: string;
}) {
  const { brand } = useAuth();
  const activeSlug = brand?.slug || initialSlug || 'snaxia';

  const [settings, setSettings] = useState<BrandSettings>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`cafesync_theme_${activeSlug}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.settings) return parsed.settings;
        }
      } catch {}
    }
    return defaultSettings;
  });

  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(`cafesync_theme_${activeSlug}`);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.mode) return parsed.mode;
        }
      } catch {}
    }
    return settings.default_mode || 'light';
  });

  const applyThemeToDOM = useCallback(
    (brandSettings: BrandSettings, currentMode: ThemeMode, brandDisplayName: string) => {
      if (typeof window === 'undefined') return;

      try {
        const root = document.documentElement;
        const cssVars = buildBrandCssVariables(brandSettings, currentMode);

        for (const [key, val] of Object.entries(cssVars)) {
          root.style.setProperty(key, val);
        }

        if (currentMode === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }

        // Title & favicon
        if (brandDisplayName) {
          document.title = `${brandDisplayName} | CafeLedger Brand Admin`;
        }

        if (brandSettings.icon_url || brandSettings.logo_url) {
          const iconHref = brandSettings.icon_url || brandSettings.logo_url;
          let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
          if (!favicon) {
            favicon = document.createElement('link');
            favicon.rel = 'icon';
            document.head.appendChild(favicon);
          }
          favicon.href = iconHref || '/favicon.ico';
        }

        // Dynamic Manifest via Blob URL
        const manifestData = {
          name: `${brandDisplayName} Admin`,
          short_name: brandDisplayName,
          start_url: '/admin/',
          display: 'standalone',
          background_color: currentMode === 'dark' ? '#0f172a' : '#ffffff',
          theme_color: brandSettings.primary_color || '#ea580c',
          icons: [
            {
              src: brandSettings.icon_url || '/globe.svg',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: brandSettings.icon_url || '/globe.svg',
              sizes: '512x512',
              type: 'image/png',
            },
          ],
        };

        const manifestBlob = new Blob([JSON.stringify(manifestData)], {
          type: 'application/json',
        });
        const manifestUrl = URL.createObjectURL(manifestBlob);

        let manifestLink = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
        if (!manifestLink) {
          manifestLink = document.createElement('link');
          manifestLink.rel = 'manifest';
          document.head.appendChild(manifestLink);
        }
        manifestLink.href = manifestUrl;

        // Persist theme to localStorage for zero-flash restore on page reload
        localStorage.setItem(
          `cafesync_theme_${activeSlug}`,
          JSON.stringify({
            settings: brandSettings,
            mode: currentMode,
            cssVars,
            updatedAt: Date.now(),
          })
        );
        localStorage.setItem('cafesync_current_brand_slug', activeSlug);
      } catch (e) {
        console.warn('Error applying theme to DOM:', e);
      }
    },
    [activeSlug]
  );

  // Load and refresh brand theme
  useEffect(() => {
    let isMounted = true;

    async function fetchBrandTheme() {
      if (!isSupabaseConfigured()) {
        const demoBrand = DEMO_BRANDS.find((b) => b.slug === activeSlug || b.id === brand?.id) || DEMO_BRAND;
        const demoSettings = buildDefaultBrandSettings(demoBrand);
        if (isMounted) {
          setSettings(demoSettings);
          const effective = mode || demoSettings.default_mode || 'light';
          applyThemeToDOM(demoSettings, effective, demoBrand.name);
        }
        return;
      }

      try {
        const { data, error } = await (supabase as any).rpc('get_public_brand_theme', {
          p_slug: activeSlug,
        });

        if (!error && data && isMounted) {
          const row = Array.isArray(data) ? data[0] : data;
          if (row) {
            const loadedSettings: BrandSettings = {
              ...defaultSettings,
              brand_id: row.brand_id || defaultSettings.brand_id,
              display_name: row.display_name || row.brand_name || defaultSettings.display_name,
              tagline: row.tagline || defaultSettings.tagline,
              welcome_message: row.welcome_message || defaultSettings.welcome_message,
              primary_color: row.primary_color || defaultSettings.primary_color,
              secondary_color: row.secondary_color || defaultSettings.secondary_color,
              accent_color: row.accent_color || defaultSettings.accent_color,
              radius: (row.radius as any) || defaultSettings.radius,
              sidebar_style: (row.sidebar_style as any) || defaultSettings.sidebar_style,
              density: (row.density as any) || defaultSettings.density,
              default_mode: (row.default_mode as any) || defaultSettings.default_mode,
              allow_user_mode_switch: true,
              font_family: (row.font_family as any) || defaultSettings.font_family,
              logo_url: row.logo_url || defaultSettings.logo_url,
              logo_dark_url: row.logo_dark_url || defaultSettings.logo_dark_url,
              icon_url: row.icon_url || defaultSettings.icon_url,
              login_bg_url: row.login_bg_url || defaultSettings.login_bg_url,
              login_bg_color: row.login_bg_color || defaultSettings.login_bg_color,
              login_layout: (row.login_layout as any) || defaultSettings.login_layout,
              login_logo_size: (row.login_logo_size as any) || defaultSettings.login_logo_size,
              updated_at: new Date().toISOString(),
            };

            setSettings(loadedSettings);
            const effective = mode || loadedSettings.default_mode || 'light';
            applyThemeToDOM(loadedSettings, effective, row.display_name || row.brand_name || 'CafeLedger');
          }
        }
      } catch (err) {
        console.warn('Background theme refresh warning:', err);
      }
    }

    fetchBrandTheme();

    return () => {
      isMounted = false;
    };
  }, [activeSlug, brand?.id, mode, applyThemeToDOM]);

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    applyThemeToDOM(settings, newMode, settings.display_name || 'CafeLedger');
  };

  const themeBundle: BrandThemeBundle = useMemo(
    () => ({
      brand: {
        id: brand?.id || settings.brand_id || DEMO_BRAND.id,
        name: brand?.name || settings.display_name || DEMO_BRAND.name,
        slug: brand?.slug || activeSlug,
        registration_no: (brand as any)?.registration_no || DEMO_BRAND.registration_no || '',
        address: (brand as any)?.address || null,
        phone: (brand as any)?.phone || null,
        email: (brand as any)?.email || null,
        gstin: (brand as any)?.gstin || null,
        status: ((brand?.status as any) || 'active') as BrandStatus,
      },
      settings,
    }),
    [brand, settings, activeSlug]
  );

  return (
    <ClientThemeContext.Provider
      value={{
        settings,
        mode,
        setMode,
        brandName: settings.display_name || 'CafeLedger',
      }}
    >
      <BrandThemeServerProvider bundle={themeBundle} initialMode={mode}>
        {children}
      </BrandThemeServerProvider>
    </ClientThemeContext.Provider>
  );
}

export function useClientTheme() {
  return useContext(ClientThemeContext);
}

'use client';

import React, { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { ThemeStudioClient } from './theme-studio-client';
import { buildDefaultBrandSettings } from '@/lib/theme/presets';
import { DEMO_BRAND, DEMO_BRANDS } from '@/lib/demo-data';
import type { BrandIdentityMeta, BrandSettings, BrandThemeBundle } from '@/lib/theme/types';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function ThemeStudioPageClient() {
  const params = useParams();
  const { profile, isLive } = useAuth();

  const brandId = useMemo(() => {
    let raw = (params?.id as string) || '';
    if (!raw || raw === '_placeholder') {
      if (typeof window !== 'undefined') {
        const parts = window.location.pathname.split('/').filter(Boolean);
        const bIdx = parts.indexOf('brands');
        if (bIdx !== -1 && parts[bIdx + 1] && parts[bIdx + 1] !== '_placeholder') {
          raw = parts[bIdx + 1];
        }
      }
    }
    return raw;
  }, [params]);

  const { data, isLoading } = useQuery({
    queryKey: ['master-theme-studio', brandId, isLive],
    queryFn: async () => {
      if (!isLive) {
        const demoBundles: BrandThemeBundle[] = DEMO_BRANDS.map((b) => ({
          brand: {
            id: b.id,
            name: b.name,
            slug: b.slug,
            registration_no: b.registration_no || 'BR-DEMO-001',
            address: (b as any).address || null,
            phone: (b as any).phone || null,
            email: (b as any).email || null,
            gstin: b.gstin || null,
            status: ((b as any).status || 'active') as any,
          },
          settings: buildDefaultBrandSettings(b),
        }));

        const currentBundle =
          demoBundles.find((b) => b.brand.id === brandId) || demoBundles[0];

        return {
          currentBundle,
          allBrands: demoBundles,
        };
      }

      if (!brandId || brandId === '_placeholder') {
        return null;
      }

      const [
        { data: dbBrand, error: brandErr },
        { data: allDbBrands },
      ] = await Promise.all([
        (supabase as any)
          .from('brands')
          .select('*, brand_settings(*)')
          .eq('id', brandId)
          .maybeSingle(),
        (supabase as any)
          .from('brands')
          .select('id, name, slug, registration_no, address, phone, email, gstin, status, primary_color, secondary_color, brand_settings(*)')
          .order('name', { ascending: true }),
      ]);

      if (brandErr) console.error('Theme studio brand query error:', brandErr);
      if (!dbBrand) return null;

      const bs = Array.isArray(dbBrand.brand_settings) ? dbBrand.brand_settings[0] : dbBrand.brand_settings;

      const initialBrand: BrandIdentityMeta = {
        id: dbBrand.id,
        name: dbBrand.name,
        slug: dbBrand.slug,
        registration_no: dbBrand.registration_no || '',
        address: dbBrand.address || null,
        phone: dbBrand.phone || null,
        email: dbBrand.email || null,
        gstin: dbBrand.gstin || null,
        status: dbBrand.status || 'active',
      };

      const defaultSet = buildDefaultBrandSettings(dbBrand);
      const settings: BrandSettings = bs
        ? {
            ...defaultSet,
            ...bs,
            display_name: bs.display_name || dbBrand.name,
            primary_color: bs.primary_color || dbBrand.primary_color || '#ea580c',
            secondary_color: bs.secondary_color || dbBrand.secondary_color || '#9a3412',
          }
        : defaultSet;

      const currentBundle: BrandThemeBundle = {
        brand: initialBrand,
        settings,
      };

      const allBrands: BrandThemeBundle[] = (allDbBrands || []).map((b: any) => {
        const bSetting = Array.isArray(b.brand_settings) ? b.brand_settings[0] : b.brand_settings;
        const dSet = buildDefaultBrandSettings(b);
        return {
          brand: {
            id: b.id,
            name: b.name,
            slug: b.slug,
            registration_no: b.registration_no || '',
            address: b.address || null,
            phone: b.phone || null,
            email: b.email || null,
            gstin: b.gstin || null,
            status: b.status || 'active',
          },
          settings: bSetting ? { ...dSet, ...bSetting } : dSet,
        };
      });

      return {
        currentBundle,
        allBrands,
      };
    },
    enabled: Boolean(brandId || !isLive),
  });

  const masterUser = {
    id: profile?.id,
    fullName: profile?.full_name || 'Platform Master',
    email: profile?.email || '',
    phone: profile?.phone || '',
    role: 'master' as const,
  };

  return (
    <SharedAppLayout user={masterUser}>
      {isLoading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#B9A58A] text-xs">
          <Loader2 className="h-8 w-8 animate-spin text-[#C68846]" />
          <span>Opening Brand Theme Studio workspace...</span>
        </div>
      ) : !data || !data.currentBundle ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-[#B9A58A]">Brand theme configuration not found.</p>
          <Link href="/master/brands">
            <Button size="sm" variant="outline" className="border-[#4A2F25] text-[#F7E5BC] hover:bg-[#4A2F25]">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Brands List
            </Button>
          </Link>
        </div>
      ) : (
        <ThemeStudioClient
          brand={data.currentBundle.brand}
          initialSettings={data.currentBundle.settings}
          allBrands={data.allBrands}
        />
      )}
    </SharedAppLayout>
  );
}

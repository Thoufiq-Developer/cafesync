import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { BrandsList } from '@/components/master/brands-list';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getAuthEmailMap } from '@/lib/supabase/user-emails';
import { getCurrentMonthKolkata, getMonthBounds } from '@/lib/calculations/dates';
import { DEMO_MASTER_BRANDS, DemoMasterBrand } from '@/lib/demo-master-data';
import { listAllBrandThemes } from '@/lib/theme/server';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MasterBrandsPage() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    redirect('/login');
  }

  let brands: DemoMasterBrand[] = [];

  if (!isSupabaseConfigured()) {
    const demoById = new Map(DEMO_MASTER_BRANDS.map((b) => [b.id, b]));
    const bundles = await listAllBrandThemes();
    brands = bundles.map((bundle) => {
      const base = demoById.get(bundle.brand.id);
      return {
        id: bundle.brand.id,
        name: bundle.brand.name,
        slug: bundle.brand.slug,
        registration_no: bundle.brand.registration_no,
        logo_url: bundle.settings.logo_url,
        primary_color: bundle.settings.primary_color,
        secondary_color: bundle.settings.secondary_color,
        address: bundle.brand.address || '',
        phone: bundle.brand.phone || '',
        email: bundle.brand.email || '',
        gstin: bundle.brand.gstin,
        status: bundle.brand.status,
        created_at: base?.created_at || new Date().toISOString(),
        shops_count: base?.shops_count || 0,
        admins_count: base?.admins_count || 1,
        monthly_volume: base?.monthly_volume || 0,
        admins: base?.admins || [],
      };
    });
  } else {
    try {
      const supabase = (await createClient()) as any;
      const monthBounds = getMonthBounds(getCurrentMonthKolkata());

      const [emailMap, { data: dbBrands, error: brandsErr }, { data: dbSummaries }] = await Promise.all([
        getAuthEmailMap(),
        supabase
          .from('brands')
          .select('*, shops(id), profiles(id, full_name, phone, role, is_active), brand_settings(logo_url, primary_color, secondary_color)')
          .order('created_at', { ascending: false }),
        supabase
          .from('daily_summary')
          .select('shop_id, income')
          .gte('summary_date', monthBounds.start)
          .lte('summary_date', monthBounds.end),
      ]);

      if (brandsErr) {
        console.error('Master brands query failed:', brandsErr);
      }

      const shopToBrandMap = new Map<string, string>();
      (dbBrands || []).forEach((b: any) => {
        const brandShops = Array.isArray(b.shops) ? b.shops : [];
        brandShops.forEach((s: any) => {
          if (s?.id) shopToBrandMap.set(s.id, b.id);
        });
      });

      const monthlyVolumeByBrand = new Map<string, number>();
      (dbSummaries || []).forEach((sum: any) => {
        const bId = shopToBrandMap.get(sum.shop_id);
        if (!bId) return;
        monthlyVolumeByBrand.set(
          bId,
          (monthlyVolumeByBrand.get(bId) || 0) + (Number(sum.income) || 0)
        );
      });

      brands = (dbBrands || []).map((b: any) => {
        const brandShops = Array.isArray(b.shops) ? b.shops : [];
        const brandProfiles = Array.isArray(b.profiles) ? b.profiles : [];
        const admins = brandProfiles.filter((p: any) => p.role === 'admin');
        const bs = Array.isArray(b.brand_settings) ? b.brand_settings[0] : b.brand_settings;

        return {
          id: b.id,
          name: b.name,
          slug: b.slug,
          registration_no: b.registration_no,
          logo_url: bs?.logo_url ?? b.logo_url,
          primary_color: bs?.primary_color || b.primary_color || '#ea580c',
          secondary_color: bs?.secondary_color || b.secondary_color || '#9a3412',
          address: b.address || '',
          phone: b.phone || '',
          email: b.email || '',
          gstin: b.gstin,
          status: b.status,
          created_at: b.created_at,
          shops_count: brandShops.length,
          admins_count: admins.length,
          monthly_volume: monthlyVolumeByBrand.get(b.id) || 0,
          admins: admins.map((a: any) => ({
            id: a.id,
            full_name: a.full_name,
            email: emailMap.get(a.id) || '',
            phone: a.phone || '',
            is_active: a.is_active,
          })),
        };
      });
    } catch (err) {
      console.error('Master brands page error:', err);
    }
  }

  const masterUser = {
    fullName: user.fullName || 'Platform Master',
    email: user.email || '',
    phone: user.phone,
    role: 'master' as const,
  };

  return (
    <SharedAppLayout user={masterUser}>
      <BrandsList initialBrands={brands} />
    </SharedAppLayout>
  );
}

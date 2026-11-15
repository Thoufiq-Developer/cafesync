import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { BrandDetailView } from '@/components/master/brand-detail-view';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getAuthEmailMap } from '@cafesync/shared/server-admin';
import { getCurrentMonthKolkata, getMonthBounds } from '@/lib/calculations/dates';
import { DEMO_MASTER_BRANDS, DemoMasterBrand } from '@/lib/demo-master-data';
import { DEMO_ADMIN_SHOPS } from '@/lib/demo-admin-data';
import { findDemoThemeById } from '@/lib/theme/store';
import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MasterBrandDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    redirect('/login');
  }

  const resolvedParams = await params;
  const brandId = resolvedParams.id;

  let brand: DemoMasterBrand | undefined;
  let shops: Array<{ id: string; name: string; code: string; address: string; phone: string; status: string }> = [];
  let managersCount = 0;
  let lastActivity = 'No activity yet';

  if (!isSupabaseConfigured()) {
    const baseDemo = DEMO_MASTER_BRANDS.find((b) => b.id === brandId) || DEMO_MASTER_BRANDS[0];
    const bundle = findDemoThemeById(brandId);
    brand = bundle
      ? {
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
          created_at: baseDemo?.created_at || new Date().toISOString(),
          shops_count: baseDemo?.shops_count || 0,
          admins_count: baseDemo?.admins_count || 1,
          monthly_volume: baseDemo?.monthly_volume || 0,
          admins: baseDemo?.admins || [],
        }
      : baseDemo;

    shops = DEMO_ADMIN_SHOPS.map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      address: s.address,
      phone: s.phone,
      status: s.status,
    }));
    managersCount = 10;
    lastActivity = '5 mins ago';
  } else {
    const supabase = (await createClient()) as any;

    const [
      emailMap,
      { data: dbBrand, error: brandErr },
      { data: dbShops },
    ] = await Promise.all([
      getAuthEmailMap(),
      supabase
        .from('brands')
        .select('*, profiles(id, full_name, phone, role, is_active), brand_settings(logo_url, primary_color, secondary_color)')
        .eq('id', brandId)
        .maybeSingle(),
      supabase
        .from('shops')
        .select('*')
        .eq('brand_id', brandId)
        .order('name', { ascending: true }),
    ]) as [Map<string, string>, { data: any | null; error: any }, { data: any[] | null; error: any }];

    if (brandErr) {
      console.error('Master brand detail query error:', brandErr);
    }

    if (!dbBrand) {
      notFound();
    }

    const brandProfiles = Array.isArray(dbBrand.profiles) ? dbBrand.profiles : [];
    const admins = brandProfiles.filter((p: any) => p.role === 'admin');
    const managers = brandProfiles.filter((p: any) => p.role === 'manager' && p.is_active);
    const bs = Array.isArray(dbBrand.brand_settings) ? dbBrand.brand_settings[0] : dbBrand.brand_settings;

    managersCount = managers.length;

    shops = (dbShops || []).map((s) => ({
      id: s.id,
      name: s.name,
      code: s.code,
      address: s.address || '',
      phone: s.phone || '',
      status: s.status,
    }));

    let monthlyVolume = 0;
    const shopIds = shops.map((s) => s.id);
    if (shopIds.length > 0) {
      const monthBounds = getMonthBounds(getCurrentMonthKolkata());
      const { data: dbSummaries } = await supabase
        .from('daily_summary')
        .select('income, updated_at')
        .in('shop_id', shopIds)
        .gte('summary_date', monthBounds.start)
        .lte('summary_date', monthBounds.end)
        .order('updated_at', { ascending: false });

      monthlyVolume = (dbSummaries || []).reduce(
        (acc: number, row: any) => acc + (Number(row.income) || 0),
        0
      );

      if (dbSummaries && dbSummaries.length > 0 && dbSummaries[0]?.updated_at) {
        lastActivity = new Date(dbSummaries[0].updated_at).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: 'short',
        });
      }
    }

    brand = {
      id: dbBrand.id,
      name: dbBrand.name,
      slug: dbBrand.slug,
      registration_no: dbBrand.registration_no,
      logo_url: bs?.logo_url ?? dbBrand.logo_url,
      primary_color: bs?.primary_color || dbBrand.primary_color || '#ea580c',
      secondary_color: bs?.secondary_color || dbBrand.secondary_color || '#9a3412',
      address: dbBrand.address || '',
      phone: dbBrand.phone || '',
      email: dbBrand.email || '',
      gstin: dbBrand.gstin,
      status: dbBrand.status,
      created_at: dbBrand.created_at,
      shops_count: shops.length,
      admins_count: admins.length,
      monthly_volume: monthlyVolume,
      admins: admins.map((a: any) => ({
        id: a.id,
        full_name: a.full_name,
        email: emailMap.get(a.id) || '',
        phone: a.phone || '',
        is_active: a.is_active,
      })),
    };
  }

  if (!brand) {
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
      <BrandDetailView
        brand={brand}
        shops={shops}
        managersCount={managersCount}
        lastActivity={lastActivity}
      />
    </SharedAppLayout>
  );
}

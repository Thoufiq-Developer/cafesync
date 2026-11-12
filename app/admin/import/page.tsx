import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { ExcelImporter } from '@/components/admin/excel-importer';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_ADMIN_SHOPS, DemoShop } from '@/lib/demo-admin-data';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminImportPage() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    redirect('/login');
  }

  const isLive = isSupabaseConfigured();
  const supabase = await createClient();

  let shops: DemoShop[] = isLive ? [] : DEMO_ADMIN_SHOPS;
  const { data: dbShops } = (await supabase
    .from('shops')
    .select('*, profiles!shop_id(id, full_name, phone)')
    .eq('brand_id', user.brandId)
    .order('name', { ascending: true })) as { data: any[] | null; error: any };

  if (dbShops && dbShops.length > 0) {
    shops = dbShops.map((s) => ({
      id: s.id,
      brand_id: s.brand_id,
      name: s.name,
      code: s.code,
      address: s.address || '',
      phone: s.phone || '',
      status: s.status,
      created_at: s.created_at,
      managers: Array.isArray(s.profiles)
        ? s.profiles.map((p: any) => ({
            id: p.id,
            full_name: p.full_name,
            phone: p.phone,
            email: '',
          }))
        : [],
    }));
  }

  const adminUser = {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: 'admin' as const,
  };

  return (
    <SharedAppLayout user={adminUser} brand={user.brand}>
      <ExcelImporter shops={shops} />
    </SharedAppLayout>
  );
}


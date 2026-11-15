import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { EmployeesManager, AdminEmployeeRecord } from '@/components/admin/employees-manager';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_ADMIN_SHOPS, DemoShop } from '@/lib/demo-admin-data';
import { DEMO_EMPLOYEES } from '@/lib/demo-shop-data';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminEmployeesPage() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    redirect('/login');
  }

  const isLive = isSupabaseConfigured();
  const supabase = await createClient();

  const [{ data: dbShops }, { data: dbEmployees }] = (await Promise.all([
    supabase
      .from('shops')
      .select('*, profiles!shop_id(id, full_name, phone)')
      .eq('brand_id', user.brandId)
      .order('name', { ascending: true }),
    supabase
      .from('employees')
      .select('*, shops!shop_id(name, code)')
      .eq('brand_id', user.brandId)
      .order('name', { ascending: true }),
  ])) as [{ data: any[] | null; error: any }, { data: any[] | null; error: any }];

  // 1. Format shops
  let shops: DemoShop[] = isLive ? [] : DEMO_ADMIN_SHOPS;

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

  // 2. Format employees
  let employees: AdminEmployeeRecord[] = [];

  if (dbEmployees && dbEmployees.length > 0) {
    employees = dbEmployees.map((e) => ({
      id: e.id,
      shopId: e.shop_id,
      shopName: e.shops?.name || 'Cafe Branch',
      shopCode: e.shops?.code || 'SHOP',
      name: e.name,
      phone: e.phone,
      roleTitle: e.role_title,
      ratePerDay: Number(e.rate_per_day),
      isActive: e.is_active,
    }));
  } else if (!isLive) {
    // Demo Pool across shops
    employees = [];
    shops.forEach((s) => {
      DEMO_EMPLOYEES.forEach((de) => {
        employees.push({
          id: `${s.id}-${de.id}`,
          shopId: s.id,
          shopName: s.name,
          shopCode: s.code,
          name: de.name,
          phone: de.phone,
          roleTitle: de.role_title,
          ratePerDay: de.rate_per_day,
          isActive: de.is_active,
        });
      });
    });
  }

  const adminUser = {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: 'admin' as const,
  };

  return (
    <SharedAppLayout user={adminUser} brand={user.brand}>
      <EmployeesManager initialEmployees={employees} shops={shops} />
    </SharedAppLayout>
  );
}


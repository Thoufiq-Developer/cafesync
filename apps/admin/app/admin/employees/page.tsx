'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { EmployeesManager, AdminEmployeeRecord } from '@/components/admin/employees-manager';
import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_ADMIN_SHOPS, DemoShop } from '@/lib/demo-admin-data';
import { DEMO_EMPLOYEES } from '@/lib/demo-shop-data';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export default function AdminEmployeesPage() {
  const { profile, brand } = useAuth();
  const isLive = isSupabaseConfigured();
  const brandId = profile?.brand_id || brand?.id;

  const { data, isLoading } = useQuery({
    queryKey: ['admin-employees', brandId],
    queryFn: async () => {
      let shops: DemoShop[] = isLive ? [] : DEMO_ADMIN_SHOPS;
      let employees: AdminEmployeeRecord[] = [];

      if (isLive && brandId) {
        const [{ data: dbShops }, { data: dbEmployees }] = await Promise.all([
          (supabase as any)
            .from('shops')
            .select('*, profiles!shop_id(id, full_name, phone)')
            .eq('brand_id', brandId)
            .order('name', { ascending: true }),
          (supabase as any)
            .from('employees')
            .select('*, shops!shop_id(name, code)')
            .eq('brand_id', brandId)
            .order('name', { ascending: true }),
        ]);

        if (dbShops && dbShops.length > 0) {
          shops = dbShops.map((s: any) => ({
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

        if (dbEmployees && dbEmployees.length > 0) {
          employees = dbEmployees.map((e: any) => ({
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
        }
      } else if (!isLive) {
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

      return { shops, employees };
    },
    enabled: Boolean(brandId || !isLive),
  });

  const adminUser = {
    id: profile?.id,
    fullName: profile?.full_name || 'Admin',
    email: profile?.email || '',
    username: profile?.username,
    phone: profile?.phone || '',
    role: 'admin' as const,
    brandId: profile?.brand_id,
    mustChangePassword: profile?.must_change_password,
  };

  return (
    <SharedAppLayout user={adminUser} brand={brand as any}>
      {isLoading || !data ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--brand-primary,#ea580c)]" />
          <span>Loading staff & payroll register...</span>
        </div>
      ) : (
        <EmployeesManager initialEmployees={data.employees} shops={data.shops} />
      )}
    </SharedAppLayout>
  );
}

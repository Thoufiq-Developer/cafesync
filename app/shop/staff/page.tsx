import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { StaffSalaryManager, EmployeeSalaryItem } from '@/components/shop/staff-salary-manager';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getCurrentMonthKolkata, getPreviousMonth, getNextMonth, formatDisplayMonth } from '@/lib/calculations/dates';
import { DEMO_EMPLOYEES, DEMO_PAYMENT_MODES } from '@/lib/demo-shop-data';
import { redirect } from 'next/navigation';
import { Users, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ShopStaffSalaryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'manager') {
    redirect('/login');
  }

  const isLive = isSupabaseConfigured();
  const resolvedParams = await searchParams;
  const currentMonth = getCurrentMonthKolkata();
  const selectedMonth = resolvedParams?.month || currentMonth;

  const prevMonth = getPreviousMonth(selectedMonth);
  const nextMonth = getNextMonth(selectedMonth);

  const supabase = await createClient();

  const [empsRes, modesRes, recordsRes, monthRecRes] = await Promise.all([
    user.shopId
      ? supabase
          .from('employees')
          .select('id, name, phone, role_title, rate_per_day, is_active')
          .eq('shop_id', user.shopId)
          .eq('is_active', true)
          .order('name', { ascending: true })
      : Promise.resolve({ data: null }),
    user.brandId
      ? supabase
          .from('payment_modes')
          .select('id, name')
          .eq('brand_id', user.brandId)
          .eq('is_active', true)
          .order('name', { ascending: true })
      : Promise.resolve({ data: null }),
    user.shopId
      ? supabase
          .from('salary_records')
          .select('employee_id, days_worked, rate_snapshot, gross, advances_total, paid_total, balance')
          .eq('shop_id', user.shopId)
          .eq('month', selectedMonth)
      : Promise.resolve({ data: null }),
    user.shopId
      ? supabase
          .from('month_openings')
          .select('closed_at')
          .eq('shop_id', user.shopId)
          .eq('month', selectedMonth)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  let rawEmployees = isLive ? [] : DEMO_EMPLOYEES;
  const dbEmployees = empsRes?.data as any[] | null;
  if (dbEmployees && (dbEmployees.length > 0 || isLive)) {
    rawEmployees = dbEmployees;
  }

  let paymentModes = isLive ? [] : DEMO_PAYMENT_MODES;
  const dbModes = modesRes?.data as any[] | null;
  if (dbModes && (dbModes.length > 0 || isLive)) {
    paymentModes = dbModes;
  }

  let salaryRecordMap: Record<string, any> = {};
  const records = recordsRes?.data as any[] | null;
  if (records) {
    records.forEach((r) => {
      salaryRecordMap[r.employee_id] = r;
    });
  }

  const isMonthClosed = Boolean((monthRecRes?.data as any)?.closed_at);

  // Combine employees with their salary record for selected month
  const employeesData: EmployeeSalaryItem[] = rawEmployees.map((emp) => {
    const rec = salaryRecordMap[emp.id];
    const rate = Number(rec?.rate_snapshot ?? emp.rate_per_day ?? 0);
    const days = rec
      ? Number(rec.days_worked || 0)
      : (isLive ? 0 : (selectedMonth === currentMonth ? 26 : 28));
    const gross = rec
      ? Number(rec.gross || 0)
      : Math.round(days * rate * 100) / 100;
    const advances = rec ? Number(rec.advances_total || 0) : (isLive ? 0 : 1500);
    const paid = Number(rec?.paid_total || 0);
    const balance = rec
      ? Number(rec.balance || 0)
      : Math.round((gross - advances - paid) * 100) / 100;

    return {
      id: emp.id,
      name: emp.name,
      phone: emp.phone,
      role_title: emp.role_title,
      rate_per_day: rate,
      days_worked: days,
      gross,
      advances_total: advances,
      paid_total: paid,
      balance,
    };
  });

  const managerUser = {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: 'manager' as const,
    shopName: user.shop?.name || 'Shop Counter',
    shopCode: user.shop?.code || 'SHOP-01',
  };

  return (
    <SharedAppLayout user={managerUser} brand={user.brand}>
      <div className="space-y-6">
        {/* Header & Month Navigator */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Users className="h-6 w-6 text-[var(--brand-primary,#ea580c)]" />
              <span>Staff Attendance & Salary Ledger</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter days worked, issue advances, and track monthly salary balances.
            </p>
          </div>

          {/* Month Switcher */}
          <div className="flex items-center gap-2">
            <Link
              href={`/shop/staff?month=${prevMonth}`}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white min-w-[100px] text-center">
              {formatDisplayMonth(selectedMonth)}
            </span>

            <Link
              href={`/shop/staff?month=${nextMonth}`}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Staff Salary Component */}
        <StaffSalaryManager
          employees={employeesData}
          selectedMonth={selectedMonth}
          paymentModes={paymentModes}
          isMonthClosed={isMonthClosed}
        />
      </div>
    </SharedAppLayout>
  );
}


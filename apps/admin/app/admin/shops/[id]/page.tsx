import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { ShopDetailView } from '@/components/admin/shop-detail-view';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getTodayKolkata, getCurrentMonthKolkata, getMonthBounds } from '@/lib/calculations/dates';
import { DEMO_ADMIN_SHOPS, DemoShop } from '@/lib/demo-admin-data';
import { DEMO_EMPLOYEES, DEMO_ASSETS, DEMO_PAYMENT_MODES } from '@/lib/demo-shop-data';
import { redirect, notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminShopDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; month?: string }>;
}) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    redirect('/login');
  }

  const isLive = isSupabaseConfigured();
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const shopId = resolvedParams.id;

  const today = getTodayKolkata();
  const currentMonth = getCurrentMonthKolkata();
  const selectedDate = resolvedSearchParams?.date || today;
  const selectedMonth = resolvedSearchParams?.month || currentMonth;

  const supabase = await createClient();
  const bounds = getMonthBounds(selectedMonth);

  // Fire all independent outlet queries concurrently
  const [
    { data: dbShop },
    { data: dbDaySummary },
    { data: dbTxns },
    { data: dbMonthSummaries },
    { data: mo },
    { data: monthTxns },
    { data: dbEmps },
    { data: dbAssets },
    { data: dbModes },
  ] = (await Promise.all([
    supabase
      .from('shops')
      .select('*, profiles!shop_id(id, full_name, phone)')
      .eq('id', shopId)
      .eq('brand_id', user.brandId)
      .maybeSingle(),
    supabase
      .from('daily_summary')
      .select('*')
      .eq('shop_id', shopId)
      .eq('summary_date', selectedDate)
      .maybeSingle(),
    supabase
      .from('transactions')
      .select('*')
      .eq('shop_id', shopId)
      .eq('txn_date', selectedDate)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('daily_summary')
      .select('*')
      .eq('shop_id', shopId)
      .gte('summary_date', bounds.start)
      .lte('summary_date', bounds.end)
      .order('summary_date', { ascending: true }),
    isLive
      ? supabase
          .from('month_openings')
          .select('opening_balance')
          .eq('shop_id', shopId)
          .eq('month', selectedMonth)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    isLive
      ? supabase
          .from('transactions')
          .select('kind, amount, item_name_snapshot, mode_name_snapshot')
          .eq('shop_id', shopId)
          .gte('txn_date', bounds.start)
          .lte('txn_date', bounds.end)
          .eq('is_deleted', false)
      : Promise.resolve({ data: null }),
    supabase
      .from('employees')
      .select('*, salary_records(*)')
      .eq('shop_id', shopId)
      .eq('is_active', true),
    supabase
      .from('assets')
      .select('*')
      .eq('shop_id', shopId)
      .order('next_service_due', { ascending: true }),
    user.brandId
      ? supabase
          .from('payment_modes')
          .select('id, name, is_active')
          .eq('brand_id', user.brandId)
          .eq('is_active', true)
          .order('name', { ascending: true })
      : Promise.resolve({ data: null }),
  ])) as Array<{ data: any; error?: any }>;

  if (isLive && !dbShop) {
    notFound();
  }

  let shop: DemoShop | undefined = dbShop
    ? {
        id: dbShop.id,
        brand_id: dbShop.brand_id,
        name: dbShop.name,
        code: dbShop.code,
        address: dbShop.address || '',
        phone: dbShop.phone || '',
        status: dbShop.status,
        created_at: dbShop.created_at,
        managers: Array.isArray(dbShop.profiles)
          ? dbShop.profiles.map((p: any) => ({
              id: p.id,
              full_name: p.full_name,
              phone: p.phone,
              email: '',
            }))
          : [],
      }
    : DEMO_ADMIN_SHOPS.find((s) => s.id === shopId);

  if (!shop) {
    shop = DEMO_ADMIN_SHOPS[0];
  }

  // 2. Daily summary for selected date
  let dailySummary = isLive
    ? { opening: 0, income: 0, expense: 0, closing: 0 }
    : { opening: 14500, income: 22800, expense: 9400, closing: 27900 };

  if (dbDaySummary) {
    dailySummary = {
      opening: Number(dbDaySummary.opening) || 0,
      income: Number(dbDaySummary.income) || 0,
      expense: Number(dbDaySummary.expense) || 0,
      closing: Number(dbDaySummary.closing) || 0,
    };
  }

  // 3. Transactions for selected date
  let transactions: any[] = [];

  if (dbTxns && dbTxns.length > 0) {
    transactions = dbTxns;
  } else if (!isLive) {
    transactions = [
      {
        id: 't-1',
        txn_date: selectedDate,
        kind: 'income',
        item_name_snapshot: 'Counter Billing',
        mode_name_snapshot: 'CASH',
        amount: 8500,
        note: 'Morning counter sales',
        created_at: `${selectedDate}T10:00:00Z`,
        created_by_name: 'Shop Manager',
      },
      {
        id: 't-2',
        txn_date: selectedDate,
        kind: 'income',
        item_name_snapshot: 'Counter Billing',
        mode_name_snapshot: 'GPAY',
        amount: 14300,
        note: 'Afternoon & evening UPI',
        created_at: `${selectedDate}T15:30:00Z`,
        created_by_name: 'Shop Manager',
      },
      {
        id: 't-3',
        txn_date: selectedDate,
        kind: 'expense',
        item_name_snapshot: 'Fresh Milk & Cream',
        mode_name_snapshot: 'CASH',
        amount: 2400,
        quantity: 40,
        unit_snapshot: 'L',
        rate: 60,
        note: 'Nandini Dairy 40L',
        created_at: `${selectedDate}T08:30:00Z`,
        created_by_name: 'Shop Manager',
      },
      {
        id: 't-4',
        txn_date: selectedDate,
        kind: 'expense',
        item_name_snapshot: 'Salary Advance',
        mode_name_snapshot: 'CASH',
        amount: 2000,
        note: 'SA-Suresh Kumar',
        txn_type: 'salary_advance',
        created_at: `${selectedDate}T14:00:00Z`,
        created_by_name: 'Shop Manager',
      },
    ];
  }

  // 4. Month Summary
  let monthIncome = 0;
  let monthExpense = 0;
  let monthOpening = isLive ? 0 : 12000;
  let monthClosing = isLive ? 0 : 27000;
  let days: any[] = [];

  if (dbMonthSummaries && dbMonthSummaries.length > 0) {
    monthOpening = Number(dbMonthSummaries[0].opening) || 0;
    monthClosing = Number(dbMonthSummaries[dbMonthSummaries.length - 1].closing) || 0;
    days = dbMonthSummaries.map((s: any) => {
      const inc = Number(s.income) || 0;
      const exp = Number(s.expense) || 0;
      monthIncome += inc;
      monthExpense += exp;
      return {
        date: s.summary_date,
        opening: Number(s.opening) || 0,
        income: inc,
        expense: exp,
        net: inc - exp,
        closing: Number(s.closing) || 0,
      };
    });
  } else if (isLive) {
    monthOpening = mo ? Number(mo.opening_balance) || 0 : 0;
    monthClosing = monthOpening;
  } else {
    monthIncome = 642000;
    monthExpense = 384000;
    monthClosing = 270000;
    days = [
      { date: `${selectedMonth}-01`, opening: 12000, income: 21500, expense: 9800, net: 11700, closing: 23700 },
      { date: `${selectedMonth}-02`, opening: 23700, income: 24200, expense: 11400, net: 12800, closing: 36500 },
      { date: `${selectedMonth}-03`, opening: 36500, income: 19800, expense: 8900, net: 10900, closing: 47400 },
    ];
  }

  // Month breakdown (Payment Mode Shares & Expense Categories)
  let paymentModeShares: Array<{ name: string; amount: number; percentage: number }> = [];
  let topExpenseCategories: Array<{ category: string; amount: number; percentage: number }> = [];

  if (isLive) {
    const modeMap: Record<string, number> = {};
    const expCatMap: Record<string, number> = {};
    let totalModeIncome = 0;
    let totalExpBreakdown = 0;

    (monthTxns || []).forEach((tx: any) => {
      const amt = Number(tx.amount) || 0;
      if (tx.kind === 'income') {
        const mode = tx.mode_name_snapshot || 'CASH';
        modeMap[mode] = (modeMap[mode] || 0) + amt;
        totalModeIncome += amt;
      } else if (tx.kind === 'expense') {
        const cat = tx.item_name_snapshot || 'General';
        expCatMap[cat] = (expCatMap[cat] || 0) + amt;
        totalExpBreakdown += amt;
      }
    });

    paymentModeShares = Object.entries(modeMap)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalModeIncome > 0 ? (amount / totalModeIncome) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    topExpenseCategories = Object.entries(expCatMap)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpBreakdown > 0 ? (amount / totalExpBreakdown) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  } else {
    paymentModeShares = [
      { name: 'CASH', amount: monthIncome * 0.35, percentage: 35 },
      { name: 'GPAY', amount: monthIncome * 0.45, percentage: 45 },
      { name: 'CARD', amount: monthIncome * 0.15, percentage: 15 },
      { name: 'BANK', amount: monthIncome * 0.05, percentage: 5 },
    ];
    topExpenseCategories = [
      { category: 'Dairy', amount: monthExpense * 0.28, percentage: 28 },
      { category: 'Beverages', amount: monthExpense * 0.22, percentage: 22 },
      { category: 'Bakery', amount: monthExpense * 0.18, percentage: 18 },
      { category: 'Utilities', amount: monthExpense * 0.14, percentage: 14 },
      { category: 'Staff Welfare', amount: monthExpense * 0.18, percentage: 18 },
    ];
  }

  // 5. Employees & Salary Records
  let employees: any[] = isLive
    ? []
    : DEMO_EMPLOYEES.map((e) => ({
        id: e.id,
        employee_id: e.id,
        name: e.name,
        phone: e.phone,
        role_title: e.role_title,
        rate_per_day: e.rate_per_day,
        days_worked: 26,
        gross: 26 * e.rate_per_day,
        advances_total: 2000,
        paid_total: 12000,
        balance: 26 * e.rate_per_day - 2000 - 12000,
      }));

  if (dbEmps && dbEmps.length > 0) {
    employees = dbEmps.map((e: any) => {
      const sr = e.salary_records?.find((r: any) => r.month === selectedMonth);
      const daysWorked = sr ? Number(sr.days_worked) : (isLive ? 0 : 25);
      const rate = Number(e.rate_per_day);
      const gross = sr ? Number(sr.gross) : daysWorked * rate;
      const advances = sr ? Number(sr.advances_total) : 0;
      const paid = sr ? Number(sr.paid_total) : 0;
      const balance = sr ? Number(sr.balance) : gross - advances - paid;
      return {
        id: e.id,
        employee_id: e.id,
        name: e.name,
        phone: e.phone,
        role_title: e.role_title,
        rate_per_day: rate,
        days_worked: daysWorked,
        gross,
        advances_total: advances,
        paid_total: paid,
        balance,
      };
    });
  }

  // 6. Assets
  let assets: any[] = isLive ? [] : DEMO_ASSETS;
  if (dbAssets && dbAssets.length > 0) {
    assets = dbAssets;
  }

  // 7. Payment modes
  let paymentModes: any[] = isLive ? [] : DEMO_PAYMENT_MODES;
  if (dbModes && (dbModes.length > 0 || isLive)) {
    paymentModes = dbModes;
  }

  const adminUser = {
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: 'admin' as const,
  };

  return (
    <SharedAppLayout user={adminUser} brand={user.brand}>
      <ShopDetailView
        shop={shop}
        date={selectedDate}
        month={selectedMonth}
        dailySummary={dailySummary}
        transactions={transactions}
        monthSummary={{
          opening: monthOpening,
          income: monthIncome,
          expense: monthExpense,
          profit_loss: monthIncome - monthExpense,
          closing: monthClosing,
          days,
          paymentModes: paymentModeShares,
          topExpenseCategories,
        }}
        employees={employees}
        assets={assets}
        paymentModes={paymentModes}
        brandName={user.brand?.name || 'CafeLedger'}
      />
    </SharedAppLayout>
  );
}

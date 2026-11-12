import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { BrandDashboardView } from '@/components/admin/dashboard-view';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getTodayKolkata, getMonthBounds, getCurrentMonthKolkata } from '@/lib/calculations/dates';
import { DEMO_ADMIN_SHOPS, DemoShop } from '@/lib/demo-admin-data';
import { ProgressPoint } from '@/components/admin/overall-progress-chart';
import { subDays, format as formatDateFns } from 'date-fns';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; start?: string; end?: string }>;
}) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    redirect('/login');
  }

  const isLive = isSupabaseConfigured();
  const resolvedParams = await searchParams;
  const period = (resolvedParams?.period || 'today') as 'today' | 'week' | 'month' | 'custom';
  const today = getTodayKolkata();
  const currentMonth = getCurrentMonthKolkata();
  const bounds = getMonthBounds(currentMonth);

  let startDate = today;
  let endDate = today;

  if (period === 'week') {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7);
    startDate = d.toISOString().split('T')[0];
    endDate = today;
  } else if (period === 'month') {
    startDate = bounds.start;
    endDate = bounds.end;
  } else if (period === 'custom') {
    startDate = resolvedParams?.start || bounds.start;
    endDate = resolvedParams?.end || today;
  }

  const progressEndDate = today;
  const progressStartDate = formatDateFns(
    subDays(new Date(`${today}T00:00:00Z`), 29),
    'yyyy-MM-dd'
  );
  const progressByDate = new Map<string, { income: number; expense: number }>();

  const supabase = await createClient();

  // 1. Fetch Shops for this brand
  let shops: DemoShop[] = isLive ? [] : DEMO_ADMIN_SHOPS;
  const { data: dbShops } = (await supabase
    .from('shops')
    .select('*, profiles!shop_id(id, full_name, phone)')
    .eq('brand_id', user.brandId)
    .order('name', { ascending: true })) as { data: any[] | null; error: any };

  if (dbShops && dbShops.length > 0) {
    const shopIds = dbShops.map((s) => s.id);
    const periodContainedInProgress = startDate >= progressStartDate && endDate <= progressEndDate;

    // Fetch 30-day progress series (includes today!) in parallel with period summaries (if wider)
    const [periodRes, progRes] = await Promise.all([
      periodContainedInProgress
        ? Promise.resolve({ data: null as any[] | null })
        : supabase
            .from('daily_summary')
            .select('shop_id, summary_date, opening, income, expense, closing')
            .in('shop_id', shopIds)
            .gte('summary_date', startDate)
            .lte('summary_date', endDate),
      supabase
        .from('daily_summary')
        .select('shop_id, summary_date, opening, income, expense, closing')
        .in('shop_id', shopIds)
        .gte('summary_date', progressStartDate)
        .lte('summary_date', progressEndDate),
    ]);

    const progRows = progRes.data || [];
    const dbSummaries = periodContainedInProgress
      ? progRows.filter((r: any) => r.summary_date >= startDate && r.summary_date <= endDate)
      : periodRes.data || [];
    const todaySummaries = progRows.filter((r: any) => r.summary_date === today);

    progRows.forEach((r: any) => {
      const prev = progressByDate.get(r.summary_date) || { income: 0, expense: 0 };
      prev.income += Number(r.income) || 0;
      prev.expense += Number(r.expense) || 0;
      progressByDate.set(r.summary_date, prev);
    });

    const todayMap = new Map<string, any>();
    todaySummaries.forEach((ts: any) => todayMap.set(ts.shop_id, ts));

    const periodMap = new Map<string, { income: number; expense: number; closing: number; opening: number }>();
    dbSummaries.forEach((sum: any) => {
      const prev = periodMap.get(sum.shop_id) || { income: 0, expense: 0, closing: 0, opening: Number(sum.opening) || 0 };
      prev.income += Number(sum.income) || 0;
      prev.expense += Number(sum.expense) || 0;
      prev.closing = Number(sum.closing) || 0;
      periodMap.set(sum.shop_id, prev);
    });

    shops = dbShops.map((s) => {
      const pSum = periodMap.get(s.id);
      const tSum = todayMap.get(s.id);
      return {
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
        today_summary: tSum ? {
          opening: Number(tSum.opening) || 0,
          income: Number(tSum.income) || 0,
          expense: Number(tSum.expense) || 0,
          closing: Number(tSum.closing) || 0,
          has_entries: (Number(tSum.income) > 0 || Number(tSum.expense) > 0),
        } : { opening: 0, income: 0, expense: 0, closing: 0, has_entries: false },
        month_summary: pSum ? {
          opening: pSum.opening,
          income: pSum.income,
          expense: pSum.expense,
          closing: pSum.closing,
          profit_loss: pSum.income - pSum.expense,
        } : undefined,
      };
    });
  }

  // Calculate totals
  let totalIncome = 0;
  let totalExpense = 0;
  let closingCash = 0;

  shops.forEach((s) => {
    const inc = period === 'today' ? (s.today_summary?.income || 0) : (s.month_summary?.income || 0);
    const exp = period === 'today' ? (s.today_summary?.expense || 0) : (s.month_summary?.expense || 0);
    const cl = period === 'today'
      ? (s.today_summary?.closing || 0)
      : (s.month_summary?.closing || s.today_summary?.closing || 0);
    totalIncome += inc;
    totalExpense += exp;
    closingCash += cl;
  });

  const netProfit = totalIncome - totalExpense;
  const missingEntriesShops = shops.filter((s) => s.status === 'active' && s.today_summary?.has_entries === false);

  const sortedByProfit = [...shops].sort((a, b) => {
    const profitA = (a.month_summary?.profit_loss ?? ((a.today_summary?.income || 0) - (a.today_summary?.expense || 0)));
    const profitB = (b.month_summary?.profit_loss ?? ((b.today_summary?.income || 0) - (b.today_summary?.expense || 0)));
    return profitB - profitA;
  });

  const bestShop = sortedByProfit.length > 0 ? sortedByProfit[0] : null;
  const worstShop = sortedByProfit.length > 1 ? sortedByProfit[sortedByProfit.length - 1] : null;

  const progressSeries: ProgressPoint[] = [];
  {
    const cursor = new Date(`${progressStartDate}T00:00:00Z`);
    const endDt = new Date(`${progressEndDate}T00:00:00Z`);
    const baseDailyIncome = shops.reduce((acc, s) => acc + ((s.month_summary?.income || 250000) / 30), 0);
    const baseDailyExpense = shops.reduce((acc, s) => acc + ((s.month_summary?.expense || 140000) / 30), 0);
    let idx = 0;
    while (cursor <= endDt && idx < 35) {
      const iso = cursor.toISOString().split('T')[0];
      if (isLive) {
        const agg = progressByDate.get(iso) || { income: 0, expense: 0 };
        progressSeries.push({
          date: iso,
          income: Math.round(agg.income * 100) / 100,
          expense: Math.round(agg.expense * 100) / 100,
          profit: Math.round((agg.income - agg.expense) * 100) / 100,
        });
      } else {
        const wave = 0.85 + 0.3 * Math.sin(idx * 0.7) + (idx % 7 >= 5 ? 0.12 : 0);
        const expWave = 0.82 + 0.25 * Math.cos(idx * 0.55);
        const income = Math.round(baseDailyIncome * wave);
        const expense = Math.round(baseDailyExpense * expWave);
        progressSeries.push({ date: iso, income, expense, profit: income - expense });
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
      idx += 1;
    }
  }

  const adminUser = {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    username: user.username,
    phone: user.phone,
    role: 'admin' as const,
    brandId: user.brandId,
    mustChangePassword: user.mustChangePassword,
  };

  return (
    <SharedAppLayout user={adminUser} brand={user.brand}>
      <BrandDashboardView
        initialPeriod={period}
        startDate={startDate}
        endDate={endDate}
        shops={shops}
        metrics={{ totalIncome, totalExpense, netProfit, closingCash }}
        missingEntriesShops={missingEntriesShops}
        bestShop={bestShop}
        worstShop={worstShop}
        progressSeries={progressSeries}
        progressStartDate={progressStartDate}
        progressEndDate={progressEndDate}
      />
    </SharedAppLayout>
  );
}

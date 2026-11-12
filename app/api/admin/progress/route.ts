import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createClient } from '@/lib/supabase/server';
import { getTodayKolkata, getMonthBounds, getCurrentMonthKolkata } from '@/lib/calculations/dates';
import { DEMO_ADMIN_SHOPS } from '@/lib/demo-admin-data';
import { subDays, format as formatDateFns } from 'date-fns';

export const dynamic = 'force-dynamic';

export interface ProgressPoint {
  date: string;
  income: number;
  expense: number;
  profit: number;
}

function enumerateDateRange(startDate: string, endDate: string): string[] {
  const out: string[] = [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return out;
  }
  const cursor = new Date(start);
  let guard = 0;
  while (cursor <= end && guard < 370) {
    out.push(cursor.toISOString().split('T')[0]);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard += 1;
  }
  return out;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserContext();
    if (!user || user.role !== 'admin' || !user.brandId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const period = sp.get('period') || '30d';
    const shopIdParam = sp.get('shopId') || 'all';
    const today = getTodayKolkata();

    let startDate = sp.get('start') || '';
    let endDate = sp.get('end') || today;

    if (period === '7d') {
      startDate = formatDateFns(subDays(new Date(`${today}T00:00:00Z`), 6), 'yyyy-MM-dd');
      endDate = today;
    } else if (period === '30d') {
      startDate = formatDateFns(subDays(new Date(`${today}T00:00:00Z`), 29), 'yyyy-MM-dd');
      endDate = today;
    } else if (period === 'month') {
      const bounds = getMonthBounds(getCurrentMonthKolkata());
      startDate = bounds.start;
      endDate = today > bounds.end ? bounds.end : today;
    } else if (!startDate || !endDate) {
      startDate = formatDateFns(subDays(new Date(`${today}T00:00:00Z`), 29), 'yyyy-MM-dd');
      endDate = today;
    }

    const dates = enumerateDateRange(startDate, endDate);

    if (!isSupabaseConfigured()) {
      const targetShops =
        shopIdParam === 'all'
          ? DEMO_ADMIN_SHOPS
          : DEMO_ADMIN_SHOPS.filter((s) => s.id === shopIdParam);

      const baseDailyIncome = targetShops.reduce(
        (acc, s) => acc + ((s.month_summary?.income || 250000) / 30),
        0
      );
      const baseDailyExpense = targetShops.reduce(
        (acc, s) => acc + ((s.month_summary?.expense || 140000) / 30),
        0
      );

      const points: ProgressPoint[] = dates.map((d, idx) => {
        const wave = 0.85 + 0.3 * Math.sin(idx * 0.7) + (idx % 7 === 5 || idx % 7 === 6 ? 0.12 : 0);
        const expWave = 0.82 + 0.25 * Math.cos(idx * 0.55);
        const income = Math.round(baseDailyIncome * wave);
        const expense = Math.round(baseDailyExpense * expWave);
        return {
          date: d,
          income,
          expense,
          profit: income - expense,
        };
      });

      return NextResponse.json({
        startDate,
        endDate,
        shopId: shopIdParam,
        points,
      });
    }

    const supabase = (await createClient()) as any;
    const byDate = new Map<string, { income: number; expense: number }>();

    // Prefer SQL aggregation RPC (reads directly from indexed daily_summary)
    const { data: rpcRows, error: rpcErr } = await supabase.rpc('get_daily_progress_series', {
      p_brand_id: user.brandId,
      p_shop_id: shopIdParam === 'all' ? null : shopIdParam,
      p_start_date: startDate,
      p_end_date: endDate,
    });

    if (!rpcErr && Array.isArray(rpcRows)) {
      rpcRows.forEach((row: any) => {
        byDate.set(String(row.summary_date), {
          income: Number(row.total_income ?? row.income) || 0,
          expense: Number(row.total_expense ?? row.expense) || 0,
        });
      });
    } else {
      // Fallback query if RPC is not yet deployed in DB
      let shopIds: string[] = [];
      if (shopIdParam !== 'all') {
        const { data: ownedShop } = await supabase
          .from('shops')
          .select('id')
          .eq('id', shopIdParam)
          .eq('brand_id', user.brandId)
          .maybeSingle();
        if (ownedShop?.id) shopIds = [ownedShop.id];
      } else {
        const { data: brandShops } = await supabase
          .from('shops')
          .select('id')
          .eq('brand_id', user.brandId);
        shopIds = (brandShops || []).map((s: any) => s.id);
      }

      if (shopIds.length > 0) {
        const { data: sumRows } = await supabase
          .from('daily_summary')
          .select('summary_date, income, expense')
          .in('shop_id', shopIds)
          .gte('summary_date', startDate)
          .lte('summary_date', endDate);

        (sumRows || []).forEach((r: any) => {
          const prev = byDate.get(r.summary_date) || { income: 0, expense: 0 };
          prev.income += Number(r.income) || 0;
          prev.expense += Number(r.expense) || 0;
          byDate.set(r.summary_date, prev);
        });
      }
    }

    const points: ProgressPoint[] = dates.map((d) => {
      const agg = byDate.get(d) || { income: 0, expense: 0 };
      return {
        date: d,
        income: Math.round(agg.income * 100) / 100,
        expense: Math.round(agg.expense * 100) / 100,
        profit: Math.round((agg.income - agg.expense) * 100) / 100,
      };
    });

    return NextResponse.json({
      startDate,
      endDate,
      shopId: shopIdParam,
      points,
    });
  } catch (err: any) {
    console.error('Admin progress API error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to load progress chart' },
      { status: 500 }
    );
  }
}

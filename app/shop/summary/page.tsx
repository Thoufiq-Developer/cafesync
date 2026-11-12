import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { MonthSummaryView, DaySummaryRow, PaymentModeShare, ExpenseCategoryShare } from '@/components/shop/month-summary-view';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getCurrentMonthKolkata, getPreviousMonth, getNextMonth, formatDisplayMonth, getMonthBounds } from '@/lib/calculations/dates';
import { calculatePeriodSummary } from '@/lib/calculations/financials';
import { redirect } from 'next/navigation';
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ShopMonthSummaryPage({
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
  const bounds = getMonthBounds(selectedMonth);

  const supabase = await createClient();

  const [monthOpeningRes, dailyRes, monthTxnsRes] = await Promise.all([
    user.shopId
      ? supabase
          .from('month_openings')
          .select('opening_balance')
          .eq('shop_id', user.shopId)
          .eq('month', selectedMonth)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    user.shopId
      ? supabase
          .from('daily_summary')
          .select('summary_date, opening, income, expense, closing')
          .eq('shop_id', user.shopId)
          .gte('summary_date', bounds.start)
          .lte('summary_date', bounds.end)
          .order('summary_date', { ascending: true })
      : Promise.resolve({ data: null }),
    isLive && user.shopId
      ? supabase
          .from('transactions')
          .select('kind, amount, item_name_snapshot, mode_name_snapshot')
          .eq('shop_id', user.shopId)
          .gte('txn_date', bounds.start)
          .lte('txn_date', bounds.end)
          .eq('is_deleted', false)
      : Promise.resolve({ data: null }),
  ]);

  // 1. Month Opening
  let openingBalance = isLive ? 0 : 24000;
  let hasExplicitOpening = false;
  const monthOpening = monthOpeningRes?.data as any;
  if (monthOpening) {
    openingBalance = Number(monthOpening.opening_balance);
    hasExplicitOpening = true;
  }

  // 2. Daily Summary Rows for selected month
  let dailyRows: DaySummaryRow[] = [];
  const dbDaily = dailyRes?.data as any[] | null;
  if (dbDaily && dbDaily.length > 0) {
    dailyRows = dbDaily.map((r) => ({
      date: r.summary_date,
      opening: Number(r.opening),
      income: Number(r.income),
      expense: Number(r.expense),
      net: Number(r.income) - Number(r.expense),
      closing: Number(r.closing),
    }));
    if (!hasExplicitOpening) {
      openingBalance = dailyRows[0].opening;
    }
  }

  // Fallback demo rows only in local demo mode
  if (!isLive && dailyRows.length === 0) {
    let currBal = openingBalance;
    for (let day = 1; day <= 28; day++) {
      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      const dayIncome = 16000 + ((day * 730) % 7000);
      const dayExpense = 9000 + ((day * 540) % 4000);
      const net = dayIncome - dayExpense;
      const closing = currBal + net;

      dailyRows.push({
        date: dateStr,
        opening: currBal,
        income: dayIncome,
        expense: dayExpense,
        net,
        closing,
      });

      currBal = closing;
    }
  }

  const totalIncome = dailyRows.reduce((sum, r) => sum + r.income, 0);
  const totalExpense = dailyRows.reduce((sum, r) => sum + r.expense, 0);
  const closingBalance = dailyRows.length > 0 ? dailyRows[dailyRows.length - 1].closing : openingBalance;
  const summary = calculatePeriodSummary({ openingBalance, totalIncome, totalExpense });

  // 3. Payment Mode Shares & Top Expense Categories
  let paymentModeShares: PaymentModeShare[] = [];
  let topExpenseCategories: ExpenseCategoryShare[] = [];

  if (isLive) {
    if (user.shopId) {
      const monthTxns = (monthTxnsRes?.data || []) as any[];

      const modeMap: Record<string, number> = {};
      const expCatMap: Record<string, number> = {};
      let totalModeIncome = 0;
      let totalExpBreakdown = 0;

      (monthTxns || []).forEach((tx) => {
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
    }
  } else {
    paymentModeShares = [
      { name: 'CASH', amount: Math.round(totalIncome * 0.32), percentage: 32 },
      { name: 'GPAY / UPI', amount: Math.round(totalIncome * 0.44), percentage: 44 },
      { name: 'BANK / SWIGGY', amount: Math.round(totalIncome * 0.16), percentage: 16 },
      { name: 'CARD', amount: Math.round(totalIncome * 0.08), percentage: 8 },
    ];
    topExpenseCategories = [
      { category: 'Fresh Milk & Dairy', amount: Math.round(totalExpense * 0.28), percentage: 28 },
      { category: 'Specialty Coffee Beans', amount: Math.round(totalExpense * 0.22), percentage: 22 },
      { category: 'Artisan Breads & Bakery', amount: Math.round(totalExpense * 0.16), percentage: 16 },
      { category: 'Packaging & Takeaway Cups', amount: Math.round(totalExpense * 0.12), percentage: 12 },
      { category: 'Commercial Kitchen Gas', amount: Math.round(totalExpense * 0.08), percentage: 8 },
      { category: 'Petty Cash & Miscellaneous', amount: Math.round(totalExpense * 0.14), percentage: 14 },
    ];
  }

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
              <CalendarCheck className="h-6 w-6 text-[var(--brand-primary,#ea580c)]" />
              <span>Month Financial Summary</span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Opening balance, mode breakdown, category distributions and daily carry-forwards.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/shop/summary?month=${prevMonth}`}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-900 text-white min-w-[100px] text-center">
              {formatDisplayMonth(selectedMonth)}
            </span>

            <Link
              href={`/shop/summary?month=${nextMonth}`}
              className="p-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 shadow-2xs"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {/* Month Summary View */}
        <MonthSummaryView
          selectedMonth={selectedMonth}
          openingBalance={openingBalance}
          totalIncome={totalIncome}
          totalExpense={totalExpense}
          profitLoss={summary.profitLoss}
          closingBalance={closingBalance}
          dailyRows={dailyRows}
          paymentModeShares={paymentModeShares}
          topExpenseCategories={topExpenseCategories}
        />
      </div>
    </SharedAppLayout>
  );
}


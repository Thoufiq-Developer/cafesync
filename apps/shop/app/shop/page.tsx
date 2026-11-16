'use client';

import React, { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { StatCard } from '@/components/shared/stat-card';
import { Money } from '@/components/shared/format-values';
import { DailyEntryForm } from '@/components/shop/daily-entry-form';
import { DailyTransactionsTable } from '@/components/shop/transactions-table';
import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getTodayKolkata, formatDate } from '@/lib/calculations/dates';
import { DEMO_ITEMS, DEMO_PAYMENT_MODES } from '@/lib/demo-shop-data';
import { Calendar as CalendarIcon, TrendingUp, TrendingDown, DollarSign, Wallet, Plus, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

function ShopDailyEntryContent() {
  const { profile, shop, brand } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const isLive = isSupabaseConfigured();
  const today = getTodayKolkata();
  const paramDate = searchParams.get('date');
  const selectedDate = paramDate && paramDate <= today ? paramDate : today;
  const selectedMonth = selectedDate.substring(0, 7);

  const shopId = profile?.shop_id || shop?.id;
  const brandId = profile?.brand_id || brand?.id;

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['shop-daily-register', shopId, brandId, selectedDate],
    queryFn: async () => {
      if (!isLive) {
        const activeItems = DEMO_ITEMS;
        const paymentModes = DEMO_PAYMENT_MODES;
        const isMonthClosed = false;
        const dailySummary = { opening: 18500, income: 22400, expense: 8150, closing: 32750 };
        const transactions = [
          {
            id: 'demo-1',
            txn_date: today,
            kind: 'income',
            item_id: activeItems[0]?.id || null,
            item_name_snapshot: 'Counter Billing',
            mode_id: paymentModes[0]?.id,
            mode_name_snapshot: 'CASH',
            amount: 8500,
            quantity: null,
            unit_snapshot: null,
            rate: null,
            note: 'Afternoon counter cash collection',
            txn_type: 'normal',
            created_at: new Date().toISOString(),
          },
          {
            id: 'demo-2',
            txn_date: today,
            kind: 'income',
            item_id: activeItems[0]?.id || null,
            item_name_snapshot: 'Counter Billing',
            mode_id: paymentModes[1]?.id,
            mode_name_snapshot: 'GPAY',
            amount: 7200,
            quantity: null,
            unit_snapshot: null,
            rate: null,
            note: 'UPI QR scan orders',
            txn_type: 'normal',
            created_at: new Date().toISOString(),
          },
          {
            id: 'demo-3',
            txn_date: today,
            kind: 'expense',
            item_id: activeItems.find((i: any) => i.name.includes('Milk'))?.id || null,
            item_name_snapshot: 'Fresh Milk & Cream',
            mode_id: paymentModes[0]?.id,
            mode_name_snapshot: 'CASH',
            amount: 1450,
            quantity: 23.5,
            unit_snapshot: 'L',
            rate: 61.7,
            note: 'Morning dairy batch delivery',
            txn_type: 'normal',
            created_at: new Date().toISOString(),
          },
          {
            id: 'demo-4',
            txn_date: today,
            kind: 'expense',
            item_id: null,
            item_name_snapshot: 'Salary Advance',
            mode_id: paymentModes[0]?.id,
            mode_name_snapshot: 'CASH',
            amount: 1500,
            quantity: null,
            unit_snapshot: null,
            rate: null,
            note: 'SA-Suresh Kumar',
            txn_type: 'salary_advance',
            created_at: new Date().toISOString(),
          },
        ];

        return {
          activeItems,
          paymentModes,
          isMonthClosed,
          dailySummary,
          transactions,
        };
      }

      const fetchItems = async () => {
        if (!brandId) return [];
        let q = supabase
          .from('items')
          .select('id, name, kind, category, unit, default_rate, shop_id')
          .eq('brand_id', brandId)
          .eq('is_active', true)
          .order('name', { ascending: true });
        if (shopId) {
          q = q.or(`shop_id.is.null,shop_id.eq.${shopId}`);
        } else {
          q = q.is('shop_id', null);
        }
        const res = await q;
        if (!res.error && res.data) return res.data;

        // Legacy fallback
        const legacy = await supabase
          .from('items')
          .select('id, name, kind, category')
          .eq('brand_id', brandId)
          .eq('is_active', true)
          .order('name', { ascending: true });
        return (legacy.data || []).map((i: any) => ({
          ...i,
          unit: i.kind === 'expense' ? 'kg' : 'pcs',
          default_rate: null,
          shop_id: null,
        }));
      };

      const fetchTransactions = async () => {
        if (!shopId) return [];
        const res = await supabase
          .from('transactions')
          .select('id, txn_date, kind, item_id, item_name_snapshot, mode_id, mode_name_snapshot, amount, quantity, unit_snapshot, rate, note, txn_type, created_at')
          .eq('shop_id', shopId)
          .eq('txn_date', selectedDate)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });
        if (!res.error && res.data) return res.data;

        const legacy = await supabase
          .from('transactions')
          .select('id, txn_date, kind, item_id, item_name_snapshot, mode_id, mode_name_snapshot, amount, note, txn_type, created_at')
          .eq('shop_id', shopId)
          .eq('txn_date', selectedDate)
          .eq('is_deleted', false)
          .order('created_at', { ascending: false });
        return legacy.data || [];
      };

      const [
        dbItems,
        modesRes,
        monthRecRes,
        summaryRes,
        dbTxns,
      ] = await Promise.all([
        fetchItems(),
        brandId
          ? supabase
              .from('payment_modes')
              .select('id, name')
              .eq('brand_id', brandId)
              .eq('is_active', true)
              .order('name', { ascending: true })
          : Promise.resolve({ data: [] }),
        shopId
          ? supabase
              .from('month_openings')
              .select('opening_balance, closed_at')
              .eq('shop_id', shopId)
              .eq('month', selectedMonth)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        shopId
          ? supabase
              .from('daily_summary')
              .select('opening, income, expense, closing')
              .eq('shop_id', shopId)
              .eq('summary_date', selectedDate)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        fetchTransactions(),
      ]);

      const activeItems = dbItems || [];
      const paymentModes = (modesRes as any)?.data || [];
      const monthRecord = (monthRecRes as any)?.data;
      const isMonthClosed = Boolean(monthRecord?.closed_at);

      let dailySummary = { opening: 0, income: 0, expense: 0, closing: 0 };
      if (shopId) {
        const dbSummary = (summaryRes as any)?.data;
        if (dbSummary) {
          dailySummary = {
            opening: Number(dbSummary.opening),
            income: Number(dbSummary.income),
            expense: Number(dbSummary.expense),
            closing: Number(dbSummary.closing),
          };
        } else {
          const { data: prevSummary } = await (supabase as any)
            .from('daily_summary')
            .select('closing')
            .eq('shop_id', shopId)
            .lt('summary_date', selectedDate)
            .order('summary_date', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (prevSummary) {
            const carried = Number((prevSummary as any).closing) || 0;
            dailySummary = { opening: carried, income: 0, expense: 0, closing: carried };
          } else if (monthRecord) {
            const carried = Number(monthRecord.opening_balance) || 0;
            dailySummary = { opening: carried, income: 0, expense: 0, closing: carried };
          }
        }
      }

      const transactions = dbTxns || [];

      return {
        activeItems,
        paymentModes,
        isMonthClosed,
        dailySummary,
        transactions,
      };
    },
    enabled: Boolean(!isLive || shopId),
  });

  const handleDateChange = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const date = formData.get('date') as string;
    if (date) {
      router.push(`/shop/?date=${encodeURIComponent(date)}`);
    }
  };

  const managerUser = {
    id: profile?.id || '',
    fullName: profile?.full_name || 'Shop Manager',
    email: profile?.email || '',
    username: '',
    phone: '',
    role: 'manager' as const,
    brandId: brandId || null,
    shopName: shop?.name || 'Shop Counter',
    shopCode: shop?.code || 'SHOP-01',
    mustChangePassword: profile?.must_change_password ?? false,
  };

  const activeItems = data?.activeItems || [];
  const paymentModes = data?.paymentModes || [];
  const isMonthClosed = data?.isMonthClosed || false;
  const dailySummary = data?.dailySummary || { opening: 0, income: 0, expense: 0, closing: 0 };
  const transactions = data?.transactions || [];

  return (
    <SharedAppLayout user={managerUser} brand={brand as any}>
      <div className="space-y-5">
        {/* Sticky Today Quick Summary Pill Strip */}
        <div className="sticky top-16 z-20 -mx-1 px-3 py-2 rounded-lg bg-white/95 backdrop-blur-xs border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-2 text-xs md:hidden">
          <div className="flex items-center gap-3 overflow-x-auto">
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Income</span>
              <span className="font-bold text-emerald-700 font-mono">
                <Money value={dailySummary.income} />
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Expense</span>
              <span className="font-bold text-rose-700 font-mono">
                <Money value={dailySummary.expense} />
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] uppercase tracking-wider text-slate-400 block">Balance</span>
              <span className="font-bold text-slate-900 font-mono">
                <Money value={dailySummary.closing} />
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-slate-500 shrink-0">
            {formatDate(selectedDate)}
          </span>
        </div>

        {/* Top Control Bar: Date Picker & Primary Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span>Daily Counter Register</span>
              <span className="text-sm font-normal text-slate-500 hidden sm:inline">
                ({shop?.name || 'Store'} - {shop?.code || 'SHOP-01'})
              </span>
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Record sales and expenses here — totals and closing balances update automatically.
            </p>
          </div>

          <form onSubmit={handleDateChange} className="flex items-center gap-2">
            <div className="relative flex items-center">
              <CalendarIcon className="absolute left-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="date"
                name="date"
                defaultValue={selectedDate}
                max={today}
                aria-label="Select register date"
                className="pl-8 pr-2 py-1 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-800 shadow-2xs min-h-[44px] sm:min-h-[38px] cursor-pointer focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>
            <button
              type="submit"
              className="min-h-[44px] sm:min-h-[38px] px-4 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
            >
              Go
            </button>
          </form>
        </div>

        {isLoading ? (
          <div className="py-12 flex items-center justify-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span className="text-xs">Loading register data...</span>
          </div>
        ) : (
          <>
            {/* 4 Core Daily Balance Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard
                title="Opening Balance"
                amount={dailySummary.opening}
                subtitle="Previous day's closing"
                icon={Wallet}
                variant="default"
              />
              <StatCard
                title="Today's Total Income"
                amount={dailySummary.income}
                subtitle="Counter + Delivery"
                icon={TrendingUp}
                variant="income"
              />
              <StatCard
                title="Today's Total Expense"
                amount={dailySummary.expense}
                subtitle="Supplies & Advances"
                icon={TrendingDown}
                variant="expense"
              />
              <StatCard
                title="Live Closing Balance"
                amount={dailySummary.closing}
                subtitle="Opening + Income - Expense"
                icon={DollarSign}
                variant="highlight"
              />
            </div>

            {/* Fast Entry Form */}
            <DailyEntryForm
              selectedDate={selectedDate}
              shopId={shopId || undefined}
              activeItems={activeItems}
              paymentModes={paymentModes}
              isMonthClosed={isMonthClosed}
            />

            {/* Today's Transactions Table */}
            <DailyTransactionsTable
              transactions={transactions}
              paymentModes={paymentModes}
              isMonthClosed={isMonthClosed}
              selectedDate={selectedDate}
            />
          </>
        )}

        {/* Mobile Floating "+ Add Entry" Button */}
        <a
          href="#daily-entry-form"
          className="md:hidden fixed bottom-20 right-4 z-30 inline-flex items-center gap-1.5 min-h-[46px] px-4 py-2.5 rounded-full bg-[var(--brand-primary,#ea580c)] text-white text-xs font-bold shadow-lg active:scale-95 transition-transform"
        >
          <Plus className="h-4 w-4" />
          <span>Add Entry</span>
        </a>
      </div>
    </SharedAppLayout>
  );
}

export default function ShopDailyEntryPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-slate-500">Loading daily counter register...</div>}>
      <ShopDailyEntryContent />
    </Suspense>
  );
}

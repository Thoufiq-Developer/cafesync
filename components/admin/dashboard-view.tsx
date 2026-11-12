'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Store,
  AlertTriangle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { StatCard } from '@/components/shared/stat-card';
import { Count, Money } from '@/components/shared/format-values';
import { DemoShop } from '@/lib/demo-admin-data';
import { Button } from '@/components/ui/button';
import { OverallProgressChart, ProgressPoint } from './overall-progress-chart';

interface DashboardViewProps {
  initialPeriod: 'today' | 'week' | 'month' | 'custom';
  startDate: string;
  endDate: string;
  shops: DemoShop[];
  metrics: {
    totalIncome: number;
    totalExpense: number;
    netProfit: number;
    closingCash: number;
  };
  missingEntriesShops: DemoShop[];
  bestShop: DemoShop | null;
  worstShop: DemoShop | null;
  progressSeries: ProgressPoint[];
  progressStartDate: string;
  progressEndDate: string;
}

export function BrandDashboardView({
  initialPeriod,
  startDate,
  endDate,
  shops,
  metrics,
  missingEntriesShops,
  bestShop,
  worstShop,
  progressSeries,
  progressStartDate,
  progressEndDate,
}: DashboardViewProps) {
  const router = useRouter();
  const [selectedPeriod, setSelectedPeriod] = useState(initialPeriod);
  const [customStart, setCustomStart] = useState(startDate);
  const [customEnd, setCustomEnd] = useState(endDate);

  const handlePeriodChange = (period: 'today' | 'week' | 'month' | 'custom') => {
    setSelectedPeriod(period);
    if (period !== 'custom') {
      router.push(`/admin?period=${period}`);
    }
  };

  const handleApplyCustom = () => {
    if (customStart && customEnd) {
      router.push(`/admin?period=custom&start=${customStart}&end=${customEnd}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP HEADER & PERIOD SWITCHER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Layers className="h-6 w-6 text-[var(--brand-primary,#ea580c)]" />
            <span>Brand Executive Dashboard</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Real-time aggregate performance from daily summary across all <Count value={shops.length} /> cafe outlets.
          </p>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          {(['today', 'week', 'month', 'custom'] as const).map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                selectedPeriod === p
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom'}
            </button>
          ))}
        </div>
      </div>

      {/* CUSTOM DATE RANGE FILTER (if active) */}
      {selectedPeriod === 'custom' && (
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">From:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-600">To:</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
            />
          </div>
          <Button size="sm" onClick={handleApplyCustom} className="text-xs bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90">
            Apply Range
          </Button>
        </div>
      )}

      {/* 2. ALERT BANNER: MISSING ENTRIES TODAY */}
      {missingEntriesShops.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/80 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h2 className="text-sm font-semibold text-amber-900">
                Data Entry Missing Today (<Count value={missingEntriesShops.length} /> {missingEntriesShops.length === 1 ? 'Shop' : 'Shops'})
              </h2>
              <p className="text-xs text-amber-700">
                The following outlets have not recorded any daily sales or expense transactions for today yet:
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {missingEntriesShops.map((s) => (
                  <Link
                    key={s.id}
                    href={`/admin/shops/${s.id}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg bg-white border border-amber-300 text-amber-900 hover:bg-amber-100 transition-colors shadow-2xs"
                  >
                    <Store className="h-3 w-3 text-amber-600" />
                    <span>{s.name} ({s.code})</span>
                    <ArrowUpRight className="h-3 w-3 text-amber-500" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. CONSOLIDATED KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Brand Income"
          amount={metrics.totalIncome}
          subtitle={`${shops.length} ${shops.length === 1 ? 'outlet' : 'outlets'} in selected period`}
          icon={TrendingUp}
          variant="income"
        />
        <StatCard
          title="Total Brand Expenses"
          amount={metrics.totalExpense}
          subtitle="Operating, dairy, inventory & payroll"
          icon={TrendingDown}
          variant="expense"
        />
        <StatCard
          title="Net Brand Profit"
          amount={metrics.netProfit}
          subtitle={metrics.netProfit >= 0 ? 'Healthy operating margin' : 'Net deficit for period'}
          icon={metrics.netProfit >= 0 ? TrendingUp : TrendingDown}
          variant={metrics.netProfit >= 0 ? 'income' : 'expense'}
        />
        <StatCard
          title="Closing Cash Position"
          amount={metrics.closingCash}
          subtitle="Current cash-in-hand across all registers"
          icon={Wallet}
          variant="highlight"
        />
      </div>

      {/* 4. BEST & WORST PERFORMING OUTLETS CALLOUT */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {bestShop && (
          <div className="p-4 rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-emerald-100/30 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span>Top Performing Outlet</span>
              </div>
              <div className="text-base font-bold text-slate-900">{bestShop.name} ({bestShop.code})</div>
              <div className="text-xs text-slate-600">
                Income: <span className="font-semibold text-emerald-700"><Money value={bestShop.month_summary?.income || 0} /></span> | Profit: <span className="font-semibold text-emerald-700"><Money value={bestShop.month_summary?.profit_loss || 0} /></span>
              </div>
            </div>
            <Link
              href={`/admin/shops/${bestShop.id}`}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-50 transition-colors shadow-2xs flex items-center gap-1"
            >
              <span>View</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {worstShop && (
          <div className="p-4 rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50/70 to-rose-100/30 shadow-xs flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-800 uppercase tracking-wider">
                <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                <span>Lowest Turnover / Needs Focus</span>
              </div>
              <div className="text-base font-bold text-slate-900">{worstShop.name} ({worstShop.code})</div>
              <div className="text-xs text-slate-600">
                Income: <span className="font-semibold text-slate-800"><Money value={worstShop.month_summary?.income || 0} /></span> | Profit: <span className="font-semibold text-rose-700"><Money value={worstShop.month_summary?.profit_loss || 0} /></span>
              </div>
            </div>
            <Link
              href={`/admin/shops/${worstShop.id}`}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-rose-300 text-rose-800 hover:bg-rose-50 transition-colors shadow-2xs flex items-center gap-1"
            >
              <span>View</span>
              <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>

      {/* 5. SHOP-WISE COMPARISON TABLE & VISUAL BARS */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Store className="h-4 w-4 text-slate-600" />
              <span>Shop-by-Shop Financial Comparison</span>
            </h2>
            <p className="text-xs text-slate-500">
              Aggregated from daily_summary table. Click any shop to view its ledger.
            </p>
          </div>
          <Link
            href="/admin/shops"
            className="text-xs font-semibold text-[var(--brand-primary,#ea580c)] hover:underline flex items-center gap-1"
          >
            <span>Manage All Shops</span>
            <ChevronRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Shop Name</th>
                <th className="py-3 px-3">Code</th>
                <th className="py-3 px-3 text-right">Income</th>
                <th className="py-3 px-3 text-right">Expense</th>
                <th className="py-3 px-3 text-right">Net Profit</th>
                <th className="py-3 px-3 text-right">Closing Cash</th>
                <th className="py-3 px-3 text-center">Data Today</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shops.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 px-4 text-center text-slate-500">
                    No outlets created yet. Open <Link href="/admin/shops" className="font-semibold text-[var(--brand-primary,#ea580c)] hover:underline">Manage All Shops</Link> to add your first cafe branch.
                  </td>
                </tr>
              ) : (
                shops.map((s) => {
                  const inc = s.today_summary?.income || s.month_summary?.income || 0;
                  const exp = s.today_summary?.expense || s.month_summary?.expense || 0;
                  const net = inc - exp;
                  const closing = s.today_summary?.closing || s.month_summary?.closing || 0;
                  const hasToday = s.today_summary?.has_entries ?? true;

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <Link
                          href={`/admin/shops/${s.id}`}
                          className="font-bold text-slate-900 hover:text-[var(--brand-primary,#ea580c)] flex items-center gap-1.5"
                        >
                          <span>{s.name}</span>
                          <ArrowUpRight className="h-3 w-3 opacity-40 group-hover:opacity-100" />
                        </Link>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs">{s.address}</div>
                      </td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-600">{s.code}</td>
                      <td className="py-3 px-3 text-right font-semibold text-emerald-700">
                        <Money value={inc} />
                      </td>
                      <td className="py-3 px-3 text-right font-medium text-rose-700">
                        <Money value={exp} />
                      </td>
                      <td className={`py-3 px-3 text-right font-bold ${net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        <Money value={net} />
                      </td>
                      <td className="py-3 px-3 text-right font-semibold text-slate-900">
                        <Money value={closing} />
                      </td>
                      <td className="py-3 px-3 text-center">
                        {hasToday ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Entered</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800">
                            <Clock className="h-3 w-3" />
                            <span>Pending</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Link
                          href={`/admin/shops/${s.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-[var(--brand-primary,#ea580c)] hover:text-white transition-colors"
                        >
                          <span>Open</span>
                          <ChevronRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 6. OVERALL PROGRESS LINE GRAPH (replaces inline activity feed) */}
      <OverallProgressChart
        shops={shops}
        initialPoints={progressSeries}
        initialStartDate={progressStartDate}
        initialEndDate={progressEndDate}
      />
    </div>
  );
}


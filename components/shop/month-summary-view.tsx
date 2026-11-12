'use client';

import React from 'react';
import { formatINR } from '@/lib/calculations/currency';
import { formatDate } from '@/lib/calculations/dates';
import { StatCard } from '@/components/shared/stat-card';
import { Count } from '@/components/shared/format-values';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  DollarSign,
  PieChart,
  Calendar,
  Layers,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export interface DaySummaryRow {
  date: string; // YYYY-MM-DD
  opening: number;
  income: number;
  expense: number;
  net: number;
  closing: number;
}

export interface PaymentModeShare {
  name: string;
  amount: number;
  percentage: number;
}

export interface ExpenseCategoryShare {
  category: string;
  amount: number;
  percentage: number;
}

interface MonthSummaryViewProps {
  selectedMonth: string;
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  profitLoss: number;
  closingBalance: number;
  dailyRows: DaySummaryRow[];
  paymentModeShares: PaymentModeShare[];
  topExpenseCategories: ExpenseCategoryShare[];
}

export function MonthSummaryView({
  selectedMonth,
  openingBalance,
  totalIncome,
  totalExpense,
  profitLoss,
  closingBalance,
  dailyRows,
  paymentModeShares,
  topExpenseCategories,
}: MonthSummaryViewProps) {
  return (
    <div className="space-y-6">
      {/* 5 Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard
          title="Month Opening"
          amount={openingBalance}
          subtitle="Carried from previous month"
          icon={Wallet}
          variant="default"
        />
        <StatCard
          title="Gross Income"
          amount={totalIncome}
          subtitle="All collections"
          icon={TrendingUp}
          variant="income"
        />
        <StatCard
          title="Gross Expenses"
          amount={totalExpense}
          subtitle="Supplies, gas, advances"
          icon={TrendingDown}
          variant="expense"
        />
        <StatCard
          title="Net Profit / Loss"
          amount={profitLoss}
          subtitle="Income - Expense"
          variant={profitLoss >= 0 ? 'income' : 'expense'}
        />
        <StatCard
          title="Month Closing"
          amount={closingBalance}
          subtitle="Opening + Net Change"
          icon={DollarSign}
          variant="highlight"
        />
      </div>

      {/* Breakdown Row: Payment Modes & Top Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment Modes Share */}
        <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <PieChart className="h-4 w-4 text-[var(--brand-primary,#ea580c)]" />
              <span>Collections by Payment Mode</span>
            </h3>
            <span className="text-xs font-mono font-semibold text-slate-500">
              {formatINR(totalIncome)}
            </span>
          </div>

          <div className="space-y-2.5">
            {paymentModeShares.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">
                No income collections recorded for this month yet.
              </p>
            ) : (
              paymentModeShares.map((m) => (
                <div key={m.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800">{m.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-600">{formatINR(m.amount)}</span>
                      <span className="font-semibold text-slate-400 w-10 text-right">
                        {m.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[var(--brand-primary,#ea580c)] rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(2, m.percentage))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Top Expense Categories */}
        <div className="p-4 sm:p-5 rounded-xl border border-slate-200 bg-white shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Layers className="h-4 w-4 text-red-600" />
              <span>Top Expense Outflows</span>
            </h3>
            <span className="text-xs font-mono font-semibold text-red-700">
              {formatINR(totalExpense)}
            </span>
          </div>

          <div className="space-y-2.5">
            {topExpenseCategories.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">
                No expenses recorded for this month yet.
              </p>
            ) : (
              topExpenseCategories.map((c) => (
                <div key={c.category} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 truncate pr-2">
                      {c.category}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-red-700">{formatINR(c.amount)}</span>
                      <span className="font-semibold text-slate-400 w-10 text-right">
                        {c.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-red-600 rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(2, c.percentage))}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Daily Summary Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-slate-100 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Daily Ledger (Date | Opening | Income | Expense | Net | Closing)
            </h3>
            <p className="text-xs text-slate-500">
              Pre-calculated daily summaries carried forward automatically.
            </p>
          </div>
          <Badge variant="outline" className="text-xs font-mono font-bold">
            <Count value={dailyRows.length} suffix="Days Recorded" />
          </Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4 text-right">Opening (₹)</th>
                <th className="py-3 px-4 text-right text-emerald-700">Income (₹)</th>
                <th className="py-3 px-4 text-right text-red-700">Expense (₹)</th>
                <th className="py-3 px-4 text-right">Net Change</th>
                <th className="py-3 px-4 text-right font-bold text-slate-900">Closing (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {dailyRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center font-sans text-slate-400">
                    No daily summary records found for this month yet.
                  </td>
                </tr>
              ) : (
                dailyRows.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-800">
                      {formatDate(row.date)}
                    </td>
                    <td className="py-2.5 px-4 text-right text-slate-600">
                      {formatINR(row.opening, false)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-emerald-700">
                      +{formatINR(row.income, false)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-semibold text-red-700">
                      -{formatINR(row.expense, false)}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-bold ${
                        row.net >= 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {row.net >= 0 ? '+' : ''}
                      {formatINR(row.net, false)}
                    </td>
                    <td className="py-2.5 px-4 text-right font-bold text-slate-900 font-mono">
                      {formatINR(row.closing, false)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Totals Footer */}
            <tfoot className="bg-slate-50 border-t border-slate-200 font-bold font-mono">
              <tr>
                <td className="py-3 px-4 font-sans text-slate-900">TOTAL</td>
                <td className="py-3 px-4 text-right text-slate-600">-</td>
                <td className="py-3 px-4 text-right text-emerald-700">+{formatINR(totalIncome, false)}</td>
                <td className="py-3 px-4 text-right text-red-700">-{formatINR(totalExpense, false)}</td>
                <td
                  className={`py-3 px-4 text-right ${
                    profitLoss >= 0 ? 'text-emerald-700' : 'text-red-700'
                  }`}
                >
                  {profitLoss >= 0 ? '+' : ''}
                  {formatINR(profitLoss, false)}
                </td>
                <td className="py-3 px-4 text-right text-[var(--brand-primary,#ea580c)]">
                  {formatINR(closingBalance, false)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}


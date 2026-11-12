'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Store,
  Calendar,
  Layers,
  Users,
  Wrench,
  FileSpreadsheet,
  TrendingUp,
  TrendingDown,
  Wallet,
  ArrowLeft,
  CalendarCheck,
  ChevronRight,
  Shield,
  Download,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/shared/stat-card';
import { Count } from '@/components/shared/format-values';
import { DemoShop } from '@/lib/demo-admin-data';
import { DailyTransactionsTable } from '@/components/shop/transactions-table';
import { MonthSummaryView, DaySummaryRow, PaymentModeShare, ExpenseCategoryShare } from '@/components/shop/month-summary-view';
import { StaffSalaryManager, EmployeeSalaryItem } from '@/components/shop/staff-salary-manager';
import { AssetsManagerClient } from '@/components/shop/assets-manager-client';
import { ReportsManager } from '@/components/shop/reports-manager';

interface ShopDetailViewProps {
  shop: DemoShop;
  date: string;
  month: string;
  dailySummary: {
    opening: number;
    income: number;
    expense: number;
    closing: number;
  };
  transactions: any[];
  monthSummary: {
    opening: number;
    income: number;
    expense: number;
    profit_loss: number;
    closing: number;
    days: DaySummaryRow[];
    paymentModes: PaymentModeShare[];
    topExpenseCategories: ExpenseCategoryShare[];
  };
  employees: EmployeeSalaryItem[];
  assets: any[];
  paymentModes: any[];
  brandName?: string;
}

export function ShopDetailView({
  shop,
  date,
  month,
  dailySummary,
  transactions,
  monthSummary,
  employees,
  assets,
  paymentModes,
  brandName = 'CafeLedger',
}: ShopDetailViewProps) {
  const [activeTab, setActiveTab] = useState<'daily' | 'month' | 'staff' | 'assets' | 'reports'>('daily');

  return (
    <div className="space-y-6">
      {/* 1. SHOP HEADER & BREADCRUMB */}
      <div className="space-y-3 pb-3 border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/admin/shops" className="hover:text-[var(--brand-primary,#ea580c)] flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            <span>All Outlets</span>
          </Link>
          <span>/</span>
          <span className="font-semibold text-slate-800">{shop.name}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                {shop.code}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{shop.name}</h1>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                  shop.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                }`}
              >
                {shop.status}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-1">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 text-slate-400" />
                {shop.address || 'Address not configured'}
              </span>
              {shop.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400" />
                  {shop.phone}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3 text-slate-400" />
                Managers: {shop.managers && shop.managers.length > 0 ? shop.managers.map((m) => m.full_name).join(', ') : 'None assigned'}
              </span>
            </div>
          </div>
        </div>

        {/* 2. TAB NAVIGATION */}
        <div className="flex overflow-x-auto gap-1 border-b border-slate-200 pt-2 -mb-3 scrollbar-none">
          {[
            { id: 'daily', label: 'Daily Ledger', icon: Layers },
            { id: 'month', label: 'Month Summary', icon: CalendarCheck },
            { id: 'staff', label: 'Staff & Payroll', icon: Users },
            { id: 'assets', label: 'Assets & Equipment', icon: Wrench },
            { id: 'reports', label: 'Excel & PDF Reports', icon: FileSpreadsheet },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                  isActive
                    ? 'border-[var(--brand-primary,#ea580c)] text-[var(--brand-primary,#ea580c)] bg-orange-50/30'
                    : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. TAB CONTENT */}
      {activeTab === 'daily' && (
        <div className="space-y-6">
          {/* Daily KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Opening Balance"
              amount={dailySummary.opening}
              subtitle={`Carried forward on ${date}`}
              icon={Wallet}
              variant="default"
            />
            <StatCard
              title="Today's Income"
              amount={dailySummary.income}
              subtitle="Cash, UPI & Card sales"
              icon={TrendingUp}
              variant="income"
            />
            <StatCard
              title="Today's Expense"
              amount={dailySummary.expense}
              subtitle="Daily items & salary advances"
              icon={TrendingDown}
              variant="expense"
            />
            <StatCard
              title="Closing Balance"
              amount={dailySummary.closing}
              subtitle="Opening + Income - Expense"
              icon={TrendingUp}
              variant="highlight"
            />
          </div>

          {/* Transactions Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-900">Recorded Transactions for {date}</h2>
              <span className="text-xs text-slate-500 font-mono">
                <Count value={transactions.length} suffix="entries" />
              </span>
            </div>
            <DailyTransactionsTable
              transactions={transactions}
              selectedDate={date}
              isMonthClosed={false}
              paymentModes={paymentModes}
            />
          </div>
        </div>
      )}

      {activeTab === 'month' && (
        <MonthSummaryView
          selectedMonth={month}
          openingBalance={monthSummary.opening}
          totalIncome={monthSummary.income}
          totalExpense={monthSummary.expense}
          profitLoss={monthSummary.profit_loss}
          closingBalance={monthSummary.closing}
          dailyRows={monthSummary.days}
          paymentModeShares={monthSummary.paymentModes}
          topExpenseCategories={monthSummary.topExpenseCategories}
        />
      )}

      {activeTab === 'staff' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <StaffSalaryManager
            selectedMonth={month}
            employees={employees}
            paymentModes={paymentModes}
          />
        </div>
      )}

      {activeTab === 'assets' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <AssetsManagerClient
            assets={assets}
            today={date}
          />
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
          <ReportsManager
            shopId={shop.id}
            shopName={shop.name}
            brandName={brandName}
          />
        </div>
      )}
    </div>
  );
}

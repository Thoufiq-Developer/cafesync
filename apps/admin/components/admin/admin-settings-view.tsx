'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Download,
  AlertTriangle,
  Lock,
  Calendar,
  ShieldAlert,
  CheckCircle2,
  Clock,
  Sparkles,
  Store,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Count } from '@/components/shared/format-values';
import { toast } from 'sonner';
import {
  closeMonthAction,
  overrideMonthOpeningAction,
} from '@/app/admin/actions';
import { DemoShop } from '@/lib/demo-admin-data';
import { getCurrentMonthKolkata } from '@/lib/calculations/dates';

interface AdminSettingsViewProps {
  brand: {
    id: string;
    name: string;
    primary_color: string;
    secondary_color: string;
  };
  shops: DemoShop[];
}

export function AdminSettingsView({ brand, shops }: AdminSettingsViewProps) {
  // Backup state
  const [lastBackupDate, setLastBackupDate] = useState<string | null>(null);
  const [isBackupLoading, setIsBackupLoading] = useState(false);

  // Manager backdate window
  const [backdateDays, setBackdateDays] = useState(2);

  // Month closing state
  const [closeMonthShopId, setCloseMonthShopId] = useState(shops[0]?.id || '');
  const [closeMonthValue, setCloseMonthValue] = useState(getCurrentMonthKolkata());
  const [isClosingMonth, setIsClosingMonth] = useState(false);

  // Manual opening override state
  const [overrideShopId, setOverrideShopId] = useState(shops[0]?.id || '');
  const [overrideMonth, setOverrideMonth] = useState(getCurrentMonthKolkata());
  const [overrideAmount, setOverrideAmount] = useState<number>(15000);
  const [overrideNote, setOverrideNote] = useState('');
  const [isOverriding, setIsOverriding] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('cafeledger_last_backup_date');
    if (saved) {
      setLastBackupDate(saved);
    }
  }, []);

  // Check if backup is older than 7 days
  const isBackupOverdue = () => {
    if (!lastBackupDate) return true;
    const diffMs = Date.now() - new Date(lastBackupDate).getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    return diffDays >= 7;
  };

  const handleDownloadBackup = async () => {
    setIsBackupLoading(true);
    const toastId = toast.loading('Exporting complete brand backup archive (ZIP)...');
    try {
      const { exportBackup } = await import('@cafesync/shared/lib/backup/export');
      const { supabase } = await import('@/lib/supabase/client');

      const result = await exportBackup(supabase, {
        scope: 'brand',
        brandId: brand.id,
        includeLogos: true,
        onProgress: (statusMsg) => {
          toast.loading(statusMsg, { id: toastId });
        },
      });

      const downloadUrl = window.URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      const now = new Date().toISOString();
      setLastBackupDate(now);
      localStorage.setItem('cafeledger_last_backup_date', now);

      toast.success('Full multi-table database backup archive downloaded successfully', { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Backup export failed', { id: toastId });
    } finally {
      setIsBackupLoading(false);
    }
  };

  const handleCloseMonth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeMonthShopId || !closeMonthValue) return;

    if (!confirm(`Are you sure you want to lock month ${closeMonthValue}? Once locked, managers cannot modify past entries in this period.`)) {
      return;
    }

    setIsClosingMonth(true);
    try {
      const res = await closeMonthAction(closeMonthShopId, closeMonthValue);
      if (res.success) {
        toast.success(`Month ${closeMonthValue} locked. Opening balance finalized for next month.`);
      } else {
        toast.error(res.error || 'Failed to lock month');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsClosingMonth(false);
    }
  };

  const handleOverrideOpening = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideShopId || !overrideMonth || !overrideNote.trim()) {
      toast.error('Shop, month, amount, and an audit note are required for manual opening balance override');
      return;
    }

    setIsOverriding(true);
    try {
      const res = await overrideMonthOpeningAction({
        shopId: overrideShopId,
        month: overrideMonth,
        openingBalance: overrideAmount,
        note: overrideNote,
      });

      if (res.success) {
        toast.success(`Opening balance for ${overrideMonth} manually updated with audit note.`);
        setOverrideNote('');
      } else {
        toast.error(res.error || 'Override failed');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsOverriding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-[var(--brand-primary,#ea580c)]" />
            <span>Brand Administration & System Controls</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Configure manager backdate policies, freeze/lock fiscal months, override carried forward balances, and manage data backups.
          </p>
        </div>
      </div>

      {/* 2. BACKUP REMINDER BANNER */}
      {isBackupOverdue() && (
        <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-amber-900">
                Scheduled Backup Notice: Disaster Recovery Safeguard
              </h2>
              <p className="text-xs text-amber-700 mt-0.5">
                {lastBackupDate
                  ? `Last complete backup was taken on ${new Date(lastBackupDate).toLocaleDateString('en-IN', { dateStyle: 'medium' })}. Policy recommends exporting a backup at least once every 7 days.`
                  : 'No full database backup has been downloaded yet for this brand. Regular backups protect against accidental loss.'}
              </p>
            </div>
          </div>

          <Button
            onClick={handleDownloadBackup}
            disabled={isBackupLoading}
            size="sm"
            className="bg-amber-600 hover:bg-amber-700 text-white shrink-0 flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{isBackupLoading ? 'Exporting...' : 'Download Full Backup Now'}</span>
          </Button>
        </div>
      )}

      {/* 3. FULL BACKUP SYSTEM CARD */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">Full Brand Database Backup (.xlsx)</h2>
          </div>
          <span className="text-xs text-slate-500">
            {lastBackupDate ? `Last backup: ${new Date(lastBackupDate).toLocaleString('en-IN')}` : 'No previous backup recorded'}
          </span>
        </div>

        <p className="text-xs text-slate-600">
          Exports ALL historical data across all <Count value={shops.length} /> outlets into a single master Excel file with individual sheets for:
          <strong> Shops, Transactions, Employees, Salary Records, Equipment Assets, Maintenance Logs, Catalog Items, and Payment Modes</strong>.
        </p>

        <div className="pt-1">
          <Button
            onClick={handleDownloadBackup}
            disabled={isBackupLoading}
            className="bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            <span>{isBackupLoading ? 'Generating Full Backup...' : 'Download Complete Database Backup'}</span>
          </Button>
        </div>
      </div>

      {/* 4. SETTINGS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD A: MANAGER PERMISSIONS & BACKDATE WINDOW */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Clock className="h-5 w-5 text-[var(--brand-primary,#ea580c)]" />
            <h2 className="text-sm font-semibold text-slate-900">Manager Daily Entry Window (N Days)</h2>
          </div>

          <p className="text-xs text-slate-600">
            Controls how far in the past shop managers can edit or delete their recorded transactions. Default is 2 days.
          </p>

          <div className="space-y-1.5 max-w-xs">
            <label className="text-xs font-semibold text-slate-700">Backdate Edit Window (Days)</label>
            <select
              value={backdateDays}
              onChange={(e) => {
                const val = Number(e.target.value);
                setBackdateDays(val);
                toast.success(`Manager edit window updated to ${val} days`);
              }}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)] bg-white font-medium"
            >
              <option value={1}>1 Day (Strict - Today and yesterday only)</option>
              <option value={2}>2 Days (Standard Recommended)</option>
              <option value={3}>3 Days</option>
              <option value={5}>5 Days</option>
              <option value={7}>7 Days (1 Week)</option>
            </select>
          </div>
        </div>

        {/* CARD B: MONTH CLOSING & PERIOD LOCK */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="h-5 w-5 text-rose-600" />
            <h2 className="text-sm font-semibold text-slate-900">Fiscal Month Closing & Period Lock</h2>
          </div>

          <p className="text-xs text-slate-600">
            Freezes the ledger for a month and locks transactions. Carries forward the final closing balance as the next month's opening balance.
          </p>

          <form onSubmit={handleCloseMonth} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Select Outlet</label>
                <select
                  value={closeMonthShopId}
                  onChange={(e) => setCloseMonthShopId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Month to Lock</label>
                <input
                  type="month"
                  value={closeMonthValue}
                  onChange={(e) => setCloseMonthValue(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isClosingMonth}
              size="sm"
              className="bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>{isClosingMonth ? 'Locking...' : 'Lock Month & Carry Forward'}</span>
            </Button>
          </form>
        </div>

        {/* CARD D: MANUAL OPENING BALANCE OVERRIDE */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <RefreshCw className="h-5 w-5 text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-900">Manual Opening Balance Override</h2>
          </div>

          <p className="text-xs text-slate-600">
            Carried forward opening balance is calculated automatically from previous month's closing.
            Admins can manually override with a mandatory audit justification note.
          </p>

          <form onSubmit={handleOverrideOpening} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Select Outlet</label>
                <select
                  value={overrideShopId}
                  onChange={(e) => setOverrideShopId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Month</label>
                <input
                  type="month"
                  value={overrideMonth}
                  onChange={(e) => setOverrideMonth(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Override Opening Balance (₹)</label>
              <input
                type="number"
                required
                value={overrideAmount}
                onChange={(e) => setOverrideAmount(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Mandatory Audit Note *</label>
              <input
                type="text"
                required
                placeholder="Reason (e.g. Physical cash count adjustment by auditor)"
                value={overrideNote}
                onChange={(e) => setOverrideNote(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>

            <Button
              type="submit"
              disabled={isOverriding}
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isOverriding ? 'Saving Override...' : 'Submit Opening Override'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}


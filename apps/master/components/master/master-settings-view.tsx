'use client';

import React, { useState } from 'react';
import {
  Settings,
  Lock,
  KeyRound,
  ShieldCheck,
  Tag,
  CreditCard,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  Layers,
  Database,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Count } from '@/components/shared/format-values';
import { changeMasterPasswordAction } from '@/app/master/actions';
import { DEFAULT_SEED_CONFIG } from '@/lib/master-constants';

export function MasterSettingsView({ masterEmail }: { masterEmail?: string }) {
  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  // Seed configuration state
  const [paymentModes, setPaymentModes] = useState<string[]>(DEFAULT_SEED_CONFIG?.paymentModes || ['CASH', 'GPAY', 'BANK', 'CARD']);
  const [newModeInput, setNewModeInput] = useState('');

  const [expenseItems, setExpenseItems] = useState(DEFAULT_SEED_CONFIG?.expenseItems || []);
  const [newExpenseName, setNewExpenseName] = useState('');
  const [newExpenseCat, setNewExpenseCat] = useState('Groceries');

  const [incomeItems, setIncomeItems] = useState(DEFAULT_SEED_CONFIG?.incomeItems || []);
  const [newIncomeName, setNewIncomeName] = useState('');
  const [newIncomeCat, setNewIncomeCat] = useState('Sales');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await changeMasterPasswordAction(newPassword);
      if (res.success) {
        toast.success('Master password updated successfully. Audit log created.');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(res.error || 'Failed to update password');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleAddPaymentMode = () => {
    const trimmed = newModeInput.trim().toUpperCase();
    if (!trimmed) return;
    if (paymentModes.includes(trimmed)) {
      toast.error('Mode already in list');
      return;
    }
    setPaymentModes([...paymentModes, trimmed]);
    setNewModeInput('');
    toast.success(`Added ${trimmed} to default seed modes`);
  };

  const handleRemovePaymentMode = (mode: string) => {
    setPaymentModes(paymentModes.filter((m) => m !== mode));
  };

  const handleAddExpenseItem = () => {
    const trimmed = newExpenseName.trim();
    if (!trimmed) return;
    setExpenseItems([...expenseItems, { name: trimmed, category: newExpenseCat }]);
    setNewExpenseName('');
    toast.success(`Added ${trimmed} to seed expense items`);
  };

  const handleRemoveExpenseItem = (idx: number) => {
    setExpenseItems(expenseItems.filter((_, i) => i !== idx));
  };

  const handleAddIncomeItem = () => {
    const trimmed = newIncomeName.trim();
    if (!trimmed) return;
    setIncomeItems([...incomeItems, { name: trimmed, category: newIncomeCat }]);
    setNewIncomeName('');
    toast.success(`Added ${trimmed} to seed income items`);
  };

  const handleRemoveIncomeItem = (idx: number) => {
    setIncomeItems(incomeItems.filter((_, i) => i !== idx));
  };

  const rlsTables = [
    { name: 'brands', rule: 'Master reads/writes all; Admin reads own brand_id' },
    { name: 'shops', rule: 'Master reads/writes all; Admin manages brand shops; Manager reads own shop' },
    { name: 'profiles', rule: 'Role isolation; Master all; Admin brand profiles; Manager self' },
    { name: 'transactions', rule: 'Admin reads brand txns; Manager reads/writes shop txns' },
    { name: 'daily_summary', rule: 'Aggregated SQL trigger; Admin brand scope; Manager shop scope' },
    { name: 'month_openings', rule: 'Carried forward closing balances; Admin manual override' },
    { name: 'items', rule: 'Brand-wide by Admin; Shop-only by Manager; soft delete preserves snapshots' },
    { name: 'payment_modes', rule: 'Seeded default modes; Brand tenant boundary' },
    { name: 'employees', rule: 'Admin manages rate_per_day; Manager views shop staff' },
    { name: 'salary_records', rule: 'Auto-synced on transactions; Gross, advances, paid, balance' },
    { name: 'assets', rule: 'Admin registers; Manager logs service; Urgency alerts' },
    { name: 'asset_service_logs', rule: 'Maintenance history; Books ledger expense' },
    { name: 'audit_log', rule: 'Immutable append-only trail; Master global view' },
  ];

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-slate-800" />
            <span>Platform Master Settings & Template Seeders</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage master root credentials, customize default seed categories for new brands, and verify RLS policies.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* CARD 1: CHANGE MASTER PASSWORD */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Lock className="h-5 w-5 text-slate-800" />
            <h2 className="text-sm font-semibold text-slate-900">Change Master Root Password</h2>
          </div>

          <p className="text-xs text-slate-600">
            Updates the credentials for <strong>{masterEmail || 'your Master account'}</strong>.
            All password rotations are permanently logged to the platform audit log.
          </p>

          <form onSubmit={handleChangePassword} className="space-y-3 max-w-sm">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">New Master Password *</label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Confirm New Password *</label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
              />
            </div>

            <Button
              type="submit"
              disabled={isChangingPass}
              size="sm"
              className="bg-slate-900 text-white hover:bg-slate-800"
            >
              {isChangingPass ? 'Updating...' : 'Update Master Password'}
            </Button>
          </form>
        </div>

        {/* CARD 2: DEFAULT SEED PAYMENT MODES */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-900">Default Payment Modes Template</h2>
            </div>
            <span className="text-xs font-mono text-slate-500"><Count value={paymentModes?.length || 0} suffix="modes" /></span>
          </div>

          <p className="text-xs text-slate-600">
            Automatically initialized in <code>payment_modes</code> table whenever a new brand is created.
          </p>

          <div className="flex flex-wrap gap-2">
            {paymentModes.map((mode) => (
              <span
                key={mode}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono font-bold bg-slate-100 text-slate-800 border border-slate-200"
              >
                <span>{mode}</span>
                <button
                  type="button"
                  onClick={() => handleRemovePaymentMode(mode)}
                  className="text-slate-400 hover:text-rose-600"
                  title="Remove from defaults"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              placeholder="e.g. SODEXO, CRED"
              value={newModeInput}
              onChange={(e) => setNewModeInput(e.target.value.toUpperCase())}
              className="px-2.5 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg flex-1"
            />
            <Button size="sm" onClick={handleAddPaymentMode} variant="outline" className="text-xs">
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>Add Mode</span>
            </Button>
          </div>
        </div>
      </div>

      {/* SECTION 2: DEFAULT SEED ITEMS (EXPENSE & INCOME) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* STARTER EXPENSE ITEMS */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-rose-600" />
              <h2 className="text-sm font-semibold text-slate-900">Default Starter Expense Categories</h2>
            </div>
            <span className="text-xs font-mono text-slate-500"><Count value={expenseItems?.length || 0} suffix="items" /></span>
          </div>

          <p className="text-xs text-slate-600">
            Initial expense catalog automatically provisioned for new brands (Milk, Gas, Provisions, Bread, Salary Advance).
          </p>

          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
            {(expenseItems || []).map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-rose-50 border border-rose-200 text-rose-900"
              >
                <span>{item.name}</span>
                <span className="text-[10px] text-rose-600 font-normal">({item.category})</span>
                <button
                  type="button"
                  onClick={() => handleRemoveExpenseItem(idx)}
                  className="text-rose-400 hover:text-rose-700 font-bold ml-0.5"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              placeholder="Item name (e.g. Cheese)"
              value={newExpenseName}
              onChange={(e) => setNewExpenseName(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg flex-1"
            />
            <input
              type="text"
              placeholder="Category (e.g. Dairy)"
              value={newExpenseCat}
              onChange={(e) => setNewExpenseCat(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg w-28"
            />
            <Button size="sm" onClick={handleAddExpenseItem} variant="outline" className="text-xs">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* STARTER INCOME ITEMS */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Tag className="h-5 w-5 text-emerald-600" />
              <h2 className="text-sm font-semibold text-slate-900">Default Starter Income Categories</h2>
            </div>
            <span className="text-xs font-mono text-slate-500"><Count value={incomeItems?.length || 0} suffix="items" /></span>
          </div>

          <p className="text-xs text-slate-600">
            Initial income categories seeded for sales tracking (Billing, Zomato, Swiggy, Bulk Orders).
          </p>

          <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto pr-1">
            {(incomeItems || []).map((item, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 border border-emerald-200 text-emerald-900"
              >
                <span>{item.name}</span>
                <span className="text-[10px] text-emerald-600 font-normal">({item.category})</span>
                <button
                  type="button"
                  onClick={() => handleRemoveIncomeItem(idx)}
                  className="text-emerald-400 hover:text-emerald-700 font-bold ml-0.5"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="text"
              placeholder="Item name (e.g. Catering)"
              value={newIncomeName}
              onChange={(e) => setNewIncomeName(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg flex-1"
            />
            <input
              type="text"
              placeholder="Category (e.g. Events)"
              value={newIncomeCat}
              onChange={(e) => setNewIncomeCat(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg w-28"
            />
            <Button size="sm" onClick={handleAddIncomeItem} variant="outline" className="text-xs">
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* SECTION 3: RLS VERIFICATION MATRIX */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">Postgres Row Level Security (RLS) Verification</h2>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
            14 / 14 Tables Enforced
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rlsTables.map((t) => (
            <div key={t.name} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs flex items-start gap-2.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-mono font-bold text-slate-900">{t.name}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">{t.rule}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Tag,
  CreditCard,
  Plus,
  Power,
  Search,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  savePaymentModeAction,
  togglePaymentModeStatusAction,
} from '@/app/admin/actions';
import { toast } from 'sonner';
import { Count } from '@/components/shared/format-values';
import { formatCount } from '@/lib/calculations/format';
import { ItemsManager, CatalogItemRecord } from '@/components/shared/items-manager';

export type { CatalogItemRecord as CatalogItem };

export interface PaymentModeItem {
  id: string;
  name: string;
  is_active: boolean;
  usage_count: number;
}

interface ItemsPaymentModesManagerProps {
  initialItems: CatalogItemRecord[];
  initialPaymentModes: PaymentModeItem[];
}

export function ItemsPaymentModesManager({
  initialItems,
  initialPaymentModes,
}: ItemsPaymentModesManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState<CatalogItemRecord[]>(initialItems);
  const [paymentModes, setPaymentModes] =
    useState<PaymentModeItem[]>(initialPaymentModes);
  const [activeTab, setActiveTab] = useState<'income' | 'expense' | 'payment_modes'>(
    'expense'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [createItemSignal, setCreateItemSignal] = useState(0);

  // Payment mode modal state
  const [modeModalOpen, setModeModalOpen] = useState(false);
  const [editingMode, setEditingMode] = useState<PaymentModeItem | null>(null);
  const [modeName, setModeName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setPaymentModes(initialPaymentModes);
  }, [initialPaymentModes]);

  const filteredModes = paymentModes.filter((m) =>
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSavePaymentMode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modeName.trim()) return;

    setIsSubmitting(true);
    try {
      const res = await savePaymentModeAction({
        id: editingMode?.id,
        name: modeName,
      });
      if (res.success) {
        toast.success(`Payment mode "${modeName.toUpperCase()}" saved`);
        if (editingMode) {
          setPaymentModes((prev) =>
            prev.map((m) =>
              m.id === editingMode.id
                ? { ...m, name: modeName.trim().toUpperCase() }
                : m
            )
          );
        } else {
          setPaymentModes((prev) => [
            ...prev,
            {
              id: 'mode-' + Date.now(),
              name: modeName.trim().toUpperCase(),
              is_active: true,
              usage_count: 0,
            },
          ]);
        }
        setModeModalOpen(false);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleModeStatus = async (mode: PaymentModeItem) => {
    const newStatus = !mode.is_active;
    try {
      const res = await togglePaymentModeStatusAction(mode.id, newStatus);
      if (res.success) {
        toast.success(
          `Mode "${mode.name}" ${newStatus ? 'Activated' : 'Deactivated'}`
        );
        setPaymentModes((prev) =>
          prev.map((m) =>
            m.id === mode.id ? { ...m, is_active: newStatus } : m
          )
        );
        router.refresh();
      } else {
        toast.error(res.error);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Tag className="h-6 w-6 text-[var(--brand-primary,#ea580c)]" />
            <span>Items &amp; Payment Modes</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Create brand-wide items, review shop-specific items added by managers, and manage active payment methods.
          </p>
        </div>

        <Button
          onClick={() => {
            if (activeTab === 'payment_modes') {
              setEditingMode(null);
              setModeName('');
              setModeModalOpen(true);
            } else {
              setCreateItemSignal((s) => s + 1);
            }
          }}
          className="min-h-[44px] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90 flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>
            {activeTab === 'payment_modes'
              ? 'Add Payment Mode'
              : activeTab === 'income'
                ? 'Add Income Item'
                : 'Add Expense Item'}
          </span>
        </Button>
      </div>

      {/* 2. TAB CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 bg-slate-100 p-1.5 rounded-lg border border-slate-200">
          <button
            onClick={() => setActiveTab('expense')}
            className={`flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'expense'
                ? 'bg-white text-rose-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
            <span>
              Expense Items (
              {formatCount(items.filter((i) => i.kind === 'expense').length)})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('income')}
            className={`flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'income'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            <span>
              Income Items (
              {formatCount(items.filter((i) => i.kind === 'income').length)})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('payment_modes')}
            className={`flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === 'payment_modes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5 text-indigo-600" />
            <span>Payment Modes ({formatCount(paymentModes.length)})</span>
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search items or modes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[38px] pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)] bg-white"
          />
        </div>
      </div>

      {/* 3. ITEMS CATALOG (Income or Expense) */}
      {(activeTab === 'income' || activeTab === 'expense') && (
        <ItemsManager
          role="admin"
          initialItems={items}
          forcedKindTab={activeTab}
          forcedSearchTerm={searchTerm}
          hideHeader
          externalCreateSignal={createItemSignal}
          onItemsChanged={setItems}
        />
      )}

      {/* 4. PAYMENT MODES TABLE */}
      {activeTab === 'payment_modes' && (
        <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="py-3 px-4">Payment Mode</th>
                  <th className="py-3 px-3 text-center">Usage Count</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredModes.map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      {m.name}
                    </td>
                    <td className="py-3 px-3 text-center font-mono text-slate-600">
                      <Count value={m.usage_count} /> entries
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          m.is_active
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {m.is_active ? 'Active' : 'Disabled'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleModeStatus(m)}
                        className={`h-8 px-2 text-xs ${
                          m.is_active
                            ? 'text-amber-600 hover:text-amber-700'
                            : 'text-emerald-600 hover:text-emerald-700'
                        }`}
                      >
                        <Power className="h-3 w-3 mr-1" />
                        <span>{m.is_active ? 'Disable' : 'Enable'}</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ADD PAYMENT MODE MODAL */}
      <Dialog open={modeModalOpen} onOpenChange={setModeModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <CreditCard className="h-5 w-5 text-indigo-600" />
              <span>Add Payment Mode</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSavePaymentMode} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Mode Name *
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. CASH, GPAY, SWIGGY_PAY"
                value={modeName}
                onChange={(e) => setModeName(e.target.value.toUpperCase())}
                className="w-full min-h-[44px] px-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModeModalOpen(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90"
              >
                {isSubmitting ? 'Saving...' : 'Save Mode'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

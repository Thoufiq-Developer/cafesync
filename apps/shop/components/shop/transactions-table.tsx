'use client';

import React, { useState, useTransition, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EditTransactionModal, PreviousTxnSnapshot } from './edit-transaction-modal';
import {
  deleteDailyTransactionAction,
  restoreDailyTransactionAction,
  updateDailyTransactionAction,
} from '@/app/shop/actions';
import { formatMoney, formatRatePerUnit } from '@/lib/calculations/format';
import { formatQuantityWithUnit } from '@/lib/constants/units';
import { Count, Money } from '@/components/shared/format-values';
import { formatDate, getTodayKolkata } from '@/lib/calculations/dates';
import { differenceInCalendarDays } from 'date-fns';
import { toast } from 'sonner';
import {
  Edit2,
  Trash2,
  Lock,
  PlusCircle,
  MinusCircle,
  Loader2,
  AlertTriangle,
  Search,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface TransactionItem {
  id: string;
  txn_date: string;
  kind: string;
  item_name_snapshot: string;
  mode_id?: string | null;
  mode_name_snapshot: string;
  amount: number;
  quantity?: number | null;
  unit_snapshot?: string | null;
  rate?: number | null;
  note?: string | null;
  txn_type: string;
  created_at: string;
}

interface TransactionsTableProps {
  transactions: TransactionItem[];
  paymentModes: Array<{ id: string; name: string }>;
  isMonthClosed?: boolean;
  selectedDate: string;
}

export function DailyTransactionsTable({
  transactions,
  paymentModes,
  isMonthClosed = false,
  selectedDate,
}: TransactionsTableProps) {
  const router = useRouter();
  const [editingTxn, setEditingTxn] = useState<TransactionItem | null>(null);
  const [deletingTxn, setDeletingTxn] = useState<TransactionItem | null>(null);
  const [kindFilter, setKindFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, startDeleteTransition] = useTransition();

  const today = getTodayKolkata();

  const canEditTransaction = (txnDate: string) => {
    if (isMonthClosed) return false;
    const daysDiff = differenceInCalendarDays(new Date(today), new Date(txnDate));
    return daysDiff <= 2;
  };

  const filteredTransactions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (kindFilter !== 'all' && tx.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        tx.item_name_snapshot.toLowerCase().includes(q) ||
        (tx.note || '').toLowerCase().includes(q) ||
        tx.mode_name_snapshot.toLowerCase().includes(q)
      );
    });
  }, [transactions, kindFilter, searchTerm]);

  const confirmDelete = () => {
    if (!deletingTxn) return;
    const target = deletingTxn;
    startDeleteTransition(async () => {
      const res = await deleteDailyTransactionAction(target.id);
      if (res?.error) {
        toast.error(res.error);
      } else {
        setDeletingTxn(null);
        router.refresh();
        toast.success(
          `Deleted ${formatMoney(target.amount)} ${target.item_name_snapshot} entry`,
          {
            duration: 8000,
            action: {
              label: 'Undo',
              onClick: async () => {
                const undoRes = await restoreDailyTransactionAction(target.id);
                if (undoRes?.error) {
                  toast.error(undoRes.error);
                } else {
                  toast.success(`Restored ${target.item_name_snapshot} entry`);
                  router.refresh();
                }
              },
            },
          }
        );
      }
    });
  };

  const handleEditedWithUndo = (prev: PreviousTxnSnapshot) => {
    router.refresh();
    toast.success(`Updated ${prev.item_name_snapshot} entry`, {
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: async () => {
          const revertForm = new FormData();
          revertForm.append('transaction_id', prev.id);
          revertForm.append('amount', String(prev.amount));
          revertForm.append('note', prev.note);
          revertForm.append(
            'quantity',
            prev.quantity !== null && prev.quantity !== undefined ? String(prev.quantity) : ''
          );
          if (prev.unit_snapshot) {
            revertForm.append('unit_snapshot', prev.unit_snapshot);
          }
          if (prev.mode_id) {
            revertForm.append('mode_id', prev.mode_id);
          }
          const undoRes = await updateDailyTransactionAction(revertForm);
          if (undoRes?.error) {
            toast.error(undoRes.error);
          } else {
            toast.success(`Reverted ${prev.item_name_snapshot} back to ${formatMoney(prev.amount)}`);
            router.refresh();
          }
        },
      },
    });
  };

  return (
    <>
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Recorded Entries ({formatDate(selectedDate)})
              </h3>
              <p className="text-xs text-slate-500">
                <Count value={filteredTransactions.length} suffix="entries shown" />
                {filteredTransactions.length !== transactions.length && (
                  <>
                    {' '}
                    of <Count value={transactions.length} /> total
                  </>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[11px] font-medium">
                <Lock className="h-3 w-3" /> Edit window: 2 days
              </span>
              {isMonthClosed && (
                <Badge variant="destructive" className="text-[10px]">
                  Month Closed
                </Badge>
              )}
            </div>
          </div>

          {/* Search & Quick Filter Bar */}
          {transactions.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="inline-flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start">
                {(
                  [
                    { id: 'all', label: 'All' },
                    { id: 'income', label: 'Income' },
                    { id: 'expense', label: 'Expense' },
                  ] as const
                ).map((chip) => (
                  <button
                    key={chip.id}
                    type="button"
                    onClick={() => setKindFilter(chip.id)}
                    className={`min-h-[36px] px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                      kindFilter === chip.id
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-3 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search item, note, or payment mode..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full min-h-[40px] pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>
            </div>
          )}
        </div>

        {transactions.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <p className="text-sm font-medium">No entries recorded for this date yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Use the Add Daily Entry form above to save your first sale or expense.
            </p>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            <p className="text-sm font-medium">No entries match your search or filter.</p>
            <button
              type="button"
              onClick={() => {
                setKindFilter('all');
                setSearchTerm('');
              }}
              className="mt-2 text-xs font-semibold text-[var(--brand-primary,#ea580c)] underline cursor-pointer"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Item</th>
                    <th className="py-3 px-3">Qty / Unit Rate</th>
                    <th className="py-3 px-3 text-center">Mode</th>
                    <th className="py-3 px-4 text-right">Amount (₹)</th>
                    <th className="py-3 px-4">Note / Reference</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTransactions.map((tx) => {
                    const isIncome = tx.kind === 'income';
                    const editable = canEditTransaction(tx.txn_date);
                    const qtyLabel = formatQuantityWithUnit(tx.quantity, tx.unit_snapshot);
                    const unitPriceLabel =
                      tx.quantity && Number(tx.quantity) > 0
                        ? formatRatePerUnit(
                            tx.rate ?? Number(tx.amount) / Number(tx.quantity),
                            tx.unit_snapshot
                          )
                        : null;

                    return (
                      <tr key={tx.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span
                              className={`p-1 rounded-full shrink-0 ${
                                isIncome
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isIncome ? (
                                <PlusCircle className="h-3.5 w-3.5" />
                              ) : (
                                <MinusCircle className="h-3.5 w-3.5" />
                              )}
                            </span>
                            <div>
                              <div>{tx.item_name_snapshot}</div>
                              {tx.txn_type === 'salary_advance' ? (
                                <span className="text-[10px] text-purple-700 font-medium">
                                  Salary Advance
                                </span>
                              ) : tx.txn_type === 'salary_payment' ? (
                                <span className="text-[10px] text-blue-700 font-medium">
                                  Salary Payment
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                          {qtyLabel !== '-' ? (
                            <div>
                              <span className="font-semibold text-slate-800">{qtyLabel}</span>
                              {unitPriceLabel && unitPriceLabel !== '-' && (
                                <div className="text-[10px] text-slate-400">
                                  @ {unitPriceLabel}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                            {tx.mode_name_snapshot}
                          </Badge>
                        </td>
                        <td
                          className={`py-3 px-4 text-right font-bold font-mono text-sm ${
                            isIncome ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isIncome ? '+' : '-'} <Money value={tx.amount} />
                        </td>
                        <td className="py-3 px-4 text-slate-500 truncate max-w-xs text-[11px]">
                          {tx.note || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {editable ? (
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                onClick={() => setEditingTxn(tx)}
                                title="Edit Entry"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => setDeletingTxn(tx)}
                                title="Delete Entry"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <span
                              className="text-[10px] text-slate-400 flex items-center justify-center gap-1"
                              title="Locked: past 2-day edit window"
                            >
                              <Lock className="h-3 w-3" /> Locked
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (44px+ Touch-Optimized Targets) */}
            <div className="sm:hidden divide-y divide-slate-100">
              {filteredTransactions.map((tx) => {
                const isIncome = tx.kind === 'income';
                const editable = canEditTransaction(tx.txn_date);
                const qtyLabel = formatQuantityWithUnit(tx.quantity, tx.unit_snapshot);

                return (
                  <div key={tx.id} className="p-3.5 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <span
                          className={`p-1 rounded-full mt-0.5 shrink-0 ${
                            isIncome ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isIncome ? (
                            <PlusCircle className="h-3.5 w-3.5" />
                          ) : (
                            <MinusCircle className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 text-sm truncate">
                            {tx.item_name_snapshot}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                              {tx.mode_name_snapshot}
                            </Badge>
                            {qtyLabel !== '-' && (
                              <span className="text-[11px] font-mono text-slate-600">
                                {qtyLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`font-bold font-mono text-base shrink-0 ${
                          isIncome ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isIncome ? '+' : '-'} <Money value={tx.amount} />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                      <span className="truncate pr-2">{tx.note || 'No note'}</span>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {editable ? (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingTxn(tx)}
                              className="min-h-[44px] px-3 text-xs font-semibold text-slate-700 bg-slate-100 rounded-md hover:bg-slate-200 cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingTxn(tx)}
                              className="min-h-[44px] px-3 text-xs font-semibold text-red-600 bg-red-50 rounded-md hover:bg-red-100 cursor-pointer"
                            >
                              Delete
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Lock className="h-2.5 w-2.5" /> Locked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editingTxn && (
        <EditTransactionModal
          transaction={editingTxn}
          paymentModes={paymentModes}
          isOpen={!!editingTxn}
          onClose={() => setEditingTxn(null)}
          onEditedWithUndo={handleEditedWithUndo}
        />
      )}

      {/* Plain Language Delete Confirmation Dialog */}
      <Dialog open={!!deletingTxn} onOpenChange={(open) => !open && setDeletingTxn(null)}>
        <DialogContent className="max-w-sm rounded-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span>
                Delete this{' '}
                {deletingTxn ? formatMoney(deletingTxn.amount) : ''}{' '}
                {deletingTxn?.item_name_snapshot || ''} entry?
              </span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {deletingTxn?.note ? `Note: "${deletingTxn.note}". ` : ''}
              Today&apos;s totals and closing balance will recalculate automatically. You can still Undo right after deleting.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setDeletingTxn(null)}
              disabled={isDeleting}
              className="min-h-[44px]"
            >
              Keep Entry
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={isDeleting}
              className="min-h-[44px] bg-red-600 hover:bg-red-700 font-semibold text-white"
            >
              {isDeleting ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" /> Deleting...
                </span>
              ) : (
                'Yes, Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

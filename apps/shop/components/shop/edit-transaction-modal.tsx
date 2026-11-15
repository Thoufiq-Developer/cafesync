'use client';

import React, { useState, useTransition, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { updateDailyTransactionAction } from '@/app/shop/actions';
import { ITEM_UNITS, ItemUnit, normalizeItemUnit } from '@/lib/constants/units';
import { formatMoney, formatRatePerUnit } from '@/lib/calculations/format';
import { toast } from 'sonner';
import { Edit2, Loader2, AlertCircle } from 'lucide-react';

export interface PreviousTxnSnapshot {
  id: string;
  item_name_snapshot: string;
  amount: number;
  note: string;
  mode_id: string | null;
  quantity: number | null;
  unit_snapshot: string | null;
}

interface EditTransactionModalProps {
  transaction: {
    id: string;
    item_name_snapshot: string;
    mode_id?: string | null;
    mode_name_snapshot: string;
    amount: number;
    quantity?: number | null;
    unit_snapshot?: string | null;
    rate?: number | null;
    note?: string | null;
    txn_date: string;
    kind: string;
  } | null;
  paymentModes: Array<{ id: string; name: string }>;
  isOpen: boolean;
  onClose: () => void;
  onEditedWithUndo?: (previous: PreviousTxnSnapshot) => void;
}

export function EditTransactionModal({
  transaction,
  paymentModes,
  isOpen,
  onClose,
  onEditedWithUndo,
}: EditTransactionModalProps) {
  const [amount, setAmount] = useState<string>(transaction ? String(transaction.amount) : '');
  const [quantity, setQuantity] = useState<string>(
    transaction?.quantity !== null && transaction?.quantity !== undefined
      ? String(transaction.quantity)
      : ''
  );
  const [unit, setUnit] = useState<ItemUnit>(normalizeItemUnit(transaction?.unit_snapshot));
  const [note, setNote] = useState<string>(transaction?.note || '');
  const [modeId, setModeId] = useState<string>(transaction?.mode_id || '');
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (transaction) {
      setAmount(String(transaction.amount));
      setQuantity(
        transaction.quantity !== null && transaction.quantity !== undefined
          ? String(transaction.quantity)
          : ''
      );
      setUnit(normalizeItemUnit(transaction.unit_snapshot));
      setNote(transaction.note || '');
      setModeId(transaction.mode_id || '');
    }
  }, [transaction]);

  if (!transaction) return null;

  const parsedAmount = parseFloat(amount);
  const parsedQty = parseFloat(quantity);
  const computedRate =
    !Number.isNaN(parsedAmount) &&
    parsedAmount > 0 &&
    !Number.isNaN(parsedQty) &&
    parsedQty > 0
      ? Math.round((parsedAmount / parsedQty) * 100) / 100
      : null;

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (Number.isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Amount must be greater than ₹0.');
      return;
    }

    if (quantity.trim() !== '' && (Number.isNaN(parsedQty) || parsedQty <= 0)) {
      toast.error('Quantity must be greater than 0, or leave blank.');
      return;
    }

    const previousSnapshot: PreviousTxnSnapshot = {
      id: transaction.id,
      item_name_snapshot: transaction.item_name_snapshot,
      amount: Number(transaction.amount),
      note: transaction.note || '',
      mode_id: transaction.mode_id ?? null,
      quantity:
        transaction.quantity !== null && transaction.quantity !== undefined
          ? Number(transaction.quantity)
          : null,
      unit_snapshot: transaction.unit_snapshot ?? null,
    };

    const formData = new FormData();
    formData.append('transaction_id', transaction.id);
    formData.append('amount', String(parsedAmount));
    formData.append('note', note);
    formData.append('quantity', quantity.trim() !== '' ? String(parsedQty) : '');
    if (quantity.trim() !== '') {
      formData.append('unit_snapshot', unit);
    }
    if (modeId) formData.append('mode_id', modeId);

    startTransition(async () => {
      const res = await updateDailyTransactionAction(formData);
      if (res?.error) {
        toast.error(res.error);
      } else {
        if (onEditedWithUndo) {
          onEditedWithUndo(previousSnapshot);
        } else {
          toast.success('Entry updated and closing balance recalculated!');
        }
        onClose();
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full rounded-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Edit2 className="h-4 w-4 text-[var(--brand-primary,#ea580c)]" />
            <span>Edit Entry: {transaction.item_name_snapshot}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Date: {transaction.txn_date} • {transaction.kind.toUpperCase()}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleUpdate} className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="edit-amount" className="text-xs font-semibold text-slate-700">
              Total Amount (₹) *
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-sm font-bold text-slate-400">₹</span>
              <Input
                id="edit-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={isPending}
                className="pl-8 text-base font-bold text-slate-900 min-h-[44px]"
              />
            </div>
            {!Number.isNaN(parsedAmount) && parsedAmount > 0 && (
              <p className="text-[11px] font-mono text-slate-500">{formatMoney(parsedAmount)}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-qty" className="text-xs font-semibold text-slate-700">
              Quantity &amp; Unit (Optional)
            </Label>
            <div className="flex gap-2">
              <Input
                id="edit-qty"
                type="number"
                inputMode="decimal"
                step="0.001"
                min="0.001"
                placeholder="Leave blank if none"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isPending}
                className="flex-1 min-h-[44px] text-sm font-mono"
              />
              <select
                aria-label="Unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value as ItemUnit)}
                disabled={isPending}
                className="w-28 min-h-[44px] px-2.5 text-xs font-semibold border border-slate-200 rounded-md bg-white"
              >
                {ITEM_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            {computedRate !== null && (
              <p className="text-[11px] font-semibold text-emerald-700 font-mono">
                Unit price: {formatRatePerUnit(computedRate, unit)}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-slate-700">Payment Mode</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {paymentModes.map((m) => {
                const isSelected =
                  modeId === m.id || (!modeId && transaction.mode_name_snapshot === m.name);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setModeId(m.id)}
                    className={`min-h-[44px] py-1.5 px-2 text-xs font-semibold rounded-md border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'border-[var(--brand-primary,#ea580c)] bg-orange-50 text-[var(--brand-primary,#ea580c)] shadow-2xs font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-note" className="text-xs font-semibold text-slate-700">
              Note / Reference
            </Label>
            <Input
              id="edit-note"
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={isPending}
              placeholder="e.g. Bill #104, Supplier invoice, etc."
              className="min-h-[44px] text-sm"
            />
          </div>

          <div className="p-2.5 rounded-lg bg-slate-50 text-[11px] text-slate-500 border border-slate-100 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
            <span>Changes immediately recalculate the closing balance. You can also Undo right after saving.</span>
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isPending}
              className="w-full sm:w-auto min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto min-h-[44px] bg-[var(--brand-primary,#ea580c)] hover:opacity-90 font-semibold text-white"
            >
              {isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

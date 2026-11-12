'use client';

import React, { useState, useTransition, useRef, useEffect, useMemo } from 'react';
import { addDailyTransactionAction, saveShopItemAction } from '@/app/shop/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  PlusCircle,
  MinusCircle,
  Loader2,
  Search,
  Check,
  Sparkles,
  Plus,
  AlertTriangle,
  Globe,
  Store,
} from 'lucide-react';
import { ItemKind } from '@/lib/supabase/types';
import { ITEM_UNITS, ITEM_UNIT_LABELS, ItemUnit, normalizeItemUnit } from '@/lib/constants/units';
import { formatMoney, formatRatePerUnit } from '@/lib/calculations/format';

export interface ItemOption {
  id: string;
  name: string;
  kind: string;
  category: string;
  unit?: string | null;
  default_rate?: number | null;
  shop_id?: string | null;
}

interface PaymentModeOption {
  id: string;
  name: string;
}

interface DailyEntryFormProps {
  selectedDate: string;
  shopId?: string;
  activeItems: ItemOption[];
  paymentModes: PaymentModeOption[];
  isMonthClosed?: boolean;
}

export function DailyEntryForm({
  selectedDate,
  shopId,
  activeItems,
  paymentModes,
  isMonthClosed = false,
}: DailyEntryFormProps) {
  const [itemsList, setItemsList] = useState<ItemOption[]>(activeItems);
  const [kind, setKind] = useState<ItemKind>('expense');
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [selectedModeId, setSelectedModeId] = useState<string>(
    paymentModes.find((m) => m.name === 'CASH')?.id || paymentModes[0]?.id || ''
  );
  const [amount, setAmount] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<ItemUnit>('pcs');
  const [note, setNote] = useState<string>('');
  const [itemSearch, setItemSearch] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Quick Add Item Inline Dialog state
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickKind, setQuickKind] = useState<ItemKind>('expense');
  const [quickUnit, setQuickUnit] = useState<ItemUnit>('pcs');
  const [quickCategory, setQuickCategory] = useState('Kitchen');
  const [quickRate, setQuickRate] = useState('');
  const [isSavingQuick, setIsSavingQuick] = useState(false);

  const [isPending, startTransition] = useTransition();

  const amountInputRef = useRef<HTMLInputElement>(null);
  const quantityInputRef = useRef<HTMLInputElement>(null);
  const prefsKey = `cafeledger_entry_prefs_${shopId || 'default'}`;

  useEffect(() => {
    setItemsList(activeItems);
  }, [activeItems]);

  // Restore last used payment mode & item once on client mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(prefsKey);
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (prefs.lastModeId && paymentModes.some((m) => m.id === prefs.lastModeId)) {
        setSelectedModeId(prefs.lastModeId);
      }
      const preferredKind: ItemKind =
        prefs.lastKind === 'income' ? 'income' : 'expense';
      setKind(preferredKind);
      const preferredItemId =
        preferredKind === 'income' ? prefs.lastIncomeItemId : prefs.lastExpenseItemId;
      if (
        preferredItemId &&
        activeItems.some((i) => i.id === preferredItemId && i.kind === preferredKind)
      ) {
        setSelectedItemId(preferredItemId);
      }
    } catch {
      // Ignore storage failures safely
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefsKey]);

  const savePrefs = (patch: Record<string, string>) => {
    try {
      const raw = localStorage.getItem(prefsKey);
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(prefsKey, JSON.stringify({ ...prev, ...patch }));
    } catch {
      // Ignore storage failures
    }
  };

  // Filter items by current kind (income or expense) and search query
  const filteredItems = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    return itemsList.filter(
      (item) =>
        item.kind === kind &&
        (q === '' ||
          item.name.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q))
    );
  }, [itemsList, kind, itemSearch]);

  const selectedItem = itemsList.find((i) => i.id === selectedItemId);

  // Sync valid item selection for current kind
  useEffect(() => {
    const validItems = itemsList.filter((i) => i.kind === kind);
    if (validItems.length > 0 && (!selectedItem || selectedItem.kind !== kind)) {
      setSelectedItemId(validItems[0].id);
    }
  }, [kind, itemsList, selectedItem]);

  // Prefill Unit whenever the chosen item changes
  useEffect(() => {
    if (selectedItem) {
      setUnit(normalizeItemUnit(selectedItem.unit));
    }
  }, [selectedItem?.id, selectedItem?.unit]);

  const handleSelectItem = (item: ItemOption) => {
    setSelectedItemId(item.id);
    setUnit(normalizeItemUnit(item.unit));
    setIsSearchOpen(false);
    setItemSearch('');
    savePrefs(
      kind === 'income'
        ? { lastIncomeItemId: item.id, lastKind: kind }
        : { lastExpenseItemId: item.id, lastKind: kind }
    );
    setTimeout(() => amountInputRef.current?.focus(), 40);
  };

  const handleKindSwitch = (newKind: ItemKind) => {
    setKind(newKind);
    setItemSearch('');
    savePrefs({ lastKind: newKind });
    let picked: ItemOption | undefined;
    try {
      const raw = localStorage.getItem(prefsKey);
      const prefs = raw ? JSON.parse(raw) : {};
      const rememberedId =
        newKind === 'income' ? prefs.lastIncomeItemId : prefs.lastExpenseItemId;
      if (rememberedId) {
        picked = itemsList.find((i) => i.id === rememberedId && i.kind === newKind);
      }
    } catch {
      // ignore
    }
    if (!picked) {
      picked = itemsList.find((i) => i.kind === newKind);
    }
    if (picked) {
      setSelectedItemId(picked.id);
      setUnit(normalizeItemUnit(picked.unit));
    }
  };

  const handleModeSelect = (modeId: string) => {
    setSelectedModeId(modeId);
    savePrefs({ lastModeId: modeId });
  };

  // Duplicate check for inline Quick Add Item modal
  const quickDuplicateCheck = useMemo(() => {
    const clean = quickName.trim().toLowerCase().replace(/\s+/g, ' ');
    if (clean.length < 2) return { exact: null as ItemOption | null, similar: [] as ItemOption[] };
    const compact = clean.replace(/[^a-z0-9]/g, '');
    let exact: ItemOption | null = null;
    const similar: ItemOption[] = [];
    for (const item of itemsList) {
      const itemLower = item.name.trim().toLowerCase().replace(/\s+/g, ' ');
      const itemCompact = itemLower.replace(/[^a-z0-9]/g, '');
      if (itemLower === clean || (compact.length >= 3 && itemCompact === compact)) {
        exact = item;
      } else if (clean.length >= 3 && (itemLower.includes(clean) || clean.includes(itemLower))) {
        similar.push(item);
      }
    }
    return { exact, similar: similar.slice(0, 3) };
  }, [quickName, itemsList]);

  const openQuickAdd = () => {
    setIsSearchOpen(false);
    setQuickName(itemSearch.trim());
    setQuickKind(kind);
    setQuickUnit(kind === 'income' ? 'pcs' : 'kg');
    setQuickCategory(kind === 'income' ? 'Sales' : 'Kitchen');
    setQuickRate('');
    setQuickAddOpen(true);
  };

  const handleQuickAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quickName.trim().length < 2) {
      toast.error('Please enter an item name (at least 2 characters).');
      return;
    }
    if (quickDuplicateCheck.exact) {
      toast.error(`"${quickDuplicateCheck.exact.name}" already exists!`);
      return;
    }

    const parsedRate = quickRate.trim() !== '' ? parseFloat(quickRate) : null;
    setIsSavingQuick(true);
    try {
      const res = await saveShopItemAction({
        name: quickName.trim(),
        kind: quickKind,
        category: quickCategory.trim() || (quickKind === 'income' ? 'Sales' : 'Kitchen'),
        unit: quickUnit,
        defaultRate: parsedRate,
      });

      if (res.success && res.item) {
        const created: ItemOption = {
          id: res.item.id,
          name: res.item.name,
          kind: res.item.kind,
          category: res.item.category,
          unit: res.item.unit,
          default_rate: res.item.default_rate,
          shop_id: res.item.shop_id ?? shopId ?? null,
        };
        setItemsList((prev) => [created, ...prev]);
        setKind(created.kind === 'income' ? 'income' : 'expense');
        setSelectedItemId(created.id);
        setUnit(normalizeItemUnit(created.unit));
        setItemSearch('');
        savePrefs(
          created.kind === 'income'
            ? { lastIncomeItemId: created.id, lastKind: 'income' }
            : { lastExpenseItemId: created.id, lastKind: 'expense' }
        );
        setQuickAddOpen(false);
        toast.success(res.message || `Added "${created.name}" (${created.unit})`);
        setTimeout(() => amountInputRef.current?.focus(), 60);
      } else {
        toast.error(res.error || 'Could not add item');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Failed to add item');
    } finally {
      setIsSavingQuick(false);
    }
  };

  const parsedAmountNum = parseFloat(amount);
  const parsedQtyNum = parseFloat(quantity);
  const computedUnitRate =
    !Number.isNaN(parsedAmountNum) &&
    parsedAmountNum > 0 &&
    !Number.isNaN(parsedQtyNum) &&
    parsedQtyNum > 0
      ? Math.round((parsedAmountNum / parsedQtyNum) * 100) / 100
      : null;

  const executeSubmit = (submitKind: ItemKind) => {
    if (isMonthClosed) {
      toast.error('This month is locked by your Brand Admin.');
      return;
    }

    if (Number.isNaN(parsedAmountNum) || parsedAmountNum <= 0) {
      toast.error('Please enter a valid amount greater than ₹0.');
      amountInputRef.current?.focus();
      return;
    }

    if (quantity.trim() !== '' && (Number.isNaN(parsedQtyNum) || parsedQtyNum <= 0)) {
      toast.error('Quantity must be greater than 0, or leave blank.');
      quantityInputRef.current?.focus();
      return;
    }

    if (!selectedItemId) {
      toast.error('Please pick an item first.');
      return;
    }

    const formData = new FormData();
    formData.append('kind', submitKind);
    formData.append('amount', String(parsedAmountNum));
    formData.append('item_id', selectedItemId);
    formData.append('mode_id', selectedModeId);
    formData.append('note', note);
    formData.append('txn_type', 'normal');
    formData.append('txn_date', selectedDate);
    if (quantity.trim() !== '') {
      formData.append('quantity', String(parsedQtyNum));
      formData.append('unit_snapshot', unit);
    }

    startTransition(async () => {
      const res = await addDailyTransactionAction(formData);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message || 'Entry saved!');
        savePrefs({
          lastModeId: selectedModeId,
          lastKind: submitKind,
          ...(submitKind === 'income'
            ? { lastIncomeItemId: selectedItemId }
            : { lastExpenseItemId: selectedItemId }),
        });
        setAmount('');
        setQuantity('');
        setNote('');
        setTimeout(() => amountInputRef.current?.focus(), 50);
      }
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      executeSubmit(kind);
    }
  };

  return (
    <div
      id="daily-entry-form"
      className="rounded-lg border border-slate-200 bg-white p-4 sm:p-6 shadow-xs space-y-4 scroll-mt-24"
    >
      {/* Header with Income / Expense Toggle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Add Daily Entry</span>
            <Badge variant="outline" className="text-[10px] font-normal text-slate-500">
              Press Enter to save quickly
            </Badge>
          </h2>
          <p className="text-xs text-slate-500">
            Pick an item, enter total amount (and optional quantity), then save.
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-100/70 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => handleKindSwitch('income')}
            className={`min-h-[38px] px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              kind === 'income'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Income (Sale)
          </button>
          <button
            type="button"
            onClick={() => handleKindSwitch('expense')}
            className={`min-h-[38px] px-4 py-1.5 text-xs font-bold rounded-md transition-all cursor-pointer ${
              kind === 'expense'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Expense (Spend)
          </button>
        </div>
      </div>

      {/* Entry Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-start">
        {/* 1. Searchable Item Dropdown with inline "+ Add new item" */}
        <div className="md:col-span-4 relative space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Item ({kind === 'income' ? 'Income' : 'Expense'}) *</span>
            {selectedItem && (
              <span className="text-[10px] text-slate-500 font-normal flex items-center gap-1">
                {selectedItem.shop_id ? (
                  <>
                    <Store className="h-2.5 w-2.5 text-amber-600" />
                    <span>Shop item</span>
                  </>
                ) : (
                  <>
                    <Globe className="h-2.5 w-2.5 text-blue-600" />
                    <span>{selectedItem.category}</span>
                  </>
                )}
              </span>
            )}
          </Label>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="flex min-h-[44px] w-full items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-2xs cursor-pointer hover:border-slate-300 transition-colors text-left"
            >
              <span className="truncate font-medium">
                {selectedItem ? (
                  <>
                    {selectedItem.name}{' '}
                    <span className="text-xs text-slate-400 font-normal">
                      ({normalizeItemUnit(selectedItem.unit)})
                    </span>
                  </>
                ) : (
                  'Choose item...'
                )}
              </span>
              <Search className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
            </button>

            {isSearchOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsSearchOpen(false)}
                />
                <div className="absolute left-0 top-12 z-50 w-full rounded-lg border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in-0 zoom-in-95">
                  <Input
                    placeholder="Type item name to search..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    className="h-9 text-xs mb-2"
                    autoFocus
                  />
                  <div className="max-h-56 overflow-y-auto space-y-0.5">
                    {filteredItems.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => handleSelectItem(item)}
                        className={`w-full text-left flex items-center justify-between px-2.5 py-2 text-xs rounded-md cursor-pointer transition-colors ${
                          selectedItemId === item.id
                            ? 'bg-orange-50 text-[var(--brand-primary,#ea580c)] font-semibold'
                            : 'text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <span className="font-medium">{item.name}</span>
                          <span className="text-[10px] text-slate-400 ml-1.5">
                            ({item.category} • {normalizeItemUnit(item.unit)})
                          </span>
                        </div>
                        {selectedItemId === item.id && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-[var(--brand-primary,#ea580c)]" />
                        )}
                      </button>
                    ))}
                    {filteredItems.length === 0 && (
                      <div className="p-3 text-center text-xs text-slate-400">
                        No matching items found.
                      </div>
                    )}
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={openQuickAdd}
                      className="w-full min-h-[38px] px-2.5 py-1.5 rounded-md bg-orange-50 hover:bg-orange-100 text-[var(--brand-primary,#ea580c)] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>
                        + Add new item
                        {itemSearch.trim() ? ` "${itemSearch.trim()}"` : ''}
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* 2. Payment Mode Pills */}
        <div className="md:col-span-3 space-y-1.5">
          <Label className="text-xs font-semibold text-slate-700">Payment Mode</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
            {paymentModes.map((m) => {
              const isSelected = selectedModeId === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => handleModeSelect(m.id)}
                  className={`min-h-[44px] px-2 text-xs font-semibold rounded-md border text-center transition-all cursor-pointer ${
                    isSelected
                      ? 'border-[var(--brand-primary,#ea580c)] bg-orange-50 text-[var(--brand-primary,#ea580c)] font-bold shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Total Amount Paid/Received + Live Comma Preview */}
        <div className="md:col-span-2 space-y-1.5">
          <Label htmlFor="daily-amount" className="text-xs font-semibold text-slate-700">
            Total Amount (₹) *
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-3 text-sm font-bold text-slate-400">₹</span>
            <Input
              ref={amountInputRef}
              id="daily-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isPending || isMonthClosed}
              className="pl-7 font-bold text-slate-900 min-h-[44px] text-base"
            />
          </div>
          {!Number.isNaN(parsedAmountNum) && parsedAmountNum > 0 && (
            <p className="text-[11px] font-mono text-slate-500">
              {formatMoney(parsedAmountNum)}
            </p>
          )}
        </div>

        {/* 4. Optional Quantity + Prefilled Unit + Live ₹/unit rate */}
        <div className="md:col-span-3 space-y-1.5">
          <Label htmlFor="daily-qty" className="text-xs font-semibold text-slate-700 flex items-center justify-between">
            <span>Quantity &amp; Unit (Optional)</span>
            {selectedItem?.default_rate ? (
              <span className="text-[10px] font-mono text-slate-400">
                Std {formatMoney(selectedItem.default_rate)}/{normalizeItemUnit(selectedItem.unit)}
              </span>
            ) : null}
          </Label>
          <div className="flex gap-1.5">
            <Input
              ref={quantityInputRef}
              id="daily-qty"
              type="number"
              inputMode="decimal"
              step="0.001"
              min="0.001"
              placeholder="Qty (e.g. 10)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isPending || isMonthClosed}
              className="flex-1 min-h-[44px] text-sm font-mono"
            />
            <select
              aria-label="Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value as ItemUnit)}
              disabled={isPending || isMonthClosed}
              className="w-24 min-h-[44px] px-2 text-xs font-semibold border border-slate-200 rounded-md bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
            >
              {ITEM_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          {computedUnitRate !== null ? (
            <p className="text-[11px] font-semibold text-emerald-700 font-mono">
              Unit rate: {formatRatePerUnit(computedUnitRate, unit)}
            </p>
          ) : (
            <p className="text-[10px] text-slate-400">
              Leave blank if quantity doesn&apos;t apply.
            </p>
          )}
        </div>
      </div>

      {/* Note / Reference Row */}
      <div className="space-y-1.5">
        <Label htmlFor="daily-note" className="text-xs font-semibold text-slate-700">
          Note / Supplier / Reference (Optional)
        </Label>
        <Input
          id="daily-note"
          type="text"
          placeholder="e.g. Nandini morning delivery, Bill #12, Table 4"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isPending || isMonthClosed}
          className="min-h-[44px] text-sm"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
        <div className="text-xs text-slate-500 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          <span>Remembers your last payment mode &amp; item automatically.</span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            onClick={() => executeSubmit('income')}
            disabled={isPending || isMonthClosed}
            className="flex-1 sm:flex-none min-h-[44px] px-5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs active:scale-[0.98] transition-all"
          >
            {isPending && kind === 'income' ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <PlusCircle className="h-4 w-4" /> Save Income
              </span>
            )}
          </Button>

          <Button
            type="button"
            onClick={() => executeSubmit('expense')}
            disabled={isPending || isMonthClosed}
            className="flex-1 sm:flex-none min-h-[44px] px-5 font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs active:scale-[0.98] transition-all"
          >
            {isPending && kind === 'expense' ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" /> Saving...
              </span>
            ) : (
              <span className="flex items-center gap-1.5">
                <MinusCircle className="h-4 w-4" /> Save Expense
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Inline Quick Add Item Dialog (never leaves Daily Entry screen) */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent className="sm:max-w-md rounded-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Plus className="h-4 w-4 text-[var(--brand-primary,#ea580c)]" />
              <span>Add New Shop Item</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Creates a new item for your shop and selects it immediately for this entry.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleQuickAddSubmit} className="space-y-3.5 py-1">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setQuickKind('income');
                  setQuickCategory('Sales');
                }}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-bold rounded-lg border ${
                  quickKind === 'income'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                Income
              </button>
              <button
                type="button"
                onClick={() => {
                  setQuickKind('expense');
                  setQuickCategory('Kitchen');
                }}
                className={`min-h-[40px] px-3 py-1.5 text-xs font-bold rounded-lg border ${
                  quickKind === 'expense'
                    ? 'border-rose-600 bg-rose-50 text-rose-800'
                    : 'border-slate-200 bg-white text-slate-600'
                }`}
              >
                Expense
              </button>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">Item Name *</Label>
              <Input
                required
                autoFocus
                placeholder="e.g. Milk, Filter Coffee, Oats"
                value={quickName}
                onChange={(e) => setQuickName(e.target.value)}
                className="min-h-[44px] text-sm"
              />
              {quickDuplicateCheck.exact && (
                <div className="rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-700 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  <span>
                    &quot;{quickDuplicateCheck.exact.name}&quot; already exists. Pick it instead.
                  </span>
                </div>
              )}
              {!quickDuplicateCheck.exact && quickDuplicateCheck.similar.length > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
                  Did you mean:{' '}
                  {quickDuplicateCheck.similar.map((m, idx) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => {
                        setQuickAddOpen(false);
                        setKind(m.kind === 'income' ? 'income' : 'expense');
                        handleSelectItem(m);
                      }}
                      className="underline font-bold mr-2 cursor-pointer"
                    >
                      {idx > 0 ? ', ' : ''}
                      {m.name} ({normalizeItemUnit(m.unit)})
                    </button>
                  ))}
                  ?
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Unit *</Label>
                <select
                  value={quickUnit}
                  onChange={(e) => setQuickUnit(e.target.value as ItemUnit)}
                  className="w-full min-h-[44px] px-2.5 text-sm border border-slate-200 rounded-md bg-white"
                >
                  {ITEM_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {ITEM_UNIT_LABELS[u]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-700">Category</Label>
                <Input
                  placeholder="Dairy, Kitchen, Sales"
                  value={quickCategory}
                  onChange={(e) => setQuickCategory(e.target.value)}
                  className="min-h-[44px] text-sm"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-slate-700">
                Typical Price per {quickUnit} (Optional, ₹)
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                placeholder="Optional (e.g. 60)"
                value={quickRate}
                onChange={(e) => setQuickRate(e.target.value)}
                className="min-h-[44px] text-sm"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setQuickAddOpen(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSavingQuick || Boolean(quickDuplicateCheck.exact)}
                className="min-h-[44px] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90 font-semibold"
              >
                {isSavingQuick ? 'Adding...' : 'Add & Select'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

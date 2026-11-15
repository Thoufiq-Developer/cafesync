'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Tag,
  Plus,
  Edit,
  Power,
  Search,
  Globe,
  Store,
  TrendingUp,
  TrendingDown,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Count, Money } from '@/components/shared/format-values';
import { formatCount } from '@/lib/calculations/format';
import { ITEM_UNITS, ITEM_UNIT_LABELS, ItemUnit, normalizeItemUnit } from '@/lib/constants/units';
import {
  saveItemAction,
  toggleItemStatusAction,
  promoteItemBrandWideAction,
} from '@/app/admin/actions';
import {
  saveShopItemAction,
  toggleShopItemStatusAction,
} from '@/app/shop/actions';

export interface CatalogItemRecord {
  id: string;
  name: string;
  kind: 'income' | 'expense';
  category: string;
  unit?: string | null;
  default_rate?: number | null;
  shop_id?: string | null;
  shop_name?: string | null;
  shop_code?: string | null;
  is_active: boolean;
  usage_count: number;
}

interface ItemsManagerProps {
  role: 'admin' | 'manager';
  shopId?: string | null;
  shopName?: string | null;
  initialItems: CatalogItemRecord[];
  /** Controlled externally when rendered as sub-tabs inside Admin ItemsPaymentModesManager */
  forcedKindTab?: 'income' | 'expense';
  forcedSearchTerm?: string;
  hideHeader?: boolean;
  externalCreateSignal?: number;
  onItemsChanged?: (next: CatalogItemRecord[]) => void;
}

function findDuplicateAndSimilar(
  candidate: string,
  allItems: CatalogItemRecord[],
  excludeId?: string
): { exactMatch: CatalogItemRecord | null; similarMatches: CatalogItemRecord[] } {
  const clean = candidate.trim().toLowerCase().replace(/\s+/g, ' ');
  if (clean.length < 2) return { exactMatch: null, similarMatches: [] };

  let exactMatch: CatalogItemRecord | null = null;
  const similarMatches: CatalogItemRecord[] = [];
  const compactCandidate = clean.replace(/[^a-z0-9]/g, '');

  for (const item of allItems) {
    if (excludeId && item.id === excludeId) continue;
    const itemLower = item.name.trim().toLowerCase().replace(/\s+/g, ' ');
    const compactItem = itemLower.replace(/[^a-z0-9]/g, '');

    if (itemLower === clean || (compactCandidate.length >= 3 && compactItem === compactCandidate)) {
      exactMatch = item;
    } else if (
      clean.length >= 3 &&
      (itemLower.includes(clean) || clean.includes(itemLower))
    ) {
      similarMatches.push(item);
    }
  }

  return { exactMatch, similarMatches: similarMatches.slice(0, 3) };
}

export function ItemsManager({
  role,
  shopId = null,
  shopName = 'This Shop',
  initialItems,
  forcedKindTab,
  forcedSearchTerm,
  hideHeader = false,
  externalCreateSignal,
  onItemsChanged,
}: ItemsManagerProps) {
  const router = useRouter();
  const [items, setItems] = useState<CatalogItemRecord[]>(initialItems);
  const [kindTab, setKindTab] = useState<'income' | 'expense'>(forcedKindTab || 'expense');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'brand' | 'shop'>('all');
  const [searchTerm, setSearchTerm] = useState(forcedSearchTerm || '');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItemRecord | null>(null);
  const [formName, setFormName] = useState('');
  const [formKind, setFormKind] = useState<'income' | 'expense'>('expense');
  const [formCategory, setFormCategory] = useState('Kitchen');
  const [formUnit, setFormUnit] = useState<ItemUnit>('pcs');
  const [formDefaultRate, setFormDefaultRate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    if (forcedKindTab) setKindTab(forcedKindTab);
  }, [forcedKindTab]);

  useEffect(() => {
    if (forcedSearchTerm !== undefined) setSearchTerm(forcedSearchTerm);
  }, [forcedSearchTerm]);

  useEffect(() => {
    if (externalCreateSignal && externalCreateSignal > 0) {
      openAddModal(forcedKindTab || kindTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalCreateSignal]);

  const updateItemsState = (updater: (prev: CatalogItemRecord[]) => CatalogItemRecord[]) => {
    setItems((prev) => {
      const next = updater(prev);
      onItemsChanged?.(next);
      return next;
    });
  };

  const openAddModal = (kind: 'income' | 'expense') => {
    setEditingItem(null);
    setFormName('');
    setFormKind(kind);
    setFormCategory(kind === 'income' ? 'Sales' : 'Kitchen');
    setFormUnit(kind === 'income' ? 'pcs' : 'kg');
    setFormDefaultRate('');
    setModalOpen(true);
  };

  const openEditModal = (item: CatalogItemRecord) => {
    if (role === 'manager' && (!item.shop_id || item.shop_id !== shopId)) {
      toast.error('Brand-wide items can only be edited by your Brand Admin.');
      return;
    }
    setEditingItem(item);
    setFormName(item.name);
    setFormKind(item.kind);
    setFormCategory(item.category || 'General');
    setFormUnit(normalizeItemUnit(item.unit));
    setFormDefaultRate(item.default_rate ? String(item.default_rate) : '');
    setModalOpen(true);
  };

  const { exactMatch, similarMatches } = useMemo(
    () => findDuplicateAndSimilar(formName, items, editingItem?.id),
    [formName, items, editingItem?.id]
  );

  const filteredItems = items.filter((item) => {
    if (item.kind !== kindTab) return false;
    if (scopeFilter === 'brand' && item.shop_id) return false;
    if (scopeFilter === 'shop' && !item.shop_id) return false;
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.unit || '').toLowerCase().includes(q) ||
      (item.shop_name || '').toLowerCase().includes(q)
    );
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error('Item name is required');
      return;
    }
    if (exactMatch) {
      toast.error(`"${exactMatch.name}" already exists. Use a different name.`);
      return;
    }

    const parsedRate =
      formDefaultRate.trim() !== '' ? parseFloat(formDefaultRate) : null;

    setIsSaving(true);
    try {
      if (role === 'admin') {
        const res = await saveItemAction({
          id: editingItem?.id,
          name: formName.trim(),
          kind: formKind,
          category: formCategory.trim() || 'General',
          unit: formUnit,
          defaultRate: parsedRate,
        });
        if (res.success) {
          toast.success(
            editingItem ? `Updated "${formName.trim()}"` : `Added "${formName.trim()}"`
          );
          const returned = res.data;
          if (editingItem) {
            updateItemsState((prev) =>
              prev.map((i) =>
                i.id === editingItem.id
                  ? {
                      ...i,
                      name: formName.trim(),
                      category: formCategory.trim() || 'General',
                      unit: formUnit,
                      default_rate: parsedRate,
                    }
                  : i
              )
            );
          } else {
            updateItemsState((prev) => [
              {
                id: returned?.id || `item-${Date.now()}`,
                name: returned?.name || formName.trim(),
                kind: formKind,
                category: returned?.category || formCategory.trim() || 'General',
                unit: returned?.unit || formUnit,
                default_rate: returned?.default_rate ?? parsedRate,
                shop_id: returned?.shop_id ?? null,
                is_active: true,
                usage_count: 0,
              },
              ...prev,
            ]);
          }
          setModalOpen(false);
          router.refresh();
        } else {
          toast.error(res.error || 'Could not save item');
        }
      } else {
        const res = await saveShopItemAction({
          id: editingItem?.id,
          name: formName.trim(),
          kind: formKind,
          category: formCategory.trim() || 'General',
          unit: formUnit,
          defaultRate: parsedRate,
        });
        if (res.success && res.item) {
          toast.success(
            editingItem ? `Updated "${formName.trim()}"` : `Added "${formName.trim()}" for your shop`
          );
          if (editingItem) {
            updateItemsState((prev) =>
              prev.map((i) =>
                i.id === editingItem.id
                  ? {
                      ...i,
                      name: res.item.name,
                      category: res.item.category,
                      unit: res.item.unit,
                      default_rate: res.item.default_rate,
                    }
                  : i
              )
            );
          } else {
            updateItemsState((prev) => [
              {
                id: res.item.id,
                name: res.item.name,
                kind: res.item.kind,
                category: res.item.category,
                unit: res.item.unit,
                default_rate: res.item.default_rate,
                shop_id: shopId,
                shop_name: shopName || 'This Shop',
                is_active: true,
                usage_count: 0,
              },
              ...prev,
            ]);
          }
          setModalOpen(false);
          router.refresh();
        } else {
          toast.error(res.error || 'Could not save item');
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (item: CatalogItemRecord) => {
    const nextActive = !item.is_active;
    if (role === 'manager' && (!item.shop_id || item.shop_id !== shopId)) {
      toast.error('Brand-wide items are read-only for shop managers.');
      return;
    }
    try {
      const res =
        role === 'admin'
          ? await toggleItemStatusAction(item.id, nextActive)
          : await toggleShopItemStatusAction(item.id, nextActive);
      if (res.success) {
        toast.success(
          `"${item.name}" ${nextActive ? 'activated' : 'deactivated'} (past entries untouched)`
        );
        updateItemsState((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, is_active: nextActive } : i))
        );
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update status');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error updating status');
    }
  };

  const handlePromoteBrandWide = async (item: CatalogItemRecord) => {
    if (role !== 'admin') return;
    if (
      !confirm(
        `Make "${item.name}" available to all shops across the brand?`
      )
    ) {
      return;
    }
    try {
      const res = await promoteItemBrandWideAction(item.id);
      if (res.success) {
        toast.success(`"${item.name}" is now available to all shops`);
        updateItemsState((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, shop_id: null, shop_name: null, shop_code: null }
              : i
          )
        );
        router.refresh();
      } else {
        toast.error(res.error || 'Could not promote item');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Action failed');
    }
  };

  return (
    <div className="space-y-4">
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <Tag className="h-6 w-6 text-[var(--brand-primary,#ea580c)]" />
              <span>Items Catalog</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {role === 'admin'
                ? 'Manage brand-wide items and review shop-specific items added by managers.'
                : `Brand-wide items are available automatically; add and edit items for ${shopName || 'your shop'}.`}
            </p>
          </div>

          <Button
            onClick={() => openAddModal(kindTab)}
            className="min-h-[44px] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90 flex items-center gap-2 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            <span>Add {kindTab === 'income' ? 'Income' : 'Expense'} Item</span>
          </Button>
        </div>
      )}

      {/* Kind & Scope Filters (shown standalone, or scope filter when embedded) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {!forcedKindTab && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setKindTab('income')}
                className={`flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  kindTab === 'income'
                    ? 'bg-white text-emerald-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                <span>
                  Income ({formatCount(items.filter((i) => i.kind === 'income').length)})
                </span>
              </button>
              <button
                type="button"
                onClick={() => setKindTab('expense')}
                className={`flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  kindTab === 'expense'
                    ? 'bg-white text-rose-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
                <span>
                  Expense ({formatCount(items.filter((i) => i.kind === 'expense').length)})
                </span>
              </button>
            </div>
          )}

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200">
            {(
              [
                { id: 'all', label: 'All Items' },
                { id: 'brand', label: 'All Shops (Brand)' },
                { id: 'shop', label: role === 'manager' ? 'My Shop Only' : 'Shop-Specific' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setScopeFilter(opt.id)}
                className={`min-h-[32px] px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
                  scopeFilter === opt.id
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {forcedSearchTerm === undefined && (
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search item, category, or unit..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full min-h-[38px] pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)] bg-white"
            />
          </div>
        )}
      </div>

      {/* Items Table */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Item &amp; Scope</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3">Unit</th>
                <th className="py-3 px-3 text-right">Default Rate</th>
                <th className="py-3 px-3 text-center">Usage</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-slate-400">
                    No {kindTab} items match this filter. Click &quot;Add Item&quot; to create one.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isShopItem = Boolean(item.shop_id);
                  const canEditItem =
                    role === 'admin' || (role === 'manager' && item.shop_id === shopId);

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="mt-0.5">
                          {isShopItem ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-amber-50 border border-amber-200 text-amber-800">
                              <Store className="h-2.5 w-2.5" />
                              <span>
                                {item.shop_name || (role === 'manager' ? shopName : 'Shop Only')}
                              </span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.2 rounded bg-blue-50 border border-blue-200 text-blue-800">
                              <Globe className="h-2.5 w-2.5" />
                              <span>All Shops</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono font-semibold text-slate-700">
                        {item.unit || 'pcs'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-slate-700">
                        {item.default_rate && item.default_rate > 0 ? (
                          <Money value={item.default_rate} />
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-medium text-slate-600">
                        <Count value={item.usage_count} /> entries
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.is_active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {item.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {canEditItem ? (
                          <div className="flex items-center justify-end gap-1.5">
                            {role === 'admin' && isShopItem && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handlePromoteBrandWide(item)}
                                className="h-7 px-2 text-[11px] text-blue-700 border-blue-200 hover:bg-blue-50"
                                title="Share this item with every shop in the brand"
                              >
                                <Globe className="h-3 w-3 mr-1" />
                                <span>Make available to all shops</span>
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(item)}
                              className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                              title="Edit item"
                            >
                              <Edit className="h-3 w-3 mr-1" />
                              <span>Edit</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(item)}
                              className={`h-7 px-2 text-xs ${
                                item.is_active
                                  ? 'text-amber-600 hover:text-amber-700'
                                  : 'text-emerald-600 hover:text-emerald-700'
                              }`}
                              title="Activate or deactivate (never touches past entries)"
                            >
                              <Power className="h-3 w-3 mr-1" />
                              <span>{item.is_active ? 'Deactivate' : 'Activate'}</span>
                            </Button>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                            <Lock className="h-3 w-3" />
                            <span>Brand-wide (Read-only)</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Item Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Tag className="h-5 w-5 text-[var(--brand-primary,#ea580c)]" />
              <span>
                {editingItem
                  ? `Edit "${editingItem.name}"`
                  : `Add ${formKind === 'income' ? 'Income' : 'Expense'} Item`}
              </span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-1">
            {!editingItem && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setFormKind('income');
                      setFormCategory('Sales');
                    }}
                    className={`min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                      formKind === 'income'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Income
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFormKind('expense');
                      setFormCategory('Kitchen');
                    }}
                    className={`min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-lg border ${
                      formKind === 'expense'
                        ? 'border-rose-600 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Expense
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Item Name *
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Milk, Arabica Beans, Packaging Box"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />

              {exactMatch && (
                <div className="rounded-md bg-red-50 border border-red-200 p-2 text-xs text-red-700 flex items-start gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>&quot;{exactMatch.name}&quot;</strong> already exists (
                    {exactMatch.unit || 'pcs'}). Use a distinct name instead.
                  </span>
                </div>
              )}

              {!exactMatch && similarMatches.length > 0 && (
                <div className="rounded-md bg-amber-50 border border-amber-200 p-2 text-xs text-amber-900">
                  Did you mean:{' '}
                  {similarMatches.map((m, idx) => (
                    <span key={m.id}>
                      {idx > 0 ? ', ' : ''}
                      <strong>{m.name}</strong> ({m.unit || 'pcs'})
                    </span>
                  ))}
                  ?
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Category *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dairy, Sales, Utilities"
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Default Unit *
                </label>
                <select
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value as ItemUnit)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                >
                  {ITEM_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {ITEM_UNIT_LABELS[u]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Default Price per {formUnit} (Optional, ₹)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="Optional (e.g. 60)"
                value={formDefaultRate}
                onChange={(e) => setFormDefaultRate(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>

            <p className="text-[11px] text-slate-500">
              {role === 'admin'
                ? 'Brand-wide items are visible to all shops. Updating an item never alters past transactions.'
                : `This item belongs to ${shopName || 'your shop'} and will appear immediately in Daily Entry. Past transactions keep their snapshot.`}
            </p>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving || Boolean(exactMatch)}
                className="min-h-[44px] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90"
              >
                {isSaving
                  ? 'Saving...'
                  : editingItem
                    ? 'Save Changes'
                    : 'Add Item'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

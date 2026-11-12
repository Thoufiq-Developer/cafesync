'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Loader2,
  PackageOpen,
  Search,
  Store,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Count, Money } from '@/components/shared/format-values';
import { formatMoney, formatRatePerUnit } from '@/lib/calculations/format';
import { formatQuantityWithUnit } from '@/lib/constants/units';
import type {
  ItemDetailResult,
  ItemSummaryRow,
  ItemWiseKindFilter,
  ItemWiseSortField,
  ItemWiseSummaryResult,
} from '@/lib/reports/item-wise';

export interface ItemWiseFilterState {
  kind: ItemWiseKindFilter;
  category: string;
  search: string;
}

interface ItemWiseSummaryViewProps {
  shops?: Array<{ id: string; name: string; code: string }>;
  lockedShopId?: string;
  selectedShopId?: string;
  onSelectedShopChange?: (shopId: string) => void;
  startDate: string;
  endDate: string;
  kindDefault?: ItemWiseKindFilter;
  onFilterStateChange?: (filters: ItemWiseFilterState) => void;
}

function DailyMiniChart({
  series,
  unit,
}: {
  series: ItemDetailResult['dailySeries'];
  unit: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!series || series.length === 0) {
    return null;
  }

  const maxAmount = Math.max(...series.map((d) => d.amount), 1);
  const svgW = Math.max(280, series.length * 28);
  const svgH = 88;
  const padX = 8;
  const padTop = 10;
  const padBottom = 18;
  const plotH = svgH - padTop - padBottom;
  const slotW = (svgW - padX * 2) / series.length;
  const barW = Math.max(8, Math.min(20, slotW * 0.62));

  const hovered = hoveredIdx !== null ? series[hoveredIdx] : null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-700">
          Daily Spend Trend ({series.length} {series.length === 1 ? 'day' : 'days'})
        </span>
        <span className="text-[11px] font-medium text-slate-600">
          {hovered ? (
            <>
              <span className="font-semibold text-slate-900">{hovered.label}:</span>{' '}
              <span className="font-mono font-bold text-slate-900">
                {formatMoney(hovered.amount)}
              </span>
              {hovered.quantity > 0 && (
                <span className="text-slate-500">
                  {' '}
                  ({formatQuantityWithUnit(hovered.quantity, unit)})
                </span>
              )}
            </>
          ) : (
            'Tap or hover any bar to see daily figure'
          )}
        </span>
      </div>

      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${svgW} ${svgH}`}
          className="w-full min-w-[260px] h-24 select-none"
          role="img"
          aria-label="Daily item purchase trend chart"
        >
          <line
            x1={padX}
            y1={svgH - padBottom}
            x2={svgW - padX}
            y2={svgH - padBottom}
            stroke="#cbd5e1"
            strokeWidth="1"
          />
          {series.map((pt, idx) => {
            const ratio = Math.max(0.06, pt.amount / maxAmount);
            const h = Math.round(plotH * ratio);
            const x = padX + idx * slotW + (slotW - barW) / 2;
            const y = svgH - padBottom - h;
            const isHovered = hoveredIdx === idx;
            const showLabel =
              series.length <= 10 ||
              idx === 0 ||
              idx === series.length - 1 ||
              idx % Math.ceil(series.length / 6) === 0;

            return (
              <g
                key={pt.date}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                onClick={() => setHoveredIdx(idx)}
                className="cursor-pointer"
              >
                <rect
                  x={x}
                  y={y}
                  width={barW}
                  height={h}
                  rx={3}
                  fill="var(--brand-primary, #ea580c)"
                  opacity={isHovered ? 1 : 0.78}
                />
                {showLabel && (
                  <text
                    x={x + barW / 2}
                    y={svgH - 4}
                    textAnchor="middle"
                    fontSize="8.5"
                    fill="#64748b"
                  >
                    {pt.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export function ItemWiseSummaryView({
  shops,
  lockedShopId,
  selectedShopId: controlledShopId,
  onSelectedShopChange,
  startDate,
  endDate,
  kindDefault = 'expense',
  onFilterStateChange,
}: ItemWiseSummaryViewProps) {
  const [internalShopId, setInternalShopId] = useState<string>(
    lockedShopId || controlledShopId || 'all'
  );
  const activeShopId = lockedShopId || controlledShopId || internalShopId;

  const [kind, setKind] = useState<ItemWiseKindFilter>(kindDefault);
  const [category, setCategory] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<ItemWiseSortField>('total_amount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [summary, setSummary] = useState<ItemWiseSummaryResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Detail Popup State
  const [selectedRow, setSelectedRow] = useState<ItemSummaryRow | null>(null);
  const [detailData, setDetailData] = useState<
    (ItemDetailResult & { isAllShops?: boolean }) | null
  >(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [detailPage, setDetailPage] = useState<number>(1);
  const [isExportingSingle, setIsExportingSingle] = useState<null | 'excel' | 'pdf'>(
    null
  );

  // Debounce search text
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (onFilterStateChange) {
      onFilterStateChange({
        kind,
        category,
        search: debouncedSearch,
      });
    }
  }, [kind, category, debouncedSearch, onFilterStateChange]);

  // Reset category if switching kind invalidates it
  const handleKindChange = (nextKind: ItemWiseKindFilter) => {
    setKind(nextKind);
    setCategory('');
  };

  // Fetch item summary whenever filters change
  useEffect(() => {
    let cancelled = false;
    const loadSummary = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const sp = new URLSearchParams({
          action: 'summary',
          shopId: activeShopId,
          startDate,
          endDate,
          kind,
          sortBy,
          sortDir,
        });
        if (category) sp.set('category', category);
        if (debouncedSearch) sp.set('search', debouncedSearch);

        const res = await fetch(`/api/reports/item-wise?${sp.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Could not load item-wise summary');
        }
        const data: ItemWiseSummaryResult = await res.json();
        if (!cancelled) {
          setSummary(data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err?.message || 'Failed to load items report');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadSummary();
    return () => {
      cancelled = true;
    };
  }, [activeShopId, startDate, endDate, kind, category, debouncedSearch, sortBy, sortDir]);

  // Fetch paginated item detail purchases when modal is open
  useEffect(() => {
    if (!selectedRow) return;
    let cancelled = false;

    const loadDetail = async () => {
      setDetailLoading(true);
      try {
        const sp = new URLSearchParams({
          action: 'detail',
          shopId: activeShopId,
          startDate,
          endDate,
          itemKey: selectedRow.itemKey,
          unit: selectedRow.unit,
          kind: selectedRow.kind,
          page: String(detailPage),
          pageSize: '20',
        });
        const res = await fetch(`/api/reports/item-wise?${sp.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          throw new Error(payload.error || 'Failed to fetch purchase history');
        }
        const payload = await res.json();
        if (!cancelled) {
          setDetailData(payload);
        }
      } catch (err: any) {
        if (!cancelled) {
          toast.error(err?.message || 'Could not open item purchase history');
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedRow, detailPage, activeShopId, startDate, endDate]);

  const handleSort = (field: ItemWiseSortField) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'item_name' ? 'asc' : 'desc');
    }
  };

  const renderSortIcon = (field: ItemWiseSortField) => {
    if (sortBy !== field) {
      return <ArrowUpDown className="h-3 w-3 opacity-40" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3 w-3 text-[var(--brand-primary,#ea580c)]" />
    ) : (
      <ArrowDown className="h-3 w-3 text-[var(--brand-primary,#ea580c)]" />
    );
  };

  const handleOpenDetail = (row: ItemSummaryRow) => {
    setDetailPage(1);
    setDetailData(null);
    setSelectedRow(row);
  };

  const handleDownloadSingleItem = async (format: 'excel' | 'pdf') => {
    if (!selectedRow) return;
    setIsExportingSingle(format);
    const toastId = toast.loading(
      `Preparing ${selectedRow.itemName} ${format.toUpperCase()}...`
    );
    try {
      const sp = new URLSearchParams({
        action: format,
        shopId: activeShopId,
        startDate,
        endDate,
        kind: selectedRow.kind,
        singleItemKey: selectedRow.itemKey,
        singleItemUnit: selectedRow.unit,
      });
      const res = await fetch(`/api/reports/item-wise?${sp.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Failed to export item ${format}`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeName = selectedRow.itemName.replace(/\s+/g, '_');
      a.download = `${safeName}_${startDate}_${endDate}.${
        format === 'excel' ? 'xlsx' : 'pdf'
      }`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded ${selectedRow.itemName} ${format.toUpperCase()}`, {
        id: toastId,
      });
    } catch (err: any) {
      toast.error(err?.message || 'Export failed', { id: toastId });
    } finally {
      setIsExportingSingle(null);
    }
  };

  const rows = summary?.rows || [];
  const totalAmount = summary?.grandTotalAmount || 0;
  const totalPurchases = summary?.grandTotalPurchases || 0;

  const isAllShops = !lockedShopId && activeShopId === 'all';
  const showUnitLegend = useMemo(() => {
    const names = new Map<string, number>();
    rows.forEach((r) => {
      names.set(r.itemName.toLowerCase(), (names.get(r.itemName.toLowerCase()) || 0) + 1);
    });
    return Array.from(names.values()).some((c) => c > 1);
  }, [rows]);

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden space-y-0">
      {/* Header & Interactive Filters */}
      <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/70 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Filter className="h-4 w-4 text-[var(--brand-primary,#ea580c)]" />
              <span>Item-wise Summary Breakdown</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Grouped strictly by item and measurement unit so units like L and packet never mix. Click Detail to see every entry.
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs bg-white border border-slate-200 rounded-md px-3 py-1.5 self-start sm:self-auto">
            <span className="text-slate-500">Items:</span>
            <span className="font-bold text-slate-900">
              <Count value={rows.length} />
            </span>
            <span className="text-slate-300">|</span>
            <span className="text-slate-500">Total:</span>
            <span className="font-bold text-slate-900">
              <Money value={totalAmount} />
            </span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Kind Toggle */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block">
              Entry Type
            </label>
            <div className="grid grid-cols-3 gap-1 bg-white border border-slate-200 p-1 rounded-md">
              {(
                [
                  { id: 'expense', label: 'Expense' },
                  { id: 'income', label: 'Income' },
                  { id: 'both', label: 'Both' },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleKindChange(opt.id)}
                  className={`min-h-[36px] text-xs font-semibold rounded transition-colors cursor-pointer ${
                    kind === opt.id
                      ? 'bg-[var(--brand-primary,#ea580c)] text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Shop Filter (only when not locked and parent passed shops without external control, or allow changing) */}
          {!lockedShopId && shops && shops.length > 0 && (
            <div className="space-y-1">
              <label
                htmlFor="item-wise-shop-filter"
                className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block"
              >
                Shop Filter
              </label>
              <div className="relative">
                <Store className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <select
                  id="item-wise-shop-filter"
                  value={activeShopId}
                  onChange={(e) => {
                    if (onSelectedShopChange) {
                      onSelectedShopChange(e.target.value);
                    } else {
                      setInternalShopId(e.target.value);
                    }
                  }}
                  className="w-full min-h-[44px] sm:min-h-[42px] pl-8 pr-3 text-xs font-medium bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                >
                  <option value="all">All Shops Combined</option>
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Category Dropdown */}
          <div className="space-y-1">
            <label
              htmlFor="item-wise-cat-filter"
              className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block"
            >
              Category
            </label>
            <select
              id="item-wise-cat-filter"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full min-h-[44px] sm:min-h-[42px] px-3 text-xs font-medium bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
            >
              <option value="">All Categories</option>
              {(summary?.categories || []).map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="space-y-1">
            <label
              htmlFor="item-wise-search"
              className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider block"
            >
              Search Item
            </label>
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="item-wise-search"
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search item name e.g. Milk..."
                className="w-full min-h-[44px] sm:min-h-[42px] pl-8 pr-3 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>
          </div>
        </div>

        {showUnitLegend && (
          <div className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-1.5">
            Some items were bought in more than one unit (for example L vs packet). Each unit is shown on its own row for accurate average rates.
          </div>
        )}
      </div>

      {/* Table Area */}
      {isLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-11 w-full rounded-md bg-slate-100 animate-pulse"
            />
          ))}
        </div>
      ) : errorMsg ? (
        <div className="p-8 text-center text-sm text-rose-600">{errorMsg}</div>
      ) : rows.length === 0 ? (
        <div className="p-10 text-center space-y-2">
          <PackageOpen className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-800">
            No items recorded for this period
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Try changing the date range, switching Entry Type to Both, or clearing the search filter.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">
                  <button
                    type="button"
                    onClick={() => handleSort('item_name')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    <span>Item</span>
                    {renderSortIcon('item_name')}
                  </button>
                </th>
                <th className="py-3 px-3 hidden sm:table-cell">Category</th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('total_quantity')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    <span>Total Quantity</span>
                    {renderSortIcon('total_quantity')}
                  </button>
                </th>
                <th className="py-3 px-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleSort('total_amount')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    <span>Total Amount</span>
                    {renderSortIcon('total_amount')}
                  </button>
                </th>
                <th className="py-3 px-3 text-right hidden md:table-cell">
                  <button
                    type="button"
                    onClick={() => handleSort('purchase_count')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    <span>No. of Purchases</span>
                    {renderSortIcon('purchase_count')}
                  </button>
                </th>
                <th className="py-3 px-3 text-right hidden lg:table-cell">
                  <button
                    type="button"
                    onClick={() => handleSort('avg_rate')}
                    className="inline-flex items-center gap-1 hover:text-slate-900 cursor-pointer"
                  >
                    <span>Average Rate</span>
                    {renderSortIcon('avg_rate')}
                  </button>
                </th>
                <th className="py-3 px-3 text-right hidden sm:table-cell">
                  % of Total
                </th>
                <th className="py-3 px-4 text-right">Details</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
              {rows.map((row) => (
                <tr
                  key={`${row.itemKey}-${row.kind}-${row.unit || 'none'}`}
                  className="hover:bg-slate-50/80 transition-colors"
                >
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-semibold text-slate-900">
                        {row.itemName}
                      </span>
                      {row.unit && (
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {row.unit}
                        </span>
                      )}
                      {kind === 'both' && (
                        <span
                          className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                            row.kind === 'income'
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {row.kind}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 sm:hidden mt-0.5">
                      {row.category} • <Count value={row.purchaseCount} suffix="entries" />
                    </div>
                  </td>

                  <td className="py-3 px-3 text-xs text-slate-600 hidden sm:table-cell">
                    {row.category}
                  </td>

                  <td className="py-3 px-3 text-right font-mono text-xs sm:text-sm text-slate-700">
                    {row.totalQuantity !== null
                      ? formatQuantityWithUnit(row.totalQuantity, row.unit)
                      : '-'}
                  </td>

                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    <Money value={row.totalAmount} />
                  </td>

                  <td className="py-3 px-3 text-right font-mono text-slate-700 hidden md:table-cell">
                    <Count value={row.purchaseCount} />
                  </td>

                  <td className="py-3 px-3 text-right font-mono text-xs text-slate-700 hidden lg:table-cell">
                    {row.avgRate !== null
                      ? formatRatePerUnit(row.avgRate, row.unit)
                      : '-'}
                  </td>

                  <td className="py-3 px-3 text-right hidden sm:table-cell">
                    <div className="inline-flex items-center gap-2 justify-end">
                      <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, row.percentOfTotal)}%`,
                            backgroundColor: 'var(--brand-primary, #ea580c)',
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono text-slate-600 w-10 text-right">
                        {row.percentOfTotal.toFixed(1)}%
                      </span>
                    </div>
                  </td>

                  <td className="py-3 px-4 text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenDetail(row)}
                      className="min-h-[44px] sm:min-h-[34px] px-3 text-xs font-semibold gap-1.5"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>Detail</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-xs sm:text-sm text-slate-900">
                <td className="py-3 px-4">Grand Total</td>
                <td className="py-3 px-3 hidden sm:table-cell" />
                <td className="py-3 px-3 text-right text-slate-400">-</td>
                <td className="py-3 px-3 text-right font-mono">
                  <Money value={totalAmount} />
                </td>
                <td className="py-3 px-3 text-right font-mono hidden md:table-cell">
                  <Count value={totalPurchases} />
                </td>
                <td className="py-3 px-3 hidden lg:table-cell" />
                <td className="py-3 px-3 text-right font-mono hidden sm:table-cell">
                  100.0%
                </td>
                <td className="py-3 px-4" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Item Purchase Detail Popup (small radius <= 8px, full-screen on mobile) */}
      <Dialog
        open={Boolean(selectedRow)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRow(null);
            setDetailData(null);
          }
        }}
      >
        <DialogContent className="max-sm:h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:rounded-none max-sm:border-0 sm:max-w-4xl max-h-[92vh] rounded-lg sm:rounded-lg p-0 gap-0 overflow-hidden flex flex-col bg-white">
          <DialogHeader className="px-4 sm:px-6 py-4 border-b border-slate-200 bg-slate-50 pr-12 flex-none">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="text-left min-w-0">
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex flex-wrap items-center gap-2">
                  <span>{selectedRow?.itemName}</span>
                  {selectedRow?.unit && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-700">
                      {selectedRow.unit}
                    </span>
                  )}
                  <span
                    className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded ${
                      selectedRow?.kind === 'income'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {selectedRow?.kind}
                  </span>
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-1">
                  {startDate} to {endDate} •{' '}
                  {summary?.shopLabel || (isAllShops ? 'All Outlets Combined' : 'Outlet')}
                </p>
              </div>

              {/* Per-Item Download Actions */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isExportingSingle !== null}
                  onClick={() => handleDownloadSingleItem('excel')}
                  className="min-h-[40px] sm:min-h-[34px] text-xs font-semibold gap-1.5"
                >
                  {isExportingSingle === 'excel' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-700" />
                  )}
                  <span>Excel</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isExportingSingle !== null}
                  onClick={() => handleDownloadSingleItem('pdf')}
                  className="min-h-[40px] sm:min-h-[34px] text-xs font-semibold text-white gap-1.5"
                  style={{ backgroundColor: 'var(--brand-primary, #ea580c)' }}
                >
                  {isExportingSingle === 'pdf' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <FileText className="h-3.5 w-3.5" />
                  )}
                  <span>PDF</span>
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {detailLoading && !detailData ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-500 text-xs">
                <Loader2 className="h-6 w-6 animate-spin text-[var(--brand-primary,#ea580c)]" />
                <span>Loading purchase history...</span>
              </div>
            ) : (
              <>
                {/* Subtotal Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                      Total Quantity
                    </span>
                    <span className="text-sm sm:text-base font-bold font-mono text-slate-900 mt-0.5 block">
                      {detailData?.subtotal.totalQuantity !== null &&
                      detailData?.subtotal.totalQuantity !== undefined
                        ? formatQuantityWithUnit(
                            detailData.subtotal.totalQuantity,
                            detailData.subtotal.unit
                          )
                        : '-'}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                      Total Amount
                    </span>
                    <span className="text-sm sm:text-base font-bold font-mono text-slate-900 mt-0.5 block">
                      <Money value={detailData?.subtotal.totalAmount ?? selectedRow?.totalAmount ?? 0} />
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                      Average Rate
                    </span>
                    <span className="text-sm sm:text-base font-bold font-mono text-slate-900 mt-0.5 block">
                      {detailData?.subtotal.avgRate !== null &&
                      detailData?.subtotal.avgRate !== undefined
                        ? formatRatePerUnit(
                            detailData.subtotal.avgRate,
                            detailData.subtotal.unit
                          )
                        : '-'}
                    </span>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block">
                      Entries Found
                    </span>
                    <span className="text-sm sm:text-base font-bold font-mono text-slate-900 mt-0.5 block">
                      <Count value={detailData?.totalCount ?? selectedRow?.purchaseCount ?? 0} />
                    </span>
                  </div>
                </div>

                {/* Daily Mini Chart */}
                {detailData?.dailySeries && detailData.dailySeries.length > 0 && (
                  <DailyMiniChart
                    series={detailData.dailySeries}
                    unit={detailData.subtotal.unit || selectedRow?.unit || ''}
                  />
                )}

                {/* Paginated Purchase Table */}
                <div className="rounded-lg border border-slate-200 overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Date</th>
                        {(detailData?.isAllShops || isAllShops) && (
                          <th className="py-2.5 px-3">Shop</th>
                        )}
                        <th className="py-2.5 px-3 text-right">Quantity</th>
                        <th className="py-2.5 px-3 text-right">Unit Price</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Mode</th>
                        <th className="py-2.5 px-3">Note</th>
                        <th className="py-2.5 px-3">Entered By</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {(detailData?.rows || []).map((entry) => (
                        <tr key={entry.id} className="hover:bg-slate-50/70">
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap text-slate-700">
                            {entry.dateFormatted}
                          </td>
                          {(detailData?.isAllShops || isAllShops) && (
                            <td className="py-2.5 px-3 font-medium text-slate-800 whitespace-nowrap">
                              {entry.shopName}
                            </td>
                          )}
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700 whitespace-nowrap">
                            {entry.quantity !== null
                              ? formatQuantityWithUnit(entry.quantity, entry.unit)
                              : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600 whitespace-nowrap">
                            {entry.unitPrice !== null
                              ? formatRatePerUnit(entry.unitPrice, entry.unit)
                              : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900 whitespace-nowrap">
                            <Money value={entry.amount} />
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                              {entry.modeName}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-[180px] truncate">
                            {entry.note || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                            {entry.enteredByName || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    {detailData && (
                      <tfoot>
                        <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                          <td
                            colSpan={(detailData.isAllShops || isAllShops) ? 2 : 1}
                            className="py-2.5 px-3"
                          >
                            Period Subtotal (<Count value={detailData.totalCount} suffix="entries" />)
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                            {detailData.subtotal.totalQuantity !== null
                              ? formatQuantityWithUnit(
                                  detailData.subtotal.totalQuantity,
                                  detailData.subtotal.unit
                                )
                              : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                            {detailData.subtotal.avgRate !== null
                              ? formatRatePerUnit(
                                  detailData.subtotal.avgRate,
                                  detailData.subtotal.unit
                                )
                              : '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                            <Money value={detailData.subtotal.totalAmount} />
                          </td>
                          <td colSpan={3} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </>
            )}
          </div>

          {/* Pagination Footer */}
          {detailData && detailData.totalPages > 1 && (
            <div className="px-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs flex-none">
              <span className="text-slate-600">
                Page <Count value={detailData.page} /> of{' '}
                <Count value={detailData.totalPages} />
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={detailLoading || detailPage <= 1}
                  onClick={() => setDetailPage((p) => Math.max(1, p - 1))}
                  className="min-h-[40px] sm:min-h-[34px] gap-1"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={detailLoading || detailPage >= detailData.totalPages}
                  onClick={() =>
                    setDetailPage((p) => Math.min(detailData.totalPages, p + 1))
                  }
                  className="min-h-[40px] sm:min-h-[34px] gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


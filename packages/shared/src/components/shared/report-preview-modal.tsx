'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  PdfPreviewBrandMeta,
  PdfPreviewModal,
  PdfPreviewPageItem,
} from '@/components/shared/pdf-preview-modal';
import { Count, Money } from '@/components/shared/format-values';
import { formatRatePerUnit } from '@/lib/calculations/format';
import { formatQuantityWithUnit } from '@/lib/constants/units';
import type { ReportKindOption, ReportData } from '@/lib/reports/types';
import type { BrandConsolidatedReportBundle } from '@/lib/reports/brand-builder';
import type {
  GroupedItemDetailsGroup,
  ItemWiseSummaryResult,
} from '@/lib/reports/item-wise';

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportType: ReportKindOption;
  shopId: string;
  month: string;
  startDate: string;
  endDate: string;
  includeItemDetails: boolean;
  itemKindFilter?: 'expense' | 'income' | 'both';
  itemCategoryFilter?: string;
  itemSearchFilter?: string;
  onDownloadPdf: () => void | Promise<void>;
  isDownloadingPdf?: boolean;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  if (!arr || arr.length === 0) return [];
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    res.push(arr.slice(i, i + size));
  }
  return res;
}

const REPORT_LABELS: Record<ReportKindOption, string> = {
  daily_summary: 'Daily Summary Statement',
  item_wise: 'Item-wise Summary Report',
  salary: 'Staff Salary Statement',
  full: 'Full Consolidated Financial Report',
};

export function ReportPreviewModal({
  isOpen,
  onClose,
  reportType,
  shopId,
  month,
  startDate,
  endDate,
  includeItemDetails,
  itemKindFilter = 'expense',
  itemCategoryFilter = '',
  itemSearchFilter = '',
  onDownloadPdf,
  isDownloadingPdf = false,
}: ReportPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<any>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;

    const loadPreview = async () => {
      setLoading(true);
      setError(null);
      try {
        const sp = new URLSearchParams({
          reportType,
          shopId,
          month,
          startDate,
          endDate,
          includeDetails: String(includeItemDetails),
          kind: itemKindFilter,
        });
        if (itemCategoryFilter) sp.set('category', itemCategoryFilter);
        if (itemSearchFilter) sp.set('search', itemSearchFilter);

        const res = await fetch(`/api/reports/preview?${sp.toString()}`, {
          cache: 'no-store',
        });
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || 'Could not load report preview');
        }
        const json = await res.json();
        if (!cancelled) {
          setPayload(json);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Preview generation failed');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [
    isOpen,
    reportType,
    shopId,
    month,
    startDate,
    endDate,
    includeItemDetails,
    itemKindFilter,
    itemCategoryFilter,
    itemSearchFilter,
  ]);

  if (!isOpen) return null;

  if (loading || !payload || error) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-md rounded-lg sm:rounded-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {error ? 'Preview Error' : 'Preparing A4 Report Preview...'}
            </DialogTitle>
          </DialogHeader>
          {loading ? (
            <div className="py-10 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
              <Loader2 className="h-7 w-7 animate-spin text-[var(--brand-primary,#ea580c)]" />
              <span>Building live financial figures & A4 sheets...</span>
            </div>
          ) : (
            <div className="py-6 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-rose-500 mx-auto" />
              <p className="text-xs text-slate-600">{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }

  const brandRaw = payload.brand || {};
  const brandMeta: PdfPreviewBrandMeta = {
    name: brandRaw.name || 'CafeLedger',
    logoUrl: brandRaw.logoUrl || null,
    primaryColor: brandRaw.primaryColor || '#ea580c',
    secondaryColor: brandRaw.secondaryColor || '#1e293b',
    registrationNo: brandRaw.registrationNo || null,
    gstin: brandRaw.gstin || null,
    address: brandRaw.address || null,
    pdfHeaderStyle: brandRaw.pdfHeaderStyle || 'left',
    pdfFooterText: brandRaw.pdfFooterText || null,
    pdfShowAddress: brandRaw.pdfShowAddress !== false,
    pdfShowGstin: brandRaw.pdfShowGstin !== false,
    pdfShowRegistrationNo: brandRaw.pdfShowRegistrationNo !== false,
    pdfSignatureLine: Boolean(brandRaw.pdfSignatureLine),
  };

  const pages: PdfPreviewPageItem[] = [];
  let subtitle = '';
  let periodLabel = `${startDate} to ${endDate}`;
  let generatedAtLabel = '';

  const renderItemSummaryTable = (
    rows: ItemWiseSummaryResult['rows'],
    grandTotalAmount: number,
    grandTotalPurchases: number,
    isContinuation: boolean
  ) => (
    <div className="space-y-2">
      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
        {isContinuation ? 'Item-wise Summary (Continued)' : 'Item-wise Summary'}
      </div>
      <div className="border border-slate-200 rounded-[4px] overflow-hidden">
        <table className="w-full text-[10px] border-collapse">
          <thead>
            <tr
              className="text-white"
              style={{ backgroundColor: brandMeta.primaryColor || '#ea580c' }}
            >
              <th className="py-1.5 px-2 text-left">Item</th>
              <th className="py-1.5 px-2 text-left">Category</th>
              <th className="py-1.5 px-2 text-right">Qty</th>
              <th className="py-1.5 px-2 text-right">Avg Rate</th>
              <th className="py-1.5 px-2 text-right">Entries</th>
              <th className="py-1.5 px-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={`${r.itemKey}-${r.kind}-${r.unit}`}>
                <td className="py-1.5 px-2 font-medium text-slate-900">
                  {r.itemName}
                  {r.unit ? ` (${r.unit})` : ''}
                </td>
                <td className="py-1.5 px-2 text-slate-600">{r.category}</td>
                <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                  {r.totalQuantity !== null
                    ? formatQuantityWithUnit(r.totalQuantity, r.unit)
                    : '-'}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-slate-600">
                  {r.avgRate !== null ? formatRatePerUnit(r.avgRate, r.unit) : '-'}
                </td>
                <td className="py-1.5 px-2 text-right font-mono text-slate-700">
                  <Count value={r.purchaseCount} />
                </td>
                <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                  <Money value={r.totalAmount} />
                </td>
              </tr>
            ))}
          </tbody>
          {!isContinuation && (
            <tfoot>
              <tr className="bg-slate-100 font-bold border-t border-slate-300">
                <td colSpan={4} className="py-1.5 px-2">
                  Grand Total
                </td>
                <td className="py-1.5 px-2 text-right font-mono">
                  <Count value={grandTotalPurchases} />
                </td>
                <td className="py-1.5 px-2 text-right font-mono">
                  <Money value={grandTotalAmount} />
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );

  const renderItemDetailGroupsPages = (groups: GroupedItemDetailsGroup[]) => {
    const groupChunks = chunkArray(groups, 2);
    groupChunks.forEach((grpPair, pageIdx) => {
      pages.push({
        title:
          pageIdx === 0
            ? 'Item-wise Purchase Details'
            : 'Item-wise Purchase Details (Continued)',
        content: (
          <div className="space-y-4">
            {grpPair.map((grp) => (
              <div
                key={`${grp.itemKey}-${grp.unit}`}
                className="border border-slate-200 rounded-[4px] overflow-hidden"
              >
                <div className="bg-slate-100 px-2.5 py-1.5 flex items-center justify-between text-[10px] font-bold text-slate-800">
                  <span>
                    {grp.itemName}
                    {grp.unit ? ` (${grp.unit})` : ''} —{' '}
                    <Count value={grp.rows.length} suffix="entries" />
                  </span>
                  <span className="font-mono">
                    <Money value={grp.subtotalAmount} />
                  </span>
                </div>
                <table className="w-full text-[9.5px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                      <th className="py-1 px-2 text-left">Date</th>
                      <th className="py-1 px-2 text-left">Shop</th>
                      <th className="py-1 px-2 text-right">Qty</th>
                      <th className="py-1 px-2 text-right">Rate</th>
                      <th className="py-1 px-2 text-left">Mode</th>
                      <th className="py-1 px-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {grp.rows.slice(0, 12).map((row) => (
                      <tr key={row.id}>
                        <td className="py-1 px-2 font-mono">{row.dateFormatted}</td>
                        <td className="py-1 px-2 truncate max-w-[90px]">
                          {row.shopName}
                        </td>
                        <td className="py-1 px-2 text-right font-mono">
                          {row.quantity !== null
                            ? formatQuantityWithUnit(row.quantity, row.unit)
                            : '-'}
                        </td>
                        <td className="py-1 px-2 text-right font-mono">
                          {row.unitPrice !== null
                            ? formatRatePerUnit(row.unitPrice, row.unit)
                            : '-'}
                        </td>
                        <td className="py-1 px-2">{row.modeName}</td>
                        <td className="py-1 px-2 text-right font-mono font-semibold">
                          <Money value={row.amount} />
                        </td>
                      </tr>
                    ))}
                    {grp.rows.length > 12 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="py-1 px-2 text-center text-slate-400 italic"
                        >
                          + <Count value={grp.rows.length - 12} suffix="more entries included in full PDF download" />
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ),
      });
    });
  };

  if (payload.mode === 'item_wise') {
    const s: ItemWiseSummaryResult = payload.summary;
    const groups: GroupedItemDetailsGroup[] = payload.groups || [];
    subtitle = s.shopLabel;
    const chunks = chunkArray(s.rows, 14);
    if (chunks.length === 0) {
      pages.push({
        title: 'Item-wise Summary Report',
        content: (
          <div className="py-10 text-center text-xs text-slate-500">
            No items matched this filter range.
          </div>
        ),
      });
    } else {
      chunks.forEach((chunk, idx) => {
        pages.push({
          title: 'Item-wise Summary Report',
          content: (
            <div className="space-y-4">
              {idx === 0 && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 rounded-[4px] border border-slate-200 bg-slate-50">
                    <span className="text-[9px] uppercase text-slate-500 block">
                      Distinct Item Units
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      <Count value={s.rows.length} />
                    </span>
                  </div>
                  <div className="p-2.5 rounded-[4px] border border-slate-200 bg-slate-50">
                    <span className="text-[9px] uppercase text-slate-500 block">
                      Total Purchases
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      <Count value={s.grandTotalPurchases} />
                    </span>
                  </div>
                  <div className="p-2.5 rounded-[4px] border border-slate-200 bg-slate-50">
                    <span className="text-[9px] uppercase text-slate-500 block">
                      Grand Total Amount
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      <Money value={s.grandTotalAmount} />
                    </span>
                  </div>
                </div>
              )}
              {renderItemSummaryTable(
                chunk,
                s.grandTotalAmount,
                s.grandTotalPurchases,
                idx > 0
              )}
            </div>
          ),
        });
      });
    }
    if (includeItemDetails && groups.length > 0) {
      renderItemDetailGroupsPages(groups);
    }
  } else if (payload.mode === 'brand') {
    const bundle: BrandConsolidatedReportBundle = payload.bundle;
    const pdf = bundle.pdfData;
    subtitle = 'All Outlets Combined';
    periodLabel = `${pdf.period.startDate} to ${pdf.period.endDate}`;
    generatedAtLabel = pdf.generatedAt;

    if (reportType === 'daily_summary' || reportType === 'full') {
      pages.push({
        title: 'Brand Executive Summary & Outlets',
        content: (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              <div className="p-2.5 rounded-[4px] border border-slate-200 bg-slate-50">
                <span className="text-[9px] uppercase text-slate-500 block">
                  Total Income
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  <Money value={pdf.summary.totalIncome} />
                </span>
              </div>
              <div className="p-2.5 rounded-[4px] border border-slate-200 bg-slate-50">
                <span className="text-[9px] uppercase text-slate-500 block">
                  Total Expense
                </span>
                <span className="text-xs font-bold text-rose-700">
                  <Money value={pdf.summary.totalExpense} />
                </span>
              </div>
              <div className="p-2.5 rounded-[4px] border border-slate-200 bg-slate-50">
                <span className="text-[9px] uppercase text-slate-500 block">
                  Net Profit
                </span>
                <span className="text-xs font-bold text-slate-900">
                  <Money value={pdf.summary.netProfit} />
                </span>
              </div>
              <div className="p-2.5 rounded-[4px] border border-slate-200 bg-slate-50">
                <span className="text-[9px] uppercase text-slate-500 block">
                  Active Outlets
                </span>
                <span className="text-xs font-bold text-slate-900">
                  <Count value={pdf.summary.activeShopsCount} />
                </span>
              </div>
            </div>

            <div className="border border-slate-200 rounded-[4px] overflow-hidden">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr
                    className="text-white"
                    style={{ backgroundColor: brandMeta.primaryColor || '#ea580c' }}
                  >
                    <th className="py-1.5 px-2 text-left">Outlet</th>
                    <th className="py-1.5 px-2 text-right">Income</th>
                    <th className="py-1.5 px-2 text-right">Expense</th>
                    <th className="py-1.5 px-2 text-right">Net</th>
                    <th className="py-1.5 px-2 text-right">Closing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {pdf.shops.map((sh) => (
                    <tr key={sh.code}>
                      <td className="py-1.5 px-2 font-medium text-slate-900">
                        {sh.name} ({sh.code})
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-emerald-700">
                        <Money value={sh.income} />
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-rose-700">
                        <Money value={sh.expense} />
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold text-slate-900">
                        <Money value={sh.net} />
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-800">
                        <Money value={sh.closing} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ),
      });

      const dayChunks = chunkArray(bundle.dailySummaries || [], 18);
      dayChunks.forEach((chunk, idx) => {
        pages.push({
          title:
            idx === 0
              ? 'Consolidated Daily Summary'
              : 'Consolidated Daily Summary (Continued)',
          content: (
            <div className="border border-slate-200 rounded-[4px] overflow-hidden">
              <table className="w-full text-[10px] border-collapse">
                <thead>
                  <tr
                    className="text-white"
                    style={{ backgroundColor: brandMeta.primaryColor || '#ea580c' }}
                  >
                    <th className="py-1.5 px-2 text-left">Date</th>
                    <th className="py-1.5 px-2 text-right">Opening</th>
                    <th className="py-1.5 px-2 text-right">Income</th>
                    <th className="py-1.5 px-2 text-right">Expense</th>
                    <th className="py-1.5 px-2 text-right">Net</th>
                    <th className="py-1.5 px-2 text-right">Closing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chunk.map((d) => (
                    <tr key={d.date}>
                      <td className="py-1 px-2 font-mono">{d.date}</td>
                      <td className="py-1 px-2 text-right font-mono">
                        <Money value={d.opening} />
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-emerald-700">
                        <Money value={d.income} />
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-rose-700">
                        <Money value={d.expense} />
                      </td>
                      <td className="py-1 px-2 text-right font-mono font-bold">
                        <Money value={d.net} />
                      </td>
                      <td className="py-1 px-2 text-right font-mono font-semibold">
                        <Money value={d.closing} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        });
      });
    }

    if (reportType === 'salary' || reportType === 'full') {
      const salChunks = chunkArray(pdf.salaryRecords || [], 16);
      salChunks.forEach((chunk, idx) => {
        pages.push({
          title:
            idx === 0
              ? 'Consolidated Staff Salary Statement'
              : 'Consolidated Staff Salary Statement (Continued)',
          content: (
            <div className="border border-slate-200 rounded-[4px] overflow-hidden">
              <table className="w-full text-[9.5px] border-collapse">
                <thead>
                  <tr
                    className="text-white"
                    style={{ backgroundColor: brandMeta.primaryColor || '#ea580c' }}
                  >
                    <th className="py-1.5 px-2 text-left">Employee</th>
                    <th className="py-1.5 px-2 text-left">Shop</th>
                    <th className="py-1.5 px-2 text-right">Days</th>
                    <th className="py-1.5 px-2 text-right">Gross</th>
                    <th className="py-1.5 px-2 text-right">Advance</th>
                    <th className="py-1.5 px-2 text-right">Paid</th>
                    <th className="py-1.5 px-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {chunk.map((s, sIdx) => (
                    <tr key={`${s.employee}-${sIdx}`}>
                      <td className="py-1 px-2 font-medium text-slate-900">
                        {s.employee}
                      </td>
                      <td className="py-1 px-2 text-slate-600">
                        {s.shopName || '-'}
                      </td>
                      <td className="py-1 px-2 text-right font-mono">
                        <Count value={s.days} />
                      </td>
                      <td className="py-1 px-2 text-right font-mono">
                        <Money value={s.gross} />
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-rose-700">
                        <Money value={s.advances} />
                      </td>
                      <td className="py-1 px-2 text-right font-mono text-emerald-700">
                        <Money value={s.paid} />
                      </td>
                      <td className="py-1 px-2 text-right font-mono font-bold">
                        <Money value={s.balance} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ),
        });
      });
    }

    if (reportType === 'full' && (pdf.itemSummaryRows?.length || 0) > 0) {
      const itemChunks = chunkArray(pdf.itemSummaryRows || [], 15);
      const totalItemAmt = (pdf.itemSummaryRows || []).reduce(
        (a, b) => a + b.totalAmount,
        0
      );
      const totalItemEntries = (pdf.itemSummaryRows || []).reduce(
        (a, b) => a + b.purchaseCount,
        0
      );
      itemChunks.forEach((chunk, idx) => {
        pages.push({
          title:
            idx === 0
              ? 'Item-wise Summary'
              : 'Item-wise Summary (Continued)',
          content: renderItemSummaryTable(
            chunk,
            totalItemAmt,
            totalItemEntries,
            idx > 0
          ),
        });
      });
      if (includeItemDetails && (pdf.groupedItemDetails?.length || 0) > 0) {
        renderItemDetailGroupsPages(pdf.groupedItemDetails || []);
      }
    }
  } else {
    // Single Shop preview
    const r: ReportData = payload.reportData;
    subtitle = `${r.shop.name} (${r.shop.code})`;
    periodLabel = `${r.period.startDate} to ${r.period.endDate}`;
    generatedAtLabel = r.generatedAt;

    if (reportType === 'daily_summary' || reportType === 'full') {
      const dayChunks = chunkArray(r.dailySummaries || [], 15);
      if (dayChunks.length === 0) {
        pages.push({
          title: 'Daily Financial Statement',
          content: (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="p-2 rounded-[4px] border border-slate-200 bg-slate-50">
                  <span className="text-[9px] uppercase text-slate-500 block">Opening</span>
                  <span className="text-xs font-bold"><Money value={r.summary.openingBalance} /></span>
                </div>
                <div className="p-2 rounded-[4px] border border-slate-200 bg-slate-50">
                  <span className="text-[9px] uppercase text-slate-500 block">Income</span>
                  <span className="text-xs font-bold text-emerald-700"><Money value={r.summary.totalIncome} /></span>
                </div>
                <div className="p-2 rounded-[4px] border border-slate-200 bg-slate-50">
                  <span className="text-[9px] uppercase text-slate-500 block">Expense</span>
                  <span className="text-xs font-bold text-rose-700"><Money value={r.summary.totalExpense} /></span>
                </div>
                <div className="p-2 rounded-[4px] border border-slate-200 bg-slate-50">
                  <span className="text-[9px] uppercase text-slate-500 block">Closing</span>
                  <span className="text-xs font-bold"><Money value={r.summary.closingBalance} /></span>
                </div>
              </div>
              <p className="text-xs text-slate-500 text-center py-6">
                No daily summary rows recorded for this range.
              </p>
            </div>
          ),
        });
      } else {
        dayChunks.forEach((chunk, idx) => {
          pages.push({
            title:
              idx === 0
                ? 'Daily Financial Statement'
                : 'Daily Financial Statement (Continued)',
            content: (
              <div className="space-y-4">
                {idx === 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    <div className="p-2 rounded-[4px] border border-slate-200 bg-slate-50">
                      <span className="text-[9px] uppercase text-slate-500 block">Opening</span>
                      <span className="text-xs font-bold"><Money value={r.summary.openingBalance} /></span>
                    </div>
                    <div className="p-2 rounded-[4px] border border-slate-200 bg-slate-50">
                      <span className="text-[9px] uppercase text-slate-500 block">Income</span>
                      <span className="text-xs font-bold text-emerald-700"><Money value={r.summary.totalIncome} /></span>
                    </div>
                    <div className="p-2 rounded-[4px] border border-slate-200 bg-slate-50">
                      <span className="text-[9px] uppercase text-slate-500 block">Expense</span>
                      <span className="text-xs font-bold text-rose-700"><Money value={r.summary.totalExpense} /></span>
                    </div>
                    <div className="p-2 rounded-[4px] border border-slate-200 bg-slate-50">
                      <span className="text-[9px] uppercase text-slate-500 block">Closing</span>
                      <span className="text-xs font-bold"><Money value={r.summary.closingBalance} /></span>
                    </div>
                  </div>
                )}
                <div className="border border-slate-200 rounded-[4px] overflow-hidden">
                  <table className="w-full text-[10px] border-collapse">
                    <thead>
                      <tr
                        className="text-white"
                        style={{ backgroundColor: brandMeta.primaryColor || '#ea580c' }}
                      >
                        <th className="py-1.5 px-2 text-left">Date</th>
                        <th className="py-1.5 px-2 text-right">Opening</th>
                        <th className="py-1.5 px-2 text-right">Income</th>
                        <th className="py-1.5 px-2 text-right">Expense</th>
                        <th className="py-1.5 px-2 text-right">Net</th>
                        <th className="py-1.5 px-2 text-right">Closing</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {chunk.map((d) => (
                        <tr key={d.date}>
                          <td className="py-1 px-2 font-mono">{d.date}</td>
                          <td className="py-1 px-2 text-right font-mono"><Money value={d.opening} /></td>
                          <td className="py-1 px-2 text-right font-mono text-emerald-700"><Money value={d.income} /></td>
                          <td className="py-1 px-2 text-right font-mono text-rose-700"><Money value={d.expense} /></td>
                          <td className="py-1 px-2 text-right font-mono font-bold"><Money value={d.net} /></td>
                          <td className="py-1 px-2 text-right font-mono font-semibold"><Money value={d.closing} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          });
        });
      }
    }

    if (reportType === 'salary' || reportType === 'full') {
      const salChunks = chunkArray(r.salaryRecords || [], 16);
      if (salChunks.length === 0 && reportType === 'salary') {
        pages.push({
          title: 'Staff Salary Statement',
          content: (
            <div className="py-10 text-center text-xs text-slate-500">
              No salary records found for this period.
            </div>
          ),
        });
      } else {
        salChunks.forEach((chunk, idx) => {
          pages.push({
            title:
              idx === 0
                ? 'Staff Salary & Balance Register'
                : 'Staff Salary & Balance Register (Continued)',
            content: (
              <div className="border border-slate-200 rounded-[4px] overflow-hidden">
                <table className="w-full text-[9.5px] border-collapse">
                  <thead>
                    <tr
                      className="text-white"
                      style={{ backgroundColor: brandMeta.primaryColor || '#ea580c' }}
                    >
                      <th className="py-1.5 px-2 text-left">Employee</th>
                      <th className="py-1.5 px-2 text-right">Days</th>
                      <th className="py-1.5 px-2 text-right">Rate</th>
                      <th className="py-1.5 px-2 text-right">Gross</th>
                      <th className="py-1.5 px-2 text-right">Advance</th>
                      <th className="py-1.5 px-2 text-right">Paid</th>
                      <th className="py-1.5 px-2 text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {chunk.map((s, sIdx) => (
                      <tr key={`${s.employee}-${sIdx}`}>
                        <td className="py-1 px-2 font-medium text-slate-900">
                          {s.employee}
                        </td>
                        <td className="py-1 px-2 text-right font-mono">
                          <Count value={s.days} />
                        </td>
                        <td className="py-1 px-2 text-right font-mono">
                          <Money value={s.rate} />
                        </td>
                        <td className="py-1 px-2 text-right font-mono">
                          <Money value={s.gross} />
                        </td>
                        <td className="py-1 px-2 text-right font-mono text-rose-700">
                          <Money value={s.advances} />
                        </td>
                        <td className="py-1 px-2 text-right font-mono text-emerald-700">
                          <Money value={s.paid} />
                        </td>
                        <td className="py-1 px-2 text-right font-mono font-bold">
                          <Money value={s.balance} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ),
          });
        });
      }
    }

    if (reportType === 'full' && (r.itemSummaryRows?.length || 0) > 0) {
      const itemChunks = chunkArray(r.itemSummaryRows || [], 15);
      const totalItemAmt = (r.itemSummaryRows || []).reduce(
        (a, b) => a + b.totalAmount,
        0
      );
      const totalItemEntries = (r.itemSummaryRows || []).reduce(
        (a, b) => a + b.purchaseCount,
        0
      );
      itemChunks.forEach((chunk, idx) => {
        pages.push({
          title:
            idx === 0
              ? 'Item-wise Summary'
              : 'Item-wise Summary (Continued)',
          content: renderItemSummaryTable(
            chunk,
            totalItemAmt,
            totalItemEntries,
            idx > 0
          ),
        });
      });
      if (includeItemDetails && (r.groupedItemDetails?.length || 0) > 0) {
        renderItemDetailGroupsPages(r.groupedItemDetails || []);
      }
    }
  }

  if (pages.length === 0) {
    pages.push({
      title: REPORT_LABELS[reportType],
      content: (
        <div className="py-10 text-center text-xs text-slate-500">
          No report rows available for this period.
        </div>
      ),
    });
  }

  return (
    <PdfPreviewModal
      isOpen={isOpen}
      onClose={onClose}
      title={REPORT_LABELS[reportType]}
      subtitle={subtitle}
      periodLabel={periodLabel}
      generatedAtLabel={generatedAtLabel}
      brand={brandMeta}
      pages={pages}
      onDownloadPdf={onDownloadPdf}
      isDownloading={isDownloadingPdf}
    />
  );
}


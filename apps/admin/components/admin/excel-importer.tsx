'use client';

import React, { useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Store,
  Calendar,
  Layers,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { formatINR } from '@/lib/calculations/currency';
import { Count } from '@/components/shared/format-values';
import { formatCount } from '@/lib/calculations/format';
import { importExcelTransactionsAction } from '@/app/admin/actions';
import { DemoShop } from '@/lib/demo-admin-data';
import { getCurrentMonthKolkata } from '@/lib/calculations/dates';

interface ParsedRow {
  date: string;
  description: string;
  mop: string;
  income: number;
  expense: number;
  isSalaryAdvance: boolean;
  employeeName?: string;
}

interface ExcelImporterProps {
  shops: DemoShop[];
}

export function ExcelImporter({ shops }: ExcelImporterProps) {
  const [targetShopId, setTargetShopId] = useState(shops[0]?.id || '');
  const [targetMonth, setTargetMonth] = useState(getCurrentMonthKolkata());

  const [fileName, setFileName] = useState<string | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');

  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importedResult, setImportedResult] = useState<{ count: number } | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setIsParsing(true);
    setImportedResult(null);
    setParsedRows([]);

    try {
      const ExcelJS = (await import('exceljs')).default;
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);

      const sheets = workbook.worksheets.map((ws: any) => ws.name);
      setSheetNames(sheets);

      // Default to first sheet or one matching month name
      const activeWs = workbook.worksheets[0];
      setSelectedSheet(activeWs.name);
      parseSheet(activeWs);

      toast.success(`Workbook parsed: ${sheets.length} sheet(s) found`);
    } catch (err: any) {
      toast.error('Failed to parse Excel file: ' + err.message);
    } finally {
      setIsParsing(false);
    }
  };

  const parseSheet = (worksheet: any) => {
    let colDate = -1;
    let colDesc = -1;
    let colMop = -1;
    let colIncome = -1;
    let colExpense = -1;

    let foundOpening = 0;
    const rows: ParsedRow[] = [];

    // Find header row (usually row 1 or 2)
    worksheet.eachRow((row: any, rowNumber: number) => {
      const values = row.values as any[];
      if (!values) return;

      // Check for headers
      if (colDate === -1) {
        for (let c = 1; c < values.length; c++) {
          const val = String(values[c] || '').trim().toUpperCase();
          if (val === 'DATE') colDate = c;
          if (val.includes('DISCRIPTION') || val.includes('DESCRIPTION')) colDesc = c;
          if (val === 'MOP' || val.includes('PAYMENT') || val.includes('MODE')) colMop = c;
          if (val === 'INCOME' || val.includes('SALES')) colIncome = c;
          if (val === 'EXPENSES' || val === 'EXPENSE') colExpense = c;
        }
        return;
      }

      // Check first row for OPENING BAL
      const rawDesc = String(values[colDesc] || '').trim();
      const rawDate = values[colDate];
      const incomeVal = Number(values[colIncome]) || 0;
      const expenseVal = Number(values[colExpense]) || 0;
      const mopVal = String(values[colMop] || 'CASH').trim().toUpperCase();

      if (rawDesc.toUpperCase().includes('OPENING BAL') || rawDesc.toUpperCase().includes('OPENING BALANCE')) {
        foundOpening = incomeVal || expenseVal || 0;
        return;
      }

      // Parse normal row
      if (rawDate && (incomeVal > 0 || expenseVal > 0)) {
        let dateStr = '';
        if (rawDate instanceof Date) {
          dateStr = rawDate.toISOString().split('T')[0];
        } else if (typeof rawDate === 'string') {
          // If in DD-MM-YYYY format
          if (rawDate.includes('-') && rawDate.split('-')[0].length === 2) {
            const parts = rawDate.split('-');
            dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
          } else {
            dateStr = rawDate;
          }
        } else {
          // Approximate current month date
          dateStr = `${targetMonth}-01`;
        }

        const isSalaryAdvance = rawDesc.toUpperCase().startsWith('SA-');
        const employeeName = isSalaryAdvance ? rawDesc.substring(3).trim() : undefined;

        rows.push({
          date: dateStr,
          description: rawDesc,
          mop: mopVal || 'CASH',
          income: incomeVal,
          expense: expenseVal,
          isSalaryAdvance,
          employeeName,
        });
      }
    });

    setOpeningBalance(foundOpening);
    setParsedRows(rows);
  };

  const handleConfirmImport = async () => {
    if (!targetShopId || !targetMonth || parsedRows.length === 0) {
      toast.error('Select a target outlet and upload rows first');
      return;
    }

    setIsImporting(true);
    const toastId = toast.loading(`Importing ${parsedRows.length} transactions into outlet ledger...`);
    try {
      const res = await importExcelTransactionsAction({
        shopId: targetShopId,
        month: targetMonth,
        openingBalance,
        rows: parsedRows,
      });

      if (res.success) {
        toast.success(`Successfully imported ${res.data?.importedCount || parsedRows.length} transactions!`, {
          id: toastId,
        });
        setImportedResult({ count: res.data?.importedCount || parsedRows.length });
      } else {
        toast.error(res.error || 'Import failed', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  const totalIncome = parsedRows.reduce((acc, r) => acc + r.income, 0);
  const totalExpense = parsedRows.reduce((acc, r) => acc + r.expense, 0);
  const salaryAdvancesCount = parsedRows.filter((r) => r.isSalaryAdvance).length;

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <UploadCloud className="h-6 w-6 text-[var(--brand-primary,#ea580c)]" />
            <span>Legacy Excel Statement Importer</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Ingest monthly Excel accounting sheets (e.g. FEB26/MAR26) with automatic opening balance and salary advance detection.
          </p>
        </div>
      </div>

      {/* 2. TARGET OUTLET & FILE UPLOAD */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Store className="h-4 w-4 text-[var(--brand-primary,#ea580c)]" />
            <span>Target Branch & Month</span>
          </h2>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Destination Cafe Outlet *</label>
            <select
              value={targetShopId}
              onChange={(e) => setTargetShopId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)] bg-white"
            >
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Accounting Month *</label>
            <input
              type="month"
              value={targetMonth}
              onChange={(e) => setTargetMonth(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600 space-y-1">
            <p className="font-semibold text-slate-800">Supported Format:</p>
            <p>Columns: <code>DATE | DISCRIPTION | MOP | INCOME | EXPENSES</code></p>
            <p>First row: <code>OPENING BAL</code></p>
            <p>Salary Advances: <code>SA-&lt;NAME&gt;</code></p>
          </div>
        </div>

        {/* DRAG & DROP FILE ZONE */}
        <div className="lg:col-span-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-6 flex flex-col items-center justify-center text-center space-y-3">
          <div className="p-3 rounded-full bg-white shadow-xs text-[var(--brand-primary,#ea580c)]">
            <FileSpreadsheet className="h-8 w-8" />
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {fileName ? fileName : 'Upload your Monthly Excel Statement'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Supports .xlsx spreadsheets with sheets like FEB26, MAR26.
            </p>
          </div>

          <label className="cursor-pointer">
            <Button
              type="button"
              className="bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90 pointer-events-none"
            >
              Select Excel File (.xlsx)
            </Button>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {isParsing && (
            <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-[var(--brand-primary,#ea580c)]" />
              <span>Parsing spreadsheet structure...</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. PARSED PREVIEW & MAPPING */}
      {parsedRows.length > 0 && (
        <div className="space-y-4">
          {/* Summary KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Opening Balance</span>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{formatINR(openingBalance)}</div>
              <span className="text-[10px] text-emerald-600 font-semibold">Extracted from OPENING BAL</span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Income Entries</span>
              <div className="text-lg font-bold text-emerald-700 mt-0.5">{formatINR(totalIncome)}</div>
              <span className="text-[10px] text-slate-500"><Count value={parsedRows.filter((r) => r.income > 0).length} suffix="transactions" /></span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Total Expense Entries</span>
              <div className="text-lg font-bold text-rose-700 mt-0.5">{formatINR(totalExpense)}</div>
              <span className="text-[10px] text-slate-500"><Count value={parsedRows.filter((r) => r.expense > 0).length} suffix="transactions" /></span>
            </div>

            <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Salary Advances</span>
              <div className="text-lg font-bold text-indigo-700 mt-0.5"><Count value={salaryAdvancesCount} suffix="Advances" /></div>
              <span className="text-[10px] text-indigo-600 font-semibold">Flagged as SA-&lt;NAME&gt;</span>
            </div>
          </div>

          {/* Table Preview */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Parsed Row Mapping Preview (First 20 rows)</h3>
                <p className="text-xs text-slate-500">
                  Review the mapped fields before committing into the outlet's permanent ledger.
                </p>
              </div>

              <Button
                onClick={handleConfirmImport}
                disabled={isImporting || !!importedResult}
                className="bg-emerald-700 hover:bg-emerald-800 text-white flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>{isImporting ? 'Importing Ledger...' : importedResult ? 'Import Finished' : `Commit ${formatCount(parsedRows.length)} Rows`}</span>
              </Button>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3">MOP</th>
                    <th className="py-2.5 px-3 text-right">Income (₹)</th>
                    <th className="py-2.5 px-3 text-right">Expense (₹)</th>
                    <th className="py-2.5 px-4">Classification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parsedRows.slice(0, 20).map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-2 px-4 font-mono text-slate-700">{row.date}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{row.description}</td>
                      <td className="py-2 px-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                          {row.mop}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-emerald-700">
                        {row.income > 0 ? formatINR(row.income) : '—'}
                      </td>
                      <td className="py-2 px-3 text-right font-mono font-semibold text-rose-700">
                        {row.expense > 0 ? formatINR(row.expense) : '—'}
                      </td>
                      <td className="py-2 px-4">
                        {row.isSalaryAdvance ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700">
                            <Sparkles className="h-3 w-3" />
                            <span>Salary Advance ({row.employeeName})</span>
                          </span>
                        ) : row.income > 0 ? (
                          <span className="text-[10px] font-semibold text-emerald-700">Income Transaction</span>
                        ) : (
                          <span className="text-[10px] font-semibold text-rose-700">Operating Expense</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


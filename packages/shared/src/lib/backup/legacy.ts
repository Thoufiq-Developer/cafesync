// ==============================================================================
// CafeSync - Framework-Independent Legacy Excel Parser & Matcher
// Handles classic ledger sheets (DATE, DISCRIPTION, MOP, INCOME, EXPENSES)
// With duplicate detection, item name matching, and batch tagging
// ==============================================================================

import ExcelJS from 'exceljs';

export interface LegacyParsedRow {
  rowNumber: number;
  date: string;
  description: string;
  mop: string;
  income: number;
  expense: number;
  isSalaryAdvance: boolean;
  employeeName?: string;
  matchedItemId?: string;
  isDuplicate?: boolean;
}

export interface LegacySheetParseResult {
  sheetName: string;
  openingBalance: number;
  rows: LegacyParsedRow[];
  duplicatesCount: number;
  unmatchedDescriptions: string[];
}

export async function parseLegacyWorkbook(
  arrayBuffer: ArrayBuffer
): Promise<{ sheetNames: string[]; parseSheet: (sheetName: string) => LegacySheetParseResult }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const sheetNames = workbook.worksheets.map((ws) => ws.name);

  function parseSheet(sheetName: string): LegacySheetParseResult {
    const ws = workbook.getWorksheet(sheetName);
    if (!ws) {
      return {
        sheetName,
        openingBalance: 0,
        rows: [],
        duplicatesCount: 0,
        unmatchedDescriptions: [],
      };
    }

    let colDate = -1;
    let colDesc = -1;
    let colMop = -1;
    let colIncome = -1;
    let colExpense = -1;
    let openingBalance = 0;
    const rows: LegacyParsedRow[] = [];

    ws.eachRow((row, rowNumber) => {
      const values = (row.values as any[]) || [];

      // Look for header row
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

      const rawDesc = String(values[colDesc] || '').trim();
      const rawDate = values[colDate];
      const incomeVal = Number(values[colIncome]) || 0;
      const expenseVal = Number(values[colExpense]) || 0;
      const mopVal = String(values[colMop] || 'CASH').trim().toUpperCase();

      // Check first row or summary for OPENING BAL
      if (rawDesc.toUpperCase().includes('OPENING BAL') || rawDesc.toUpperCase().includes('OPENING BALANCE')) {
        openingBalance = incomeVal || expenseVal || 0;
        return;
      }

      if (rawDate && (incomeVal > 0 || expenseVal > 0)) {
        let dateStr = '';
        if (rawDate instanceof Date) {
          dateStr = rawDate.toISOString().split('T')[0];
        } else if (typeof rawDate === 'string') {
          if (rawDate.includes('-') && rawDate.split('-')[0].length === 2) {
            const parts = rawDate.split('-');
            dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
          } else {
            dateStr = rawDate.trim();
          }
        }

        const isSalaryAdvance = rawDesc.toUpperCase().startsWith('SA-');
        const employeeName = isSalaryAdvance ? rawDesc.substring(3).trim() : undefined;

        rows.push({
          rowNumber,
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

    return {
      sheetName,
      openingBalance,
      rows,
      duplicatesCount: 0,
      unmatchedDescriptions: [],
    };
  }

  return { sheetNames, parseSheet };
}

// Perform duplicate detection against database transactions
export async function detectLegacyDuplicates(
  rows: LegacyParsedRow[],
  shopId: string,
  supabase: any
): Promise<{ uniqueRows: LegacyParsedRow[]; duplicateRows: LegacyParsedRow[] }> {
  if (rows.length === 0) return { uniqueRows: [], duplicateRows: [] };

  const dates = rows.map((r) => r.date).filter(Boolean).sort();
  const minDate = dates[0];
  const maxDate = dates[dates.length - 1];

  let query = supabase.from('transactions').select('shop_id, txn_date, note, mode_name_snapshot, amount, is_deleted').eq('shop_id', shopId);
  if (minDate) query = query.gte('txn_date', minDate);
  if (maxDate) query = query.lte('txn_date', maxDate);

  const { data: dbTxns } = await query;

  const dbTxnSet = new Set<string>();
  (dbTxns || []).forEach((t: any) => {
    if (!t.is_deleted) {
      const key = `${t.shop_id}|${t.txn_date}|${(t.note || '').trim().toLowerCase()}|${(t.mode_name_snapshot || '').trim().toUpperCase()}|${Number(t.amount)}`;
      dbTxnSet.add(key);
    }
  });

  const uniqueRows: LegacyParsedRow[] = [];
  const duplicateRows: LegacyParsedRow[] = [];

  rows.forEach((r) => {
    const amount = r.income > 0 ? r.income : r.expense;
    const key = `${shopId}|${r.date}|${r.description.trim().toLowerCase()}|${r.mop.trim().toUpperCase()}|${amount}`;
    if (dbTxnSet.has(key)) {
      duplicateRows.push({ ...r, isDuplicate: true });
    } else {
      uniqueRows.push(r);
    }
  });

  return { uniqueRows, duplicateRows };
}

// Match descriptions to items in the brand catalog
export async function matchLegacyItems(
  rows: LegacyParsedRow[],
  brandId: string,
  supabase: any
): Promise<{ matchedRows: LegacyParsedRow[]; unmatchedDescriptions: string[] }> {
  const { data: items } = await supabase
    .from('items')
    .select('id, name')
    .eq('brand_id', brandId);

  const itemMap = new Map<string, string>();
  (items || []).forEach((it: any) => {
    itemMap.set(it.name.trim().toLowerCase(), it.id);
  });

  const unmatchedSet = new Set<string>();

  const matchedRows = rows.map((r) => {
    if (r.isSalaryAdvance) return r;
    const descLower = r.description.trim().toLowerCase();
    const itemId = itemMap.get(descLower);
    if (!itemId) {
      unmatchedSet.add(r.description);
      return r;
    }
    return { ...r, matchedItemId: itemId };
  });

  return {
    matchedRows,
    unmatchedDescriptions: Array.from(unmatchedSet),
  };
}


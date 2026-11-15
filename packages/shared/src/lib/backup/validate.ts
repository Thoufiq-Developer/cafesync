// ==============================================================================
// CafeSync - Framework-Independent Backup Validator
// Dry-run validation of uploaded backups (ZIP or multiple XLSX)
// ==============================================================================

import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import {
  BrandValidationSummary,
  ParsedBackupPayload,
  ParsedBrandData,
  ParsedMonthlyData,
  SheetMeta,
  SheetValidationStats,
  UserToRecreate,
  ValidationError,
  ValidationReport,
} from './types';

// Helper to convert an Excel worksheet row to an object using header values
function parseSheetRows(worksheet: ExcelJS.Worksheet): { headers: string[]; rows: any[] } {
  const headers: string[] = [];
  const rows: any[] = [];

  worksheet.eachRow((row, rowNumber) => {
    const values = (row.values as any[]) || [];
    if (rowNumber === 1) {
      for (let c = 1; c < values.length; c++) {
        headers.push(String(values[c] || '').trim());
      }
      return;
    }

    const rowObj: any = { _rowNumber: rowNumber };
    let hasData = false;

    headers.forEach((h, idx) => {
      let val = values[idx + 1];
      if (val !== undefined && val !== null) {
        if (typeof val === 'object' && val instanceof Date) {
          val = val.toISOString().split('T')[0];
        } else if (typeof val === 'object' && 'text' in val) {
          val = val.text;
        } else if (typeof val === 'string') {
          val = val.trim();
        }
        rowObj[h] = val;
        hasData = true;
      } else {
        rowObj[h] = null;
      }
    });

    if (hasData) {
      rows.push(rowObj);
    }
  });

  return { headers, rows };
}

// Extract _meta from worksheet
function extractSheetMeta(worksheet: ExcelJS.Worksheet): SheetMeta | null {
  const meta: any = {};
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const values = (row.values as any[]) || [];
    const k = values[1];
    const v = values[2];
    if (k) {
      meta[String(k).trim()] = v !== undefined && v !== null ? String(v).trim() : '';
    }
  });

  if (!meta.format_version || !meta.sheet_type) {
    return null;
  }

  return {
    format_version: meta.format_version,
    brand_id: meta.brand_id || '',
    brand_slug: meta.brand_slug || '',
    sheet_type: meta.sheet_type,
    month: meta.month,
    generated_at: meta.generated_at || '',
  };
}

export async function validateBackupFiles(
  files: File[],
  supabase: any
): Promise<ValidationReport> {
  const errors: ValidationError[] = [];
  const usersToRecreate: UserToRecreate[] = [];
  let isLegacy = false;
  let formatVersion = '1.0';

  const payload: ParsedBackupPayload = {
    brands: {},
  };

  // 1. Process files: expand ZIPs or collect XLSX workbooks
  const workbooksToProcess: Array<{
    fileName: string;
    workbook: ExcelJS.Workbook;
    brandSlugHint?: string;
  }> = [];

  const rawAssets: Array<{ brandSlug: string; filename: string; data: Uint8Array; mimeType: string }> = [];

  for (const file of files) {
    const lowerName = file.name.toLowerCase();

    if (lowerName.endsWith('.zip')) {
      const zip = new JSZip();
      const zipContent = await zip.loadAsync(await file.arrayBuffer());

      // Read manifest if present
      const manifestFile = zipContent.file('manifest.json');
      if (manifestFile) {
        try {
          const manifestText = await manifestFile.async('text');
          payload.manifest = JSON.parse(manifestText);
          if (payload.manifest?.format_version) {
            formatVersion = payload.manifest.format_version;
          }
        } catch (e: any) {
          errors.push({
            file: file.name,
            sheet: 'manifest.json',
            row: 0,
            message: `Corrupted manifest.json: ${e.message}`,
            severity: 'error',
          });
        }
      }

      // Read all excel files in zip
      for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
        if (zipEntry.dir) continue;
        const entryLower = relativePath.toLowerCase();

        if (entryLower.endsWith('.xlsx')) {
          const parts = relativePath.split('/');
          const brandSlugHint = parts.length > 1 ? parts[0] : undefined;
          const arrayBuffer = await zipEntry.async('arraybuffer');
          const wb = new ExcelJS.Workbook();
          await wb.xlsx.load(arrayBuffer);
          workbooksToProcess.push({
            fileName: relativePath,
            workbook: wb,
            brandSlugHint,
          });
        } else if (entryLower.includes('/assets/')) {
          const parts = relativePath.split('/');
          const brandSlug = parts[0];
          const assetName = parts[parts.length - 1];
          const data = await zipEntry.async('uint8array');
          rawAssets.push({
            brandSlug,
            filename: assetName,
            data,
            mimeType: assetName.endsWith('.png') ? 'image/png' : 'image/jpeg',
          });
        }
      }
    } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
      const arrayBuffer = await file.arrayBuffer();
      const wb = new ExcelJS.Workbook();
      await wb.xlsx.load(arrayBuffer);
      workbooksToProcess.push({
        fileName: file.name,
        workbook: wb,
      });
    }
  }

  // 2. Parse and categorize worksheets
  for (const { fileName, workbook, brandSlugHint } of workbooksToProcess) {
    const metaSheet = workbook.getWorksheet('_meta');

    if (!metaSheet) {
      // Check if this matches legacy statement format (DATE, DISCRIPTION, MOP, INCOME, EXPENSES)
      let matchedLegacy = false;
      workbook.worksheets.forEach((ws) => {
        let firstRowVals: string[] = [];
        const r1 = ws.getRow(1).values as any[];
        if (r1) {
          firstRowVals = r1.map((v) => String(v || '').trim().toUpperCase());
          if (
            firstRowVals.includes('DATE') &&
            (firstRowVals.some((v) => v.includes('DISCRIPTION') || v.includes('DESCRIPTION'))) &&
            firstRowVals.some((v) => v.includes('INCOME') || v.includes('SALES'))
          ) {
            matchedLegacy = true;
          }
        }
      });

      if (matchedLegacy) {
        isLegacy = true;
      } else {
        errors.push({
          file: fileName,
          sheet: 'Workbook',
          row: 1,
          message: 'Missing hidden "_meta" sheet. File is neither a CafeSync backup nor a recognized legacy statement.',
          severity: 'error',
        });
      }
      continue;
    }

    const sheetMeta = extractSheetMeta(metaSheet);
    if (!sheetMeta) {
      errors.push({
        file: fileName,
        sheet: '_meta',
        row: 1,
        message: 'Invalid or incomplete "_meta" sheet.',
        severity: 'error',
      });
      continue;
    }

    const brandSlug = sheetMeta.brand_slug || brandSlugHint || 'default-brand';
    if (!payload.brands[brandSlug]) {
      payload.brands[brandSlug] = {
        monthlyData: {},
      };
    }

    if (sheetMeta.sheet_type === 'brand-data') {
      const parsedBrandData: ParsedBrandData = {
        meta: sheetMeta,
        brands: [],
        brand_settings: [],
        shops: [],
        profiles: [],
        payment_modes: [],
        items: [],
        employees: [],
        assets: [],
        asset_service_logs: [],
        month_openings: [],
      };

      const tableSheets = [
        'brands', 'brand_settings', 'shops', 'profiles', 'payment_modes',
        'items', 'employees', 'assets', 'asset_service_logs', 'month_openings'
      ];

      tableSheets.forEach((sheetName) => {
        const ws = workbook.getWorksheet(sheetName);
        if (ws) {
          const parsed = parseSheetRows(ws);
          (parsedBrandData as any)[sheetName] = parsed.rows;
        }
      });

      payload.brands[brandSlug].brandData = parsedBrandData;
    } else if (sheetMeta.sheet_type === 'monthly') {
      const month = sheetMeta.month || fileName.replace(/\.xlsx$/i, '');
      const parsedMonthlyData: ParsedMonthlyData = {
        meta: sheetMeta,
        month,
        transactions: [],
        daily_summary: [],
        salary_records: [],
        summary: [],
      };

      const monthlySheets = ['Transactions', 'Daily Summary', 'Salary', 'Summary'];
      monthlySheets.forEach((sheetName) => {
        const ws = workbook.getWorksheet(sheetName);
        if (ws) {
          const parsed = parseSheetRows(ws);
          const key = sheetName.toLowerCase().replace(' ', '_');
          if (key === 'transactions') parsedMonthlyData.transactions = parsed.rows;
          else if (key === 'daily_summary') parsedMonthlyData.daily_summary = parsed.rows;
          else if (key === 'salary') parsedMonthlyData.salary_records = parsed.rows;
          else if (key === 'summary') parsedMonthlyData.summary = parsed.rows;
        }
      });

      payload.brands[brandSlug].monthlyData[month] = parsedMonthlyData;
    }
  }

  // Attach raw assets to brandData
  rawAssets.forEach((ast) => {
    if (payload.brands[ast.brandSlug]?.brandData) {
      if (!payload.brands[ast.brandSlug].brandData!.logos) {
        payload.brands[ast.brandSlug].brandData!.logos = [];
      }
      payload.brands[ast.brandSlug].brandData!.logos!.push({
        filename: ast.filename,
        data: ast.data,
        mimeType: ast.mimeType,
      });
    }
  });

  // 3. Database comparisons and Foreign Key integrity check
  const brandsSummary: Record<string, BrandValidationSummary> = {};
  let totalAdd = 0;
  let totalUpdate = 0;
  let totalUnchanged = 0;
  let totalErrors = 0;

  for (const [brandSlug, brandPayload] of Object.entries(payload.brands)) {
    const brandData = brandPayload.brandData;
    const brandRow = brandData?.brands?.[0];
    const brandId = brandRow?.id || brandData?.meta.brand_id || '';
    const brandName = brandRow?.name || brandSlug;

    // Check if brand exists in database
    let isNewBrand = true;
    if (brandId) {
      const { data: dbBrand } = await supabase.from('brands').select('id').eq('id', brandId).maybeSingle();
      if (dbBrand) isNewBrand = false;
    }

    // Fetch existing records from DB to identify ADD vs UPDATE vs UNCHANGED
    const [
      { data: dbShops },
      { data: dbItems },
      { data: dbPaymentModes },
      { data: dbEmployees },
      { data: dbProfiles },
      { data: dbTransactions },
      { data: dbAssets },
    ] = await Promise.all([
      supabase.from('shops').select('id, brand_id, name, code, is_active').eq('brand_id', brandId),
      supabase.from('items').select('id, brand_id, name, category, unit, default_rate').eq('brand_id', brandId),
      supabase.from('payment_modes').select('id, brand_id, name, code').eq('brand_id', brandId),
      supabase.from('employees').select('id, brand_id, name, phone, monthly_salary').eq('brand_id', brandId),
      supabase.from('profiles').select('id, brand_id, role, full_name, username').eq('brand_id', brandId),
      supabase.from('transactions').select('id, brand_id, amount, txn_date, note').eq('brand_id', brandId),
      supabase.from('assets').select('id, brand_id, name').eq('brand_id', brandId),
    ]);

    const existingShopMap = new Map<string, any>((dbShops || []).map((s: any) => [s.id, s]));
    const existingItemMap = new Map<string, any>((dbItems || []).map((i: any) => [i.id, i]));
    const existingModeMap = new Map<string, any>((dbPaymentModes || []).map((m: any) => [m.id, m]));
    const existingEmpMap = new Map<string, any>((dbEmployees || []).map((e: any) => [e.id, e]));
    const existingProfileMap = new Map<string, any>((dbProfiles || []).map((p: any) => [p.id, p]));
    const existingTxnMap = new Map<string, any>((dbTransactions || []).map((t: any) => [t.id, t]));
    const existingAssetMap = new Map<string, any>((dbAssets || []).map((a: any) => [a.id, a]));

    // Maps for all IDs available (uploaded + db) for FK checks
    const availableShopIds = new Set([...existingShopMap.keys(), ...(brandData?.shops || []).map((s) => s.id)]);
    const availableItemIds = new Set([...existingItemMap.keys(), ...(brandData?.items || []).map((i) => i.id)]);
    const availableModeIds = new Set([...existingModeMap.keys(), ...(brandData?.payment_modes || []).map((m) => m.id)]);
    const availableEmpIds = new Set([...existingEmpMap.keys(), ...(brandData?.employees || []).map((e) => e.id)]);

    const sheetsStats: Record<string, SheetValidationStats> = {};

    function evaluateRows(sheetName: string, rows: any[], dbMap: Map<string, any>, requiredFields: string[]) {
      let add = 0;
      let upd = 0;
      let unc = 0;
      let errCount = 0;
      const seenIds = new Set<string>();

      rows.forEach((r) => {
        const rowNum = r._rowNumber || 2;
        // Check duplicate ID in upload
        if (r.id) {
          if (seenIds.has(r.id)) {
            errors.push({
              file: `${brandSlug}/brand-data.xlsx`,
              sheet: sheetName,
              row: rowNum,
              column: 'id',
              message: `Duplicate ID '${r.id}' within upload.`,
              severity: 'error',
            });
            errCount++;
          }
          seenIds.add(r.id);
        }

        // Check required fields
        for (const rf of requiredFields) {
          if (r[rf] === undefined || r[rf] === null || r[rf] === '') {
            errors.push({
              file: `${brandSlug}/brand-data.xlsx`,
              sheet: sheetName,
              row: rowNum,
              column: rf,
              message: `Missing required field '${rf}'.`,
              severity: 'error',
            });
            errCount++;
          }
        }

        // Check ADD vs UPDATE vs UNCHANGED
        if (!r.id || !dbMap.has(r.id)) {
          add++;
        } else {
          const dbRow = dbMap.get(r.id);
          let hasDiff = false;
          for (const key of Object.keys(r)) {
            if (key.startsWith('_')) continue;
            if (dbRow[key] !== undefined && String(dbRow[key] ?? '') !== String(r[key] ?? '')) {
              hasDiff = true;
              break;
            }
          }
          if (hasDiff) upd++;
          else unc++;
        }
      });

      sheetsStats[sheetName] = {
        sheetName,
        totalRows: rows.length,
        addCount: add,
        updateCount: upd,
        unchangedCount: unc,
        errorCount: errCount,
      };

      totalAdd += add;
      totalUpdate += upd;
      totalUnchanged += unc;
      totalErrors += errCount;
    }

    if (brandData) {
      evaluateRows('brands', brandData.brands, new Map<string, any>(isNewBrand ? [] : [[brandId, brandRow]]), ['id', 'name', 'slug']);
      evaluateRows('brand_settings', brandData.brand_settings, new Map<string, any>(), ['brand_id']);
      evaluateRows('shops', brandData.shops, existingShopMap, ['id', 'name']);
      evaluateRows('payment_modes', brandData.payment_modes, existingModeMap, ['id', 'name']);
      evaluateRows('items', brandData.items, existingItemMap, ['id', 'name']);
      evaluateRows('employees', brandData.employees, existingEmpMap, ['id', 'name']);
      evaluateRows('assets', brandData.assets, existingAssetMap, ['id', 'name']);
      evaluateRows('profiles', brandData.profiles, existingProfileMap, ['id', 'role', 'full_name']);

      // Check profiles missing in auth
      brandData.profiles.forEach((p) => {
        if (!existingProfileMap.has(p.id)) {
          usersToRecreate.push({
            id: p.id,
            brand_id: brandId,
            shop_id: p.shop_id || null,
            role: p.role || 'manager',
            full_name: p.full_name,
            email: p.email || null,
            username: p.username || null,
            phone: p.phone || null,
          });
        }
      });
    }

    // Monthly files validation (Transactions, Salary)
    const monthlyFiles: string[] = [];
    for (const [month, monthData] of Object.entries(brandPayload.monthlyData)) {
      monthlyFiles.push(`${month}.xlsx`);
      let txAdd = 0;
      let txUpd = 0;
      let txUnc = 0;
      let txErr = 0;

      monthData.transactions.forEach((tx) => {
        const rowNum = tx._rowNumber || 2;
        // Check required fields
        if (!tx.id || !tx.shop_id || !tx.txn_date || tx.amount === undefined || tx.amount === null) {
          errors.push({
            file: `${brandSlug}/${month}.xlsx`,
            sheet: 'Transactions',
            row: rowNum,
            message: 'Missing required transaction fields (id, shop_id, txn_date, amount).',
            severity: 'error',
          });
          txErr++;
        }

        // Foreign key check: shop_id
        if (tx.shop_id && !availableShopIds.has(tx.shop_id)) {
          errors.push({
            file: `${brandSlug}/${month}.xlsx`,
            sheet: 'Transactions',
            row: rowNum,
            column: 'shop_id',
            message: `Transaction references unknown shop ID '${tx.shop_id}'.`,
            severity: 'error',
          });
          txErr++;
        }

        // Compare with DB
        if (!existingTxnMap.has(tx.id)) {
          txAdd++;
        } else {
          const dbTx: any = existingTxnMap.get(tx.id);
          if (Number(dbTx?.amount) !== Number(tx.amount) || dbTx?.note !== tx.note) {
            txUpd++;
          } else {
            txUnc++;
          }
        }
      });

      const sheetKey = `Transactions (${month})`;
      sheetsStats[sheetKey] = {
        sheetName: sheetKey,
        totalRows: monthData.transactions.length,
        addCount: txAdd,
        updateCount: txUpd,
        unchangedCount: txUnc,
        errorCount: txErr,
      };

      totalAdd += txAdd;
      totalUpdate += txUpd;
      totalUnchanged += txUnc;
      totalErrors += txErr;
    }

    let brandTotalRows = 0;
    Object.values(sheetsStats).forEach((s) => {
      brandTotalRows += s.totalRows;
    });

    brandsSummary[brandSlug] = {
      brandId,
      brandSlug,
      brandName,
      isNewBrand,
      sheets: sheetsStats,
      monthlyFiles,
      totalRows: brandTotalRows,
      errorsCount: Object.values(sheetsStats).reduce((sum, s) => sum + s.errorCount, 0),
    };
  }

  const isValid = errors.filter((e) => e.severity === 'error').length === 0;

  return {
    isValid,
    isLegacy,
    formatVersion,
    brandsSummary,
    totalAdd,
    totalUpdate,
    totalUnchanged,
    totalErrors,
    errors,
    usersToRecreate,
    payload,
  };
}

// Generate downloadable error report in CSV format
export function generateErrorReportCsv(errors: ValidationError[]): string {
  const headers = ['File', 'Sheet', 'Row', 'Column', 'Severity', 'Message'];
  const rows = errors.map((e) => [
    `"${(e.file || '').replace(/"/g, '""')}"`,
    `"${(e.sheet || '').replace(/"/g, '""')}"`,
    e.row,
    `"${(e.column || '').replace(/"/g, '""')}"`,
    e.severity.toUpperCase(),
    `"${(e.message || '').replace(/"/g, '""')}"`,
  ]);

  return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
}

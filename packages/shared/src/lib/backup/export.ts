// ==============================================================================
// CafeSync - Framework-Independent Backup Generator
// Runs in browser (or Node/Edge) with the logged-in user's Supabase client
// ==============================================================================

import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { calculateSha256 } from './checksum';
import {
  BackupBrandMeta,
  BackupManifest,
  BackupOptions,
  BackupResult,
  SheetMeta,
} from './types';

// Pagination helper to fetch without row caps
async function fetchAllRows<T = any>(
  supabase: any,
  table: string,
  applyFilter: (query: any) => any,
  pageSize = 1000,
  signal?: AbortSignal
): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;

  while (true) {
    if (signal?.aborted) {
      throw new Error('Backup aborted by user.');
    }

    let query = supabase.from(table).select('*').range(from, from + pageSize - 1);
    query = applyFilter(query);

    const { data, error } = await query;
    if (error) {
      // If table doesn't exist, safely return empty
      if (error.code === '42P01') {
        return [];
      }
      throw new Error(`Failed to query table ${table}: ${error.message}`);
    }

    if (!data || data.length === 0) break;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return allRows;
}

// Format header styling in Excel
function setupWorksheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  headers: string[],
  primaryColorHex = '0F172A'
): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: true }] });
  const hRow = sheet.addRow(headers);
  const cleanHex = primaryColorHex.replace('#', '').toUpperCase().padStart(6, '0');
  const argb = `FF${cleanHex}`;

  hRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  hRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  hRow.alignment = { vertical: 'middle', horizontal: 'center' };
  hRow.height = 24;

  sheet.columns = headers.map(() => ({ width: 20 }));
  return sheet;
}

// Add hidden _meta worksheet to preserve metadata & guarantee restore verification
function addMetaWorksheet(workbook: ExcelJS.Workbook, meta: SheetMeta): void {
  const metaSheet = workbook.addWorksheet('_meta');
  metaSheet.state = 'hidden';
  metaSheet.addRow(['key', 'value']);
  Object.entries(meta).forEach(([k, v]) => {
    metaSheet.addRow([k, v !== undefined ? String(v) : '']);
  });
}

// Extract storage relative path or fallback to URL
function extractStoragePath(urlOrPath: string): string | null {
  if (!urlOrPath) return null;
  const match = urlOrPath.match(/brand-assets\/(.+)$/);
  if (match && match[1]) {
    return decodeURIComponent(match[1].split('?')[0]);
  }
  if (!urlOrPath.startsWith('http://') && !urlOrPath.startsWith('https://')) {
    return urlOrPath;
  }
  return null;
}

export async function exportBackup(
  supabase: any,
  options: BackupOptions
): Promise<BackupResult> {
  const { scope, brandId, monthRange, includeLogos = true, onProgress, abortSignal } = options;

  onProgress?.('Initializing backup and authenticating...', 5);

  // 1. Resolve current user
  let currentUserId = 'system';
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      currentUserId = authData.user.id;
    }
  } catch {
    // Fallback to system for service role or script execution
  }

  // 2. Resolve Brands
  onProgress?.('Discovering brands and configuration...', 10);
  let brandsQuery = supabase.from('brands').select('*');
  if (scope === 'brand' && brandId) {
    brandsQuery = brandsQuery.eq('id', brandId);
  }
  const { data: brands, error: brandsErr } = await brandsQuery.order('name', { ascending: true });
  if (brandsErr) throw new Error(`Failed to fetch brands: ${brandsErr.message}`);
  if (!brands || brands.length === 0) {
    throw new Error('No brands found to backup.');
  }

  const zip = new JSZip();
  const manifestBrands: BackupBrandMeta[] = [];
  const rowCounts: Record<string, Record<string, number>> = {};
  const checksums: Record<string, string> = {};

  const totalBrands = brands.length;
  let brandIndex = 0;

  for (const brand of brands) {
    if (abortSignal?.aborted) throw new Error('Backup cancelled by user.');

    brandIndex++;
    const brandSlug = brand.slug || brand.id;
    manifestBrands.push({
      id: brand.id,
      name: brand.name,
      slug: brandSlug,
      registration_no: brand.registration_no,
    });
    rowCounts[brandSlug] = {};

    const brandFolder = zip.folder(brandSlug);
    if (!brandFolder) continue;

    const brandProgressBase = 15 + Math.floor((brandIndex - 1) / totalBrands * 75);
    onProgress?.(`[Brand ${brand.name}] Fetching configuration and masters...`, brandProgressBase);

    // --------------------------------------------------------------------------
    // A. FETCH BRAND-LEVEL MASTER DATA
    // --------------------------------------------------------------------------
    const [
      brandSettings,
      shops,
      profiles,
      paymentModes,
      items,
      employees,
      assets,
      assetLogs,
      monthOpenings,
    ] = await Promise.all([
      fetchAllRows(supabase, 'brand_settings', (q) => q.eq('brand_id', brand.id), 1000, abortSignal),
      fetchAllRows(supabase, 'shops', (q) => q.eq('brand_id', brand.id), 1000, abortSignal),
      fetchAllRows(supabase, 'profiles', (q) => q.eq('brand_id', brand.id), 1000, abortSignal),
      fetchAllRows(supabase, 'payment_modes', (q) => q.eq('brand_id', brand.id), 1000, abortSignal),
      fetchAllRows(supabase, 'items', (q) => q.eq('brand_id', brand.id), 1000, abortSignal),
      fetchAllRows(supabase, 'employees', (q) => q.eq('brand_id', brand.id), 1000, abortSignal),
      fetchAllRows(supabase, 'assets', (q) => q.eq('brand_id', brand.id), 1000, abortSignal),
      fetchAllRows(supabase, 'asset_service_logs', (q) => q, 1000, abortSignal), // filter by brand assets below
      fetchAllRows(supabase, 'month_openings', (q) => q, 1000, abortSignal), // filter by brand shops below
    ]);

    const shopIds = new Set(shops.map((s: any) => s.id));
    const assetIds = new Set(assets.map((a: any) => a.id));

    const brandMonthOpenings = monthOpenings.filter((m: any) => shopIds.has(m.shop_id));
    const brandAssetLogs = assetLogs.filter((al: any) => assetIds.has(al.asset_id));

    // Strip passwords and sensitive hashes from profiles
    const sanitizedProfiles = profiles.map((p: any) => ({
      id: p.id,
      brand_id: p.brand_id,
      shop_id: p.shop_id,
      role: p.role,
      full_name: p.full_name,
      username: p.username || '',
      phone: p.phone || '',
      is_active: p.is_active ?? true,
      must_change_password: p.must_change_password ?? false,
      created_at: p.created_at || '',
    }));

    // Build brand-data.xlsx
    const brandDataWb = new ExcelJS.Workbook();
    brandDataWb.creator = 'CafeSync';
    brandDataWb.created = new Date();

    const brandMeta: SheetMeta = {
      format_version: '1.0',
      brand_id: brand.id,
      brand_slug: brandSlug,
      sheet_type: 'brand-data',
      generated_at: new Date().toISOString(),
    };
    addMetaWorksheet(brandDataWb, brandMeta);

    // Sheet: brands
    const wsBrands = setupWorksheet(brandDataWb, 'brands', [
      'id', 'name', 'slug', 'registration_no', 'address', 'phone', 'email', 'gstin', 'status', 'created_at'
    ]);
    wsBrands.addRow([
      brand.id, brand.name, brand.slug, brand.registration_no || '', brand.address || '',
      brand.phone || '', brand.email || '', brand.gstin || '', brand.status || 'active', brand.created_at || ''
    ]);
    rowCounts[brandSlug]['brands'] = 1;

    // Sheet: brand_settings
    const wsSettings = setupWorksheet(brandDataWb, 'brand_settings', [
      'brand_id', 'display_name', 'primary_color', 'secondary_color', 'accent_color',
      'logo_url', 'logo_dark_url', 'icon_url', 'sidebar_style', 'created_at'
    ]);
    brandSettings.forEach((bs: any) => {
      wsSettings.addRow([
        bs.brand_id, bs.display_name || '', bs.primary_color || '', bs.secondary_color || '', bs.accent_color || '',
        bs.logo_url || '', bs.logo_dark_url || '', bs.icon_url || '', bs.sidebar_style || '', bs.created_at || ''
      ]);
    });
    rowCounts[brandSlug]['brand_settings'] = brandSettings.length;

    // Sheet: shops
    const wsShops = setupWorksheet(brandDataWb, 'shops', [
      'id', 'brand_id', 'name', 'code', 'address', 'phone', 'status', 'is_active', 'created_at'
    ]);
    shops.forEach((s: any) => {
      wsShops.addRow([
        s.id, s.brand_id, s.name, s.code || '', s.address || '', s.phone || '',
        s.status || 'active', s.is_active ?? true, s.created_at || ''
      ]);
    });
    rowCounts[brandSlug]['shops'] = shops.length;

    // Sheet: profiles
    const wsProfiles = setupWorksheet(brandDataWb, 'profiles', [
      'id', 'brand_id', 'shop_id', 'role', 'full_name', 'username', 'phone', 'is_active', 'must_change_password', 'created_at'
    ]);
    sanitizedProfiles.forEach((p: any) => {
      wsProfiles.addRow([
        p.id, p.brand_id, p.shop_id || '', p.role, p.full_name, p.username,
        p.phone, p.is_active, p.must_change_password, p.created_at
      ]);
    });
    rowCounts[brandSlug]['profiles'] = sanitizedProfiles.length;

    // Sheet: payment_modes
    const wsPaymentModes = setupWorksheet(brandDataWb, 'payment_modes', [
      'id', 'brand_id', 'name', 'code', 'is_active', 'created_at'
    ]);
    paymentModes.forEach((pm: any) => {
      wsPaymentModes.addRow([pm.id, pm.brand_id, pm.name, pm.code || '', pm.is_active ?? true, pm.created_at || '']);
    });
    rowCounts[brandSlug]['payment_modes'] = paymentModes.length;

    // Sheet: items
    const wsItems = setupWorksheet(brandDataWb, 'items', [
      'id', 'brand_id', 'shop_id', 'name', 'category', 'unit', 'default_rate', 'is_active', 'created_at'
    ]);
    items.forEach((it: any) => {
      wsItems.addRow([
        it.id, it.brand_id, it.shop_id || '', it.name, it.category || '',
        it.unit || 'pcs', it.default_rate !== null ? Number(it.default_rate) : '',
        it.is_active ?? true, it.created_at || ''
      ]);
    });
    rowCounts[brandSlug]['items'] = items.length;

    // Sheet: employees
    const wsEmployees = setupWorksheet(brandDataWb, 'employees', [
      'id', 'brand_id', 'shop_id', 'name', 'role', 'phone', 'monthly_salary', 'is_active', 'created_at'
    ]);
    employees.forEach((emp: any) => {
      wsEmployees.addRow([
        emp.id, emp.brand_id, emp.shop_id || '', emp.name, emp.role || '',
        emp.phone || '', Number(emp.monthly_salary) || 0, emp.is_active ?? true, emp.created_at || ''
      ]);
    });
    rowCounts[brandSlug]['employees'] = employees.length;

    // Sheet: assets
    const wsAssets = setupWorksheet(brandDataWb, 'assets', [
      'id', 'brand_id', 'shop_id', 'name', 'serial_number', 'category',
      'purchase_date', 'purchase_cost', 'status', 'vendor_name', 'vendor_phone', 'warranty_expiry', 'created_at'
    ]);
    assets.forEach((ast: any) => {
      wsAssets.addRow([
        ast.id, ast.brand_id, ast.shop_id || '', ast.name, ast.serial_number || '', ast.category || '',
        ast.purchase_date || '', ast.purchase_cost !== null ? Number(ast.purchase_cost) : '',
        ast.status || 'operational', ast.vendor_name || '', ast.vendor_phone || '',
        ast.warranty_expiry || '', ast.created_at || ''
      ]);
    });
    rowCounts[brandSlug]['assets'] = assets.length;

    // Sheet: asset_service_logs
    const wsLogs = setupWorksheet(brandDataWb, 'asset_service_logs', [
      'id', 'asset_id', 'service_date', 'service_type', 'cost', 'performed_by', 'notes', 'next_service_due', 'created_at'
    ]);
    brandAssetLogs.forEach((log: any) => {
      wsLogs.addRow([
        log.id, log.asset_id, log.service_date || '', log.service_type || '',
        log.cost !== null ? Number(log.cost) : '', log.performed_by || '', log.notes || '',
        log.next_service_due || '', log.created_at || ''
      ]);
    });
    rowCounts[brandSlug]['asset_service_logs'] = brandAssetLogs.length;

    // Sheet: month_openings
    const wsOpenings = setupWorksheet(brandDataWb, 'month_openings', [
      'id', 'shop_id', 'month', 'opening_balance', 'is_manual', 'note', 'closed_at', 'closed_by', 'created_at'
    ]);
    brandMonthOpenings.forEach((mo: any) => {
      wsOpenings.addRow([
        mo.id, mo.shop_id, mo.month || mo.year_month, Number(mo.opening_balance) || 0,
        mo.is_manual ?? false, mo.note || '', mo.closed_at || '', mo.closed_by || '', mo.created_at || ''
      ]);
    });
    rowCounts[brandSlug]['month_openings'] = brandMonthOpenings.length;

    // Save brand-data.xlsx into zip
    const brandDataBuffer = await brandDataWb.xlsx.writeBuffer();
    const brandDataUint8 = new Uint8Array(brandDataBuffer);
    const brandDataPath = `${brandSlug}/brand-data.xlsx`;
    brandFolder.file('brand-data.xlsx', brandDataUint8);
    checksums[brandDataPath] = await calculateSha256(brandDataUint8);

    // --------------------------------------------------------------------------
    // B. FETCH AND PACKAGE ASSETS (LOGOS/FAVICONS)
    // --------------------------------------------------------------------------
    if (includeLogos && brandSettings.length > 0) {
      const bs = brandSettings[0];
      const assetsFolder = brandFolder.folder('assets');
      const assetUrls = [
        { key: 'logo', url: bs.logo_url },
        { key: 'logo_dark', url: bs.logo_dark_url },
        { key: 'icon', url: bs.icon_url },
      ];

      for (const item of assetUrls) {
        if (!item.url) continue;
        try {
          const path = extractStoragePath(item.url);
          let blobData: Uint8Array | null = null;
          let filename = `${item.key}.png`;

          if (path) {
            const ext = path.split('.').pop() || 'png';
            filename = `${item.key}.${ext}`;
            const { data, error } = await supabase.storage.from('brand-assets').download(path);
            if (!error && data) {
              const arrayBuf = await data.arrayBuffer();
              blobData = new Uint8Array(arrayBuf);
            }
          }

          if (!blobData && (item.url.startsWith('http://') || item.url.startsWith('https://'))) {
            const resp = await fetch(item.url);
            if (resp.ok) {
              const arrayBuf = await resp.arrayBuffer();
              blobData = new Uint8Array(arrayBuf);
            }
          }

          if (blobData && assetsFolder) {
            assetsFolder.file(filename, blobData);
            const assetPath = `${brandSlug}/assets/${filename}`;
            checksums[assetPath] = await calculateSha256(blobData);
          }
        } catch (e) {
          console.warn(`Could not export asset for brand ${brandSlug}:`, e);
        }
      }
    }

    // --------------------------------------------------------------------------
    // C. MONTHLY WORKBOOKS: YYYY-MM.xlsx
    // --------------------------------------------------------------------------
    onProgress?.(`[Brand ${brand.name}] Fetching monthly financial transactions...`, brandProgressBase + 10);

    // Fetch all transactions for this brand
    const allTransactions = await fetchAllRows(
      supabase,
      'transactions',
      (q) => {
        let res = q.eq('brand_id', brand.id);
        if (monthRange?.start) {
          res = res.gte('txn_date', `${monthRange.start}-01`);
        }
        if (monthRange?.end) {
          res = res.lte('txn_date', `${monthRange.end}-31`);
        }
        return res;
      },
      1000,
      abortSignal
    );

    // Fetch daily summary for brand shops
    const allDailySummary = await fetchAllRows(
      supabase,
      'daily_summary',
      (q) => {
        let res = q;
        if (monthRange?.start) {
          res = res.gte('summary_date', `${monthRange.start}-01`);
        }
        if (monthRange?.end) {
          res = res.lte('summary_date', `${monthRange.end}-31`);
        }
        return res;
      },
      1000,
      abortSignal
    );
    const brandDailySummary = allDailySummary.filter((d: any) => shopIds.has(d.shop_id));

    // Fetch salary records for brand shops
    const allSalaryRecords = await fetchAllRows(
      supabase,
      'salary_records',
      (q) => {
        let res = q;
        if (monthRange?.start) {
          res = res.gte('month', monthRange.start);
        }
        if (monthRange?.end) {
          res = res.lte('month', monthRange.end);
        }
        return res;
      },
      1000,
      abortSignal
    );
    const brandSalaryRecords = allSalaryRecords.filter((sr: any) => shopIds.has(sr.shop_id));

    // Group records by YYYY-MM
    const monthsSet = new Set<string>();
    allTransactions.forEach((t: any) => {
      if (t.txn_date) monthsSet.add(t.txn_date.slice(0, 7));
    });
    brandDailySummary.forEach((d: any) => {
      if (d.summary_date) monthsSet.add(d.summary_date.slice(0, 7));
    });
    brandSalaryRecords.forEach((sr: any) => {
      if (sr.month) monthsSet.add(sr.month.slice(0, 7));
    });

    const sortedMonths = Array.from(monthsSet).sort();

    // Map shops by ID for readable summary
    const shopMap = new Map<string, any>(shops.map((s: any) => [s.id, s]));

    for (let mIdx = 0; mIdx < sortedMonths.length; mIdx++) {
      if (abortSignal?.aborted) throw new Error('Backup cancelled by user.');

      const month = sortedMonths[mIdx];
      const mProgress = brandProgressBase + 10 + Math.floor((mIdx / sortedMonths.length) * 20);
      onProgress?.(`[Brand ${brand.name}] Packaging month ${month}...`, mProgress);

      const monthTxns = allTransactions.filter((t: any) => t.txn_date && t.txn_date.startsWith(month));
      const monthDaily = brandDailySummary.filter((d: any) => d.summary_date && d.summary_date.startsWith(month));
      const monthSalary = brandSalaryRecords.filter((sr: any) => sr.month === month);

      const monthWb = new ExcelJS.Workbook();
      monthWb.creator = 'CafeSync';
      monthWb.created = new Date();

      const monthlyMeta: SheetMeta = {
        format_version: '1.0',
        brand_id: brand.id,
        brand_slug: brandSlug,
        sheet_type: 'monthly',
        month,
        generated_at: new Date().toISOString(),
      };
      addMetaWorksheet(monthWb, monthlyMeta);

      // 1. Transactions Sheet
      const wsTxns = setupWorksheet(monthWb, 'Transactions', [
        'id', 'brand_id', 'shop_id', 'txn_date', 'kind', 'txn_type', 'category',
        'item_id', 'item_name_snapshot', 'quantity', 'unit_snapshot', 'rate',
        'employee_id', 'payment_mode_id', 'mode_name_snapshot', 'amount',
        'note', 'receipt_url', 'is_deleted', 'created_by', 'created_at'
      ]);

      monthTxns.forEach((t: any) => {
        wsTxns.addRow([
          t.id, t.brand_id, t.shop_id, t.txn_date, t.kind, t.txn_type || 'normal', t.category || '',
          t.item_id || '', t.item_name_snapshot || '',
          t.quantity !== null && t.quantity !== undefined ? Number(t.quantity) : '',
          t.unit_snapshot || '',
          t.rate !== null && t.rate !== undefined ? Number(t.rate) : '',
          t.employee_id || '', t.payment_mode_id || '', t.mode_name_snapshot || '',
          Number(t.amount) || 0, t.note || '', t.receipt_url || '',
          t.is_deleted ?? false, t.created_by || '', t.created_at || ''
        ]);
      });

      // 2. Daily Summary Sheet (informational)
      const wsDaily = setupWorksheet(monthWb, 'Daily Summary', [
        'id', 'shop_id', 'summary_date', 'income', 'expense', 'net', 'cumulative_balance', 'created_at'
      ]);
      monthDaily.forEach((d: any) => {
        wsDaily.addRow([
          d.id, d.shop_id, d.summary_date, Number(d.income) || 0,
          Number(d.expense) || 0, Number(d.net) || 0,
          Number(d.cumulative_balance) || 0, d.created_at || ''
        ]);
      });

      // 3. Salary Sheet
      const wsSalary = setupWorksheet(monthWb, 'Salary', [
        'id', 'shop_id', 'employee_id', 'month', 'base_salary', 'advance_paid', 'net_payable', 'status', 'paid_at', 'note', 'created_at'
      ]);
      monthSalary.forEach((sr: any) => {
        wsSalary.addRow([
          sr.id, sr.shop_id, sr.employee_id, sr.month, Number(sr.base_salary) || 0,
          Number(sr.advance_paid) || 0, Number(sr.net_payable) || 0,
          sr.status || 'pending', sr.paid_at || '', sr.note || '', sr.created_at || ''
        ]);
      });

      // 4. Summary Sheet (Readable per shop)
      const wsSummary = setupWorksheet(monthWb, 'Summary', [
        'Shop Code', 'Shop Name', 'Opening Balance', 'Total Income', 'Total Expense', 'Net Profit/Loss', 'Closing Balance'
      ]);

      shops.forEach((s: any) => {
        const sTxns = monthTxns.filter((t: any) => t.shop_id === s.id && !t.is_deleted);
        const openingRecord = brandMonthOpenings.find((mo: any) => mo.shop_id === s.id && (mo.month === month || mo.year_month === month));
        const opening = Number(openingRecord?.opening_balance) || 0;
        const income = sTxns.filter((t: any) => t.kind === 'income').reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
        const expense = sTxns.filter((t: any) => t.kind === 'expense').reduce((sum: number, t: any) => sum + (Number(t.amount) || 0), 0);
        const net = income - expense;
        const closing = opening + net;

        wsSummary.addRow([
          s.code || '', s.name, opening, income, expense, net, closing
        ]);
      });

      // Track counts
      rowCounts[brandSlug][`${month}_transactions`] = monthTxns.length;
      rowCounts[brandSlug][`${month}_daily_summary`] = monthDaily.length;
      rowCounts[brandSlug][`${month}_salary`] = monthSalary.length;

      // Save YYYY-MM.xlsx to ZIP
      const monthBuf = await monthWb.xlsx.writeBuffer();
      const monthUint8 = new Uint8Array(monthBuf);
      const monthFileName = `${month}.xlsx`;
      brandFolder.file(monthFileName, monthUint8);

      const monthFilePath = `${brandSlug}/${monthFileName}`;
      checksums[monthFilePath] = await calculateSha256(monthUint8);
    }
  }

  // ----------------------------------------------------------------------------
  // D. MANIFEST GENERATION & ZIP PACKAGING
  // ----------------------------------------------------------------------------
  onProgress?.('Generating manifest and calculating integrity checksums...', 92);

  const manifest: BackupManifest = {
    format_version: '1.0',
    created_at: new Date().toISOString(),
    created_by: currentUserId,
    scope,
    brands: manifestBrands,
    date_range: monthRange?.start && monthRange?.end
      ? `${monthRange.start} to ${monthRange.end}`
      : 'All available history',
    row_counts: rowCounts,
    checksums,
  };

  const manifestJson = JSON.stringify(manifest, null, 2);
  zip.file('manifest.json', manifestJson);

  onProgress?.('Compressing backup archive...', 96);
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  // Filename format: CafeSync-Backup_{all|brand-slug}_{YYYY-MM-DD_HHmm}.zip
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  const targetTag = scope === 'all'
    ? 'all'
    : (manifestBrands[0]?.slug || 'brand');
  const filename = `CafeSync-Backup_${targetTag}_${dateStr}_${timeStr}.zip`;

  // ----------------------------------------------------------------------------
  // E. LOG TO BACKUP_LOG & AUDIT_LOG TABLE
  // ----------------------------------------------------------------------------
  try {
    const singleBrandId = scope === 'brand' && manifestBrands.length === 1 ? manifestBrands[0].id : null;
    await supabase.from('backup_log').insert({
      created_by: currentUserId,
      scope,
      brand_id: singleBrandId,
      date_range: manifest.date_range,
      file_size: zipBlob.size,
      row_counts: rowCounts,
    });
  } catch (err) {
    console.warn('Could not record in backup_log:', err);
  }

  try {
    await supabase.from('audit_log').insert({
      user_id: currentUserId,
      action: 'EXPORT_BACKUP',
      table_name: 'backup_log',
      record_id: scope === 'brand' ? manifestBrands[0]?.id : 'platform',
      new_data: {
        filename,
        scope,
        file_size: zipBlob.size,
        brands_count: manifestBrands.length,
      },
    });
  } catch (err) {
    console.warn('Could not record in audit_log:', err);
  }

  onProgress?.('Backup completed successfully!', 100);

  return {
    blob: zipBlob,
    filename,
    manifest,
    fileSize: zipBlob.size,
  };
}

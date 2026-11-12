import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getCurrentUserContext } from '@/lib/auth';
import { getTodayKolkata } from '@/lib/calculations/dates';
import { DEMO_ADMIN_SHOPS } from '@/lib/demo-admin-data';
import { DEMO_ITEMS, DEMO_PAYMENT_MODES, DEMO_EMPLOYEES, DEMO_ASSETS } from '@/lib/demo-shop-data';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserContext();
    if (!user || user.role !== 'admin' || !user.brandId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isLive = isSupabaseConfigured();
    const supabase = await createClient();
    const brandId = user.brandId;
    const brandName = user.brand?.name || 'CafeLedger Brand';
    const primaryColorHex = user.brand?.primary_color?.replace('#', '') || 'EA580C';
    const headerArgb = `FF${primaryColorHex.toUpperCase()}`;

    // 1. Fetch all data across brand
    const [
      { data: dbShops },
      { data: dbTransactions },
      { data: dbEmployees },
      { data: dbSalaryRecords },
      { data: dbAssets },
      { data: dbItems },
      { data: dbPaymentModes },
    ] = await Promise.all([
      supabase.from('shops').select('*').eq('brand_id', brandId),
      supabase.from('transactions').select('*').eq('brand_id', brandId).limit(5000),
      supabase.from('employees').select('*').eq('brand_id', brandId),
      supabase.from('salary_records').select('*, shops!inner(brand_id)').eq('shops.brand_id', brandId).limit(2000),
      supabase.from('assets').select('*').eq('brand_id', brandId),
      supabase.from('items').select('*').eq('brand_id', brandId),
      supabase.from('payment_modes').select('*').eq('brand_id', brandId),
    ]);

    // Fallbacks if empty (demo mode only)
    const shops = dbShops && dbShops.length > 0 ? dbShops : (isLive ? [] : DEMO_ADMIN_SHOPS);
    const items = dbItems && dbItems.length > 0 ? dbItems : (isLive ? [] : DEMO_ITEMS);
    const paymentModes = dbPaymentModes && dbPaymentModes.length > 0 ? dbPaymentModes : (isLive ? [] : DEMO_PAYMENT_MODES);
    const employees = dbEmployees && dbEmployees.length > 0 ? dbEmployees : (isLive ? [] : DEMO_EMPLOYEES);
    const assets = dbAssets && dbAssets.length > 0 ? dbAssets : (isLive ? [] : DEMO_ASSETS);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CafeLedger';
    workbook.created = new Date();

    const headerFill: ExcelJS.FillPattern = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: headerArgb },
    };

    const headerFont: Partial<ExcelJS.Font> = {
      name: 'Calibri',
      size: 11,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };

    // Helper to format table headers
    function setupSheet(sheetName: string, headers: string[]) {
      const sheet = workbook.addWorksheet(sheetName, { views: [{ showGridLines: true }] });
      const hRow = sheet.addRow(headers);
      hRow.font = headerFont;
      hRow.fill = headerFill;
      hRow.alignment = { vertical: 'middle', horizontal: 'center' };
      hRow.height = 24;
      return sheet;
    }

    // SHEET 1: SHOPS
    const sheetShops = setupSheet('Shops', ['Shop ID', 'Name', 'Code', 'Address', 'Phone', 'Status', 'Created At']);
    shops.forEach((s: any) => {
      sheetShops.addRow([s.id, s.name, s.code, s.address || '', s.phone || '', s.status, s.created_at || '']);
    });
    sheetShops.columns.forEach((col) => { col.width = 22; });

    // SHEET 2: TRANSACTIONS
    const sheetTxns = setupSheet('Transactions', [
      'Txn ID', 'Shop ID', 'Date', 'Kind', 'Item Name', 'MOP', 'Amount', 'Type', 'Note', 'Created By', 'Created At'
    ]);
    const txns = dbTransactions || [];
    txns.forEach((t: any) => {
      sheetTxns.addRow([
        t.id, t.shop_id, t.txn_date, t.kind, t.item_name_snapshot, t.mode_name_snapshot,
        Number(t.amount), t.txn_type, t.note || '', t.created_by || '', t.created_at
      ]);
    });
    sheetTxns.columns.forEach((col, idx) => { col.width = idx === 6 ? 16 : 20; });

    // SHEET 3: EMPLOYEES
    const sheetEmps = setupSheet('Employees', ['Employee ID', 'Shop ID', 'Name', 'Phone', 'Role', 'Rate/Day', 'Active']);
    employees.forEach((e: any) => {
      sheetEmps.addRow([e.id, e.shop_id || '', e.name, e.phone || '', e.role_title || '', Number(e.rate_per_day), e.is_active ? 'YES' : 'NO']);
    });
    sheetEmps.columns.forEach((col) => { col.width = 20; });

    // SHEET 4: SALARY RECORDS
    const sheetSal = setupSheet('Salary Records', ['Record ID', 'Shop ID', 'Employee ID', 'Month', 'Days Worked', 'Rate', 'Gross', 'Advances', 'Paid', 'Balance']);
    (dbSalaryRecords || []).forEach((sr: any) => {
      sheetSal.addRow([
        sr.id, sr.shop_id, sr.employee_id, sr.month, Number(sr.days_worked), Number(sr.rate_snapshot),
        Number(sr.gross), Number(sr.advances_total), Number(sr.paid_total), Number(sr.balance)
      ]);
    });
    sheetSal.columns.forEach((col) => { col.width = 18; });

    // SHEET 5: ASSETS
    const sheetAssets = setupSheet('Assets', ['Asset ID', 'Shop ID', 'Name', 'Category', 'Model', 'Serial No', 'Purchase Date', 'Cost', 'Vendor', 'Status', 'Last Service', 'Interval (Days)', 'Next Due', 'Notes']);
    assets.forEach((a: any) => {
      sheetAssets.addRow([
        a.id, a.shop_id || '', a.name, a.category, a.model || '', a.serial_no || '', a.purchase_date || '',
        a.cost ? Number(a.cost) : '', a.vendor || '', a.status, a.last_service_date || '', a.service_interval_days || 90,
        a.next_service_due || '', a.notes || ''
      ]);
    });
    sheetAssets.columns.forEach((col) => { col.width = 20; });

    // SHEET 6: ITEMS
    const sheetItems = setupSheet('Catalog Items', ['Item ID', 'Name', 'Kind', 'Category', 'Active']);
    items.forEach((i: any) => {
      sheetItems.addRow([i.id, i.name, i.kind, i.category, i.is_active ? 'YES' : 'NO']);
    });
    sheetItems.columns.forEach((col) => { col.width = 22; });

    // SHEET 7: PAYMENT MODES
    const sheetMop = setupSheet('Payment Modes', ['Mode ID', 'Name', 'Active']);
    paymentModes.forEach((m: any) => {
      sheetMop.addRow([m.id, m.name, m.is_active ? 'YES' : 'NO']);
    });
    sheetMop.columns.forEach((col) => { col.width = 22; });

    const buffer = await workbook.xlsx.writeBuffer();
    const today = getTodayKolkata();
    const filename = `CafeLedger_Full_Backup_${brandName.replace(/\s+/g, '_')}_${today}.xlsx`;

    // Audit backup download
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'DOWNLOAD_BACKUP',
      table_name: 'brands',
      record_id: brandId,
      new_data: { filename, downloaded_at: new Date().toISOString() },
    } as any);

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Backup generation error:', error);
    return NextResponse.json({ error: error.message || 'Backup generation failed' }, { status: 500 });
  }
}


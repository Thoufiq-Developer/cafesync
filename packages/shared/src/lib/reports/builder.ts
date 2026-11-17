import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getBrandThemeById } from '@/lib/theme/server';
import { DEMO_BRAND, DEMO_USERS } from '@/lib/demo-data';
import { DEMO_ADMIN_SHOPS } from '@/lib/demo-admin-data';
import { DEMO_EMPLOYEES, DEMO_ITEMS, DEMO_PAYMENT_MODES } from '@/lib/demo-shop-data';
import { resolvePdfSafeLogoDataUri } from './logo-helper';
import {
  ReportData,
  ReportDailySummaryRow,
  ReportTransactionRow,
  ReportSalaryRow,
  ReportExpenseCategoryRow,
  ReportKindOption,
} from './types';
import {
  fetchAllGroupedItemDetailsForExport,
  fetchItemWiseSummary,
} from './item-wise';
import { formatDate } from '@/lib/calculations/dates';
import { calculatePeriodSummary } from '@/lib/calculations/financials';

export async function buildReportData(params: {
  shopId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  month?: string;    // YYYY-MM
  reportType?: ReportKindOption;
  includeItemDetails?: boolean;
}): Promise<ReportData | null> {
  if (!isSupabaseConfigured()) {
    let activeUserBrandId: string | null = null;
    const currentUser: any = null;

    const demoUserMatch = Object.values(DEMO_USERS).find(
      (u) =>
        u.shop?.id === params.shopId &&
        (!activeUserBrandId || u.brand?.id === activeUserBrandId)
    );
    const adminShopMatch = DEMO_ADMIN_SHOPS.find(
      (s) =>
        s.id === params.shopId &&
        (!activeUserBrandId || s.brand_id === activeUserBrandId)
    );
    const matchedShop =
      adminShopMatch ||
      demoUserMatch?.shop ||
      DEMO_ADMIN_SHOPS.find((s) => s.id === params.shopId);

    const shopBrandId =
      activeUserBrandId ||
      adminShopMatch?.brand_id ||
      demoUserMatch?.brand?.id ||
      DEMO_BRAND.id;

    const bundle = await getBrandThemeById(shopBrandId);
    const pdfSafeLogo = await resolvePdfSafeLogoDataUri(bundle.settings.logo_url, shopBrandId);

    const shopName = matchedShop?.name || `${bundle.settings.display_name} Main Outlet`;
    const shopCode = matchedShop?.code || 'OUTLET-01';
    const shopAddress: string =
      adminShopMatch?.address ||
      bundle.brand.address ||
      'Outlet Counter';

    const dailySummaries: ReportDailySummaryRow[] = [
      {
        date: formatDate(params.startDate),
        opening: 25000,
        income: 28450,
        expense: 11200,
        net: 17250,
        closing: 42250,
      },
      {
        date: formatDate(params.endDate),
        opening: 42250,
        income: 31900,
        expense: 12800,
        net: 19100,
        closing: 61350,
      },
    ];

    const summary = calculatePeriodSummary({
      openingBalance: dailySummaries[0].opening,
      totalIncome: dailySummaries.reduce((acc, r) => acc + r.income, 0),
      totalExpense: dailySummaries.reduce((acc, r) => acc + r.expense, 0),
    });

    const cashMode = DEMO_PAYMENT_MODES[0]?.name || 'CASH';
    const gpayMode = DEMO_PAYMENT_MODES[1]?.name || 'GPAY';
    const bankMode = DEMO_PAYMENT_MODES[2]?.name || 'BANK';

    const demoSeedRows: Array<{
      date: string;
      item: string;
      note: string;
      mop: string;
      kind: 'income' | 'expense';
      amount: number;
    }> = [
      {
        date: params.startDate,
        item: DEMO_ITEMS[0]?.name || 'Counter Billing',
        note: 'Afternoon counter cash collection',
        mop: cashMode,
        kind: 'income',
        amount: 16450,
      },
      {
        date: params.startDate,
        item: DEMO_ITEMS[1]?.name || 'Swiggy Online',
        note: 'Weekly payout settlement',
        mop: bankMode,
        kind: 'income',
        amount: 12000,
      },
      {
        date: params.startDate,
        item: DEMO_ITEMS[5]?.name || 'Fresh Milk & Cream',
        note: 'Morning dairy batch',
        mop: cashMode,
        kind: 'expense',
        amount: 3400,
      },
      {
        date: params.startDate,
        item: DEMO_ITEMS[6]?.name || 'Specialty Coffee Beans',
        note: 'Roastery restock 5kg',
        mop: bankMode,
        kind: 'expense',
        amount: 6300,
      },
      {
        date: params.startDate,
        item: 'Salary Advance',
        note: 'SA-Suresh Kumar',
        mop: cashMode,
        kind: 'expense',
        amount: 1500,
      },
      {
        date: params.endDate,
        item: DEMO_ITEMS[0]?.name || 'Counter Billing',
        note: 'UPI QR & Walk-in orders',
        mop: gpayMode,
        kind: 'income',
        amount: 31900,
      },
      {
        date: params.endDate,
        item: DEMO_ITEMS[10]?.name || 'Takeaway Cups & Packaging',
        note: 'Cup sleeves and carrier bags',
        mop: bankMode,
        kind: 'expense',
        amount: 4800,
      },
      {
        date: params.endDate,
        item: DEMO_ITEMS[11]?.name || 'Commercial Gas Cylinder',
        note: '2 cylinders refill',
        mop: cashMode,
        kind: 'expense',
        amount: 8000,
      },
    ];

    const transactions: ReportTransactionRow[] = demoSeedRows.map((t) => ({
      date: formatDate(t.date),
      description: t.note ? `${t.item} (${t.note})` : t.item,
      mop: t.mop,
      income: t.kind === 'income' ? t.amount : 0,
      expense: t.kind === 'expense' ? t.amount : 0,
    }));

    const catMap: Record<string, number> = {};
    demoSeedRows.forEach((tx) => {
      if (tx.kind === 'expense') {
        catMap[tx.item] = (catMap[tx.item] || 0) + tx.amount;
      }
    });
    const totalExpTx = Object.values(catMap).reduce((a, b) => a + b, 0) || summary.totalExpense;
    const expenseCategories: ReportExpenseCategoryRow[] = Object.entries(catMap)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalExpTx > 0 ? (amount / totalExpTx) * 100 : 0,
      }))
      .slice(0, 6);

    const salaryRecords: ReportSalaryRow[] = DEMO_EMPLOYEES.slice(0, 4).map(
      (e: (typeof DEMO_EMPLOYEES)[number]): ReportSalaryRow => {
        const days = 26;
        const gross = days * e.rate_per_day;
        const advances = 1500;
        const paid = 0;
        return {
          employee: e.name,
          role: e.role_title,
          days,
          rate: e.rate_per_day,
          gross,
          advances,
          paid,
          balance: gross - advances - paid,
        };
      }
    );

    let itemSummaryRows: ReportData['itemSummaryRows'];
    let groupedItemDetails: ReportData['groupedItemDetails'];
    if (params.reportType === 'full') {
      const iw = await fetchItemWiseSummary({
        brandId: shopBrandId,
        shopId: params.shopId,
        startDate: params.startDate,
        endDate: params.endDate,
        kind: 'both',
      });
      itemSummaryRows = iw.rows;
      groupedItemDetails = await fetchAllGroupedItemDetailsForExport({
        brandId: shopBrandId,
        shopId: params.shopId,
        startDate: params.startDate,
        endDate: params.endDate,
        kind: 'both',
      });
    }

    return {
      reportType: params.reportType || 'full',
      includeItemDetails: Boolean(params.includeItemDetails),
      brand: {
        name: bundle.settings.display_name || bundle.brand.name,
        registrationNo: bundle.brand.registration_no,
        logoUrl: pdfSafeLogo,
        primaryColor: bundle.settings.primary_color,
        secondaryColor: bundle.settings.secondary_color,
        address: bundle.brand.address,
        phone: bundle.brand.phone,
        email: bundle.brand.email,
        gstin: bundle.brand.gstin,
        tagline: bundle.settings.tagline,
        pdfHeaderStyle: bundle.settings.pdf_header_style,
        pdfFooterText: bundle.settings.pdf_footer_text,
        pdfShowAddress: bundle.settings.pdf_show_address,
        pdfShowGstin: bundle.settings.pdf_show_gstin,
        pdfShowRegistrationNo: bundle.settings.pdf_show_registration_no,
        pdfSignatureLine: bundle.settings.pdf_signature_line,
      },
      shop: {
        name: shopName,
        code: shopCode,
        address: shopAddress,
      },
      period: {
        startDate: formatDate(params.startDate),
        endDate: formatDate(params.endDate),
      },
      generatedAt: formatDate(new Date()),
      summary,
      dailySummaries,
      transactions,
      expenseCategories,
      salaryRecords,
      itemSummaryRows,
      groupedItemDetails,
    };
  }

  const supabase = await createClient();

  // 1. Fetch Shop & Brand Details
  const { data: shop, error: shopError } = (await supabase
    .from('shops')
    .select(`
      id,
      name,
      code,
      address,
      brand_id
    `)
    .eq('id', params.shopId)
    .single()) as { data: any; error: any };

  if (shopError || !shop) {
    return null;
  }

  const { data: brand } = (await supabase
    .from('brands')
    .select('*')
    .eq('id', shop.brand_id)
    .single()) as { data: any; error: any };

  if (!brand) {
    return null;
  }

  const themeBundle = await getBrandThemeById(shop.brand_id);
  const pdfSafeLogo = await resolvePdfSafeLogoDataUri(
    themeBundle.settings.logo_url || brand.logo_url,
    shop.brand_id
  );

  // 2. Fetch Daily Summaries for date range
  const { data: dailyRows } = (await supabase
    .from('daily_summary')
    .select('summary_date, opening, income, expense, closing')
    .eq('shop_id', params.shopId)
    .gte('summary_date', params.startDate)
    .lte('summary_date', params.endDate)
    .order('summary_date', { ascending: true })) as { data: any[] | null; error: any };

  const dailySummaries: ReportDailySummaryRow[] = (dailyRows || []).map((row) => ({
    date: formatDate(row.summary_date),
    opening: Number(row.opening),
    income: Number(row.income),
    expense: Number(row.expense),
    net: Number(row.income) - Number(row.expense),
    closing: Number(row.closing),
  }));

  // Calculate high-level period summary
  const totalIncome = dailySummaries.reduce((sum, r) => sum + r.income, 0);
  const totalExpense = dailySummaries.reduce((sum, r) => sum + r.expense, 0);
  const openingBalance = dailySummaries.length > 0 ? dailySummaries[0].opening : 0;
  const closingBalance = dailySummaries.length > 0 ? dailySummaries[dailySummaries.length - 1].closing : 0;

  const summary = calculatePeriodSummary({
    openingBalance,
    totalIncome,
    totalExpense,
  });

  // 3. Fetch Transactions for Detailed Ledger (limit 500)
  const { data: txnRows } = (await supabase
    .from('transactions')
    .select('txn_date, item_name_snapshot, mode_name_snapshot, kind, amount, note')
    .eq('shop_id', params.shopId)
    .gte('txn_date', params.startDate)
    .lte('txn_date', params.endDate)
    .eq('is_deleted', false)
    .order('txn_date', { ascending: true })
    .limit(500)) as { data: any[] | null; error: any };

  const transactions: ReportTransactionRow[] = (txnRows || []).map((t) => ({
    date: formatDate(t.txn_date),
    description: t.note ? `${t.item_name_snapshot} (${t.note})` : t.item_name_snapshot,
    mop: t.mode_name_snapshot,
    income: t.kind === 'income' ? Number(t.amount) : 0,
    expense: t.kind === 'expense' ? Number(t.amount) : 0,
  }));

  // 4. Expense by category breakdown
  const categoryMap: Record<string, number> = {};
  (txnRows || []).forEach((t) => {
    if (t.kind === 'expense') {
      const cat = t.item_name_snapshot || 'General';
      categoryMap[cat] = (categoryMap[cat] || 0) + Number(t.amount);
    }
  });

  const expenseCategories: ReportExpenseCategoryRow[] = Object.entries(categoryMap)
    .map(([cat, amount]) => ({
      category: cat,
      amount,
      percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 10);

  // 5. Fetch Salary Records for month(s)
  const targetMonth = params.month || params.startDate.substring(0, 7);
  const { data: salaryRows } = (await supabase
    .from('salary_records')
    .select(`
      days_worked,
      rate_snapshot,
      gross,
      advances_total,
      paid_total,
      balance,
      employees (
        name,
        role_title
      )
    `)
    .eq('shop_id', params.shopId)
    .eq('month', targetMonth)) as { data: any[] | null; error: any };

  const salaryRecords: ReportSalaryRow[] = (salaryRows || []).map((s) => ({
    employee: s.employees?.name || 'Staff Member',
    role: s.employees?.role_title || undefined,
    days: Number(s.days_worked),
    rate: Number(s.rate_snapshot),
    gross: Number(s.gross),
    advances: Number(s.advances_total),
    paid: Number(s.paid_total),
    balance: Number(s.balance),
  }));

  let itemSummaryRows: ReportData['itemSummaryRows'];
  let groupedItemDetails: ReportData['groupedItemDetails'];
  if (params.reportType === 'full') {
    const iw = await fetchItemWiseSummary({
      brandId: shop.brand_id,
      shopId: params.shopId,
      startDate: params.startDate,
      endDate: params.endDate,
      kind: 'both',
    });
    itemSummaryRows = iw.rows;
    groupedItemDetails = await fetchAllGroupedItemDetailsForExport({
      brandId: shop.brand_id,
      shopId: params.shopId,
      startDate: params.startDate,
      endDate: params.endDate,
      kind: 'both',
    });
  }

  return {
    reportType: params.reportType || 'full',
    includeItemDetails: Boolean(params.includeItemDetails),
    brand: {
      name: themeBundle.settings.display_name || brand.name,
      registrationNo: brand.registration_no,
      logoUrl: pdfSafeLogo,
      primaryColor: themeBundle.settings.primary_color || brand.primary_color,
      secondaryColor: themeBundle.settings.secondary_color || brand.secondary_color,
      address: brand.address,
      phone: brand.phone,
      email: brand.email,
      gstin: brand.gstin,
      tagline: themeBundle.settings.tagline,
      pdfHeaderStyle: themeBundle.settings.pdf_header_style,
      pdfFooterText: themeBundle.settings.pdf_footer_text,
      pdfShowAddress: themeBundle.settings.pdf_show_address,
      pdfShowGstin: themeBundle.settings.pdf_show_gstin,
      pdfShowRegistrationNo: themeBundle.settings.pdf_show_registration_no,
      pdfSignatureLine: themeBundle.settings.pdf_signature_line,
    },
    shop: {
      name: shop.name,
      code: shop.code,
      address: shop.address,
    },
    period: {
      startDate: formatDate(params.startDate),
      endDate: formatDate(params.endDate),
    },
    generatedAt: formatDate(new Date()),
    summary,
    dailySummaries,
    transactions,
    expenseCategories,
    salaryRecords,
    itemSummaryRows,
    groupedItemDetails,
  };
}


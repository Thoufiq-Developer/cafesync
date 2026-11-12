import ExcelJS from 'exceljs';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getBrandThemeById } from '@/lib/theme/server';
import { resolvePdfSafeLogoDataUri } from './logo-helper';
import { ReportBrandInfo } from './types';
import { formatDate, getTodayKolkata } from '@/lib/calculations/dates';
import { ensureContrastColor, normalizeHex, pickReadableTextColor } from '@/lib/theme/colors';
import { DEMO_ITEMS, DEMO_PAYMENT_MODES } from '@/lib/demo-shop-data';
import { DEMO_ADMIN_SHOPS } from '@/lib/demo-admin-data';
import { DEMO_BRAND, DEMO_USERS } from '@/lib/demo-data';

export type ItemWiseKindFilter = 'expense' | 'income' | 'both';
export type ItemWiseSortField =
  | 'total_amount'
  | 'total_quantity'
  | 'purchase_count'
  | 'avg_rate'
  | 'item_name';

export interface ItemSummaryRow {
  itemKey: string;
  itemId: string | null;
  itemName: string;
  kind: 'income' | 'expense';
  category: string;
  unit: string;
  totalQuantity: number | null;
  quantifiedAmount: number;
  totalAmount: number;
  purchaseCount: number;
  qtyEntryCount: number;
  avgRate: number | null;
  percentOfTotal: number;
}

export interface ItemPurchaseDetailRow {
  id: string;
  txnDate: string;
  dateFormatted: string;
  itemKey: string;
  itemId: string | null;
  itemName: string;
  kind: 'income' | 'expense';
  category: string;
  unit: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
  modeName: string;
  note: string;
  enteredByName: string;
  shopId: string;
  shopName: string;
  shopCode: string;
}

export interface ItemDailyMiniPoint {
  date: string;
  label: string;
  amount: number;
  quantity: number;
}

export interface ItemWiseSummaryResult {
  brand: ReportBrandInfo;
  shopLabel: string;
  isAllShops: boolean;
  startDate: string;
  endDate: string;
  rows: ItemSummaryRow[];
  categories: string[];
  grandTotalAmount: number;
  grandTotalPurchases: number;
}

export interface ItemDetailResult {
  rows: ItemPurchaseDetailRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  subtotal: {
    totalAmount: number;
    totalQuantity: number | null;
    quantifiedAmount: number;
    purchaseCount: number;
    avgRate: number | null;
    unit: string;
  };
  dailySeries: ItemDailyMiniPoint[];
}

export interface DemoRawTxnForSummary {
  id: string;
  txn_date: string;
  item_id: string | null;
  item_name_snapshot: string;
  kind: 'income' | 'expense';
  category: string;
  quantity: number | null;
  unit_snapshot: string | null;
  item_unit?: string | null;
  rate: number | null;
  amount: number;
  mode_name_snapshot: string;
  note: string;
  entered_by_name: string;
  shop_id: string;
  shop_name: string;
  shop_code: string;
}

/**
 * Pure deterministic SQL-equivalent GROUP BY (item_key, kind, resolved_unit).
 * Ensures e.g. "Milk (L)" and "Milk (packet)" NEVER mix, and legacy NULL-quantity
 * rows still aggregate into totalAmount while showing quantity = null ("-").
 */
export function aggregateItemSummaryFromTransactions(
  txns: DemoRawTxnForSummary[],
  filters?: {
    kind?: ItemWiseKindFilter;
    category?: string | null;
    search?: string | null;
    shopId?: string | null;
    startDate?: string | null;
    endDate?: string | null;
  }
): ItemSummaryRow[] {
  const kind = filters?.kind || 'expense';
  const catFilter = (filters?.category || '').trim().toLowerCase();
  const searchFilter = (filters?.search || '').trim().toLowerCase();
  const shopFilter = filters?.shopId && filters.shopId !== 'all' ? filters.shopId : null;

  const groups = new Map<
    string,
    {
      itemKey: string;
      itemId: string | null;
      itemName: string;
      kind: 'income' | 'expense';
      category: string;
      unit: string;
      totalQty: number;
      quantifiedAmt: number;
      totalAmt: number;
      purchaseCount: number;
      qtyEntryCount: number;
    }
  >();

  for (const t of txns) {
    if (shopFilter && t.shop_id !== shopFilter) continue;
    if (filters?.startDate && t.txn_date < filters.startDate) continue;
    if (filters?.endDate && t.txn_date > filters.endDate) continue;
    if (kind !== 'both' && t.kind !== kind) continue;

    const resolvedCat = (t.category || 'General').trim();
    const resolvedName = (t.item_name_snapshot || 'Other').trim();
    if (catFilter && resolvedCat.toLowerCase() !== catFilter) continue;
    if (
      searchFilter &&
      !resolvedName.toLowerCase().includes(searchFilter) &&
      !resolvedCat.toLowerCase().includes(searchFilter)
    ) {
      continue;
    }

    const itemKey = t.item_id
      ? t.item_id
      : `name:${resolvedName.toLowerCase()}`;
    const hasQty = t.quantity !== null && t.quantity !== undefined && Number(t.quantity) > 0;
    const resolvedUnit = hasQty
      ? (t.unit_snapshot || t.item_unit || '').trim()
      : '';

    const groupKey = `${itemKey}__${t.kind}__${resolvedUnit}`;
    const existing = groups.get(groupKey);
    const amt = Number(t.amount) || 0;
    const qty = hasQty ? Number(t.quantity) : 0;

    if (!existing) {
      groups.set(groupKey, {
        itemKey,
        itemId: t.item_id || null,
        itemName: resolvedName,
        kind: t.kind,
        category: resolvedCat,
        unit: resolvedUnit,
        totalQty: qty,
        quantifiedAmt: hasQty ? amt : 0,
        totalAmt: amt,
        purchaseCount: 1,
        qtyEntryCount: hasQty ? 1 : 0,
      });
    } else {
      existing.totalAmt += amt;
      existing.purchaseCount += 1;
      if (hasQty) {
        existing.totalQty += qty;
        existing.quantifiedAmt += amt;
        existing.qtyEntryCount += 1;
      }
    }
  }

  const rawList = Array.from(groups.values());
  const grandTotal = rawList.reduce((acc, r) => acc + r.totalAmt, 0);

  return rawList
    .map((g): ItemSummaryRow => {
      const totalQuantity =
        g.qtyEntryCount > 0 ? Math.round(g.totalQty * 1000) / 1000 : null;
      const avgRate =
        totalQuantity !== null && totalQuantity > 0
          ? Math.round((g.quantifiedAmt / totalQuantity) * 100) / 100
          : null;
      return {
        itemKey: g.itemKey,
        itemId: g.itemId,
        itemName: g.itemName,
        kind: g.kind,
        category: g.category,
        unit: g.unit,
        totalQuantity,
        quantifiedAmount: Math.round(g.quantifiedAmt * 100) / 100,
        totalAmount: Math.round(g.totalAmt * 100) / 100,
        purchaseCount: g.purchaseCount,
        qtyEntryCount: g.qtyEntryCount,
        avgRate,
        percentOfTotal:
          grandTotal > 0 ? Math.round(((g.totalAmt / grandTotal) * 100) * 10) / 10 : 0,
      };
    })
    .sort((a, b) => b.totalAmount - a.totalAmount || a.itemName.localeCompare(b.itemName));
}

function buildDemoTransactions(brandId: string, startDate: string, endDate: string): DemoRawTxnForSummary[] {
  const shops =
    brandId === DEMO_BRAND.id
      ? DEMO_ADMIN_SHOPS
      : Object.values(DEMO_USERS)
          .filter((u) => u.brand?.id === brandId && u.shop)
          .map((u) => ({
            id: u.shop!.id,
            name: u.shop!.name,
            code: u.shop!.code,
          }));
  const fallbackShops =
    shops.length > 0
      ? shops
      : [{ id: 'demo-shop-1', name: 'Main Outlet', code: 'SHOP-01' }];

  const s1 = fallbackShops[0];
  const s2 = fallbackShops[1] || fallbackShops[0];
  const d1 = startDate;
  const d2 = startDate <= endDate && endDate > startDate
    ? endDate
    : startDate;
  const dMid =
    startDate < endDate
      ? (() => {
          const t1 = new Date(`${startDate}T00:00:00Z`).getTime();
          const t2 = new Date(`${endDate}T00:00:00Z`).getTime();
          return new Date(Math.round((t1 + t2) / 2)).toISOString().slice(0, 10);
        })()
      : startDate;

  const milkItem = DEMO_ITEMS.find((i) => i.name.includes('Milk'))!;
  const beansItem = DEMO_ITEMS.find((i) => i.name.includes('Specialty Coffee'))!;
  const cupsItem = DEMO_ITEMS.find((i) => i.name.includes('Packaging'))!;
  const counterItem = DEMO_ITEMS.find((i) => i.name.includes('Counter Billing'))!;
  const retailBeans = DEMO_ITEMS.find((i) => i.name.includes('Coffee Beans Retail'))!;

  return [
    {
      id: 'demo-is-1',
      txn_date: d1,
      item_id: milkItem.id,
      item_name_snapshot: milkItem.name,
      kind: 'expense',
      category: 'Dairy',
      quantity: 10,
      unit_snapshot: 'L',
      rate: 22.1,
      amount: 221,
      mode_name_snapshot: DEMO_PAYMENT_MODES[0].name,
      note: 'Morning dairy crate',
      entered_by_name: 'Ravi Sharma',
      shop_id: s1.id,
      shop_name: s1.name,
      shop_code: s1.code,
    },
    {
      id: 'demo-is-2',
      txn_date: dMid,
      item_id: milkItem.id,
      item_name_snapshot: milkItem.name,
      kind: 'expense',
      category: 'Dairy',
      quantity: 10,
      unit_snapshot: 'L',
      rate: 40,
      amount: 400,
      mode_name_snapshot: DEMO_PAYMENT_MODES[1].name,
      note: 'Afternoon top-up crate',
      entered_by_name: 'Ravi Sharma',
      shop_id: s1.id,
      shop_name: s1.name,
      shop_code: s1.code,
    },
    {
      id: 'demo-is-3',
      txn_date: d2,
      item_id: milkItem.id,
      item_name_snapshot: milkItem.name,
      kind: 'expense',
      category: 'Dairy',
      quantity: 6,
      unit_snapshot: 'packet',
      rate: 55,
      amount: 330,
      mode_name_snapshot: DEMO_PAYMENT_MODES[0].name,
      note: 'Emergency retail UHT packets (must stay separate from L)',
      entered_by_name: 'Kiran Nair',
      shop_id: s2.id,
      shop_name: s2.name,
      shop_code: s2.code,
    },
    {
      id: 'demo-is-4',
      txn_date: dMid,
      item_id: beansItem.id,
      item_name_snapshot: beansItem.name,
      kind: 'expense',
      category: 'Beverages',
      quantity: 5,
      unit_snapshot: 'kg',
      rate: 1260,
      amount: 6300,
      mode_name_snapshot: DEMO_PAYMENT_MODES[2].name,
      note: 'Medium roast espresso blend',
      entered_by_name: 'Ravi Sharma',
      shop_id: s1.id,
      shop_name: s1.name,
      shop_code: s1.code,
    },
    {
      id: 'demo-is-5',
      txn_date: d2,
      item_id: cupsItem.id,
      item_name_snapshot: cupsItem.name,
      kind: 'expense',
      category: 'Packaging',
      quantity: null,
      unit_snapshot: null,
      rate: null,
      amount: 1480,
      mode_name_snapshot: DEMO_PAYMENT_MODES[0].name,
      note: 'Legacy entry without quantity',
      entered_by_name: 'Kiran Nair',
      shop_id: s2.id,
      shop_name: s2.name,
      shop_code: s2.code,
    },
    {
      id: 'demo-is-6',
      txn_date: d1,
      item_id: counterItem.id,
      item_name_snapshot: counterItem.name,
      kind: 'income',
      category: 'Sales',
      quantity: null,
      unit_snapshot: null,
      rate: null,
      amount: 24800,
      mode_name_snapshot: DEMO_PAYMENT_MODES[0].name,
      note: 'Daily counter total',
      entered_by_name: 'Ravi Sharma',
      shop_id: s1.id,
      shop_name: s1.name,
      shop_code: s1.code,
    },
    {
      id: 'demo-is-7',
      txn_date: d2,
      item_id: retailBeans.id,
      item_name_snapshot: retailBeans.name,
      kind: 'income',
      category: 'Retail',
      quantity: 12,
      unit_snapshot: 'packet',
      rate: 450,
      amount: 5400,
      mode_name_snapshot: DEMO_PAYMENT_MODES[1].name,
      note: 'Retail 250g packs sold',
      entered_by_name: 'Ravi Sharma',
      shop_id: s1.id,
      shop_name: s1.name,
      shop_code: s1.code,
    },
  ];
}

export async function resolveBrandReportInfo(brandId: string): Promise<ReportBrandInfo> {
  const bundle = await getBrandThemeById(brandId);
  const safeLogo = await resolvePdfSafeLogoDataUri(
    bundle.settings.logo_url,
    brandId
  );

  return {
    name: bundle.settings.display_name || bundle.brand.name,
    registrationNo: bundle.brand.registration_no,
    logoUrl: safeLogo,
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
  };
}

export async function fetchItemWiseSummary(params: {
  brandId: string;
  shopId?: string | null;
  startDate: string;
  endDate: string;
  kind?: ItemWiseKindFilter;
  category?: string | null;
  search?: string | null;
  sortBy?: ItemWiseSortField;
  sortDir?: 'asc' | 'desc';
}): Promise<ItemWiseSummaryResult> {
  const isAllShops = !params.shopId || params.shopId === 'all';
  const kind: ItemWiseKindFilter = params.kind || 'expense';
  const brand = await resolveBrandReportInfo(params.brandId);

  let shopLabel = 'All Outlets Combined';
  let rows: ItemSummaryRow[] = [];
  let categories: string[] = [];

  if (!isSupabaseConfigured()) {
    const demoTxns = buildDemoTransactions(params.brandId, params.startDate, params.endDate);
    if (!isAllShops && params.shopId) {
      const matched = DEMO_ADMIN_SHOPS.find((s) => s.id === params.shopId);
      shopLabel = matched ? `${matched.name} (${matched.code})` : 'Shop Counter';
    }

    const catSet = new Set<string>();
    demoTxns.forEach((t) => {
      if ((isAllShops || t.shop_id === params.shopId) && (kind === 'both' || t.kind === kind)) {
        catSet.add(t.category);
      }
    });
    categories = Array.from(catSet).sort();

    rows = aggregateItemSummaryFromTransactions(demoTxns, {
      kind,
      category: params.category,
      search: params.search,
      shopId: params.shopId,
      startDate: params.startDate,
      endDate: params.endDate,
    });
  } else {
    const supabase = (await createClient()) as any;

    if (!isAllShops && params.shopId) {
      const { data: shopRow } = await supabase
        .from('shops')
        .select('name, code')
        .eq('id', params.shopId)
        .eq('brand_id', params.brandId)
        .maybeSingle();
      if (shopRow) {
        shopLabel = `${shopRow.name} (${shopRow.code})`;
      }
    }

    // Fetch distinct categories available for quick filter dropdown
    const { data: catItems } = await supabase
      .from('items')
      .select('category, kind')
      .eq('brand_id', params.brandId);
    const catSet = new Set<string>();
    (catItems || []).forEach((c: any) => {
      if (c.category && (kind === 'both' || c.kind === kind)) {
        catSet.add(c.category);
      }
    });
    categories = Array.from(catSet).sort();

    // Call SQL aggregation RPC (GROUP BY item_key, kind, resolved_unit)
    const { data: rpcRows, error: rpcError } = await supabase.rpc('get_item_wise_summary', {
      p_brand_id: params.brandId,
      p_shop_id: !isAllShops && params.shopId ? params.shopId : null,
      p_start: params.startDate,
      p_end: params.endDate,
      p_kind: kind,
      p_category: params.category?.trim() || null,
      p_search: params.search?.trim() || null,
    });

    if (rpcError) {
      console.error('get_item_wise_summary RPC error:', rpcError);
      // Graceful JS fallback via direct query if RPC fails
      const runFallback = async (includeNewCols: boolean) => {
        let q = supabase
          .from('transactions')
          .select(
            includeNewCols
              ? 'id, txn_date, kind, item_id, item_name_snapshot, mode_name_snapshot, amount, quantity, unit_snapshot, rate, note, shop_id, shops(name, code), items(category, unit)'
              : 'id, txn_date, kind, item_id, item_name_snapshot, mode_name_snapshot, amount, note, shop_id, shops(name, code), items(category)'
          )
          .eq('brand_id', params.brandId)
          .eq('is_deleted', false)
          .gte('txn_date', params.startDate)
          .lte('txn_date', params.endDate);
        if (!isAllShops && params.shopId) {
          q = q.eq('shop_id', params.shopId);
        }
        return q.limit(5000);
      };

      let { data: rawTxns, error: fallbackErr } = await runFallback(true);
      if (fallbackErr) {
        const legacy = await runFallback(false);
        rawTxns = legacy.data;
      }

      const mapped: DemoRawTxnForSummary[] = (rawTxns || []).map((t: any) => ({
        id: t.id,
        txn_date: t.txn_date,
        item_id: t.item_id,
        item_name_snapshot: t.item_name_snapshot,
        kind: t.kind,
        category: t.items?.category || 'General',
        quantity: t.quantity !== null && t.quantity !== undefined ? Number(t.quantity) : null,
        unit_snapshot: t.unit_snapshot || null,
        item_unit: t.items?.unit || null,
        rate: t.rate !== null && t.rate !== undefined ? Number(t.rate) : null,
        amount: Number(t.amount) || 0,
        mode_name_snapshot: t.mode_name_snapshot,
        note: t.note || '',
        entered_by_name: 'Staff',
        shop_id: t.shop_id,
        shop_name: t.shops?.name || 'Outlet',
        shop_code: t.shops?.code || '',
      }));
      rows = aggregateItemSummaryFromTransactions(mapped, {
        kind,
        category: params.category,
        search: params.search,
        shopId: params.shopId,
        startDate: params.startDate,
        endDate: params.endDate,
      });
    } else {
      const parsed = (rpcRows || []).map((r: any) => ({
        itemKey: r.item_key,
        itemId: r.item_id || null,
        itemName: r.item_name || 'Other',
        kind: (r.kind === 'income' ? 'income' : 'expense') as 'income' | 'expense',
        category: r.category || 'General',
        unit: r.unit || '',
        totalQuantity:
          r.total_quantity !== null && r.total_quantity !== undefined
            ? Number(r.total_quantity)
            : null,
        quantifiedAmount: Number(r.quantified_amount) || 0,
        totalAmount: Number(r.total_amount) || 0,
        purchaseCount: Number(r.purchase_count) || 0,
        qtyEntryCount: Number(r.qty_entry_count) || 0,
        avgRate:
          r.avg_rate !== null && r.avg_rate !== undefined ? Number(r.avg_rate) : null,
      }));
      const totalAmt = parsed.reduce((acc: number, r: any) => acc + r.totalAmount, 0);
      rows = parsed.map((r: any) => ({
        ...r,
        percentOfTotal:
          totalAmt > 0 ? Math.round(((r.totalAmount / totalAmt) * 100) * 10) / 10 : 0,
      }));
    }
  }

  // Sort rows according to sortBy / sortDir
  const sortBy: ItemWiseSortField = params.sortBy || 'total_amount';
  const sortDir: 'asc' | 'desc' = params.sortDir || 'desc';
  const mul = sortDir === 'asc' ? 1 : -1;

  rows.sort((a, b) => {
    switch (sortBy) {
      case 'item_name':
        return a.itemName.localeCompare(b.itemName) * mul;
      case 'purchase_count':
        return (a.purchaseCount - b.purchaseCount) * mul;
      case 'total_quantity':
        return ((a.totalQuantity ?? -1) - (b.totalQuantity ?? -1)) * mul;
      case 'avg_rate':
        return ((a.avgRate ?? -1) - (b.avgRate ?? -1)) * mul;
      case 'total_amount':
      default:
        return (a.totalAmount - b.totalAmount) * mul || a.itemName.localeCompare(b.itemName);
    }
  });

  const grandTotalAmount = Math.round(
    rows.reduce((acc, r) => acc + r.totalAmount, 0) * 100
  ) / 100;
  const grandTotalPurchases = rows.reduce((acc, r) => acc + r.purchaseCount, 0);

  return {
    brand,
    shopLabel,
    isAllShops,
    startDate: params.startDate,
    endDate: params.endDate,
    rows,
    categories,
    grandTotalAmount,
    grandTotalPurchases,
  };
}

function mapRawTxnToDetailRow(t: any): ItemPurchaseDetailRow {
  const hasQty = t.quantity !== null && t.quantity !== undefined && Number(t.quantity) > 0;
  const qtyNum = hasQty ? Number(t.quantity) : null;
  const amtNum = Number(t.amount) || 0;
  const resolvedUnit = hasQty
    ? (t.unit_snapshot || t.items?.unit || t.item_unit || '').trim()
    : '';
  const unitPrice =
    qtyNum !== null && qtyNum > 0
      ? t.rate !== null && t.rate !== undefined
        ? Number(t.rate)
        : Math.round((amtNum / qtyNum) * 100) / 100
      : null;

  const itemName = (t.items?.name || t.item_name_snapshot || 'Other').trim();
  const itemKey = t.item_id ? String(t.item_id) : `name:${itemName.toLowerCase()}`;

  return {
    id: t.id,
    txnDate: t.txn_date,
    dateFormatted: formatDate(t.txn_date),
    itemKey,
    itemId: t.item_id || null,
    itemName,
    kind: t.kind === 'income' ? 'income' : 'expense',
    category: t.items?.category || t.category || 'General',
    unit: resolvedUnit,
    quantity: qtyNum,
    unitPrice,
    amount: amtNum,
    modeName: t.mode_name_snapshot || 'CASH',
    note: t.note || '',
    enteredByName:
      t.profiles?.full_name ||
      t.entered_by_name ||
      t.created_by_name ||
      'Staff',
    shopId: t.shop_id,
    shopName: t.shops?.name || t.shop_name || 'Outlet',
    shopCode: t.shops?.code || t.shop_code || '',
  };
}

export async function fetchItemDetailPurchases(params: {
  brandId: string;
  shopId?: string | null;
  startDate: string;
  endDate: string;
  itemKey: string;
  itemName?: string;
  unit?: string;
  kind?: 'income' | 'expense' | 'both';
  page?: number;
  pageSize?: number;
}): Promise<ItemDetailResult> {
  const page = Math.max(1, params.page || 1);
  const pageSize = Math.min(200, Math.max(10, params.pageSize || 25));
  const targetUnit = (params.unit || '').trim();
  const isAllShops = !params.shopId || params.shopId === 'all';
  const kindFilter = params.kind && params.kind !== 'both' ? params.kind : null;

  let allMatching: ItemPurchaseDetailRow[] = [];

  if (!isSupabaseConfigured()) {
    const demoTxns = buildDemoTransactions(params.brandId, params.startDate, params.endDate);
    allMatching = demoTxns
      .map(mapRawTxnToDetailRow)
      .filter((r) => {
        if (!isAllShops && params.shopId && r.shopId !== params.shopId) return false;
        if (kindFilter && r.kind !== kindFilter) return false;
        if (r.txnDate < params.startDate || r.txnDate > params.endDate) return false;
        if (r.itemKey !== params.itemKey) return false;
        if (r.unit !== targetUnit) return false;
        return true;
      })
      .sort((a, b) => b.txnDate.localeCompare(a.txnDate));
  } else {
    const supabase = (await createClient()) as any;
    const runDetailQuery = async (includeNewCols: boolean) => {
      let query = supabase
        .from('transactions')
        .select(
          includeNewCols
            ? 'id, txn_date, kind, item_id, item_name_snapshot, mode_name_snapshot, amount, quantity, unit_snapshot, rate, note, shop_id, created_by, shops(name, code), items(name, category, unit)'
            : 'id, txn_date, kind, item_id, item_name_snapshot, mode_name_snapshot, amount, note, shop_id, created_by, shops(name, code), items(name, category)'
        )
        .eq('brand_id', params.brandId)
        .eq('is_deleted', false)
        .gte('txn_date', params.startDate)
        .lte('txn_date', params.endDate)
        .order('txn_date', { ascending: false })
        .order('created_at', { ascending: false });

      if (!isAllShops && params.shopId) {
        query = query.eq('shop_id', params.shopId);
      }
      if (kindFilter) {
        query = query.eq('kind', kindFilter);
      }

      if (params.itemKey.startsWith('name:')) {
        const expectedName = params.itemKey.slice(5);
        query = query.is('item_id', null).ilike('item_name_snapshot', expectedName);
      } else {
        query = query.eq('item_id', params.itemKey);
      }

      return query.limit(2000);
    };

    let { data: rawRows, error } = await runDetailQuery(true);
    if (error) {
      const legacy = await runDetailQuery(false);
      rawRows = legacy.data;
      if (legacy.error) {
        console.error('fetchItemDetailPurchases error:', legacy.error);
      }
    }

    // Fetch creator display names in one batch so Entered By always shows real names
    const userIds = Array.from(
      new Set((rawRows || []).map((r: any) => r.created_by).filter(Boolean))
    );
    const userNameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      (profs || []).forEach((p: any) => {
        if (p.id && p.full_name) userNameMap.set(p.id, p.full_name);
      });
    }

    allMatching = (rawRows || [])
      .map((r: any) =>
        mapRawTxnToDetailRow({
          ...r,
          entered_by_name: userNameMap.get(r.created_by) || 'Staff',
        })
      )
      .filter((r: ItemPurchaseDetailRow) => r.unit === targetUnit);
  }

  // Compute subtotals & daily mini-chart over ALL matching purchases in period
  let totalAmount = 0;
  let totalQty = 0;
  let quantifiedAmt = 0;
  let qtyCount = 0;
  const dailyMap = new Map<string, { amount: number; quantity: number }>();

  for (const r of allMatching) {
    totalAmount += r.amount;
    if (r.quantity !== null && r.quantity > 0) {
      totalQty += r.quantity;
      quantifiedAmt += r.amount;
      qtyCount += 1;
    }
    const prev = dailyMap.get(r.txnDate) || { amount: 0, quantity: 0 };
    prev.amount += r.amount;
    prev.quantity += r.quantity || 0;
    dailyMap.set(r.txnDate, prev);
  }

  const totalCount = allMatching.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIdx = (safePage - 1) * pageSize;
  const paginatedRows = allMatching.slice(startIdx, startIdx + pageSize);

  const dailySeries: ItemDailyMiniPoint[] = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, val]) => ({
      date,
      label: formatDate(date).slice(0, 5),
      amount: Math.round(val.amount * 100) / 100,
      quantity: Math.round(val.quantity * 1000) / 1000,
    }));

  const roundedQty = qtyCount > 0 ? Math.round(totalQty * 1000) / 1000 : null;
  const avgRate =
    roundedQty !== null && roundedQty > 0
      ? Math.round((quantifiedAmt / roundedQty) * 100) / 100
      : null;

  return {
    rows: paginatedRows,
    totalCount,
    page: safePage,
    pageSize,
    totalPages,
    subtotal: {
      totalAmount: Math.round(totalAmount * 100) / 100,
      totalQuantity: roundedQty,
      quantifiedAmount: Math.round(quantifiedAmt * 100) / 100,
      purchaseCount: totalCount,
      avgRate,
      unit: targetUnit,
    },
    dailySeries,
  };
}

export interface GroupedItemDetailsGroup {
  itemKey: string;
  itemName: string;
  category: string;
  unit: string;
  kind: 'income' | 'expense';
  rows: ItemPurchaseDetailRow[];
  subtotalAmount: number;
  subtotalQuantity: number | null;
  avgRate: number | null;
}

export async function fetchAllGroupedItemDetailsForExport(params: {
  brandId: string;
  shopId?: string | null;
  startDate: string;
  endDate: string;
  kind?: ItemWiseKindFilter;
  category?: string | null;
  search?: string | null;
}): Promise<GroupedItemDetailsGroup[]> {
  const isAllShops = !params.shopId || params.shopId === 'all';
  const kind = params.kind || 'expense';
  const catFilter = (params.category || '').trim().toLowerCase();
  const searchFilter = (params.search || '').trim().toLowerCase();

  let detailRows: ItemPurchaseDetailRow[] = [];

  if (!isSupabaseConfigured()) {
    const demoTxns = buildDemoTransactions(params.brandId, params.startDate, params.endDate);
    detailRows = demoTxns
      .map(mapRawTxnToDetailRow)
      .filter((r) => {
        if (!isAllShops && params.shopId && r.shopId !== params.shopId) return false;
        if (kind !== 'both' && r.kind !== kind) return false;
        if (r.txnDate < params.startDate || r.txnDate > params.endDate) return false;
        if (catFilter && r.category.toLowerCase() !== catFilter) return false;
        if (
          searchFilter &&
          !r.itemName.toLowerCase().includes(searchFilter) &&
          !r.category.toLowerCase().includes(searchFilter)
        ) {
          return false;
        }
        return true;
      });
  } else {
    const supabase = (await createClient()) as any;
    let query = supabase
      .from('transactions')
      .select(
        'id, txn_date, kind, item_id, item_name_snapshot, mode_name_snapshot, amount, quantity, unit_snapshot, rate, note, shop_id, created_by, shops(name, code), items(name, category, unit)'
      )
      .eq('brand_id', params.brandId)
      .eq('is_deleted', false)
      .gte('txn_date', params.startDate)
      .lte('txn_date', params.endDate)
      .order('txn_date', { ascending: true });

    if (!isAllShops && params.shopId) {
      query = query.eq('shop_id', params.shopId);
    }
    if (kind !== 'both') {
      query = query.eq('kind', kind);
    }

    const { data: rawRows } = await query.limit(5000);
    const userIds = Array.from(
      new Set((rawRows || []).map((r: any) => r.created_by).filter(Boolean))
    );
    const userNameMap = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds);
      (profs || []).forEach((p: any) => {
        if (p.id && p.full_name) userNameMap.set(p.id, p.full_name);
      });
    }

    detailRows = (rawRows || [])
      .map((r: any) =>
        mapRawTxnToDetailRow({
          ...r,
          entered_by_name: userNameMap.get(r.created_by) || 'Staff',
        })
      )
      .filter((r: ItemPurchaseDetailRow) => {
        if (catFilter && r.category.toLowerCase() !== catFilter) return false;
        if (
          searchFilter &&
          !r.itemName.toLowerCase().includes(searchFilter) &&
          !r.category.toLowerCase().includes(searchFilter)
        ) {
          return false;
        }
        return true;
      });
  }

  const groupMap = new Map<string, GroupedItemDetailsGroup>();
  for (const r of detailRows) {
    const gk = `${r.itemKey}__${r.kind}__${r.unit}`;
    const existing = groupMap.get(gk);
    if (!existing) {
      groupMap.set(gk, {
        itemKey: r.itemKey,
        itemName: r.itemName,
        category: r.category,
        unit: r.unit,
        kind: r.kind,
        rows: [r],
        subtotalAmount: r.amount,
        subtotalQuantity: r.quantity !== null ? r.quantity : 0,
        avgRate: null,
      });
    } else {
      existing.rows.push(r);
      existing.subtotalAmount += r.amount;
      existing.subtotalQuantity = (existing.subtotalQuantity || 0) + (r.quantity || 0);
    }
  }

  return Array.from(groupMap.values())
    .map((g) => {
      const qtyEntries = g.rows.filter((x) => x.quantity !== null && x.quantity > 0);
      const totalQty =
        qtyEntries.length > 0
          ? Math.round(qtyEntries.reduce((acc, x) => acc + (x.quantity || 0), 0) * 1000) / 1000
          : null;
      const quantifiedAmt = qtyEntries.reduce((acc, x) => acc + x.amount, 0);
      const avgRate =
        totalQty !== null && totalQty > 0
          ? Math.round((quantifiedAmt / totalQty) * 100) / 100
          : null;

      return {
        ...g,
        subtotalAmount: Math.round(g.subtotalAmount * 100) / 100,
        subtotalQuantity: totalQty,
        avgRate,
      };
    })
    .sort((a, b) => b.subtotalAmount - a.subtotalAmount);
}

export async function generateItemWiseExcelBuffer(params: {
  summary: ItemWiseSummaryResult;
  groups: GroupedItemDetailsGroup[];
  dailySummaries: Array<{
    date: string;
    opening: number;
    income: number;
    expense: number;
    net: number;
    closing: number;
  }>;
  singleItemTitle?: string;
}): Promise<Buffer> {
  const { summary, groups, dailySummaries, singleItemTitle } = params;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = summary.brand.name || 'CafeLedger';
  workbook.created = new Date();

  const safePrimary = normalizeHex(summary.brand.primaryColor, '#ea580c');
  const titleColor = ensureContrastColor(safePrimary, '#ffffff', 4.5);
  const headerFgHex = pickReadableTextColor(safePrimary, '#ffffff', '#0f172a');

  const brandArgb = `FF${safePrimary.replace('#', '').toUpperCase()}`;
  const titleArgb = `FF${titleColor.replace('#', '').toUpperCase()}`;
  const headerFgArgb = `FF${headerFgHex.replace('#', '').toUpperCase()}`;

  const headerFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: brandArgb },
  };
  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: headerFgArgb },
  };
  const currencyFormat = '"₹"#,##0.00;[Red]-"₹"#,##0.00;"₹"0.00';

  if (singleItemTitle && groups.length > 0) {
    const grp = groups[0];
    const sheet = workbook.addWorksheet('Item Purchases', {
      views: [{ showGridLines: true }],
    });
    sheet.addRow([`${summary.brand.name} - ${singleItemTitle}`]);
    sheet.addRow([
      `Scope: ${summary.shopLabel} | Period: ${formatDate(summary.startDate)} to ${formatDate(summary.endDate)}`,
    ]);
    sheet.addRow([]);
    sheet.getRow(1).font = { name: 'Calibri', size: 14, bold: true, color: { argb: titleArgb } };
    sheet.getRow(2).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF555555' } };

    const headers = [
      'Date',
      ...(summary.isAllShops ? ['Shop'] : []),
      'Quantity',
      'Unit',
      'Unit Price (₹)',
      'Amount (₹)',
      'Payment Mode',
      'Note',
      'Entered By',
    ];
    const hRow = sheet.addRow(headers);
    hRow.font = headerFont;
    hRow.fill = headerFill;
    hRow.alignment = { vertical: 'middle', horizontal: 'center' };

    const startRow = 5;
    grp.rows.forEach((r) => {
      const row = sheet.addRow([
        r.dateFormatted,
        ...(summary.isAllShops ? [`${r.shopName} (${r.shopCode})`] : []),
        r.quantity ?? '-',
        r.unit || '-',
        r.unitPrice ?? null,
        r.amount,
        r.modeName,
        r.note || '-',
        r.enteredByName,
      ]);
      const priceCol = summary.isAllShops ? 5 : 4;
      const amtCol = summary.isAllShops ? 6 : 5;
      if (r.unitPrice !== null) row.getCell(priceCol).numFmt = currencyFormat;
      row.getCell(amtCol).numFmt = currencyFormat;
    });

    const endRow = startRow + Math.max(grp.rows.length - 1, 0);
    const amtColLetter = summary.isAllShops ? 'F' : 'E';
    const qtyColLetter = summary.isAllShops ? 'C' : 'B';
    const totalRow = sheet.addRow([
      'TOTAL',
      ...(summary.isAllShops ? [''] : []),
      grp.subtotalQuantity !== null
        ? { formula: `SUM(${qtyColLetter}${startRow}:${qtyColLetter}${endRow})` }
        : '-',
      grp.unit || '-',
      grp.avgRate ?? null,
      { formula: `SUM(${amtColLetter}${startRow}:${amtColLetter}${endRow})` },
      '',
      `${grp.rows.length} entries`,
      '',
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    const priceCol = summary.isAllShops ? 5 : 4;
    const amtCol = summary.isAllShops ? 6 : 5;
    if (grp.avgRate !== null) totalRow.getCell(priceCol).numFmt = currencyFormat;
    totalRow.getCell(amtCol).numFmt = currencyFormat;

    sheet.columns.forEach((c, idx) => {
      c.width = idx >= (summary.isAllShops ? 7 : 6) ? 26 : 16;
    });

    const buf = await workbook.xlsx.writeBuffer();
    return Buffer.from(buf);
  }

  // ----------------------------------------------------------------------------
  // SHEET 1: Item Summary
  // ----------------------------------------------------------------------------
  const itemSummarySheet = workbook.addWorksheet('Item Summary', {
    views: [{ showGridLines: true }],
  });
  itemSummarySheet.addRow([`${summary.brand.name} - Item-wise Summary Report`]);
  itemSummarySheet.addRow([
    `Scope: ${summary.shopLabel} | Period: ${formatDate(summary.startDate)} to ${formatDate(summary.endDate)} | Generated: ${formatDate(getTodayKolkata())}`,
  ]);
  itemSummarySheet.addRow([]);
  itemSummarySheet.getRow(1).font = {
    name: 'Calibri',
    size: 14,
    bold: true,
    color: { argb: titleArgb },
  };
  itemSummarySheet.getRow(2).font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: 'FF555555' },
  };

  const sumHeaderRow = itemSummarySheet.addRow([
    'Item',
    'Category',
    'Unit',
    'Total Quantity',
    'Total Amount (₹)',
    'Purchases',
    'Average Rate (₹)',
    '% of Total',
  ]);
  sumHeaderRow.font = headerFont;
  sumHeaderRow.fill = headerFill;
  sumHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };

  itemSummarySheet.columns = [
    { width: 28 },
    { width: 16 },
    { width: 12 },
    { width: 16 },
    { width: 18 },
    { width: 14 },
    { width: 18 },
    { width: 14 },
  ];

  const sumStartRow = 5;
  summary.rows.forEach((row) => {
    const r = itemSummarySheet.addRow([
      row.itemName,
      row.category,
      row.unit || '-',
      row.totalQuantity !== null ? row.totalQuantity : '-',
      row.totalAmount,
      row.purchaseCount,
      row.avgRate !== null ? row.avgRate : '-',
      row.percentOfTotal / 100,
    ]);
    r.getCell(3).alignment = { horizontal: 'center' };
    r.getCell(4).alignment = { horizontal: 'right' };
    r.getCell(5).numFmt = currencyFormat;
    r.getCell(6).alignment = { horizontal: 'right' };
    if (row.avgRate !== null) r.getCell(7).numFmt = currencyFormat;
    r.getCell(8).numFmt = '0.0%';
  });

  const sumEndRow = sumStartRow + Math.max(summary.rows.length - 1, 0);
  if (summary.rows.length > 0) {
    const totalRow = itemSummarySheet.addRow([
      'GRAND TOTAL',
      '',
      '',
      '',
      { formula: `SUM(E${sumStartRow}:E${sumEndRow})` },
      { formula: `SUM(F${sumStartRow}:F${sumEndRow})` },
      '',
      1,
    ]);
    totalRow.font = { bold: true };
    totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    totalRow.getCell(5).numFmt = currencyFormat;
    totalRow.getCell(6).alignment = { horizontal: 'right' };
    totalRow.getCell(8).numFmt = '0.0%';
  }

  // ----------------------------------------------------------------------------
  // SHEET 2: Item Details (Grouped by item with subtotal after each item)
  // ----------------------------------------------------------------------------
  const detailsSheet = workbook.addWorksheet('Item Details', {
    views: [{ showGridLines: true }],
  });
  detailsSheet.addRow([`${summary.brand.name} - Purchase Details Grouped By Item`]);
  detailsSheet.addRow([
    `Scope: ${summary.shopLabel} | Period: ${formatDate(summary.startDate)} to ${formatDate(summary.endDate)}`,
  ]);
  detailsSheet.addRow([]);
  detailsSheet.getRow(1).font = {
    name: 'Calibri',
    size: 14,
    bold: true,
    color: { argb: titleArgb },
  };
  detailsSheet.getRow(2).font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: 'FF555555' },
  };

  const detHeaders = [
    'Item',
    'Date',
    ...(summary.isAllShops ? ['Shop'] : []),
    'Quantity',
    'Unit',
    'Unit Price (₹)',
    'Amount (₹)',
    'Payment Mode',
    'Note',
    'Entered By',
  ];
  const detHRow = detailsSheet.addRow(detHeaders);
  detHRow.font = headerFont;
  detHRow.fill = headerFill;
  detHRow.alignment = { vertical: 'middle', horizontal: 'center' };

  const amtColIndex = summary.isAllShops ? 7 : 6;
  const priceColIndex = summary.isAllShops ? 6 : 5;
  const amtColLetter = summary.isAllShops ? 'G' : 'F';

  groups.forEach((grp) => {
    const label = grp.unit ? `${grp.itemName} (${grp.unit})` : grp.itemName;
    const firstDataRow = detailsSheet.rowCount + 1;
    grp.rows.forEach((r) => {
      const row = detailsSheet.addRow([
        label,
        r.dateFormatted,
        ...(summary.isAllShops ? [`${r.shopName} (${r.shopCode})`] : []),
        r.quantity ?? '-',
        r.unit || '-',
        r.unitPrice ?? null,
        r.amount,
        r.modeName,
        r.note || '-',
        r.enteredByName,
      ]);
      if (r.unitPrice !== null) row.getCell(priceColIndex).numFmt = currencyFormat;
      row.getCell(amtColIndex).numFmt = currencyFormat;
    });
    const lastDataRow = detailsSheet.rowCount;

    const subRow = detailsSheet.addRow([
      `Subtotal — ${label}`,
      `${grp.rows.length} purchases`,
      ...(summary.isAllShops ? [''] : []),
      grp.subtotalQuantity !== null ? grp.subtotalQuantity : '-',
      grp.unit || '-',
      grp.avgRate ?? null,
      { formula: `SUM(${amtColLetter}${firstDataRow}:${amtColLetter}${lastDataRow})` },
      '',
      '',
      '',
    ]);
    subRow.font = { bold: true };
    subRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    if (grp.avgRate !== null) subRow.getCell(priceColIndex).numFmt = currencyFormat;
    subRow.getCell(amtColIndex).numFmt = currencyFormat;
    detailsSheet.addRow([]);
  });

  detailsSheet.columns.forEach((c, idx) => {
    c.width = idx === 0 ? 26 : idx >= amtColIndex + 1 ? 22 : 15;
  });

  // ----------------------------------------------------------------------------
  // SHEET 3: Daily Summary (preserved format + SUM formulas)
  // ----------------------------------------------------------------------------
  const dailySheet = workbook.addWorksheet('Daily Summary', {
    views: [{ showGridLines: true }],
  });
  dailySheet.addRow([`${summary.brand.name} - Daily Summary`]);
  dailySheet.addRow([
    `Scope: ${summary.shopLabel} | Period: ${formatDate(summary.startDate)} to ${formatDate(summary.endDate)}`,
  ]);
  dailySheet.addRow([]);
  dailySheet.getRow(1).font = {
    name: 'Calibri',
    size: 14,
    bold: true,
    color: { argb: titleArgb },
  };
  dailySheet.getRow(2).font = {
    name: 'Calibri',
    size: 10,
    italic: true,
    color: { argb: 'FF555555' },
  };

  const dailyHeaderRow = dailySheet.addRow([
    'Date',
    'Opening',
    'Income',
    'Expense',
    'Net',
    'Closing',
  ]);
  dailyHeaderRow.font = headerFont;
  dailyHeaderRow.fill = headerFill;
  dailyHeaderRow.alignment = { vertical: 'middle', horizontal: 'center' };
  dailySheet.columns = [
    { width: 14 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
  ];

  const dailyStartRow = 5;
  dailySummaries.forEach((d) => {
    const r = dailySheet.addRow([d.date, d.opening, d.income, d.expense, d.net, d.closing]);
    r.getCell(1).alignment = { horizontal: 'center' };
    r.getCell(2).numFmt = currencyFormat;
    r.getCell(3).numFmt = currencyFormat;
    r.getCell(4).numFmt = currencyFormat;
    r.getCell(5).numFmt = currencyFormat;
    r.getCell(6).numFmt = currencyFormat;
  });

  const dailyEndRow = dailyStartRow + Math.max(dailySummaries.length - 1, 0);
  if (dailySummaries.length > 0) {
    const tot = dailySheet.addRow([
      'TOTAL',
      '',
      { formula: `SUM(C${dailyStartRow}:C${dailyEndRow})` },
      { formula: `SUM(D${dailyStartRow}:D${dailyEndRow})` },
      { formula: `SUM(E${dailyStartRow}:E${dailyEndRow})` },
      '',
    ]);
    tot.font = { bold: true };
    tot.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
    tot.getCell(3).numFmt = currencyFormat;
    tot.getCell(4).numFmt = currencyFormat;
    tot.getCell(5).numFmt = currencyFormat;
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

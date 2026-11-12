import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { getCurrentMonthKolkata, getMonthBounds, formatDate } from '@/lib/calculations/dates';
import {
  fetchAllGroupedItemDetailsForExport,
  fetchItemDetailPurchases,
  fetchItemWiseSummary,
  generateItemWiseExcelBuffer,
  ItemWiseKindFilter,
  ItemWiseSortField,
} from '@/lib/reports/item-wise';
import {
  generateItemWisePdfReport,
  generateSingleItemPdfReport,
} from '@/lib/reports/item-wise-pdf';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserContext();
    if (!user || (user.role !== 'admin' && user.role !== 'manager' && user.role !== 'master')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const action = sp.get('action') || 'summary'; // 'summary' | 'detail' | 'excel' | 'pdf'
    const currentMonth = getCurrentMonthKolkata();
    const bounds = getMonthBounds(sp.get('month') || currentMonth);
    const startDate = sp.get('startDate') || bounds.start;
    const endDate = sp.get('endDate') || bounds.end;

    const kindParam = sp.get('kind');
    const kind: ItemWiseKindFilter =
      kindParam === 'income' || kindParam === 'both' ? kindParam : 'expense';
    const category = sp.get('category') || null;
    const search = sp.get('search') || null;
    const sortBy = (sp.get('sortBy') as ItemWiseSortField) || 'total_amount';
    const sortDir = sp.get('sortDir') === 'asc' ? 'asc' : 'desc';

    const brandId = user.brandId || sp.get('brandId') || '';
    if (!brandId) {
      return NextResponse.json({ error: 'Missing brand scope' }, { status: 400 });
    }

    // Managers are strictly locked to their own shopId
    const requestedShopId = sp.get('shopId');
    const shopId =
      user.role === 'manager'
        ? user.shopId || ''
        : requestedShopId && requestedShopId !== 'all'
          ? requestedShopId
          : 'all';

    // Action 1: Detail popup paginated purchases
    if (action === 'detail') {
      const itemKey = sp.get('itemKey') || '';
      const unit = sp.get('unit') ?? '';
      const page = parseInt(sp.get('page') || '1', 10) || 1;
      const pageSize = parseInt(sp.get('pageSize') || '25', 10) || 25;

      if (!itemKey) {
        return NextResponse.json({ error: 'itemKey is required' }, { status: 400 });
      }

      const detail = await fetchItemDetailPurchases({
        brandId,
        shopId,
        startDate,
        endDate,
        itemKey,
        unit,
        kind,
        page,
        pageSize,
      });

      return NextResponse.json({
        ...detail,
        isAllShops: shopId === 'all',
      });
    }

    const summary = await fetchItemWiseSummary({
      brandId,
      shopId,
      startDate,
      endDate,
      kind,
      category,
      search,
      sortBy,
      sortDir,
    });

    // Action 2: Default JSON summary
    if (action === 'summary') {
      return NextResponse.json(summary);
    }

    const singleItemKey = sp.get('singleItemKey');
    const singleItemUnit = sp.get('singleItemUnit') ?? '';
    const includeDetails = sp.get('includeDetails') === 'true';

    const allGroups = await fetchAllGroupedItemDetailsForExport({
      brandId,
      shopId,
      startDate,
      endDate,
      kind,
      category,
      search,
    });

    const filteredGroups = singleItemKey
      ? allGroups.filter(
          (g) => g.itemKey === singleItemKey && g.unit === singleItemUnit
        )
      : allGroups;

    // Fetch Daily Summaries for Excel Sheet 3 ("Daily Summary")
    let dailySummaries: Array<{
      date: string;
      opening: number;
      income: number;
      expense: number;
      net: number;
      closing: number;
    }> = [];

    if (action === 'excel' && !singleItemKey) {
      if (isSupabaseConfigured()) {
        const supabase = (await createClient()) as any;
        let dq = supabase
          .from('daily_summary')
          .select('summary_date, opening, income, expense, closing, shops!inner(brand_id)')
          .eq('shops.brand_id', brandId)
          .gte('summary_date', startDate)
          .lte('summary_date', endDate)
          .order('summary_date', { ascending: true });
        if (shopId !== 'all') {
          dq = dq.eq('shop_id', shopId);
        }
        const { data: dRows } = await dq;
        const map = new Map<
          string,
          { opening: number; income: number; expense: number; closing: number }
        >();
        (dRows || []).forEach((r: any) => {
          const prev = map.get(r.summary_date) || {
            opening: 0,
            income: 0,
            expense: 0,
            closing: 0,
          };
          prev.opening += Number(r.opening) || 0;
          prev.income += Number(r.income) || 0;
          prev.expense += Number(r.expense) || 0;
          prev.closing += Number(r.closing) || 0;
          map.set(r.summary_date, prev);
        });
        dailySummaries = Array.from(map.entries()).map(([d, v]) => ({
          date: formatDate(d),
          opening: v.opening,
          income: v.income,
          expense: v.expense,
          net: v.income - v.expense,
          closing: v.closing,
        }));
      } else {
        dailySummaries = [
          {
            date: formatDate(startDate),
            opening: 25000,
            income: 28450,
            expense: 11200,
            net: 17250,
            closing: 42250,
          },
          {
            date: formatDate(endDate),
            opening: 42250,
            income: 31900,
            expense: 12800,
            net: 19100,
            closing: 61350,
          },
        ];
      }
    }

    // Action 3: Excel Export
    if (action === 'excel') {
      const targetGroup = filteredGroups[0];
      const singleLabel = singleItemKey && targetGroup
        ? `${targetGroup.itemName}${targetGroup.unit ? ` (${targetGroup.unit})` : ''}`
        : undefined;

      const buffer = await generateItemWiseExcelBuffer({
        summary,
        groups: filteredGroups,
        dailySummaries,
        singleItemTitle: singleLabel,
      });

      const safeBrand = summary.brand.name.replace(/\s+/g, '_');
      const filename = singleLabel
        ? `${safeBrand}_${targetGroup.itemName.replace(/\s+/g, '_')}_${startDate}_${endDate}.xlsx`
        : `${safeBrand}_ItemWise_Report_${startDate}_${endDate}.xlsx`;

      return new NextResponse(buffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    // Action 4: PDF Export (full summary OR single item)
    if (action === 'pdf') {
      if (singleItemKey && filteredGroups.length > 0) {
        const grp = filteredGroups[0];
        const pdfBuf = await generateSingleItemPdfReport({
          summary,
          group: grp,
        });
        const filename = `${summary.brand.name.replace(/\s+/g, '_')}_${grp.itemName.replace(/\s+/g, '_')}_${startDate}_${endDate}.pdf`;
        return new NextResponse(pdfBuf as unknown as BodyInit, {
          status: 200,
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="${filename}"`,
          },
        });
      }

      const pdfBuf = await generateItemWisePdfReport({
        summary,
        groups: filteredGroups,
        includeDetails,
      });
      const filename = `${summary.brand.name.replace(/\s+/g, '_')}_ItemWise_Summary_${startDate}_${endDate}.pdf`;

      return new NextResponse(pdfBuf as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Item-wise API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to build item-wise report' },
      { status: 500 }
    );
  }
}


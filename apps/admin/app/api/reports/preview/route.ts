import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { getCurrentMonthKolkata, getMonthBounds } from '@/lib/calculations/dates';
import { buildReportData } from '@/lib/reports/builder';
import { buildBrandConsolidatedReport } from '@/lib/reports/brand-builder';
import {
  fetchAllGroupedItemDetailsForExport,
  fetchItemWiseSummary,
} from '@/lib/reports/item-wise';
import { ReportKindOption } from '@/lib/reports/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserContext();
    if (!user || !user.brandId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const sp = request.nextUrl.searchParams;
    const month = sp.get('month') || getCurrentMonthKolkata();
    const bounds = getMonthBounds(month);
    const startDate = sp.get('startDate') || bounds.start;
    const endDate = sp.get('endDate') || bounds.end;
    const requestedShopId = sp.get('shopId') || 'all';
    const shopId = user.role === 'manager' ? user.shopId || '' : requestedShopId;

    const rtParam = sp.get('reportType');
    const reportType: ReportKindOption =
      rtParam === 'daily_summary' ||
      rtParam === 'item_wise' ||
      rtParam === 'salary' ||
      rtParam === 'full'
        ? rtParam
        : 'daily_summary';
    const includeItemDetails = sp.get('includeDetails') === 'true';

    if (reportType === 'item_wise') {
      const summary = await fetchItemWiseSummary({
        brandId: user.brandId,
        shopId,
        startDate,
        endDate,
        kind: (sp.get('kind') as any) || 'both',
        category: sp.get('category') || null,
        search: sp.get('search') || null,
      });
      const groups = includeItemDetails
        ? await fetchAllGroupedItemDetailsForExport({
            brandId: user.brandId,
            shopId,
            startDate,
            endDate,
            kind: (sp.get('kind') as any) || 'both',
            category: sp.get('category') || null,
            search: sp.get('search') || null,
          })
        : [];
      return NextResponse.json({
        mode: 'item_wise',
        brand: summary.brand,
        shopLabel: summary.shopLabel,
        summary,
        groups,
      });
    }

    if (shopId === 'all' && user.role === 'admin') {
      const bundle = await buildBrandConsolidatedReport({
        brandId: user.brandId,
        shopId: 'all',
        startDate,
        endDate,
        month,
        reportType,
        includeItemDetails,
      });
      return NextResponse.json({
        mode: 'brand',
        brand: bundle.pdfData.brand,
        bundle,
      });
    }

    const reportData = await buildReportData({
      shopId,
      startDate,
      endDate,
      month,
      reportType,
      includeItemDetails,
    });
    if (!reportData) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    return NextResponse.json({
      mode: 'shop',
      brand: reportData.brand,
      reportData,
    });
  } catch (error: any) {
    console.error('Report preview error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to build report preview' },
      { status: 500 }
    );
  }
}


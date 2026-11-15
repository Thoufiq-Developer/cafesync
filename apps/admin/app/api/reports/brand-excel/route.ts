import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { getCurrentMonthKolkata, getMonthBounds } from '@/lib/calculations/dates';
import {
  buildBrandConsolidatedReport,
  generateBrandConsolidatedExcel,
} from '@/lib/reports/brand-builder';
import {
  fetchAllGroupedItemDetailsForExport,
  fetchItemWiseSummary,
  generateItemWiseExcelBuffer,
} from '@/lib/reports/item-wise';
import { ReportKindOption } from '@/lib/reports/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserContext();
    if (!user || user.role !== 'admin' || !user.brandId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const currentMonth = getCurrentMonthKolkata();
    const month = searchParams.get('month') || currentMonth;
    const bounds = getMonthBounds(month);
    const startDate = searchParams.get('startDate') || bounds.start;
    const endDate = searchParams.get('endDate') || bounds.end;
    const shopFilter = searchParams.get('shopId') || 'all';

    const rtParam = searchParams.get('reportType');
    const reportType: ReportKindOption =
      rtParam === 'daily_summary' ||
      rtParam === 'item_wise' ||
      rtParam === 'salary' ||
      rtParam === 'full'
        ? rtParam
        : 'daily_summary';

    const bundle = await buildBrandConsolidatedReport({
      brandId: user.brandId,
      shopId: shopFilter,
      startDate,
      endDate,
      month,
      reportType: reportType === 'item_wise' ? 'full' : reportType,
      includeItemDetails: true,
    });

    if (reportType === 'item_wise') {
      const summary = await fetchItemWiseSummary({
        brandId: user.brandId,
        shopId: shopFilter,
        startDate,
        endDate,
        kind: 'both',
      });
      const groups = await fetchAllGroupedItemDetailsForExport({
        brandId: user.brandId,
        shopId: shopFilter,
        startDate,
        endDate,
        kind: 'both',
      });
      const buf = await generateItemWiseExcelBuffer({
        summary,
        groups,
        dailySummaries: bundle.dailySummaries,
      });
      const filename = `${summary.brand.name.replace(/\s+/g, '_')}_ItemWise_${startDate}_${endDate}.xlsx`;
      return new NextResponse(buf as any, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const buffer = await generateBrandConsolidatedExcel(bundle);
    const filename = `${bundle.pdfData.brand.name.replace(/\s+/g, '_')}_${reportType}_${startDate}_${endDate}.xlsx`;

    return new NextResponse(buffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Brand excel error:', error);
    return NextResponse.json({ error: error.message || 'Report generation failed' }, { status: 500 });
  }
}

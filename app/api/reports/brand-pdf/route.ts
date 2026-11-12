import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { getCurrentMonthKolkata, getMonthBounds } from '@/lib/calculations/dates';
import { generateBrandConsolidatedPdf } from '@/lib/reports/brand-pdf';
import { buildBrandConsolidatedReport } from '@/lib/reports/brand-builder';
import {
  fetchAllGroupedItemDetailsForExport,
  fetchItemWiseSummary,
} from '@/lib/reports/item-wise';
import { generateItemWisePdfReport } from '@/lib/reports/item-wise-pdf';
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
    const includeItemDetails = searchParams.get('includeDetails') === 'true';

    if (reportType === 'item_wise') {
      const summary = await fetchItemWiseSummary({
        brandId: user.brandId,
        shopId: shopFilter,
        startDate,
        endDate,
        kind: 'both',
      });
      const groups = includeItemDetails
        ? await fetchAllGroupedItemDetailsForExport({
            brandId: user.brandId,
            shopId: shopFilter,
            startDate,
            endDate,
            kind: 'both',
          })
        : [];
      const pdfBuf = await generateItemWisePdfReport({
        summary,
        groups,
        includeDetails: includeItemDetails,
      });
      const filename = `${summary.brand.name.replace(/\s+/g, '_')}_ItemWise_${startDate}_${endDate}.pdf`;
      return new NextResponse(pdfBuf as any, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const bundle = await buildBrandConsolidatedReport({
      brandId: user.brandId,
      shopId: shopFilter,
      startDate,
      endDate,
      month,
      reportType,
      includeItemDetails,
    });

    const pdfBuffer = await generateBrandConsolidatedPdf(bundle.pdfData);
    const filename = `${bundle.pdfData.brand.name.replace(/\s+/g, '_')}_${reportType}_${startDate}_${endDate}.pdf`;

    return new NextResponse(pdfBuffer as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Brand PDF error:', error);
    return NextResponse.json({ error: error.message || 'PDF generation failed' }, { status: 500 });
  }
}

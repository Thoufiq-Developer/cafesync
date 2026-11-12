import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { buildReportData } from '@/lib/reports/builder';
import { generatePdfReport } from '@/lib/reports/pdf';
import {
  fetchAllGroupedItemDetailsForExport,
  fetchItemWiseSummary,
} from '@/lib/reports/item-wise';
import { generateItemWisePdfReport } from '@/lib/reports/item-wise-pdf';
import { ReportKindOption } from '@/lib/reports/types';
import { getMonthBounds, getCurrentMonthKolkata } from '@/lib/calculations/dates';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserContext();
    if (!user || !user.brandId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const requestedShopId = searchParams.get('shopId');
    const shopId = user.role === 'manager' ? user.shopId || '' : requestedShopId || '';
    const month = searchParams.get('month') || getCurrentMonthKolkata();
    const bounds = getMonthBounds(month);
    const startDate = searchParams.get('startDate') || bounds.start;
    const endDate = searchParams.get('endDate') || bounds.end;

    const rtParam = searchParams.get('reportType');
    const reportType: ReportKindOption =
      rtParam === 'daily_summary' ||
      rtParam === 'item_wise' ||
      rtParam === 'salary' ||
      rtParam === 'full'
        ? rtParam
        : 'full';
    const includeItemDetails = searchParams.get('includeDetails') === 'true';

    if (!shopId) {
      return NextResponse.json({ error: 'shopId is required' }, { status: 400 });
    }

    if (user.role === 'admin' && isSupabaseConfigured()) {
      const supabase = (await createClient()) as any;
      const { data: shopCheck } = await supabase
        .from('shops')
        .select('id')
        .eq('id', shopId)
        .eq('brand_id', user.brandId)
        .maybeSingle();
      if (!shopCheck) {
        return NextResponse.json({ error: 'Forbidden: Shop not in your brand' }, { status: 403 });
      }
    }

    if (reportType === 'item_wise') {
      const summary = await fetchItemWiseSummary({
        brandId: user.brandId,
        shopId,
        startDate,
        endDate,
        kind: 'both',
      });
      const groups = includeItemDetails
        ? await fetchAllGroupedItemDetailsForExport({
            brandId: user.brandId,
            shopId,
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
      const filename = `${summary.brand.name.replace(/\s+/g, '_')}_ItemWise_${month}.pdf`;
      return new NextResponse(pdfBuf as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
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
      return NextResponse.json({ error: 'Shop or Brand not found' }, { status: 404 });
    }

    const pdfBuffer = await generatePdfReport(reportData);
    const filename = `${reportData.brand.name.replace(/\s+/g, '_')}_${reportData.shop.code}_${reportType}_${month}.pdf`;

    return new NextResponse(pdfBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('PDF Generation Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

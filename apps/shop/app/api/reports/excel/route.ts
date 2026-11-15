import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { buildReportData } from '@/lib/reports/builder';
import { generateExcelReport } from '@/lib/reports/excel';
import {
  fetchAllGroupedItemDetailsForExport,
  fetchItemWiseSummary,
  generateItemWiseExcelBuffer,
} from '@/lib/reports/item-wise';
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

    const reportData = await buildReportData({
      shopId,
      startDate,
      endDate,
      month,
      reportType: reportType === 'item_wise' ? 'full' : reportType,
      includeItemDetails: true,
    });

    if (!reportData) {
      return NextResponse.json({ error: 'Shop or Brand not found' }, { status: 404 });
    }

    if (reportType === 'item_wise') {
      const summary = await fetchItemWiseSummary({
        brandId: user.brandId,
        shopId,
        startDate,
        endDate,
        kind: 'both',
      });
      const groups = await fetchAllGroupedItemDetailsForExport({
        brandId: user.brandId,
        shopId,
        startDate,
        endDate,
        kind: 'both',
      });
      const excelBuffer = await generateItemWiseExcelBuffer({
        summary,
        groups,
        dailySummaries: reportData.dailySummaries,
      });
      const filename = `${reportData.brand.name.replace(/\s+/g, '_')}_${reportData.shop.code}_ItemWise_${month}.xlsx`;
      return new NextResponse(excelBuffer as unknown as BodyInit, {
        status: 200,
        headers: {
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    const excelBuffer = await generateExcelReport(reportData);
    const filename = `${reportData.brand.name.replace(/\s+/g, '_')}_${reportData.shop.code}_${reportType}_${month}.xlsx`;

    return new NextResponse(excelBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error('Excel Generation Error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

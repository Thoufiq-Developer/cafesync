// ==============================================================================
// CafeSync - Admin Panel Full Backup Download API Route
// Scoped to the authenticated brand admin's own brand
// Outputs the unified CafeSync standard ZIP backup format with no row caps
// ==============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUserContext } from '@/lib/auth';
import { exportBackup } from '@/lib/backup/export';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserContext();
    if (!user || user.role !== 'admin' || !user.brandId) {
      return NextResponse.json(
        { error: 'Unauthorized. Brand Administrator access required.' },
        { status: 401 }
      );
    }

    const supabase = (await createClient()) as any;

    // Use unified backup export engine scoped to the admin's brand
    const result = await exportBackup(supabase, {
      scope: 'brand',
      brandId: user.brandId,
      includeLogos: true,
    });

    const arrayBuffer = await result.blob.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('Brand admin backup generation error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to generate brand backup archive.' },
      { status: 500 }
    );
  }
}

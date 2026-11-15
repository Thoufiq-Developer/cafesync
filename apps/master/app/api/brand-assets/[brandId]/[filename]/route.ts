import { NextRequest, NextResponse } from 'next/server';
import { readLocalBrandAsset } from '@/lib/theme/store';

export const dynamic = 'force-dynamic';

function detectContentType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ brandId: string; filename: string }> }
) {
  const { brandId, filename } = await params;
  const buffer = readLocalBrandAsset(brandId, filename);
  if (!buffer) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': detectContentType(filename),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}


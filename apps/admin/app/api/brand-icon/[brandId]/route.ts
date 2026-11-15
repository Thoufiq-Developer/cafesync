import { NextRequest, NextResponse } from 'next/server';
import { getBrandThemeById } from '@/lib/theme/server';
import { pickReadableTextColor, normalizeHex } from '@/lib/theme/colors';
import { generateBrandBadgePng } from '@/lib/theme/store';

export const dynamic = 'force-dynamic';

function extractInitials(name: string): string {
  const words = (name || 'CB')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0 && w !== '&');
  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }
  return (words[0] || 'C').slice(0, 2).toUpperCase();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ brandId: string }> }
) {
  const { brandId } = await params;
  const searchParams = request.nextUrl.searchParams;
  const variant = searchParams.get('variant') || 'icon';
  const format = searchParams.get('format') || 'svg';
  const sizeParam = Number(searchParams.get('size') || (variant === 'icon' ? 96 : 128));
  const size = Math.min(512, Math.max(32, isNaN(sizeParam) ? 96 : sizeParam));

  const bundle = await getBrandThemeById(brandId);
  const settings = bundle.settings;
  const primary = normalizeHex(settings.primary_color, '#ea580c');
  const secondary = normalizeHex(settings.secondary_color, '#9a3412');
  const accent = normalizeHex(settings.accent_color, '#f59e0b');
  const fg = pickReadableTextColor(primary, '#ffffff', '#0f172a');
  const initials = extractInitials(settings.display_name || bundle.brand.name);

  if (format === 'png') {
    const pngBuffer = generateBrandBadgePng(primary, secondary, size);
    return new NextResponse(new Uint8Array(pngBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  const rx = settings.radius === 'sharp' ? 6 : settings.radius === 'pill' ? 48 : 22;

  const svg =
    variant === 'logo'
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" fill="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${primary}" />
      <stop offset="100%" stop-color="${secondary}" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="${rx}" fill="url(#bg)" />
  <circle cx="64" cy="64" r="46" stroke="${fg}" stroke-opacity="0.22" stroke-width="2.5" />
  <circle cx="98" cy="30" r="8" fill="${accent}" />
  <text x="64" y="75" text-anchor="middle" fill="${fg}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-weight="800" font-size="42" letter-spacing="1">${initials}</text>
</svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96" fill="none">
  <defs>
    <linearGradient id="ibg" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="${primary}" />
      <stop offset="100%" stop-color="${secondary}" />
    </linearGradient>
  </defs>
  <rect width="96" height="96" rx="${Math.round(rx * 0.75)}" fill="url(#ibg)" />
  <text x="48" y="59" text-anchor="middle" fill="${fg}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-weight="800" font-size="34">${initials}</text>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}


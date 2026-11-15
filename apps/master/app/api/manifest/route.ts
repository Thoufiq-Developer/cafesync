import { NextRequest, NextResponse } from 'next/server';
import { getBrandLoginBySlug, getBrandThemeById } from '@/lib/theme/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const brandQuery = request.nextUrl.searchParams.get('brand')?.trim();
  const roleParam = request.nextUrl.searchParams.get('role')?.trim();

  let brandName = 'CafeLedger';
  let description = 'Multi-Tenant White-Label Cafe Accounts Platform';
  let themeColor = '#ea580c';
  let backgroundColor = '#ffffff';
  let brandId = '';
  let slug = '';
  let customIconUrl: string | null = null;

  if (brandQuery) {
    // Check UUID vs slug cleanly
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(brandQuery);
    if (isUuid) {
      const bundle = await getBrandThemeById(brandQuery);
      brandId = bundle.brand.id;
      slug = bundle.brand.slug;
      brandName = bundle.settings.display_name || bundle.brand.name;
      description = bundle.settings.tagline || `${brandName} Cafe Operations`;
      themeColor = bundle.settings.primary_color;
      backgroundColor = bundle.settings.default_mode === 'dark' ? '#0b1120' : '#ffffff';
      customIconUrl = bundle.settings.icon_url;
    } else {
      const loginBrand = await getBrandLoginBySlug(brandQuery);
      if (loginBrand) {
        brandId = loginBrand.brand_id;
        slug = loginBrand.slug;
        brandName = loginBrand.display_name || loginBrand.brand_name;
        description = loginBrand.tagline || `${brandName} Cafe Operations`;
        themeColor = loginBrand.primary_color;
        backgroundColor = loginBrand.default_mode === 'dark' ? '#0b1120' : '#ffffff';
        customIconUrl = loginBrand.icon_url;
      }
    }
  }

  const startUrl =
    roleParam === 'manager'
      ? '/shop'
      : roleParam === 'admin'
        ? '/admin'
        : slug
          ? `/login/${slug}`
          : '/login';

  const icons: Array<{ src: string; sizes: string; type: string; purpose?: string }> = [];

  if (brandId) {
    if (customIconUrl && !customIconUrl.startsWith('/api/brand-icon')) {
      icons.push({
        src: customIconUrl,
        sizes: 'any',
        type: customIconUrl.endsWith('.svg') ? 'image/svg+xml' : 'image/png',
        purpose: 'any maskable',
      });
    }
    icons.push(
      {
        src: `/api/brand-icon/${brandId}?format=png&size=192`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: `/api/brand-icon/${brandId}?format=png&size=512`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      }
    );
  } else {
    icons.push({
      src: '/api/brand-icon/11111111-1111-1111-1111-111111111111?format=png&size=192',
      sizes: '192x192',
      type: 'image/png',
    });
  }

  const shortName =
    brandName.length > 14 ? brandName.split(' ').slice(0, 2).join(' ').slice(0, 14) : brandName;

  return NextResponse.json(
    {
      name: `${brandName} | CafeLedger`,
      short_name: shortName,
      description,
      start_url: startUrl,
      scope: '/',
      display: 'standalone',
      background_color: backgroundColor,
      theme_color: themeColor,
      icons,
    },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/manifest+json; charset=utf-8',
        'Cache-Control': 'no-cache, max-age=0',
      },
    }
  );
}


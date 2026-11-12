import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getAuthEmailMap } from '@/lib/supabase/user-emails';
import { getBrandThemeById } from '@/lib/theme/server';
import { resolvePdfSafeLogoDataUri } from '@/lib/reports/logo-helper';
import { getTodayKolkata } from '@/lib/calculations/dates';
import {
  generateBulkCredentialsSheetPdf,
  generateSingleCredentialPdf,
} from '@/lib/reports/credentials-pdf';
import { DEMO_ADMIN_SHOPS } from '@/lib/demo-admin-data';
import { DEMO_BRAND, DEMO_USERS } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

/**
 * GET /api/reports/credentials-pdf
 * Downloads the Bulk Credentials Directory A4 PDF for all shops in the Admin's brand.
 * Existing passwords are never stored or included.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUserContext();
    if (!user || user.role !== 'admin' || !user.brandId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const bundle = await getBrandThemeById(user.brandId);
    const pdfLogo = await resolvePdfSafeLogoDataUri(bundle.settings.logo_url, user.brandId);
    const origin = request.nextUrl.origin;
    const brandSlug = bundle.brand.slug || user.brand?.slug || 'brand';
    const loginUrl = `${origin}/login/${brandSlug}`;

    const rows: Array<{
      shopName: string;
      shopCode: string;
      status: string;
      managerName: string;
      username: string;
      loginUrl: string;
    }> = [];

    if (isSupabaseConfigured()) {
      const supabase = (await createClient()) as any;
      const emailMap = await getAuthEmailMap();

      const { data: shops } = await supabase
        .from('shops')
        .select('id, name, code, status, profiles!shop_id(id, full_name, username, role)')
        .eq('brand_id', user.brandId)
        .order('name', { ascending: true });

      (shops || []).forEach((s: any) => {
        const managers = Array.isArray(s.profiles)
          ? s.profiles.filter((p: any) => !p.role || p.role === 'manager')
          : [];
        if (managers.length === 0) {
          rows.push({
            shopName: s.name,
            shopCode: s.code,
            status: s.status || 'active',
            managerName: 'Not assigned',
            username: '-',
            loginUrl,
          });
        } else {
          managers.forEach((m: any) => {
            const authEmail = emailMap.get(m.id) || '';
            const derivedUser = m.username || (authEmail ? authEmail.split('@')[0] : '-');
            rows.push({
              shopName: s.name,
              shopCode: s.code,
              status: s.status || 'active',
              managerName: m.full_name || 'Manager',
              username: derivedUser,
              loginUrl,
            });
          });
        }
      });
    } else {
      const demoShops =
        user.brandId === DEMO_BRAND.id
          ? DEMO_ADMIN_SHOPS
          : Object.values(DEMO_USERS)
              .filter((u) => u.brand?.id === user.brandId && u.shop)
              .map((u) => ({
                name: u.shop!.name,
                code: u.shop!.code,
                status: 'active',
                managers: [
                  {
                    full_name: u.fullName,
                    email: u.email,
                  },
                ],
              }));

      demoShops.forEach((s: any) => {
        const mgr = s.managers?.[0];
        rows.push({
          shopName: s.name,
          shopCode: s.code,
          status: s.status || 'active',
          managerName: mgr?.full_name || 'Manager',
          username: mgr?.email ? mgr.email.split('@')[0] : s.code.toLowerCase(),
          loginUrl,
        });
      });
    }

    const pdfBuffer = await generateBulkCredentialsSheetPdf({
      brand: {
        name: bundle.settings.display_name || bundle.brand.name,
        logoUrl: pdfLogo,
        primaryColor: bundle.settings.primary_color,
        secondaryColor: bundle.settings.secondary_color,
        slug: brandSlug,
        generatedAt: getTodayKolkata(),
        footerText: bundle.settings.pdf_footer_text,
      },
      rows,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${brandSlug}-shop-logins.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Bulk credentials PDF error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to generate credentials directory PDF' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reports/credentials-pdf
 * Generates a one-time printable slip PDF immediately after shop/manager provisioning or password reset.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUserContext();
    if (!user || user.role !== 'admin' || !user.brandId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const shopName = String(body.shopName || '').trim();
    const shopCode = String(body.shopCode || 'SHOP').trim();
    const managerName = String(body.managerName || '').trim();
    const username = String(body.username || '').trim();
    const temporaryPassword = String(body.temporaryPassword || '').trim();
    const loginUrl = String(body.loginUrl || '').trim();

    if (!shopName || !username || !temporaryPassword) {
      return NextResponse.json({ error: 'Missing required credential fields' }, { status: 400 });
    }

    const bundle = await getBrandThemeById(user.brandId);
    const pdfLogo = await resolvePdfSafeLogoDataUri(bundle.settings.logo_url, user.brandId);
    const brandSlug = bundle.brand.slug || user.brand?.slug || 'brand';

    const pdfBuffer = await generateSingleCredentialPdf({
      brand: {
        name: bundle.settings.display_name || bundle.brand.name,
        logoUrl: pdfLogo,
        primaryColor: bundle.settings.primary_color,
        secondaryColor: bundle.settings.secondary_color,
        slug: brandSlug,
        generatedAt: getTodayKolkata(),
        footerText: bundle.settings.pdf_footer_text,
      },
      shopName,
      shopCode,
      managerName: managerName || 'Shop Manager',
      username,
      temporaryPassword,
      loginUrl: loginUrl || `${request.nextUrl.origin}/login/${brandSlug}`,
    });

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${username}-credentials.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('Single credential PDF error:', err);
    return NextResponse.json(
      { error: err?.message || 'Failed to generate credential slip PDF' },
      { status: 500 }
    );
  }
}

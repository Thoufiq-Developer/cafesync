import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { getBrandThemeById } from '@/lib/theme/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const user = await getCurrentUserContext();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (user.role === 'master' || !user.brandId) {
    return NextResponse.json(
      { error: 'Theme mode switching applies only to brand admins and shop managers.' },
      { status: 403 }
    );
  }

  let requestedMode: string | undefined;
  try {
    const body = await request.json();
    requestedMode = body?.mode;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (requestedMode !== 'light' && requestedMode !== 'dark') {
    return NextResponse.json({ error: 'Mode must be light or dark.' }, { status: 400 });
  }

  const bundle = await getBrandThemeById(user.brandId);
  if (!bundle.settings.allow_user_mode_switch) {
    return NextResponse.json(
      { error: 'Theme mode switching has been locked by Platform Master for this brand.' },
      { status: 403 }
    );
  }

  if (isSupabaseConfigured()) {
    try {
      const supabase = (await createClient()) as any;
      await supabase
        .from('profiles')
        .update({ theme_mode: requestedMode })
        .eq('id', user.id);
    } catch {
      // fall through to cookie update
    }
  }

  const response = NextResponse.json({ success: true, mode: requestedMode });
  response.cookies.set(`cafeledger_theme_mode_${user.brandId}`, requestedMode, {
    path: '/',
    maxAge: 60 * 60 * 24 * 90,
    sameSite: 'lax',
  });

  return response;
}


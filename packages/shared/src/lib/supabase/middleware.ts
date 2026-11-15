import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { Database, UserRole } from './types';
import { isSupabaseConfigured } from './config';

export interface UserSessionProfile {
  id: string;
  email: string | null;
  role: UserRole;
  brand_id: string | null;
  shop_id: string | null;
  full_name: string;
  is_active: boolean;
  must_change_password: boolean;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // 1. Static assets and internal routes should bypass immediately
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.includes('.') ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next({ request });
  }

  const rolePanelMap: Record<UserRole, string> = {
    master: '/master',
    admin: '/admin',
    manager: '/shop',
  };

  const isLoginPage = pathname.startsWith('/login');
  const configured = isSupabaseConfigured();

  // 2. Demo Mode session cookie ONLY applies when Supabase is NOT configured
  const demoCookie = request.cookies.get('cafeledger_demo_user')?.value;
  if (!configured) {
    let demoRole: UserRole | null = null;
    if (demoCookie) {
      try {
        const parsed = JSON.parse(demoCookie);
        demoRole = parsed.role;
      } catch {
        // ignore malformed cookie
      }
    }

    if (demoRole) {
      const targetPanel = rolePanelMap[demoRole] || '/login';

      if (isLoginPage || pathname === '/') {
        const url = request.nextUrl.clone();
        url.pathname = targetPanel;
        return NextResponse.redirect(url);
      }

      if (pathname.startsWith('/master') && demoRole !== 'master') {
        const url = request.nextUrl.clone();
        url.pathname = targetPanel;
        return NextResponse.redirect(url);
      }
      if (pathname.startsWith('/admin') && demoRole !== 'admin') {
        const url = request.nextUrl.clone();
        url.pathname = targetPanel;
        return NextResponse.redirect(url);
      }
      if (pathname.startsWith('/shop') && demoRole !== 'manager') {
        const url = request.nextUrl.clone();
        url.pathname = targetPanel;
        return NextResponse.redirect(url);
      }

      return NextResponse.next({ request });
    }

    if (pathname.startsWith('/master') || pathname.startsWith('/admin') || pathname.startsWith('/shop')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  // 3. Live Supabase instance configured: validate session (ignore/clear any stale demo cookie)
  let supabaseResponse = NextResponse.next({
    request,
  });

  if (demoCookie) {
    supabaseResponse.cookies.set('cafeledger_demo_user', '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
    });
  }

  const withClearedDemo = (res: NextResponse) => {
    if (demoCookie) {
      res.cookies.set('cafeledger_demo_user', '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });
    }
    return res;
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // If not logged in and requesting a protected panel, redirect to /login
    if (pathname.startsWith('/master') || pathname.startsWith('/admin') || pathname.startsWith('/shop')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return withClearedDemo(NextResponse.redirect(url));
    }
    return supabaseResponse;
  }

  // Fetch profile to check role and status
  const { data: profile } = (await supabase
    .from('profiles')
    .select('id, role, brand_id, shop_id, full_name, is_active, must_change_password')
    .eq('id', user.id)
    .single()) as {
    data: UserSessionProfile | null;
    error: any;
  };

  if (!profile || !profile.is_active) {
    if (!isLoginPage) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'inactive_account');
      return withClearedDemo(NextResponse.redirect(url));
    }
    return supabaseResponse;
  }

  const role: UserRole = profile.role;
  const targetPanel = rolePanelMap[role] || '/login';

  // If user is on /login or root /, redirect directly to their dashboard
  if (isLoginPage || pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = targetPanel;
    return withClearedDemo(NextResponse.redirect(url));
  }

  // Check panel access isolation
  if (pathname.startsWith('/master') && role !== 'master') {
    const url = request.nextUrl.clone();
    url.pathname = targetPanel;
    return withClearedDemo(NextResponse.redirect(url));
  }

  if (pathname.startsWith('/admin') && role !== 'admin') {
    const url = request.nextUrl.clone();
    url.pathname = targetPanel;
    return withClearedDemo(NextResponse.redirect(url));
  }

  if (pathname.startsWith('/shop') && role !== 'manager') {
    const url = request.nextUrl.clone();
    url.pathname = targetPanel;
    return withClearedDemo(NextResponse.redirect(url));
  }

  return supabaseResponse;
}

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { Database, UserRole, isSupabaseConfigured } from '@cafesync/shared';

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

export async function middleware(request: NextRequest) {
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
      if (demoRole !== 'master') {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        url.searchParams.set('error', 'unauthorized_role');
        const res = NextResponse.redirect(url);
        res.cookies.set('cafeledger_demo_user', '', { path: '/', maxAge: 0, expires: new Date(0) });
        return res;
      }

      if (isLoginPage || pathname === '/') {
        const url = request.nextUrl.clone();
        url.pathname = '/master';
        return NextResponse.redirect(url);
      }

      return NextResponse.next({ request });
    }

    if (pathname.startsWith('/master')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next({ request });
  }

  // 3. Live Supabase instance configured: validate session
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
    if (pathname.startsWith('/master')) {
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

  // Master app ONLY allows role 'master'
  if (role !== 'master') {
    if (isLoginPage) {
      return supabaseResponse;
    }
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL || process.env.ADMIN_APP_URL;
    const shopUrl = process.env.NEXT_PUBLIC_SHOP_APP_URL || process.env.SHOP_APP_URL;
    if (role === 'admin' && adminUrl) {
      return withClearedDemo(NextResponse.redirect(new URL('/admin', adminUrl)));
    }
    if (role === 'manager' && shopUrl) {
      return withClearedDemo(NextResponse.redirect(new URL('/shop', shopUrl)));
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('error', 'unauthorized_role');
    return withClearedDemo(NextResponse.redirect(url));
  }

  // If user is master on /login or root /, redirect directly to /master
  if (isLoginPage || pathname === '/') {
    const url = request.nextUrl.clone();
    url.pathname = '/master';
    return withClearedDemo(NextResponse.redirect(url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};


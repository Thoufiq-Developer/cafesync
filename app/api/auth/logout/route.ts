import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export async function GET(request: Request) {
  const cookieStore = await cookies();

  // Clear demo session cookie
  cookieStore.delete('cafeledger_demo_user');
  cookieStore.set('cafeledger_demo_user', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  // Clear Supabase session if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }

  const url = new URL('/login', request.url);
  const response = NextResponse.redirect(url);
  response.cookies.delete('cafeledger_demo_user');
  response.cookies.set('cafeledger_demo_user', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  return response;
}

export async function POST(request: Request) {
  return GET(request);
}


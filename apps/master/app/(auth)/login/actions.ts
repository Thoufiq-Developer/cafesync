'use server';

import { createClient } from '@/lib/supabase/server';
import { tryGetAdminClient } from '@cafesync/shared/server-admin';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { UserRole } from '@/lib/supabase/types';
import { DEMO_USERS } from '@/lib/demo-data';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { findDemoThemeById } from '@/lib/theme/store';
import { slugifyUsername } from '@/lib/passwords';

export async function loginAction(prevState: any, formData: FormData) {
  const identifier = (formData.get('email') as string)?.trim().toLowerCase();
  const password = formData.get('password') as string;
  const redirectTo = formData.get('redirect') as string;
  const expectedBrandId = (formData.get('expectedBrandId') as string)?.trim() || '';

  if (!identifier || !password) {
    return { error: 'Please enter both username/email and password.' };
  }

  const rolePanelMap: Record<UserRole, string> = {
    master: '/master',
    admin: '/admin',
    manager: '/shop',
  };

  const configured = isSupabaseConfigured();

  // Resolve Demo User either by email or username when Supabase is not configured
  const findDemoUser = () => {
    if (DEMO_USERS[identifier]) return DEMO_USERS[identifier];
    if (identifier.includes('@')) return undefined;
    return Object.values(DEMO_USERS).find((u) => {
      if (expectedBrandId && (u.role === 'master' || u.brand?.id !== expectedBrandId)) {
        return false;
      }
      const prefix = u.email.split('@')[0].toLowerCase();
      const shopCodeSlug = u.shop?.code ? slugifyUsername(u.shop.code) : '';
      return prefix === identifier || (shopCodeSlug && shopCodeSlug === identifier);
    });
  };

  const demoUser = findDemoUser();
  if (demoUser && password === 'password123' && !configured) {
    if ((demoUser.role as string) !== 'master') {
      return { error: 'This portal is for platform administrators only. Please sign in to your assigned portal.' };
    }
    if (expectedBrandId) {
      if (demoUser.role === 'master' || demoUser.brand?.id !== expectedBrandId) {
        return { error: 'This account is not registered under this brand portal.' };
      }
    }

    if (demoUser.brand?.id) {
      const demoTheme = findDemoThemeById(demoUser.brand.id);
      if (demoTheme?.brand.status === 'suspended') {
        return { error: 'This brand organization is currently suspended. Contact CafeLedger support.' };
      }
    }

    const cookieStore = await cookies();
    cookieStore.set(
      'cafeledger_demo_user',
      JSON.stringify({
        id: demoUser.id,
        email: demoUser.email,
        role: demoUser.role,
        fullName: demoUser.fullName,
      }),
      {
        path: '/',
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax',
      }
    );

    const targetPanel = rolePanelMap[demoUser.role] || '/login';
    if (redirectTo && redirectTo.startsWith(targetPanel)) {
      redirect(redirectTo);
    }
    redirect(targetPanel);
  }

  if (!configured) {
    return {
      error:
        'Invalid demo credentials. Click one of the Quick Test Fill buttons below or configure Supabase in .env.local.',
    };
  }

  // Try authenticating with Supabase
  try {
    const supabase = await createClient();
    let loginEmail = identifier;

    // Support USERNAME login by resolving profiles.username -> auth user's canonical email
    if (!identifier.includes('@')) {
      const adminSupabase = tryGetAdminClient() as any;
      if (!adminSupabase) {
        return {
          error:
            'Username login requires server service role configuration, or please sign in with your full email.',
        };
      }

      let lookup = adminSupabase
        .from('profiles')
        .select('id, brand_id, username')
        .ilike('username', identifier);
      if (expectedBrandId) {
        lookup = lookup.eq('brand_id', expectedBrandId);
      }

      const { data: matches, error: lookupErr } = await lookup;
      if (lookupErr || !matches || matches.length === 0) {
        return { error: 'Invalid username or password.' };
      }
      if (!expectedBrandId && matches.length > 1) {
        return {
          error:
            'Multiple brands use this username. Please sign in from your brand login link (/login/your-brand).',
        };
      }

      const { data: authData, error: authLookupErr } =
        await adminSupabase.auth.admin.getUserById(matches[0].id);
      if (authLookupErr || !authData?.user?.email) {
        return { error: 'Invalid username or password.' };
      }

      loginEmail = authData.user.email;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error || !data.user) {
      return {
        error:
          error?.message ||
          'Invalid login credentials. Please check your username/email and password.',
      };
    }

    // Clear any stale demo cookie if present
    const cookieStore = await cookies();
    if (cookieStore.get('cafeledger_demo_user')) {
      cookieStore.delete('cafeledger_demo_user');
      cookieStore.set('cafeledger_demo_user', '', {
        path: '/',
        maxAge: 0,
        expires: new Date(0),
      });
    }

    // Fetch profile to verify role and active state
    const { data: profile, error: profileError } = (await supabase
      .from('profiles')
      .select('role, brand_id, shop_id, is_active, must_change_password')
      .eq('id', data.user.id)
      .single()) as {
      data: {
        role: UserRole;
        brand_id: string | null;
        shop_id: string | null;
        is_active: boolean;
        must_change_password: boolean;
      } | null;
      error: any;
    };

    if (profileError || !profile) {
      await supabase.auth.signOut();
      return {
        error: profileError?.message
          ? `Profile lookup failed: ${profileError.message}`
          : 'Profile not found. Ensure a matching row exists in public.profiles.',
      };
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      return { error: 'This account has been deactivated. Please contact your brand administrator.' };
    }

    if (profile.role === 'manager' && profile.shop_id) {
      const { data: shopRow } = (await supabase
        .from('shops')
        .select('status')
        .eq('id', profile.shop_id)
        .maybeSingle()) as { data: { status?: string } | null };

      if (shopRow?.status === 'inactive') {
        await supabase.auth.signOut();
        return { error: 'Your assigned shop is currently inactive. Please contact your brand administrator.' };
      }
    }

    if (profile.role !== 'master' && profile.brand_id) {
      const { data: brandRow } = (await supabase
        .from('brands')
        .select('status')
        .eq('id', profile.brand_id)
        .maybeSingle()) as { data: { status?: string } | null };

      if (brandRow?.status === 'suspended') {
        await supabase.auth.signOut();
        return { error: 'Your brand account is suspended. Please contact platform support.' };
      }
    }

    if (expectedBrandId && (profile.role === 'master' || profile.brand_id !== expectedBrandId)) {
      await supabase.auth.signOut();
      return { error: 'This account is not registered under this brand portal.' };
    }

    if (profile.role !== 'master') {
      await supabase.auth.signOut();
      return { error: 'This portal is for platform administrators only. Please sign in to your assigned portal.' };
    }

    const role: UserRole = profile.role;
    const defaultPanel = rolePanelMap[role] || '/login';

    if (redirectTo && redirectTo.startsWith(defaultPanel)) {
      redirect(redirectTo);
    }

    redirect(defaultPanel);
  } catch (err: any) {
    if (err?.digest && String(err.digest).startsWith('NEXT_REDIRECT')) {
      throw err;
    }
    return { error: err?.message || 'Connection to Supabase failed. Please check your .env credentials.' };
  }
}

export async function signOutAction() {
  const cookieStore = await cookies();
  cookieStore.delete('cafeledger_demo_user');
  cookieStore.set('cafeledger_demo_user', '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
  });

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
  }

  redirect('/login');
}

import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_USERS } from '@/lib/demo-data';
import { slugifyUsername } from '@/lib/passwords';

export interface LoginResult {
  success: boolean;
  error?: string;
  mustChangePassword?: boolean;
}

export async function loginWithCredentials(
  identifierRaw: string,
  passwordRaw: string,
  expectedBrandId?: string
): Promise<LoginResult> {
  const identifier = identifierRaw.trim().toLowerCase();
  const password = passwordRaw;

  if (!identifier || !password) {
    return { success: false, error: 'Please enter both username/email and password.' };
  }

  const configured = isSupabaseConfigured();

  // Demo Mode Handler
  if (!configured) {
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
    if (demoUser && password === 'password123') {
      if ((demoUser.role as string) !== 'manager') {
        return {
          success: false,
          error: 'This portal is for shop managers only. Please sign in to your administrator portal.',
        };
      }
      if (expectedBrandId && demoUser.brand?.id !== expectedBrandId) {
        return { success: false, error: 'This account is not registered under this brand portal.' };
      }

      localStorage.setItem(
        'cafesync_demo_user',
        JSON.stringify({
          id: demoUser.id,
          email: demoUser.email,
          role: demoUser.role,
          fullName: demoUser.fullName,
        })
      );

      return { success: true };
    }

    return {
      success: false,
      error: 'Invalid demo credentials. Click one of the Quick Test Fill buttons below or configure Supabase in .env.local.',
    };
  }

  // Live Supabase Authentication
  try {
    let loginEmail = identifier;

    // Resolve username to canonical email via safe RPC
    if (!identifier.includes('@')) {
      const { data: resolvedEmail, error: rpcErr } = await supabase.rpc(
        'get_login_email_for_username',
        {
          p_username: identifier,
          p_brand_id: expectedBrandId || null,
        }
      );

      if (rpcErr || !resolvedEmail) {
        return { success: false, error: 'Invalid username or password.' };
      }

      loginEmail = resolvedEmail;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error || !data.user) {
      return {
        success: false,
        error: error?.message || 'Invalid login credentials. Please check your username/email and password.',
      };
    }

    // Verify profile exists and is manager
    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('role, is_active, must_change_password')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profErr || !profile) {
      await supabase.auth.signOut();
      return { success: false, error: 'Profile lookup failed. Contact your administrator.' };
    }

    if (!profile.is_active) {
      await supabase.auth.signOut();
      return { success: false, error: 'This account has been deactivated. Please contact your brand administrator.' };
    }

    if (profile.role !== 'manager') {
      await supabase.auth.signOut();
      return { success: false, error: 'Access restricted: This portal is strictly for Shop Managers.' };
    }

    return {
      success: true,
      mustChangePassword: profile.must_change_password ?? false,
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Authentication failed.' };
  }
}

export async function completeFirstLoginPasswordChange(formData: {
  newPassword: string;
  confirmPassword: string;
}): Promise<{ success: boolean; error?: string }> {
  const { newPassword, confirmPassword } = formData;

  if (newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: 'Passwords do not match.' };
  }

  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return { success: false, error: 'Session expired. Please sign in again.' };
    }

    const { error: authErr } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (authErr) {
      return { success: false, error: authErr.message || 'Could not update password.' };
    }

    const { error: profErr } = await supabase
      .from('profiles')
      .update({
        must_change_password: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);

    if (profErr) {
      return { success: false, error: profErr.message || 'Could not clear password reset flag.' };
    }

    await supabase.from('audit_log').insert({
      user_id: session.user.id,
      action: 'UPDATE',
      table_name: 'profiles',
      record_id: session.user.id,
      new_data: { must_change_password: false, reason: 'First-login password set' },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unexpected error changing password.' };
  }
}


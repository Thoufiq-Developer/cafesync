'use server';

import { createClient } from '@/lib/supabase/server';
import { tryGetAdminClient } from '@cafesync/shared/server-admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getCurrentUserContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

export interface ChangePasswordResult {
  success: boolean;
  error?: string;
}

/**
 * Updates the signed-in user's password and clears `profiles.must_change_password`.
 * Never uses the client SDK directly for `must_change_password`; uses the server context.
 */
export async function completeFirstLoginPasswordChangeAction(formData: {
  newPassword: string;
  confirmPassword: string;
}): Promise<ChangePasswordResult> {
  const user = await getCurrentUserContext();
  if (!user) {
    return { success: false, error: 'Session expired. Please sign in again.' };
  }

  const newPassword = formData.newPassword || '';
  const confirmPassword = formData.confirmPassword || '';

  if (newPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  if (newPassword !== confirmPassword) {
    return { success: false, error: 'Passwords do not match.' };
  }

  if (!isSupabaseConfigured()) {
    // Demo mode gracefully succeeds
    return { success: true };
  }

  try {
    const supabase = await createClient();
    const adminSupabase = tryGetAdminClient() as any;

    if (adminSupabase) {
      const { error: authErr } = await adminSupabase.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });
      if (authErr) {
        return { success: false, error: authErr.message || 'Could not update password.' };
      }

      const { error: profErr } = await adminSupabase
        .from('profiles')
        .update({
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profErr) {
        return { success: false, error: profErr.message || 'Could not clear password reset flag.' };
      }
    } else {
      const { error: authErr } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (authErr) {
        return { success: false, error: authErr.message || 'Could not update password.' };
      }

      const { error: profErr } = await (supabase as any)
        .from('profiles')
        .update({
          must_change_password: false,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (profErr) {
        return { success: false, error: profErr.message || 'Could not finalize password update.' };
      }
    }

    await (supabase as any).from('audit_log').insert({
      user_id: user.id,
      action: 'UPDATE',
      table_name: 'profiles',
      record_id: user.id,
      new_data: { must_change_password: false, reason: 'First-login password set' },
    });

    revalidatePath('/admin');
    revalidatePath('/shop');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Unexpected error changing password.' };
  }
}

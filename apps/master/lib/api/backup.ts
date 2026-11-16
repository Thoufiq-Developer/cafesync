import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import {
  generateReadablePassword,
  buildSyntheticEmail,
  slugifyUsername,
} from '@/lib/passwords';
import { RecreatedUserCredential, UserToRecreate } from '@/lib/backup/types';

export interface RecreateUsersResult {
  success: boolean;
  credentials?: RecreatedUserCredential[];
  error?: string;
  count?: number;
}

export async function recreateAuthUsersAction(
  usersToRecreate: UserToRecreate[]
): Promise<RecreateUsersResult> {
  if (!usersToRecreate || usersToRecreate.length === 0) {
    return { success: true, credentials: [], count: 0 };
  }

  if (!isSupabaseConfigured()) {
    const credentials: RecreatedUserCredential[] = usersToRecreate.map((u) => {
      const resolvedUsername = u.username || slugifyUsername(u.full_name);
      return {
        id: u.id,
        brand_id: u.brand_id,
        role: u.role,
        full_name: u.full_name,
        email: u.email || buildSyntheticEmail(resolvedUsername, 'demo-brand'),
        username: resolvedUsername,
        tempPassword: generateReadablePassword(),
      };
    });
    return { success: true, credentials, count: credentials.length };
  }

  try {
    const { data: result, error: fnErr } = await supabase.functions.invoke('recreate-users', {
      body: { users: usersToRecreate },
    });

    if (fnErr || !result?.success) {
      return {
        success: false,
        error: result?.error || fnErr?.message || 'Failed to recreate users via Edge Function',
      };
    }

    const rawCreds = Array.isArray(result.credentials) ? result.credentials : [];
    const credentials: RecreatedUserCredential[] = rawCreds.map((c: any) => ({
      id: c.id,
      brand_id: c.brand_id,
      role: c.role,
      full_name: c.full_name,
      email: c.email,
      username: c.username,
      tempPassword: c.temporaryPassword || c.tempPassword,
    }));

    return {
      success: true,
      credentials,
      count: credentials.length,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Exception while recreating users',
    };
  }
}

export async function deleteAuthUsersAction(
  userIds: string[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  if (!userIds || userIds.length === 0) {
    return { success: true, count: 0 };
  }

  if (!isSupabaseConfigured()) {
    return { success: true, count: userIds.length };
  }

  try {
    const { data: result, error: fnErr } = await supabase.functions.invoke('delete-auth-users', {
      body: { userIds },
    });

    if (fnErr || !result?.success) {
      return {
        success: false,
        error: result?.error || fnErr?.message || 'Failed to delete auth users via Edge Function',
      };
    }

    return { success: true, count: result.deletedCount ?? userIds.length };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteBrandStorageAssetsAction(
  brandSlug: string
): Promise<{ success: boolean; error?: string }> {
  if (!brandSlug) {
    return { success: true };
  }

  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  try {
    await supabase.functions.invoke('delete-auth-users', {
      body: { userIds: [], brandSlug },
    });
    return { success: true };
  } catch (err: any) {
    console.warn(`Could not delete storage files for ${brandSlug}:`, err);
    return { success: true }; // Non-fatal
  }
}


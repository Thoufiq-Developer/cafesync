'use server';

// ==============================================================================
// CafeSync - Master Panel Backup & Restore Server Actions
// Isolated server-side operations requiring Supabase Service Role Key
// ==============================================================================

import { getCurrentUserContext } from '@/lib/auth';
import { tryGetAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
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
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    return { success: false, error: 'Unauthorized. Platform Master access required.' };
  }

  if (!usersToRecreate || usersToRecreate.length === 0) {
    return { success: true, credentials: [], count: 0 };
  }

  const adminSupabase = tryGetAdminClient();
  if (!adminSupabase) {
    return {
      success: false,
      error: 'Supabase Service Role Key is not configured on this server.',
    };
  }

  const supabase = (await createClient()) as any;
  const credentials: RecreatedUserCredential[] = [];

  // Cache brand slugs for synthetic emails
  const brandSlugMap = new Map<string, string>();
  const { data: dbBrands } = await supabase.from('brands').select('id, slug');
  (dbBrands || []).forEach((b: any) => {
    brandSlugMap.set(b.id, b.slug);
  });

  for (const u of usersToRecreate) {
    try {
      const brandSlug = brandSlugMap.get(u.brand_id) || 'brand';
      const resolvedUsername = u.username || slugifyUsername(u.full_name);
      const syntheticEmail = buildSyntheticEmail(resolvedUsername, brandSlug);
      const email = u.email && u.email.includes('@') && !u.email.endsWith('.cafesync.local')
        ? u.email
        : syntheticEmail;

      // Check if user already exists in auth
      const { data: existingUser } = await adminSupabase.auth.admin.getUserById(u.id);
      if (existingUser?.user) {
        // User already exists in auth, do not recreate
        continue;
      }

      const tempPassword = generateReadablePassword();

      // Attempt to create user preserving UUID
      let createdUserId = u.id;
      const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
        id: u.id,
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          full_name: u.full_name,
          username: resolvedUsername,
          role: u.role,
          brand_id: u.brand_id,
          shop_id: u.shop_id || null,
          must_change_password: true,
        },
      });

      if (authErr) {
        // If preserving ID failed (e.g. invalid UUID or restriction), retry without fixed ID
        const { data: retryAuth, error: retryErr } = await adminSupabase.auth.admin.createUser({
          email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: u.full_name,
            username: resolvedUsername,
            role: u.role,
            brand_id: u.brand_id,
            shop_id: u.shop_id || null,
            must_change_password: true,
          },
        });

        if (retryErr || !retryAuth?.user) {
          console.error(`Failed to recreate user ${u.full_name}:`, retryErr?.message || authErr.message);
          continue;
        }
        createdUserId = retryAuth.user.id;
      } else if (authData?.user) {
        createdUserId = authData.user.id;
      }

      // Upsert profile record
      await (adminSupabase as any).from('profiles').upsert({
        id: createdUserId,
        brand_id: u.brand_id,
        shop_id: u.shop_id || null,
        role: u.role,
        full_name: u.full_name,
        username: resolvedUsername,
        phone: u.phone || null,
        is_active: true,
        must_change_password: true,
      });

      credentials.push({
        id: createdUserId,
        brand_id: u.brand_id,
        role: u.role,
        full_name: u.full_name,
        email,
        username: resolvedUsername,
        tempPassword,
      });
    } catch (err) {
      console.error(`Error recreating user ${u.full_name}:`, err);
    }
  }

  // Audit log entry
  try {
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'RECREATE_AUTH_USERS',
      table_name: 'profiles',
      record_id: 'batch',
      new_data: {
        recreated_count: credentials.length,
        total_requested: usersToRecreate.length,
      },
    });
  } catch (err) {
    console.warn('Could not record recreate users audit log:', err);
  }

  return {
    success: true,
    credentials,
    count: credentials.length,
  };
}

export async function deleteAuthUsersAction(
  userIds: string[]
): Promise<{ success: boolean; count?: number; error?: string }> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    return { success: false, error: 'Unauthorized. Platform Master access required.' };
  }

  if (!userIds || userIds.length === 0) {
    return { success: true, count: 0 };
  }

  const adminSupabase = tryGetAdminClient();
  if (!adminSupabase) {
    return { success: false, error: 'Supabase Service Role Key is not configured.' };
  }

  let deletedCount = 0;
  for (const uid of userIds) {
    try {
      const { error } = await adminSupabase.auth.admin.deleteUser(uid);
      if (!error) deletedCount++;
      else console.warn(`Failed to delete auth user ${uid}:`, error.message);
    } catch (e) {
      console.warn(`Exception deleting auth user ${uid}:`, e);
    }
  }

  return { success: true, count: deletedCount };
}

export async function deleteBrandStorageAssetsAction(
  brandSlug: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    return { success: false, error: 'Unauthorized. Platform Master access required.' };
  }

  if (!brandSlug) {
    return { success: true };
  }

  const adminSupabase = tryGetAdminClient();
  if (!adminSupabase) {
    return { success: false, error: 'Supabase Service Role Key is not configured.' };
  }

  try {
    const { data: files } = await adminSupabase.storage.from('brand-assets').list(brandSlug);
    if (files && files.length > 0) {
      const paths = files.map((f: any) => `${brandSlug}/${f.name}`);
      await adminSupabase.storage.from('brand-assets').remove(paths);
    }
    return { success: true };
  } catch (err: any) {
    console.warn(`Could not delete storage files for ${brandSlug}:`, err);
    return { success: true }; // Non-fatal
  }
}

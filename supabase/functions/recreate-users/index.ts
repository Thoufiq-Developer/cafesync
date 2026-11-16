// ==============================================================================
// CafeSync Edge Function: recreate-users
// Used by Backup Restore engine to recreate missing Supabase Auth user logins.
// Platform Master access only.
// ==============================================================================

import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import {
  verifyCaller,
  requirePlatformAdmin,
  HttpError,
} from '../_shared/auth.ts';
import {
  generateReadablePassword,
  slugifyUsername,
  buildSyntheticEmail,
} from '../_shared/passwords.ts';
import { writeAuditLog } from '../_shared/audit.ts';

interface UserToRecreate {
  id: string;
  brand_id: string;
  shop_id?: string | null;
  role: string;
  full_name: string;
  email?: string | null;
  username?: string | null;
  phone?: string | null;
}

interface RecreatedUserCredential {
  id: string;
  brand_id: string;
  role: string;
  full_name: string;
  email: string;
  username: string;
  temporaryPassword: string;
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req);
  }

  try {
    const caller = await verifyCaller(req);
    requirePlatformAdmin(caller);

    const body = await req.json().catch(() => ({}));
    const usersToRecreate: UserToRecreate[] = Array.isArray(body.users)
      ? body.users
      : [];

    if (usersToRecreate.length === 0) {
      return jsonResponse({ success: true, credentials: [], count: 0 }, 200, req);
    }

    const serviceClient = getServiceClient();

    // Cache brand slugs for synthetic emails
    const brandSlugMap = new Map<string, string>();
    const { data: dbBrands } = await serviceClient
      .from('brands')
      .select('id, slug');

    (dbBrands || []).forEach((b: { id: string; slug: string }) => {
      brandSlugMap.set(b.id, b.slug);
    });

    const credentials: RecreatedUserCredential[] = [];

    for (const u of usersToRecreate) {
      try {
        const brandSlug = brandSlugMap.get(u.brand_id) || 'brand';
        const resolvedUsername = u.username || slugifyUsername(u.full_name);
        const syntheticEmail = buildSyntheticEmail(resolvedUsername, brandSlug);
        const email =
          u.email &&
          u.email.includes('@') &&
          !u.email.endsWith('.cafesync.local') &&
          !u.email.endsWith('.cafeledger.local')
            ? u.email
            : syntheticEmail;

        // Check if user already exists in auth
        const { data: existingUser } =
          await serviceClient.auth.admin.getUserById(u.id);

        if (existingUser?.user) {
          continue; // Already exists
        }

        const tempPassword = generateReadablePassword();

        // Attempt creating auth user preserving UUID
        let createdUserId = u.id;
        const { data: authData, error: authErr } =
          await serviceClient.auth.admin.createUser({
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
          // Retry without fixed ID if UUID preservation failed
          const { data: retryAuth, error: retryErr } =
            await serviceClient.auth.admin.createUser({
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
            console.error(
              `Failed to recreate user ${u.full_name}:`,
              retryErr?.message || authErr.message
            );
            continue;
          }
          createdUserId = retryAuth.user.id;
        } else if (authData?.user) {
          createdUserId = authData.user.id;
        }

        // Upsert profile record
        await serviceClient.from('profiles').upsert({
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
          temporaryPassword: tempPassword,
        });
      } catch (userErr) {
        console.error(`Error processing user ${u.full_name}:`, userErr);
      }
    }

    // Audit log
    await writeAuditLog({
      userId: caller.id,
      action: 'RECREATE_AUTH_USERS',
      tableName: 'profiles',
      recordId: 'batch',
      newData: {
        recreated_count: credentials.length,
        total_requested: usersToRecreate.length,
      },
    });

    return jsonResponse(
      {
        success: true,
        credentials,
        count: credentials.length,
      },
      200,
      req
    );
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return jsonResponse({ error: err.message }, err.status, req);
    }
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return jsonResponse({ error: message }, 500, req);
  }
});


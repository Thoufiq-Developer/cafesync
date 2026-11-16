// ==============================================================================
// CafeSync Edge Function: delete-auth-users
// Used by Remove Data engine to purge auth logins and brand storage files.
// ==============================================================================

import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import {
  verifyCaller,
  requireBrandAdminOrPlatformAdmin,
  HttpError,
} from '../_shared/auth.ts';
import { writeAuditLog } from '../_shared/audit.ts';

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, req);
  }

  try {
    const caller = await verifyCaller(req);
    requireBrandAdminOrPlatformAdmin(caller);

    const body = await req.json().catch(() => ({}));
    const userIds: string[] = Array.isArray(body.userIds) ? body.userIds : [];
    const brandSlug = String(body.brandSlug || '').trim();

    const serviceClient = getServiceClient();

    // If caller is brand admin, verify all target user IDs belong to their brand
    if (caller.role === 'admin' || caller.role === 'brand_admin') {
      if (userIds.length > 0) {
        const { data: targetProfs } = await serviceClient
          .from('profiles')
          .select('id, brand_id')
          .in('id', userIds);

        const foreignUser = (targetProfs || []).find(
          (p: { brand_id: string | null }) => p.brand_id !== caller.brandId
        );

        if (foreignUser) {
          throw new HttpError(
            403,
            'Forbidden: You can only delete accounts within your assigned brand.'
          );
        }
      }
    }

    let deletedCount = 0;

    for (const uid of userIds) {
      try {
        const { error } = await serviceClient.auth.admin.deleteUser(uid);
        if (!error) {
          deletedCount++;
        } else {
          console.warn(`Failed to delete auth user ${uid}:`, error.message);
        }
      } catch (delErr) {
        console.warn(`Exception deleting auth user ${uid}:`, delErr);
      }
    }

    // Storage asset cleanup if brandSlug is specified (Master only)
    let storageCleaned = false;
    if (brandSlug && (caller.role === 'master' || caller.role === 'platform_admin')) {
      try {
        const { data: files } = await serviceClient.storage
          .from('brand-assets')
          .list(brandSlug);

        if (files && files.length > 0) {
          const paths = files.map((f: { name: string }) => `${brandSlug}/${f.name}`);
          await serviceClient.storage.from('brand-assets').remove(paths);
          storageCleaned = true;
        }
      } catch (storageErr) {
        console.warn(`Storage cleanup failed for ${brandSlug}:`, storageErr);
      }
    }

    // Audit log
    await writeAuditLog({
      userId: caller.id,
      action: 'DELETE_AUTH_USERS',
      tableName: 'auth.users',
      recordId: 'batch',
      newData: {
        deleted_count: deletedCount,
        storage_cleaned: storageCleaned,
        brand_slug: brandSlug || null,
      },
    });

    return jsonResponse(
      {
        success: true,
        count: deletedCount,
        storageCleaned,
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


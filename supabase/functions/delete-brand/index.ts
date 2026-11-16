// ==============================================================================
// CafeSync Edge Function: delete-brand
// Deletes a brand, cascades DB records, and purges auth users & storage files.
// Platform Master access only.
// ==============================================================================

import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import {
  verifyCaller,
  requirePlatformAdmin,
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
    requirePlatformAdmin(caller);

    const body = await req.json().catch(() => ({}));
    const brandId = String(body.brandId || '').trim();

    if (!brandId) {
      return jsonResponse({ error: 'Brand ID is required.' }, 400, req);
    }

    const serviceClient = getServiceClient();

    // 1. Fetch brand
    const { data: brand, error: brandFetchErr } = await serviceClient
      .from('brands')
      .select('id, name, slug')
      .eq('id', brandId)
      .maybeSingle();

    if (brandFetchErr || !brand) {
      return jsonResponse({ error: 'Brand not found.' }, 404, req);
    }

    // 2. Find all user profiles belonging to this brand (admins & managers)
    const { data: brandProfiles } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('brand_id', brandId);

    // 3. Delete auth accounts
    if (brandProfiles && brandProfiles.length > 0) {
      for (const p of brandProfiles) {
        try {
          await serviceClient.auth.admin.deleteUser(p.id);
        } catch (authDelErr) {
          console.warn(`Could not delete auth user ${p.id}:`, authDelErr);
        }
      }
    }

    // 4. Delete brand assets from storage bucket
    const prefixesToClean = [brandId];
    if (brand.slug && brand.slug !== brandId) {
      prefixesToClean.push(brand.slug);
    }

    for (const prefix of prefixesToClean) {
      try {
        const { data: files } = await serviceClient.storage
          .from('brand-assets')
          .list(prefix);
        if (files && files.length > 0) {
          const paths = files.map((f: { name: string }) => `${prefix}/${f.name}`);
          await serviceClient.storage.from('brand-assets').remove(paths);
        }
      } catch (storageErr) {
        console.warn(`Storage cleanup notice for ${prefix}:`, storageErr);
      }
    }

    // 5. Delete brand from DB (cascades to shops, items, transactions, settings)
    const { error: brandDelErr } = await serviceClient
      .from('brands')
      .delete()
      .eq('id', brandId);

    if (brandDelErr) {
      return jsonResponse(
        { error: `Database brand deletion failed: ${brandDelErr.message}` },
        500,
        req
      );
    }

    // 6. Audit log
    await writeAuditLog({
      userId: caller.id,
      action: 'DELETE',
      tableName: 'brands',
      recordId: brandId,
      oldData: { name: brand.name, slug: brand.slug },
    });

    return jsonResponse({ success: true }, 200, req);
  } catch (err: unknown) {
    if (err instanceof HttpError) {
      return jsonResponse({ error: err.message }, err.status, req);
    }
    const message = err instanceof Error ? err.message : 'Internal Server Error';
    return jsonResponse({ error: message }, 500, req);
  }
});


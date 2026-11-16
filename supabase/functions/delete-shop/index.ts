// ==============================================================================
// CafeSync Edge Function: delete-shop
// Deletes a transaction-free shop and cleans up its manager auth accounts.
// ==============================================================================

import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import {
  verifyCaller,
  requireBrandAdminOrPlatformAdmin,
  assertBrandOwnership,
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
    const shopId = String(body.shopId || '').trim();

    if (!shopId) {
      return jsonResponse({ error: 'Shop ID is required.' }, 400, req);
    }

    const serviceClient = getServiceClient();

    // Verify shop existence and ownership
    const { data: shop, error: shopErr } = await serviceClient
      .from('shops')
      .select('id, name, code, brand_id')
      .eq('id', shopId)
      .maybeSingle();

    if (shopErr || !shop) {
      return jsonResponse({ error: 'Shop not found.' }, 404, req);
    }

    assertBrandOwnership(caller, shop.brand_id);

    // Check if shop contains any transactions
    const { count, error: countErr } = await serviceClient
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId);

    if (countErr) {
      return jsonResponse(
        { error: `Transaction check failed: ${countErr.message}` },
        500,
        req
      );
    }

    if (count && count > 0) {
      return jsonResponse(
        {
          error: `Cannot delete this shop because it already contains ${count} transaction(s). To preserve ledger integrity and historical audit reports, please deactivate the shop instead.`,
        },
        400,
        req
      );
    }

    // Find any manager profiles assigned to this shop before deletion
    const { data: managers } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('shop_id', shopId);

    // Delete shop
    const { error: delErr } = await serviceClient
      .from('shops')
      .delete()
      .eq('id', shopId);

    if (delErr) {
      return jsonResponse(
        { error: `Failed to delete shop: ${delErr.message}` },
        500,
        req
      );
    }

    // Delete manager auth accounts
    if (managers && managers.length > 0) {
      for (const mgr of managers) {
        try {
          await serviceClient.auth.admin.deleteUser(mgr.id);
        } catch (authDelErr) {
          console.warn(`Could not delete auth user ${mgr.id}:`, authDelErr);
        }
      }
    }

    // Write audit log
    await writeAuditLog({
      userId: caller.id,
      action: 'DELETE',
      tableName: 'shops',
      recordId: shopId,
      oldData: { name: shop.name, code: shop.code, brand_id: shop.brand_id },
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


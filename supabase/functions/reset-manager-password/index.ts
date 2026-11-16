// ==============================================================================
// CafeSync Edge Function: reset-manager-password
// Generates and sets a new temporary password for a shop manager.
// ==============================================================================

import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import {
  verifyCaller,
  requireBrandAdminOrPlatformAdmin,
  assertBrandOwnership,
  HttpError,
} from '../_shared/auth.ts';
import { generateReadablePassword } from '../_shared/passwords.ts';
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
    const userId = String(body.userId || '').trim();
    const tempPass =
      String(body.temporaryPassword || '').trim() || generateReadablePassword();

    if (!userId) {
      return jsonResponse({ error: 'User ID is required.' }, 400, req);
    }
    if (tempPass.length < 8) {
      return jsonResponse(
        { error: 'Password must be at least 8 characters long.' },
        400,
        req
      );
    }

    const serviceClient = getServiceClient();

    // Fetch target user profile
    const { data: mgrProfile, error: mgrErr } = await serviceClient
      .from('profiles')
      .select('id, full_name, username, role, brand_id, shop_id, shops!shop_id(name, code)')
      .eq('id', userId)
      .maybeSingle();

    if (mgrErr || !mgrProfile) {
      return jsonResponse(
        { error: 'User account not found.' },
        404,
        req
      );
    }

    if (!mgrProfile.brand_id) {
      return jsonResponse(
        { error: 'Target user has no assigned brand.' },
        400,
        req
      );
    }

    assertBrandOwnership(caller, mgrProfile.brand_id);

    // Resolve brand slug
    const { data: brandRow } = await serviceClient
      .from('brands')
      .select('slug')
      .eq('id', mgrProfile.brand_id)
      .maybeSingle();

    const brandSlug = brandRow?.slug || 'brand';

    // Update password in Supabase Auth
    const { error: authErr } =
      await serviceClient.auth.admin.updateUserById(userId, {
        password: tempPass,
      });

    if (authErr) {
      return jsonResponse(
        { error: `Auth password update failed: ${authErr.message}` },
        500,
        req
      );
    }

    // Set must_change_password in profiles
    const { error: profileErr } = await serviceClient
      .from('profiles')
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (profileErr) {
      return jsonResponse(
        { error: `Profile update failed: ${profileErr.message}` },
        500,
        req
      );
    }

    // Audit log
    await writeAuditLog({
      userId: caller.id,
      action: 'RESET_PASSWORD',
      tableName: 'profiles',
      recordId: userId,
      newData: { password_reset: true, must_change_password: true },
    });

    const shopsData = Array.isArray(mgrProfile.shops)
      ? mgrProfile.shops[0]
      : mgrProfile.shops;

    return jsonResponse(
      {
        success: true,
        data: {
          temporaryPassword: tempPass,
          username: mgrProfile.username || '',
          fullName: mgrProfile.full_name || 'Shop Manager',
          shopName: shopsData?.name || 'Shop',
          shopCode: shopsData?.code || 'SHOP',
          loginPath: `/login/${brandSlug}`,
        },
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


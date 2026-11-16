// ==============================================================================
// CafeSync Edge Function: create-manager-user
// Provisions an additional manager login for an existing shop.
// ==============================================================================

import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import {
  verifyCaller,
  requireBrandAdminOrPlatformAdmin,
  assertBrandOwnership,
  HttpError,
} from '../_shared/auth.ts';
import {
  generateReadablePassword,
  slugifyUsername,
  buildSyntheticEmail,
} from '../_shared/passwords.ts';
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
    const fullName = String(body.fullName || '').trim();
    const phone = String(body.phone || '').trim();
    const shopId = String(body.shopId || '').trim();
    const rawEmail = String(body.email || '').trim().toLowerCase();
    const derivedUsername = slugifyUsername(
      String(body.username || (rawEmail ? rawEmail.split('@')[0] : ''))
    );
    const tempPassword =
      String(body.temporaryPassword || '').trim() || generateReadablePassword();

    if (!fullName || !shopId || (!derivedUsername && !rawEmail)) {
      return jsonResponse(
        {
          error:
            'Manager name, username (or email), and assigned shop are required.',
        },
        400,
        req
      );
    }

    if (tempPassword.length < 8) {
      return jsonResponse(
        { error: 'Password must be at least 8 characters long.' },
        400,
        req
      );
    }

    const serviceClient = getServiceClient();

    // Verify shop belongs to brand
    const { data: shopRow, error: shopErr } = await serviceClient
      .from('shops')
      .select('id, name, code, brand_id')
      .eq('id', shopId)
      .maybeSingle();

    if (shopErr || !shopRow) {
      return jsonResponse(
        { error: 'Assigned shop not found.' },
        404,
        req
      );
    }

    assertBrandOwnership(caller, shopRow.brand_id);

    // Resolve brand slug
    const { data: brandRow } = await serviceClient
      .from('brands')
      .select('slug, name')
      .eq('id', shopRow.brand_id)
      .maybeSingle();

    const brandSlug = brandRow?.slug || 'brand';
    const resolvedEmail =
      rawEmail || buildSyntheticEmail(derivedUsername, brandSlug);
    const loginPath = `/login/${brandSlug}`;

    // Verify username uniqueness within brand
    if (derivedUsername) {
      const { data: dupUser } = await serviceClient
        .from('profiles')
        .select('id')
        .eq('brand_id', shopRow.brand_id)
        .ilike('username', derivedUsername)
        .maybeSingle();

      if (dupUser) {
        return jsonResponse(
          {
            error: `Username "${derivedUsername}" is already taken in this brand.`,
          },
          400,
          req
        );
      }
    }

    // Create auth user
    const { data: authData, error: authErr } =
      await serviceClient.auth.admin.createUser({
        email: resolvedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName, username: derivedUsername },
      });

    if (authErr || !authData?.user) {
      return jsonResponse(
        {
          error: `Auth creation failed: ${authErr?.message || 'Unable to create auth user'}`,
        },
        500,
        req
      );
    }

    const newUserId = authData.user.id;

    // Create profile
    const { error: profileErr } = await serviceClient.from('profiles').upsert({
      id: newUserId,
      role: 'manager',
      brand_id: shopRow.brand_id,
      shop_id: shopId,
      full_name: fullName,
      username: derivedUsername || null,
      phone: phone || null,
      is_active: true,
      must_change_password: true,
    });

    if (profileErr) {
      await serviceClient.auth.admin.deleteUser(newUserId);
      return jsonResponse(
        { error: `Profile creation failed: ${profileErr.message}` },
        500,
        req
      );
    }

    // Audit log
    await writeAuditLog({
      userId: caller.id,
      action: 'CREATE',
      tableName: 'profiles',
      recordId: newUserId,
      newData: {
        full_name: fullName,
        username: derivedUsername,
        role: 'manager',
        brand_id: shopRow.brand_id,
        shop_id: shopId,
      },
    });

    return jsonResponse(
      {
        success: true,
        data: {
          id: newUserId,
          credentials: {
            shopName: shopRow.name,
            shopCode: shopRow.code,
            managerName: fullName,
            loginPath,
            username: derivedUsername,
            email: resolvedEmail,
            temporaryPassword: tempPassword,
          },
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


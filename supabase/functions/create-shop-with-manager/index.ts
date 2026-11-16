// ==============================================================================
// CafeSync Edge Function: create-shop-with-manager
// Atomically provisions a shop and its primary manager user login.
// ==============================================================================

import { handleCors, jsonResponse, getCorsHeaders } from '../_shared/cors.ts';
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
  isValidUsername,
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
    const name = String(body.name || '').trim();
    const code = String(body.code || '').trim().toUpperCase();
    const address = String(body.address || '').trim();
    const phone = String(body.phone || '').trim();
    const managerName = String(body.managerName || '').trim();
    const managerPhone = String(body.managerPhone || '').trim();
    const username = slugifyUsername(String(body.username || ''));
    const tempPassword =
      String(body.temporaryPassword || '').trim() || generateReadablePassword();

    const targetBrandId =
      caller.role === 'master' || caller.role === 'platform_admin'
        ? String(body.brandId || caller.brandId || '')
        : caller.brandId!;

    if (!targetBrandId) {
      return jsonResponse({ error: 'brandId is required.' }, 400, req);
    }

    assertBrandOwnership(caller, targetBrandId);

    if (!name || !code) {
      return jsonResponse({ error: 'Shop name and code are required.' }, 400, req);
    }
    if (!managerName) {
      return jsonResponse({ error: 'Manager full name is required.' }, 400, req);
    }
    if (!username || !isValidUsername(username)) {
      return jsonResponse(
        {
          error:
            'Please enter a valid username (letters, numbers, dots, underscores, or hyphens, min 2 characters).',
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

    // Resolve brand slug
    const { data: brandRow } = await serviceClient
      .from('brands')
      .select('slug, name')
      .eq('id', targetBrandId)
      .maybeSingle();

    const brandSlug = brandRow?.slug || 'brand';
    const syntheticEmail = buildSyntheticEmail(username, brandSlug);
    const loginPath = `/login/${brandSlug}`;

    // 1. Check uniqueness of shop code within brand
    const { data: existingShop } = await serviceClient
      .from('shops')
      .select('id')
      .eq('brand_id', targetBrandId)
      .eq('code', code)
      .maybeSingle();

    if (existingShop) {
      return jsonResponse(
        { error: `Shop code "${code}" is already in use for this brand.` },
        400,
        req
      );
    }

    // 2. Check uniqueness of username within brand
    const { data: existingUsername } = await serviceClient
      .from('profiles')
      .select('id')
      .eq('brand_id', targetBrandId)
      .ilike('username', username)
      .maybeSingle();

    if (existingUsername) {
      return jsonResponse(
        {
          error: `Username "${username}" is already taken in this brand. Please choose another.`,
        },
        400,
        req
      );
    }

    // 3. Insert shop
    const { data: newShop, error: shopErr } = await serviceClient
      .from('shops')
      .insert({
        brand_id: targetBrandId,
        name,
        code,
        address: address || null,
        phone: phone || null,
        status: 'active',
      })
      .select()
      .single();

    if (shopErr || !newShop) {
      return jsonResponse(
        { error: shopErr?.message || 'Failed to create shop record.' },
        500,
        req
      );
    }

    // 4. Create Auth user
    const { data: authData, error: authErr } =
      await serviceClient.auth.admin.createUser({
        email: syntheticEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: managerName, username },
      });

    if (authErr || !authData?.user) {
      // Rollback created shop
      await serviceClient.from('shops').delete().eq('id', newShop.id);
      return jsonResponse(
        {
          error: `Manager login creation failed: ${authErr?.message || 'Auth error'}`,
        },
        500,
        req
      );
    }

    const newUserId = authData.user.id;

    // 5. Create Profile with must_change_password = true
    const { error: profileErr } = await serviceClient.from('profiles').upsert({
      id: newUserId,
      role: 'manager',
      brand_id: targetBrandId,
      shop_id: newShop.id,
      full_name: managerName,
      username,
      phone: managerPhone || null,
      is_active: true,
      must_change_password: true,
    });

    if (profileErr) {
      await serviceClient.auth.admin.deleteUser(newUserId);
      await serviceClient.from('shops').delete().eq('id', newShop.id);
      return jsonResponse(
        { error: `Manager profile setup failed: ${profileErr.message}` },
        500,
        req
      );
    }

    // 6. Write audit logs
    await writeAuditLog({
      userId: caller.id,
      action: 'CREATE',
      tableName: 'shops',
      recordId: newShop.id,
      newData: { name, code, address, phone },
    });

    await writeAuditLog({
      userId: caller.id,
      action: 'CREATE',
      tableName: 'profiles',
      recordId: newUserId,
      newData: {
        full_name: managerName,
        username,
        syntheticEmail,
        role: 'manager',
        shop_id: newShop.id,
      },
    });

    return jsonResponse(
      {
        success: true,
        data: {
          shop: {
            ...newShop,
            address: newShop.address || '',
            phone: newShop.phone || '',
            managers: [
              {
                id: newUserId,
                full_name: managerName,
                email: syntheticEmail,
                username,
                phone: managerPhone,
                is_active: true,
                must_change_password: true,
              },
            ],
          },
          credentials: {
            shopName: name,
            shopCode: code,
            managerName,
            loginPath,
            username,
            password: tempPassword,
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


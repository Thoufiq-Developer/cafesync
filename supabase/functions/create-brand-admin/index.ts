// ==============================================================================
// CafeSync Edge Function: create-brand-admin
// Provisions a Brand Administrator user account.
// Platform Master access only.
// ==============================================================================

import { handleCors, jsonResponse } from '../_shared/cors.ts';
import { getServiceClient } from '../_shared/supabase.ts';
import {
  verifyCaller,
  requirePlatformAdmin,
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
    requirePlatformAdmin(caller);

    const body = await req.json().catch(() => ({}));
    const brandId = String(body.brandId || '').trim();
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const tempPassword =
      String(body.temporaryPassword || '').trim() || generateReadablePassword();

    if (!brandId || !name || !email) {
      return jsonResponse(
        { error: 'Brand ID, administrator name, and email are required.' },
        400,
        req
      );
    }

    if (!email.includes('@')) {
      return jsonResponse({ error: 'Valid email address is required.' }, 400, req);
    }

    if (tempPassword.length < 8) {
      return jsonResponse(
        { error: 'Password must be at least 8 characters long.' },
        400,
        req
      );
    }

    const serviceClient = getServiceClient();

    // Verify brand exists
    const { data: brand, error: brandErr } = await serviceClient
      .from('brands')
      .select('id, name, slug')
      .eq('id', brandId)
      .maybeSingle();

    if (brandErr || !brand) {
      return jsonResponse({ error: 'Target brand not found.' }, 404, req);
    }

    // Create auth user
    const { data: authUser, error: authErr } =
      await serviceClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: name },
      });

    if (authErr || !authUser?.user) {
      return jsonResponse(
        {
          error: `Admin account creation failed: ${authErr?.message || 'Unable to create auth user'}`,
        },
        500,
        req
      );
    }

    const adminUserId = authUser.user.id;

    // Upsert profile
    const { error: profileErr } = await serviceClient.from('profiles').upsert({
      id: adminUserId,
      role: 'admin',
      brand_id: brandId,
      full_name: name,
      phone: phone || null,
      is_active: true,
      must_change_password: true,
    });

    if (profileErr) {
      await serviceClient.auth.admin.deleteUser(adminUserId);
      return jsonResponse(
        { error: `Admin profile setup failed: ${profileErr.message}` },
        500,
        req
      );
    }

    // Audit log
    await writeAuditLog({
      userId: caller.id,
      action: 'CREATE',
      tableName: 'profiles',
      recordId: adminUserId,
      newData: { full_name: name, email, role: 'admin', brand_id: brandId },
    });

    return jsonResponse(
      {
        success: true,
        data: {
          id: adminUserId,
          email,
          temporaryPassword: tempPassword,
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


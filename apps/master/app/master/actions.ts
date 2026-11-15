'use server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@cafesync/shared/server-admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getCurrentUserContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { DEFAULT_SEED_CONFIG } from '@/lib/master-constants';
import { buildDefaultBrandSettings, slugifyBrandName } from '@/lib/theme/presets';
import { normalizeHex } from '@/lib/theme/colors';
import { revalidateBrandThemeCache } from '@/lib/theme/server';
import {
  appendDemoThemeAudit,
  findDemoThemeById,
  listDemoThemeBundles,
  saveDemoThemeSettings,
  upsertDemoBrandBundle,
} from '@/lib/theme/store';

interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// -----------------------------------------------------------------------------
// 1. BRAND CREATION & ONBOARDING
// -----------------------------------------------------------------------------

export async function createBrandAction(formData: {
  name: string;
  slug?: string;
  registrationNo: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  // First Admin Account
  adminName: string;
  adminEmail: string;
  adminPhone?: string;
  adminPassword?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    return { success: false, error: 'Unauthorized. Only role=master can create brands.' };
  }

  const {
    name,
    registrationNo,
    primaryColor,
    secondaryColor,
    logoUrl,
    address,
    phone,
    email,
    gstin,
    adminName,
    adminEmail,
    adminPhone,
  } = formData;

  const tempAdminPassword = formData.adminPassword || 'AdminPass' + Math.floor(1000 + Math.random() * 9000) + '!';

  if (!name.trim() || !registrationNo.trim() || !adminName.trim() || !adminEmail.trim()) {
    return { success: false, error: 'Brand name, registration number, and first administrator details are required.' };
  }

  const cleanSlug = slugifyBrandName(formData.slug?.trim() || name.trim());
  const cleanPrimary = normalizeHex(primaryColor, '#ea580c');
  const cleanSecondary = normalizeHex(secondaryColor, '#9a3412');

  if (!isSupabaseConfigured()) {
    const existingBundles = listDemoThemeBundles();
    if (
      existingBundles.some(
        (b) => b.brand.registration_no.toUpperCase() === registrationNo.trim().toUpperCase()
      )
    ) {
      return { success: false, error: `Registration number "${registrationNo}" is already taken.` };
    }

    let finalSlug = cleanSlug;
    let suffix = 2;
    while (existingBundles.some((b) => b.brand.slug.toLowerCase() === finalSlug.toLowerCase())) {
      finalSlug = `${cleanSlug}-${suffix++}`;
    }

    const brandId = `11111111-1111-4444-8888-${Date.now().toString().slice(-12).padStart(12, '0')}`;
    const defaultSettings = buildDefaultBrandSettings({
      id: brandId,
      name: name.trim(),
      logo_url: logoUrl?.trim() || `/api/brand-icon/${brandId}?variant=logo`,
      primary_color: cleanPrimary,
      secondary_color: cleanSecondary,
    });
    defaultSettings.icon_url = `/api/brand-icon/${brandId}`;

    upsertDemoBrandBundle({
      brand: {
        id: brandId,
        name: name.trim(),
        slug: finalSlug,
        registration_no: registrationNo.trim().toUpperCase(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        gstin: gstin?.trim() || null,
        status: 'active',
      },
      settings: defaultSettings,
    });

    appendDemoThemeAudit({
      id: `audit-${Date.now()}`,
      user_id: user.id,
      user_name: user.fullName || 'Platform Master',
      brand_id: brandId,
      brand_name: name.trim(),
      action: 'CREATE',
      table_name: 'brands',
      details: `Onboarded "${name.trim()}" (slug: /login/${finalSlug}, admin: ${adminEmail.trim()})`,
      at: new Date().toISOString(),
    });

    revalidateBrandThemeCache(brandId, finalSlug);
    return {
      success: true,
      data: {
        brand: {
          id: brandId,
          name: name.trim(),
          slug: finalSlug,
          registration_no: registrationNo.trim().toUpperCase(),
        },
        adminEmail: adminEmail.trim(),
        adminPassword: tempAdminPassword,
      },
    };
  }

  try {
    const supabase = (await createClient()) as any;
    const adminSupabase = createAdminClient() as any;

    // 1. Check registration number uniqueness
    const { data: existingBrand } = await supabase
      .from('brands')
      .select('id')
      .eq('registration_no', registrationNo.trim())
      .maybeSingle();

    if (existingBrand) {
      return { success: false, error: `Registration number "${registrationNo}" is already taken.` };
    }

    // Check slug uniqueness
    let finalSlug = cleanSlug;
    const { data: slugConflict } = await supabase
      .from('brands')
      .select('id')
      .eq('slug', finalSlug)
      .maybeSingle();

    if (slugConflict) {
      finalSlug = `${cleanSlug}-${Math.floor(100 + Math.random() * 900)}`;
    }

    // 2. Insert into brands
    const { data: newBrand, error: brandErr } = await supabase
      .from('brands')
      .insert({
        name: name.trim(),
        slug: finalSlug,
        registration_no: registrationNo.trim().toUpperCase(),
        primary_color: cleanPrimary,
        secondary_color: cleanSecondary,
        logo_url: logoUrl?.trim() || null,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        gstin: gstin?.trim() || null,
        status: 'active',
      })
      .select()
      .single();

    if (brandErr) {
      console.error('Error creating brand:', brandErr);
      return { success: false, error: `Brand creation failed: ${brandErr.message}` };
    }

    const brandId = newBrand.id;

    // Seed / sync brand_settings immediately
    await supabase.from('brand_settings').upsert({
      brand_id: brandId,
      logo_url: logoUrl?.trim() || null,
      display_name: name.trim(),
      primary_color: cleanPrimary,
      secondary_color: cleanSecondary,
      welcome_message: `Welcome back to ${name.trim()}`,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    });

    // 3. Create First Administrator Account in Supabase Auth + profiles
    if (!adminSupabase) {
      await supabase.from('brands').delete().eq('id', brandId);
      return {
        success: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY is required on the server to provision Brand Admin accounts.',
      };
    }

    const { data: authUser, error: authErr } = await adminSupabase.auth.admin.createUser({
      email: adminEmail.trim().toLowerCase(),
      password: tempAdminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminName.trim() },
    });

    if (authErr || !authUser?.user) {
      await adminSupabase.from('brands').delete().eq('id', brandId);
      return {
        success: false,
        error: `Admin account creation failed: ${authErr?.message || 'Unable to create auth user'}`,
      };
    }

    const adminUserId = authUser.user.id;

    // Insert profile for the Admin
    const { error: profileErr } = await adminSupabase.from('profiles').upsert({
      id: adminUserId,
      role: 'admin',
      brand_id: brandId,
      full_name: adminName.trim(),
      phone: adminPhone?.trim() || null,
      is_active: true,
      must_change_password: true,
    });

    if (profileErr) {
      await adminSupabase.auth.admin.deleteUser(adminUserId);
      await adminSupabase.from('brands').delete().eq('id', brandId);
      return {
        success: false,
        error: `Admin profile creation failed: ${profileErr.message}`,
      };
    }

    // 4. Seed Default Payment Modes
    for (const mode of DEFAULT_SEED_CONFIG.paymentModes) {
      await supabase.from('payment_modes').insert({
        brand_id: brandId,
        name: mode,
        is_active: true,
      });
    }

    // 5. Seed Starter Expense Items
    for (const exp of DEFAULT_SEED_CONFIG.expenseItems) {
      await supabase.from('items').insert({
        brand_id: brandId,
        name: exp.name,
        kind: 'expense',
        category: exp.category,
        is_active: true,
      });
    }

    // 6. Seed Starter Income Items
    for (const inc of DEFAULT_SEED_CONFIG.incomeItems) {
      await supabase.from('items').insert({
        brand_id: brandId,
        name: inc.name,
        kind: 'income',
        category: inc.category,
        is_active: true,
      });
    }

    // 7. Write Audit Log
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'CREATE',
      table_name: 'brands',
      record_id: brandId,
      new_data: {
        brand_name: name.trim(),
        slug: finalSlug,
        registration_no: registrationNo.trim(),
        admin_email: adminEmail.trim(),
      },
    });

    revalidateBrandThemeCache(brandId, finalSlug);
    revalidatePath('/master');
    return {
      success: true,
      data: {
        brand: { ...newBrand, slug: finalSlug },
        adminEmail,
        adminPassword: tempAdminPassword,
      },
    };
  } catch (err: any) {
    console.error('createBrandAction exception:', err);
    return { success: false, error: err.message || 'Failed to onboard brand' };
  }
}

// -----------------------------------------------------------------------------
// 2. BRAND UPDATES & STATUS (SUSPEND / REACTIVATE)
// -----------------------------------------------------------------------------

export async function updateBrandAction(formData: {
  brandId: string;
  name: string;
  slug?: string;
  registrationNo: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    return { success: false, error: 'Unauthorized.' };
  }

  const { brandId, name, slug, registrationNo, address, phone, email, gstin } = formData;
  const cleanSlug = slug ? slugifyBrandName(slug) : undefined;

  if (!isSupabaseConfigured()) {
    const existing = findDemoThemeById(brandId);
    if (!existing) {
      return { success: false, error: 'Brand not found.' };
    }

    const allBundles = listDemoThemeBundles();
    const targetSlug = cleanSlug || existing.brand.slug;
    if (allBundles.some((b) => b.brand.id !== brandId && b.brand.slug === targetSlug)) {
      return { success: false, error: `Slug "${targetSlug}" is already assigned to another brand.` };
    }

    upsertDemoBrandBundle({
      brand: {
        ...existing.brand,
        name: name.trim(),
        slug: targetSlug,
        registration_no: registrationNo.trim().toUpperCase(),
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        gstin: gstin?.trim() || null,
      },
      settings: {
        ...existing.settings,
        ...(formData.primaryColor ? { primary_color: normalizeHex(formData.primaryColor) } : {}),
        ...(formData.secondaryColor ? { secondary_color: normalizeHex(formData.secondaryColor) } : {}),
        ...(formData.logoUrl !== undefined ? { logo_url: formData.logoUrl?.trim() || null } : {}),
        updated_at: new Date().toISOString(),
      },
    });

    appendDemoThemeAudit({
      id: `audit-${Date.now()}`,
      user_id: user.id,
      user_name: user.fullName || 'Platform Master',
      brand_id: brandId,
      brand_name: name.trim(),
      action: 'UPDATE',
      table_name: 'brands',
      details: `Updated brand details & slug (/login/${targetSlug})`,
      at: new Date().toISOString(),
    });

    revalidateBrandThemeCache(brandId, targetSlug);
    revalidatePath('/master');
    return { success: true };
  }

  try {
    const supabase = (await createClient()) as any;

    const updatePayload: Record<string, any> = {
      name: name.trim(),
      registration_no: registrationNo.trim().toUpperCase(),
      address: address?.trim() || null,
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      gstin: gstin?.trim() || null,
      updated_at: new Date().toISOString(),
    };
    if (cleanSlug) updatePayload.slug = cleanSlug;
    if (formData.primaryColor) updatePayload.primary_color = normalizeHex(formData.primaryColor);
    if (formData.secondaryColor) updatePayload.secondary_color = normalizeHex(formData.secondaryColor);
    if (formData.logoUrl !== undefined) updatePayload.logo_url = formData.logoUrl?.trim() || null;

    const { data: updated, error } = await supabase
      .from('brands')
      .update(updatePayload)
      .eq('id', brandId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'UPDATE',
      table_name: 'brands',
      record_id: brandId,
      new_data: { name, slug: updated?.slug, registrationNo },
    });

    revalidateBrandThemeCache(brandId, updated?.slug || cleanSlug);
    revalidatePath('/master');
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleBrandStatusAction(brandId: string, status: 'active' | 'suspended'): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    return { success: false, error: 'Unauthorized.' };
  }

  if (!isSupabaseConfigured()) {
    const existing = findDemoThemeById(brandId);
    if (!existing) return { success: false, error: 'Brand not found.' };

    upsertDemoBrandBundle({
      brand: {
        ...existing.brand,
        status,
      },
      settings: existing.settings,
    });

    appendDemoThemeAudit({
      id: `audit-${Date.now()}`,
      user_id: user.id,
      user_name: user.fullName || 'Platform Master',
      brand_id: brandId,
      brand_name: existing.brand.name,
      action: status === 'suspended' ? 'SUSPEND' : 'REACTIVATE',
      table_name: 'brands',
      details: `Brand ${status === 'suspended' ? 'suspended (logins blocked)' : 'reactivated'}`,
      at: new Date().toISOString(),
    });

    revalidateBrandThemeCache(brandId, existing.brand.slug);
    revalidatePath('/master');
    return { success: true };
  }

  try {
    const supabase = (await createClient()) as any;

    // 1. Update brand status
    const { data: updatedBrand, error } = await supabase
      .from('brands')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', brandId)
      .select('slug')
      .single();

    if (error) return { success: false, error: error.message };

    // 2. Cascade suspension/activation: suspend or reactivate all profiles under this brand
    const isActive = status === 'active';
    await supabase
      .from('profiles')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('brand_id', brandId);

    // 3. Audit log
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: status === 'suspended' ? 'SUSPEND' : 'REACTIVATE',
      table_name: 'brands',
      record_id: brandId,
      new_data: { status, cascade_profiles_active: isActive },
    });

    revalidateBrandThemeCache(brandId, updatedBrand?.slug);
    revalidatePath('/master');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteBrandAction(brandId: string): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const adminSupabase = createAdminClient() as any;
    if (!adminSupabase) {
      return { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is required to delete a brand and its user accounts.' };
    }

    // 1. Find all admin and manager profiles belonging to this brand
    const { data: brandProfiles } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('brand_id', brandId);

    // 2. Delete all auth user accounts for this brand
    if (brandProfiles && brandProfiles.length > 0) {
      for (const p of brandProfiles) {
        await adminSupabase.auth.admin.deleteUser(p.id).catch(() => null);
      }
    }

    // 3. Delete brand assets from storage bucket
    try {
      const { data: files } = await adminSupabase.storage.from('brand-assets').list(brandId);
      if (files && files.length > 0) {
        const filePaths = files.map((f: any) => `${brandId}/${f.name}`);
        await adminSupabase.storage.from('brand-assets').remove(filePaths);
      }
    } catch (storageErr) {
      console.warn('Storage cleanup warning:', storageErr);
    }

    // 4. Delete the brand (cascades to all child tables in Postgres)
    const { error: brandErr } = await adminSupabase
      .from('brands')
      .delete()
      .eq('id', brandId);

    if (brandErr) {
      return { success: false, error: brandErr.message };
    }

    // 5. Audit log
    await adminSupabase.from('audit_log').insert({
      user_id: user.id,
      action: 'DELETE',
      table_name: 'brands',
      record_id: brandId,
      new_data: { deleted_brand_id: brandId, cleaned_users_count: brandProfiles?.length || 0 },
    });

    revalidatePath('/master');
    revalidatePath('/master/brands');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------------------------------------
// 3. BRAND ADMINISTRATOR ACTIONS
// -----------------------------------------------------------------------------

export async function createBrandAdminAction(formData: {
  brandId: string;
  name: string;
  email: string;
  phone?: string;
  password?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    return { success: false, error: 'Unauthorized.' };
  }

  const { brandId, name, email, phone } = formData;
  const tempPassword = formData.password || 'AdminPass' + Math.floor(1000 + Math.random() * 9000) + '!';

  if (!brandId || !name.trim() || !email.trim()) {
    return { success: false, error: 'Brand, full name, and email are required.' };
  }

  if (!isSupabaseConfigured()) {
    const existing = findDemoThemeById(brandId);
    if (!existing) {
      return { success: false, error: 'Brand not found.' };
    }
    const adminId = `demo-admin-${Date.now()}`;
    return {
      success: true,
      data: {
        id: adminId,
        email,
        temporaryPassword: tempPassword,
      },
    };
  }

  try {
    const supabase = (await createClient()) as any;
    const adminSupabase = createAdminClient() as any;

    if (!adminSupabase) {
      return {
        success: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY is required on the server to create admin users.',
      };
    }

    const { data: authUser, error: authErr } = await adminSupabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: name.trim() },
    });

    if (authErr || !authUser?.user) {
      return { success: false, error: `Auth creation failed: ${authErr?.message || 'Unable to create auth user'}` };
    }

    const adminUserId = authUser.user.id;

    const { error: profileErr } = await adminSupabase.from('profiles').upsert({
      id: adminUserId,
      role: 'admin',
      brand_id: brandId,
      full_name: name.trim(),
      phone: phone?.trim() || null,
      is_active: true,
      must_change_password: true,
    });

    if (profileErr) {
      await adminSupabase.auth.admin.deleteUser(adminUserId);
      return { success: false, error: `Profile creation failed: ${profileErr.message}` };
    }

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'CREATE',
      table_name: 'profiles',
      record_id: adminUserId,
      new_data: { full_name: name, email, role: 'admin', brand_id: brandId },
    });

    revalidatePath('/master');
    revalidatePath('/master/admins');
    revalidatePath(`/master/brands/${brandId}`);
    return {
      success: true,
      data: {
        id: adminUserId,
        email,
        temporaryPassword: tempPassword,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resetBrandAdminPasswordAction(adminUserId: string, newPassword?: string): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    return { success: false, error: 'Unauthorized.' };
  }

  const tempPass = newPassword || 'ResetAdmin' + Math.floor(1000 + Math.random() * 9000) + '!';

  if (!isSupabaseConfigured()) {
    return { success: true, data: { temporaryPassword: tempPass } };
  }

  try {
    const supabase = (await createClient()) as any;
    const adminSupabase = createAdminClient() as any;

    if (adminSupabase) {
      const { error: authErr } = await adminSupabase.auth.admin.updateUserById(adminUserId, {
        password: tempPass,
      });
      if (authErr) return { success: false, error: authErr.message };
    }

    await supabase
      .from('profiles')
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq('id', adminUserId);

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'RESET_PASSWORD',
      table_name: 'profiles',
      record_id: adminUserId,
      new_data: { admin_reset: true, must_change_password: true },
    });

    revalidatePath('/master/admins');
    return { success: true, data: { temporaryPassword: tempPass } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------------------------------------
// 4. "VIEW AS ADMIN" READ-ONLY AUDIT ACTION
// -----------------------------------------------------------------------------

export async function logViewAsAdminAction(brandId: string, brandName: string): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    return { success: false, error: 'Unauthorized.' };
  }

  if (!isSupabaseConfigured()) {
    appendDemoThemeAudit({
      id: `audit-${Date.now()}`,
      user_id: user.id,
      user_name: user.fullName || 'Platform Master',
      brand_id: brandId,
      brand_name: brandName,
      action: 'VIEW_AS_ADMIN',
      table_name: 'brands',
      details: 'Master opened read-only administrative inspection view',
      at: new Date().toISOString(),
    });
    return { success: true };
  }

  try {
    const supabase = (await createClient()) as any;

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'VIEW_AS_ADMIN',
      table_name: 'brands',
      record_id: brandId,
      new_data: {
        brand_name: brandName,
        initiated_by: user.email,
        note: 'Master opened read-only administrative inspection view',
      },
    });

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------------------------------------
// 5. MASTER SETTINGS & SECURITY
// -----------------------------------------------------------------------------

export async function changeMasterPasswordAction(newPassword: string): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    return { success: false, error: 'Unauthorized.' };
  }

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'New password must be at least 8 characters long.' };
  }

  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  try {
    const supabase = (await createClient()) as any;
    const adminSupabase = createAdminClient() as any;

    if (adminSupabase) {
      const { error: authErr } = await adminSupabase.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });
      if (authErr) return { success: false, error: authErr.message };
    }

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'CHANGE_MASTER_PASSWORD',
      table_name: 'profiles',
      record_id: user.id,
      new_data: { timestamp: new Date().toISOString() },
    });

    revalidatePath('/master/settings');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}


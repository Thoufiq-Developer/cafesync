'use server';

import { createClient } from '@/lib/supabase/server';
import { tryGetAdminClient } from '@/lib/supabase/admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getCurrentUserContext } from '@/lib/auth';
import {
  generateReadablePassword,
  slugifyUsername,
  isValidUsername,
  buildSyntheticEmail,
} from '@/lib/passwords';
import { revalidatePath } from 'next/cache';
import { DEMO_ADMIN_SHOPS } from '@/lib/demo-admin-data';

interface ActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

// -----------------------------------------------------------------------------
// 1. SHOPS ACTIONS
// -----------------------------------------------------------------------------

export async function createShopAction(formData: {
  name: string;
  code: string;
  address?: string;
  phone?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized. Admin credentials required.' };
  }

  const name = formData.name.trim();
  const code = formData.code.trim().toUpperCase();
  const address = formData.address?.trim() || '';
  const phone = formData.phone?.trim() || '';

  if (!name || !code) {
    return { success: false, error: 'Shop name and unique code are required.' };
  }

  try {
    const supabase = (await createClient()) as any;

    // Check code uniqueness within brand
    const { data: existing } = await supabase
      .from('shops')
      .select('id')
      .eq('brand_id', user.brandId)
      .eq('code', code)
      .maybeSingle();

    if (existing) {
      return { success: false, error: `Shop code "${code}" is already in use for this brand.` };
    }

    const { data: newShop, error } = await supabase
      .from('shops')
      .insert({
        brand_id: user.brandId,
        name,
        code,
        address,
        phone,
        status: 'active',
      } as any)
      .select()
      .single();

    if (error) {
      console.error('Error creating shop:', error);
      return { success: false, error: error.message };
    }

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'CREATE',
      table_name: 'shops',
      record_id: (newShop as any).id,
      new_data: { name, code, address, phone },
    } as any);

    revalidatePath('/admin');
    revalidatePath('/admin/shops');
    return { success: true, data: newShop };
  } catch (err: any) {
    console.error('createShopAction error:', err);
    return { success: false, error: err.message || 'Failed to create shop' };
  }
}

export async function updateShopAction(formData: {
  shopId: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  status?: 'active' | 'inactive';
}): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  const { shopId, name, code, address, phone, status } = formData;
  if (!shopId || !name || !code) {
    return { success: false, error: 'Shop ID, name, and code are required.' };
  }

  try {
    const supabase = (await createClient()) as any;

    const { data: updated, error } = await supabase
      .from('shops')
      .update({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address?.trim() || '',
        phone: phone?.trim() || '',
        status: status || 'active',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', shopId)
      .eq('brand_id', user.brandId)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    // Audit log
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'UPDATE',
      table_name: 'shops',
      record_id: shopId,
      new_data: { name, code, address, phone, status },
    } as any);

    revalidatePath('/admin');
    revalidatePath('/admin/shops');
    revalidatePath(`/admin/shops/${shopId}`);
    return { success: true, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleShopStatusAction(shopId: string, status: 'active' | 'inactive'): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const supabase = (await createClient()) as any;

    const { error } = await supabase
      .from('shops')
      .update({ status, updated_at: new Date().toISOString() } as any)
      .eq('id', shopId)
      .eq('brand_id', user.brandId);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'UPDATE',
      table_name: 'shops',
      record_id: shopId,
      new_data: { status },
    } as any);

    revalidatePath('/admin');
    revalidatePath('/admin/shops');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteShopAction(shopId: string): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const supabase = (await createClient()) as any;

    // Check if shop has transactions
    const { count, error: countErr } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('shop_id', shopId);

    if (countErr) return { success: false, error: countErr.message };

    if (count && count > 0) {
      return {
        success: false,
        error: `Cannot delete this shop because it already contains ${count} transaction(s). To preserve ledger integrity and historical audit reports, please deactivate the shop instead.`,
      };
    }

    const { error } = await supabase
      .from('shops')
      .delete()
      .eq('id', shopId)
      .eq('brand_id', user.brandId);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'DELETE',
      table_name: 'shops',
      record_id: shopId,
    } as any);

    revalidatePath('/admin');
    revalidatePath('/admin/shops');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// Helper: Resolve brand slug for synthetic manager emails & login links
async function resolveBrandSlugForAdmin(supabase: any, brandId: string, fallbackSlug?: string): Promise<string> {
  if (fallbackSlug) return fallbackSlug;
  const { data } = await supabase
    .from('brands')
    .select('slug')
    .eq('id', brandId)
    .maybeSingle();
  return data?.slug || 'brand';
}

export async function createShopWithManagerAction(formData: {
  name: string;
  code: string;
  address?: string;
  phone?: string;
  managerName: string;
  managerPhone?: string;
  username: string;
  temporaryPassword?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized. Admin credentials required.' };
  }

  const name = formData.name.trim();
  const code = formData.code.trim().toUpperCase();
  const address = formData.address?.trim() || '';
  const phone = formData.phone?.trim() || '';
  const managerName = formData.managerName.trim();
  const managerPhone = formData.managerPhone?.trim() || '';
  const username = slugifyUsername(formData.username || '');
  const tempPassword = (formData.temporaryPassword || '').trim() || generateReadablePassword();

  if (!name || !code) {
    return { success: false, error: 'Shop name and code are required.' };
  }
  if (!managerName) {
    return { success: false, error: 'Manager full name is required.' };
  }
  if (!username || !isValidUsername(username)) {
    return {
      success: false,
      error: 'Please enter a valid username (letters, numbers, dots, underscores, or hyphens, min 2 characters).',
    };
  }
  if (tempPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  const isLive = isSupabaseConfigured();
  const supabase = (await createClient()) as any;
  const adminSupabase = tryGetAdminClient() as any;

  if (isLive && !adminSupabase) {
    return {
      success: false,
      error: 'SUPABASE_SERVICE_ROLE_KEY is required on the server to create shop manager logins.',
    };
  }

  try {
    const brandSlug = await resolveBrandSlugForAdmin(supabase, user.brandId, user.brand?.slug);
    const syntheticEmail = buildSyntheticEmail(username, brandSlug);
    const loginPath = `/login/${brandSlug}`;

    if (!isLive) {
      const demoShopId = '50000000-0000-0000-0000-' + Math.floor(100000000000 + Math.random() * 900000000000);
      const demoMgrId = '60000000-0000-0000-0000-' + Math.floor(100000000000 + Math.random() * 900000000000);
      const shopPayload = {
        id: demoShopId,
        brand_id: user.brandId,
        name,
        code,
        address,
        phone,
        status: 'active' as const,
        created_at: new Date().toISOString(),
        managers: [
          {
            id: demoMgrId,
            full_name: managerName,
            email: syntheticEmail,
            username,
            phone: managerPhone,
            is_active: true,
            must_change_password: true,
          },
        ],
      };
      return {
        success: true,
        data: {
          shop: shopPayload,
          credentials: {
            shopName: name,
            shopCode: code,
            managerName,
            loginPath,
            username,
            password: tempPassword,
          },
        },
      };
    }

    // 1. Validate uniqueness of shop code & manager username within the brand
    const { data: existingShop } = await supabase
      .from('shops')
      .select('id')
      .eq('brand_id', user.brandId)
      .eq('code', code)
      .maybeSingle();

    if (existingShop) {
      return { success: false, error: `Shop code "${code}" is already in use for this brand.` };
    }

    const { data: existingUsername } = await adminSupabase
      .from('profiles')
      .select('id')
      .eq('brand_id', user.brandId)
      .ilike('username', username)
      .maybeSingle();

    if (existingUsername) {
      return {
        success: false,
        error: `Username "${username}" is already taken in this brand. Please choose another.`,
      };
    }

    // 2. Insert shop first
    const { data: newShop, error: shopErr } = await supabase
      .from('shops')
      .insert({
        brand_id: user.brandId,
        name,
        code,
        address,
        phone,
        status: 'active',
      })
      .select()
      .single();

    if (shopErr || !newShop) {
      return { success: false, error: shopErr?.message || 'Failed to create shop.' };
    }

    // 3. Create Supabase Auth user with synthetic email using Service Role key
    const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
      email: syntheticEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: managerName, username },
    });

    if (authErr || !authData?.user) {
      // Rollback shop creation to avoid orphan shop without login
      await adminSupabase.from('shops').delete().eq('id', newShop.id);
      return {
        success: false,
        error: `Manager login creation failed: ${authErr?.message || 'Auth error'}`,
      };
    }

    const newUserId = authData.user.id;

    // 4. Create profile linked to brand & shop with must_change_password = true
    const { error: profileErr } = await adminSupabase.from('profiles').upsert({
      id: newUserId,
      role: 'manager',
      brand_id: user.brandId,
      shop_id: newShop.id,
      full_name: managerName,
      username,
      phone: managerPhone || null,
      is_active: true,
      must_change_password: true,
    });

    if (profileErr) {
      await adminSupabase.auth.admin.deleteUser(newUserId);
      await adminSupabase.from('shops').delete().eq('id', newShop.id);
      const isMissingColumn =
        profileErr.code === 'PGRST204' ||
        profileErr.code === '42703' ||
        /schema cache|username/i.test(profileErr.message || '');
      return {
        success: false,
        error: isMissingColumn
          ? 'Database migration required: please run supabase/migrations/20261112000000_shop_logins_items_qty_reports.sql in your Supabase SQL Editor, then try again.'
          : `Manager profile setup failed: ${profileErr.message}`,
      };
    }

    // 5. Audit logs (never log plain-text password)
    await supabase.from('audit_log').insert([
      {
        user_id: user.id,
        action: 'CREATE',
        table_name: 'shops',
        record_id: newShop.id,
        new_data: { name, code, address, phone },
      },
      {
        user_id: user.id,
        action: 'CREATE',
        table_name: 'profiles',
        record_id: newUserId,
        new_data: { full_name: managerName, username, shop_id: newShop.id, role: 'manager' },
      },
    ]);

    revalidatePath('/admin');
    revalidatePath('/admin/shops');
    revalidatePath('/admin/users');

    return {
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
    };
  } catch (err: any) {
    console.error('createShopWithManagerAction error:', err);
    return { success: false, error: err?.message || 'Failed to create shop and manager account' };
  }
}

// -----------------------------------------------------------------------------
// 2. USERS / MANAGERS ACTIONS
// -----------------------------------------------------------------------------

export async function createManagerUserAction(formData: {
  fullName: string;
  username?: string;
  email?: string;
  phone?: string;
  shopId: string;
  temporaryPassword?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  const fullName = formData.fullName.trim();
  const phone = formData.phone?.trim() || '';
  const shopId = formData.shopId;
  const rawEmail = (formData.email || '').trim().toLowerCase();
  const derivedUsername = slugifyUsername(
    formData.username || (rawEmail ? rawEmail.split('@')[0] : '')
  );
  const tempPassword = (formData.temporaryPassword || '').trim() || generateReadablePassword();

  if (!fullName || !shopId || (!derivedUsername && !rawEmail)) {
    return { success: false, error: 'Manager name, username (or email), and assigned shop are required.' };
  }
  if (tempPassword.length < 8) {
    return { success: false, error: 'Password must be at least 8 characters long.' };
  }

  const isLive = isSupabaseConfigured();

  try {
    const adminSupabase = tryGetAdminClient() as any;
    const supabase = (await createClient()) as any;
    const brandSlug = await resolveBrandSlugForAdmin(supabase, user.brandId, user.brand?.slug);
    const resolvedEmail = rawEmail || buildSyntheticEmail(derivedUsername, brandSlug);
    const loginPath = `/login/${brandSlug}`;

    if (isLive && !adminSupabase) {
      return {
        success: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY is required on the server to provision manager accounts.',
      };
    }

    let shopName = 'Assigned Shop';
    let shopCode = 'SHOP';

    if (isLive) {
      const { data: shopCheck } = await supabase
        .from('shops')
        .select('id, name, code')
        .eq('id', shopId)
        .eq('brand_id', user.brandId)
        .maybeSingle();
      if (!shopCheck) {
        return { success: false, error: 'Selected shop does not belong to your brand.' };
      }
      shopName = shopCheck.name;
      shopCode = shopCheck.code;

      if (derivedUsername) {
        const { data: dupUser } = await adminSupabase
          .from('profiles')
          .select('id')
          .eq('brand_id', user.brandId)
          .ilike('username', derivedUsername)
          .maybeSingle();
        if (dupUser) {
          return {
            success: false,
            error: `Username "${derivedUsername}" is already taken in this brand.`,
          };
        }
      }
    }

    let newUserId: string;
    let createdAuthUser = false;

    if (adminSupabase) {
      const { data: authData, error: authErr } = await adminSupabase.auth.admin.createUser({
        email: resolvedEmail,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name: fullName, username: derivedUsername },
      });

      if (authErr || !authData?.user) {
        return {
          success: false,
          error: `Auth creation failed: ${authErr?.message || 'Unable to create auth user'}`,
        };
      }
      newUserId = authData.user.id;
      createdAuthUser = true;
    } else {
      newUserId = '60000000-0000-0000-0000-' + Math.floor(100000000000 + Math.random() * 900000000000);
    }

    const profileDb = adminSupabase || supabase;
    const { error: profileErr } = await profileDb.from('profiles').upsert({
      id: newUserId,
      role: 'manager',
      brand_id: user.brandId,
      shop_id: shopId,
      full_name: fullName,
      username: derivedUsername || null,
      phone: phone || null,
      is_active: true,
      must_change_password: true,
    });

    if (profileErr) {
      if (createdAuthUser && adminSupabase) {
        await adminSupabase.auth.admin.deleteUser(newUserId);
      }
      if (isLive) {
        const isMissingColumn =
          profileErr.code === 'PGRST204' ||
          profileErr.code === '42703' ||
          /schema cache|username/i.test(profileErr.message || '');
        return {
          success: false,
          error: isMissingColumn
            ? 'Database migration required: please run supabase/migrations/20261112000000_shop_logins_items_qty_reports.sql in your Supabase SQL Editor, then try again.'
            : `Profile creation failed: ${profileErr.message}`,
        };
      }
    }

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'CREATE',
      table_name: 'profiles',
      record_id: newUserId,
      new_data: {
        full_name: fullName,
        username: derivedUsername,
        shop_id: shopId,
        role: 'manager',
      },
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/shops');
    return {
      success: true,
      data: {
        id: newUserId,
        email: resolvedEmail,
        username: derivedUsername,
        temporaryPassword: tempPassword,
        loginPath,
        shopName,
        shopCode,
        managerName: fullName,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to create manager account' };
  }
}

export async function toggleUserStatusAction(userId: string, isActive: boolean): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const supabase = (await createClient()) as any;
    const db = (tryGetAdminClient() as any) || supabase;
    const { error } = await db
      .from('profiles')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('brand_id', user.brandId);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'UPDATE',
      table_name: 'profiles',
      record_id: userId,
      new_data: { is_active: isActive },
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/shops');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function reassignUserShopAction(userId: string, newShopId: string): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const supabase = (await createClient()) as any;
    const db = (tryGetAdminClient() as any) || supabase;
    const { error } = await db
      .from('profiles')
      .update({ shop_id: newShopId, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('brand_id', user.brandId);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'UPDATE',
      table_name: 'profiles',
      record_id: userId,
      new_data: { shop_id: newShopId },
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/shops');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function resetManagerPasswordAction(userId: string, temporaryPassword?: string): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  const tempPass = (temporaryPassword || '').trim() || generateReadablePassword();
  const isLive = isSupabaseConfigured();

  try {
    const adminSupabase = tryGetAdminClient() as any;
    const supabase = (await createClient()) as any;
    const brandSlug = await resolveBrandSlugForAdmin(supabase, user.brandId, user.brand?.slug);

    if (isLive && !adminSupabase) {
      return {
        success: false,
        error: 'SUPABASE_SERVICE_ROLE_KEY is required on the server to reset manager passwords.',
      };
    }

    const db = adminSupabase || supabase;
    const { data: mgrProfile } = await db
      .from('profiles')
      .select('id, full_name, username, shop_id, shops!shop_id(name, code)')
      .eq('id', userId)
      .eq('brand_id', user.brandId)
      .maybeSingle();

    if (isLive && !mgrProfile) {
      return { success: false, error: 'Manager account not found in your brand.' };
    }

    if (adminSupabase) {
      const { error: authErr } = await adminSupabase.auth.admin.updateUserById(userId, {
        password: tempPass,
      });
      if (authErr) return { success: false, error: authErr.message };
    }

    const { error: profileErr } = await db
      .from('profiles')
      .update({ must_change_password: true, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .eq('brand_id', user.brandId);

    if (isLive && profileErr) {
      return { success: false, error: profileErr.message };
    }

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'RESET_PASSWORD',
      table_name: 'profiles',
      record_id: userId,
      new_data: { password_reset: true, must_change_password: true },
    });

    revalidatePath('/admin/users');
    revalidatePath('/admin/shops');
    return {
      success: true,
      data: {
        temporaryPassword: tempPass,
        username: mgrProfile?.username || '',
        fullName: mgrProfile?.full_name || 'Shop Manager',
        shopName: mgrProfile?.shops?.name || 'Shop',
        shopCode: mgrProfile?.shops?.code || 'SHOP',
        loginPath: `/login/${brandSlug}`,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------------------------------------
// 3. ITEMS & PAYMENT MODES ACTIONS
// -----------------------------------------------------------------------------

export async function saveItemAction(formData: {
  id?: string;
  name: string;
  kind: 'income' | 'expense';
  category: string;
  unit?: string;
  defaultRate?: number | null;
  shopId?: string | null;
}): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  const trimmedName = formData.name.trim();
  const trimmedCategory = formData.category.trim();
  const cleanUnit = (formData.unit || 'pcs').trim() || 'pcs';
  const defaultRate =
    formData.defaultRate !== undefined &&
    formData.defaultRate !== null &&
    !Number.isNaN(Number(formData.defaultRate)) &&
    Number(formData.defaultRate) > 0
      ? Math.round(Number(formData.defaultRate) * 100) / 100
      : null;

  if (!trimmedName || !trimmedCategory) {
    return { success: false, error: 'Item name and category are required.' };
  }

  const isLive = isSupabaseConfigured();

  try {
    const supabase = (await createClient()) as any;

    if (!isLive) {
      return {
        success: true,
        data: {
          id: formData.id || `item-${Date.now()}`,
          brand_id: user.brandId,
          shop_id: formData.shopId ?? null,
          created_by: user.id,
          name: trimmedName,
          kind: formData.kind,
          category: trimmedCategory,
          unit: cleanUnit,
          default_rate: defaultRate,
          is_active: true,
        },
      };
    }

    // Case-insensitive duplicate check within brand
    const { data: existingList } = await supabase
      .from('items')
      .select('id, name, shop_id')
      .eq('brand_id', user.brandId);

    const dup = (existingList || []).find(
      (item: any) =>
        item.id !== formData.id &&
        item.name.trim().toLowerCase() === trimmedName.toLowerCase() &&
        (formData.shopId ? item.shop_id === formData.shopId || item.shop_id === null : true)
    );
    if (dup) {
      return {
        success: false,
        error: `An item named "${dup.name}" already exists in this brand catalog.`,
      };
    }

    if (formData.id) {
      // Update item name, category, unit & default rate (past transactions keep snapshots)
      const { data: updatedItem, error } = await supabase
        .from('items')
        .update({
          name: trimmedName,
          category: trimmedCategory,
          unit: cleanUnit,
          default_rate: defaultRate,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', formData.id)
        .eq('brand_id', user.brandId)
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'UPDATE',
        table_name: 'items',
        record_id: formData.id,
        new_data: {
          name: trimmedName,
          category: trimmedCategory,
          unit: cleanUnit,
          default_rate: defaultRate,
        },
      } as any);

      revalidatePath('/admin/items');
      revalidatePath('/shop');
      revalidatePath('/shop/items');
      return { success: true, data: updatedItem };
    } else {
      // Insert new item (Admin-created items default to brand-wide shop_id = null)
      const { data: newItem, error } = await supabase
        .from('items')
        .insert({
          brand_id: user.brandId,
          shop_id: formData.shopId ?? null,
          created_by: user.id,
          name: trimmedName,
          kind: formData.kind,
          category: trimmedCategory,
          unit: cleanUnit,
          default_rate: defaultRate,
          is_active: true,
        } as any)
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'CREATE',
        table_name: 'items',
        record_id: (newItem as any).id,
        new_data: {
          name: trimmedName,
          kind: formData.kind,
          category: trimmedCategory,
          unit: cleanUnit,
          shop_id: formData.shopId ?? null,
        },
      } as any);

      revalidatePath('/admin/items');
      revalidatePath('/shop');
      revalidatePath('/shop/items');
      return { success: true, data: newItem };
    }
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleItemStatusAction(itemId: string, isActive: boolean): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  try {
    const supabase = (await createClient()) as any;

    // Soft delete: set is_active=false. Past transactions keep snapshot.
    const { error } = await supabase
      .from('items')
      .update({ is_active: isActive, updated_at: new Date().toISOString() } as any)
      .eq('id', itemId)
      .eq('brand_id', user.brandId);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'UPDATE',
      table_name: 'items',
      record_id: itemId,
      new_data: { is_active: isActive },
    } as any);

    revalidatePath('/admin/items');
    revalidatePath('/shop');
    revalidatePath('/shop/items');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function promoteItemBrandWideAction(itemId: string): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  try {
    const supabase = (await createClient()) as any;
    const { data: item, error: fetchErr } = await supabase
      .from('items')
      .select('id, name, shop_id')
      .eq('id', itemId)
      .eq('brand_id', user.brandId)
      .maybeSingle();

    if (fetchErr || !item) {
      return { success: false, error: 'Item not found.' };
    }

    const { error } = await supabase
      .from('items')
      .update({ shop_id: null, updated_at: new Date().toISOString() } as any)
      .eq('id', itemId)
      .eq('brand_id', user.brandId);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'UPDATE',
      table_name: 'items',
      record_id: itemId,
      new_data: { name: item.name, shop_id: null, promoted_brand_wide: true },
    } as any);

    revalidatePath('/admin/items');
    revalidatePath('/shop');
    revalidatePath('/shop/items');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function savePaymentModeAction(formData: { id?: string; name: string }): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  const name = formData.name.trim().toUpperCase();
  if (!name) return { success: false, error: 'Payment mode name is required.' };

  try {
    const supabase = (await createClient()) as any;

    if (formData.id) {
      const { error } = await supabase
        .from('payment_modes')
        .update({ name, updated_at: new Date().toISOString() } as any)
        .eq('id', formData.id)
        .eq('brand_id', user.brandId);

      if (error) return { success: false, error: error.message };
    } else {
      const { error } = await supabase.from('payment_modes').insert({
        brand_id: user.brandId,
        name,
        is_active: true,
      } as any);

      if (error) return { success: false, error: error.message };
    }

    revalidatePath('/admin/items');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function togglePaymentModeStatusAction(modeId: string, isActive: boolean): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase
      .from('payment_modes')
      .update({ is_active: isActive, updated_at: new Date().toISOString() } as any)
      .eq('id', modeId)
      .eq('brand_id', user.brandId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/items');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------------------------------------
// 4. EMPLOYEES ACTIONS
// -----------------------------------------------------------------------------

export async function saveEmployeeAction(formData: {
  id?: string;
  shopId: string;
  name: string;
  phone?: string;
  roleTitle?: string;
  ratePerDay: number;
  isActive?: boolean;
}): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  const { id, shopId, name, phone, roleTitle, ratePerDay, isActive } = formData;
  if (!shopId || !name.trim() || ratePerDay < 0) {
    return { success: false, error: 'Shop, employee name, and valid daily rate are required.' };
  }

  try {
    const supabase = (await createClient()) as any;

    if (id) {
      const { error } = await supabase
        .from('employees')
        .update({
          shop_id: shopId,
          name: name.trim(),
          phone: phone?.trim() || null,
          role_title: roleTitle?.trim() || null,
          rate_per_day: ratePerDay,
          is_active: isActive !== undefined ? isActive : true,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', id)
        .eq('brand_id', user.brandId);

      if (error) return { success: false, error: error.message };

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'UPDATE',
        table_name: 'employees',
        record_id: id,
        new_data: { name, rate_per_day: ratePerDay, shop_id: shopId },
      } as any);
    } else {
      const { data: newEmp, error } = await supabase
        .from('employees')
        .insert({
          brand_id: user.brandId,
          shop_id: shopId,
          name: name.trim(),
          phone: phone?.trim() || null,
          role_title: roleTitle?.trim() || null,
          rate_per_day: ratePerDay,
          is_active: true,
        } as any)
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'CREATE',
        table_name: 'employees',
        record_id: (newEmp as any).id,
        new_data: { name, rate_per_day: ratePerDay, shop_id: shopId },
      } as any);
    }

    revalidatePath('/admin/employees');
    revalidatePath('/shop/staff');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleEmployeeStatusAction(employeeId: string, isActive: boolean): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase
      .from('employees')
      .update({ is_active: isActive, updated_at: new Date().toISOString() } as any)
      .eq('id', employeeId)
      .eq('brand_id', user.brandId);

    if (error) return { success: false, error: error.message };

    revalidatePath('/admin/employees');
    revalidatePath('/shop/staff');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------------------------------------
// 5. ASSETS & SERVICE ACTIONS
// -----------------------------------------------------------------------------

export async function saveAssetAction(formData: {
  id?: string;
  shopId: string;
  name: string;
  category: 'freezer' | 'fryer' | 'lights' | 'chiller' | 'grinder' | 'other';
  model?: string;
  serialNo?: string;
  purchaseDate?: string;
  cost?: number;
  vendor?: string;
  status: 'working' | 'needs_repair' | 'out_of_service';
  serviceIntervalDays?: number;
  nextServiceDue?: string;
  notes?: string;
}): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  const { id, shopId, name, category, model, serialNo, purchaseDate, cost, vendor, status, serviceIntervalDays, nextServiceDue, notes } = formData;
  if (!shopId || !name.trim() || !category) {
    return { success: false, error: 'Shop, asset name, and category are required.' };
  }

  try {
    const supabase = (await createClient()) as any;

    const payload = {
      brand_id: user.brandId,
      shop_id: shopId,
      name: name.trim(),
      category,
      model: model?.trim() || null,
      serial_no: serialNo?.trim() || null,
      purchase_date: purchaseDate || null,
      cost: cost || null,
      vendor: vendor?.trim() || null,
      status: status || 'working',
      service_interval_days: serviceIntervalDays || 90,
      next_service_due: nextServiceDue || null,
      notes: notes?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    if (id) {
      const { error } = await supabase
        .from('assets')
        .update(payload as any)
        .eq('id', id)
        .eq('brand_id', user.brandId);

      if (error) return { success: false, error: error.message };

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'UPDATE',
        table_name: 'assets',
        record_id: id,
        new_data: payload,
      } as any);
    } else {
      const { data: newAsset, error } = await supabase
        .from('assets')
        .insert(payload as any)
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      await supabase.from('audit_log').insert({
        user_id: user.id,
        action: 'CREATE',
        table_name: 'assets',
        record_id: (newAsset as any).id,
        new_data: payload,
      } as any);
    }

    revalidatePath('/admin/assets');
    revalidatePath('/shop/assets');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteAssetAction(assetId: string): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  try {
    const supabase = (await createClient()) as any;
    const { error } = await supabase
      .from('assets')
      .delete()
      .eq('id', assetId)
      .eq('brand_id', user.brandId);

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'DELETE',
      table_name: 'assets',
      record_id: assetId,
    } as any);

    revalidatePath('/admin/assets');
    revalidatePath('/shop/assets');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function logAdminAssetServiceAction(formData: {
  assetId: string;
  shopId: string;
  serviceDate: string;
  vendor: string;
  cost: number;
  notes: string;
  nextDue: string;
}): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  const { assetId, shopId, serviceDate, vendor, cost, notes, nextDue } = formData;
  if (!assetId || !serviceDate) {
    return { success: false, error: 'Asset and service date are required.' };
  }

  try {
    const supabase = (await createClient()) as any;

    // 1. Insert service log
    const { error: logErr } = await supabase.from('asset_service_logs').insert({
      asset_id: assetId,
      service_date: serviceDate,
      vendor: vendor.trim() || null,
      cost: cost || 0,
      notes: notes.trim() || null,
      next_due: nextDue || null,
    } as any);

    if (logErr) return { success: false, error: logErr.message };

    // 2. Update asset dates
    await supabase
      .from('assets')
      .update({
        last_service_date: serviceDate,
        next_service_due: nextDue || null,
        status: 'working',
        updated_at: new Date().toISOString(),
      } as any)
      .eq('id', assetId)
      .eq('brand_id', user.brandId);

    // 3. If cost > 0, log as expense transaction in the shop ledger
    if (cost > 0) {
      await supabase.from('transactions').insert({
        brand_id: user.brandId,
        shop_id: shopId,
        txn_date: serviceDate,
        kind: 'expense',
        item_name_snapshot: 'Machine Repair & Service',
        mode_name_snapshot: 'BANK',
        amount: cost,
        note: `Asset Service: ${vendor || 'Vendor'} - ${notes || 'Maintenance'}`,
        txn_type: 'normal',
        created_by: user.id,
      } as any);
    }

    revalidatePath('/admin/assets');
    revalidatePath('/shop/assets');
    revalidatePath('/shop');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------------------------------------
// 6. BRAND SETTINGS, MONTH CLOSING, & MANUAL OVERRIDE
// -----------------------------------------------------------------------------

export async function updateBrandSettingsAction(_formData: {
  primaryColor?: string;
  secondaryColor?: string;
}): Promise<ActionResult> {
  // Security enforcement: Only Platform Master (in /master/brands/[id]/theme)
  // is permitted to modify brand visual identity, colors, logos, or settings.
  return {
    success: false,
    error: 'Forbidden: Only Platform Master can modify brand appearance and theme settings.',
  };
}

export async function closeMonthAction(shopId: string, month: string): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  if (!shopId || !month || !/^\d{4}-\d{2}$/.test(month)) {
    return { success: false, error: 'Valid shop and month (YYYY-MM) are required.' };
  }

  try {
    const supabase = (await createClient()) as any;

    // Mark closed_at
    const { error } = await supabase
      .from('month_openings')
      .upsert({
        shop_id: shopId,
        month,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'shop_id,month' });

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'CLOSE_MONTH',
      table_name: 'month_openings',
      record_id: shopId,
      new_data: { month, closed_at: new Date().toISOString() },
    } as any);

    revalidatePath('/admin/settings');
    revalidatePath('/shop');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function overrideMonthOpeningAction(formData: {
  shopId: string;
  month: string;
  openingBalance: number;
  note: string;
}): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  const { shopId, month, openingBalance, note } = formData;
  if (!shopId || !month || !note?.trim()) {
    return { success: false, error: 'Shop, month, opening balance, and an audit note are required for manual overrides.' };
  }

  try {
    const supabase = (await createClient()) as any;

    const { error } = await supabase
      .from('month_openings')
      .upsert({
        shop_id: shopId,
        month,
        opening_balance: openingBalance,
        is_manual: true,
        note: note.trim(),
        updated_at: new Date().toISOString(),
      } as any, { onConflict: 'shop_id,month' });

    if (error) return { success: false, error: error.message };

    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'OVERRIDE_OPENING',
      table_name: 'month_openings',
      record_id: shopId,
      new_data: { month, opening_balance: openingBalance, note },
    } as any);

    revalidatePath('/admin/settings');
    revalidatePath('/shop');
    revalidatePath('/shop/summary');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// -----------------------------------------------------------------------------
// 7. EXCEL DATA IMPORT ACTION
// -----------------------------------------------------------------------------

export async function importExcelTransactionsAction(data: {
  shopId: string;
  month: string;
  openingBalance: number;
  rows: Array<{
    date: string;
    description: string;
    mop: string;
    income: number;
    expense: number;
    isSalaryAdvance?: boolean;
    employeeName?: string;
  }>;
}): Promise<ActionResult> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'admin' || !user.brandId) {
    return { success: false, error: 'Unauthorized.' };
  }

  const { shopId, month, openingBalance, rows } = data;
  if (!shopId || !month || !rows || rows.length === 0) {
    return { success: false, error: 'Shop, month, and transaction rows are required.' };
  }

  try {
    const supabase = (await createClient()) as any;

    // 1. Upsert month opening
    await supabase.from('month_openings').upsert({
      shop_id: shopId,
      month,
      opening_balance: openingBalance,
      is_manual: true,
      note: `Imported from Monthly Excel Statement (${month})`,
      updated_at: new Date().toISOString(),
    } as any, { onConflict: 'shop_id,month' });

    // 2. Insert transactions
    const txnsToInsert: any[] = [];
    for (const r of rows) {
      if (r.income > 0) {
        txnsToInsert.push({
          brand_id: user.brandId,
          shop_id: shopId,
          txn_date: r.date,
          kind: 'income',
          item_name_snapshot: r.description || 'Counter Billing',
          mode_name_snapshot: (r.mop || 'CASH').toUpperCase(),
          amount: r.income,
          note: 'Excel Import',
          txn_type: 'normal',
          created_by: user.id,
        });
      }
      if (r.expense > 0) {
        const isSA = r.isSalaryAdvance || r.description.toUpperCase().startsWith('SA-');
        txnsToInsert.push({
          brand_id: user.brandId,
          shop_id: shopId,
          txn_date: r.date,
          kind: 'expense',
          item_name_snapshot: isSA ? 'Salary Advance' : (r.description || 'General Expense'),
          mode_name_snapshot: (r.mop || 'CASH').toUpperCase(),
          amount: r.expense,
          note: r.description,
          txn_type: isSA ? 'salary_advance' : 'normal',
          created_by: user.id,
        });
      }
    }

    if (txnsToInsert.length > 0) {
      // Chunk inserts in batches of 100
      const chunkSize = 100;
      for (let i = 0; i < txnsToInsert.length; i += chunkSize) {
        const batch = txnsToInsert.slice(i, i + chunkSize);
        const { error: insErr } = await supabase.from('transactions').insert(batch as any);
        if (insErr) {
          console.error('Batch insert error:', insErr);
          return { success: false, error: `Batch insert error: ${insErr.message}` };
        }
      }
    }

    // 3. Audit log
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'IMPORT_EXCEL',
      table_name: 'transactions',
      record_id: shopId,
      new_data: { row_count: rows.length, txns_count: txnsToInsert.length, month, opening_balance: openingBalance },
    } as any);

    revalidatePath('/admin');
    revalidatePath('/admin/shops');
    revalidatePath(`/admin/shops/${shopId}`);
    revalidatePath('/shop');
    return {
      success: true,
      data: {
        importedCount: txnsToInsert.length,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

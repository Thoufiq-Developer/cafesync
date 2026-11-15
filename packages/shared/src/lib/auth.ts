import { cache } from 'react';
import { createClient } from './supabase/server';
import { cookies } from 'next/headers';
import { ThemeMode, UserRole } from './supabase/types';
import { DEMO_USERS } from './demo-data';
import { isSupabaseConfigured } from './supabase/config';

export interface CurrentUserContext {
  id: string;
  email: string | null;
  username?: string | null;
  mustChangePassword?: boolean;
  themeMode?: ThemeMode | null;
  role: UserRole;
  brandId: string | null;
  shopId: string | null;
  fullName: string;
  phone: string | null;
  brand?: {
    id: string;
    name: string;
    slug?: string;
    logo_url: string | null;
    primary_color: string;
    secondary_color: string;
    registration_no: string;
    gstin: string | null;
  } | null;
  shop?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

function slugifyName(name?: string | null): string {
  return (name || 'brand')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'brand';
}

export const getCurrentUserContext = cache(async (): Promise<CurrentUserContext | null> => {
  // 1. Demo Mode session ONLY applies when Supabase is NOT configured
  if (!isSupabaseConfigured()) {
    const cookieStore = await cookies();
    const demoCookie = cookieStore.get('cafeledger_demo_user')?.value;
    if (demoCookie) {
      try {
        const parsed = JSON.parse(demoCookie);
        const demoUser = DEMO_USERS[parsed.email];
        if (demoUser) {
          return {
            id: demoUser.id,
            email: demoUser.email,
            username: demoUser.email.split('@')[0],
            mustChangePassword: false,
            themeMode: null,
            role: demoUser.role,
            brandId: demoUser.brand?.id || null,
            shopId: demoUser.shop?.id || null,
            fullName: demoUser.fullName,
            phone: demoUser.phone,
            brand: demoUser.brand || null,
            shop: demoUser.shop || null,
          };
        }
      } catch {
        // ignore JSON parse error
      }
    }
    return null;
  }

  // 2. Query live Supabase
  try {
    const supabase = (await createClient()) as any;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    // Attempt full column select; gracefully fall back if optional migration columns
    // (e.g. username or theme_mode) are not yet applied in the connected database.
    type ProfileRow = {
      id: string;
      role: UserRole;
      brand_id: string | null;
      shop_id: string | null;
      full_name: string;
      username?: string | null;
      phone: string | null;
      is_active: boolean;
      must_change_password?: boolean;
      theme_mode?: ThemeMode | null;
    };

    let profile: ProfileRow | null = null;
    const primaryRes = await supabase
      .from('profiles')
      .select('id, role, brand_id, shop_id, full_name, username, phone, is_active, must_change_password, theme_mode')
      .eq('id', user.id)
      .single();

    if (!primaryRes.error && primaryRes.data) {
      profile = primaryRes.data;
    } else if (primaryRes.error) {
      const noUsernameRes = await supabase
        .from('profiles')
        .select('id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password, theme_mode')
        .eq('id', user.id)
        .single();

      if (!noUsernameRes.error && noUsernameRes.data) {
        profile = noUsernameRes.data;
      } else {
        const minimalRes = await supabase
          .from('profiles')
          .select('id, role, brand_id, shop_id, full_name, phone, is_active, must_change_password')
          .eq('id', user.id)
          .single();
        profile = minimalRes.data || null;
      }
    }

    if (!profile || !profile.is_active) {
      return null;
    }

    const fetchBrand = async () => {
      if (!profile!.brand_id) return null;
      const res = await supabase
        .from('brands')
        .select('id, name, slug, logo_url, primary_color, secondary_color, registration_no, gstin')
        .eq('id', profile!.brand_id)
        .single();
      if (!res.error && res.data) return res.data;

      const legacyRes = await supabase
        .from('brands')
        .select('id, name, logo_url, primary_color, secondary_color, registration_no, gstin')
        .eq('id', profile!.brand_id)
        .single();
      if (!legacyRes.data) return null;
      return {
        ...legacyRes.data,
        slug: slugifyName(legacyRes.data.name),
      };
    };

    const fetchShop = async () => {
      if (!profile!.shop_id) return null;
      const res = await supabase
        .from('shops')
        .select('id, name, code')
        .eq('id', profile!.shop_id)
        .single();
      return res.data || null;
    };

    const [brand, shop] = await Promise.all([fetchBrand(), fetchShop()]);

    return {
      id: user.id,
      email: user.email || null,
      username: profile.username || null,
      mustChangePassword: Boolean(profile.must_change_password),
      themeMode: profile.theme_mode === 'dark' || profile.theme_mode === 'light' ? profile.theme_mode : null,
      role: profile.role as UserRole,
      brandId: profile.brand_id,
      shopId: profile.shop_id,
      fullName: profile.full_name,
      phone: profile.phone,
      brand,
      shop,
    };
  } catch {
    return null;
  }
});

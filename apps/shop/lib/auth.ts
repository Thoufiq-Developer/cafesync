import { UserRole, ThemeMode } from '@/lib/supabase/types';
import { DEMO_USERS } from '@/lib/demo-data';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { supabase } from './supabase/client';

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

/**
 * Client-safe helper to get the active user context in static site mode.
 * Reads from localStorage demo session or active Supabase session.
 */
export async function getCurrentUserContext(): Promise<CurrentUserContext | null> {
  if (typeof window === 'undefined') return null;

  if (!isSupabaseConfigured()) {
    try {
      const demoRaw = localStorage.getItem('cafesync_demo_user') || localStorage.getItem('cafeledger_demo_user');
      if (demoRaw) {
        const parsed = JSON.parse(demoRaw);
        const demoUser = DEMO_USERS[parsed.email] || Object.values(DEMO_USERS).find((u) => u.email === parsed.email);
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
      }
    } catch {
      // ignore JSON parse error
    }
    return null;
  }

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return null;

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, role, brand_id, shop_id, full_name, username, phone, is_active, must_change_password')
      .eq('id', session.user.id)
      .maybeSingle();

    if (!profile || !profile.is_active) return null;

    let brand = null;
    if (profile.brand_id) {
      const { data: b } = await supabase
        .from('brands')
        .select('id, name, slug, logo_url, primary_color, secondary_color, registration_no, gstin')
        .eq('id', profile.brand_id)
        .maybeSingle();
      brand = b;
    }

    let shop = null;
    if (profile.shop_id) {
      const { data: s } = await supabase
        .from('shops')
        .select('id, name, code')
        .eq('id', profile.shop_id)
        .maybeSingle();
      shop = s;
    }

    return {
      id: profile.id,
      email: session.user.email || null,
      username: profile.username || (session.user.email ? session.user.email.split('@')[0] : null),
      mustChangePassword: profile.must_change_password ?? false,
      themeMode: null,
      role: profile.role,
      brandId: profile.brand_id,
      shopId: profile.shop_id,
      fullName: profile.full_name,
      phone: profile.phone,
      brand,
      shop,
    };
  } catch (err) {
    console.warn('Error getting client user context:', err);
    return null;
  }
}


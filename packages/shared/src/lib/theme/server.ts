import 'server-only';
import { cache } from 'react';
import { unstable_cache, revalidatePath, revalidateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { createClient as createSupabaseJsClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_BRAND } from '@/lib/demo-data';
import { buildDefaultBrandSettings, slugifyBrandName } from './presets';
import { isValidCuratedFont } from './font-options';
import {
  findDemoThemeById,
  findDemoThemeBySlug,
  listDemoThemeBundles,
} from './store';
import type {
  BrandIdentityMeta,
  BrandSettings,
  BrandThemeBundle,
  PublicBrandLoginData,
} from './types';
import type { Database, ThemeMode } from '@/lib/supabase/types';

function createStatelessAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) return null;
  return createSupabaseJsClient<Database>(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function coerceBrandSettings(brand: BrandIdentityMeta, raw: any): BrandSettings {
  const defaults = buildDefaultBrandSettings(brand);
  if (!raw) return defaults;

  return {
    brand_id: brand.id,
    logo_url: raw.logo_url ?? defaults.logo_url,
    logo_dark_url: raw.logo_dark_url ?? defaults.logo_dark_url,
    icon_url: raw.icon_url ?? defaults.icon_url,
    login_bg_url: raw.login_bg_url ?? defaults.login_bg_url,
    login_bg_color: raw.login_bg_color ?? defaults.login_bg_color,
    display_name: raw.display_name || brand.name,
    tagline: raw.tagline ?? defaults.tagline,
    welcome_message: raw.welcome_message ?? defaults.welcome_message,
    primary_color: raw.primary_color || defaults.primary_color,
    secondary_color: raw.secondary_color || defaults.secondary_color,
    accent_color: raw.accent_color || defaults.accent_color,
    font_family: isValidCuratedFont(raw.font_family) ? raw.font_family : defaults.font_family,
    radius: ['sharp', 'rounded', 'pill'].includes(raw.radius) ? raw.radius : defaults.radius,
    sidebar_style: ['light', 'dark', 'brand'].includes(raw.sidebar_style)
      ? raw.sidebar_style
      : defaults.sidebar_style,
    density: ['comfortable', 'compact'].includes(raw.density) ? raw.density : defaults.density,
    default_mode: raw.default_mode === 'dark' ? 'dark' : 'light',
    allow_user_mode_switch: Boolean(raw.allow_user_mode_switch),
    login_layout: raw.login_layout === 'centered' ? 'centered' : 'split',
    login_logo_size: ['sm', 'md', 'lg'].includes(raw.login_logo_size)
      ? raw.login_logo_size
      : 'md',
    pdf_header_style: raw.pdf_header_style === 'centered' ? 'centered' : 'left',
    pdf_footer_text: raw.pdf_footer_text ?? defaults.pdf_footer_text,
    pdf_show_address: raw.pdf_show_address !== false,
    pdf_show_gstin: raw.pdf_show_gstin !== false,
    pdf_show_registration_no: raw.pdf_show_registration_no !== false,
    pdf_signature_line: Boolean(raw.pdf_signature_line),
    updated_by: raw.updated_by ?? null,
    updated_at: raw.updated_at,
  };
}

function buildNeutralFallbackBundle(brandId?: string | null): BrandThemeBundle {
  const safeId = brandId || '00000000-0000-0000-0000-000000000000';
  const brand: BrandIdentityMeta = {
    id: safeId,
    name: 'CafeLedger',
    slug: 'brand',
    registration_no: 'CL-DEFAULT',
    address: null,
    phone: null,
    email: null,
    gstin: null,
    status: 'active',
  };
  return {
    brand,
    settings: {
      ...buildDefaultBrandSettings(brand),
      logo_url: null,
      icon_url: null,
    },
  };
}

async function fetchBrandThemeFromDb(
  brandId: string,
  dbOverride?: any
): Promise<BrandThemeBundle | null> {
  if (!isSupabaseConfigured()) {
    return findDemoThemeById(brandId);
  }

  let db: any = dbOverride || null;
  if (!db) {
    db = createStatelessAnonClient();
  }
  if (!db) return null;

  try {
    const fetchBrandRow = async () => {
      const res = await db
        .from('brands')
        .select('id, name, slug, registration_no, logo_url, primary_color, secondary_color, address, phone, email, gstin, status')
        .eq('id', brandId)
        .maybeSingle();
      if (!res.error) return res.data;

      const legacyRes = await db
        .from('brands')
        .select('id, name, registration_no, logo_url, primary_color, secondary_color, address, phone, email, gstin, status')
        .eq('id', brandId)
        .maybeSingle();
      return legacyRes.data || null;
    };

    const fetchSettingsRow = async () => {
      try {
        const res = await db
          .from('brand_settings')
          .select('*')
          .eq('brand_id', brandId)
          .maybeSingle();
        return res.error ? null : res.data;
      } catch {
        return null;
      }
    };

    const [brandRow, settingsRow] = await Promise.all([fetchBrandRow(), fetchSettingsRow()]);

    if (!brandRow) {
      return null;
    }

    const brand: BrandIdentityMeta = {
      id: brandRow.id,
      name: brandRow.name,
      slug: brandRow.slug || slugifyBrandName(brandRow.name),
      registration_no: brandRow.registration_no,
      address: brandRow.address || null,
      phone: brandRow.phone || null,
      email: brandRow.email || null,
      gstin: brandRow.gstin || null,
      status: brandRow.status || 'active',
    };

    const settings = coerceBrandSettings(brand, {
      logo_url: brandRow.logo_url,
      primary_color: brandRow.primary_color,
      secondary_color: brandRow.secondary_color,
      ...settingsRow,
    });

    return { brand, settings };
  } catch {
    return null;
  }
}

export const findBrandThemeById = cache(async (brandId: string): Promise<BrandThemeBundle | null> => {
  if (!brandId) return null;

  if (!isSupabaseConfigured()) {
    return findDemoThemeById(brandId);
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const cachedFetch = unstable_cache(
      async (id: string) => fetchBrandThemeFromDb(id),
      [`brand-theme-${brandId}`],
      {
        tags: [`brand-theme:${brandId}`],
        revalidate: 3600,
      }
    );
    return cachedFetch(brandId);
  }

  // Fallback without service role key: use caller's authenticated SSR client directly (outside unstable_cache)
  const supabase = (await createClient()) as any;
  return fetchBrandThemeFromDb(brandId, supabase);
});

export const getBrandThemeById = cache(async (brandId?: string | null): Promise<BrandThemeBundle> => {
  if (!isSupabaseConfigured()) {
    const resolvedId = brandId || DEMO_BRAND.id;
    return (
      findDemoThemeById(resolvedId) ||
      findDemoThemeById(DEMO_BRAND.id)!
    );
  }

  if (!brandId) {
    return buildNeutralFallbackBundle();
  }

  const result = await findBrandThemeById(brandId);
  return result || buildNeutralFallbackBundle(brandId);
});

async function fetchBrandLoginBySlugFromDb(slug: string): Promise<PublicBrandLoginData | null> {
  const cleanSlug = slug.trim().toLowerCase();
  if (!cleanSlug) return null;

  if (!isSupabaseConfigured()) {
    const demo = findDemoThemeBySlug(cleanSlug);
    if (!demo) return null;
    return {
      brand_id: demo.brand.id,
      brand_name: demo.brand.name,
      slug: demo.brand.slug,
      status: demo.brand.status,
      display_name: demo.settings.display_name,
      tagline: demo.settings.tagline,
      welcome_message: demo.settings.welcome_message,
      logo_url: demo.settings.logo_url,
      logo_dark_url: demo.settings.logo_dark_url,
      icon_url: demo.settings.icon_url,
      login_bg_url: demo.settings.login_bg_url,
      login_bg_color: demo.settings.login_bg_color,
      primary_color: demo.settings.primary_color,
      secondary_color: demo.settings.secondary_color,
      accent_color: demo.settings.accent_color,
      font_family: demo.settings.font_family,
      radius: demo.settings.radius,
      default_mode: demo.settings.default_mode,
      login_layout: demo.settings.login_layout,
      login_logo_size: demo.settings.login_logo_size,
    };
  }

  try {
    // Must use cookie-less anon client inside unstable_cache (Next.js forbids cookies() inside unstable_cache)
    const supabase = createStatelessAnonClient() as any;
    if (!supabase) return null;
    const { data } = await supabase.rpc('get_public_brand_login', { p_slug: cleanSlug });
    const row = Array.isArray(data) ? data[0] : null;
    if (!row) {
      return null;
    }

    return {
      brand_id: row.brand_id,
      brand_name: row.brand_name,
      slug: row.slug,
      status: row.status,
      display_name: row.display_name || row.brand_name,
      tagline: row.tagline,
      welcome_message: row.welcome_message,
      logo_url: row.logo_url,
      logo_dark_url: row.logo_dark_url,
      icon_url: row.icon_url,
      login_bg_url: row.login_bg_url,
      login_bg_color: row.login_bg_color,
      primary_color: row.primary_color || '#ea580c',
      secondary_color: row.secondary_color || '#9a3412',
      accent_color: row.accent_color || '#f59e0b',
      font_family: isValidCuratedFont(row.font_family) ? row.font_family : 'Inter',
      radius: ['sharp', 'rounded', 'pill'].includes(row.radius) ? row.radius : 'rounded',
      default_mode: row.default_mode === 'dark' ? 'dark' : 'light',
      login_layout: row.login_layout === 'centered' ? 'centered' : 'split',
      login_logo_size: ['sm', 'md', 'lg'].includes(row.login_logo_size)
        ? row.login_logo_size
        : 'md',
    };
  } catch {
    return null;
  }
}

export const getBrandLoginBySlug = cache(async (slug: string): Promise<PublicBrandLoginData | null> => {
  const cleanSlug = (slug || '').trim().toLowerCase();
  if (!cleanSlug) return null;

  if (!isSupabaseConfigured()) {
    return fetchBrandLoginBySlugFromDb(cleanSlug);
  }

  const cachedSlugFetch = unstable_cache(
    async (s: string) => fetchBrandLoginBySlugFromDb(s),
    [`brand-slug-${cleanSlug}`],
    {
      tags: [`brand-slug:${cleanSlug}`],
      revalidate: 3600,
    }
  );

  return cachedSlugFetch(cleanSlug);
});

export async function listAllBrandThemes(): Promise<BrandThemeBundle[]> {
  if (!isSupabaseConfigured()) {
    return listDemoThemeBundles();
  }

  try {
    const db = (await createClient()) as any;
    const { data: brands } = await db
      .from('brands')
      .select('id, name, slug, registration_no, logo_url, primary_color, secondary_color, address, phone, email, gstin, status')
      .order('name', { ascending: true });

    const { data: allSettings } = await db.from('brand_settings').select('*');
    const settingsMap = new Map<string, any>();
    for (const s of allSettings || []) {
      settingsMap.set(s.brand_id, s);
    }

    return (brands || []).map((row: any) => {
      const brand: BrandIdentityMeta = {
        id: row.id,
        name: row.name,
        slug: row.slug || slugifyBrandName(row.name),
        registration_no: row.registration_no,
        address: row.address || null,
        phone: row.phone || null,
        email: row.email || null,
        gstin: row.gstin || null,
        status: row.status || 'active',
      };
      const settings = coerceBrandSettings(brand, {
        logo_url: row.logo_url,
        primary_color: row.primary_color,
        secondary_color: row.secondary_color,
        ...settingsMap.get(row.id),
      });
      return { brand, settings };
    });
  } catch {
    return [];
  }
}

export const resolveEffectiveThemeMode = cache(async (
  settings: BrandSettings,
  userId?: string | null,
  knownThemeMode?: ThemeMode | null
): Promise<ThemeMode> => {
  if (!settings.allow_user_mode_switch) {
    return settings.default_mode || 'light';
  }

  const cookieStore = await cookies();
  const brandCookie = cookieStore.get(`cafeledger_theme_mode_${settings.brand_id}`)?.value;
  if (brandCookie === 'dark' || brandCookie === 'light') {
    return brandCookie;
  }

  if (knownThemeMode === 'dark' || knownThemeMode === 'light') {
    return knownThemeMode;
  }

  if (knownThemeMode === undefined && isSupabaseConfigured() && userId) {
    try {
      const supabase = (await createClient()) as any;
      const { data: profile } = await supabase
        .from('profiles')
        .select('theme_mode')
        .eq('id', userId)
        .maybeSingle();
      if (profile?.theme_mode === 'dark' || profile?.theme_mode === 'light') {
        return profile.theme_mode;
      }
    } catch {
      // fallback to default
    }
  }

  return settings.default_mode || 'light';
});

export function revalidateBrandThemeCache(brandId: string, slug?: string | null) {
  revalidateTag(`brand-theme:${brandId}`, { expire: 0 });
  if (slug) {
    revalidateTag(`brand-slug:${slug}`, { expire: 0 });
    revalidatePath(`/login/${slug}`);
  }
  revalidatePath('/admin', 'layout');
  revalidatePath('/shop', 'layout');
  revalidatePath('/login');
  revalidatePath(`/master/brands/${brandId}`);
  revalidatePath(`/master/brands/${brandId}/theme`);
  revalidatePath('/master/brands');
}


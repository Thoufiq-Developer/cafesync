'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUserContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { normalizeHex } from '@/lib/theme/colors';
import { isValidCuratedFont } from '@/lib/theme/font-options';
import { slugifyBrandName } from '@/lib/theme/presets';
import { revalidateBrandThemeCache } from '@/lib/theme/server';
import {
  appendDemoThemeAudit,
  findDemoThemeById,
  listDemoThemeBundles,
  saveDemoThemeSettings,
} from '@/lib/theme/store';
import type { BrandSettings } from '@/lib/theme/types';

export interface SaveBrandThemeInput {
  brandId: string;
  slug: string;
  settings: {
    logo_url: string | null;
    logo_dark_url: string | null;
    icon_url: string | null;
    login_bg_url: string | null;
    login_bg_color: string | null;
    display_name: string;
    tagline: string | null;
    welcome_message: string | null;
    primary_color: string;
    secondary_color: string;
    accent_color: string;
    font_family: string;
    radius: string;
    sidebar_style: string;
    density: string;
    default_mode: string;
    allow_user_mode_switch: boolean;
    login_layout: string;
    login_logo_size: string;
    pdf_header_style: string;
    pdf_footer_text: string | null;
    pdf_show_address: boolean;
    pdf_show_gstin: boolean;
    pdf_show_registration_no: boolean;
    pdf_signature_line: boolean;
  };
}

export async function saveBrandThemeAction(
  input: SaveBrandThemeInput
): Promise<{ success: boolean; slug?: string; settings?: BrandSettings; error?: string }> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    return {
      success: false,
      error: 'Forbidden: Only Platform Master may design or update brand themes.',
    };
  }

  const cleanSlug = slugifyBrandName(input.slug);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(cleanSlug)) {
    return {
      success: false,
      error: 'Invalid URL slug. Use lowercase letters, numbers, and hyphens only.',
    };
  }

  const displayName = (input.settings.display_name || '').trim();
  if (!displayName) {
    return { success: false, error: 'Display name is required.' };
  }

  const normalizedPatch: Partial<BrandSettings> = {
    logo_url: input.settings.logo_url?.trim() || null,
    logo_dark_url: input.settings.logo_dark_url?.trim() || null,
    icon_url: input.settings.icon_url?.trim() || null,
    login_bg_url: input.settings.login_bg_url?.trim() || null,
    login_bg_color: input.settings.login_bg_color
      ? normalizeHex(input.settings.login_bg_color, '#fff7ed')
      : '#fff7ed',
    display_name: displayName,
    tagline: input.settings.tagline?.trim() || null,
    welcome_message: input.settings.welcome_message?.trim() || null,
    primary_color: normalizeHex(input.settings.primary_color, '#ea580c'),
    secondary_color: normalizeHex(input.settings.secondary_color, '#9a3412'),
    accent_color: normalizeHex(input.settings.accent_color, '#f59e0b'),
    font_family: isValidCuratedFont(input.settings.font_family)
      ? input.settings.font_family
      : 'Inter',
    radius: ['sharp', 'rounded', 'pill'].includes(input.settings.radius)
      ? (input.settings.radius as BrandSettings['radius'])
      : 'rounded',
    sidebar_style: ['light', 'dark', 'brand'].includes(input.settings.sidebar_style)
      ? (input.settings.sidebar_style as BrandSettings['sidebar_style'])
      : 'light',
    density: ['comfortable', 'compact'].includes(input.settings.density)
      ? (input.settings.density as BrandSettings['density'])
      : 'comfortable',
    default_mode: input.settings.default_mode === 'dark' ? 'dark' : 'light',
    allow_user_mode_switch: Boolean(input.settings.allow_user_mode_switch),
    login_layout: input.settings.login_layout === 'centered' ? 'centered' : 'split',
    login_logo_size: ['sm', 'md', 'lg'].includes(input.settings.login_logo_size)
      ? (input.settings.login_logo_size as BrandSettings['login_logo_size'])
      : 'md',
    pdf_header_style: input.settings.pdf_header_style === 'centered' ? 'centered' : 'left',
    pdf_footer_text: input.settings.pdf_footer_text?.trim() || null,
    pdf_show_address: Boolean(input.settings.pdf_show_address),
    pdf_show_gstin: Boolean(input.settings.pdf_show_gstin),
    pdf_show_registration_no: Boolean(input.settings.pdf_show_registration_no),
    pdf_signature_line: Boolean(input.settings.pdf_signature_line),
    updated_by: user.id,
  };

  if (!isSupabaseConfigured()) {
    const existing = findDemoThemeById(input.brandId);
    if (!existing) {
      return { success: false, error: 'Brand not found.' };
    }

    const oldSlug = existing.brand.slug;
    const allBundles = listDemoThemeBundles();
    const conflict = allBundles.find(
      (b) => b.brand.id !== input.brandId && b.brand.slug.toLowerCase() === cleanSlug
    );
    if (conflict) {
      return {
        success: false,
        error: `Slug "${cleanSlug}" is already assigned to "${conflict.brand.name}".`,
      };
    }

    const saved = saveDemoThemeSettings(input.brandId, cleanSlug, normalizedPatch);
    if (!saved) {
      return { success: false, error: 'Failed to save brand settings.' };
    }

    appendDemoThemeAudit({
      id: `audit-${Date.now()}`,
      user_id: user.id,
      user_name: user.fullName || 'Platform Master',
      brand_id: input.brandId,
      brand_name: saved.brand.name,
      action: 'UPDATE',
      table_name: 'brand_settings',
      details: `Updated theme in Studio (primary ${normalizedPatch.primary_color}, font ${normalizedPatch.font_family}, sidebar ${normalizedPatch.sidebar_style}, slug /login/${cleanSlug})`,
      at: new Date().toISOString(),
    });

    if (oldSlug && oldSlug !== cleanSlug) {
      revalidateBrandThemeCache(input.brandId, oldSlug);
    }
    revalidateBrandThemeCache(input.brandId, cleanSlug);
    revalidatePath('/master');
    revalidatePath('/master/audit');

    return { success: true, slug: cleanSlug, settings: saved.settings };
  }

  try {
    const supabase = (await createClient()) as any;

    // Fetch current slug to invalidate old path cleanly if slug changed
    const { data: currentBrand } = await supabase
      .from('brands')
      .select('slug, name')
      .eq('id', input.brandId)
      .maybeSingle();

    const { data: slugConflict } = await supabase
      .from('brands')
      .select('id, name')
      .eq('slug', cleanSlug)
      .neq('id', input.brandId)
      .maybeSingle();

    if (slugConflict) {
      return {
        success: false,
        error: `Slug "${cleanSlug}" is already used by "${slugConflict.name}".`,
      };
    }

    // 1. Update core brand slug + legacy sync columns
    const { error: brandErr } = await supabase
      .from('brands')
      .update({
        slug: cleanSlug,
        logo_url: normalizedPatch.logo_url,
        primary_color: normalizedPatch.primary_color,
        secondary_color: normalizedPatch.secondary_color,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.brandId);

    if (brandErr) {
      return { success: false, error: brandErr.message };
    }

    // 2. Upsert full brand_settings
    const { data: savedRow, error: settingsErr } = await supabase
      .from('brand_settings')
      .upsert(
        {
          brand_id: input.brandId,
          ...normalizedPatch,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'brand_id' }
      )
      .select()
      .single();

    if (settingsErr) {
      return { success: false, error: settingsErr.message };
    }

    // 3. Explicit audit log note (DB trigger also records row diff)
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'UPDATE',
      table_name: 'brand_settings',
      record_id: input.brandId,
      new_data: {
        slug: cleanSlug,
        display_name: normalizedPatch.display_name,
        primary_color: normalizedPatch.primary_color,
        font_family: normalizedPatch.font_family,
        sidebar_style: normalizedPatch.sidebar_style,
        login_layout: normalizedPatch.login_layout,
      },
    });

    if (currentBrand?.slug && currentBrand.slug !== cleanSlug) {
      revalidateBrandThemeCache(input.brandId, currentBrand.slug);
    }
    revalidateBrandThemeCache(input.brandId, cleanSlug);
    revalidatePath('/master');
    revalidatePath('/master/audit');

    return { success: true, slug: cleanSlug, settings: savedRow as BrandSettings };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to save brand theme' };
  }
}

export async function logThemePreviewAsAdminAction(
  brandId: string,
  brandName: string
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    return {
      success: false,
      error: 'Forbidden: Only Platform Master can launch read-only admin previews.',
    };
  }

  if (!isSupabaseConfigured()) {
    appendDemoThemeAudit({
      id: `audit-${Date.now()}`,
      user_id: user.id,
      user_name: user.fullName || 'Platform Master',
      brand_id: brandId,
      brand_name: brandName,
      action: 'VIEW_AS_ADMIN',
      table_name: 'brand_settings',
      details: `Master opened read-only "View as brand admin" inspection from Theme Studio for "${brandName}"`,
      at: new Date().toISOString(),
    });
    revalidatePath('/master/audit');
    revalidatePath('/master');
    return { success: true };
  }

  try {
    const supabase = (await createClient()) as any;
    await supabase.from('audit_log').insert({
      user_id: user.id,
      action: 'VIEW_AS_ADMIN',
      table_name: 'brand_settings',
      record_id: brandId,
      new_data: {
        brand_name: brandName,
        source: 'Brand Theme Studio',
        initiated_by: user.email,
      },
    });
    revalidatePath('/master/audit');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Audit log failed' };
  }
}


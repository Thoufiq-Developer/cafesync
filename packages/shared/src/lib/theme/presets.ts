import type { BrandIdentityMeta, BrandPreset, BrandSettings } from './types';

export const BRAND_PRESETS: BrandPreset[] = [
  {
    id: 'coffee-brown',
    name: 'Coffee Brown',
    description: 'Warm espresso & crema artisanal cafe tones',
    primary_color: '#6f4e37',
    secondary_color: '#3e2723',
    accent_color: '#d97706',
    sidebar_style: 'dark',
    font_family: 'Playfair Display',
    radius: 'rounded',
  },
  {
    id: 'fresh-green',
    name: 'Fresh Green',
    description: 'Clean botanical matcha & garden bistro feel',
    primary_color: '#16a34a',
    secondary_color: '#14532d',
    accent_color: '#84cc16',
    sidebar_style: 'light',
    font_family: 'Nunito',
    radius: 'pill',
  },
  {
    id: 'royal-blue',
    name: 'Royal Blue',
    description: 'Crisp specialty roastery blue & precision cobalt',
    primary_color: '#1d4ed8',
    secondary_color: '#1e3a8a',
    accent_color: '#0ea5e9',
    sidebar_style: 'dark',
    font_family: 'Montserrat',
    radius: 'sharp',
  },
  {
    id: 'sunset-orange',
    name: 'Sunset Orange',
    description: 'Energetic saffron terracotta & warm bakery amber',
    primary_color: '#ea580c',
    secondary_color: '#9a3412',
    accent_color: '#f59e0b',
    sidebar_style: 'light',
    font_family: 'Poppins',
    radius: 'rounded',
  },
  {
    id: 'berry',
    name: 'Berry',
    description: 'Vibrant dessert patisserie plum & roseberry',
    primary_color: '#be185d',
    secondary_color: '#831843',
    accent_color: '#f43f5e',
    sidebar_style: 'brand',
    font_family: 'DM Sans',
    radius: 'pill',
  },
  {
    id: 'charcoal',
    name: 'Charcoal',
    description: 'Architectural monochrome obsidian & warm brass',
    primary_color: '#1e293b',
    secondary_color: '#0f172a',
    accent_color: '#d97706',
    sidebar_style: 'dark',
    font_family: 'Inter',
    radius: 'sharp',
  },
  {
    id: 'teal',
    name: 'Teal',
    description: 'Coastal lounge teal & refreshing mint ledger',
    primary_color: '#0d9488',
    secondary_color: '#115e59',
    accent_color: '#14b8a6',
    sidebar_style: 'brand',
    font_family: 'DM Sans',
    radius: 'rounded',
  },
  {
    id: 'classic-red',
    name: 'Classic Red',
    description: 'Heritage diner crimson & vintage bistro gold',
    primary_color: '#dc2626',
    secondary_color: '#991b1b',
    accent_color: '#f59e0b',
    sidebar_style: 'light',
    font_family: 'Montserrat',
    radius: 'rounded',
  },
];

export const DEFAULT_BRAND_THEME_VALUES: Omit<BrandSettings, 'brand_id' | 'display_name'> = {
  logo_url: null,
  logo_dark_url: null,
  icon_url: null,
  login_bg_url: null,
  login_bg_color: '#fff7ed',
  tagline: 'Multi-Outlet Cafe Accounts & Daily Operations',
  welcome_message: 'Welcome back',
  primary_color: '#ea580c',
  secondary_color: '#9a3412',
  accent_color: '#f59e0b',
  font_family: 'Inter',
  radius: 'rounded',
  sidebar_style: 'light',
  density: 'comfortable',
  default_mode: 'light',
  allow_user_mode_switch: false,
  login_layout: 'split',
  login_logo_size: 'md',
  pdf_header_style: 'left',
  pdf_footer_text: null,
  pdf_show_address: true,
  pdf_show_gstin: true,
  pdf_show_registration_no: true,
  pdf_signature_line: false,
};

export function slugifyBrandName(name: string): string {
  const cleaned = (name || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'brand';
}

export function buildDefaultBrandSettings(
  brand: Pick<BrandIdentityMeta, 'id' | 'name'> & {
    logo_url?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
  }
): BrandSettings {
  return {
    brand_id: brand.id,
    display_name: brand.name,
    ...DEFAULT_BRAND_THEME_VALUES,
    logo_url: brand.logo_url || null,
    primary_color: brand.primary_color || '#ea580c',
    secondary_color: brand.secondary_color || '#9a3412',
    welcome_message: `Welcome back to ${brand.name}`,
  };
}


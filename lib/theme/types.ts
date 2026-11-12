import type {
  BrandStatus,
  LoginLayout,
  LoginLogoSize,
  PdfHeaderStyle,
  SidebarStyle,
  ThemeDensity,
  ThemeMode,
  ThemeRadius,
} from '@/lib/supabase/types';

export type {
  BrandStatus,
  LoginLayout,
  LoginLogoSize,
  PdfHeaderStyle,
  SidebarStyle,
  ThemeDensity,
  ThemeMode,
  ThemeRadius,
};

export type CuratedFont =
  | 'Inter'
  | 'Poppins'
  | 'Nunito'
  | 'Montserrat'
  | 'Playfair Display'
  | 'DM Sans';

export interface BrandSettings {
  brand_id: string;
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
  font_family: CuratedFont;
  radius: ThemeRadius;
  sidebar_style: SidebarStyle;
  density: ThemeDensity;
  default_mode: ThemeMode;
  allow_user_mode_switch: boolean;
  login_layout: LoginLayout;
  login_logo_size: LoginLogoSize;
  pdf_header_style: PdfHeaderStyle;
  pdf_footer_text: string | null;
  pdf_show_address: boolean;
  pdf_show_gstin: boolean;
  pdf_show_registration_no: boolean;
  pdf_signature_line: boolean;
  updated_by?: string | null;
  updated_at?: string;
}

export interface BrandIdentityMeta {
  id: string;
  name: string;
  slug: string;
  registration_no: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  gstin: string | null;
  status: BrandStatus;
}

export interface BrandThemeBundle {
  brand: BrandIdentityMeta;
  settings: BrandSettings;
}

export interface PublicBrandLoginData {
  brand_id: string;
  brand_name: string;
  slug: string;
  status: BrandStatus;
  display_name: string;
  tagline: string | null;
  welcome_message: string | null;
  logo_url: string | null;
  logo_dark_url: string | null;
  icon_url: string | null;
  login_bg_url: string | null;
  login_bg_color: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  font_family: CuratedFont;
  radius: ThemeRadius;
  default_mode: ThemeMode;
  login_layout: LoginLayout;
  login_logo_size: LoginLogoSize;
}

export interface BrandPreset {
  id: string;
  name: string;
  description: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  sidebar_style: SidebarStyle;
  font_family: CuratedFont;
  radius: ThemeRadius;
}

export interface ColorPalette50To900 {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
}

import { ThemeMode, UserRole } from './supabase/types';

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

export function slugifyName(name?: string | null): string {
  return (name || 'brand')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'brand';
}

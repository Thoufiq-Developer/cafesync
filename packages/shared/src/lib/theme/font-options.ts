import type { CuratedFont } from './types';

export interface CuratedFontOption {
  id: CuratedFont;
  label: string;
  vibe: string;
  cssVariable: string;
  fallbackStack: string;
}

export const CURATED_FONTS: CuratedFontOption[] = [
  {
    id: 'Inter',
    label: 'Inter',
    vibe: 'Crisp SaaS Swiss sans-serif',
    cssVariable: '--font-brand-inter',
    fallbackStack: 'system-ui, -apple-system, sans-serif',
  },
  {
    id: 'Poppins',
    label: 'Poppins',
    vibe: 'Friendly geometric cafe modern',
    cssVariable: '--font-brand-poppins',
    fallbackStack: 'system-ui, -apple-system, sans-serif',
  },
  {
    id: 'Nunito',
    label: 'Nunito',
    vibe: 'Rounded warm & approachable',
    cssVariable: '--font-brand-nunito',
    fallbackStack: 'system-ui, -apple-system, sans-serif',
  },
  {
    id: 'Montserrat',
    label: 'Montserrat',
    vibe: 'Bold editorial geometric display',
    cssVariable: '--font-brand-montserrat',
    fallbackStack: 'system-ui, -apple-system, sans-serif',
  },
  {
    id: 'Playfair Display',
    label: 'Playfair Display',
    vibe: 'Artisanal heritage serif luxury',
    cssVariable: '--font-brand-playfair',
    fallbackStack: 'Georgia, Cambria, serif',
  },
  {
    id: 'DM Sans',
    label: 'DM Sans',
    vibe: 'Minimal clean low-contrast geometric',
    cssVariable: '--font-brand-dmsans',
    fallbackStack: 'system-ui, -apple-system, sans-serif',
  },
];

export function isValidCuratedFont(value: string): value is CuratedFont {
  return CURATED_FONTS.some((f) => f.id === value);
}

export function getCuratedFontOption(fontFamily?: string | null): CuratedFontOption {
  return CURATED_FONTS.find((f) => f.id === fontFamily) || CURATED_FONTS[0];
}

export function getFontCssStack(fontFamily?: string | null): string {
  const opt = getCuratedFontOption(fontFamily);
  return `var(${opt.cssVariable}, "${opt.id}"), ${opt.fallbackStack}`;
}


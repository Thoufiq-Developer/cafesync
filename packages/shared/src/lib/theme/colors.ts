import { ColorPalette50To900 } from './types';

export function normalizeHex(input?: string | null, fallback = '#ea580c'): string {
  if (!input || typeof input !== 'string') return fallback;
  let cleaned = input.trim();
  if (!cleaned.startsWith('#')) cleaned = `#${cleaned}`;
  const match3 = /^#([0-9a-fA-F]{3})$/.exec(cleaned);
  if (match3) {
    const [r, g, b] = match3[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const match6 = /^#([0-9a-fA-F]{6})$/.exec(cleaned);
  if (match6) {
    return `#${match6[1].toLowerCase()}`;
  }
  return fallback.toLowerCase();
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const safe = normalizeHex(hex);
  const num = parseInt(safe.slice(1), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
  );
}

export function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  const l = (max + min) / 2;
  let s = 0;

  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case rn:
        h = 60 * (((gn - bn) / d) % 6);
        break;
      case gn:
        h = 60 * ((bn - rn) / d + 2);
        break;
      default:
        h = 60 * ((rn - gn) / d + 4);
        break;
    }
  }
  if (h < 0) h += 360;
  return {
    h: Math.round(h * 10) / 10,
    s: Math.round(s * 1000) / 10,
    l: Math.round(l * 1000) / 10,
  };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sn = Math.max(0, Math.min(100, s)) / 100;
  const ln = Math.max(0, Math.min(100, l)) / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = ln - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;

  const hh = ((h % 360) + 360) % 360;
  if (hh < 60) {
    r = c; g = x; b = 0;
  } else if (hh < 120) {
    r = x; g = c; b = 0;
  } else if (hh < 180) {
    r = 0; g = c; b = x;
  } else if (hh < 240) {
    r = 0; g = x; b = c;
  } else if (hh < 300) {
    r = x; g = 0; b = c;
  } else {
    r = c; g = 0; b = x;
  }

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

/**
 * Format expected by shadcn/Tailwind v4 hsl(var(--primary)) usage or fallback tokens.
 */
export function hexToHslTuple(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const { h, s, l } = rgbToHsl(r, g, b);
  return `${h} ${s}% ${l}%`;
}

/**
 * Relative luminance per WCAG 2.1 specification.
 */
export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const [rs, gs, bs] = [r / 255, g / 255, b / 255].map((c) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  );
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

export function getContrastRatio(hexA: string, hexB: string): number {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

/**
 * Automatically selects the highest-contrast text color (#ffffff or #0f172a) on any background.
 */
export function pickReadableTextColor(
  bgHex: string,
  lightOption = '#ffffff',
  darkOption = '#0f172a'
): string {
  const contrastLight = getContrastRatio(bgHex, lightOption);
  const contrastDark = getContrastRatio(bgHex, darkOption);
  return contrastLight >= contrastDark ? lightOption : darkOption;
}

/**
 * Generates a full 50-900 palette scale derived from a brand primary hex.
 */
export function generateColorPalette(primaryHex: string): ColorPalette50To900 {
  const safe = normalizeHex(primaryHex);
  const { r, g, b } = hexToRgb(safe);
  const { h, s } = rgbToHsl(r, g, b);
  const isNeutral = s < 10;

  return {
    50: hslToHex(h, isNeutral ? s : Math.min(95, Math.max(40, s * 0.92)), 97),
    100: hslToHex(h, isNeutral ? s : Math.min(92, Math.max(38, s * 0.9)), 92),
    200: hslToHex(h, isNeutral ? s : Math.min(90, s * 0.88), 84),
    300: hslToHex(h, isNeutral ? s : Math.min(88, s * 0.92), 72),
    400: hslToHex(h, isNeutral ? s : Math.min(90, s * 0.96), 58),
    500: safe,
    600: hslToHex(h, isNeutral ? s : Math.min(95, Math.max(s, s * 1.02)), 42),
    700: hslToHex(h, isNeutral ? s : Math.min(95, s * 1.04), 33),
    800: hslToHex(h, isNeutral ? s : Math.min(92, s * 1.02), 25),
    900: hslToHex(h, isNeutral ? s : Math.min(90, s * 0.98), 18),
  };
}

/**
 * Returns a shade derived from primary that guarantees at least `minRatio` contrast
 * against the target background color (e.g., readable brand link color on white or dark surfaces).
 */
export function ensureContrastColor(
  colorHex: string,
  backgroundHex: string,
  minRatio = 4.5
): string {
  const safeColor = normalizeHex(colorHex);
  if (getContrastRatio(safeColor, backgroundHex) >= minRatio) {
    return safeColor;
  }

  const bgLum = relativeLuminance(backgroundHex);
  const shouldDarken = bgLum > 0.35;
  const { r, g, b } = hexToRgb(safeColor);
  const { h, s, l } = rgbToHsl(r, g, b);

  let candidateL = l;
  for (let step = 0; step < 30; step++) {
    candidateL = shouldDarken ? Math.max(8, candidateL - 3) : Math.min(94, candidateL + 3);
    const candidate = hslToHex(h, s, candidateL);
    if (getContrastRatio(candidate, backgroundHex) >= minRatio) {
      return candidate;
    }
  }

  return shouldDarken ? '#0f172a' : '#f8fafc';
}

export interface ContrastDiagnostic {
  buttonContrast: number;
  buttonTextColor: string;
  buttonPassesAA: boolean;
  onSurfaceContrast: number;
  onSurfacePassesAA: boolean;
  suggestedAccessiblePrimary: string;
  hasWarning: boolean;
  summaryMessage: string;
}

/**
 * Runs live WCAG AA diagnostics for the Theme Studio UI.
 */
export function diagnosePrimaryContrast(
  primaryHex: string,
  surfaceMode: 'light' | 'dark' = 'light'
): ContrastDiagnostic {
  const safe = normalizeHex(primaryHex);
  const buttonTextColor = pickReadableTextColor(safe);
  const buttonContrast = getContrastRatio(safe, buttonTextColor);
  const buttonPassesAA = buttonContrast >= 4.5;

  const surfaceBg = surfaceMode === 'dark' ? '#0f172a' : '#ffffff';
  const onSurfaceContrast = getContrastRatio(safe, surfaceBg);
  const onSurfacePassesAA = onSurfaceContrast >= 4.5;

  // Suggest an accessible primary that works cleanly with both surfaces/buttons
  const suggestedAccessiblePrimary = ensureContrastColor(safe, surfaceBg, 4.55);

  const hasWarning = !onSurfacePassesAA || !buttonPassesAA;
  let summaryMessage = `WCAG AA Passed (${onSurfaceContrast.toFixed(1)}:1 on ${surfaceMode} surface, ${buttonContrast.toFixed(1)}:1 on buttons)`;

  if (!onSurfacePassesAA) {
    summaryMessage = `Low contrast on ${surfaceMode} cards/links (${onSurfaceContrast.toFixed(1)}:1 < 4.5:1 AA). Button text will adapt automatically to dark, or click Auto-Fix to adjust.`;
  } else if (!buttonPassesAA) {
    summaryMessage = `Button text contrast (${buttonContrast.toFixed(1)}:1) is below 4.5:1 AA. Click Auto-Fix for optimal readability.`;
  }

  return {
    buttonContrast,
    buttonTextColor,
    buttonPassesAA,
    onSurfaceContrast,
    onSurfacePassesAA,
    suggestedAccessiblePrimary,
    hasWarning,
    summaryMessage,
  };
}


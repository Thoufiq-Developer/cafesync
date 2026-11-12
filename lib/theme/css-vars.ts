import {
  ensureContrastColor,
  generateColorPalette,
  hexToHslTuple,
  hexToRgb,
  normalizeHex,
  pickReadableTextColor,
} from './colors';
import { getFontCssStack } from './font-options';
import type { BrandSettings, ThemeMode, ThemeRadius } from './types';

/**
 * Brand theme radius setting applies ONLY to buttons and inputs.
 * Cards, report cards, PDF previews, tables, and modals always use a small radius (<= 8px / 0.5rem).
 */
function resolveRadii(radius: ThemeRadius): {
  card: string;
  button: string;
  input: string;
} {
  switch (radius) {
    case 'sharp':
      return { card: '0.25rem', button: '0.25rem', input: '0.25rem' };
    case 'pill':
      return { card: '0.5rem', button: '9999px', input: '9999px' };
    case 'rounded':
    default:
      return { card: '0.5rem', button: '0.5rem', input: '0.5rem' };
  }
}

export function buildBrandCssVariables(
  settings: Pick<
    BrandSettings,
    | 'primary_color'
    | 'secondary_color'
    | 'accent_color'
    | 'font_family'
    | 'radius'
    | 'sidebar_style'
    | 'density'
    | 'default_mode'
  >,
  overrideMode?: ThemeMode
): Record<string, string> {
  const mode: ThemeMode = overrideMode || settings.default_mode || 'light';
  const isDark = mode === 'dark';

  const primary = normalizeHex(settings.primary_color, '#ea580c');
  const secondary = normalizeHex(settings.secondary_color, '#9a3412');
  const accent = normalizeHex(settings.accent_color, '#f59e0b');

  const palette = generateColorPalette(primary);
  const { r, g, b } = hexToRgb(primary);

  const primaryFg = pickReadableTextColor(primary, '#ffffff', '#0f172a');
  const secondaryFg = pickReadableTextColor(secondary, '#ffffff', '#0f172a');
  const accentFg = pickReadableTextColor(accent, '#ffffff', '#0f172a');

  const surfaceBg = isDark ? '#0b1120' : '#f8fafc';
  const cardBg = isDark ? '#111827' : '#ffffff';
  const surfaceText = isDark ? '#f8fafc' : '#0f172a';
  const mutedBg = isDark ? '#1e293b' : '#f1f5f9';
  const mutedText = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#1f2937' : '#e2e8f0';

  const brandInk = ensureContrastColor(primary, cardBg, 4.5);
  const bannerFg = pickReadableTextColor(primary, '#ffffff', '#0f172a');

  let sidebarBg = '#ffffff';
  let sidebarText = '#334155';
  let sidebarMutedText = '#64748b';
  let sidebarBorder = '#e2e8f0';
  let sidebarActiveBg = palette[50];
  let sidebarActiveText = brandInk;
  let sidebarHoverBg = '#f1f5f9';

  if (settings.sidebar_style === 'dark') {
    sidebarBg = '#0f172a';
    sidebarText = '#e2e8f0';
    sidebarMutedText = '#94a3b8';
    sidebarBorder = '#1e293b';
    sidebarActiveBg = palette[500];
    sidebarActiveText = primaryFg;
    sidebarHoverBg = 'rgba(255, 255, 255, 0.08)';
  } else if (settings.sidebar_style === 'brand') {
    sidebarBg = primary;
    sidebarText = primaryFg;
    sidebarMutedText = primaryFg === '#ffffff' ? 'rgba(255,255,255,0.78)' : 'rgba(15,23,42,0.72)';
    sidebarBorder = primaryFg === '#ffffff' ? 'rgba(255,255,255,0.16)' : 'rgba(15,23,42,0.14)';
    sidebarActiveBg = primaryFg === '#ffffff' ? 'rgba(255,255,255,0.2)' : 'rgba(15,23,42,0.14)';
    sidebarActiveText = primaryFg;
    sidebarHoverBg = primaryFg === '#ffffff' ? 'rgba(255,255,255,0.12)' : 'rgba(15,23,42,0.08)';
  } else if (isDark) {
    sidebarBg = '#111827';
    sidebarText = '#e2e8f0';
    sidebarMutedText = '#94a3b8';
    sidebarBorder = '#1f2937';
    sidebarActiveBg = 'rgba(255,255,255,0.08)';
    sidebarActiveText = palette[300];
    sidebarHoverBg = 'rgba(255,255,255,0.05)';
  }

  const radii = resolveRadii(settings.radius || 'rounded');
  const fontStack = getFontCssStack(settings.font_family);
  const densityPad = settings.density === 'compact' ? '0.75rem' : '1.25rem';

  return {
    '--background': isDark ? '222.2 84% 4.9%' : '210 40% 98%',
    '--foreground': isDark ? '210 40% 98%' : '222.2 84% 4.9%',
    '--card': isDark ? '222 47% 11%' : '0 0% 100%',
    '--card-foreground': isDark ? '210 40% 98%' : '222.2 84% 4.9%',
    '--popover': isDark ? '222 47% 11%' : '0 0% 100%',
    '--popover-foreground': isDark ? '210 40% 98%' : '222.2 84% 4.9%',
    '--primary': hexToHslTuple(primary),
    '--primary-foreground': hexToHslTuple(primaryFg),
    '--secondary': hexToHslTuple(secondary),
    '--secondary-foreground': hexToHslTuple(secondaryFg),
    '--accent': hexToHslTuple(accent),
    '--accent-foreground': hexToHslTuple(accentFg),
    '--muted': isDark ? '217.2 32.6% 17.5%' : '210 40% 96.1%',
    '--muted-foreground': isDark ? '215 20.2% 65.1%' : '215.4 16.3% 46.9%',
    '--border': isDark ? '217.2 32.6% 17.5%' : '214.3 31.8% 91.4%',
    '--input': isDark ? '217.2 32.6% 17.5%' : '214.3 31.8% 91.4%',
    '--ring': hexToHslTuple(primary),
    '--radius': radii.card,

    '--brand-primary': primary,
    '--brand-primary-rgb': `${r}, ${g}, ${b}`,
    '--brand-primary-foreground': primaryFg,
    '--brand-secondary': secondary,
    '--brand-secondary-foreground': secondaryFg,
    '--brand-accent': accent,
    '--brand-accent-foreground': accentFg,
    '--brand-ink': brandInk,
    '--brand-banner-foreground': bannerFg,

    '--brand-50': palette[50],
    '--brand-100': palette[100],
    '--brand-200': palette[200],
    '--brand-300': palette[300],
    '--brand-400': palette[400],
    '--brand-500': palette[500],
    '--brand-600': palette[600],
    '--brand-700': palette[700],
    '--brand-800': palette[800],
    '--brand-900': palette[900],

    '--radius-card': radii.card,
    '--radius-btn': radii.button,
    '--radius-input': radii.input,
    '--font-brand': fontStack,
    '--density-pad': densityPad,

    '--surface-bg': surfaceBg,
    '--surface-card': cardBg,
    '--surface-text': surfaceText,
    '--surface-muted': mutedBg,
    '--surface-muted-text': mutedText,
    '--surface-border': borderColor,

    '--sidebar-bg': sidebarBg,
    '--sidebar-text': sidebarText,
    '--sidebar-muted-text': sidebarMutedText,
    '--sidebar-border': sidebarBorder,
    '--sidebar-active-bg': sidebarActiveBg,
    '--sidebar-active-text': sidebarActiveText,
    '--sidebar-hover-bg': sidebarHoverBg,

    '--table-header-bg': isDark ? '#1e293b' : palette[50],
    '--table-header-text': isDark ? '#e2e8f0' : brandInk,
    '--chart-1': primary,
    '--chart-2': secondary,
    '--chart-3': accent,
    '--chart-4': palette[300],
  };
}

export function cssVarsToStyleText(
  vars: Record<string, string>,
  selectors: string[] = [':root', '.brand-portal-root']
): string {
  const declarations = Object.entries(vars)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');
  return `${selectors.join(', ')} {\n${declarations}\n}`;
}

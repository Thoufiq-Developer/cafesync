import 'server-only';
import { readLocalBrandAsset } from '@/lib/theme/store';

/**
 * Resolves a brand logo URL into a PNG/JPEG base64 data URI safe for @react-pdf/renderer's <Image>.
 * Returns null if the logo is SVG, missing, or unreachable so the PDF renders a clean monogram badge instead.
 */
export async function resolvePdfSafeLogoDataUri(
  logoUrl: string | null | undefined,
  brandId: string
): Promise<string | null> {
  if (!logoUrl) return null;

  if (
    logoUrl.startsWith('data:image/png;base64,') ||
    logoUrl.startsWith('data:image/jpeg;base64,') ||
    logoUrl.startsWith('data:image/jpg;base64,')
  ) {
    return logoUrl;
  }

  // Handle local demo asset path: /api/brand-assets/{brandId}/{filename}
  const localMatch = /^\/api\/brand-assets\/([^/]+)\/([^?]+)/.exec(logoUrl);
  if (localMatch) {
    const assetBrandId = localMatch[1];
    const filename = localMatch[2];
    const lower = filename.toLowerCase();
    if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
      const buf = readLocalBrandAsset(assetBrandId || brandId, filename);
      if (buf && buf.length > 0) {
        const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
        return `data:${mime};base64,${buf.toString('base64')}`;
      }
    }
    return null;
  }

  // Dynamic monogram SVG endpoint or inline SVG: render clean native monogram View in PDF
  if (logoUrl.startsWith('/api/brand-icon') || logoUrl.startsWith('data:image/svg+xml')) {
    return null;
  }

  // Remote HTTPS asset (e.g. Supabase Storage public URL)
  if (/^https?:\/\//i.test(logoUrl)) {
    try {
      const resp = await fetch(logoUrl, {
        signal: AbortSignal.timeout(2500),
      });
      if (!resp.ok) return null;
      const ctype = (resp.headers.get('content-type') || '').toLowerCase();
      if (!ctype.includes('image/png') && !ctype.includes('image/jpeg')) {
        return null;
      }
      const arr = await resp.arrayBuffer();
      return `data:${ctype.split(';')[0]};base64,${Buffer.from(arr).toString('base64')}`;
    } catch {
      return null;
    }
  }

  return null;
}


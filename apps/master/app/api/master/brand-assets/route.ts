import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserContext } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@cafesync/shared/server-admin';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { saveLocalBrandAsset } from '@/lib/theme/store';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

const ALLOWED_KINDS = new Set(['logo', 'logo-dark', 'icon', 'login-bg']);

export async function POST(request: NextRequest) {
  const user = await getCurrentUserContext();
  if (!user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  if (user.role !== 'master') {
    return NextResponse.json(
      { error: 'Forbidden: Only platform master can upload brand assets.' },
      { status: 403 }
    );
  }

  try {
    const formData = await request.formData();
    const brandId = String(formData.get('brandId') || '').trim();
    const rawKind = String(formData.get('kind') || formData.get('assetType') || 'logo')
      .trim()
      .toLowerCase()
      .replace(/_/g, '-');
    const kind = rawKind;
    const file = formData.get('file') as File | null;

    if (!brandId || !/^[a-zA-Z0-9-]+$/.test(brandId)) {
      return NextResponse.json({ error: 'Valid brandId is required.' }, { status: 400 });
    }
    if (!ALLOWED_KINDS.has(kind)) {
      return NextResponse.json({ error: 'Invalid asset kind.' }, { status: 400 });
    }
    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'Asset file is required.' }, { status: 400 });
    }

    const ext = ALLOWED_MIME_TYPES[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: 'Unsupported format. Allowed: PNG, JPG, WEBP, SVG.' },
        { status: 400 }
      );
    }

    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: 'File exceeds the 2MB maximum size limit.' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = `${kind}.${ext}`;
    const objectPath = `${brandId}/${filename}`;

    if (isSupabaseConfigured()) {
      const storageClient = (
        process.env.SUPABASE_SERVICE_ROLE_KEY
          ? createAdminClient()
          : await createClient()
      ) as any;

      const { error: uploadErr } = await storageClient.storage
        .from('brand-assets')
        .upload(objectPath, buffer, {
          contentType: file.type,
          upsert: true,
          cacheControl: '3600',
        });

      if (uploadErr) {
        return NextResponse.json(
          { error: `Supabase Storage upload failed: ${uploadErr.message}` },
          { status: 500 }
        );
      }

      const { data: pub } = storageClient.storage
        .from('brand-assets')
        .getPublicUrl(objectPath);
      return NextResponse.json({
        success: true,
        url: `${pub.publicUrl}?v=${Date.now()}`,
        path: objectPath,
        storage: 'supabase',
      });
    }

    const localUrl = saveLocalBrandAsset(brandId, filename, buffer);
    return NextResponse.json({
      success: true,
      url: localUrl,
      path: objectPath,
      storage: 'local-demo',
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to upload asset' },
      { status: 500 }
    );
  }
}

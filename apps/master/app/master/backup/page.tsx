import React from 'react';
import { redirect } from 'next/navigation';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { BackupView } from '@/components/master/backup-view';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_MASTER_BRANDS } from '@/lib/demo-master-data';
import { listAllBrandThemes } from '@/lib/theme/server';

export const dynamic = 'force-dynamic';

export default async function MasterBackupPage() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    redirect('/login');
  }

  let brands: any[] = [];
  let history: any[] = [];
  let removals: any[] = [];
  let batches: any[] = [];

  if (!isSupabaseConfigured()) {
    const demoById = new Map(DEMO_MASTER_BRANDS.map((b) => [b.id, b]));
    const bundles = await listAllBrandThemes();
    brands = bundles.map((bundle) => {
      const base = demoById.get(bundle.brand.id);
      return {
        id: bundle.brand.id,
        name: bundle.brand.name,
        slug: bundle.brand.slug,
        shops_count: base?.shops_count || 1,
        status: bundle.brand.status || 'active',
      };
    });
  } else {
    try {
      const supabase = (await createClient()) as any;
      const [
        { data: dbBrands, error: brandsErr },
        { data: dbHistory, error: historyErr },
        { data: dbRemovals },
        { data: dbBatches },
      ] = await Promise.all([
        supabase
          .from('brands')
          .select('id, name, slug, status, shops(id, name, code)')
          .order('name', { ascending: true }),
        supabase
          .from('backup_log')
          .select('*, brands(name)')
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('removal_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('import_batches')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      if (brandsErr) console.error('Error fetching brands for backup:', brandsErr);
      if (historyErr) console.error('Error fetching backup log history:', historyErr);

      brands = (dbBrands || []).map((b: any) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        status: b.status,
        shops_count: Array.isArray(b.shops) ? b.shops.length : 0,
        shops: Array.isArray(b.shops) ? b.shops : [],
      }));

      history = (dbHistory || []).map((h: any) => ({
        id: h.id,
        scope: h.scope,
        brand_id: h.brand_id,
        date_range: h.date_range,
        file_size: h.file_size,
        row_counts: h.row_counts,
        created_at: h.created_at,
        brand_name: h.brands?.name || (h.scope === 'all' ? 'All Brands' : null),
      }));

      removals = dbRemovals || [];
      batches = dbBatches || [];
    } catch (e) {
      console.error('Master backup page server load error:', e);
    }
  }

  const masterUser = {
    fullName: user.fullName || 'Platform Master',
    email: user.email || '',
    phone: user.phone,
    role: 'master' as const,
  };

  return (
    <SharedAppLayout user={masterUser}>
      <BackupView
        brands={brands}
        initialHistory={history}
        initialRemovals={removals}
        initialBatches={batches}
      />
    </SharedAppLayout>
  );
}

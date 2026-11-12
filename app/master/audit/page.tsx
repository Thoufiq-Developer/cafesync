import React from 'react';
import { getCurrentUserContext } from '@/lib/auth';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { PlatformAuditView, AuditRecord } from '@/components/master/platform-audit-view';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { DEMO_GLOBAL_AUDIT_LOGS, DemoMasterBrand } from '@/lib/demo-master-data';
import { listDemoThemeBundles, readDemoThemeAudits } from '@/lib/theme/store';
import { formatActivityEntry, normalizeJsonPayload } from '@/lib/audit/format-activity';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function MasterAuditPage() {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'master') {
    redirect('/login');
  }

  let brands: DemoMasterBrand[] = [];
  let logs: AuditRecord[] = [];

  if (!isSupabaseConfigured()) {
    brands = listDemoThemeBundles().map((b) => ({
      id: b.brand.id,
      name: b.brand.name,
      slug: b.brand.slug,
      registration_no: b.brand.registration_no,
      logo_url: b.settings.logo_url,
      primary_color: b.settings.primary_color,
      secondary_color: b.settings.secondary_color,
      address: b.brand.address || '',
      phone: b.brand.phone || '',
      email: b.brand.email || '',
      gstin: b.brand.gstin,
      status: b.brand.status,
      created_at: '',
      shops_count: 0,
      admins_count: 0,
      monthly_volume: 0,
      admins: [],
    }));

    const demoThemeLogs: AuditRecord[] = readDemoThemeAudits().map((a) => {
      const formatted = formatActivityEntry(
        {
          id: a.id,
          action: a.action,
          table_name: a.table_name,
          record_id: a.brand_id,
          new_data: { details: a.details, brand_name: a.brand_name },
          at: a.at,
          user_name: a.user_name,
          user_role: 'master',
          brand_id: a.brand_id,
          brand_name: a.brand_name,
        },
        'master'
      );
      return {
        id: a.id,
        brand_id: a.brand_id,
        brand_name: a.brand_name,
        user_name: formatted.actorName,
        user_role: 'master',
        action: a.action,
        table_name: a.table_name,
        record_id: a.brand_id,
        new_data: { details: a.details },
        summary: formatted.summary,
        timestamp: new Date(a.at).toLocaleString('en-IN', {
          dateStyle: 'short',
          timeStyle: 'medium',
        }),
      };
    });

    logs = [
      ...demoThemeLogs,
      ...DEMO_GLOBAL_AUDIT_LOGS.map((g) => {
        const formatted = formatActivityEntry(
          {
            id: g.id,
            action: g.action,
            table_name: g.table_name,
            record_id: g.record_id,
            new_data: { details: g.details },
            at: new Date().toISOString(),
            user_name: g.user_name,
            user_role: g.user_role,
            brand_name: g.brand_name,
          },
          'master'
        );
        return {
          id: g.id,
          brand_name: g.brand_name,
          user_name: formatted.actorName,
          user_role: g.user_role,
          action: g.action,
          table_name: g.table_name,
          record_id: g.record_id,
          new_data: { details: g.details },
          summary: formatted.summary,
          timestamp: g.timestamp,
        };
      }),
    ];
  } else {
    try {
      const supabase = (await createClient()) as any;
      const [{ data: dbBrands }, { data: dbLogs, error: logsErr }] = await Promise.all([
        supabase
          .from('brands')
          .select('id, name, slug')
          .order('name', { ascending: true }),
        supabase
          .from('audit_log')
          .select('*')
          .order('at', { ascending: false })
          .limit(100),
      ]);

      const brandMap = new Map<string, string>();
      brands = (dbBrands || []).map((b: any) => {
        brandMap.set(b.id, b.name);
        return {
          id: b.id,
          name: b.name,
          slug: b.slug,
          registration_no: '',
          logo_url: null,
          primary_color: '#ea580c',
          secondary_color: '#9a3412',
          address: '',
          phone: '',
          email: '',
          gstin: null,
          status: 'active',
          created_at: '',
          shops_count: 0,
          admins_count: 0,
          monthly_volume: 0,
          admins: [],
        };
      });

      if (logsErr) {
        console.error('Master audit_log query failed:', logsErr);
      }

      if (dbLogs && dbLogs.length > 0) {
        const userIds = Array.from(new Set(dbLogs.map((l: any) => l.user_id).filter(Boolean)));
        const profileMap = new Map<string, any>();

        if (userIds.length > 0) {
          const { data: logProfiles } = await supabase
            .from('profiles')
            .select('id, full_name, role, brand_id')
            .in('id', userIds);

          (logProfiles || []).forEach((p: any) => profileMap.set(p.id, p));
        }

        logs = dbLogs.map((l: any) => {
          const prof = l.user_id ? profileMap.get(l.user_id) : null;
          const oldObj = normalizeJsonPayload(l.old_data);
          const newObj = normalizeJsonPayload(l.new_data);
          const inferredBrandId =
            prof?.brand_id ||
            newObj?.brand_id ||
            (l.table_name === 'brands' || l.table_name === 'brand_settings' ? l.record_id : null);
          const inferredBrandName =
            (inferredBrandId ? brandMap.get(inferredBrandId) : null) || 'Platform Master';

          const formatted = formatActivityEntry(
            {
              id: l.id,
              user_id: l.user_id,
              action: l.action,
              table_name: l.table_name,
              record_id: l.record_id,
              old_data: oldObj,
              new_data: newObj,
              at: l.at,
              user_name: prof?.full_name || null,
              user_role: prof?.role || null,
              brand_id: inferredBrandId,
              brand_name: inferredBrandName,
            },
            'master'
          );

          return {
            id: l.id,
            brand_id: inferredBrandId,
            brand_name: inferredBrandName,
            user_name: formatted.actorName,
            user_role: formatted.actorRole,
            action: l.action,
            table_name: l.table_name,
            record_id: l.record_id,
            old_data: oldObj,
            new_data: newObj,
            summary: formatted.summary,
            timestamp: new Date(l.at).toLocaleString('en-IN', {
              dateStyle: 'short',
              timeStyle: 'medium',
            }),
          };
        });
      }
    } catch (err) {
      console.error('Master audit page error:', err);
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
      <PlatformAuditView initialLogs={logs} brands={brands} />
    </SharedAppLayout>
  );
}

'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase/client';
import { SharedAppLayout } from '@/components/shared/layout-wrapper';
import { PlatformAuditView, AuditRecord } from '@/components/master/platform-audit-view';
import { DEMO_GLOBAL_AUDIT_LOGS, DEMO_MASTER_BRANDS, DemoMasterBrand } from '@/lib/demo-master-data';
import { formatActivityEntry, normalizeJsonPayload } from '@/lib/audit/format-activity';
import { Loader2 } from 'lucide-react';

export default function MasterAuditPage() {
  const { profile, isLive } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['master-audit-logs', isLive],
    queryFn: async () => {
      if (!isLive) {
        const logs: AuditRecord[] = DEMO_GLOBAL_AUDIT_LOGS.map((g) => {
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
            timestamp: new Date().toLocaleString('en-IN', {
              dateStyle: 'short',
              timeStyle: 'medium',
            }),
          };
        });

        return {
          brands: DEMO_MASTER_BRANDS,
          logs,
        };
      }

      const [{ data: dbBrands }, { data: dbLogs, error: logsErr }] = await Promise.all([
        (supabase as any)
          .from('brands')
          .select('id, name, slug')
          .order('name', { ascending: true }),
        (supabase as any)
          .from('audit_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (logsErr) {
        console.error('Master audit_log query failed:', logsErr);
      }

      const brandMap = new Map<string, string>();
      const brands: DemoMasterBrand[] = (dbBrands || []).map((b: any) => {
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

      let logs: AuditRecord[] = [];

      if (dbLogs && dbLogs.length > 0) {
        const userIds = Array.from(new Set(dbLogs.map((l: any) => l.user_id).filter(Boolean)));
        const profileMap = new Map<string, any>();

        if (userIds.length > 0) {
          const { data: logProfiles } = await (supabase as any)
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
            l.brand_id ||
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
              old_data: l.old_data,
              new_data: l.new_data,
              at: l.created_at || l.at || new Date().toISOString(),
              user_name: prof?.full_name || l.user_name || undefined,
              user_role: prof?.role || l.user_role || undefined,
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
            old_data: l.old_data,
            new_data: l.new_data,
            summary: formatted.summary,
            timestamp: new Date(l.created_at || l.at || Date.now()).toLocaleString('en-IN', {
              dateStyle: 'short',
              timeStyle: 'medium',
            }),
          };
        });
      }

      return {
        brands,
        logs,
      };
    },
  });

  const masterUser = {
    id: profile?.id,
    fullName: profile?.full_name || 'Platform Master',
    email: profile?.email || '',
    phone: profile?.phone || '',
    role: 'master' as const,
  };

  return (
    <SharedAppLayout user={masterUser}>
      {isLoading || !data ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-[#B9A58A] text-xs">
          <Loader2 className="h-8 w-8 animate-spin text-[#C68846]" />
          <span>Loading cross-tenant immutable audit log...</span>
        </div>
      ) : (
        <PlatformAuditView
          brands={data.brands}
          initialLogs={data.logs}
        />
      )}
    </SharedAppLayout>
  );
}

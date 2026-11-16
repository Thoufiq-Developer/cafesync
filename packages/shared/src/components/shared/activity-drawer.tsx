'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bell,
  X,
  CheckCheck,
  Store,
  User as UserIcon,
  Layers,
  Tag,
  Wrench,
  Users,
  Building2,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Count } from '@/components/shared/format-values';
import type { FormattedActivityItem, ActivityTypeFilter } from '@/lib/audit/format-activity';
import { cn } from '@/lib/utils';

interface ActivityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: 'master' | 'admin';
  onUnreadCountChange?: (count: number) => void;
}

const TYPE_OPTIONS: Array<{ value: ActivityTypeFilter; label: string }> = [
  { value: 'all', label: 'All Types' },
  { value: 'entry', label: 'Entries & Closings' },
  { value: 'shop', label: 'Outlets' },
  { value: 'user', label: 'Users & Logins' },
  { value: 'item', label: 'Items & Modes' },
  { value: 'staff', label: 'Staff & Payroll' },
  { value: 'asset', label: 'Equipment' },
  { value: 'brand', label: 'Branding & System' },
];

function TypeIcon({ type }: { type: FormattedActivityItem['type'] }) {
  switch (type) {
    case 'entry':
      return <Layers className="h-3.5 w-3.5 text-emerald-600" />;
    case 'shop':
      return <Store className="h-3.5 w-3.5 text-blue-600" />;
    case 'user':
      return <UserIcon className="h-3.5 w-3.5 text-indigo-600" />;
    case 'item':
      return <Tag className="h-3.5 w-3.5 text-amber-600" />;
    case 'staff':
      return <Users className="h-3.5 w-3.5 text-purple-600" />;
    case 'asset':
      return <Wrench className="h-3.5 w-3.5 text-slate-600" />;
    default:
      return <Building2 className="h-3.5 w-3.5 text-slate-700" />;
  }
}

export function ActivityDrawer({
  open,
  onOpenChange,
  role,
  onUnreadCountChange,
}: ActivityDrawerProps) {
  const router = useRouter();
  const [items, setItems] = useState<FormattedActivityItem[]>([]);
  const [shops, setShops] = useState<Array<{ id: string; name: string }>>([]);
  const [users, setUsers] = useState<Array<{ id: string; name: string }>>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  // Filters
  const [shopId, setShopId] = useState('all');
  const [userId, setUserId] = useState('all');
  const [typeFilter, setTypeFilter] = useState<ActivityTypeFilter>('all');

  const cacheKey = `cafeledger_activity_unread_${role}`;

  const writeUnreadCache = useCallback(
    (count: number) => {
      try {
        sessionStorage.setItem(
          cacheKey,
          JSON.stringify({ count, ts: Date.now() })
        );
      } catch {
        // ignore storage restrictions
      }
    },
    [cacheKey]
  );

  const fetchActivity = useCallback(async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (shopId !== 'all') qs.set('shopId', shopId);
      if (userId !== 'all') qs.set('userId', userId);
      if (typeFilter !== 'all') qs.set('type', typeFilter);

      let data: any = null;
      try {
        const res = await fetch(`/api/activity?${qs.toString()}`, { cache: 'no-store' });
        if (res.ok) {
          data = await res.json();
        }
      } catch {
        // network or 404 in static export
      }

      if (!data) {
        // Fallback: direct browser Supabase client query
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient() as any;
        const { formatAuditRow } = await import('@/lib/audit/format-activity');

        const { data: authData } = await supabase.auth.getUser();
        const userIdVal = authData?.user?.id;

        let profile: any = null;
        if (userIdVal) {
          const { data: p } = await supabase.from('profiles').select('*').eq('id', userIdVal).maybeSingle();
          profile = p;
        }

        let query = supabase.from('audit_log').select('*');
        if (role === 'admin' && profile?.brand_id) {
          query = query.or(`brand_id.eq.${profile.brand_id},brand_id.is.null`);
        }
        if (shopId !== 'all') {
          query = query.eq('shop_id', shopId);
        }
        if (userId !== 'all') {
          query = query.eq('user_id', userId);
        }
        const { data: rawLogs } = await query.order('created_at', { ascending: false }).limit(60);

        const readAt = profile?.activity_read_at ? new Date(profile.activity_read_at).getTime() : 0;
        let unread = 0;
        const formatted = (rawLogs || []).map((row: any) => {
          const itemAt = new Date(row.created_at).getTime();
          const isUnread = itemAt > readAt;
          if (isUnread) unread++;
          return {
            ...formatAuditRow({
              id: row.id,
              user_id: row.user_id,
              action: row.action,
              table_name: row.table_name,
              record_id: row.record_id,
              old_data: row.old_data,
              new_data: row.new_data,
              at: row.created_at,
            }),
            isUnread,
          };
        });

        const [{ data: dbShops }, { data: dbProfiles }] = await Promise.all([
          role === 'admin' && profile?.brand_id
            ? supabase.from('shops').select('id, name').eq('brand_id', profile.brand_id)
            : supabase.from('shops').select('id, name'),
          role === 'admin' && profile?.brand_id
            ? supabase.from('profiles').select('id, full_name').eq('brand_id', profile.brand_id)
            : supabase.from('profiles').select('id, full_name'),
        ]);

        data = {
          items: formatted,
          shops: dbShops || [],
          users: (dbProfiles || []).map((p: any) => ({ id: p.id, name: p.full_name })),
          unreadCount: unread,
        };
      }

      setItems(data.items || []);
      setShops(data.shops || []);
      setUsers(data.users || []);
      const count = Number(data.unreadCount || 0);
      setUnreadCount(count);
      writeUnreadCache(count);
      onUnreadCountChange?.(count);
    } catch (err) {
      console.error('Failed to fetch activity:', err);
    } finally {
      setIsLoading(false);
    }
  }, [shopId, userId, typeFilter, role, onUnreadCountChange, writeUnreadCache]);

  useEffect(() => {
    if (open) {
      fetchActivity();
    }
  }, [open, fetchActivity]);

  // Initial silent poll on mount with 20s sessionStorage cache so sidebar route navigation
  // doesn't re-fire multi-query /api/activity calls on every single page click.
  useEffect(() => {
    let active = true;
    try {
      const cachedRaw = sessionStorage.getItem(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw);
        if (
          cached &&
          typeof cached.count === 'number' &&
          typeof cached.ts === 'number' &&
          Date.now() - cached.ts < 20000
        ) {
          onUnreadCountChange?.(cached.count);
          return () => {
            active = false;
          };
        }
      }
    } catch {
      // ignore storage errors
    }

    fetch('/api/activity', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data) {
          const count = Number(data.unreadCount || 0);
          writeUnreadCache(count);
          onUnreadCountChange?.(count);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [cacheKey, onUnreadCountChange, writeUnreadCache]);

  const handleMarkAllRead = async () => {
    setIsMarkingRead(true);
    try {
      let marked = false;
      try {
        const res = await fetch('/api/activity', { method: 'POST' });
        if (res.ok) marked = true;
      } catch {
        // static export or 404
      }

      if (!marked) {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient() as any;
        const { data: authData } = await supabase.auth.getUser();
        if (authData?.user?.id) {
          await supabase
            .from('profiles')
            .update({ activity_read_at: new Date().toISOString() })
            .eq('id', authData.user.id);
          marked = true;
        }
      }

      if (marked) {
        setItems((prev) => prev.map((it) => ({ ...it, isUnread: false })));
        setUnreadCount(0);
        writeUnreadCache(0);
        onUnreadCountChange?.(0);
      }
    } catch (err) {
      console.error('Mark all read failed:', err);
    } finally {
      setIsMarkingRead(false);
    }
  };

  if (!open) return null;

  const grouped = {
    today: items.filter((i) => i.bucket === 'today'),
    yesterday: items.filter((i) => i.bucket === 'yesterday'),
    earlier: items.filter((i) => i.bucket === 'earlier'),
  };

  const renderGroup = (title: string, list: FormattedActivityItem[]) => {
    if (list.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <div className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs px-4 py-1.5 border-y border-slate-100 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {title}
          </span>
          <span className="text-[10px] font-mono text-slate-400">
            <Count value={list.length} />
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {list.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onOpenChange(false);
                router.push(item.href);
              }}
              className="no-brand-radius w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-start gap-3 group cursor-pointer"
            >
              <div className="mt-0.5 h-7 w-7 rounded-md bg-slate-100 flex items-center justify-center shrink-0">
                <TypeIcon type={item.type} />
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-medium text-slate-800 leading-snug">
                    {item.summary}
                  </p>
                  {item.isUnread && (
                    <span
                      className="mt-1.5 h-2 w-2 rounded-full bg-[var(--brand-primary,#ea580c)] shrink-0"
                      title="Unread"
                    />
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                  <span>{item.timeLabel}</span>
                  {item.shopName && (
                    <>
                      <span>&bull;</span>
                      <span className="font-medium text-slate-500">{item.shopName}</span>
                    </>
                  )}
                  {!item.shopName && item.brandName && role === 'master' && (
                    <>
                      <span>&bull;</span>
                      <span className="font-medium text-slate-500">{item.brandName}</span>
                    </>
                  )}
                  <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity ml-auto text-slate-500" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[1px] transition-opacity"
        onClick={() => onOpenChange(false)}
      />

      {/* Right-Side Sliding Panel (~420px wide, full-screen on mobile, small radius <=8px) */}
      <aside
        role="dialog"
        aria-label="Recent Activity"
        className={cn(
          'relative z-10 flex h-full w-full sm:w-[420px] flex-col bg-white shadow-2xl border-l border-slate-200 sm:rounded-l-lg overflow-hidden animate-in slide-in-from-right duration-200'
        )}
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-white">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-8 w-8 rounded-md bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <Bell className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-slate-900">Activity Feed</h2>
                {unreadCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-[var(--brand-primary,#ea580c)] text-white">
                    <Count value={unreadCount} suffix="new" />
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                {role === 'master' ? 'Updates across all brands' : 'Updates across your outlets'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleMarkAllRead}
              disabled={isMarkingRead || unreadCount === 0}
              className="h-8 px-2.5 text-xs text-slate-700"
              title="Mark all notifications as read"
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1" />
              <span>Mark read</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="no-brand-radius h-8 w-8 text-slate-500 hover:text-slate-900"
              aria-label="Close activity panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-3 gap-2">
          <select
            value={shopId}
            onChange={(e) => setShopId(e.target.value)}
            aria-label="Filter activity by shop"
            className="text-xs px-2 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#ea580c)]"
          >
            <option value="all">All shops</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            aria-label="Filter activity by user"
            className="text-xs px-2 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#ea580c)]"
          >
            <option value="all">All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ActivityTypeFilter)}
            aria-label="Filter activity by type"
            className="text-xs px-2 py-1.5 rounded-md border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#ea580c)]"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4].map((k) => (
                <div key={k} className="h-14 rounded-md bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-slate-500 space-y-2">
              <Bell className="h-8 w-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No recent activity</p>
              <p className="text-xs text-slate-400">
                Try clearing filters or come back after new transactions are recorded.
              </p>
            </div>
          ) : (
            <div>
              {renderGroup('Today', grouped.today)}
              {renderGroup('Yesterday', grouped.yesterday)}
              {renderGroup('Earlier', grouped.earlier)}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={fetchActivity}
            className="no-brand-radius inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Refresh</span>
          </button>

          {role === 'master' && (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                router.push('/master/audit');
              }}
              className="no-brand-radius font-semibold text-slate-800 hover:underline cursor-pointer"
            >
              Open Full Audit Log &rarr;
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}

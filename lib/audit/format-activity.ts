import { formatMoney } from '@/lib/calculations/format';
import { getTodayKolkata } from '@/lib/calculations/dates';
import { subDays, format as formatDateFns } from 'date-fns';

export type ActivityBucket = 'today' | 'yesterday' | 'earlier';
export type ActivityTypeFilter =
  | 'all'
  | 'entry'
  | 'shop'
  | 'user'
  | 'item'
  | 'staff'
  | 'asset'
  | 'brand';

export interface RawAuditRow {
  id: string;
  user_id?: string | null;
  action: string;
  table_name: string;
  record_id: string;
  old_data?: any;
  new_data?: any;
  at: string;
  // Optional pre-resolved context
  user_name?: string | null;
  user_role?: string | null;
  brand_id?: string | null;
  brand_name?: string | null;
  shop_id?: string | null;
  shop_name?: string | null;
}

export interface FormattedActivityItem {
  id: string;
  actorId: string | null;
  actorName: string;
  actorRole: string;
  action: string;
  tableName: string;
  type: Exclude<ActivityTypeFilter, 'all'>;
  brandId: string | null;
  brandName: string | null;
  shopId: string | null;
  shopName: string | null;
  summary: string;
  href: string;
  at: string;
  timeLabel: string;
  bucket: ActivityBucket;
  isUnread?: boolean;
}

export function normalizeJsonPayload(raw: any): Record<string, any> | null {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, any>;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {
        return { details: trimmed };
      }
    }
    return { details: trimmed };
  }
  return null;
}

function getDateKolkata(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return getTodayKolkata();
  }
}

export function getActivityBucket(iso: string): ActivityBucket {
  const today = getTodayKolkata();
  const yesterday = formatDateFns(subDays(new Date(`${today}T00:00:00Z`), 1), 'yyyy-MM-dd');
  const itemDate = getDateKolkata(iso);
  if (itemDate === today) return 'today';
  if (itemDate === yesterday) return 'yesterday';
  return 'earlier';
}

export function formatActivityTime(iso: string): string {
  try {
    const dt = new Date(iso);
    const bucket = getActivityBucket(iso);
    const time = dt.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    if (bucket === 'today' || bucket === 'yesterday') {
      return time;
    }
    const datePart = dt.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
    });
    return `${datePart}, ${time}`;
  } catch {
    return iso;
  }
}

function inferActivityType(tableName: string): Exclude<ActivityTypeFilter, 'all'> {
  switch (tableName) {
    case 'transactions':
    case 'month_openings':
      return 'entry';
    case 'shops':
      return 'shop';
    case 'profiles':
      return 'user';
    case 'items':
    case 'payment_modes':
    case 'item_requests':
      return 'item';
    case 'employees':
    case 'salary_records':
      return 'staff';
    case 'assets':
    case 'asset_service_logs':
      return 'asset';
    case 'brands':
    case 'brand_settings':
      return 'brand';
    default:
      return 'brand';
  }
}

function resolveActorName(
  raw: RawAuditRow,
  newObj: Record<string, any> | null,
  oldObj: Record<string, any> | null
): string {
  const explicit = (raw.user_name || '').trim();
  if (explicit && explicit.toLowerCase() !== 'system user') {
    return explicit;
  }

  const fromPayload =
    newObj?.actor_name ||
    newObj?.user_name ||
    newObj?.initiated_by_name ||
    newObj?.manager_name ||
    newObj?.full_name ||
    oldObj?.full_name;
  if (typeof fromPayload === 'string' && fromPayload.trim() && fromPayload.toLowerCase() !== 'system user') {
    return fromPayload.trim();
  }

  if (raw.user_role === 'master' || raw.table_name === 'brands' || raw.table_name === 'brand_settings') {
    return 'Platform Master';
  }
  if (raw.user_role === 'manager' || raw.table_name === 'transactions') {
    return 'Shop Manager';
  }
  return 'Brand Admin';
}

export function formatActivityEntry(
  raw: RawAuditRow,
  viewerRole: 'master' | 'admin' | 'manager' = 'admin'
): FormattedActivityItem {
  const newObj = normalizeJsonPayload(raw.new_data);
  const oldObj = normalizeJsonPayload(raw.old_data);
  const payload = newObj || oldObj || {};

  const action = (raw.action || 'UPDATE').toUpperCase();
  const table = raw.table_name || 'records';
  const actorName = resolveActorName(raw, newObj, oldObj);
  const actorRole = raw.user_role || (table === 'brands' || table === 'brand_settings' ? 'master' : 'admin');
  const brandId = raw.brand_id || payload.brand_id || null;
  const brandName = raw.brand_name || payload.brand_name || null;
  const shopId = raw.shop_id || payload.shop_id || (table === 'shops' ? raw.record_id : null) || null;
  const shopName = raw.shop_name || payload.shop_name || (table === 'shops' ? payload.name : null) || null;
  const shopSuffix = shopName ? ` - ${shopName}` : brandName && viewerRole === 'master' ? ` - ${brandName}` : '';

  let summary = '';
  let href = viewerRole === 'master' ? '/master/audit' : '/admin';

  if (table === 'transactions') {
    const kindLabel =
      payload.txn_type === 'salary_advance'
        ? 'salary advance'
        : payload.txn_type === 'salary_payment'
        ? 'salary payment'
        : payload.kind === 'income'
        ? 'income'
        : 'expense';
    const itemName = payload.item_name_snapshot || payload.item || payload.note || 'entry';
    const amountNum = Number(payload.amount);
    const amountText = !Number.isNaN(amountNum) && amountNum > 0 ? ` ${formatMoney(amountNum)}` : '';
    const isDelete = action === 'DELETE' || newObj?.is_deleted === true;
    const isRestore = action === 'RESTORE' || (oldObj?.is_deleted === true && newObj?.is_deleted === false);
    const verb = isDelete
      ? 'removed'
      : isRestore
      ? 'restored'
      : action === 'INSERT' || action === 'CREATE'
      ? 'added'
      : 'updated';

    summary = `${actorName} ${verb} ${kindLabel}${amountText} - ${itemName}${shopSuffix}`;
    if (viewerRole === 'admin' && shopId) {
      const d = payload.txn_date ? `?date=${encodeURIComponent(payload.txn_date)}` : '';
      href = `/admin/shops/${shopId}${d}`;
    } else if (viewerRole === 'master' && brandId) {
      href = `/master/brands/${brandId}`;
    }
  } else if (table === 'brands') {
    const bTitle = payload.name || payload.brand_name || brandName || 'brand';
    if (action === 'SUSPEND') {
      summary = `${actorName} suspended brand ${bTitle}`;
    } else if (action === 'REACTIVATE') {
      summary = `${actorName} reactivated brand ${bTitle}`;
    } else if (action === 'CREATE' || action === 'INSERT') {
      summary = `${actorName} onboarded brand ${bTitle}`;
    } else {
      summary = `${actorName} updated brand details for ${bTitle}`;
    }
    href = brandId ? `/master/brands/${brandId}` : '/master/brands';
  } else if (table === 'brand_settings') {
    const bTitle = payload.display_name || payload.brand_name || brandName || 'brand';
    if (action === 'VIEW_AS_ADMIN') {
      summary = `${actorName} inspected Brand Admin portal for ${bTitle}`;
    } else {
      summary = `${actorName} updated theme & branding for ${bTitle}`;
    }
    href = brandId ? `/master/brands/${brandId}/theme` : '/master/brands';
  } else if (table === 'shops') {
    const sTitle = payload.name || shopName || 'outlet';
    const verb =
      action === 'CREATE' || action === 'INSERT'
        ? 'created outlet'
        : action === 'DELETE'
        ? 'deleted outlet'
        : 'updated outlet';
    summary = `${actorName} ${verb} ${sTitle}${payload.code ? ` (${payload.code})` : ''}`;
    href =
      viewerRole === 'admin'
        ? shopId
          ? `/admin/shops/${shopId}`
          : '/admin/shops'
        : brandId
        ? `/master/brands/${brandId}`
        : '/master/audit';
  } else if (table === 'profiles') {
    const targetName = payload.full_name || payload.username || payload.email || 'user account';
    if (action === 'RESET_PASSWORD') {
      summary = `${actorName} reset password for ${targetName}${shopSuffix}`;
    } else if (action === 'CREATE' || action === 'INSERT') {
      summary = `${actorName} created login for ${targetName}${shopSuffix}`;
    } else if (payload.is_active === false) {
      summary = `${actorName} deactivated login for ${targetName}${shopSuffix}`;
    } else if (payload.is_active === true && oldObj?.is_active === false) {
      summary = `${actorName} reactivated login for ${targetName}${shopSuffix}`;
    } else {
      summary = `${actorName} updated user access for ${targetName}${shopSuffix}`;
    }
    href = viewerRole === 'admin' ? '/admin/users' : brandId ? `/master/brands/${brandId}` : '/master/audit';
  } else if (table === 'items' || table === 'payment_modes' || table === 'item_requests') {
    const label = payload.name || (table === 'payment_modes' ? 'payment mode' : 'catalog item');
    const verb =
      action === 'CREATE' || action === 'INSERT'
        ? 'added'
        : action === 'DELETE'
        ? 'removed'
        : payload.is_active === false
        ? 'deactivated'
        : 'updated';
    summary = `${actorName} ${verb} ${table === 'payment_modes' ? 'payment mode' : 'item'} ${label}${shopSuffix}`;
    href = viewerRole === 'admin' ? '/admin/items' : brandId ? `/master/brands/${brandId}` : '/master/audit';
  } else if (table === 'employees' || table === 'salary_records') {
    const empName = payload.name || payload.employee_name || 'staff member';
    if (table === 'salary_records') {
      summary = `${actorName} updated days worked for ${empName}${shopSuffix}`;
    } else {
      const verb = action === 'CREATE' || action === 'INSERT' ? 'added staff' : 'updated staff';
      summary = `${actorName} ${verb} ${empName}${shopSuffix}`;
    }
    href = viewerRole === 'admin' ? '/admin/employees' : '/master/audit';
  } else if (table === 'assets' || table === 'asset_service_logs') {
    const assetName = payload.name || payload.asset_name || 'equipment';
    if (table === 'asset_service_logs') {
      const costVal = Number(payload.cost);
      summary = `${actorName} logged maintenance service${costVal > 0 ? ` (${formatMoney(costVal)})` : ''}${shopSuffix}`;
    } else {
      const verb = action === 'CREATE' || action === 'INSERT' ? 'added equipment' : 'updated equipment';
      summary = `${actorName} ${verb} ${assetName}${shopSuffix}`;
    }
    href = viewerRole === 'admin' ? '/admin/assets' : '/master/audit';
  } else if (table === 'month_openings') {
    const monthStr = payload.month || 'month';
    if (payload.closed_at) {
      summary = `${actorName} closed period ${monthStr}${shopSuffix}`;
    } else if (payload.opening_balance !== undefined) {
      summary = `${actorName} set opening balance ${formatMoney(payload.opening_balance)} for ${monthStr}${shopSuffix}`;
    } else {
      summary = `${actorName} updated month opening for ${monthStr}${shopSuffix}`;
    }
    href = viewerRole === 'admin' ? '/admin/settings' : '/master/audit';
  } else {
    summary = `${actorName} performed ${action.toLowerCase()} in ${table}${shopSuffix}`;
  }

  return {
    id: raw.id,
    actorId: raw.user_id || null,
    actorName,
    actorRole,
    action,
    tableName: table,
    type: inferActivityType(table),
    brandId,
    brandName,
    shopId,
    shopName,
    summary,
    href,
    at: raw.at,
    timeLabel: formatActivityTime(raw.at),
    bucket: getActivityBucket(raw.at),
  };
}

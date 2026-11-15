// ==============================================================================
// CafeSync - Framework-Independent Removal & Rollback Engine
// Pure TypeScript - Runs in browser with Platform Master Supabase client
// All database changes execute within master-only SQL RPC transactions
// ==============================================================================

import { deleteAuthUsersAction, deleteBrandStorageAssetsAction } from '@/app/master/backup/actions';

export type RemovalScope = 'undo_upload' | 'remove_month' | 'remove_shop' | 'remove_brand';

export interface RemovalPreview {
  scope: RemovalScope;
  targetName: string;
  brandName?: string;
  brandId?: string;
  counts: Record<string, number>;
  totalCount: number;
  details: any;
}

export interface RemovalExecutionResult {
  success: boolean;
  scope: RemovalScope;
  targetName: string;
  deletedCounts: Record<string, number>;
  totalDeleted: number;
  authUsersDeleted: number;
  storageCleaned: boolean;
  reportText: string;
  error?: string;
}

// ------------------------------------------------------------------------------
// PREVIEW REMOVAL (DRY RUN VIA RPC)
// ------------------------------------------------------------------------------
export async function previewRemoval(
  supabase: any,
  scope: RemovalScope,
  params: {
    batchId?: string;
    brandId?: string;
    shopId?: string | null;
    startDate?: string;
    endDate?: string;
  }
): Promise<RemovalPreview> {
  if (scope === 'undo_upload') {
    if (!params.batchId) throw new Error('Batch ID required for undo upload.');
    const { data, error } = await supabase.rpc('rpc_preview_undo_batch', {
      p_batch_id: params.batchId,
    });
    if (error) throw new Error(`Preview failed: ${error.message}`);

    const counts = data?.counts || {};
    return {
      scope,
      targetName: `Import Batch ${params.batchId.slice(0, 8)}`,
      counts,
      totalCount: counts.total || 0,
      details: data,
    };
  }

  if (scope === 'remove_month') {
    if (!params.brandId || !params.startDate || !params.endDate) {
      throw new Error('Brand, start date, and end date required to remove month data.');
    }
    const { data, error } = await supabase.rpc('rpc_preview_remove_month', {
      p_brand_id: params.brandId,
      p_shop_id: params.shopId || null,
      p_start_date: params.startDate,
      p_end_date: params.endDate,
    });
    if (error) throw new Error(`Preview failed: ${error.message}`);

    const counts = data?.counts || {};
    return {
      scope,
      targetName: `${data?.shop_name || 'All Outlets'} (${params.startDate.slice(0, 7)} to ${params.endDate.slice(0, 7)})`,
      brandName: data?.brand_name,
      brandId: params.brandId,
      counts,
      totalCount: counts.total || 0,
      details: data,
    };
  }

  if (scope === 'remove_shop') {
    if (!params.shopId) throw new Error('Shop ID required.');
    const { data, error } = await supabase.rpc('rpc_preview_remove_shop', {
      p_shop_id: params.shopId,
    });
    if (error) throw new Error(`Preview failed: ${error.message}`);

    const counts = data?.counts || {};
    return {
      scope,
      targetName: `${data?.shop_name} (${data?.shop_code || ''})`,
      brandName: data?.brand_name,
      brandId: data?.brand_id,
      counts,
      totalCount: counts.total || 0,
      details: data,
    };
  }

  if (scope === 'remove_brand') {
    if (!params.brandId) throw new Error('Brand ID required.');
    const { data, error } = await supabase.rpc('rpc_preview_remove_brand', {
      p_brand_id: params.brandId,
    });
    if (error) throw new Error(`Preview failed: ${error.message}`);

    const counts = data?.counts || {};
    return {
      scope,
      targetName: `${data?.brand_name} (${data?.brand_slug || ''})`,
      brandName: data?.brand_name,
      brandId: params.brandId,
      counts,
      totalCount: counts.total || 0,
      details: data,
    };
  }

  throw new Error(`Unsupported removal scope: ${scope}`);
}

// ------------------------------------------------------------------------------
// EXECUTE REMOVAL (CALLS ATOMIC RPC + AUTH/STORAGE CLEANUP)
// ------------------------------------------------------------------------------
export async function executeRemoval(
  supabase: any,
  scope: RemovalScope,
  params: {
    batchId?: string;
    brandId?: string;
    brandSlug?: string;
    shopId?: string | null;
    startDate?: string;
    endDate?: string;
  },
  onProgress?: (step: string, pct: number) => void
): Promise<RemovalExecutionResult> {
  onProgress?.('Verifying master privileges and database locks...', 10);

  let targetName = 'Target Data';
  let deletedCounts: Record<string, number> = {};
  let totalDeleted = 0;
  let authUsersDeleted = 0;
  let storageCleaned = false;

  if (scope === 'undo_upload') {
    onProgress?.('Reverting imported batch and recalculating balances...', 40);
    const { data, error } = await supabase.rpc('rpc_undo_import_batch', {
      p_batch_id: params.batchId,
    });
    if (error) throw new Error(`Rollback failed: ${error.message}`);

    deletedCounts = data?.counts || {};
    totalDeleted = deletedCounts.total || 0;
    targetName = `Import Batch ${params.batchId?.slice(0, 8)}`;
  } else if (scope === 'remove_month') {
    onProgress?.('Deleting transactions and adjusting carry-forward balances...', 40);
    const { data, error } = await supabase.rpc('rpc_remove_month_data', {
      p_brand_id: params.brandId,
      p_shop_id: params.shopId || null,
      p_start_date: params.startDate,
      p_end_date: params.endDate,
    });
    if (error) throw new Error(`Month removal failed: ${error.message}`);

    deletedCounts = data?.counts || {};
    totalDeleted = deletedCounts.total || 0;
    targetName = `Month Period (${params.startDate?.slice(0, 7)} to ${params.endDate?.slice(0, 7)})`;
  } else if (scope === 'remove_shop') {
    onProgress?.('Deleting outlet data and associated financial records...', 30);
    const { data, error } = await supabase.rpc('rpc_remove_shop_data', {
      p_shop_id: params.shopId,
    });
    if (error) throw new Error(`Shop removal failed: ${error.message}`);

    deletedCounts = data?.counts || {};
    totalDeleted = deletedCounts.total || 0;
    targetName = `Outlet ${params.shopId?.slice(0, 8)}`;

    // Delete manager logins from Supabase Auth
    const managerIds: string[] = data?.manager_user_ids || [];
    if (managerIds.length > 0) {
      onProgress?.(`Deleting ${managerIds.length} manager authentication logins...`, 75);
      const authRes = await deleteAuthUsersAction(managerIds);
      authUsersDeleted = authRes.count || 0;
    }
  } else if (scope === 'remove_brand') {
    onProgress?.('Deleting brand portfolios, configurations, and tenant data...', 30);
    const { data, error } = await supabase.rpc('rpc_remove_brand_data', {
      p_brand_id: params.brandId,
    });
    if (error) throw new Error(`Brand removal failed: ${error.message}`);

    deletedCounts = data?.counts || {};
    totalDeleted = deletedCounts.total || 0;
    targetName = `Brand ${data?.brand_slug || params.brandId?.slice(0, 8)}`;

    // Delete all brand auth users (admins + managers)
    const userIds: string[] = data?.user_ids || [];
    if (userIds.length > 0) {
      onProgress?.(`Deleting ${userIds.length} administrator & manager logins from auth...`, 70);
      const authRes = await deleteAuthUsersAction(userIds);
      authUsersDeleted = authRes.count || 0;
    }

    // Delete brand assets from storage
    if (data?.brand_slug || params.brandSlug) {
      onProgress?.('Cleaning up brand logo and favicon storage files...', 85);
      const storageRes = await deleteBrandStorageAssetsAction(data?.brand_slug || params.brandSlug || '');
      storageCleaned = storageRes.success;
    }
  }

  onProgress?.('Finalizing removal audit log...', 95);

  const reportText = generateRemovalReport({
    scope,
    targetName,
    deletedCounts,
    totalDeleted,
    authUsersDeleted,
    storageCleaned,
  });

  onProgress?.('Removal completed successfully!', 100);

  return {
    success: true,
    scope,
    targetName,
    deletedCounts,
    totalDeleted,
    authUsersDeleted,
    storageCleaned,
    reportText,
  };
}

// ------------------------------------------------------------------------------
// GENERATE REMOVAL REPORT TEXT
// ------------------------------------------------------------------------------
export function generateRemovalReport(result: {
  scope: RemovalScope;
  targetName: string;
  deletedCounts: Record<string, number>;
  totalDeleted: number;
  authUsersDeleted?: number;
  storageCleaned?: boolean;
}): string {
  const timestamp = new Date().toISOString();
  const lines: string[] = [];

  lines.push('================================================================');
  lines.push('CAFESYNC DATA REMOVAL & ROLLBACK REPORT');
  lines.push('================================================================');
  lines.push(`Timestamp: ${timestamp}`);
  lines.push(`Removal Scope: ${result.scope.toUpperCase()}`);
  lines.push(`Target: ${result.targetName}`);
  lines.push(`Total Records Deleted: ${result.totalDeleted}`);
  if (result.authUsersDeleted !== undefined) {
    lines.push(`Auth User Logins Deleted: ${result.authUsersDeleted}`);
  }
  if (result.storageCleaned) {
    lines.push('Storage Bucket Assets Cleaned: Yes');
  }
  lines.push('----------------------------------------------------------------');
  lines.push('TABLE BREAKDOWN:');

  Object.entries(result.deletedCounts).forEach(([table, count]) => {
    if (table !== 'total') {
      lines.push(`  - ${table.padEnd(24)}: ${count} rows`);
    }
  });

  lines.push('================================================================');
  lines.push('Safety notice: To undo this removal, restore the pre-removal ZIP');
  lines.push('backup generated prior to this operation via the Restore tab.');
  lines.push('================================================================');

  return lines.join('\n');
}

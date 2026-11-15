// ==============================================================================
// CafeSync - Framework-Independent Backup Importer
// Executes safe, idempotent chunked import in strict dependency order
// ==============================================================================

import { exportBackup } from './export';
import {
  ImportOptions,
  ImportResult,
  ParsedBackupPayload,
  UserToRecreate,
} from './types';

// Helper to chunk arrays
function chunkArray<T>(items: T[], size = 500): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

export async function executeImport(
  payload: ParsedBackupPayload,
  options: ImportOptions,
  supabase: any
): Promise<ImportResult> {
  const { mode, preBackup = true, onProgress, abortSignal } = options;

  onProgress?.('Verifying permissions and environment...', 5);
  let currentUserId = 'system';
  try {
    const { data: authData } = await supabase.auth.getUser();
    if (authData?.user) {
      currentUserId = authData.user.id;
    }
  } catch {
    // Fallback to system for service role or script execution
  }

  let preBackupBlob: Blob | undefined;
  let preBackupFilename: string | undefined;

  // 1. SAFETY PRE-BACKUP
  if (preBackup) {
    onProgress?.('Generating safety pre-import backup archive...', 10);
    try {
      const backupRes = await exportBackup(supabase, {
        scope: 'all',
        onProgress: (msg, pct) => {
          onProgress?.(`[Safety Pre-Backup] ${msg}`, 10 + Math.floor(pct * 0.15));
        },
        abortSignal,
      });
      preBackupBlob = backupRes.blob;
      preBackupFilename = backupRes.filename;
    } catch (e: any) {
      console.warn('Safety backup could not be completed:', e);
    }
  }

  // 2. CREATE IMPORT BATCH RECORD
  onProgress?.('Initializing import batch tracking...', 26);
  const fileNames = payload.manifest ? ['CafeSync-Backup.zip'] : ['Uploaded-Data.xlsx'];
  let batchId = '';

  const { data: batchData, error: batchErr } = await supabase
    .from('import_batches')
    .insert({
      created_by: currentUserId,
      file_names: fileNames,
      mode,
      rows_added: 0,
      rows_updated: 0,
      status: 'completed',
      metadata: { brands: Object.keys(payload.brands) },
    })
    .select('id')
    .single();

  if (batchErr) {
    console.warn('Failed to insert into import_batches, continuing without batch tagging:', batchErr);
  } else if (batchData) {
    batchId = batchData.id;
  }

  const addedCounts: Record<string, number> = {};
  const updatedCounts: Record<string, number> = {};
  const skippedCounts: Record<string, number> = {};
  const errors: Array<{ table: string; message: string }> = [];
  const usersToRecreate: UserToRecreate[] = [];

  const affectedShops = new Set<string>();
  const affectedMonths = new Set<string>();
  const affectedEmpMonths = new Set<string>(); // `${shopId}|${empId}|${month}`
  const affectedShopDates = new Set<string>(); // `${shopId}|${date}`

  let totalAdded = 0;
  let totalUpdated = 0;

  // Helper for chunked table upsert/insert
  async function importTableRows(
    tableName: string,
    rows: any[],
    conflictTarget: string,
    tagWithBatch = false
  ) {
    if (!rows || rows.length === 0) return;
    if (abortSignal?.aborted) throw new Error('Import aborted by user.');

    // Resolve primary key / conflict column (e.g. 'brand_id' for brand_settings, 'id' otherwise)
    const idCol = conflictTarget.includes(',') ? 'id' : conflictTarget;
    const ids = rows.map((r) => r[idCol] || r.id).filter(Boolean);
    const existingIdSet = new Set<string>();

    if (ids.length > 0) {
      const idChunks = chunkArray(ids, 500);
      for (const ch of idChunks) {
        const { data: dbRecords } = await supabase.from(tableName).select(idCol).in(idCol, ch);
        (dbRecords || []).forEach((r: any) => existingIdSet.add(r[idCol]));
      }
    }

    const toInsert: any[] = [];
    const toUpdate: any[] = [];

    rows.forEach((r) => {
      // Strip internal helper props
      const cleanRow: any = {};
      Object.keys(r).forEach((k) => {
        if (!k.startsWith('_')) {
          cleanRow[k] = r[k] === '' ? null : r[k];
        }
      });

      // Special table column adjustments
      if (tableName === 'brand_settings') {
        delete cleanRow.created_at;
      }

      const pkVal = cleanRow[idCol] || cleanRow.id;
      const exists = pkVal && existingIdSet.has(pkVal);

      if (!exists) {
        if (tagWithBatch && batchId) {
          cleanRow.import_batch_id = batchId;
        }
        toInsert.push(cleanRow);
      } else {
        if (mode === 'add_update') {
          toUpdate.push(cleanRow);
        } else {
          skippedCounts[tableName] = (skippedCounts[tableName] || 0) + 1;
        }
      }
    });

    // Chunked Inserts
    if (toInsert.length > 0) {
      const insertChunks = chunkArray(toInsert, 500);
      for (const ch of insertChunks) {
        const { error: insErr } = await supabase.from(tableName).insert(ch);
        if (insErr) {
          errors.push({ table: tableName, message: `Insert failed: ${insErr.message}` });
          throw new Error(`Failed importing ${tableName}: ${insErr.message}`);
        }
        addedCounts[tableName] = (addedCounts[tableName] || 0) + ch.length;
        totalAdded += ch.length;
      }
    }

    // Chunked Updates
    if (toUpdate.length > 0) {
      const updateChunks = chunkArray(toUpdate, 500);
      for (const ch of updateChunks) {
        const { error: updErr } = await supabase
          .from(tableName)
          .upsert(ch, { onConflict: conflictTarget });
        if (updErr) {
          errors.push({ table: tableName, message: `Update failed: ${updErr.message}` });
          throw new Error(`Failed updating ${tableName}: ${updErr.message}`);
        }
        updatedCounts[tableName] = (updatedCounts[tableName] || 0) + ch.length;
        totalUpdated += ch.length;
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 3. EXECUTE IMPORT IN STRICT DEPENDENCY ORDER
  // ----------------------------------------------------------------------------
  const brandsList = Object.entries(payload.brands);
  const totalSteps = brandsList.length;
  let currentStep = 0;

  for (const [brandSlug, brandPayload] of brandsList) {
    if (abortSignal?.aborted) throw new Error('Import aborted by user.');
    currentStep++;
    const stepBase = 30 + Math.floor((currentStep - 1) / totalSteps * 45);

    const bData = brandPayload.brandData;

    // 1. brands
    if (bData?.brands && bData.brands.length > 0) {
      onProgress?.(`[${brandSlug}] Importing brand profile...`, stepBase);
      await importTableRows('brands', bData.brands, 'id', false);
    }

    // 2. brand_settings
    if (bData?.brand_settings && bData.brand_settings.length > 0) {
      onProgress?.(`[${brandSlug}] Importing brand settings...`, stepBase + 1);
      await importTableRows('brand_settings', bData.brand_settings, 'brand_id', false);
    }

    // 3. shops
    if (bData?.shops && bData.shops.length > 0) {
      onProgress?.(`[${brandSlug}] Importing outlets/shops...`, stepBase + 3);
      await importTableRows('shops', bData.shops, 'id', true);
      bData.shops.forEach((s) => affectedShops.add(s.id));
    }

    // 4. payment_modes
    if (bData?.payment_modes && bData.payment_modes.length > 0) {
      onProgress?.(`[${brandSlug}] Importing payment modes...`, stepBase + 5);
      await importTableRows('payment_modes', bData.payment_modes, 'id', false);
    }

    // 5. items
    if (bData?.items && bData.items.length > 0) {
      onProgress?.(`[${brandSlug}] Importing catalog items...`, stepBase + 7);
      await importTableRows('items', bData.items, 'id', true);
    }

    // 6. employees
    if (bData?.employees && bData.employees.length > 0) {
      onProgress?.(`[${brandSlug}] Importing employees...`, stepBase + 9);
      await importTableRows('employees', bData.employees, 'id', true);
    }

    // 7. assets
    if (bData?.assets && bData.assets.length > 0) {
      onProgress?.(`[${brandSlug}] Importing assets register...`, stepBase + 11);
      await importTableRows('assets', bData.assets, 'id', true);
    }

    // 8. asset_service_logs
    if (bData?.asset_service_logs && bData.asset_service_logs.length > 0) {
      onProgress?.(`[${brandSlug}] Importing asset maintenance logs...`, stepBase + 13);
      await importTableRows('asset_service_logs', bData.asset_service_logs, 'id', true);
    }

    // 9. month_openings
    if (bData?.month_openings && bData.month_openings.length > 0) {
      onProgress?.(`[${brandSlug}] Importing opening balances...`, stepBase + 15);
      await importTableRows('month_openings', bData.month_openings, 'shop_id,month', false);
      bData.month_openings.forEach((mo) => {
        affectedShops.add(mo.shop_id);
        if (mo.month) affectedMonths.add(mo.month);
      });
    }

    // 10. profiles (metadata only - user credentials recreated via Server Action)
    if (bData?.profiles && bData.profiles.length > 0) {
      onProgress?.(`[${brandSlug}] Importing manager & admin profiles...`, stepBase + 17);
      // Fetch existing auth profiles to determine who needs auth account creation
      const { data: dbProfiles } = await supabase.from('profiles').select('id');
      const dbProfileIds = new Set((dbProfiles || []).map((p: any) => p.id));

      bData.profiles.forEach((p) => {
        if (!dbProfileIds.has(p.id)) {
          usersToRecreate.push({
            id: p.id,
            brand_id: p.brand_id,
            shop_id: p.shop_id || null,
            role: p.role || 'manager',
            full_name: p.full_name,
            email: p.email || null,
            username: p.username || null,
            phone: p.phone || null,
          });
        }
      });

      // Upsert profile rows that match existing auth users
      const matchingProfiles = bData.profiles.filter((p) => dbProfileIds.has(p.id));
      if (matchingProfiles.length > 0) {
        await importTableRows('profiles', matchingProfiles, 'id', false);
      }
    }

    // 11. Re-upload brand logos/favicons from assets folder if missing
    if (bData?.logos && bData.logos.length > 0) {
      for (const logo of bData.logos) {
        try {
          const storagePath = `${brandSlug}/${logo.filename}`;
          // Check if exists
          const { data: existsData } = await supabase.storage.from('brand-assets').list(brandSlug, {
            search: logo.filename,
          });
          if (!existsData || existsData.length === 0) {
            await supabase.storage.from('brand-assets').upload(storagePath, logo.data, {
              contentType: logo.mimeType,
              upsert: false,
            });
          }
        } catch (e) {
          console.warn(`Could not restore storage asset ${logo.filename}:`, e);
        }
      }
    }

    // 12. Monthly Transactions & Salary Records
    for (const [month, monthData] of Object.entries(brandPayload.monthlyData)) {
      affectedMonths.add(month);

      // Transactions
      if (monthData.transactions.length > 0) {
        onProgress?.(`[${brandSlug}] Importing transactions for ${month}...`, stepBase + 20);
        const preparedTxns = monthData.transactions.map((tx) => ({
          ...tx,
          mode_name_snapshot: tx.mode_name_snapshot || 'CASH',
          kind: tx.kind || 'expense',
          txn_type: tx.txn_type || 'normal',
        }));
        await importTableRows('transactions', preparedTxns, 'id', true);

        monthData.transactions.forEach((tx) => {
          if (tx.shop_id) {
            affectedShops.add(tx.shop_id);
            if (tx.txn_date) affectedShopDates.add(`${tx.shop_id}|${tx.txn_date}`);
          }
          if (tx.employee_id && tx.shop_id) {
            affectedEmpMonths.add(`${tx.shop_id}|${tx.employee_id}|${month}`);
          }
        });
      }

      // Salary Records (NOTE: daily_summary is intentionally NOT imported directly)
      if (monthData.salary_records.length > 0) {
        onProgress?.(`[${brandSlug}] Importing salary sheets for ${month}...`, stepBase + 25);
        await importTableRows('salary_records', monthData.salary_records, 'id', true);

        monthData.salary_records.forEach((sr) => {
          if (sr.shop_id && sr.employee_id) {
            affectedEmpMonths.add(`${sr.shop_id}|${sr.employee_id}|${month}`);
          }
        });
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 4. POST-IMPORT RECALCULATION & RECONCILIATION
  // ----------------------------------------------------------------------------
  onProgress?.('Recomputing daily summaries and reconciling balances...', 80);

  // A. Recompute daily summaries for all dates affected
  const datesToRecalc = Array.from(affectedShopDates);
  for (let i = 0; i < datesToRecalc.length; i++) {
    const [shopId, dateStr] = datesToRecalc[i].split('|');
    try {
      await supabase.rpc('recalculate_shop_daily_summary', {
        p_shop_id: shopId,
        p_date: dateStr,
      });
    } catch (e) {
      console.warn(`Failed recalculate_shop_daily_summary for ${shopId} ${dateStr}:`, e);
    }
  }

  // B. Recompute salary_records advance_paid and net_payable to avoid double counting
  onProgress?.('Recomputing salary records and advance reconciliation...', 88);
  const empMonthsToRecalc = Array.from(affectedEmpMonths);
  for (let i = 0; i < empMonthsToRecalc.length; i++) {
    const [shopId, empId, month] = empMonthsToRecalc[i].split('|');
    try {
      await supabase.rpc('recalculate_salary_record', {
        p_shop_id: shopId,
        p_employee_id: empId,
        p_month: month,
      });
    } catch (e) {
      console.warn(`Failed recalculate_salary_record for ${shopId} ${empId} ${month}:`, e);
    }
  }

  // C. Month openings carry-forward check
  for (const shopId of affectedShops) {
    for (const month of affectedMonths) {
      try {
        await supabase.rpc('ensure_month_opening', {
          p_shop_id: shopId,
          p_target_month: month,
        });
      } catch (e) {
        console.warn(`Failed ensure_month_opening for ${shopId} ${month}:`, e);
      }
    }
  }

  // ----------------------------------------------------------------------------
  // 5. UPDATE IMPORT_BATCHES & AUDIT_LOG
  // ----------------------------------------------------------------------------
  if (batchId) {
    await supabase.from('import_batches').update({
      rows_added: totalAdded,
      rows_updated: totalUpdated,
      status: errors.length > 0 ? 'failed' : 'completed',
    }).eq('id', batchId);
  }

  try {
    await supabase.from('audit_log').insert({
      user_id: currentUserId,
      action: 'RESTORE_BACKUP',
      table_name: 'import_batches',
      record_id: batchId || 'restore',
      new_data: {
        mode,
        total_added: totalAdded,
        total_updated: totalUpdated,
        tables: addedCounts,
        errors_count: errors.length,
      },
    });
  } catch (err) {
    console.warn('Could not record in audit_log:', err);
  }

  onProgress?.('Import and reconciliation finished successfully!', 100);

  return {
    success: errors.length === 0,
    batchId,
    preBackupBlob,
    preBackupFilename,
    addedCounts,
    updatedCounts,
    skippedCounts,
    totalAdded,
    totalUpdated,
    errors,
    usersToRecreate,
    recalculatedShops: Array.from(affectedShops),
    recalculatedMonths: Array.from(affectedMonths),
  };
}

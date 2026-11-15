'use server';

import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { getCurrentUserContext } from '@/lib/auth';
import { revalidatePath } from 'next/cache';
import { formatSalaryAdvanceNote } from '@/lib/calculations/financials';
import { getTodayKolkata, getCurrentMonthKolkata } from '@/lib/calculations/dates';
import { TxnType, ItemKind } from '@/lib/supabase/types';
import { normalizeItemUnit } from '@/lib/constants/units';
import { differenceInCalendarDays } from 'date-fns';

const EDIT_WINDOW_DAYS = 2; // Managers can edit only within the last N days (default 2)

/**
 * Audit log helper — writes native JSONB objects rather than pre-stringified JSON
 */
async function logAuditEvent(
  supabase: any,
  userId: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  tableName: string,
  recordId: string,
  oldData?: any,
  newData?: any
) {
  try {
    await supabase.from('audit_log').insert({
      user_id: userId,
      action,
      table_name: tableName,
      record_id: recordId,
      old_data: oldData ?? null,
      new_data: newData ?? null,
      at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Audit log write error:', err);
  }
}

/**
 * Check if the month is closed
 */
async function isMonthClosed(supabase: any, shopId: string, monthStr: string): Promise<boolean> {
  try {
    const { data: monthOpening } = await supabase
      .from('month_openings')
      .select('closed_at')
      .eq('shop_id', shopId)
      .eq('month', monthStr)
      .maybeSingle();

    return !!monthOpening?.closed_at;
  } catch {
    return false;
  }
}

/**
 * Screen 1: Add a daily transaction (Fast Spreadsheet Entry)
 * Supports optional quantity & unit snapshot with computed unit rate.
 */
export async function addDailyTransactionAction(formData: FormData) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'manager' || !user.shopId || !user.brandId) {
    return { error: 'Unauthorized: Only assigned shop managers can add transactions.' };
  }

  const kind = formData.get('kind') as ItemKind;
  const amountStr = formData.get('amount') as string;
  const itemId = (formData.get('item_id') as string) || null;
  const modeId = (formData.get('mode_id') as string) || null;
  const employeeId = (formData.get('employee_id') as string) || null;
  const customNote = (formData.get('note') as string)?.trim() || '';
  const txnType = (formData.get('txn_type') as TxnType) || 'normal';
  const txnDate = (formData.get('txn_date') as string) || getTodayKolkata();
  const qtyStr = (formData.get('quantity') as string) || '';
  const rawUnit = (formData.get('unit_snapshot') as string)?.trim() || '';

  // Validation 1: Amount > 0
  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return { error: 'Validation Error: Amount must be greater than ₹0.' };
  }

  const parsedQty = qtyStr.trim() !== '' ? parseFloat(qtyStr) : null;
  if (parsedQty !== null && (Number.isNaN(parsedQty) || parsedQty <= 0)) {
    return { error: 'Validation Error: Quantity must be greater than 0 (or leave blank).' };
  }

  // Validation 2: Date not in the future
  const today = getTodayKolkata();
  if (txnDate > today) {
    return { error: 'Validation Error: Transaction date cannot be in the future.' };
  }

  const supabase = await createClient();

  // Validation 3: Month is not closed
  const txnMonth = txnDate.substring(0, 7);
  const closed = await isMonthClosed(supabase, user.shopId, txnMonth);
  if (closed) {
    return { error: `Financial Period Closed: Month ${txnMonth} is closed and locked by Brand Admin.` };
  }

  // Resolve snapshot names & default item unit
  let itemNameSnapshot = 'Counter Item';
  let itemDefaultUnit = 'pcs';
  let modeNameSnapshot = 'CASH';

  if (itemId) {
    const { data: item } = (await supabase
      .from('items')
      .select('name, unit')
      .eq('id', itemId)
      .maybeSingle()) as { data: any; error: any };
    if (item) {
      itemNameSnapshot = item.name;
      if (item.unit) itemDefaultUnit = item.unit;
    }
  }

  if (modeId) {
    const { data: mode } = (await supabase
      .from('payment_modes')
      .select('name')
      .eq('id', modeId)
      .maybeSingle()) as { data: any; error: any };
    if (mode) modeNameSnapshot = mode.name;
  }

  let finalNote = customNote;
  if (txnType === 'salary_advance' && employeeId) {
    const { data: emp } = (await supabase
      .from('employees')
      .select('name')
      .eq('id', employeeId)
      .maybeSingle()) as { data: any; error: any };
    const empName = emp?.name || 'Staff';
    finalNote = formatSalaryAdvanceNote(empName, customNote);
    itemNameSnapshot = 'Salary Advance';
  } else if (txnType === 'salary_payment' && employeeId) {
    const { data: emp } = (await supabase
      .from('employees')
      .select('name')
      .eq('id', employeeId)
      .maybeSingle()) as { data: any; error: any };
    const empName = emp?.name || 'Staff';
    finalNote = `SALARY-${empName}${customNote ? ` (${customNote})` : ''}`;
    itemNameSnapshot = 'Salary Payment';
  }

  const quantity = parsedQty !== null ? Math.round(parsedQty * 1000) / 1000 : null;
  const unitSnapshot =
    quantity !== null ? rawUnit || itemDefaultUnit || 'pcs' : null;
  const rate =
    quantity !== null && quantity > 0
      ? Math.round((amount / quantity) * 100) / 100
      : null;

  const newTxn = {
    brand_id: user.brandId,
    shop_id: user.shopId,
    txn_date: txnDate,
    kind,
    item_id: itemId,
    item_name_snapshot: itemNameSnapshot,
    mode_id: modeId,
    mode_name_snapshot: modeNameSnapshot,
    amount,
    quantity,
    unit_snapshot: unitSnapshot,
    rate,
    note: finalNote,
    employee_id: employeeId,
    txn_type: txnType,
    created_by: user.id,
    is_deleted: false,
  };

  try {
    const { data: inserted, error } = (await supabase
      .from('transactions')
      .insert(newTxn as any)
      .select('id')
      .single()) as { data: any; error: any };

    if (error && isSupabaseConfigured()) {
      return { error: error.message };
    }

    const recordId = inserted?.id || `demo-txn-${Date.now()}`;

    // Write audit log
    await logAuditEvent(supabase, user.id, 'INSERT', 'transactions', recordId, null, newTxn);

    revalidatePath('/shop');
    revalidatePath('/shop/summary');
    revalidatePath('/shop/reports');
    revalidatePath('/shop/staff');
    revalidatePath('/admin');
    revalidatePath('/admin/shops');
    revalidatePath('/admin/reports');

    return {
      success: true,
      id: recordId,
      message: `${kind === 'income' ? 'Income' : 'Expense'} entry of ₹${amount.toLocaleString('en-IN')} added!`,
    };
  } catch (err: any) {
    return { error: err.message || 'Failed to record entry.' };
  }
}

/**
 * Screen 1: Edit a daily transaction (also used to Undo an edit)
 * Condition: Only within the last N days (N=2) and never in a closed month.
 */
export async function updateDailyTransactionAction(formData: FormData) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'manager' || !user.shopId) {
    return { error: 'Unauthorized.' };
  }

  const txnId = formData.get('transaction_id') as string;
  const amountStr = formData.get('amount') as string;
  const note = (formData.get('note') as string)?.trim() || '';
  const modeId = (formData.get('mode_id') as string) || null;
  const qtyField = formData.get('quantity');
  const rawUnit = (formData.get('unit_snapshot') as string)?.trim() || '';

  const amount = parseFloat(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return { error: 'Validation Error: Amount must be greater than ₹0.' };
  }

  let parsedQty: number | null | undefined = undefined;
  if (qtyField !== null) {
    const qs = String(qtyField).trim();
    if (qs === '') {
      parsedQty = null;
    } else {
      const qNum = parseFloat(qs);
      if (Number.isNaN(qNum) || qNum <= 0) {
        return { error: 'Validation Error: Quantity must be greater than 0 (or leave blank).' };
      }
      parsedQty = Math.round(qNum * 1000) / 1000;
    }
  }

  const supabase = await createClient();

  // Fetch current transaction to verify ownership & date limits
  const { data: existingTxn } = (await supabase
    .from('transactions')
    .select('*')
    .eq('id', txnId)
    .eq('shop_id', user.shopId)
    .maybeSingle()) as { data: any; error: any };

  if (!existingTxn && isSupabaseConfigured()) {
    return { error: 'Transaction not found or not owned by your shop.' };
  }

  if (existingTxn) {
    const today = getTodayKolkata();
    const daysDiff = differenceInCalendarDays(new Date(today), new Date(existingTxn.txn_date));
    if (daysDiff > EDIT_WINDOW_DAYS) {
      return {
        error: `Policy Restriction: Transactions older than ${EDIT_WINDOW_DAYS} days are locked and can only be modified by a Brand Admin.`,
      };
    }

    const txnMonth = existingTxn.txn_date.substring(0, 7);
    const closed = await isMonthClosed(supabase, user.shopId, txnMonth);
    if (closed) {
      return { error: `Period Locked: Month ${txnMonth} is closed.` };
    }
  }

  let modeNameSnapshot = existingTxn?.mode_name_snapshot || 'CASH';
  if (modeId && modeId !== existingTxn?.mode_id) {
    const { data: mode } = (await supabase
      .from('payment_modes')
      .select('name')
      .eq('id', modeId)
      .maybeSingle()) as { data: any; error: any };
    if (mode) modeNameSnapshot = mode.name;
  }

  const nextQty =
    parsedQty !== undefined ? parsedQty : (existingTxn?.quantity ?? null);
  const nextUnit =
    nextQty !== null
      ? rawUnit || existingTxn?.unit_snapshot || 'pcs'
      : null;
  const nextRate =
    nextQty !== null && nextQty > 0
      ? Math.round((amount / nextQty) * 100) / 100
      : null;

  const updates = {
    amount,
    note,
    mode_id: modeId || existingTxn?.mode_id || null,
    mode_name_snapshot: modeNameSnapshot,
    quantity: nextQty,
    unit_snapshot: nextUnit,
    rate: nextRate,
  };

  try {
    if (isSupabaseConfigured()) {
      const { error } = await (supabase.from('transactions') as any)
        .update(updates)
        .eq('id', txnId)
        .eq('shop_id', user.shopId);

      if (error) {
        return { error: error.message };
      }

      await logAuditEvent(supabase, user.id, 'UPDATE', 'transactions', txnId, existingTxn, updates);
    }

    revalidatePath('/shop');
    revalidatePath('/shop/summary');
    revalidatePath('/shop/reports');
    revalidatePath('/admin');
    revalidatePath('/admin/reports');
    return { success: true, message: 'Entry updated and closing balance recalculated.' };
  } catch (err: any) {
    return { error: err.message || 'Failed to update transaction.' };
  }
}

/**
 * Screen 1: Delete a transaction (Soft delete, reversible via Undo toast)
 */
export async function deleteDailyTransactionAction(txnId: string) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'manager' || !user.shopId) {
    return { error: 'Unauthorized.' };
  }

  const supabase = await createClient();

  if (isSupabaseConfigured()) {
    const { data: existingTxn } = (await supabase
      .from('transactions')
      .select('*')
      .eq('id', txnId)
      .eq('shop_id', user.shopId)
      .maybeSingle()) as { data: any; error: any };

    if (!existingTxn) {
      return { error: 'Transaction not found.' };
    }

    const today = getTodayKolkata();
    const daysDiff = differenceInCalendarDays(new Date(today), new Date(existingTxn.txn_date));
    if (daysDiff > EDIT_WINDOW_DAYS) {
      return {
        error: `Policy Restriction: Transactions older than ${EDIT_WINDOW_DAYS} days are locked and cannot be deleted.`,
      };
    }

    const txnMonth = existingTxn.txn_date.substring(0, 7);
    const closed = await isMonthClosed(supabase, user.shopId, txnMonth);
    if (closed) {
      return { error: `Period Locked: Month ${txnMonth} is closed.` };
    }

    const { error } = await (supabase.from('transactions') as any)
      .update({ is_deleted: true })
      .eq('id', txnId)
      .eq('shop_id', user.shopId);

    if (error) return { error: error.message };
    await logAuditEvent(supabase, user.id, 'DELETE', 'transactions', txnId, existingTxn, { is_deleted: true });
  }

  revalidatePath('/shop');
  revalidatePath('/shop/summary');
  revalidatePath('/shop/reports');
  revalidatePath('/admin');
  revalidatePath('/admin/reports');
  return { success: true, message: 'Entry removed.' };
}

/**
 * Screen 1: Restore a soft-deleted transaction (Undo toast)
 */
export async function restoreDailyTransactionAction(txnId: string) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'manager' || !user.shopId) {
    return { error: 'Unauthorized.' };
  }

  if (!isSupabaseConfigured()) {
    return { success: true, message: 'Entry restored!' };
  }

  const supabase = await createClient();

  const { data: existingTxn } = (await supabase
    .from('transactions')
    .select('*')
    .eq('id', txnId)
    .eq('shop_id', user.shopId)
    .maybeSingle()) as { data: any; error: any };

  if (!existingTxn) {
    return { error: 'Entry could not be found to restore.' };
  }

  const txnMonth = existingTxn.txn_date.substring(0, 7);
  const closed = await isMonthClosed(supabase, user.shopId, txnMonth);
  if (closed) {
    return { error: `Period Locked: Month ${txnMonth} is closed.` };
  }

  const { error } = await (supabase.from('transactions') as any)
    .update({ is_deleted: false })
    .eq('id', txnId)
    .eq('shop_id', user.shopId);

  if (error) {
    return { error: error.message };
  }

  await logAuditEvent(supabase, user.id, 'UPDATE', 'transactions', txnId, { is_deleted: true }, { is_deleted: false, restored: true });

  revalidatePath('/shop');
  revalidatePath('/shop/summary');
  revalidatePath('/shop/reports');
  revalidatePath('/admin');
  revalidatePath('/admin/reports');
  return { success: true, message: 'Entry restored!' };
}

/**
 * Bidirectional Catalog: Shop Manager adds or updates shop-specific items
 * Brand-wide items (shop_id IS NULL) are strictly read-only for managers.
 */
export async function saveShopItemAction(formData: {
  id?: string;
  name: string;
  kind: 'income' | 'expense';
  category?: string;
  unit?: string;
  defaultRate?: number | null;
}) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'manager' || !user.shopId || !user.brandId) {
    return { error: 'Unauthorized: Only assigned shop managers can manage shop items.' };
  }

  const trimmedName = (formData.name || '').trim();
  const kind: 'income' | 'expense' = formData.kind === 'income' ? 'income' : 'expense';
  const category = (formData.category || '').trim() || (kind === 'income' ? 'Sales' : 'General');
  const unit = normalizeItemUnit(formData.unit);
  const defaultRate =
    formData.defaultRate !== undefined &&
    formData.defaultRate !== null &&
    !Number.isNaN(Number(formData.defaultRate)) &&
    Number(formData.defaultRate) > 0
      ? Math.round(Number(formData.defaultRate) * 100) / 100
      : null;

  if (trimmedName.length < 2) {
    return { error: 'Please enter an item name (minimum 2 characters).' };
  }

  if (!isSupabaseConfigured()) {
    return {
      success: true,
      item: {
        id: formData.id || `shop-item-${Date.now()}`,
        brand_id: user.brandId,
        shop_id: user.shopId,
        created_by: user.id,
        name: trimmedName,
        kind,
        category,
        unit,
        default_rate: defaultRate,
        is_active: true,
      },
      message: formData.id
        ? `Updated "${trimmedName}"`
        : `Added "${trimmedName}" (${unit}) to your shop!`,
    };
  }

  const supabase = (await createClient()) as any;

  try {
    // Duplicate check across brand-wide items & this shop's items
    const { data: visibleItems } = await supabase
      .from('items')
      .select('id, name, shop_id')
      .eq('brand_id', user.brandId)
      .or(`shop_id.is.null,shop_id.eq.${user.shopId}`);

    const duplicate = (visibleItems || []).find(
      (i: any) =>
        i.id !== formData.id &&
        i.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (duplicate) {
      return {
        error: `"${duplicate.name}" already exists (${duplicate.shop_id ? 'your shop' : 'brand-wide'}). Pick that item or choose a distinct name.`,
      };
    }

    if (formData.id) {
      const { data: existing } = await supabase
        .from('items')
        .select('id, shop_id, name, kind, category, unit, default_rate')
        .eq('id', formData.id)
        .eq('brand_id', user.brandId)
        .maybeSingle();

      if (!existing) {
        return { error: 'Item not found.' };
      }
      if (!existing.shop_id) {
        return { error: 'Brand-wide items are read-only for shop managers.' };
      }
      if (existing.shop_id !== user.shopId) {
        return { error: 'You can only edit items belonging to your own shop.' };
      }

      const { data: updated, error } = await supabase
        .from('items')
        .update({
          name: trimmedName,
          category,
          unit,
          default_rate: defaultRate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', formData.id)
        .eq('shop_id', user.shopId)
        .select()
        .single();

      if (error) return { error: error.message };

      await logAuditEvent(supabase, user.id, 'UPDATE', 'items', formData.id, existing, updated);

      revalidatePath('/shop');
      revalidatePath('/shop/items');
      revalidatePath('/admin/items');
      return {
        success: true,
        item: updated,
        message: `Updated "${trimmedName}".`,
      };
    } else {
      const { data: created, error } = await supabase
        .from('items')
        .insert({
          brand_id: user.brandId,
          shop_id: user.shopId,
          created_by: user.id,
          name: trimmedName,
          kind,
          category,
          unit,
          default_rate: defaultRate,
          is_active: true,
        })
        .select()
        .single();

      if (error) return { error: error.message };

      await logAuditEvent(supabase, user.id, 'INSERT', 'items', created.id, null, created);

      revalidatePath('/shop');
      revalidatePath('/shop/items');
      revalidatePath('/admin/items');
      return {
        success: true,
        item: created,
        message: `Added "${trimmedName}" (${unit}) to your shop!`,
      };
    }
  } catch (err: any) {
    return { error: err?.message || 'Failed to save shop item.' };
  }
}

export async function toggleShopItemStatusAction(itemId: string, isActive: boolean) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'manager' || !user.shopId || !user.brandId) {
    return { error: 'Unauthorized.' };
  }

  if (!isSupabaseConfigured()) {
    return { success: true };
  }

  const supabase = (await createClient()) as any;
  const { data: existing } = await supabase
    .from('items')
    .select('id, shop_id, name, is_active')
    .eq('id', itemId)
    .eq('brand_id', user.brandId)
    .maybeSingle();

  if (!existing) {
    return { error: 'Item not found.' };
  }
  if (!existing.shop_id) {
    return { error: 'Brand-wide items cannot be deactivated by shop managers.' };
  }
  if (existing.shop_id !== user.shopId) {
    return { error: 'You can only update items belonging to your shop.' };
  }

  const { error } = await supabase
    .from('items')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('shop_id', user.shopId);

  if (error) return { error: error.message };

  await logAuditEvent(
    supabase,
    user.id,
    'UPDATE',
    'items',
    itemId,
    { is_active: existing.is_active },
    { is_active: isActive }
  );

  revalidatePath('/shop');
  revalidatePath('/shop/items');
  revalidatePath('/admin/items');
  return { success: true };
}

/**
 * Screen 2: Update Employee Days Worked
 */
export async function updateDaysWorkedAction(formData: FormData) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'manager' || !user.shopId) {
    return { error: 'Unauthorized.' };
  }

  const employeeId = formData.get('employee_id') as string;
  const daysWorked = parseFloat(formData.get('days_worked') as string);
  const month = (formData.get('month') as string) || getCurrentMonthKolkata();

  if (!employeeId || isNaN(daysWorked) || daysWorked < 0 || daysWorked > 31) {
    return { error: 'Please enter valid days worked between 0 and 31.' };
  }

  const supabase = await createClient();

  // Check closed month
  const closed = await isMonthClosed(supabase, user.shopId, month);
  if (closed) {
    return { error: `Period Locked: Month ${month} is closed.` };
  }

  try {
    // Get employee rate
    const { data: emp } = (await supabase
      .from('employees')
      .select('name, rate_per_day')
      .eq('id', employeeId)
      .eq('shop_id', user.shopId)
      .maybeSingle()) as { data: any; error: any };

    const rate = emp?.rate_per_day || 0;
    const gross = Math.round(daysWorked * rate * 100) / 100;

    // Check existing record for advances and paid
    const { data: existingRec } = (await supabase
      .from('salary_records')
      .select('id, advances_total, paid_total')
      .eq('shop_id', user.shopId)
      .eq('employee_id', employeeId)
      .eq('month', month)
      .maybeSingle()) as { data: any; error: any };

    const advances = Number(existingRec?.advances_total || 0);
    const paid = Number(existingRec?.paid_total || 0);
    const balance = Math.round((gross - advances - paid) * 100) / 100;

    const recordData = {
      shop_id: user.shopId,
      employee_id: employeeId,
      month,
      days_worked: daysWorked,
      rate_snapshot: rate,
      gross,
      advances_total: advances,
      paid_total: paid,
      balance,
    };

    const { error } = await supabase.from('salary_records').upsert(recordData as any, {
      onConflict: 'shop_id,employee_id,month',
    });

    if (error) {
      if (isSupabaseConfigured()) return { error: error.message };
      console.warn('Salary record upsert error:', error.message);
    }

    await logAuditEvent(
      supabase,
      user.id,
      'UPDATE',
      'salary_records',
      existingRec?.id || employeeId,
      existingRec,
      recordData
    );

    revalidatePath('/shop/staff');
    revalidatePath('/admin/employees');
    return {
      success: true,
      message: `Updated ${emp?.name || 'Staff'}: ${daysWorked} days worked (Gross: ₹${gross.toLocaleString('en-IN')})`,
    };
  } catch (err: any) {
    return { error: err.message || 'Failed to update attendance.' };
  }
}

/**
 * Screen 2: Record a Salary Advance or Payment
 */
export async function recordSalaryTransactionAction(formData: FormData) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'manager' || !user.shopId || !user.brandId) {
    return { error: 'Unauthorized.' };
  }

  const employeeId = formData.get('employee_id') as string;
  const amountStr = formData.get('amount') as string;
  const modeId = (formData.get('mode_id') as string) || null;
  const txnType = (formData.get('txn_type') as TxnType) || 'salary_advance';
  const customNote = (formData.get('note') as string)?.trim() || '';
  const txnDate = (formData.get('txn_date') as string) || getTodayKolkata();

  const amount = parseFloat(amountStr);
  if (!employeeId || isNaN(amount) || amount <= 0) {
    return { error: 'Please select an employee and enter an amount greater than ₹0.' };
  }

  const today = getTodayKolkata();
  if (txnDate > today) {
    return { error: 'Transaction date cannot be in the future.' };
  }

  const supabase = await createClient();

  const txnMonth = txnDate.substring(0, 7);
  const closed = await isMonthClosed(supabase, user.shopId, txnMonth);
  if (closed) {
    return { error: `Period Locked: Month ${txnMonth} is closed.` };
  }

  // Fetch employee name
  const { data: emp } = (await supabase
    .from('employees')
    .select('name')
    .eq('id', employeeId)
    .eq('shop_id', user.shopId)
    .maybeSingle()) as { data: any; error: any };

  const empName = emp?.name || 'Staff';

  let modeName = 'CASH';
  if (modeId) {
    const { data: mode } = (await supabase
      .from('payment_modes')
      .select('name')
      .eq('id', modeId)
      .maybeSingle()) as { data: any; error: any };
    if (mode) modeName = mode.name;
  }

  const isAdvance = txnType === 'salary_advance';
  const finalNote = isAdvance
    ? formatSalaryAdvanceNote(empName, customNote)
    : `SALARY-${empName}${customNote ? ` (${customNote})` : ''}`;

  const txnData = {
    brand_id: user.brandId,
    shop_id: user.shopId,
    txn_date: txnDate,
    kind: 'expense' as const,
    item_id: null,
    item_name_snapshot: isAdvance ? 'Salary Advance' : 'Salary Payment',
    mode_id: modeId,
    mode_name_snapshot: modeName,
    amount,
    note: finalNote,
    employee_id: employeeId,
    txn_type: txnType,
    created_by: user.id,
    is_deleted: false,
  };

  try {
    const { data: inserted, error } = (await supabase
      .from('transactions')
      .insert(txnData as any)
      .select('id')
      .single()) as { data: any; error: any };

    if (error && isSupabaseConfigured()) {
      return { error: error.message };
    }

    const recId = inserted?.id || `sal-${Date.now()}`;
    await logAuditEvent(supabase, user.id, 'INSERT', 'transactions', recId, null, txnData);

    revalidatePath('/shop');
    revalidatePath('/shop/staff');
    revalidatePath('/shop/summary');
    revalidatePath('/admin/employees');

    return {
      success: true,
      message: `${isAdvance ? 'Salary Advance' : 'Salary Payment'} of ₹${amount.toLocaleString('en-IN')} recorded for ${empName}!`,
    };
  } catch (err: any) {
    return { error: err.message || 'Failed to record salary transaction.' };
  }
}

/**
 * Screen 4: Log Asset Service
 */
export async function logAssetServiceAction(formData: FormData) {
  const user = await getCurrentUserContext();
  if (!user || user.role !== 'manager' || !user.shopId || !user.brandId) {
    return { error: 'Unauthorized.' };
  }

  const assetId = formData.get('asset_id') as string;
  const serviceDate = (formData.get('service_date') as string) || getTodayKolkata();
  const vendor = (formData.get('vendor') as string)?.trim() || 'Internal Technician';
  const costStr = formData.get('cost') as string;
  const notes = (formData.get('notes') as string)?.trim() || '';
  const nextDueDate = formData.get('next_due') as string;

  const cost = parseFloat(costStr) || 0;

  if (!assetId || !serviceDate || !nextDueDate) {
    return { error: 'Please enter service date, vendor, and next service due date.' };
  }

  const today = getTodayKolkata();
  if (serviceDate > today) {
    return { error: 'Service date cannot be in the future.' };
  }

  const supabase = await createClient();

  try {
    // 1. Insert service log
    const logData = {
      asset_id: assetId,
      service_date: serviceDate,
      vendor,
      cost,
      notes,
      next_due: nextDueDate,
    };

    const { data: insertedLog, error: logError } = (await supabase
      .from('asset_service_logs')
      .insert(logData as any)
      .select('id')
      .single()) as { data: any; error: any };

    if (logError && isSupabaseConfigured()) {
      return { error: logError.message };
    }

    // 2. Update Asset status, last_service_date, and next_service_due
    const { error: assetUpdateErr } = await (supabase.from('assets') as any)
      .update({
        last_service_date: serviceDate,
        next_service_due: nextDueDate,
        status: 'working',
        notes: notes || undefined,
      })
      .eq('id', assetId)
      .eq('shop_id', user.shopId);

    if (assetUpdateErr && isSupabaseConfigured()) {
      return { error: assetUpdateErr.message };
    }

    // 3. If service cost > 0, log as expense transaction in daily ledger!
    if (cost > 0) {
      const { data: asset } = (await supabase
        .from('assets')
        .select('name')
        .eq('id', assetId)
        .maybeSingle()) as { data: any; error: any };

      const assetName = asset?.name || 'Equipment';

      const { error: txnErr } = await supabase.from('transactions').insert({
        brand_id: user.brandId,
        shop_id: user.shopId,
        txn_date: serviceDate,
        kind: 'expense',
        item_id: null,
        item_name_snapshot: 'Minor Machine Repairs',
        mode_id: null,
        mode_name_snapshot: 'CASH',
        amount: cost,
        note: `Service: ${assetName} (${vendor})`,
        employee_id: null,
        txn_type: 'normal',
        created_by: user.id,
        is_deleted: false,
      } as any);

      if (txnErr && isSupabaseConfigured()) {
        return { error: txnErr.message };
      }
    }

    const recId = insertedLog?.id || `srv-${Date.now()}`;
    await logAuditEvent(supabase, user.id, 'INSERT', 'asset_service_logs', recId, null, logData);

    revalidatePath('/shop');
    revalidatePath('/shop/assets');
    revalidatePath('/admin/assets');

    return {
      success: true,
      message: `Service logged successfully! Asset status set to working, next due on ${nextDueDate}.`,
    };
  } catch (err: any) {
    return { error: err.message || 'Failed to log asset service.' };
  }
}

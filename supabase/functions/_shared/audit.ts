// ==============================================================================
// CafeSync Edge Functions - Shared Audit Logging Helper
// Writes structured audit records without ever recording passwords or secrets.
// ==============================================================================

import { getServiceClient } from './supabase.ts';

export async function writeAuditLog(params: {
  userId: string;
  action: string;
  tableName: string;
  recordId: string;
  oldData?: Record<string, unknown> | null;
  newData?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    const serviceClient = getServiceClient();

    // Redact any sensitive fields just in case
    const sanitize = (data?: Record<string, unknown> | null) => {
      if (!data) return null;
      const copy = { ...data };
      delete copy.password;
      delete copy.temporaryPassword;
      delete copy.tempPassword;
      delete copy.token;
      delete copy.secret;
      return copy;
    };

    await serviceClient.from('audit_log').insert({
      user_id: params.userId,
      action: params.action,
      table_name: params.tableName,
      record_id: params.recordId,
      old_data: sanitize(params.oldData),
      new_data: sanitize(params.newData),
    });
  } catch (err) {
    // Non-fatal, but logged
    console.warn('Failed to write audit_log entry:', err);
  }
}


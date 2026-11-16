import 'server-only';
import { cache } from 'react';
import { createClient } from './server';
import { isSupabaseConfigured } from './config';

/**
 * Fetches a userId -> email lookup map via scoped RPC `get_auth_user_emails()`.
 * Deduplicated per request via React cache().
 * Allows Master and Brand Admin pages to access user emails without exposing
 * or requiring the Supabase Service Role Key.
 */
export const getAuthEmailMap = cache(async (): Promise<Map<string, string>> => {
  const emailMap = new Map<string, string>();
  if (!isSupabaseConfigured()) {
    return emailMap;
  }

  try {
    const supabase = (await createClient()) as any;
    const { data, error } = await supabase.rpc('get_auth_user_emails');

    if (!error && Array.isArray(data)) {
      for (const row of data) {
        if (row.user_id && row.email) {
          emailMap.set(row.user_id, row.email);
        }
      }
    }
  } catch (err) {
    console.warn('Unable to load auth user emails via RPC:', err);
  }

  return emailMap;
});

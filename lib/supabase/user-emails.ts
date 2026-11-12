import 'server-only';
import { cache } from 'react';
import { tryGetAdminClient } from './admin';
import { isSupabaseConfigured } from './config';

/**
 * Fetches a userId -> email lookup map via Supabase Auth Admin API.
 * Deduplicated per request via React cache().
 * Used by Master and Brand Admin server pages because `public.profiles`
 * intentionally stores profile attributes without duplicating auth.users.email.
 */
export const getAuthEmailMap = cache(async (): Promise<Map<string, string>> => {
  const emailMap = new Map<string, string>();
  if (!isSupabaseConfigured()) {
    return emailMap;
  }

  try {
    const adminSupabase = tryGetAdminClient();
    if (!adminSupabase) return emailMap;

    const { data, error } = await adminSupabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (!error && data?.users) {
      for (const u of data.users) {
        if (u.id && u.email) {
          emailMap.set(u.id, u.email);
        }
      }
    }
  } catch (err) {
    console.warn('Unable to load auth user emails:', err);
  }

  return emailMap;
});

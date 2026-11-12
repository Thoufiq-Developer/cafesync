import 'server-only';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { Database } from './types';

let adminClient: ReturnType<typeof createSupabaseClient<Database>> | null = null;

export function createAdminClient() {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL. Privileged operations require the service role key on the server.'
    );
  }

  adminClient = createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

/**
 * Non-throwing variant of createAdminClient() used when falling back gracefully
 * in demo mode or missing env configurations without crashing read routes.
 */
export function tryGetAdminClient() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

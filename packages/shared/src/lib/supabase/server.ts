import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Database } from './types';
import { isSupabaseConfigured } from './config';

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing user sessions.
        }
      },
    },
    global: {
      fetch: (input, init) => {
        // Instant short-circuit (0ms) when placeholder domain is used.
        // Return 400 (NOT 503) so PostgREST/Auth SDKs do not trigger 7-second exponential backoff retries.
        if (!isSupabaseConfigured()) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                message: 'Supabase unconfigured',
                error: 'unconfigured',
                code: 'UNCONFIGURED',
              }),
              {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
              }
            )
          );
        }

        // Add 12s timeout to live Supabase requests so cold starts succeed without hanging forever
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 12000);
        const upstreamSignal = init?.signal;
        if (upstreamSignal) {
          if (upstreamSignal.aborted) {
            controller.abort();
          } else {
            upstreamSignal.addEventListener('abort', () => controller.abort(), { once: true });
          }
        }
        const combinedSignal =
          upstreamSignal && typeof (AbortSignal as any).any === 'function'
            ? (AbortSignal as any).any([upstreamSignal, controller.signal])
            : controller.signal;

        return fetch(input, {
          ...init,
          signal: combinedSignal,
        }).finally(() => clearTimeout(timeoutId));
      },
    },
  });
}

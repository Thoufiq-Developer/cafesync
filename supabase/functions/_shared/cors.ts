// ==============================================================================
// CafeSync Edge Functions - Shared CORS Helper
// Restricts cross-origin requests to configured ALLOWED_ORIGINS.
// ==============================================================================

const DEFAULT_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3002',
];

export function getAllowedOrigins(): string[] {
  const envVal = Deno.env.get('ALLOWED_ORIGINS');
  if (!envVal || envVal.trim() === '') {
    return DEFAULT_ORIGINS;
  }
  const parsed = envVal
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return Array.from(new Set([...DEFAULT_ORIGINS, ...parsed]));
}

export function isOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    // Non-browser or server-side invocation (e.g. Next.js server action invoke)
    return true;
  }
  const allowed = getAllowedOrigins();
  const normalized = origin.trim().replace(/\/+$/, '');
  return allowed.includes(normalized);
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin');
  const allowed = getAllowedOrigins();

  let allowOrigin = allowed[0]; // fallback
  if (origin && isOriginAllowed(origin)) {
    allowOrigin = origin;
  }

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
  };
}

export function handleCors(req: Request): Response | null {
  const origin = req.headers.get('origin');
  if (origin && !isOriginAllowed(origin)) {
    return new Response(
      JSON.stringify({ error: `Origin "${origin}" is not allowed by CORS.` }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(req),
    });
  }

  return null;
}

export function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  req?: Request
): Response {
  const corsHeaders = req ? getCorsHeaders(req) : { 'Access-Control-Allow-Origin': '*' };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}


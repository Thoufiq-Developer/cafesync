// ==============================================================================
// CafeSync Edge Functions - Shared Caller Auth & Scope Verification
// ==============================================================================

import { getServiceClient } from './supabase.ts';

export interface CallerContext {
  id: string;
  email: string | null;
  role: 'master' | 'admin' | 'manager' | string;
  brandId: string | null;
  shopId: string | null;
  fullName: string;
  isActive: boolean;
}

export async function verifyCaller(req: Request): Promise<CallerContext> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing or malformed Authorization header.');
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new HttpError(401, 'Empty bearer token.');
  }

  const serviceClient = getServiceClient();

  const { data: authData, error: authError } = await serviceClient.auth.getUser(token);
  if (authError || !authData?.user) {
    throw new HttpError(401, `Invalid session or token: ${authError?.message || 'Unauthorized'}`);
  }

  const user = authData.user;

  // Load caller's profile using service client
  const { data: profile, error: profError } = await serviceClient
    .from('profiles')
    .select('id, role, brand_id, shop_id, full_name, is_active')
    .eq('id', user.id)
    .maybeSingle();

  if (profError || !profile) {
    throw new HttpError(403, 'User profile record not found.');
  }

  if (profile.is_active === false) {
    throw new HttpError(403, 'Account is inactive. Contact platform support.');
  }

  return {
    id: user.id,
    email: user.email || null,
    role: profile.role,
    brandId: profile.brand_id || null,
    shopId: profile.shop_id || null,
    fullName: profile.full_name || 'User',
    isActive: profile.is_active !== false,
  };
}

export function requirePlatformAdmin(caller: CallerContext): void {
  if (caller.role !== 'master' && caller.role !== 'platform_admin') {
    throw new HttpError(403, 'Forbidden: Platform Master credentials required.');
  }
}

export function requireBrandAdminOrPlatformAdmin(caller: CallerContext): void {
  if (caller.role === 'manager' || caller.role === 'shop_manager') {
    throw new HttpError(403, 'Forbidden: Shop Managers are not permitted to perform administrative operations.');
  }

  const isMaster = caller.role === 'master' || caller.role === 'platform_admin';
  const isAdmin = caller.role === 'admin' || caller.role === 'brand_admin';

  if (!isMaster && !isAdmin) {
    throw new HttpError(403, 'Forbidden: Insufficient privileges.');
  }

  if (isAdmin && !caller.brandId) {
    throw new HttpError(403, 'Forbidden: Brand Administrator has no assigned brand ID.');
  }
}

export function assertBrandOwnership(caller: CallerContext, targetBrandId: string): void {
  const isMaster = caller.role === 'master' || caller.role === 'platform_admin';
  if (isMaster) {
    return; // Master can manage any brand
  }

  if (caller.brandId !== targetBrandId) {
    throw new HttpError(403, 'Forbidden: You do not have permission to manage resources outside your assigned brand.');
  }
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}


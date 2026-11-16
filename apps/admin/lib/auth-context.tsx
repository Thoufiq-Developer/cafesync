'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { UserRole } from '@/lib/supabase/types';
import { DEMO_USERS, DEMO_BRAND } from '@/lib/demo-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert, Store, AlertTriangle, LogOut, ArrowRight, RefreshCw } from 'lucide-react';
import { ForcePasswordChangeModal } from '@/components/shared/force-password-change-modal';

export interface UserSessionProfile {
  id: string;
  email: string | null;
  username?: string | null;
  role: UserRole;
  brand_id: string | null;
  shop_id: string | null;
  full_name: string;
  phone?: string | null;
  is_active: boolean;
  must_change_password: boolean;
}

export interface BrandMeta {
  id: string;
  name: string;
  slug: string;
  status: 'active' | 'suspended';
  primary_color?: string;
  secondary_color?: string;
  logo_url?: string | null;
}

interface AuthContextType {
  user: { id: string; email?: string } | null;
  profile: UserSessionProfile | null;
  brand: BrandMeta | null;
  isLoading: boolean;
  isLive: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  brand: null,
  isLoading: true,
  isLive: false,
  refreshAuth: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<UserSessionProfile | null>(null);
  const [brand, setBrand] = useState<BrandMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isLive = isSupabaseConfigured();

  const loadProfile = useCallback(async (userId: string, userEmail?: string) => {
    try {
      const { data: prof, error: profErr } = await (supabase as any)
        .from('profiles')
        .select('id, role, brand_id, shop_id, full_name, phone, username, is_active, must_change_password')
        .eq('id', userId)
        .maybeSingle();

      if (profErr || !prof) {
        setUser(null);
        setProfile(null);
        setBrand(null);
        return;
      }

      setUser({ id: userId, email: userEmail });
      setProfile(prof as UserSessionProfile);

      if (prof.brand_id) {
        const { data: b } = await (supabase as any)
          .from('brands')
          .select('id, name, slug, status, primary_color, secondary_color, logo_url')
          .eq('id', prof.brand_id)
          .maybeSingle();
        if (b) setBrand(b as BrandMeta);
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    if (!isLive) {
      // Demo environment default
      const demoUsersList = Object.values(DEMO_USERS);
      const demoAdmin = demoUsersList.find((u) => u.role === 'admin') || demoUsersList[0];
      setUser({ id: demoAdmin.id, email: demoAdmin.email });
      setProfile({
        id: demoAdmin.id,
        email: demoAdmin.email,
        username: (demoAdmin as any).username || demoAdmin.email.split('@')[0],
        role: 'admin',
        brand_id: (demoAdmin as any).brandId || demoAdmin.brand?.id || DEMO_BRAND.id,
        shop_id: null,
        full_name: demoAdmin.fullName,
        phone: demoAdmin.phone,
        is_active: true,
        must_change_password: false,
      });
      setBrand({
        id: DEMO_BRAND.id,
        name: DEMO_BRAND.name,
        slug: DEMO_BRAND.slug,
        status: 'active',
        primary_color: DEMO_BRAND.primary_color,
        secondary_color: DEMO_BRAND.secondary_color,
        logo_url: DEMO_BRAND.logo_url,
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await loadProfile(session.user.id, session.user.email);
      } else {
        setUser(null);
        setProfile(null);
        setBrand(null);
      }
    } catch (err) {
      console.error('Auth refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLive, loadProfile]);

  useEffect(() => {
    refreshAuth();

    if (!isLive) return;

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        if (session?.user) {
          await loadProfile(session.user.id, session.user.email);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setBrand(null);
      }
      setIsLoading(false);
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [isLive, refreshAuth, loadProfile]);

  const signOut = async () => {
    if (isLive) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(null);
    setBrand(null);
    window.location.href = '/login/';
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        brand,
        isLoading,
        isLive,
        refreshAuth,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

// -----------------------------------------------------------------------------
// LOADING SKELETON (NO FLASH)
// -----------------------------------------------------------------------------
export function AdminAuthLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar skeleton */}
      <div className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-white p-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-slate-200 animate-pulse" />
          <div className="space-y-1.5 flex-1">
            <div className="w-24 h-4 rounded bg-slate-200 animate-pulse" />
            <div className="w-16 h-3 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
        <div className="space-y-2 pt-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-9 w-full rounded-lg bg-slate-100 animate-pulse" />
          ))}
        </div>
      </div>

      {/* Main content skeleton */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-slate-200 bg-white px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-32 h-5 rounded bg-slate-200 animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-20 h-8 rounded bg-slate-100 animate-pulse" />
            <div className="w-8 h-8 rounded-full bg-slate-200 animate-pulse" />
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6 max-w-7xl w-full mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 animate-pulse">
                <div className="w-20 h-3 bg-slate-200 rounded" />
                <div className="w-28 h-6 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
          <div className="h-72 rounded-xl border border-slate-200 bg-white p-5 animate-pulse">
            <div className="w-48 h-5 bg-slate-200 rounded mb-4" />
            <div className="h-48 w-full bg-slate-100 rounded" />
          </div>
        </main>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// REQUIRE ROLE GUARD FOR BRAND ADMIN
// -----------------------------------------------------------------------------
export function RequireRole({
  allowedRoles = ['admin', 'brand_admin', 'master', 'platform_admin'],
  children,
}: {
  allowedRoles?: string[];
  children: React.ReactNode;
}) {
  const { user, profile, brand, isLoading, signOut, refreshAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      const redirectUrl = pathname ? `/login/?redirect=${encodeURIComponent(pathname)}` : '/login/';
      router.replace(redirectUrl);
    }
  }, [isLoading, user, pathname, router]);

  if (isLoading) {
    return <AdminAuthLoadingSkeleton />;
  }

  if (!user || !profile) {
    return <AdminAuthLoadingSkeleton />;
  }

  // Inactive Account Check
  if (!profile.is_active) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-red-200 shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto mb-2">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl text-red-900">Account Deactivated</CardTitle>
            <CardDescription>
              Your administrator account has been deactivated.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-center">
            <p className="text-sm text-slate-600">
              Please contact the platform administrator to restore your access.
            </p>
            <Button variant="outline" onClick={signOut} className="w-full">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Suspended Brand Check
  if (brand?.status === 'suspended') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-amber-200 shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-2">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl text-amber-900">Brand Workspace Suspended</CardTitle>
            <CardDescription>
              The workspace for <strong>{brand.name}</strong> has been suspended.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-center">
            <p className="text-sm text-slate-600">
              Your access has been temporarily suspended by the platform administrator.
              Please reach out to support for resolution.
            </p>
            <Button variant="outline" onClick={signOut} className="w-full">
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Role Mismatch Check
  if (!allowedRoles.includes(profile.role)) {
    const shopUrl = process.env.NEXT_PUBLIC_SHOP_APP_URL || 'http://localhost:3002';
    const isManager = profile.role === 'manager';

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-amber-200 shadow-md">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-2">
              <Store className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl text-amber-900">Role Permission Notice</CardTitle>
            <CardDescription>
              You are signed in as <strong>{profile.full_name}</strong> ({profile.role}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <p className="text-sm text-slate-600 text-center">
              {isManager
                ? 'This section is reserved for Brand Administrators. Shop Managers manage day-to-day operations in the Shop Portal.'
                : 'You do not have administrative permissions to view this brand dashboard.'}
            </p>

            <div className="space-y-2 pt-2">
              {isManager && (
                <Button
                  className="w-full bg-[var(--brand-primary,#ea580c)] hover:opacity-90 text-white"
                  onClick={() => {
                    window.location.href = `${shopUrl}/shop/`;
                  }}
                >
                  <Store className="w-4 h-4 mr-2" /> Go to Shop Portal <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              <Button variant="outline" onClick={signOut} className="w-full">
                <LogOut className="w-4 h-4 mr-2" /> Sign In with Different Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      {children}
      {profile.must_change_password && (
        <ForcePasswordChangeModal
          initialRequired={true}
          userName={profile.full_name}
        />
      )}
    </>
  );
}


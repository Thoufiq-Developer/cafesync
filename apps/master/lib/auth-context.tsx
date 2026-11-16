'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { UserRole } from '@/lib/supabase/types';
import { DEMO_USERS } from '@/lib/demo-data';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ShieldAlert, Store, AlertTriangle, LogOut, ArrowRight, Loader2, Building2 } from 'lucide-react';
import { ForcePasswordChangeModal } from '@/components/shared/force-password-change-modal';

export interface UserSessionProfile {
  id: string;
  email: string | null;
  role: UserRole;
  brand_id: string | null;
  shop_id: string | null;
  full_name: string;
  username?: string | null;
  phone?: string | null;
  is_active: boolean;
  must_change_password: boolean;
}

interface AuthContextType {
  user: { id: string; email?: string } | null;
  profile: UserSessionProfile | null;
  isLoading: boolean;
  isLive: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  isLive: false,
  refreshAuth: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [profile, setProfile] = useState<UserSessionProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isLive = isSupabaseConfigured();

  const loadProfile = useCallback(async (userId: string, userEmail?: string) => {
    try {
      const { data: prof, error: profErr } = await (supabase as any)
        .from('profiles')
        .select('id, role, brand_id, shop_id, full_name, username, phone, is_active, must_change_password')
        .eq('id', userId)
        .maybeSingle();

      if (profErr || !prof) {
        setUser(null);
        setProfile(null);
        return;
      }

      setUser({ id: userId, email: userEmail });
      setProfile(prof as UserSessionProfile);
    } catch (err) {
      console.error('Failed to load master user profile:', err);
    }
  }, []);

  const refreshAuth = useCallback(async () => {
    if (!isLive) {
      // Demo environment default
      const demoUsersList = Object.values(DEMO_USERS) as any[];
      const demoMaster =
        demoUsersList.find((u) => u.role === 'master') || {
          id: 'demo-master-1',
          email: 'master@cafeledger.io',
          role: 'master',
          fullName: 'Platform Master',
          phone: '+91 99999 00000',
        };

      setUser({ id: demoMaster.id, email: demoMaster.email });
      setProfile({
        id: demoMaster.id,
        email: demoMaster.email,
        role: 'master',
        brand_id: null,
        shop_id: null,
        full_name: demoMaster.fullName,
        username: 'master',
        phone: demoMaster.phone || null,
        is_active: true,
        must_change_password: false,
      });
      setIsLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setIsLoading(false);
        return;
      }

      await loadProfile(session.user.id, session.user.email);
    } catch (err) {
      console.error('Master auth refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [isLive, loadProfile]);

  useEffect(() => {
    refreshAuth();

    if (!isLive) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await loadProfile(session.user.id, session.user.email);
      } else {
        setUser(null);
        setProfile(null);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isLive, refreshAuth, loadProfile]);

  const signOut = async () => {
    if (isLive) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('cafesync_demo_user');
    setUser(null);
    setProfile(null);
    if (typeof window !== 'undefined') {
      window.location.href = '/login/';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
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
  return useContext(AuthContext);
}

// -----------------------------------------------------------------------------
// RequireRole Route Guard
// -----------------------------------------------------------------------------
interface RequireRoleProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

export function RequireRole({
  children,
  allowedRoles = ['master'],
}: RequireRoleProps) {
  const { user, profile, isLoading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !user) {
      const redirectQuery = pathname && pathname !== '/' ? `?redirect=${encodeURIComponent(pathname)}` : '';
      router.push(`/login/${redirectQuery}`);
    }
  }, [isLoading, user, pathname, router]);

  // 1. Loading Skeleton (CafeSync Dark Espresso / Gold, zero white flash)
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#28150E] text-[#F7E5BC] flex flex-col justify-center items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-[#35201A] border border-[#4A2F25] flex items-center justify-center text-[#C68846] shadow-lg animate-pulse">
          <Building2 className="w-6 h-6" />
        </div>
        <div className="flex items-center gap-2 text-xs text-[#B9A58A]">
          <Loader2 className="h-4 w-4 animate-spin text-[#C68846]" />
          <span>Verifying platform credentials...</span>
        </div>
      </div>
    );
  }

  // 2. Unauthenticated
  if (!user || !profile) {
    return null;
  }

  // 3. Deactivated Profile Check
  if (!profile.is_active) {
    return (
      <div className="min-h-screen bg-[#28150E] text-[#F7E5BC] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-[#4A2F25] bg-[#35201A] text-[#F7E5BC] shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-red-950/80 text-red-400 flex items-center justify-center mx-auto mb-2 border border-red-800">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl text-red-200">Account Deactivated</CardTitle>
            <CardDescription className="text-[#B9A58A]">
              Your platform master account is currently inactive.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4 text-center">
            <p className="text-xs text-[#B9A58A]">
              Please contact the infrastructure administrator to reactivate your credentials.
            </p>
            <Button
              variant="outline"
              onClick={signOut}
              className="w-full border-[#4A2F25] text-[#F7E5BC] hover:bg-[#4A2F25]"
            >
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 4. Role Authorization Check (Allowed: 'master', 'platform_admin')
  const isMasterRole = profile.role === 'master' || (profile.role as string) === 'platform_admin';
  const isAllowed = isMasterRole || allowedRoles.includes(profile.role);

  if (!isAllowed) {
    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_APP_URL || 'http://localhost:3001';
    const shopUrl = process.env.NEXT_PUBLIC_SHOP_APP_URL || 'http://localhost:3002';
    const isBrandAdmin = profile.role === 'admin' || (profile.role as string) === 'brand_admin';
    const isShopManager = profile.role === 'manager';

    return (
      <div className="min-h-screen bg-[#28150E] text-[#F7E5BC] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-[#4A2F25] bg-[#35201A] text-[#F7E5BC] shadow-xl">
          <CardHeader className="text-center pb-2">
            <div className="w-12 h-12 rounded-full bg-[#4A2F25] text-[#C68846] flex items-center justify-center mx-auto mb-2">
              <Building2 className="w-6 h-6" />
            </div>
            <CardTitle className="text-xl text-[#F7E5BC]">Platform Access Notice</CardTitle>
            <CardDescription className="text-[#B9A58A]">
              You are signed in as <strong>{profile.full_name}</strong> ({profile.role}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-4">
            <p className="text-sm text-[#B9A58A] text-center">
              This application is reserved for the <strong>Platform Owner</strong> only.
              {isBrandAdmin && ' Brand Administrators manage their franchises in the Brand Admin Portal.'}
              {isShopManager && ' Shop Managers manage daily transactions in the Shop Portal.'}
            </p>

            <div className="space-y-2 pt-2">
              {isBrandAdmin && (
                <Button
                  className="w-full bg-[#C68846] hover:bg-[#D99A55] text-[#28150E] font-semibold"
                  onClick={() => {
                    window.location.href = `${adminUrl}/admin/`;
                  }}
                >
                  <Building2 className="w-4 h-4 mr-2" /> Go to Brand Admin Portal <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              {isShopManager && (
                <Button
                  className="w-full bg-[#C68846] hover:bg-[#D99A55] text-[#28150E] font-semibold"
                  onClick={() => {
                    window.location.href = `${shopUrl}/shop/`;
                  }}
                >
                  <Store className="w-4 h-4 mr-2" /> Go to Shop Portal <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              )}
              <Button
                variant="outline"
                onClick={signOut}
                className="w-full border-[#4A2F25] text-[#F7E5BC] hover:bg-[#4A2F25]"
              >
                <LogOut className="w-4 h-4 mr-2" /> Sign In with Master Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 5. Must Change Password Check
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


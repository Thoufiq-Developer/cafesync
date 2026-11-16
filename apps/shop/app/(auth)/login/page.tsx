import React from 'react';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { LoginFormClient } from './login-form';
import { PoweredByFooter } from '@/components/shared/powered-by-footer';


export default function LoginPage() {
  const isLiveSupabase = isSupabaseConfigured();

  return (
    <div className="min-h-screen flex flex-col justify-between items-center p-4 bg-gradient-to-br from-slate-100 via-white to-slate-200/70">
      <div className="w-full flex-1 flex flex-col items-center justify-center">
        <LoginFormClient isLiveSupabase={isLiveSupabase} />
      </div>

      <PoweredByFooter variant="brand" />
    </div>
  );
}

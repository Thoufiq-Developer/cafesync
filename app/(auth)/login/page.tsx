import React from 'react';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { LoginFormClient } from './login-form';

export const dynamic = 'force-dynamic';

export default function LoginPage() {
  const isLiveSupabase = isSupabaseConfigured();

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-4 bg-gradient-to-br from-slate-100 via-white to-slate-200/70">
      <LoginFormClient isLiveSupabase={isLiveSupabase} />

      <div className="mt-6 text-center text-xs text-slate-400">
        Powered by CafeLedger • ₹ en-IN | Timezone: Asia/Kolkata (IST)
      </div>
    </div>
  );
}

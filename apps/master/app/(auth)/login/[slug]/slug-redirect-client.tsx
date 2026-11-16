'use client';

import React, { useEffect } from 'react';

export function MasterSlugLoginClient() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.location.href = '/login/';
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#28150E] text-[#F7E5BC] flex items-center justify-center p-4">
      <span className="text-xs text-[#B9A58A]">Redirecting to Master Sign In...</span>
    </div>
  );
}


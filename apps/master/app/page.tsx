'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/master/');
  }, [router]);

  return (
    <div className="min-h-screen bg-[#28150E] text-[#F7E5BC] flex items-center justify-center p-4">
      <span className="text-xs text-[#B9A58A]">Loading CafeSync Master...</span>
    </div>
  );
}

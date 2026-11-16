import React from 'react';

export default function MasterLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col items-center justify-center py-8 space-y-3">
        <img
          src="/brand/cafesync-icon-192.png"
          alt="Loading CafeSync Master"
          className="h-12 w-12 object-contain animate-pulse rounded-md shadow-sm"
        />
        <p className="text-xs text-[#B9A58A] tracking-wide">Loading CafeSync Master...</p>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 animate-pulse">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-[#4A2F25] bg-[#35201A] p-4 space-y-2.5"
          >
            <div className="h-3.5 w-24 rounded bg-[#4A2F25]" />
            <div className="h-7 w-20 rounded bg-[#4A2F25]" />
            <div className="h-3 w-32 rounded bg-[#4A2F25]/60" />
          </div>
        ))}
      </div>
    </div>
  );
}


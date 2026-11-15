import React from 'react';

export default function AdminLoading() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-200">
        <div className="space-y-2">
          <div className="h-7 w-64 rounded-md bg-slate-200" />
          <div className="h-4 w-80 max-w-full rounded bg-slate-100" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-9 w-28 rounded-lg bg-slate-200" />
          <div className="h-9 w-28 rounded-lg bg-slate-100" />
        </div>
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-lg border p-4 space-y-2.5"
            style={{
              backgroundColor: 'var(--surface-card, #ffffff)',
              borderColor: 'var(--surface-border, #e2e8f0)',
            }}
          >
            <div className="h-3.5 w-24 rounded bg-slate-200" />
            <div className="h-7 w-24 rounded bg-slate-200" />
            <div className="h-3 w-32 rounded bg-slate-100" />
          </div>
        ))}
      </div>

      {/* Chart + Table Skeleton */}
      <div
        className="rounded-lg border p-4 space-y-3"
        style={{
          backgroundColor: 'var(--surface-card, #ffffff)',
          borderColor: 'var(--surface-border, #e2e8f0)',
        }}
      >
        <div className="flex items-center justify-between">
          <div className="h-5 w-52 rounded bg-slate-200" />
          <div className="h-8 w-44 rounded bg-slate-100" />
        </div>
        <div className="h-48 w-full rounded bg-slate-100" />
      </div>

      <div
        className="rounded-lg border overflow-hidden"
        style={{
          backgroundColor: 'var(--surface-card, #ffffff)',
          borderColor: 'var(--surface-border, #e2e8f0)',
        }}
      >
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="h-5 w-44 rounded bg-slate-200" />
          <div className="h-4 w-24 rounded bg-slate-100" />
        </div>
        <div className="p-4 space-y-3">
          {Array.from({ length: 4 }).map((_, idx) => (
            <div key={idx} className="h-11 w-full rounded bg-slate-100" />
          ))}
        </div>
      </div>
    </div>
  );
}


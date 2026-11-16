'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface PoweredByFooterProps {
  variant?: 'brand' | 'master';
  className?: string;
  role?: string;
}

/**
 * Universal platform footer:
 * - Brand variant (admin/shop): "Powered by CafeSync · A product of DudeX Innovations"
 * - Master variant: "Powered by DudeX Innovations"
 *
 * Rules:
 * - Non-clickable, muted text readable on background.
 * - Always last element of page content; stays at viewport bottom on short pages.
 * - Sits above mobile bottom navigation and floating action button on mobile for shop manager.
 */
export function PoweredByFooter({
  variant = 'brand',
  className,
  role,
}: PoweredByFooterProps) {
  const isMaster = variant === 'master';

  return (
    <footer
      className={cn(
        'w-full py-4 px-4 text-center text-xs select-none pointer-events-none mt-auto shrink-0',
        isMaster
          ? 'text-[#B9A58A]'
          : 'text-[var(--surface-muted-text,#64748b)] opacity-85',
        role === 'manager' && 'pb-32 md:pb-6',
        className
      )}
    >
      <p className="tracking-wide">
        {isMaster
          ? 'Powered by DudeX Innovations'
          : 'Powered by CafeSync · A product of DudeX Innovations'}
      </p>
    </footer>
  );
}


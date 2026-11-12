'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarCheck,
  FileSpreadsheet,
  Home,
  MoreHorizontal,
  PlusCircle,
  Tag,
  Users,
  Wrench,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export function ShopMobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const handleAddClick = (e: React.MouseEvent) => {
    if (pathname === '/shop') {
      e.preventDefault();
      const formEl = document.getElementById('daily-entry-form');
      if (formEl) {
        formEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        const focusTarget = formEl.querySelector(
          'input[name="amount"]'
        ) as HTMLInputElement | null;
        if (focusTarget) {
          setTimeout(() => focusTarget.focus(), 250);
        }
      }
    }
  };

  const isMoreActive =
    pathname.startsWith('/shop/items') ||
    pathname.startsWith('/shop/summary') ||
    pathname.startsWith('/shop/assets');

  return (
    <>
      <nav
        aria-label="Shop mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur-sm shadow-[0_-4px_16px_rgba(15,23,42,0.06)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-16">
          <Link
            href="/shop"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium min-h-[44px] transition-colors',
              pathname === '/shop'
                ? 'font-bold text-[var(--brand-primary,#ea580c)]'
                : 'text-slate-600'
            )}
          >
            <Home className="h-5 w-5" />
            <span>Today</span>
          </Link>

          <Link
            href="/shop#daily-entry-form"
            onClick={handleAddClick}
            className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-slate-700 min-h-[44px] hover:text-[var(--brand-primary,#ea580c)]"
          >
            <PlusCircle className="h-5 w-5 text-[var(--brand-primary,#ea580c)]" />
            <span>Add</span>
          </Link>

          <Link
            href="/shop/reports"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium min-h-[44px] transition-colors',
              pathname.startsWith('/shop/reports')
                ? 'font-bold text-[var(--brand-primary,#ea580c)]'
                : 'text-slate-600'
            )}
          >
            <FileSpreadsheet className="h-5 w-5" />
            <span>Report</span>
          </Link>

          <Link
            href="/shop/staff"
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium min-h-[44px] transition-colors',
              pathname.startsWith('/shop/staff')
                ? 'font-bold text-[var(--brand-primary,#ea580c)]'
                : 'text-slate-600'
            )}
          >
            <Users className="h-5 w-5" />
            <span>Staff</span>
          </Link>

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium min-h-[44px] cursor-pointer transition-colors',
              isMoreActive
                ? 'font-bold text-[var(--brand-primary,#ea580c)]'
                : 'text-slate-600'
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      {/* More Menu Drawer Dialog for Mobile */}
      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-w-sm rounded-lg sm:rounded-lg p-4 gap-3 bg-white">
          <DialogHeader className="text-left">
            <DialogTitle className="text-base font-bold text-slate-900">
              More Shop Screens
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-2">
            {[
              {
                title: 'Items Catalog',
                desc: 'Add or update shop items and units',
                href: '/shop/items',
                icon: Tag,
              },
              {
                title: 'Month Summary',
                desc: 'Full month cashflow, profit & category totals',
                href: '/shop/summary',
                icon: CalendarCheck,
              },
              {
                title: 'Assets & Equipment',
                desc: 'Track coffee machines, chillers & service dates',
                href: '/shop/assets',
                icon: Wrench,
              },
            ].map((item) => {
              const Icon = item.icon;
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border min-h-[56px] transition-colors',
                    active
                      ? 'border-[var(--brand-primary,#ea580c)] bg-orange-50/40'
                      : 'border-slate-200 hover:bg-slate-50'
                  )}
                >
                  <div className="h-10 w-10 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">
                      {item.title}
                    </div>
                    <div className="text-xs text-slate-500">{item.desc}</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}


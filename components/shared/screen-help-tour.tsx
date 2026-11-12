'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  CheckCircle2,
  Compass,
  HelpCircle,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { UserRole } from '@/lib/supabase/types';

interface HelpTopic {
  title: string;
  summary: string;
  tips: string[];
}

function getHelpTopic(pathname: string, role: UserRole): HelpTopic {
  if (pathname.startsWith('/shop/items') || pathname.startsWith('/admin/items')) {
    return {
      title: 'Items Catalog Help',
      summary: 'Manage all income and expense items along with default measurement units.',
      tips: [
        'Use "+ Add Item" to create a new item. We warn automatically if a similar name already exists.',
        'Admin-created items work across all shops in the brand; Manager-created items are visible to that shop only.',
        'Deactivating or renaming an item never changes old historical entries — past totals remain exact.',
      ],
    };
  }

  if (pathname.startsWith('/shop/reports') || pathname.startsWith('/admin/reports')) {
    return {
      title: 'Reports & Statements Help',
      summary: 'View financial reports on screen in A4 format or export Excel & branded PDF.',
      tips: [
        'Pick from 4 report types: Daily Summary, Item-wise Summary, Salary, or Full Report (all).',
        'In Item-wise Summary, items are grouped separately by unit (e.g. Milk (L) and Milk (packet) never mix).',
        'Click "Detail" on any row to see every individual purchase, a daily mini-chart, and single-item Excel/PDF downloads.',
      ],
    };
  }

  if (pathname.startsWith('/shop/staff') || pathname.startsWith('/admin/employees')) {
    return {
      title: 'Staff Attendance & Salary Help',
      summary: 'Record days worked, salary advances, and monthly salary payouts accurately.',
      tips: [
        'Days worked can be typed directly (including half-days like 24.5) and saved with one tap.',
        'Every Salary Advance creates an automatic SA-<Name> expense entry on today’s daily register.',
        'Net balance = Gross (Days × Daily Rate) - Advances - Paid.',
      ],
    };
  }

  if (pathname.startsWith('/admin/shops') || pathname.startsWith('/admin/users')) {
    return {
      title: 'Shops & Manager Logins Help',
      summary: 'Set up outlets and give managers simple username + password access.',
      tips: [
        'Clicking "Add Shop" takes you through Step 1 (Shop details) and Step 2 (Manager username & password).',
        'Passwords are shown once immediately after creation so you can Copy, Share on WhatsApp, or Download a PDF.',
        'Forgot a manager password later? Click "Reset Password" anytime to issue a fresh one-time password.',
      ],
    };
  }

  if (pathname.startsWith('/master')) {
    return {
      title: 'Master Console Help',
      summary: 'Onboard new franchise brands, customize themes, and inspect platform audit logs.',
      tips: [
        'Click the Bell icon in the top bar anytime to open recent cross-brand activity with filters.',
        'Open any brand and launch Brand Theme Studio to configure logos, colors, fonts, and login layouts.',
        'Use "Open as Admin" inside Theme Studio or Brand Detail to preview their portal read-only.',
      ],
    };
  }

  if (role === 'manager') {
    return {
      title: 'Daily Counter Register Help',
      summary: 'Record daily income, supplies bought, and expenses in seconds.',
      tips: [
        'Pick Income or Expense, select the item, enter the total Amount, and optionally enter Quantity + Unit (the rate per unit updates automatically).',
        'Need an item not in the dropdown? Click "+ Add new item" right inside the dropdown without leaving this screen.',
        'Edited or deleted an entry by mistake? Look for the Undo button in the popup toast right after saving.',
      ],
    };
  }

  return {
    title: 'Brand Executive Dashboard Help',
    summary: 'Track all outlets at a glance, spot missing daily entries, and monitor trends.',
    tips: [
      'Use "Overall Progress - All Shops" to switch between Income, Expense, and Profit over 7 days, 30 days, or a custom range.',
      'Click the Bell icon in the top header anytime to open recent shop & user activity without cluttering the main view.',
      'Click any shop row in the comparison table to drill into that shop’s daily ledger, staff, and reports.',
    ],
  };
}

const TOUR_STEPS: Record<'admin' | 'manager', Array<{ title: string; body: string }>> = {
  manager: [
    {
      title: '1. Fast Daily Counter Entry',
      body: 'Add every sale or purchase with total Amount and optional Quantity + Unit. The app automatically calculates your unit rate and closing cash balance.',
    },
    {
      title: '2. Quick Add Items & Undo Safety',
      body: 'Missing an item? Tap "+ Add new item" right inside the dropdown. If you ever edit or delete an entry by mistake, tap Undo in the toast notification.',
    },
    {
      title: '3. Item-wise Reports on Screen & PDF',
      body: 'Visit Reports to view Daily Summary, Item-wise Summary (with every purchase detail & mini chart), Salary, or download Excel/PDF anytime.',
    },
  ],
  admin: [
    {
      title: '1. Track All Shops & Progress Graph',
      body: 'Use the "Overall Progress - All Shops" chart to compare Income, Expense, and Profit across dates and outlets, and click the Bell icon for the live Activity drawer.',
    },
    {
      title: '2. 2-Step Shops & Manager Logins',
      body: 'Create an outlet and its manager username/password in one guided wizard. Share credentials cleanly via WhatsApp, Copy, Print, or PDF.',
    },
    {
      title: '3. Bidirectional Items & Item-wise Reports',
      body: 'Manage shared items across all shops and open consolidated Item-wise Summary reports to audit unit prices and purchases per branch.',
    },
  ],
};

export function ScreenHelpTour({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);

  const supportsTour = role === 'admin' || role === 'manager';
  const tourKey = `cafeledger_tour_done_${role}`;

  useEffect(() => {
    if (!supportsTour || typeof window === 'undefined') return;
    try {
      const done = window.localStorage.getItem(tourKey);
      if (!done) {
        const timer = setTimeout(() => {
          setTourStep(0);
          setTourOpen(true);
        }, 700);
        return () => clearTimeout(timer);
      }
    } catch {
      // ignore storage restrictions
    }
  }, [supportsTour, tourKey]);

  const finishTour = () => {
    setTourOpen(false);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(tourKey, '1');
      } catch {
        // ignore
      }
    }
  };

  const topic = getHelpTopic(pathname, role);
  const steps = supportsTour ? TOUR_STEPS[role] : [];

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setHelpOpen(true)}
        title="Screen help & quick guide"
        aria-label="Open help guide"
        className="h-9 w-9 shrink-0"
      >
        <HelpCircle className="h-4 w-4 text-slate-700" />
      </Button>

      {/* Screen Context Help Dialog */}
      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent className="max-w-md rounded-lg sm:rounded-lg bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-[var(--brand-primary,#ea580c)]" />
              <span>{topic.title}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              {topic.summary}
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2.5 py-2">
            {topic.tips.map((tip, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-2.5"
              >
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>

          <DialogFooter className="flex flex-row items-center justify-between sm:justify-between gap-2 pt-2 border-t border-slate-100">
            {supportsTour ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setHelpOpen(false);
                  setTourStep(0);
                  setTourOpen(true);
                }}
                className="text-xs gap-1.5"
              >
                <Compass className="h-3.5 w-3.5" />
                <span>Take Quick Tour</span>
              </Button>
            ) : (
              <span />
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => setHelpOpen(false)}
              className="text-white text-xs"
              style={{ backgroundColor: 'var(--brand-primary, #0f172a)' }}
            >
              Got it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Skippable 3-Step Quick Onboarding Tour */}
      {supportsTour && steps.length > 0 && (
        <Dialog
          open={tourOpen}
          onOpenChange={(open) => {
            if (!open) finishTour();
          }}
        >
          <DialogContent className="max-w-md rounded-lg sm:rounded-lg bg-white">
            <DialogHeader>
              <div className="flex items-center justify-between pr-6">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary,#ea580c)]">
                  <Sparkles className="h-3.5 w-3.5" />
                  Quick Tour • Step {tourStep + 1} of {steps.length}
                </span>
              </div>
              <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 pt-1">
                {steps[tourStep].title}
              </DialogTitle>
            </DialogHeader>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed py-1">
              {steps[tourStep].body}
            </p>

            {/* Step Dots */}
            <div className="flex items-center gap-1.5 py-1">
              {steps.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${
                    idx === tourStep
                      ? 'w-6 bg-[var(--brand-primary,#ea580c)]'
                      : 'w-2 bg-slate-200'
                  }`}
                />
              ))}
            </div>

            <DialogFooter className="flex flex-row items-center justify-between sm:justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={finishTour}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 px-2 py-2 cursor-pointer"
              >
                Skip tour
              </button>

              <div className="flex items-center gap-2">
                {tourStep > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTourStep((s) => Math.max(0, s - 1))}
                    className="min-h-[38px] text-xs"
                  >
                    Back
                  </Button>
                )}
                {tourStep < steps.length - 1 ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setTourStep((s) => s + 1)}
                    className="min-h-[38px] text-xs text-white"
                    style={{ backgroundColor: 'var(--brand-primary, #ea580c)' }}
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={finishTour}
                    className="min-h-[38px] text-xs text-white"
                    style={{ backgroundColor: 'var(--brand-primary, #ea580c)' }}
                  >
                    Finish
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}


'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { completeFirstLoginPasswordChangeAction } from '@/app/(auth)/login/password-actions';

interface ForcePasswordChangeModalProps {
  initialRequired: boolean;
  userName?: string;
}

export function ForcePasswordChangeModal({
  initialRequired,
  userName,
}: ForcePasswordChangeModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(initialRequired);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('Please enter at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsSaving(true);
    try {
      const res = await completeFirstLoginPasswordChangeAction({
        newPassword,
        confirmPassword,
      });
      if (res.success) {
        toast.success('New password saved! Welcome to CafeLedger.');
        setOpen(false);
        router.refresh();
      } else {
        toast.error(res.error || 'Could not update password');
      }
    } catch (err: any) {
      toast.error(err?.message || 'Error updating password');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-md"
        showCloseButton={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <KeyRound className="h-5 w-5 text-[var(--brand-primary,#ea580c)]" />
            <span>Set Your Own Password</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              {userName ? `Hi ${userName}, ` : ''}For security on your first sign-in (or after a reset), please create a private password before continuing.
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">New Password (min 8 characters)</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                required
                minLength={8}
                autoFocus
                placeholder="Enter a strong password you will remember"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full min-h-[44px] pl-3 pr-10 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
              <button
                type="button"
                onClick={() => setShowPass((p) => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                aria-label={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Confirm New Password</label>
            <input
              type={showPass ? 'text' : 'password'}
              required
              minLength={8}
              placeholder="Type the same password again"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
            />
          </div>

          <Button
            type="submit"
            disabled={isSaving}
            className="w-full min-h-[44px] bg-[var(--brand-primary,#ea580c)] text-white font-semibold hover:opacity-90"
          >
            {isSaving ? 'Saving Password...' : 'Save Password & Continue'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

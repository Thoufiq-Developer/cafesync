'use client';

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  KeyRound,
  Copy,
  Check,
  MessageCircle,
  Printer,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';

export interface OneTimeCredentialsPayload {
  shopName: string;
  shopCode?: string;
  managerName: string;
  loginPath: string; // e.g. /login/snaxia
  username: string;
  password: string;
}

interface CredentialsCardModalProps {
  credentials: OneTimeCredentialsPayload | null;
  onClose: () => void;
  title?: string;
}

export function CredentialsCardModal({
  credentials,
  onClose,
  title = 'Shop & Manager Credentials Ready',
}: CredentialsCardModalProps) {
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!credentials) return null;

  const origin =
    typeof window !== 'undefined' ? window.location.origin : '';
  const fullLoginUrl = credentials.loginPath.startsWith('http')
    ? credentials.loginPath
    : `${origin}${credentials.loginPath}`;

  const shareText = [
    `CafeLedger Login — ${credentials.shopName}`,
    `Manager: ${credentials.managerName}`,
    `Login link: ${fullLoginUrl}`,
    `Username: ${credentials.username}`,
    `One-time Password: ${credentials.password}`,
    `(You will be asked to choose your own password after your first sign-in.)`,
  ].join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success('Credentials copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Unable to copy automatically — please copy manually');
    }
  };

  const handleWhatsApp = () => {
    const waUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch('/api/reports/credentials-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shopName: credentials.shopName,
          shopCode: credentials.shopCode || 'SHOP',
          managerName: credentials.managerName,
          loginUrl: fullLoginUrl,
          username: credentials.username,
          temporaryPassword: credentials.password,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || 'Could not generate credentials PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${credentials.username}-credentials.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Credentials PDF downloaded');
    } catch (err: any) {
      toast.error(err?.message || 'PDF download failed');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = () => {
    const printWin = window.open('', '_blank', 'width=560,height=640');
    if (!printWin) {
      window.print();
      return;
    }
    printWin.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>${credentials.shopName} Credentials</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 28px; color: #0f172a; }
            .box { border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; max-width: 480px; }
            h2 { margin: 0 0 12px 0; font-size: 18px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
            .val { font-family: monospace; font-weight: bold; }
            .warn { margin-top: 14px; font-size: 11px; color: #92400e; background: #fffbeb; padding: 10px; border-radius: 6px; border: 1px solid #fde68a; }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>${credentials.shopName} — Login Details</h2>
            <div class="row"><span>Manager</span><span class="val">${credentials.managerName}</span></div>
            <div class="row"><span>Login Link</span><span class="val">${fullLoginUrl}</span></div>
            <div class="row"><span>Username</span><span class="val">${credentials.username}</span></div>
            <div class="row"><span>Password</span><span class="val">${credentials.password}</span></div>
            <div class="warn">Shown only once. Plain-text passwords are never stored. Change password on first login.</div>
          </div>
          <script>window.onload = function(){ window.print(); };</script>
        </body>
      </html>
    `);
    printWin.document.close();
  };

  return (
    <Dialog open={!!credentials} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <KeyRound className="h-5 w-5 text-emerald-600" />
            <span>{title}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
            <span>
              <strong>Shown only once:</strong> Please copy or download these details right now. Plain-text passwords are never stored, so you will not be able to view this password again after closing.
            </span>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
              <span className="text-xs text-slate-500">Shop</span>
              <span className="font-semibold text-slate-900 text-right">
                {credentials.shopName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
              <span className="text-xs text-slate-500">Manager</span>
              <span className="font-medium text-slate-900 text-right">
                {credentials.managerName}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
              <span className="text-xs text-slate-500 shrink-0">Login link</span>
              <span className="font-mono text-xs font-semibold text-slate-800 truncate">
                {credentials.loginPath}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
              <span className="text-xs text-slate-500">Username</span>
              <span className="font-mono text-sm font-bold text-slate-900 select-all">
                {credentials.username}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-0.5">
              <span className="text-xs text-slate-500">Password</span>
              <span className="font-mono text-sm font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-md select-all">
                {credentials.password}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="min-h-[44px] text-xs font-semibold"
            >
              {copied ? <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleWhatsApp}
              className="min-h-[44px] text-xs font-semibold text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              <MessageCircle className="h-3.5 w-3.5 mr-1" />
              <span>WhatsApp</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              className="min-h-[44px] text-xs font-semibold"
            >
              <Printer className="h-3.5 w-3.5 mr-1" />
              <span>Print</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleDownloadPdf}
              disabled={isDownloading}
              className="min-h-[44px] text-xs font-semibold"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              <span>{isDownloading ? 'PDF...' : 'PDF'}</span>
            </Button>
          </div>

          <Button
            type="button"
            onClick={onClose}
            className="w-full min-h-[44px] bg-slate-900 text-white hover:bg-slate-800"
          >
            Done — I Have Saved These Details
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

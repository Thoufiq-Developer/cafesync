'use client';

import React, { useState, useTransition } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { logAssetServiceAction } from '@/app/shop/actions';
import { getTodayKolkata, formatDate } from '@/lib/calculations/dates';
import { addDays, format } from 'date-fns';
import { toast } from 'sonner';
import { Wrench, Loader2, Calendar, CheckCircle } from 'lucide-react';

interface AssetToService {
  id: string;
  name: string;
  category: string;
  model?: string | null;
  service_interval_days?: number | null;
  vendor?: string | null;
}

interface LogServiceModalProps {
  asset: AssetToService | null;
  isOpen: boolean;
  onClose: () => void;
}

export function LogServiceModal({ asset, isOpen, onClose }: LogServiceModalProps) {
  if (!asset) return null;

  const today = getTodayKolkata();
  const defaultInterval = asset.service_interval_days || 90;
  const defaultNextDue = format(addDays(new Date(today), defaultInterval), 'yyyy-MM-dd');

  const [serviceDate, setServiceDate] = useState(today);
  const [vendor, setVendor] = useState(asset.vendor || '');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [nextDue, setNextDue] = useState(defaultNextDue);
  const [isPending, startTransition] = useTransition();

  const handleQuickInterval = (days: number) => {
    setNextDue(format(addDays(new Date(serviceDate), days), 'yyyy-MM-dd'));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vendor.trim()) {
      toast.error('Please enter the service vendor or technician name.');
      return;
    }
    if (!nextDue) {
      toast.error('Please select the next service due date.');
      return;
    }

    const formData = new FormData();
    formData.append('asset_id', asset.id);
    formData.append('service_date', serviceDate);
    formData.append('vendor', vendor);
    formData.append('cost', cost || '0');
    formData.append('notes', notes);
    formData.append('next_due', nextDue);

    startTransition(async () => {
      const res = await logAssetServiceAction(formData);
      if (res?.error) {
        toast.error(res.error);
      } else {
        toast.success(res.message || 'Service logged successfully!');
        onClose();
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md w-full">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-[var(--brand-primary,#ea580c)]" />
            <span>Log Maintenance Service: {asset.name}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {asset.model ? `Model: ${asset.model} • ` : ''}Category: {asset.category.toUpperCase()}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="srv-date" className="text-xs font-semibold text-slate-700">
                Service Date
              </Label>
              <Input
                id="srv-date"
                type="date"
                max={today}
                value={serviceDate}
                onChange={(e) => setServiceDate(e.target.value)}
                disabled={isPending}
                required
                className="h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="srv-cost" className="text-xs font-semibold text-slate-700">
                Cost (₹, optional)
              </Label>
              <Input
                id="srv-cost"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                disabled={isPending}
                className="h-10 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="srv-vendor" className="text-xs font-semibold text-slate-700">
              Technician / Service Vendor
            </Label>
            <Input
              id="srv-vendor"
              type="text"
              placeholder="e.g. Kaapi Solutions, Cooling Tech Ltd"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              disabled={isPending}
              required
              className="h-10 text-xs"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="srv-notes" className="text-xs font-semibold text-slate-700">
              Work Performed / Notes
            </Label>
            <Input
              id="srv-notes"
              type="text"
              placeholder="e.g. Descaled steam valve, replaced gasket"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isPending}
              className="h-10 text-xs"
            />
          </div>

          {/* Next Due Date & Quick Presets */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <Label htmlFor="srv-next-due" className="text-xs font-semibold text-slate-700">
                Next Service Due Date
              </Label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickInterval(30)}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
                >
                  +30d
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickInterval(60)}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
                >
                  +60d
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickInterval(90)}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
                >
                  +90d
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickInterval(180)}
                  className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded cursor-pointer"
                >
                  +180d
                </button>
              </div>
            </div>
            <Input
              id="srv-next-due"
              type="date"
              min={today}
              value={nextDue}
              onChange={(e) => setNextDue(e.target.value)}
              disabled={isPending}
              required
              className="h-10 text-xs font-semibold text-slate-800"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending}
              className="bg-[var(--brand-primary,#ea580c)] hover:opacity-90 font-semibold"
            >
              {isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" /> Logging...
                </span>
              ) : (
                'Save Service & Reset Timer'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


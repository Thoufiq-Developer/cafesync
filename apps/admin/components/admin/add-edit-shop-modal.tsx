'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  createShopWithManagerAction,
  updateShopAction,
} from '@/app/admin/actions';
import { toast } from 'sonner';
import {
  Store,
  MapPin,
  Phone,
  Hash,
  User,
  KeyRound,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { DemoShop } from '@/lib/demo-admin-data';
import {
  generateReadablePassword,
  slugifyUsername,
  suggestUsernameFromShop,
} from '@/lib/passwords';
import type { OneTimeCredentialsPayload } from './credentials-card-modal';

interface AddEditShopModalProps {
  isOpen: boolean;
  onClose: () => void;
  shop?: DemoShop | null;
  brandSlug?: string;
  onCreatedWithCredentials?: (
    createdShop: DemoShop,
    credentials: OneTimeCredentialsPayload
  ) => void;
  onShopUpdated?: (updatedShop: DemoShop) => void;
}

export function AddEditShopModal({
  isOpen,
  onClose,
  shop,
  brandSlug = 'brand',
  onCreatedWithCredentials,
  onShopUpdated,
}: AddEditShopModalProps) {
  const isEditing = !!shop;

  // Step state (only for creation wizard)
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Shop details
  const [name, setName] = useState(shop?.name || '');
  const [code, setCode] = useState(shop?.code || '');
  const [address, setAddress] = useState(shop?.address || '');
  const [phone, setPhone] = useState(shop?.phone || '');
  const [status, setStatus] = useState<'active' | 'inactive'>(
    shop?.status || 'active'
  );

  // Step 2: Manager login
  const [managerName, setManagerName] = useState('');
  const [managerPhone, setManagerPhone] = useState('');
  const [username, setUsername] = useState('');
  const [usernameManuallyEdited, setUsernameManuallyEdited] = useState(false);
  const [password, setPassword] = useState(() => generateReadablePassword());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setStep(1);
    if (shop) {
      setName(shop.name);
      setCode(shop.code);
      setAddress(shop.address || '');
      setPhone(shop.phone || '');
      setStatus(shop.status);
    } else {
      setName('');
      setCode('');
      setAddress('');
      setPhone('');
      setStatus('active');
      setManagerName('');
      setManagerPhone('');
      setUsername('');
      setUsernameManuallyEdited(false);
      setPassword(generateReadablePassword());
    }
  }, [shop, isOpen]);

  // Auto-suggest manager username from shop code (or shop name) unless edited manually
  useEffect(() => {
    if (!isEditing && !usernameManuallyEdited) {
      const suggestion = suggestUsernameFromShop(code, name);
      if (code.trim() || name.trim()) {
        setUsername(suggestion);
      }
    }
  }, [code, name, isEditing, usernameManuallyEdited]);

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) {
      toast.error('Shop name and outlet code are required');
      return;
    }
    if (!username.trim()) {
      setUsername(suggestUsernameFromShop(code, name));
    }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditing && shop) {
      if (!name.trim() || !code.trim()) {
        toast.error('Shop name and code are required');
        return;
      }
      setIsSubmitting(true);
      try {
        const res = await updateShopAction({
          shopId: shop.id,
          name,
          code,
          address,
          phone,
          status,
        });
        if (res.success) {
          toast.success(`Shop "${name}" updated`);
          onShopUpdated?.({
            ...shop,
            name: name.trim(),
            code: code.trim().toUpperCase(),
            address: address.trim(),
            phone: phone.trim(),
            status,
          });
          onClose();
        } else {
          toast.error(res.error || 'Failed to update shop');
        }
      } catch (err: any) {
        toast.error(err.message || 'Error saving shop');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Create new shop + manager login
    const cleanUser = slugifyUsername(username);
    if (!managerName.trim() || !cleanUser || password.trim().length < 8) {
      toast.error(
        'Manager name, username, and a password (min 8 characters) are required'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createShopWithManagerAction({
        name,
        code,
        address,
        phone,
        managerName,
        managerPhone,
        username: cleanUser,
        temporaryPassword: password.trim(),
      });

      if (res.success && res.data?.credentials) {
        toast.success(`Shop "${name}" and login "${cleanUser}" created`);
        onClose();
        onCreatedWithCredentials?.(res.data.shop, res.data.credentials);
      } else {
        toast.error(res.error || 'Failed to create shop and manager login');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating shop');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 text-slate-900 pr-6">
            <span className="flex items-center gap-2">
              <Store className="h-5 w-5 text-[var(--brand-primary,#ea580c)]" />
              <span>{isEditing ? 'Edit Shop Details' : 'Add New Shop'}</span>
            </span>
            {!isEditing && (
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                Step {step} of 2
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {!isEditing && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div
              className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${
                step === 1
                  ? 'border-[var(--brand-primary,#ea580c)] bg-orange-50/70 text-slate-900'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              1. Shop details
            </div>
            <div
              className={`text-xs font-semibold px-3 py-1.5 rounded-md border ${
                step === 2
                  ? 'border-[var(--brand-primary,#ea580c)] bg-orange-50/70 text-slate-900'
                  : 'border-slate-200 bg-slate-50 text-slate-500'
              }`}
            >
              2. Manager login
            </div>
          </div>
        )}

        {(isEditing || step === 1) && (
          <form
            onSubmit={isEditing ? handleSubmit : handleNextStep}
            className="space-y-4 py-1"
          >
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Shop Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Anna Nagar Outlet"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Outlet Code *</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  e.g. ANNA-NAGAR-01
                </span>
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="ANNA-NAGAR-01"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Address
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="2nd Avenue, Anna Nagar, Chennai"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Shop Phone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  placeholder="+91 98400 11001"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>
            </div>

            {isEditing && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Operating Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)] bg-white"
                >
                  <option value="active">Active (Accepting daily entries)</option>
                  <option value="inactive">Inactive / Closed</option>
                </select>
              </div>
            )}

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90"
              >
                {isEditing ? (
                  isSubmitting ? (
                    'Saving...'
                  ) : (
                    'Save Changes'
                  )
                ) : (
                  <>
                    <span>Next: Manager Login</span>
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}

        {!isEditing && step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Manager Name *
              </label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="e.g. Ravi Kumar"
                  value={managerName}
                  onChange={(e) => setManagerName(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Manager Phone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="tel"
                  placeholder="+91 98400 22001"
                  value={managerPhone}
                  onChange={(e) => setManagerPhone(e.target.value)}
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Login Username *</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Unique inside your brand
                </span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. anna-nagar-01"
                value={username}
                onChange={(e) => {
                  setUsernameManuallyEdited(true);
                  setUsername(slugifyUsername(e.target.value));
                }}
                className="w-full min-h-[44px] px-3 py-2 text-sm font-mono lowercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
              <p className="text-[11px] text-slate-500">
                Signs in at <span className="font-mono">/login/{brandSlug}</span> — no email address needed.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>One-Time Password *</span>
                <span className="text-[10px] text-amber-700 font-normal">
                  Must change on first login
                </span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPassword(generateReadablePassword())}
                  className="min-h-[44px] px-3 text-xs shrink-0"
                  title="Generate another password"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  <span>Generate again</span>
                </Button>
              </div>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="min-h-[44px]"
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                <span>Back</span>
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90"
              >
                {isSubmitting ? 'Creating...' : 'Create Shop & Login'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

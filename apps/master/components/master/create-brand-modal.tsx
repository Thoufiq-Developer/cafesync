'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Building2,
  Image as ImageIcon,
  Palette,
  Shield,
  Upload,
  CheckCircle2,
  Hash,
  MapPin,
  Lock,
  Link2,
  Paintbrush,
  ArrowRight,
} from 'lucide-react';
import { createBrandAction } from '@/app/master/actions';
import { slugifyBrandName } from '@/lib/theme/presets';
import { ImageCropModal } from '@/app/master/brands/[id]/theme/image-crop-modal';

interface CreateBrandModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function CreateBrandModal({ isOpen, onClose, onCreated }: CreateBrandModalProps) {
  // Brand Fields
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [registrationNo, setRegistrationNo] = useState(() => {
    const year = new Date().getFullYear();
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `BR-${year}-${rand}`;
  });
  const [primaryColor, setPrimaryColor] = useState('#ea580c');
  const [secondaryColor, setSecondaryColor] = useState('#9a3412');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUrl, setLogoUrl] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstin, setGstin] = useState('');

  // First Admin Account Fields
  const [adminName, setAdminName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [adminPassword, setAdminPassword] = useState('AdminPass' + Math.floor(1000 + Math.random() * 9000) + '!');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [isCropOpen, setIsCropOpen] = useState(false);
  const [createdResult, setCreatedResult] = useState<{
    brandId: string;
    brandName: string;
    slug: string;
    adminEmail: string;
    adminPass: string;
  } | null>(null);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slugTouched) {
      setSlug(val.trim() ? slugifyBrandName(val) : '');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Logo file exceeds 2MB limit. Please choose a smaller image.');
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      toast.error('Only PNG, JPG, WEBP, and SVG logo images are supported.');
      return;
    }

    if (file.type === 'image/svg+xml') {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setLogoPreview(result);
        setLogoUrl(result);
      };
      reader.readAsDataURL(file);
      return;
    }

    setCropFile(file);
    setIsCropOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !registrationNo.trim() || !adminName.trim() || !adminEmail.trim()) {
      toast.error('Brand name, registration number, and first admin credentials are required.');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading('Provisioning brand and seeding initial catalog...');
    try {
      const res = await createBrandAction({
        name,
        slug: slug.trim() || slugifyBrandName(name),
        registrationNo,
        primaryColor,
        secondaryColor,
        logoUrl: logoUrl || logoPreview || undefined,
        address,
        phone,
        email,
        gstin,
        adminName,
        adminEmail,
        adminPhone,
        adminPassword,
      });

      if (res.success) {
        toast.success(`Brand "${name}" registered with initial admin and seed catalog!`, { id: toastId });
        setCreatedResult({
          brandId: res.data?.brand?.id || '',
          brandName: name,
          slug: res.data?.brand?.slug || slug || slugifyBrandName(name),
          adminEmail: res.data?.adminEmail || adminEmail,
          adminPass: res.data?.adminPassword || adminPassword,
        });
        if (onCreated) onCreated();
      } else {
        toast.error(res.error || 'Failed to create brand', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetForm = () => {
    setName('');
    setSlug('');
    setSlugTouched(false);
    const year = new Date().getFullYear();
    setRegistrationNo(`BR-${year}-${Math.floor(1000 + Math.random() * 9000)}`);
    setPrimaryColor('#ea580c');
    setSecondaryColor('#9a3412');
    setLogoPreview(null);
    setLogoUrl('');
    setAddress('');
    setPhone('');
    setEmail('');
    setGstin('');
    setAdminName('');
    setAdminEmail('');
    setAdminPhone('');
    setAdminPassword('AdminPass' + Math.floor(1000 + Math.random() * 9000) + '!');
    setCropFile(null);
    setIsCropOpen(false);
    setCreatedResult(null);
    onClose();
  };

  return (
    <>
      <Dialog
        open={isOpen && !isCropOpen}
        onOpenChange={(open) => {
          if (!open && !isCropOpen) handleResetForm();
        }}
      >
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Building2 className="h-5 w-5 text-slate-800" />
            <span>Onboard Franchise Brand & Administrator</span>
          </DialogTitle>
        </DialogHeader>

        {createdResult ? (
          <div className="space-y-4 py-3">
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 space-y-2">
              <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                <CheckCircle2 className="h-5 w-5" />
                <span>Brand Successfully Provisioned!</span>
              </div>
              <p>
                Brand <strong>{createdResult.brandName}</strong> is now live with its starter income/expense items and payment modes.
              </p>
              <div className="p-3 bg-white rounded-lg border border-emerald-200 space-y-1 font-mono text-slate-800">
                <div>White-Label Login URL: <strong>/login/{createdResult.slug}</strong></div>
                <div>Admin Login: <strong>{createdResult.adminEmail}</strong></div>
                <div>Temporary Password: <strong>{createdResult.adminPass}</strong></div>
                <div className="text-[10px] text-amber-700 font-sans pt-1">
                  * Administrator will be prompted to change password upon first login (must_change_password=true).
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-xs font-semibold text-slate-900">Next Step: Customize Brand Look &amp; Feel</div>
              <p className="text-[11px] text-slate-600">
                Design the full white-label experience (logos, palette contrast, Google font, sidebar style, login split/centered layout, and PDF statement branding).
              </p>
              {createdResult.brandId && (
                <Link
                  href={`/master/brands/${createdResult.brandId}/theme`}
                  onClick={handleResetForm}
                  className="inline-flex items-center justify-center gap-2 w-full rounded-lg bg-slate-900 text-white hover:bg-slate-800 px-3 py-2 text-xs font-semibold transition-colors"
                >
                  <Paintbrush className="h-3.5 w-3.5" />
                  <span>Open Brand Theme Studio</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Brand Login URL: /login/${createdResult.slug}\nEmail: ${createdResult.adminEmail}\nPassword: ${createdResult.adminPass}`
                  );
                  toast.success('Admin credentials copied to clipboard');
                  handleResetForm();
                }}
                className="w-full"
              >
                Copy Credentials &amp; Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* SECTION 1: BRAND IDENTITY */}
            <div className="space-y-3 pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-500" />
                <span>1. Brand Identity &amp; Portal Slug</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Brand Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Snaxia Artisanal Cafes"
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Registration No *</span>
                    <span className="text-[10px] text-slate-400 font-normal">Auto-formatted (editable)</span>
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="BR-2026-0001"
                      value={registrationNo}
                      onChange={(e) => setRegistrationNo(e.target.value.toUpperCase())}
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Portal Slug Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <Link2 className="h-3.5 w-3.5 text-slate-400" />
                    <span>Brand Portal URL Slug *</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    /login/{slug || slugifyBrandName(name || 'brand')}
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="snaxia-cafes"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, ''));
                  }}
                  className="w-full px-3 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>

              {/* Logo Upload & Preview */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Brand Logo (PNG / JPG / WEBP / SVG, max 2MB)</label>
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <img
                      src={logoPreview}
                      alt="Logo Preview"
                      className="h-12 w-12 rounded-lg object-contain border border-slate-200 bg-white p-0.5 shadow-2xs"
                    />
                  ) : (
                    <div
                      className="h-12 w-12 rounded-lg flex items-center justify-center border border-dashed border-slate-300 text-slate-400"
                      style={{ backgroundColor: primaryColor }}
                    >
                      <ImageIcon className="h-5 w-5 text-white opacity-80" />
                    </div>
                  )}

                  <div className="flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
                        <Upload className="h-3.5 w-3.5" />
                        <span>Upload &amp; Crop Logo</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                      {cropFile && (
                        <button
                          type="button"
                          onClick={() => setIsCropOpen(true)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 cursor-pointer"
                        >
                          <span>Re-crop</span>
                        </button>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 block truncate">
                      Supports Round (Circle), Square &amp; Wide crops — or paste image URL below
                    </span>
                  </div>
                </div>

                <input
                  type="url"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => {
                    setLogoUrl(e.target.value);
                    if (e.target.value) setLogoPreview(e.target.value);
                  }}
                  className="w-full px-2.5 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none"
                />
              </div>

              {/* Brand Theme Colors */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Palette className="h-3.5 w-3.5 text-slate-400" />
                    <span>Primary Color</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-8 w-10 p-0 border border-slate-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono uppercase border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                    <Palette className="h-3.5 w-3.5 text-slate-400" />
                    <span>Secondary Color</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-8 w-10 p-0 border border-slate-300 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-full px-2 py-1 text-xs font-mono uppercase border border-slate-300 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: CORPORATE CONTACT & TAX */}
            <div className="space-y-3 pb-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-slate-500" />
                <span>2. Corporate Contact & GSTIN</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Corporate Email</label>
                  <input
                    type="email"
                    placeholder="corporate@brand.in"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98888 11111"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Registered Office Address</label>
                  <input
                    type="text"
                    placeholder="100ft Road, Indiranagar, Bengaluru"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">GSTIN</label>
                  <input
                    type="text"
                    placeholder="29AAAAA1234A1Z5"
                    value={gstin}
                    onChange={(e) => setGstin(e.target.value.toUpperCase())}
                    className="w-full px-2.5 py-1.5 text-xs font-mono uppercase border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: FIRST BRAND ADMINISTRATOR */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-slate-500" />
                <span>3. Primary Brand Administrator</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Admin Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Vikram Malhotra"
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Admin Login Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="admin@brand.in"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700">Admin Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 98888 11111"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                    <span>Temporary Password *</span>
                    <span className="text-[10px] text-amber-700">must_change_password</span>
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-[11px] text-slate-600">
              ⚡ <strong>Automatic Seeding:</strong> Default payment modes (CASH, GPAY, BANK, CARD) and starter items (Milk, Egg, Bread, Gas, Swiggy, Zomato, Billing, Salary Advance) will be automatically initialized for this brand.
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleResetForm} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-slate-900 text-white hover:bg-slate-800"
              >
                {isSubmitting ? 'Onboarding Brand...' : 'Complete Brand Onboarding'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>

      <ImageCropModal
        isOpen={isCropOpen}
        assetType="logo"
        file={cropFile}
        mode="dataUrl"
        onClose={() => setIsCropOpen(false)}
        onCroppedDataUrl={(dataUrl) => {
          setLogoPreview(dataUrl);
          setLogoUrl(dataUrl);
        }}
      />
    </>
  );
}


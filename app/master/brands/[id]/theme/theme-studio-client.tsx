'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Crop,
  ExternalLink,
  Eye,
  FileText,
  Image as ImageIcon,
  Layout,
  Layers,
  Link2,
  LogIn,
  Palette,
  Paintbrush,
  RotateCcw,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { diagnosePrimaryContrast, generateColorPalette, normalizeHex, pickReadableTextColor } from '@/lib/theme/colors';
import { CURATED_FONTS, getFontCssStack } from '@/lib/theme/font-options';
import { BRAND_PRESETS, DEFAULT_BRAND_THEME_VALUES, slugifyBrandName } from '@/lib/theme/presets';
import type { BrandIdentityMeta, BrandSettings, BrandThemeBundle, CuratedFont } from '@/lib/theme/types';
import { BrandAssetKind, ImageCropModal } from './image-crop-modal';
import { PreviewTab, StudioLivePreview } from './live-preview';
import { logThemePreviewAsAdminAction, saveBrandThemeAction } from './actions';

interface ThemeStudioClientProps {
  brand: BrandIdentityMeta;
  initialSettings: BrandSettings;
  allBrands: BrandThemeBundle[];
}

type StudioSection = 'all' | 'logo' | 'identity' | 'colors' | 'style' | 'login' | 'reports';

export function ThemeStudioClient({
  brand,
  initialSettings,
  allBrands,
}: ThemeStudioClientProps) {
  const router = useRouter();

  const [savedSlug, setSavedSlug] = useState(brand.slug);
  const [savedSettings, setSavedSettings] = useState<BrandSettings>(initialSettings);

  const [draftSlug, setDraftSlug] = useState(brand.slug);
  const [draft, setDraft] = useState<BrandSettings>(initialSettings);

  const [activeSection, setActiveSection] = useState<StudioSection>('all');
  const [previewTab, setPreviewTab] = useState<PreviewTab>('admin');
  const [duplicateBrandId, setDuplicateBrandId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Cropper state
  const [cropState, setCropState] = useState<{
    isOpen: boolean;
    assetType: BrandAssetKind;
    file: File | null;
  }>({
    isOpen: false,
    assetType: 'logo',
    file: null,
  });

  // Fullscreen "Open as this brand's admin" Read-Only Inspection Modal
  const [isReadOnlyAdminOpen, setIsReadOnlyAdminOpen] = useState(false);

  const isDirty = useMemo(() => {
    return draftSlug !== savedSlug || JSON.stringify(draft) !== JSON.stringify(savedSettings);
  }, [draftSlug, savedSlug, draft, savedSettings]);

  const palette50To900 = useMemo(
    () => generateColorPalette(draft.primary_color),
    [draft.primary_color]
  );

  const contrastDiagnostic = useMemo(
    () => diagnosePrimaryContrast(draft.primary_color, draft.default_mode),
    [draft.primary_color, draft.default_mode]
  );

  const updateDraft = <K extends keyof BrandSettings>(key: K, val: BrandSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  const handleAssetFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
    assetType: BrandAssetKind
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Asset file exceeds 2MB limit. Please choose a smaller file.');
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      toast.error('Unsupported format. Upload PNG, JPG, WEBP, or SVG.');
      return;
    }

    // Upload SVG vector files directly to keep crisp scalability
    if (file.type === 'image/svg+xml') {
      const toastId = toast.loading('Uploading SVG vector asset...');
      try {
        const normalizedKind = assetType.replace(/_/g, '-');
        const fd = new FormData();
        fd.append('brandId', brand.id);
        fd.append('kind', normalizedKind);
        fd.append('assetType', assetType);
        fd.append('file', file);
        const resp = await fetch('/api/master/brand-assets', { method: 'POST', body: fd });
        const json = await resp.json();
        if (!resp.ok || !json.url) {
          toast.error(json.error || 'SVG upload failed', { id: toastId });
          return;
        }
        applyAssetUrl(json.url, assetType);
        toast.success('SVG uploaded cleanly!', { id: toastId });
      } catch (err: any) {
        toast.error(err?.message || 'Upload failed', { id: toastId });
      }
      return;
    }

    // Raster images open interactive cropper
    setCropState({
      isOpen: true,
      assetType,
      file,
    });
  };

  const applyAssetUrl = (url: string | null, assetType: BrandAssetKind) => {
    if (assetType === 'logo') updateDraft('logo_url', url);
    else if (assetType === 'logo_dark') updateDraft('logo_dark_url', url);
    else if (assetType === 'icon') updateDraft('icon_url', url);
    else if (assetType === 'login_bg') updateDraft('login_bg_url', url);
  };

  const handleRecropExistingAsset = async (
    url: string,
    assetType: BrandAssetKind
  ) => {
    const toastId = toast.loading('Loading existing image into cropper...');
    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error('Unable to load existing image');
      }
      const blob = await resp.blob();
      const file = new File([blob], `${assetType}.png`, {
        type: blob.type || 'image/png',
      });
      toast.dismiss(toastId);
      setCropState({
        isOpen: true,
        assetType,
        file,
      });
    } catch {
      toast.error(
        'External image host restricts re-cropping. Please upload the image file via Upload & Crop.',
        { id: toastId }
      );
    }
  };

  const handleDuplicateFromBrand = () => {
    if (!duplicateBrandId) {
      toast.error('Select a source brand first.');
      return;
    }
    const source = allBrands.find((b) => b.brand.id === duplicateBrandId);
    if (!source) return;

    setDraft((prev) => ({
      ...prev,
      primary_color: source.settings.primary_color,
      secondary_color: source.settings.secondary_color,
      accent_color: source.settings.accent_color,
      font_family: source.settings.font_family,
      radius: source.settings.radius,
      sidebar_style: source.settings.sidebar_style,
      density: source.settings.density,
      default_mode: source.settings.default_mode,
      allow_user_mode_switch: source.settings.allow_user_mode_switch,
      login_layout: source.settings.login_layout,
      login_logo_size: source.settings.login_logo_size,
      login_bg_color: source.settings.login_bg_color,
      pdf_header_style: source.settings.pdf_header_style,
      pdf_show_address: source.settings.pdf_show_address,
      pdf_show_gstin: source.settings.pdf_show_gstin,
      pdf_show_registration_no: source.settings.pdf_show_registration_no,
      pdf_signature_line: source.settings.pdf_signature_line,
    }));

    toast.success(`Applied visual theme & layout tokens from "${source.brand.name}". Click Save & Apply to persist.`);
  };

  const handleResetToDefault = () => {
    setDraft((prev) => ({
      ...prev,
      ...DEFAULT_BRAND_THEME_VALUES,
      display_name: prev.display_name || brand.name,
      welcome_message: `Welcome back to ${prev.display_name || brand.name}`,
      logo_url: prev.logo_url,
      logo_dark_url: null,
      icon_url: `/api/brand-icon/${brand.id}`,
      login_bg_url: null,
    }));
    toast.info('Reset theme tokens to CafeLedger default preset. Save to apply.');
  };

  const handleDiscard = () => {
    setDraft(savedSettings);
    setDraftSlug(savedSlug);
    toast.info('Discarded unsaved edits.');
  };

  const handleSaveTheme = async () => {
    const cleanSlug = slugifyBrandName(draftSlug);
    if (!cleanSlug) {
      toast.error('Please specify a valid URL slug.');
      return;
    }

    setIsSaving(true);
    const toastId = toast.loading('Saving & publishing brand theme across all portals...');
    try {
      const res = await saveBrandThemeAction({
        brandId: brand.id,
        slug: cleanSlug,
        settings: {
          logo_url: draft.logo_url,
          logo_dark_url: draft.logo_dark_url,
          icon_url: draft.icon_url,
          login_bg_url: draft.login_bg_url,
          login_bg_color: draft.login_bg_color,
          display_name: draft.display_name,
          tagline: draft.tagline,
          welcome_message: draft.welcome_message,
          primary_color: draft.primary_color,
          secondary_color: draft.secondary_color,
          accent_color: draft.accent_color,
          font_family: draft.font_family,
          radius: draft.radius,
          sidebar_style: draft.sidebar_style,
          density: draft.density,
          default_mode: draft.default_mode,
          allow_user_mode_switch: draft.allow_user_mode_switch,
          login_layout: draft.login_layout,
          login_logo_size: draft.login_logo_size,
          pdf_header_style: draft.pdf_header_style,
          pdf_footer_text: draft.pdf_footer_text,
          pdf_show_address: draft.pdf_show_address,
          pdf_show_gstin: draft.pdf_show_gstin,
          pdf_show_registration_no: draft.pdf_show_registration_no,
          pdf_signature_line: draft.pdf_signature_line,
        },
      });

      if (!res.success) {
        toast.error(res.error || 'Failed to save theme', { id: toastId });
        return;
      }

      const nextSlug = res.slug || cleanSlug;
      const nextSettings = res.settings || draft;
      setSavedSlug(nextSlug);
      setDraftSlug(nextSlug);
      setSavedSettings(nextSettings);
      setDraft(nextSettings);

      toast.success(
        `Brand theme published for "${nextSettings.display_name}"! Admin, Manager, Login & PDF updated.`,
        { id: toastId }
      );
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message || 'Unexpected error saving theme', { id: toastId });
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenAsAdminPreview = async () => {
    const res = await logThemePreviewAsAdminAction(brand.id, brand.name);
    if (!res.success) {
      toast.error(res.error || 'Failed to log read-only admin preview');
      return;
    }
    toast.info('Read-Only Admin inspection opened & logged to audit_log.');
    setIsReadOnlyAdminOpen(true);
  };

  const otherBrands = allBrands.filter((b) => b.brand.id !== brand.id);

  const showSection = (sec: Exclude<StudioSection, 'all'>) =>
    activeSection === 'all' || activeSection === sec;

  return (
    <div className="space-y-5">
      {/* 1. STUDIO TOP HEADER BAR */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <Link href="/master/brands" className="hover:text-slate-900">
                Brand Portfolios
              </Link>
              <span>/</span>
              <Link href={`/master/brands/${brand.id}`} className="hover:text-slate-900">
                {brand.name}
              </Link>
              <span>/</span>
              <span className="font-semibold text-slate-800">Brand Theme Studio</span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <Paintbrush className="h-5 w-5 text-slate-800" />
                <span>Theme Studio: {draft.display_name || brand.name}</span>
              </h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                {brand.registration_no}
              </span>
              {isDirty && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                  Unsaved Draft
                </span>
              )}
            </div>
          </div>

          {/* Primary Toolbar Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleOpenAsAdminPreview}
              className="text-xs border-indigo-200 bg-indigo-50/70 text-indigo-800 hover:bg-indigo-100"
            >
              <Eye className="h-3.5 w-3.5 mr-1.5" />
              <span>Open as this brand&apos;s admin</span>
            </Button>

            {isDirty && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDiscard}
                className="text-xs"
              >
                Discard
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleSaveTheme}
              disabled={isSaving}
              className="bg-slate-900 text-white hover:bg-slate-800 text-xs"
            >
              <Save className="h-3.5 w-3.5 mr-1.5" />
              <span>{isSaving ? 'Saving...' : 'Save & Apply Theme'}</span>
            </Button>
          </div>
        </div>

        {/* Utility Bar: Shareable Login URL + Duplicate Theme From Another Brand + Reset */}
        <div className="pt-3 border-t border-slate-100 flex flex-col xl:flex-row xl:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-medium flex items-center gap-1">
              <Link2 className="h-3.5 w-3.5" />
              Brand Login Portal:
            </span>
            <code className="px-2 py-1 rounded bg-slate-100 font-mono text-slate-900 font-semibold">
              /login/{draftSlug}
            </code>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                navigator.clipboard.writeText(`${window.location.origin}/login/${draftSlug}`);
                toast.success('Copied login link!');
              }}
            >
              <Copy className="h-3 w-3 mr-1" />
              Copy
            </Button>
            <Link
              href={`/login/${savedSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
            >
              <span>Open</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {otherBrands.length > 0 && (
              <div className="flex items-center gap-1.5">
                <select
                  value={duplicateBrandId}
                  onChange={(e) => setDuplicateBrandId(e.target.value)}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-2.5 text-xs text-slate-700"
                >
                  <option value="">Duplicate theme from...</option>
                  {otherBrands.map((b) => (
                    <option key={b.brand.id} value={b.brand.id}>
                      {b.brand.name}
                    </option>
                  ))}
                </select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleDuplicateFromBrand}
                  disabled={!duplicateBrandId}
                >
                  Copy Theme
                </Button>
              </div>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetToDefault}
              className="h-8 text-xs text-slate-600 hover:text-slate-900"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset to default
            </Button>
          </div>
        </div>
      </div>

      {/* SECTION NAVIGATION PILLS */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { id: 'all' as const, label: 'All Sections', icon: Layers },
          { id: 'logo' as const, label: '1. Logo', icon: ImageIcon },
          { id: 'identity' as const, label: '2. Identity', icon: Sparkles },
          { id: 'colors' as const, label: '3. Colors', icon: Palette },
          { id: 'style' as const, label: '4. Style', icon: Type },
          { id: 'login' as const, label: '5. Login page', icon: LogIn },
          { id: 'reports' as const, label: '6. Reports (PDF)', icon: FileText },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveSection(item.id);
                if (item.id === 'login') setPreviewTab('login');
                else if (item.id === 'reports') setPreviewTab('pdf');
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* 2. TWO-COLUMN STUDIO WORKBENCH */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: 6 EDITOR SECTIONS */}
        <div className="xl:col-span-5 space-y-5">
          {/* SECTION 1: LOGO & PWA ICON */}
          {showSection('logo') && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-slate-700" />
                  <span>1. Brand Logos &amp; App Icon</span>
                </h2>
                <span className="text-[10px] text-slate-400">PNG, WEBP, JPG, SVG (&le;2MB)</span>
              </div>

              {(
                [
                  {
                    type: 'logo' as const,
                    title: 'Main Logo (Light Surface)',
                    hint: 'Shown in sidebar (44px), mobile header, login & PDFs. Supports Round, Square & Wide crops.',
                    val: draft.logo_url,
                  },
                  {
                    type: 'logo_dark' as const,
                    title: 'Optional Dark-Mode Logo',
                    hint: 'Used on dark sidebar or dark mode portals. Supports Round, Square & Wide crops.',
                    val: draft.logo_dark_url,
                  },
                  {
                    type: 'icon' as const,
                    title: 'App Icon / Favicon (1:1)',
                    hint: 'Round or Square 1:1 icon for collapsed sidebar, browser favicon & PWA manifest.',
                    val: draft.icon_url,
                  },
                ] as const
              ).map((slot) => (
                <div
                  key={slot.type}
                  className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {slot.val ? (
                        <img
                          src={slot.val}
                          alt={slot.title}
                          className={`h-11 ${
                            slot.type === 'icon' ? 'w-11' : 'w-16'
                          } rounded-lg object-contain border border-slate-200 p-1 ${
                            slot.type === 'logo_dark' ? 'bg-slate-900' : 'bg-white'
                          }`}
                        />
                      ) : (
                        <div
                          className="h-11 w-11 rounded-lg flex items-center justify-center font-bold text-sm"
                          style={{
                            backgroundColor: draft.primary_color,
                            color: pickReadableTextColor(draft.primary_color),
                          }}
                        >
                          {(draft.display_name || brand.name).charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="text-xs font-semibold text-slate-900">{slot.title}</div>
                        <p className="text-[11px] text-slate-500">{slot.hint}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800">
                      <Upload className="h-3 w-3" />
                      <span>Upload &amp; Crop</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={(e) => handleAssetFileSelected(e, slot.type)}
                        className="hidden"
                      />
                    </label>

                    {slot.val && (
                      <button
                        type="button"
                        onClick={() => handleRecropExistingAsset(slot.val!, slot.type)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        <Crop className="h-3 w-3" />
                        <span>Crop / Round Crop</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        applyAssetUrl(
                          slot.type === 'icon'
                            ? `/api/brand-icon/${brand.id}`
                            : `/api/brand-icon/${brand.id}?variant=logo`,
                          slot.type
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                    >
                      <Sparkles className="h-3 w-3" />
                      <span>Use Brand Monogram</span>
                    </button>

                    {slot.val && (
                      <button
                        type="button"
                        onClick={() => applyAssetUrl(null, slot.type)}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2 py-1.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Remove (Letter Avatar)</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </section>
          )}

          {/* SECTION 2: IDENTITY */}
          {showSection('identity') && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
              <div className="border-b border-slate-100 pb-2.5">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-slate-700" />
                  <span>2. Brand Identity &amp; Portal URL</span>
                </h2>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Display Name *</label>
                <input
                  type="text"
                  value={draft.display_name}
                  onChange={(e) => updateDraft('display_name', e.target.value)}
                  placeholder="Snaxia Artisanal Cafes"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                  <span>Login URL Slug *</span>
                  <button
                    type="button"
                    onClick={() => setDraftSlug(slugifyBrandName(draft.display_name || brand.name))}
                    className="text-[11px] text-slate-600 underline hover:text-slate-900 cursor-pointer"
                  >
                    Auto-generate from name
                  </button>
                </label>
                <div className="flex items-center rounded-lg border border-slate-300 overflow-hidden bg-slate-50">
                  <span className="px-2.5 py-1.5 text-xs font-mono text-slate-500 border-r border-slate-300">
                    /login/
                  </span>
                  <input
                    type="text"
                    value={draftSlug}
                    onChange={(e) =>
                      setDraftSlug(
                        e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '')
                      )
                    }
                    className="flex-1 bg-white px-2.5 py-1.5 text-xs font-mono text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Tagline</label>
                <input
                  type="text"
                  value={draft.tagline || ''}
                  onChange={(e) => updateDraft('tagline', e.target.value)}
                  placeholder="e.g. Specialty Coffee & Daily Outlet Ledger"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Welcome Message</label>
                <input
                  type="text"
                  value={draft.welcome_message || ''}
                  onChange={(e) => updateDraft('welcome_message', e.target.value)}
                  placeholder="e.g. Welcome back to Snaxia"
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
                />
              </div>
            </section>
          )}

          {/* SECTION 3: COLORS, PRESETS & CONTRAST CHECKER */}
          {showSection('colors') && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Palette className="h-4 w-4 text-slate-700" />
                  <span>3. Palette &amp; One-Click Presets</span>
                </h2>
              </div>

              {/* 8 Curated Presets */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-slate-700">Starter Presets (8 Curated Palettes)</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {BRAND_PRESETS.map((preset) => {
                    const selected =
                      normalizeHex(draft.primary_color) === normalizeHex(preset.primary_color);
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setDraft((prev) => ({
                            ...prev,
                            primary_color: preset.primary_color,
                            secondary_color: preset.secondary_color,
                            accent_color: preset.accent_color,
                            sidebar_style: preset.sidebar_style,
                            font_family: preset.font_family,
                            radius: preset.radius,
                          }));
                          toast.success(`Applied "${preset.name}" starter preset`);
                        }}
                        className={`p-2 rounded-lg border text-left transition-all cursor-pointer ${
                          selected
                            ? 'border-slate-900 ring-1 ring-slate-900 bg-slate-50'
                            : 'border-slate-200 hover:border-slate-400 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-1 mb-1">
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-black/10"
                            style={{ backgroundColor: preset.primary_color }}
                          />
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-black/10"
                            style={{ backgroundColor: preset.secondary_color }}
                          />
                          <span
                            className="h-3.5 w-3.5 rounded-full border border-black/10"
                            style={{ backgroundColor: preset.accent_color }}
                          />
                        </div>
                        <div className="text-[11px] font-bold text-slate-900 truncate">{preset.name}</div>
                        <div className="text-[9px] text-slate-500 truncate">{preset.font_family}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Hex Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { key: 'primary_color' as const, label: 'Primary' },
                  { key: 'secondary_color' as const, label: 'Secondary' },
                  { key: 'accent_color' as const, label: 'Accent' },
                ].map((c) => (
                  <div key={c.key} className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">{c.label}</label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="color"
                        value={normalizeHex(draft[c.key])}
                        onChange={(e) => updateDraft(c.key, e.target.value)}
                        className="h-8 w-9 p-0 border border-slate-300 rounded cursor-pointer shrink-0"
                      />
                      <input
                        type="text"
                        value={draft[c.key]}
                        onChange={(e) => updateDraft(c.key, e.target.value)}
                        className="w-full px-2 py-1 text-xs font-mono uppercase border border-slate-300 rounded-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Generated 50-900 Palette Strip */}
              <div className="space-y-1">
                <div className="text-[11px] font-semibold text-slate-600">Auto-Generated 50–900 Shade Ramp</div>
                <div className="grid grid-cols-10 rounded-lg overflow-hidden border border-slate-200 h-7">
                  {([50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const).map((shade) => (
                    <div
                      key={shade}
                      title={`${shade}: ${palette50To900[shade]}`}
                      style={{ backgroundColor: palette50To900[shade] }}
                      className="flex items-end justify-center text-[8px] font-mono pb-0.5"
                    >
                      <span
                        style={{
                          color: pickReadableTextColor(palette50To900[shade]),
                          opacity: 0.75,
                        }}
                      >
                        {shade}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live WCAG Contrast Diagnostic Box */}
              <div
                className={`rounded-lg border p-3 text-xs space-y-2 ${
                  contrastDiagnostic.hasWarning
                    ? 'bg-amber-50 border-amber-300 text-amber-950'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-950'
                }`}
              >
                <div className="flex items-start gap-2">
                  {contrastDiagnostic.hasWarning ? (
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 space-y-1">
                    <div className="font-bold">
                      WCAG AA Contrast Guard (Button Text: {contrastDiagnostic.buttonTextColor === '#0f172a' ? 'Dark' : 'White'} •{' '}
                      {contrastDiagnostic.buttonContrast.toFixed(1)}:1)
                    </div>
                    <p className="text-[11px] leading-relaxed">{contrastDiagnostic.summaryMessage}</p>
                  </div>
                </div>

                {contrastDiagnostic.hasWarning && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      updateDraft('primary_color', contrastDiagnostic.suggestedAccessiblePrimary);
                      toast.success(
                        `Auto-fixed Primary Color to ${contrastDiagnostic.suggestedAccessiblePrimary} for WCAG AA compliance!`
                      );
                    }}
                    className="h-7 bg-amber-900 hover:bg-amber-800 text-white text-[11px]"
                  >
                    <Wand2 className="h-3 w-3 mr-1" />
                    Auto-Fix Primary ({contrastDiagnostic.suggestedAccessiblePrimary})
                  </Button>
                )}
              </div>
            </section>
          )}

          {/* SECTION 4: STYLE (FONT, RADIUS, SIDEBAR, DENSITY, MODE) */}
          {showSection('style') && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2.5">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Type className="h-4 w-4 text-slate-700" />
                  <span>4. Typography, Corners &amp; Layout Style</span>
                </h2>
              </div>

              {/* 6 Google Fonts */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Brand Font Family (6 Curated Fonts)</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {CURATED_FONTS.map((font) => {
                    const active = draft.font_family === font.id;
                    return (
                      <button
                        key={font.id}
                        type="button"
                        onClick={() => updateDraft('font_family', font.id as CuratedFont)}
                        className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                          active
                            ? 'border-slate-900 ring-1 ring-slate-900 bg-slate-50'
                            : 'border-slate-200 hover:border-slate-400 bg-white'
                        }`}
                        style={{ fontFamily: getFontCssStack(font.id) }}
                      >
                        <div className="text-sm font-bold text-slate-900">{font.label}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">{font.vibe}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Radius & Density */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Corner Radius</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'sharp' as const, label: 'Sharp', r: 'rounded-sm' },
                        { id: 'rounded' as const, label: 'Rounded', r: 'rounded-lg' },
                        { id: 'pill' as const, label: 'Pill', r: 'rounded-full' },
                      ] as const
                    ).map((rad) => (
                      <button
                        key={rad.id}
                        type="button"
                        onClick={() => updateDraft('radius', rad.id)}
                        className={`px-2 py-2 border text-xs font-semibold transition-all cursor-pointer ${rad.r} ${
                          draft.radius === rad.id
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {rad.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Interface Density</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['comfortable', 'compact'] as const).map((den) => (
                      <button
                        key={den}
                        type="button"
                        onClick={() => updateDraft('density', den)}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold capitalize cursor-pointer ${
                          draft.density === den
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {den}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Sidebar Style */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Sidebar Appearance</label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'light' as const, label: 'Light', bg: '#ffffff', text: '#0f172a' },
                      { id: 'dark' as const, label: 'Dark Slate', bg: '#0f172a', text: '#f8fafc' },
                      {
                        id: 'brand' as const,
                        label: 'Brand Color',
                        bg: draft.primary_color,
                        text: pickReadableTextColor(draft.primary_color),
                      },
                    ] as const
                  ).map((sb) => (
                    <button
                      key={sb.id}
                      type="button"
                      onClick={() => updateDraft('sidebar_style', sb.id)}
                      className={`p-2 rounded-lg border text-xs font-semibold flex items-center gap-2 cursor-pointer ${
                        draft.sidebar_style === sb.id
                          ? 'border-slate-900 ring-1 ring-slate-900'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                    >
                      <span
                        className="h-5 w-5 rounded border border-black/15 shrink-0"
                        style={{ backgroundColor: sb.bg }}
                      />
                      <span className="truncate">{sb.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Default Light/Dark Mode + User Mode Switch */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">Default Color Mode</span>
                  <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                    {(['light', 'dark'] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => updateDraft('default_mode', m)}
                        className={`px-3 py-1 rounded-md text-xs font-semibold capitalize cursor-pointer ${
                          draft.default_mode === m
                            ? 'bg-slate-900 text-white shadow-2xs'
                            : 'text-slate-600'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.allow_user_mode_switch}
                    onChange={(e) => updateDraft('allow_user_mode_switch', e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-slate-900 rounded"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-slate-900">Allow admins &amp; managers to toggle Light/Dark mode</div>
                    <p className="text-[11px] text-slate-500">
                      Only allows personal surface mode switching; brand logos, colors and fonts stay locked.
                    </p>
                  </div>
                </label>
              </div>
            </section>
          )}

          {/* SECTION 5: LOGIN PAGE DESIGNER */}
          {showSection('login') && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2.5">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layout className="h-4 w-4 text-slate-700" />
                  <span>5. Branded Login Screen (/login/{draftSlug})</span>
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Page Layout</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(['split', 'centered'] as const).map((lay) => (
                      <button
                        key={lay}
                        type="button"
                        onClick={() => {
                          updateDraft('login_layout', lay);
                          setPreviewTab('login');
                        }}
                        className={`px-2.5 py-2 rounded-lg border text-xs font-semibold capitalize cursor-pointer ${
                          draft.login_layout === lay
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {lay}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Logo Size</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['sm', 'md', 'lg'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => {
                          updateDraft('login_logo_size', sz);
                          setPreviewTab('login');
                        }}
                        className={`px-2 py-2 rounded-lg border text-xs font-semibold uppercase cursor-pointer ${
                          draft.login_logo_size === sz
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-700">Background Tint Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={normalizeHex(draft.login_bg_color, '#fff7ed')}
                    onChange={(e) => {
                      updateDraft('login_bg_color', e.target.value);
                      setPreviewTab('login');
                    }}
                    className="h-8 w-10 p-0 border border-slate-300 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={draft.login_bg_color || '#fff7ed'}
                    onChange={(e) => updateDraft('login_bg_color', e.target.value)}
                    className="w-36 px-2.5 py-1 text-xs font-mono uppercase border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
                <div className="text-xs font-semibold text-slate-800">Optional Background Photo (16:9 Hero)</div>
                {draft.login_bg_url && (
                  <img
                    src={draft.login_bg_url}
                    alt="Login Background Preview"
                    className="w-full h-24 object-cover rounded-lg border border-slate-200"
                  />
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800">
                    <Upload className="h-3 w-3" />
                    <span>Upload &amp; Crop Background</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(e) => handleAssetFileSelected(e, 'login_bg')}
                      className="hidden"
                    />
                  </label>
                  {draft.login_bg_url && (
                    <button
                      type="button"
                      onClick={() => updateDraft('login_bg_url', null)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>Remove Image</span>
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* SECTION 6: PDF & EXCEL REPORT SETTINGS */}
          {showSection('reports') && (
            <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
              <div className="border-b border-slate-100 pb-2.5">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-slate-700" />
                  <span>6. PDF Statement Branding &amp; Excel</span>
                </h2>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">PDF Header Alignment</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['left', 'centered'] as const).map((align) => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => {
                        updateDraft('pdf_header_style', align);
                        setPreviewTab('pdf');
                      }}
                      className={`px-3 py-2 rounded-lg border text-xs font-semibold capitalize cursor-pointer ${
                        draft.pdf_header_style === align
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {align} aligned
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Custom PDF Footer Text</label>
                <input
                  type="text"
                  value={draft.pdf_footer_text || ''}
                  onChange={(e) => {
                    updateDraft('pdf_footer_text', e.target.value);
                    setPreviewTab('pdf');
                  }}
                  placeholder={`${draft.display_name} • Audited Statement`}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                {(
                  [
                    { key: 'pdf_show_address' as const, label: 'Show brand address' },
                    { key: 'pdf_show_gstin' as const, label: 'Show GSTIN number' },
                    { key: 'pdf_show_registration_no' as const, label: 'Show registration no' },
                    { key: 'pdf_signature_line' as const, label: 'Show signature block' },
                  ] as const
                ).map((tog) => (
                  <label
                    key={tog.key}
                    className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(draft[tog.key])}
                      onChange={(e) => {
                        updateDraft(tog.key, e.target.checked);
                        setPreviewTab('pdf');
                      }}
                      className="h-4 w-4 accent-slate-900 rounded"
                    />
                    <span className="font-medium text-slate-800">{tog.label}</span>
                  </label>
                ))}
              </div>

              <p className="text-[11px] text-slate-500">
                Excel (.xlsx) exports remain clean structured workbooks using <strong>{draft.display_name}</strong> in header rows and WCAG-safe contrast on primary header fills.
              </p>
            </section>
          )}
        </div>

        {/* RIGHT COLUMN: STICKY LIVE MULTI-PORTAL PREVIEW */}
        <div className="xl:col-span-7 xl:sticky xl:top-20">
          <StudioLivePreview
            brand={brand}
            slug={draftSlug || savedSlug}
            settings={draft}
            activeTab={previewTab}
            onTabChange={setPreviewTab}
          />
        </div>
      </div>

      {/* ASSET CROPPER DIALOG */}
      <ImageCropModal
        isOpen={cropState.isOpen}
        brandId={brand.id}
        assetType={cropState.assetType}
        file={cropState.file}
        onClose={() => setCropState((s) => ({ ...s, isOpen: false }))}
        onUploaded={(url, kind) => applyAssetUrl(url, kind)}
      />

      {/* "OPEN AS THIS BRAND'S ADMIN" READ-ONLY MODAL */}
      <Dialog open={isReadOnlyAdminOpen} onOpenChange={setIsReadOnlyAdminOpen}>
        <DialogContent className="sm:max-w-5xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-slate-900">
                <ShieldAlert className="h-5 w-5 text-indigo-600" />
                <span>Read-Only Admin Preview: {draft.display_name}</span>
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="rounded-lg border-2 border-indigo-500 bg-indigo-50 p-3 text-xs text-indigo-950 flex flex-wrap items-center justify-between gap-2">
            <div>
              <strong>Read-Only Inspection Mode (Logged to Audit Log):</strong> Viewing {draft.display_name} precisely as its Brand Admin sees it. Saving or modifying data is disabled here.
            </div>
            <Link
              href={`/login/${savedSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1 rounded bg-indigo-700 px-2.5 py-1 font-semibold text-white hover:bg-indigo-800"
            >
              <span>Open Branded Login</span>
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>

          <StudioLivePreview
            brand={brand}
            slug={draftSlug || savedSlug}
            settings={draft}
            activeTab="admin"
            onTabChange={() => {}}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

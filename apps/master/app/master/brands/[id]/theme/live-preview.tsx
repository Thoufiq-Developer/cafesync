'use client';

import React, { useState } from 'react';
import {
  LayoutDashboard,
  Store,
  FileText,
  Settings,
  IndianRupee,
  TrendingUp,
  TrendingDown,
  Wallet,
  Plus,
  Coffee,
  ShieldCheck,
  Monitor,
  Smartphone,
  LogIn,
  Printer,
  Sun,
  Moon,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
} from 'lucide-react';
import { buildBrandCssVariables } from '@/lib/theme/css-vars';
import { pickReadableTextColor, normalizeHex } from '@/lib/theme/colors';
import type { BrandIdentityMeta, BrandSettings } from '@/lib/theme/types';
import type { ThemeMode } from '@/lib/supabase/types';

export type PreviewTab = 'admin' | 'manager' | 'login' | 'pdf';

interface StudioLivePreviewProps {
  brand: BrandIdentityMeta;
  slug: string;
  settings: BrandSettings;
  activeTab: PreviewTab;
  onTabChange: (tab: PreviewTab) => void;
}

function BrandAvatar({
  name,
  logoUrl,
  primaryColor,
  className = 'h-9 w-9',
}: {
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  className?: string;
}) {
  if (logoUrl) {
    const heightToken =
      className.split(/\s+/).find((c) => /^h-/.test(c)) || 'h-9';
    return (
      <img
        src={logoUrl}
        alt={name}
        className={`${heightToken} max-w-[120px] w-auto object-contain shrink-0 drop-shadow-2xs`}
      />
    );
  }
  return (
    <div
      className={`${className} rounded-[var(--radius-btn,0.5rem)] flex items-center justify-center font-bold text-sm shadow-2xs`}
      style={{
        backgroundColor: primaryColor,
        color: pickReadableTextColor(primaryColor),
      }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export function StudioLivePreview({
  brand,
  slug,
  settings,
  activeTab,
  onTabChange,
}: StudioLivePreviewProps) {
  const [simulatedMode, setSimulatedMode] = useState<ThemeMode>(settings.default_mode || 'light');
  const [pdfZoom, setPdfZoom] = useState(0.9);
  const [pdfPage, setPdfPage] = useState(1);
  const totalPdfPages = 2;

  const effectiveMode: ThemeMode = settings.allow_user_mode_switch
    ? simulatedMode
    : settings.default_mode || 'light';

  const isDark = effectiveMode === 'dark';
  const cssVars = buildBrandCssVariables(settings, effectiveMode);

  const activeLogo =
    (isDark || settings.sidebar_style === 'dark') && settings.logo_dark_url
      ? settings.logo_dark_url
      : settings.logo_url;

  const isCompact = settings.density === 'compact';
  const padCard = isCompact ? 'p-2.5' : 'p-3.5';

  return (
    <div className="flex flex-col rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      {/* Preview Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'admin' as const, label: 'Admin view', icon: Monitor },
            { id: 'manager' as const, label: 'Manager view (mobile)', icon: Smartphone },
            { id: 'login' as const, label: 'Login', icon: LogIn },
            { id: 'pdf' as const, label: 'PDF', icon: Printer },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onTabChange(tab.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          {settings.allow_user_mode_switch && (
            <button
              type="button"
              onClick={() => setSimulatedMode((m) => (m === 'dark' ? 'light' : 'dark'))}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
              title="Test allowed user mode switch"
            >
              {isDark ? <Sun className="h-3 w-3 text-amber-500" /> : <Moon className="h-3 w-3" />}
              <span>{isDark ? 'Light' : 'Dark'}</span>
            </button>
          )}
          <span className="font-mono px-2 py-0.5 rounded bg-slate-200/70 text-slate-700">
            {settings.font_family} • {settings.radius}
          </span>
        </div>
      </div>

      {/* Live Preview Canvas */}
      <div className="p-3 sm:p-4 bg-slate-100/80 min-h-[540px]">
        <div
          className={`brand-portal-root rounded-xl overflow-hidden border transition-colors ${
            isCompact ? 'brand-density-compact' : ''
          }`}
          style={{
            ...(cssVars as React.CSSProperties),
            fontFamily: cssVars['--font-brand'],
            backgroundColor: 'var(--surface-bg)',
            color: 'var(--surface-text)',
            borderColor: 'var(--surface-border)',
          }}
        >
          {/* TAB 1: ADMIN VIEW */}
          {activeTab === 'admin' && (
            <div className="flex min-h-[500px]">
              {/* Simulated Brand Sidebar */}
              <aside
                className="w-48 shrink-0 flex flex-col justify-between p-3 border-r hidden sm:flex"
                style={{
                  backgroundColor: 'var(--sidebar-bg)',
                  color: 'var(--sidebar-text)',
                  borderColor: 'var(--sidebar-border)',
                }}
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2 pb-2 border-b" style={{ borderColor: 'var(--sidebar-border)' }}>
                    <BrandAvatar
                      name={settings.display_name}
                      logoUrl={activeLogo}
                      primaryColor={settings.primary_color}
                      className="h-9 w-9 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{settings.display_name}</div>
                      <div className="text-[10px] truncate" style={{ color: 'var(--sidebar-muted-text)' }}>
                        Brand Admin
                      </div>
                    </div>
                  </div>

                  <nav className="space-y-1 text-xs">
                    {[
                      { label: 'Brand Dashboard', icon: LayoutDashboard, active: true },
                      { label: 'Shops & Managers', icon: Store, active: false },
                      { label: 'Consolidated Reports', icon: FileText, active: false },
                      { label: 'Settings', icon: Settings, active: false },
                    ].map((item) => {
                      const Icon = item.icon;
                      return (
                        <div
                          key={item.label}
                          className="flex items-center gap-2 px-2.5 py-2 rounded-[var(--radius-btn,0.5rem)] font-medium"
                          style={
                            item.active
                              ? {
                                  backgroundColor: 'var(--sidebar-active-bg)',
                                  color: 'var(--sidebar-active-text)',
                                  fontWeight: 600,
                                }
                              : { color: 'var(--sidebar-text)' }
                          }
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </div>
                      );
                    })}
                  </nav>
                </div>

                <div className="pt-2 border-t text-[9px] text-center opacity-70" style={{ borderColor: 'var(--sidebar-border)' }}>
                  Powered by CafeLedger
                </div>
              </aside>

              {/* Simulated Admin Main Workspace */}
              <div className="flex-1 flex flex-col justify-between p-4 space-y-4">
                <div className="space-y-3">
                  {/* Gradient Brand Banner */}
                  <div
                    className="rounded-[var(--radius-card,0.75rem)] p-3.5 shadow-xs flex items-center justify-between gap-3"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${settings.primary_color}, ${settings.secondary_color})`,
                      color: cssVars['--brand-banner-foreground'],
                    }}
                  >
                    <div>
                      <div className="text-sm font-bold">{settings.display_name}</div>
                      <div className="text-[11px] opacity-90">
                        {settings.welcome_message || `Welcome back to ${settings.display_name}`}
                        {settings.tagline ? ` • ${settings.tagline}` : ''}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="px-3 py-1.5 text-[11px] font-semibold rounded-[var(--radius-btn,0.5rem)] shadow-2xs shrink-0"
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.2)',
                        color: cssVars['--brand-banner-foreground'],
                      }}
                    >
                      + New Outlet
                    </button>
                  </div>

                  {/* KPI Row */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: 'Total Income', val: '₹4,82,900', icon: TrendingUp, color: 'text-emerald-600' },
                      { label: 'Total Expenses', val: '₹2,14,350', icon: TrendingDown, color: 'text-rose-600' },
                      { label: 'Net Cash Profit', val: '₹2,68,550', icon: Wallet, highlight: true },
                    ].map((kpi) => {
                      const Icon = kpi.icon;
                      return (
                        <div
                          key={kpi.label}
                          className={`${padCard} rounded-[var(--radius-card,0.75rem)] border shadow-2xs`}
                          style={{
                            backgroundColor: kpi.highlight ? 'var(--brand-50)' : 'var(--surface-card)',
                            borderColor: kpi.highlight ? 'var(--brand-200)' : 'var(--surface-border)',
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-medium" style={{ color: 'var(--surface-muted-text)' }}>
                              {kpi.label}
                            </span>
                            <Icon className="h-3.5 w-3.5" style={{ color: 'var(--brand-ink)' }} />
                          </div>
                          <div
                            className={`text-sm font-bold mt-1 ${kpi.color || ''}`}
                            style={kpi.highlight ? { color: 'var(--brand-ink)' } : undefined}
                          >
                            {kpi.val}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Chart + Table Preview */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div
                      className={`${padCard} rounded-[var(--radius-card,0.75rem)] border`}
                      style={{
                        backgroundColor: 'var(--surface-card)',
                        borderColor: 'var(--surface-border)',
                      }}
                    >
                      <div className="text-xs font-bold mb-2">Outlet Revenue vs Expense</div>
                      <div className="space-y-2 text-[10px]">
                        {[
                          { shop: 'Flagship', inc: 86, exp: 42 },
                          { shop: 'Airport', inc: 68, exp: 35 },
                          { shop: 'Downtown', inc: 54, exp: 28 },
                        ].map((bar) => (
                          <div key={bar.shop} className="space-y-1">
                            <div className="flex justify-between">
                              <span>{bar.shop}</span>
                              <span style={{ color: 'var(--surface-muted-text)' }}>₹{(bar.inc * 1.4).toFixed(0)}k</span>
                            </div>
                            <div className="flex gap-1 h-2">
                              <div
                                className="rounded-full"
                                style={{ width: `${bar.inc}%`, backgroundColor: 'var(--chart-1)' }}
                              />
                              <div
                                className="rounded-full"
                                style={{ width: `${bar.exp}%`, backgroundColor: 'var(--chart-3)' }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div
                      className={`${padCard} rounded-[var(--radius-card,0.75rem)] border flex flex-col justify-between`}
                      style={{
                        backgroundColor: 'var(--surface-card)',
                        borderColor: 'var(--surface-border)',
                      }}
                    >
                      <div>
                        <div className="text-xs font-bold mb-2">Interactive Controls Preview</div>
                        <div className="rounded-[var(--radius-btn,0.5rem)] overflow-hidden border" style={{ borderColor: 'var(--surface-border)' }}>
                          <div
                            className="grid grid-cols-2 px-2.5 py-1.5 text-[10px] font-bold uppercase"
                            style={{
                              backgroundColor: 'var(--table-header-bg)',
                              color: 'var(--table-header-text)',
                            }}
                          >
                            <span>Outlet</span>
                            <span className="text-right">Closing</span>
                          </div>
                          <div className="grid grid-cols-2 px-2.5 py-1.5 text-[11px] border-t" style={{ borderColor: 'var(--surface-border)' }}>
                            <span>Main Branch</span>
                            <span className="text-right font-mono font-semibold">₹48,250</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-3">
                        <button
                          type="button"
                          className="flex-1 px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-btn,0.5rem)]"
                          style={{
                            backgroundColor: 'var(--brand-primary)',
                            color: 'var(--brand-primary-foreground)',
                          }}
                        >
                          Primary Action
                        </button>
                        <button
                          type="button"
                          className="px-3 py-1.5 text-xs font-semibold rounded-[var(--radius-btn,0.5rem)]"
                          style={{
                            backgroundColor: 'var(--brand-accent)',
                            color: 'var(--brand-accent-foreground)',
                          }}
                        >
                          Accent
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t text-[10px] flex justify-between opacity-65" style={{ borderColor: 'var(--surface-border)' }}>
                  <span>{settings.display_name} • Admin Console</span>
                  <span>Powered by CafeLedger</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANAGER VIEW (MOBILE 375px) */}
          {activeTab === 'manager' && (
            <div className="py-4 px-2 flex justify-center">
              <div
                className="w-[375px] max-w-full rounded-[2rem] border-4 border-slate-800 shadow-xl overflow-hidden flex flex-col"
                style={{
                  backgroundColor: 'var(--surface-bg)',
                  color: 'var(--surface-text)',
                }}
              >
                {/* Mobile Top Header */}
                <div
                  className="px-3.5 py-2.5 border-b flex items-center justify-between"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    borderColor: 'var(--surface-border)',
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <BrandAvatar
                      name={settings.display_name}
                      logoUrl={isDark && settings.logo_dark_url ? settings.logo_dark_url : settings.logo_url}
                      primaryColor={settings.primary_color}
                      className="h-9 w-9 shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">
                        {settings.display_name} - Flagship Outlet
                      </div>
                      <div className="text-[10px]" style={{ color: 'var(--surface-muted-text)' }}>
                        Daily Entry • ₹ en-IN
                      </div>
                    </div>
                  </div>
                </div>

                {/* Mobile Content */}
                <div className="p-3 space-y-3">
                  {/* Live Balance Strip */}
                  <div
                    className="rounded-[var(--radius-card,0.75rem)] p-3 flex items-center justify-between"
                    style={{
                      backgroundImage: `linear-gradient(135deg, ${settings.primary_color}, ${settings.secondary_color})`,
                      color: cssVars['--brand-banner-foreground'],
                    }}
                  >
                    <div>
                      <div className="text-[10px] uppercase opacity-80">Closing Cash Balance</div>
                      <div className="text-lg font-bold flex items-center gap-0.5">
                        <IndianRupee className="h-4 w-4" />
                        <span>38,450</span>
                      </div>
                    </div>
                    <div className="text-right text-[10px] space-y-0.5">
                      <div>Income: +₹24,200</div>
                      <div>Expense: -₹5,950</div>
                    </div>
                  </div>

                  {/* Quick Entry Form Card */}
                  <div
                    className={`${padCard} rounded-[var(--radius-card,0.75rem)] border space-y-2.5`}
                    style={{
                      backgroundColor: 'var(--surface-card)',
                      borderColor: 'var(--surface-border)',
                    }}
                  >
                    <div className="text-xs font-bold">Fast Daily Entry</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div
                        className="px-2.5 py-1.5 text-xs border rounded-[var(--radius-input,0.5rem)]"
                        style={{ borderColor: 'var(--surface-border)' }}
                      >
                        Counter Billing
                      </div>
                      <div
                        className="px-2.5 py-1.5 text-xs border rounded-[var(--radius-input,0.5rem)] text-right font-mono"
                        style={{ borderColor: 'var(--surface-border)' }}
                      >
                        ₹ 4,500
                      </div>
                    </div>
                    <div className="flex gap-1.5 text-[10px]">
                      {['CASH', 'GPAY', 'CARD'].map((mop, idx) => (
                        <span
                          key={mop}
                          className="px-2.5 py-1 rounded-[var(--radius-btn,0.5rem)] font-semibold border"
                          style={
                            idx === 0
                              ? {
                                  backgroundColor: 'var(--brand-primary)',
                                  color: 'var(--brand-primary-foreground)',
                                  borderColor: 'var(--brand-primary)',
                                }
                              : {
                                  borderColor: 'var(--surface-border)',
                                  color: 'var(--surface-text)',
                                }
                          }
                        >
                          {mop}
                        </span>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="w-full py-2 text-xs font-semibold rounded-[var(--radius-btn,0.5rem)] flex items-center justify-center gap-1.5"
                      style={{
                        backgroundColor: 'var(--brand-primary)',
                        color: 'var(--brand-primary-foreground)',
                      }}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add Income Entry</span>
                    </button>
                  </div>

                  {/* Recent entries preview */}
                  <div
                    className={`${padCard} rounded-[var(--radius-card,0.75rem)] border space-y-1.5 text-xs`}
                    style={{
                      backgroundColor: 'var(--surface-card)',
                      borderColor: 'var(--surface-border)',
                    }}
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">Zomato Payout</span>
                      <span className="font-mono font-semibold text-emerald-600">+₹6,420</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Fresh Milk 20L</span>
                      <span className="font-mono font-semibold text-rose-600">-₹1,240</span>
                    </div>
                  </div>
                </div>

                <div className="px-3.5 py-2 border-t text-[10px] text-center opacity-60" style={{ borderColor: 'var(--surface-border)' }}>
                  Powered by CafeLedger
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BRAND LOGIN PREVIEW */}
          {activeTab === 'login' && (
            <div
              className="min-h-[480px] p-4 flex flex-col justify-center items-center relative overflow-hidden"
              style={
                settings.login_layout === 'centered' && settings.login_bg_url
                  ? {
                      backgroundImage: `linear-gradient(rgba(15,23,42,0.55), rgba(15,23,42,0.65)), url(${settings.login_bg_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : {
                      backgroundColor:
                        settings.login_bg_color ||
                        (settings.default_mode === 'dark' ? '#0b1120' : cssVars['--brand-50']),
                    }
              }
            >
              {settings.login_layout === 'split' ? (
                <div className="w-full max-w-3xl grid grid-cols-1 sm:grid-cols-2 rounded-[var(--radius-card,0.75rem)] overflow-hidden shadow-lg border" style={{ borderColor: 'var(--surface-border)' }}>
                  {/* Left Hero Panel */}
                  <div
                    className="p-6 flex flex-col justify-between min-h-[300px]"
                    style={
                      settings.login_bg_url
                        ? {
                            backgroundImage: `linear-gradient(160deg, rgba(15,23,42,0.6), rgba(15,23,42,0.78)), url(${settings.login_bg_url})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            color: '#ffffff',
                          }
                        : {
                            backgroundImage: `linear-gradient(135deg, ${settings.primary_color}, ${settings.secondary_color})`,
                            color: cssVars['--brand-banner-foreground'],
                          }
                    }
                  >
                    <BrandAvatar
                      name={settings.display_name}
                      logoUrl={activeLogo}
                      primaryColor={settings.primary_color}
                      className={
                        settings.login_logo_size === 'lg'
                          ? 'h-14 w-14'
                          : settings.login_logo_size === 'sm'
                          ? 'h-8 w-8'
                          : 'h-11 w-11'
                      }
                    />
                    <div className="space-y-1">
                      <div className="text-lg font-bold">{settings.display_name}</div>
                      {settings.tagline && <div className="text-xs opacity-90">{settings.tagline}</div>}
                    </div>
                    <div className="text-[10px] opacity-75">/login/{slug}</div>
                  </div>

                  {/* Right Sign-in Form */}
                  <div
                    className="p-6 space-y-3 flex flex-col justify-center"
                    style={{
                      backgroundColor: 'var(--surface-card)',
                      color: 'var(--surface-text)',
                    }}
                  >
                    <div>
                      <div className="text-sm font-bold">{settings.welcome_message || `Sign in to ${settings.display_name}`}</div>
                      <div className="text-[11px]" style={{ color: 'var(--surface-muted-text)' }}>
                        Brand Admin &amp; Outlet Managers
                      </div>
                    </div>
                    <div className="space-y-2 text-xs">
                      <div className="px-3 py-2 border rounded-[var(--radius-input,0.5rem)]" style={{ borderColor: 'var(--surface-border)', color: 'var(--surface-muted-text)' }}>
                        staff@{slug}.in
                      </div>
                      <div className="px-3 py-2 border rounded-[var(--radius-input,0.5rem)]" style={{ borderColor: 'var(--surface-border)', color: 'var(--surface-muted-text)' }}>
                        ••••••••
                      </div>
                      <button
                        type="button"
                        className="w-full py-2 font-semibold rounded-[var(--radius-btn,0.5rem)]"
                        style={{
                          backgroundColor: 'var(--brand-primary)',
                          color: 'var(--brand-primary-foreground)',
                        }}
                      >
                        Sign In to {settings.display_name}
                      </button>
                    </div>
                    <div className="text-[10px] text-center opacity-60 pt-1">Powered by CafeLedger</div>
                  </div>
                </div>
              ) : (
                <div
                  className="w-full max-w-sm rounded-[var(--radius-card,0.75rem)] border p-6 shadow-xl space-y-4"
                  style={{
                    backgroundColor: 'var(--surface-card)',
                    color: 'var(--surface-text)',
                    borderColor: 'var(--surface-border)',
                  }}
                >
                  <div className="flex flex-col items-center text-center gap-2">
                    <BrandAvatar
                      name={settings.display_name}
                      logoUrl={activeLogo}
                      primaryColor={settings.primary_color}
                      className={
                        settings.login_logo_size === 'lg'
                          ? 'h-16 w-16'
                          : settings.login_logo_size === 'sm'
                          ? 'h-9 w-9'
                          : 'h-12 w-12'
                      }
                    />
                    <div className="text-base font-bold">{settings.display_name}</div>
                    {settings.tagline && (
                      <div className="text-[11px]" style={{ color: 'var(--surface-muted-text)' }}>
                        {settings.tagline}
                      </div>
                    )}
                    <div className="text-xs font-medium">{settings.welcome_message}</div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="px-3 py-2 border rounded-[var(--radius-input,0.5rem)]" style={{ borderColor: 'var(--surface-border)', color: 'var(--surface-muted-text)' }}>
                      staff@{slug}.in
                    </div>
                    <div className="px-3 py-2 border rounded-[var(--radius-input,0.5rem)]" style={{ borderColor: 'var(--surface-border)', color: 'var(--surface-muted-text)' }}>
                      ••••••••
                    </div>
                    <button
                      type="button"
                      className="w-full py-2 font-semibold rounded-[var(--radius-btn,0.5rem)]"
                      style={{
                        backgroundColor: 'var(--brand-primary)',
                        color: 'var(--brand-primary-foreground)',
                      }}
                    >
                      Sign In
                    </button>
                  </div>
                  <div className="text-[10px] text-center opacity-60">Powered by CafeLedger</div>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: PDF HEADER & FOOTER PREVIEW (A4 Portrait Page) */}
          {activeTab === 'pdf' && (
            <div className="bg-slate-200/80 flex flex-col">
              {/* A4 Preview Controls Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white border-b border-slate-200 px-3 py-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPdfZoom((z) => Math.max(0.65, Number((z - 0.1).toFixed(2))))}
                    className="no-brand-radius h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 cursor-pointer"
                    title="Zoom out"
                  >
                    <ZoomOut className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-mono font-semibold text-slate-700 min-w-[42px] text-center">
                    {Math.round(pdfZoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => setPdfZoom((z) => Math.min(1.25, Number((z + 0.1).toFixed(2))))}
                    className="no-brand-radius h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 cursor-pointer"
                    title="Zoom in"
                  >
                    <ZoomIn className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={pdfPage <= 1}
                    onClick={() => setPdfPage((p) => Math.max(1, p - 1))}
                    className="no-brand-radius h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  {[1, 2].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPdfPage(p)}
                      className={`no-brand-radius h-7 px-2 rounded text-[11px] font-semibold cursor-pointer ${
                        pdfPage === p ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={pdfPage >= totalPdfPages}
                    onClick={() => setPdfPage((p) => Math.min(totalPdfPages, p + 1))}
                    className="no-brand-radius h-7 w-7 inline-flex items-center justify-center rounded border border-slate-200 bg-slate-50 text-slate-700 disabled:opacity-40 cursor-pointer"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="no-brand-radius ml-1 inline-flex items-center gap-1 h-7 px-2.5 rounded text-white font-semibold cursor-pointer"
                    style={{ backgroundColor: normalizeHex(settings.primary_color) }}
                  >
                    <Download className="h-3 w-3" />
                    <span>Sample A4</span>
                  </button>
                </div>
              </div>

              {/* Scrollable A4 Portrait Paper Canvas */}
              <div className="p-4 sm:p-6 overflow-auto max-h-[540px] flex justify-center items-start">
                <div
                  className="pdf-preview-sheet bg-white text-slate-900 shadow-[0_10px_30px_rgba(15,23,42,0.14)] border border-slate-300 flex flex-col justify-between font-sans shrink-0 transition-[width] duration-150"
                  style={{
                    width: `${Math.round(480 * pdfZoom)}px`,
                    minHeight: `${Math.round(480 * pdfZoom * 1.4142)}px`,
                    aspectRatio: '1 / 1.4142',
                    borderRadius: '6px',
                    padding: `${Math.round(24 * pdfZoom)}px`,
                  }}
                >
                  <div className="space-y-4">
                    {/* PDF Header */}
                    <div
                      className={`pb-3 border-b-2 flex ${
                        settings.pdf_header_style === 'centered'
                          ? 'flex-col items-center text-center gap-2'
                          : 'flex-row items-center justify-between gap-3'
                      }`}
                      style={{ borderColor: settings.primary_color }}
                    >
                      <div
                        className={`flex items-center gap-3 ${
                          settings.pdf_header_style === 'centered' ? 'flex-col text-center' : ''
                        }`}
                      >
                        <BrandAvatar
                          name={settings.display_name}
                          logoUrl={settings.logo_url}
                          primaryColor={settings.primary_color}
                          className="h-11 w-11 shrink-0 no-brand-radius rounded-md"
                        />
                        <div>
                          <div className="text-base font-bold" style={{ color: settings.primary_color }}>
                            {settings.display_name}
                          </div>
                          <div className="text-[10px] text-slate-500 space-x-1.5">
                            {settings.pdf_show_registration_no && <span>Reg: {brand.registration_no}</span>}
                            {settings.pdf_show_gstin && brand.gstin && <span>| GSTIN: {brand.gstin}</span>}
                          </div>
                          {settings.pdf_show_address && brand.address && (
                            <div className="text-[9px] text-slate-400 mt-0.5">{brand.address}</div>
                          )}
                        </div>
                      </div>

                      <div className={settings.pdf_header_style === 'centered' ? 'text-center' : 'text-right'}>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-slate-800">
                          {pdfPage === 1 ? 'Financial Statement' : 'Item-wise Summary'}
                        </div>
                        <div className="text-[9px] text-slate-500">01-11-2026 to 30-11-2026</div>
                      </div>
                    </div>

                    {pdfPage === 1 ? (
                      <>
                        {/* Summary KPI Strip */}
                        <div className="grid grid-cols-3 gap-2 text-[10px]">
                          <div className="p-2 rounded border border-slate-200 bg-slate-50">
                            <div className="text-[9px] uppercase text-slate-500">Total Income</div>
                            <div className="font-bold text-emerald-700 mt-0.5">₹2,48,000.00</div>
                          </div>
                          <div className="p-2 rounded border border-slate-200 bg-slate-50">
                            <div className="text-[9px] uppercase text-slate-500">Total Expense</div>
                            <div className="font-bold text-rose-700 mt-0.5">₹1,12,000.00</div>
                          </div>
                          <div className="p-2 rounded border border-slate-200 bg-slate-50">
                            <div className="text-[9px] uppercase text-slate-500">Net Profit</div>
                            <div className="font-bold text-slate-900 mt-0.5">₹1,36,000.00</div>
                          </div>
                        </div>

                        {/* PDF Sample Table */}
                        <div className="border border-slate-200 rounded-[4px] overflow-hidden text-[10px]">
                          <div
                            className="grid grid-cols-4 px-2.5 py-1.5 font-bold"
                            style={{
                              backgroundColor: normalizeHex(settings.primary_color),
                              color: pickReadableTextColor(settings.primary_color),
                            }}
                          >
                            <span>Outlet / Date</span>
                            <span className="text-right">Income</span>
                            <span className="text-right">Expense</span>
                            <span className="text-right">Net</span>
                          </div>
                          <div className="grid grid-cols-4 px-2.5 py-1.5 border-t border-slate-100">
                            <span>Main Cafe Outlet</span>
                            <span className="text-right text-emerald-700">₹2,48,000</span>
                            <span className="text-right text-rose-700">₹1,12,000</span>
                            <span className="text-right font-bold">₹1,36,000</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="border border-slate-200 rounded-[4px] overflow-hidden text-[10px]">
                        <div
                          className="grid grid-cols-4 px-2.5 py-1.5 font-bold"
                          style={{
                            backgroundColor: normalizeHex(settings.primary_color),
                            color: pickReadableTextColor(settings.primary_color),
                          }}
                        >
                          <span>Item</span>
                          <span className="text-right">Total Qty</span>
                          <span className="text-right">Purchases</span>
                          <span className="text-right">Amount</span>
                        </div>
                        <div className="grid grid-cols-4 px-2.5 py-1.5 border-t border-slate-100">
                          <span>Milk (Dairy)</span>
                          <span className="text-right">120 L</span>
                          <span className="text-right">14</span>
                          <span className="text-right font-bold">₹7,440</span>
                        </div>
                        <div className="grid grid-cols-4 px-2.5 py-1.5 border-t border-slate-100 bg-slate-50">
                          <span>Coffee Beans</span>
                          <span className="text-right">18 kg</span>
                          <span className="text-right">4</span>
                          <span className="text-right font-bold">₹16,200</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Bottom Signature & Running Footer */}
                  <div className="space-y-3 pt-4">
                    {settings.pdf_signature_line && (
                      <div className="pt-4 flex justify-end">
                        <div className="w-40 border-t border-slate-400 pt-1 text-center text-[9px] text-slate-500">
                          Authorized Signatory ({settings.display_name})
                        </div>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[9px] text-slate-400">
                      <span>
                        {settings.pdf_footer_text || `${settings.display_name} • Powered by CafeLedger`}
                      </span>
                      <span>Page {pdfPage} of {totalPdfPages}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


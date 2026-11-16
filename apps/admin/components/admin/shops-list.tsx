'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Store,
  Plus,
  Search,
  MapPin,
  Phone,
  Users,
  Edit,
  Power,
  Trash2,
  ChevronRight,
  KeyRound,
  UserPlus,
  FileDown,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DemoShop } from '@/lib/demo-admin-data';
import { AddEditShopModal } from './add-edit-shop-modal';
import {
  CredentialsCardModal,
  OneTimeCredentialsPayload,
} from './credentials-card-modal';
import {
  toggleShopStatusAction,
  deleteShopAction,
  createManagerUserAction,
  resetManagerPasswordAction,
  toggleUserStatusAction,
} from '@/app/admin/actions';
import { toast } from 'sonner';
import { formatINR } from '@/lib/calculations/currency';
import {
  generateReadablePassword,
  slugifyUsername,
  suggestUsernameFromShop,
} from '@/lib/passwords';

interface ShopsListProps {
  initialShops: DemoShop[];
  brandSlug?: string;
}

export function ShopsList({ initialShops, brandSlug = 'brand' }: ShopsListProps) {
  const router = useRouter();
  const [shops, setShops] = useState<DemoShop[]>(initialShops);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingShop, setEditingShop] = useState<DemoShop | null>(null);

  // One-time Credentials Card popup
  const [credentialsToShow, setCredentialsToShow] =
    useState<OneTimeCredentialsPayload | null>(null);

  // Add Another Manager modal for an existing shop
  const [addMgrShop, setAddMgrShop] = useState<DemoShop | null>(null);
  const [mgrName, setMgrName] = useState('');
  const [mgrPhone, setMgrPhone] = useState('');
  const [mgrUsername, setMgrUsername] = useState('');
  const [mgrPassword, setMgrPassword] = useState('');
  const [isAddingMgr, setIsAddingMgr] = useState(false);

  // Sync props cleanly across router.refresh()
  useEffect(() => {
    setShops(initialShops);
  }, [initialShops]);

  const filteredShops = shops.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.managers || []).some(
        (m) =>
          m.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (m.username || '').toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchesStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleToggleStatus = async (shop: DemoShop) => {
    const newStatus = shop.status === 'active' ? 'inactive' : 'active';
    try {
      const res = await toggleShopStatusAction(shop.id, newStatus);
      if (res.success) {
        toast.success(`Shop "${shop.name}" is now ${newStatus}`);
        setShops((prev) =>
          prev.map((s) => (s.id === shop.id ? { ...s, status: newStatus } : s))
        );
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to toggle status');
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    }
  };

  const handleDelete = async (shop: DemoShop) => {
    if (
      !confirm(
        `Delete shop "${shop.name}"? If this shop already has daily transactions, it cannot be deleted and must be turned off instead.`
      )
    ) {
      return;
    }

    try {
      const res = await deleteShopAction(shop.id);
      if (res.success) {
        toast.success(`Shop "${shop.name}" deleted`);
        setShops((prev) => prev.filter((s) => s.id !== shop.id));
        router.refresh();
      } else {
        toast.error(res.error, { duration: 6000 });
      }
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const openAddManagerForShop = (shop: DemoShop) => {
    const suffix = (shop.managers?.length || 0) + 1;
    const baseUser = suggestUsernameFromShop(shop.code, shop.name);
    setAddMgrShop(shop);
    setMgrName('');
    setMgrPhone('');
    setMgrUsername(suffix > 1 ? `${baseUser}-${suffix}` : baseUser);
    setMgrPassword(generateReadablePassword());
  };

  const handleAddAnotherManager = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMgrShop) return;
    const cleanUser = slugifyUsername(mgrUsername);
    if (!mgrName.trim() || !cleanUser || mgrPassword.trim().length < 8) {
      toast.error('Enter manager name, username, and password (min 8 chars)');
      return;
    }

    setIsAddingMgr(true);
    try {
      const res = await createManagerUserAction({
        fullName: mgrName.trim(),
        username: cleanUser,
        phone: mgrPhone.trim(),
        shopId: addMgrShop.id,
        temporaryPassword: mgrPassword.trim(),
      });

      if (res.success && res.data) {
        toast.success(`Added login "${cleanUser}" to ${addMgrShop.name}`);
        setShops((prev) =>
          prev.map((s) =>
            s.id === addMgrShop.id
              ? {
                  ...s,
                  managers: [
                    ...(s.managers || []),
                    {
                      id: res.data.id,
                      full_name: mgrName.trim(),
                      email: res.data.email || '',
                      username: res.data.username || cleanUser,
                      phone: mgrPhone.trim(),
                      is_active: true,
                      must_change_password: true,
                    },
                  ],
                }
              : s
          )
        );
        const shopForCard = addMgrShop;
        setAddMgrShop(null);
        setCredentialsToShow({
          shopName: shopForCard.name,
          shopCode: shopForCard.code,
          managerName: mgrName.trim(),
          loginPath: res.data.loginPath || `/login/${brandSlug}`,
          username: res.data.username || cleanUser,
          password: res.data.temporaryPassword || mgrPassword.trim(),
        });
        router.refresh();
      } else {
        toast.error(res.error || 'Could not add manager');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error creating manager');
    } finally {
      setIsAddingMgr(false);
    }
  };

  const handleResetManagerPassword = async (
    shop: DemoShop,
    manager: NonNullable<DemoShop['managers']>[number]
  ) => {
    if (
      !confirm(
        `Reset password for ${manager.full_name} (${manager.username || manager.email})? They will need the new password to sign in.`
      )
    ) {
      return;
    }

    const tempPass = generateReadablePassword();
    try {
      const res = await resetManagerPasswordAction(manager.id, tempPass);
      if (res.success) {
        toast.success(`Password reset for ${manager.full_name}`);
        setCredentialsToShow({
          shopName: shop.name,
          shopCode: shop.code,
          managerName: manager.full_name,
          loginPath: res.data?.loginPath || `/login/${brandSlug}`,
          username:
            res.data?.username ||
            manager.username ||
            manager.email.split('@')[0],
          password: res.data?.temporaryPassword || tempPass,
        });
        router.refresh();
      } else {
        toast.error(res.error || 'Password reset failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Reset failed');
    }
  };

  const handleToggleManagerLogin = async (
    shop: DemoShop,
    manager: NonNullable<DemoShop['managers']>[number]
  ) => {
    const nextActive = manager.is_active === false;
    if (
      !nextActive &&
      !confirm(`Deactivate login for ${manager.full_name}? They will immediately lose access.`)
    ) {
      return;
    }
    try {
      const res = await toggleUserStatusAction(manager.id, nextActive);
      if (res.success) {
        toast.success(
          `${manager.full_name}'s login ${nextActive ? 'activated' : 'deactivated'}`
        );
        setShops((prev) =>
          prev.map((s) =>
            s.id === shop.id
              ? {
                  ...s,
                  managers: (s.managers || []).map((m) =>
                    m.id === manager.id ? { ...m, is_active: nextActive } : m
                  ),
                }
              : s
          )
        );
        router.refresh();
      } else {
        toast.error(res.error || 'Could not update login status');
      }
    } catch (err: any) {
      toast.error(err.message || 'Update failed');
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Store className="h-6 w-6 text-[var(--brand-primary,#ea580c)]" />
            <span>Shops & Logins</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Create cafe shops with instant manager logins, reset passwords, or download login sheets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={async () => {
              const toastId = toast.loading('Generating bulk credentials sheet...');
              try {
                const { generateBulkCredentialsSheetPdf } = await import('@cafesync/shared');
                const origin = typeof window !== 'undefined' ? window.location.origin : '';
                const rows = shops.map((s) => ({
                  shopName: s.name,
                  shopCode: s.code,
                  status: s.status,
                  managerName: s.managers?.[0]?.full_name || 'Unassigned',
                  username: s.managers?.[0]?.username || '-',
                  loginUrl: `${origin}/login/`,
                }));
                const buf = await generateBulkCredentialsSheetPdf({
                  brand: {
                    name: 'All Shops',
                    primaryColor: '#ea580c',
                    secondaryColor: '#9a3412',
                    slug: 'brand',
                    generatedAt: new Date().toLocaleDateString(),
                  },
                  rows,
                });
                const blob = new Blob([buf as any], { type: 'application/pdf' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Shop-Login-Credentials-${new Date().toISOString().split('T')[0]}.pdf`;
                document.body.appendChild(a);
                a.click();
                a.remove();
                URL.revokeObjectURL(url);
                toast.success('Bulk credentials sheet downloaded', { id: toastId });
              } catch (err: any) {
                toast.error(err?.message || 'Failed to generate sheet', { id: toastId });
              }
            }}
            className="inline-flex items-center gap-1.5 min-h-[44px] px-3.5 py-2 text-xs font-semibold rounded-[var(--radius-btn,0.5rem)] border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 shadow-2xs cursor-pointer"
            title="Downloads shop names, usernames and login URLs (no existing passwords)"
          >
            <FileDown className="h-4 w-4 text-slate-600" />
            <span>Bulk credentials sheet</span>
          </button>

          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="min-h-[44px] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            <span>Add Shop</span>
          </Button>
        </div>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search shops, codes, manager name, or username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
          />
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {(['all', 'active', 'inactive'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`min-h-[38px] px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all ${
                statusFilter === status
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* 3. SHOPS CARDS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredShops.map((shop) => (
          <div
            key={shop.id}
            className={`rounded-lg border bg-white shadow-xs p-5 transition-all hover:shadow-md flex flex-col justify-between ${
              shop.status === 'active'
                ? 'border-slate-200'
                : 'border-slate-300 bg-slate-50/60 opacity-85'
            }`}
          >
            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {shop.code}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    {shop.name}
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    shop.status === 'active'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {shop.status}
                </span>
              </div>

              {/* Location & Contact */}
              <div className="space-y-1.5 text-xs text-slate-600 mb-3">
                <div className="flex items-start gap-2">
                  <MapPin className="h-3.5 w-3.5 text-slate-400 mt-0.5 shrink-0" />
                  <span className="line-clamp-2">
                    {shop.address || 'Address pending'}
                  </span>
                </div>
                {shop.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{shop.phone}</span>
                  </div>
                )}
              </div>

              {/* Manager Logins Section */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 mb-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-slate-500" />
                    <span>Manager Logins</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => openAddManagerForShop(shop)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--brand-primary,#ea580c)] hover:underline"
                  >
                    <UserPlus className="h-3 w-3" />
                    <span>Add another manager</span>
                  </button>
                </div>

                {shop.managers && shop.managers.length > 0 ? (
                  <div className="space-y-1.5">
                    {shop.managers.map((mgr) => (
                      <div
                        key={mgr.id}
                        className="flex items-center justify-between gap-2 bg-white px-2.5 py-1.5 rounded border border-slate-200/80 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                            <span>{mgr.full_name}</span>
                            {mgr.is_active === false && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-700">
                                OFF
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500 truncate">
                            {mgr.username || mgr.email}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleResetManagerPassword(shop, mgr)}
                            className="px-2 py-1 text-[10px] font-semibold rounded border border-slate-200 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1"
                            title="Reset password"
                          >
                            <KeyRound className="h-3 w-3" />
                            <span>Reset</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleManagerLogin(shop, mgr)}
                            className={`px-2 py-1 text-[10px] font-semibold rounded border inline-flex items-center gap-1 ${
                              mgr.is_active === false
                                ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                            }`}
                            title={
                              mgr.is_active === false
                                ? 'Activate login'
                                : 'Deactivate login'
                            }
                          >
                            <Power className="h-3 w-3" />
                            <span>{mgr.is_active === false ? 'Enable' : 'Off'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    No manager login yet. Click &quot;Add another manager&quot;.
                  </p>
                )}
              </div>

              {/* Month-to-date Snapshot */}
              {shop.month_summary && (
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs flex justify-between mb-4">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Turnover
                    </span>
                    <span className="font-bold text-emerald-700">
                      {formatINR(shop.month_summary.income)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Net Margin
                    </span>
                    <span
                      className={`font-bold ${
                        shop.month_summary.profit_loss >= 0
                          ? 'text-emerald-700'
                          : 'text-rose-700'
                      }`}
                    >
                      {formatINR(shop.month_summary.profit_loss)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-semibold block">
                      Cash Register
                    </span>
                    <span className="font-bold text-slate-900">
                      {formatINR(shop.month_summary.closing)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Card Actions */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingShop(shop)}
                  className="h-9 px-2 text-xs text-slate-600 hover:text-slate-900"
                  title="Edit shop details"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleStatus(shop)}
                  className={`h-9 px-2 text-xs ${
                    shop.status === 'active'
                      ? 'text-amber-600 hover:text-amber-700'
                      : 'text-emerald-600 hover:text-emerald-700'
                  }`}
                  title={
                    shop.status === 'active'
                      ? 'Deactivate shop'
                      : 'Activate shop'
                  }
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(shop)}
                  className="h-9 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                  title="Delete shop (allowed only if empty)"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              <Link
                href={`/admin/shops/${shop.id}`}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-[var(--radius-btn,0.5rem)] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90 shadow-2xs"
              >
                <span>View Ledger</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        ))}
      </div>

      {filteredShops.length === 0 && (
        <div className="p-8 text-center bg-white rounded-lg border border-slate-200">
          <Store className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-700">No Shops Found</h3>
          <p className="text-xs text-slate-500 mt-1">
            Add your first shop using the button above or clear your search filter.
          </p>
        </div>
      )}

      {/* 2-Step Add Shop / Edit Shop Modal */}
      <AddEditShopModal
        isOpen={isAddModalOpen || !!editingShop}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingShop(null);
        }}
        shop={editingShop}
        brandSlug={brandSlug}
        onCreatedWithCredentials={(createdShop, creds) => {
          setShops((prev) => [createdShop, ...prev]);
          setCredentialsToShow(creds);
          router.refresh();
        }}
        onShopUpdated={(updated) => {
          setShops((prev) =>
            prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s))
          );
          router.refresh();
        }}
      />

      {/* Add Another Manager Modal */}
      <Dialog
        open={!!addMgrShop}
        onOpenChange={(open) => !open && setAddMgrShop(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <UserPlus className="h-5 w-5 text-[var(--brand-primary,#ea580c)]" />
              <span>Add Manager for {addMgrShop?.name}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddAnotherManager} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Manager Name *
              </label>
              <input
                type="text"
                required
                autoFocus
                placeholder="e.g. Suresh Raina"
                value={mgrName}
                onChange={(e) => setMgrName(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Phone Number
              </label>
              <input
                type="tel"
                placeholder="+91 98400 33001"
                value={mgrPhone}
                onChange={(e) => setMgrPhone(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Username *
              </label>
              <input
                type="text"
                required
                value={mgrUsername}
                onChange={(e) => setMgrUsername(slugifyUsername(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 text-sm font-mono lowercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                One-Time Password *
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  required
                  minLength={8}
                  value={mgrPassword}
                  onChange={(e) => setMgrPassword(e.target.value)}
                  className="flex-1 min-h-[44px] px-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setMgrPassword(generateReadablePassword())}
                  className="min-h-[44px] px-3 text-xs shrink-0"
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
                onClick={() => setAddMgrShop(null)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isAddingMgr}
                className="min-h-[44px] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90"
              >
                {isAddingMgr ? 'Creating...' : 'Create Login'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* One-Time Credentials Card Modal */}
      <CredentialsCardModal
        credentials={credentialsToShow}
        onClose={() => setCredentialsToShow(null)}
      />
    </div>
  );
}

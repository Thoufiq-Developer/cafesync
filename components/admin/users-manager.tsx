'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Plus,
  Search,
  Mail,
  Phone,
  Store,
  KeyRound,
  Power,
  CheckCircle2,
  Clock,
  Lock,
  User,
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
import {
  createManagerUserAction,
  toggleUserStatusAction,
  reassignUserShopAction,
  resetManagerPasswordAction,
} from '@/app/admin/actions';
import { toast } from 'sonner';
import { formatCount } from '@/lib/calculations/format';
import { DemoShop } from '@/lib/demo-admin-data';
import {
  CredentialsCardModal,
  OneTimeCredentialsPayload,
} from './credentials-card-modal';
import {
  generateReadablePassword,
  isSyntheticEmail,
  slugifyUsername,
  suggestUsernameFromShop,
} from '@/lib/passwords';

export interface ManagerUserRecord {
  id: string;
  fullName: string;
  username?: string;
  email: string;
  phone?: string | null;
  shopId: string;
  shopName: string;
  shopCode: string;
  isActive: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

interface UsersManagerProps {
  initialUsers: ManagerUserRecord[];
  shops: DemoShop[];
  brandSlug?: string;
}

export function UsersManager({
  initialUsers,
  shops,
  brandSlug = 'brand',
}: UsersManagerProps) {
  const router = useRouter();
  const [users, setUsers] = useState<ManagerUserRecord[]>(initialUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [shopFilter, setShopFilter] = useState('all');

  useEffect(() => {
    setUsers(initialUsers);
  }, [initialUsers]);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [reassigningUser, setReassigningUser] = useState<ManagerUserRecord | null>(null);
  const [newAssignedShopId, setNewAssignedShopId] = useState('');
  const [credentialsToShow, setCredentialsToShow] =
    useState<OneTimeCredentialsPayload | null>(null);

  // Form state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [shopId, setShopId] = useState(shops[0]?.id || '');
  const [temporaryPassword, setTemporaryPassword] = useState(() =>
    generateReadablePassword()
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      u.fullName.toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(searchTerm));
    const matchesShop = shopFilter === 'all' || u.shopId === shopFilter;
    return matchesSearch && matchesShop;
  });

  const openCreateModal = () => {
    const defaultShop = shops[0];
    const existingForShop = users.filter((u) => u.shopId === defaultShop?.id).length;
    const baseUser = defaultShop
      ? suggestUsernameFromShop(defaultShop.code, defaultShop.name)
      : 'manager-01';
    setFullName('');
    setEmail('');
    setPhone('');
    setShopId(defaultShop?.id || '');
    setUsername(existingForShop > 0 ? `${baseUser}-${existingForShop + 1}` : baseUser);
    setTemporaryPassword(generateReadablePassword());
    setIsCreateOpen(true);
  };

  const handleShopSelectChange = (nextShopId: string) => {
    setShopId(nextShopId);
    const chosen = shops.find((s) => s.id === nextShopId);
    if (chosen) {
      const existingForShop = users.filter((u) => u.shopId === nextShopId).length;
      const base = suggestUsernameFromShop(chosen.code, chosen.name);
      setUsername(existingForShop > 0 ? `${base}-${existingForShop + 1}` : base);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = slugifyUsername(username);
    if (!fullName.trim() || (!cleanUser && !email.trim()) || !shopId) {
      toast.error('Manager name, username, and assigned shop are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createManagerUserAction({
        fullName,
        username: cleanUser,
        email: email.trim() || undefined,
        phone,
        shopId,
        temporaryPassword,
      });

      if (res.success && res.data) {
        const assignedShop = shops.find((s) => s.id === shopId);
        toast.success(`Manager login created for ${fullName}`);
        setUsers((prev) => [
          {
            id: res.data.id || 'new-mgr',
            fullName: fullName.trim(),
            username: res.data.username || cleanUser,
            email: res.data.email || email.trim().toLowerCase(),
            phone: phone.trim() || null,
            shopId,
            shopName: assignedShop?.name || 'Assigned Shop',
            shopCode: assignedShop?.code || 'SHOP',
            isActive: true,
            mustChangePassword: true,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        setIsCreateOpen(false);
        setCredentialsToShow({
          shopName: res.data.shopName || assignedShop?.name || 'Shop',
          shopCode: res.data.shopCode || assignedShop?.code || 'SHOP',
          managerName: fullName.trim(),
          loginPath: res.data.loginPath || `/login/${brandSlug}`,
          username: res.data.username || cleanUser,
          password: res.data.temporaryPassword || temporaryPassword,
        });
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to create manager login');
      }
    } catch (err: any) {
      toast.error(err.message || 'Creation error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: ManagerUserRecord) => {
    const newStatus = !user.isActive;
    try {
      const res = await toggleUserStatusAction(user.id, newStatus);
      if (res.success) {
        toast.success(
          `Login for ${user.fullName} is now ${newStatus ? 'Active' : 'Deactivated'}`
        );
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, isActive: newStatus } : u))
        );
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to change status');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleReassignShop = async () => {
    if (!reassigningUser || !newAssignedShopId) return;

    try {
      const res = await reassignUserShopAction(reassigningUser.id, newAssignedShopId);
      if (res.success) {
        const assignedShop = shops.find((s) => s.id === newAssignedShopId);
        toast.success(`Moved ${reassigningUser.fullName} to ${assignedShop?.name}`);
        setUsers((prev) =>
          prev.map((u) =>
            u.id === reassigningUser.id
              ? {
                  ...u,
                  shopId: newAssignedShopId,
                  shopName: assignedShop?.name || u.shopName,
                  shopCode: assignedShop?.code || u.shopCode,
                }
              : u
          )
        );
        setReassigningUser(null);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to move shop');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleResetPassword = async (user: ManagerUserRecord) => {
    const tempPass = generateReadablePassword();
    try {
      const res = await resetManagerPasswordAction(user.id, tempPass);
      if (res.success) {
        setCredentialsToShow({
          shopName: user.shopName,
          shopCode: user.shopCode,
          managerName: user.fullName,
          loginPath: res.data?.loginPath || `/login/${brandSlug}`,
          username:
            res.data?.username ||
            user.username ||
            user.email.split('@')[0],
          password: res.data?.temporaryPassword || tempPass,
        });
        setUsers((prev) =>
          prev.map((u) =>
            u.id === user.id ? { ...u, mustChangePassword: true } : u
          )
        );
        router.refresh();
      } else {
        toast.error(res.error || 'Password reset failed');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-[var(--brand-primary,#ea580c)]" />
            <span>Manager Logins</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Create username & password logins for shop managers, reset passwords, or switch their shop.
          </p>
        </div>

        <Button
          onClick={openCreateModal}
          className="min-h-[44px] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90 flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Manager Login</span>
        </Button>
      </div>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search managers by name, username, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full min-h-[40px] pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Shop:</span>
          <select
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
            className="min-h-[40px] text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)] bg-white"
          >
            <option value="all">
              All Shops ({formatCount(users.length)} Managers)
            </option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. MANAGERS TABLE */}
      <div className="rounded-lg border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Manager</th>
                <th className="py-3 px-3">Username &amp; Phone</th>
                <th className="py-3 px-3">Assigned Shop</th>
                <th className="py-3 px-3">Password Status</th>
                <th className="py-3 px-3 text-center">Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center text-slate-400">
                    {users.length === 0
                      ? 'No manager logins created yet. Click "Add Manager Login" above.'
                      : 'No managers match the current search or shop filter.'}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const displayUsername =
                    u.username || (u.email ? u.email.split('@')[0] : '-');
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900">{u.fullName}</div>
                        <div className="text-[10px] text-slate-400">Shop Manager</div>
                      </td>
                      <td className="py-3 px-3 space-y-0.5">
                        <div className="flex items-center gap-1.5 font-mono font-semibold text-slate-800">
                          <User className="h-3 w-3 text-slate-400" />
                          <span>{displayUsername}</span>
                        </div>
                        {u.email && !isSyntheticEmail(u.email) && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <Mail className="h-3 w-3 text-slate-400" />
                            <span>{u.email}</span>
                          </div>
                        )}
                        {u.phone && (
                          <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                            <Phone className="h-3 w-3 text-slate-400" />
                            <span>{u.phone}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => {
                            setReassigningUser(u);
                            setNewAssignedShopId(u.shopId);
                          }}
                          className="group flex items-center gap-1.5 text-left text-slate-800 hover:text-[var(--brand-primary,#ea580c)]"
                          title="Click to move to another shop"
                        >
                          <Store className="h-3.5 w-3.5 text-slate-400 group-hover:text-[var(--brand-primary,#ea580c)]" />
                          <div>
                            <span className="font-semibold block">{u.shopName}</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              ({u.shopCode}) • move shop
                            </span>
                          </div>
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        {u.mustChangePassword ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-50 border border-amber-200 text-amber-800">
                            <Clock className="h-3 w-3 text-amber-600" />
                            <span>Must Change Password</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800">
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                            <span>Password Set</span>
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            u.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {u.isActive ? 'Active' : 'Off'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleResetPassword(u)}
                            className="h-8 px-2.5 text-[11px] text-slate-700 hover:text-slate-900"
                            title="Reset password"
                          >
                            <KeyRound className="h-3 w-3 mr-1" />
                            <span>Reset password</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleStatus(u)}
                            className={`h-8 px-2 text-[11px] ${
                              u.isActive
                                ? 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
                                : 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            <Power className="h-3 w-3 mr-1" />
                            <span>{u.isActive ? 'Deactivate' : 'Activate'}</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MANAGER MODAL */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Shield className="h-5 w-5 text-[var(--brand-primary,#ea580c)]" />
              <span>Add Manager Login</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 py-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Assigned Shop *
              </label>
              <select
                value={shopId}
                onChange={(e) => handleShopSelectChange(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)] bg-white"
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">
                Manager Name *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Ramesh Kulkarni"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
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
                placeholder="e.g. anna-nagar-01"
                value={username}
                onChange={(e) => setUsername(slugifyUsername(e.target.value))}
                className="w-full min-h-[44px] px-3 py-2 text-sm font-mono lowercase border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="+91 98450 11001"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  placeholder="Optional"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>One-Time Password *</span>
                <span className="text-[10px] text-amber-600 font-normal">
                  Must change on first login
                </span>
              </label>
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    required
                    minLength={8}
                    value={temporaryPassword}
                    onChange={(e) => setTemporaryPassword(e.target.value)}
                    className="w-full min-h-[44px] pl-9 pr-3 py-2 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setTemporaryPassword(generateReadablePassword())}
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
                onClick={() => setIsCreateOpen(false)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="min-h-[44px] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90"
              >
                {isSubmitting ? 'Creating...' : 'Create Login'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* REASSIGN SHOP MODAL */}
      <Dialog
        open={!!reassigningUser}
        onOpenChange={(open) => !open && setReassigningUser(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Store className="h-5 w-5 text-[var(--brand-primary,#ea580c)]" />
              <span>Move Manager to Another Shop</span>
            </DialogTitle>
          </DialogHeader>

          {reassigningUser && (
            <div className="space-y-4 py-2">
              <p className="text-xs text-slate-600">
                Move <strong>{reassigningUser.fullName}</strong> to another cafe shop. Their access updates right away.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">
                  Select Shop
                </label>
                <select
                  value={newAssignedShopId}
                  onChange={(e) => setNewAssignedShopId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)] bg-white"
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <DialogFooter className="pt-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setReassigningUser(null)}
                  className="min-h-[44px]"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleReassignShop}
                  className="min-h-[44px] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90"
                >
                  Move Manager
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ONE-TIME CREDENTIALS CARD MODAL */}
      <CredentialsCardModal
        credentials={credentialsToShow}
        onClose={() => setCredentialsToShow(null)}
        title="Manager Login Credentials"
      />
    </div>
  );
}

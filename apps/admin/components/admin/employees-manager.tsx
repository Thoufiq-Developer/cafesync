'use client';

import React, { useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Store,
  Phone,
  Briefcase,
  Edit,
  Power,
  Coins,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { saveEmployeeAction, toggleEmployeeStatusAction } from '@/app/admin/actions';
import { toast } from 'sonner';
import { Money } from '@/components/shared/format-values';
import { formatCount, formatMoney } from '@/lib/calculations/format';
import { DemoShop } from '@/lib/demo-admin-data';

export interface AdminEmployeeRecord {
  id: string;
  shopId: string;
  shopName: string;
  shopCode: string;
  name: string;
  phone?: string | null;
  roleTitle?: string | null;
  ratePerDay: number;
  isActive: boolean;
}

interface EmployeesManagerProps {
  initialEmployees: AdminEmployeeRecord[];
  shops: DemoShop[];
}

export function EmployeesManager({ initialEmployees, shops }: EmployeesManagerProps) {
  const [employees, setEmployees] = useState<AdminEmployeeRecord[]>(initialEmployees);
  const [shopFilter, setShopFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<AdminEmployeeRecord | null>(null);

  // Form inputs
  const [shopId, setShopId] = useState(shops[0]?.id || '');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [roleTitle, setRoleTitle] = useState('Barista');
  const [ratePerDay, setRatePerDay] = useState<number>(600);
  const [isActive, setIsActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = employees.filter((e) => {
    const matchesShop = shopFilter === 'all' || e.shopId === shopFilter;
    const matchesSearch =
      e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (e.roleTitle && e.roleTitle.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (e.phone && e.phone.includes(searchTerm));
    return matchesShop && matchesSearch;
  });

  const handleOpenAdd = () => {
    setEditingEmp(null);
    setShopId(shopFilter !== 'all' ? shopFilter : (shops[0]?.id || ''));
    setName('');
    setPhone('');
    setRoleTitle('Barista');
    setRatePerDay(600);
    setIsActive(true);
    setModalOpen(true);
  };

  const handleOpenEdit = (emp: AdminEmployeeRecord) => {
    setEditingEmp(emp);
    setShopId(emp.shopId);
    setName(emp.name);
    setPhone(emp.phone || '');
    setRoleTitle(emp.roleTitle || 'Barista');
    setRatePerDay(emp.ratePerDay);
    setIsActive(emp.isActive);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !shopId || ratePerDay < 0) {
      toast.error('Name, shop, and valid rate per day are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveEmployeeAction({
        id: editingEmp?.id,
        shopId,
        name,
        phone,
        roleTitle,
        ratePerDay,
        isActive,
      });

      if (res.success) {
        const assignedShop = shops.find((s) => s.id === shopId);
        toast.success(editingEmp ? `Updated ${name}` : `Added employee ${name}`);
        if (editingEmp) {
          setEmployees((prev) =>
            prev.map((e) =>
              e.id === editingEmp.id
                ? {
                    ...e,
                    shopId,
                    shopName: assignedShop?.name || e.shopName,
                    shopCode: assignedShop?.code || e.shopCode,
                    name: name.trim(),
                    phone: phone.trim() || null,
                    roleTitle: roleTitle.trim() || null,
                    ratePerDay,
                    isActive,
                  }
                : e
            )
          );
        } else {
          setEmployees((prev) => [
            {
              id: 'emp-' + Date.now(),
              shopId,
              shopName: assignedShop?.name || 'Shop',
              shopCode: assignedShop?.code || 'SNX',
              name: name.trim(),
              phone: phone.trim() || null,
              roleTitle: roleTitle.trim() || null,
              ratePerDay,
              isActive: true,
            },
            ...prev,
          ]);
        }
        setModalOpen(false);
      } else {
        toast.error(res.error || 'Failed to save employee');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (emp: AdminEmployeeRecord) => {
    const newStatus = !emp.isActive;
    try {
      const res = await toggleEmployeeStatusAction(emp.id, newStatus);
      if (res.success) {
        toast.success(`${emp.name} is now ${newStatus ? 'Active' : 'Inactive'}`);
        setEmployees((prev) =>
          prev.map((e) => (e.id === emp.id ? { ...e, isActive: newStatus } : e))
        );
      } else {
        toast.error(res.error);
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
            <Users className="h-6 w-6 text-[var(--brand-primary,#ea580c)]" />
            <span>Staff Roster & Wage Rates</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Administer staff profiles and official rate-per-day across all cafe branches. Managers record days worked.
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90 flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Employee</span>
        </Button>
      </div>

      {/* 2. SEARCH & SHOP FILTER */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search staff by name, role (Barista, Line Cook), or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">Filter Outlet:</span>
          <select
            value={shopFilter}
            onChange={(e) => setShopFilter(e.target.value)}
            className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)] bg-white"
          >
            <option value="all">All Outlets ({formatCount(employees.length)} Staff)</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. EMPLOYEES TABLE */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Employee Name</th>
                <th className="py-3 px-3">Outlet Branch</th>
                <th className="py-3 px-3">Role Title</th>
                <th className="py-3 px-3 text-right">Rate Per Day</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-bold text-slate-900">{emp.name}</div>
                    {emp.phone && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        <span>{emp.phone}</span>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-semibold text-slate-800">{emp.shopName}</span>
                    <span className="text-[10px] font-mono text-slate-400 block">({emp.shopCode})</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                      <Briefcase className="h-3 w-3 text-slate-400" />
                      <span>{emp.roleTitle || 'Cafe Staff'}</span>
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {formatMoney(emp.ratePerDay)} <span className="text-[10px] text-slate-400 font-normal">/day</span>
                  </td>
                  <td className="py-3 px-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        emp.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {emp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(emp)}
                        className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                        title="Edit rate or profile"
                      >
                        <Edit className="h-3.5 w-3.5 mr-1" />
                        <span>Edit</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleStatus(emp)}
                        className={`h-7 px-2 text-xs ${
                          emp.isActive ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'
                        }`}
                      >
                        <Power className="h-3.5 w-3.5 mr-1" />
                        <span>{emp.isActive ? 'Deactivate' : 'Activate'}</span>
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT EMPLOYEE MODAL */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Users className="h-5 w-5 text-[var(--brand-primary,#ea580c)]" />
              <span>{editingEmp ? 'Edit Employee Wage & Profile' : 'Register New Staff Member'}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Assigned Cafe Outlet *</label>
              <select
                value={shopId}
                onChange={(e) => setShopId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)] bg-white"
              >
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Suresh Kumar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Contact Phone</label>
                <input
                  type="tel"
                  placeholder="+91 97000 10001"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700">Role Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Head Barista, Cook"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center justify-between">
                <span>Daily Wage Rate (₹) *</span>
                <span className="text-[11px] text-slate-400 font-normal">Base rate per worked shift</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  required
                  min={0}
                  step={25}
                  value={ratePerDay}
                  onChange={(e) => setRatePerDay(Number(e.target.value))}
                  className="w-full pl-8 pr-3 py-2 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90"
              >
                {isSubmitting ? 'Saving...' : editingEmp ? 'Save Changes' : 'Add Employee'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}


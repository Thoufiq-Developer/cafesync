'use client';

import React, { useState } from 'react';
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Plus,
  Search,
  Store,
  DollarSign,
  Calendar,
  History,
  Edit,
  Trash2,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { saveAssetAction, deleteAssetAction, logAdminAssetServiceAction } from '@/app/admin/actions';
import { toast } from 'sonner';
import { Count, Money } from '@/components/shared/format-values';
import { formatCount, formatMoney } from '@/lib/calculations/format';
import { DemoShop } from '@/lib/demo-admin-data';

export interface AdminAssetItem {
  id: string;
  shop_id: string;
  shop_name: string;
  shop_code: string;
  name: string;
  category: 'freezer' | 'fryer' | 'lights' | 'chiller' | 'grinder' | 'other';
  model?: string | null;
  serial_no?: string | null;
  purchase_date?: string | null;
  cost?: number | null;
  vendor?: string | null;
  status: 'working' | 'needs_repair' | 'out_of_service';
  last_service_date?: string | null;
  service_interval_days?: number | null;
  next_service_due?: string | null;
  notes?: string | null;
  service_logs?: Array<{
    id: string;
    service_date: string;
    vendor?: string;
    cost: number;
    notes?: string;
    next_due?: string;
  }>;
}

interface AssetsRegisterManagerProps {
  initialAssets: AdminAssetItem[];
  shops: DemoShop[];
  todayDate: string;
}

export function AssetsRegisterManager({
  initialAssets,
  shops,
  todayDate,
}: AssetsRegisterManagerProps) {
  const [assets, setAssets] = useState<AdminAssetItem[]>(initialAssets);
  const [shopFilter, setShopFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals state
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AdminAssetItem | null>(null);
  const [historyAsset, setHistoryAsset] = useState<AdminAssetItem | null>(null);
  const [serviceAsset, setServiceAsset] = useState<AdminAssetItem | null>(null);

  // Add/Edit Form inputs
  const [shopId, setShopId] = useState(shops[0]?.id || '');
  const [name, setName] = useState('');
  const [category, setCategory] = useState<AdminAssetItem['category']>('grinder');
  const [model, setModel] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [cost, setCost] = useState<number | undefined>(undefined);
  const [vendor, setVendor] = useState('');
  const [status, setStatus] = useState<AdminAssetItem['status']>('working');
  const [serviceIntervalDays, setServiceIntervalDays] = useState(90);
  const [nextServiceDue, setNextServiceDue] = useState('');
  const [notes, setNotes] = useState('');

  // Service Log inputs
  const [logVendor, setLogVendor] = useState('');
  const [logCost, setLogCost] = useState<number>(0);
  const [logNotes, setLogNotes] = useState('');
  const [logNextDue, setLogNextDue] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Categorize service urgency across all shops
  const getUrgency = (nextDue?: string | null) => {
    if (!nextDue) return 'normal';
    const dueTime = new Date(nextDue).getTime();
    const currTime = new Date(todayDate).getTime();
    const diffDays = Math.ceil((dueTime - currTime) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 7) return 'due_soon';
    return 'normal';
  };

  const urgentAssets = [...assets]
    .filter((a) => {
      const u = getUrgency(a.next_service_due);
      return u === 'overdue' || u === 'due_soon';
    })
    .sort((a, b) => {
      const dateA = a.next_service_due || '9999-99-99';
      const dateB = b.next_service_due || '9999-99-99';
      return dateA.localeCompare(dateB);
    });

  const filteredAssets = assets.filter((a) => {
    const matchesShop = shopFilter === 'all' || a.shop_id === shopFilter;
    const matchesSearch =
      a.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (a.model && a.model.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.serial_no && a.serial_no.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (a.vendor && a.vendor.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesShop && matchesSearch;
  });

  const handleOpenAdd = () => {
    setEditingAsset(null);
    setShopId(shopFilter !== 'all' ? shopFilter : (shops[0]?.id || ''));
    setName('');
    setCategory('grinder');
    setModel('');
    setSerialNo('');
    setPurchaseDate(todayDate);
    setCost(undefined);
    setVendor('');
    setStatus('working');
    setServiceIntervalDays(90);
    // 90 days from today
    const d = new Date();
    d.setDate(d.getDate() + 90);
    setNextServiceDue(d.toISOString().split('T')[0]);
    setNotes('');
    setIsAddEditOpen(true);
  };

  const handleOpenEdit = (a: AdminAssetItem) => {
    setEditingAsset(a);
    setShopId(a.shop_id);
    setName(a.name);
    setCategory(a.category);
    setModel(a.model || '');
    setSerialNo(a.serial_no || '');
    setPurchaseDate(a.purchase_date || '');
    setCost(a.cost || undefined);
    setVendor(a.vendor || '');
    setStatus(a.status);
    setServiceIntervalDays(a.service_interval_days || 90);
    setNextServiceDue(a.next_service_due || '');
    setNotes(a.notes || '');
    setIsAddEditOpen(true);
  };

  const handleSaveAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !shopId) {
      toast.error('Asset name and assigned shop are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await saveAssetAction({
        id: editingAsset?.id,
        shopId,
        name,
        category,
        model,
        serialNo,
        purchaseDate,
        cost,
        vendor,
        status,
        serviceIntervalDays,
        nextServiceDue,
        notes,
      });

      if (res.success) {
        const assignedShop = shops.find((s) => s.id === shopId);
        toast.success(editingAsset ? `Updated "${name}"` : `Asset "${name}" registered`);
        if (editingAsset) {
          setAssets((prev) =>
            prev.map((a) =>
              a.id === editingAsset.id
                ? {
                    ...a,
                    shop_id: shopId,
                    shop_name: assignedShop?.name || a.shop_name,
                    shop_code: assignedShop?.code || a.shop_code,
                    name: name.trim(),
                    category,
                    model,
                    serial_no: serialNo,
                    purchase_date: purchaseDate,
                    cost,
                    vendor,
                    status,
                    service_interval_days: serviceIntervalDays,
                    next_service_due: nextServiceDue,
                    notes,
                  }
                : a
            )
          );
        } else {
          setAssets((prev) => [
            {
              id: 'asset-' + Date.now(),
              shop_id: shopId,
              shop_name: assignedShop?.name || 'Shop',
              shop_code: assignedShop?.code || 'SNX',
              name: name.trim(),
              category,
              model,
              serial_no: serialNo,
              purchase_date: purchaseDate,
              cost,
              vendor,
              status,
              service_interval_days: serviceIntervalDays,
              next_service_due: nextServiceDue,
              notes,
              service_logs: [],
            },
            ...prev,
          ]);
        }
        setIsAddEditOpen(false);
      } else {
        toast.error(res.error || 'Failed to save asset');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (asset: AdminAssetItem) => {
    if (!confirm(`Are you sure you want to remove equipment "${asset.name}"?`)) return;

    try {
      const res = await deleteAssetAction(asset.id);
      if (res.success) {
        toast.success(`Asset "${asset.name}" removed from registry`);
        setAssets((prev) => prev.filter((a) => a.id !== asset.id));
      } else {
        toast.error(res.error || 'Failed to delete asset');
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleOpenLogService = (asset: AdminAssetItem) => {
    setServiceAsset(asset);
    setLogVendor(asset.vendor || 'Authorized Service');
    setLogCost(0);
    setLogNotes('');
    const d = new Date();
    d.setDate(d.getDate() + (asset.service_interval_days || 90));
    setLogNextDue(d.toISOString().split('T')[0]);
  };

  const handleSaveServiceLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceAsset) return;

    setIsSubmitting(true);
    try {
      const res = await logAdminAssetServiceAction({
        assetId: serviceAsset.id,
        shopId: serviceAsset.shop_id,
        serviceDate: todayDate,
        vendor: logVendor,
        cost: logCost,
        notes: logNotes,
        nextDue: logNextDue,
      });

      if (res.success) {
        toast.success(`Service logged for "${serviceAsset.name}"`);
        setAssets((prev) =>
          prev.map((a) =>
            a.id === serviceAsset.id
              ? {
                  ...a,
                  last_service_date: todayDate,
                  next_service_due: logNextDue,
                  status: 'working',
                  service_logs: [
                    {
                      id: 'log-' + Date.now(),
                      service_date: todayDate,
                      vendor: logVendor,
                      cost: logCost,
                      notes: logNotes,
                      next_due: logNextDue,
                    },
                    ...(a.service_logs || []),
                  ],
                }
              : a
          )
        );
        setServiceAsset(null);
      } else {
        toast.error(res.error || 'Failed to log service');
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Wrench className="h-6 w-6 text-[var(--brand-primary,#ea580c)]" />
            <span>Equipment Register & Maintenance Schedules</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Brand-wide asset tracking (freezers, fryers, chillers, espresso machines) with preventive maintenance urgency alerts.
          </p>
        </div>

        <Button
          onClick={handleOpenAdd}
          className="bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90 flex items-center gap-2 self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Add Equipment Asset</span>
        </Button>
      </div>

      {/* 2. URGENT SERVICE DUE SECTION (Across All Shops) */}
      {urgentAssets.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
              <AlertTriangle className="h-4 w-4 text-rose-600" />
              <span>Urgent Maintenance Required (<Count value={urgentAssets.length} suffix="Assets" />)</span>
            </div>
            <span className="text-[11px] text-rose-700">Sorted by immediate urgency</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {urgentAssets.map((asset) => {
              const urgency = getUrgency(asset.next_service_due);
              const isOverdue = urgency === 'overdue';

              return (
                <div
                  key={asset.id}
                  className={`p-3 rounded-lg border bg-white flex flex-col justify-between shadow-2xs ${
                    isOverdue ? 'border-rose-300' : 'border-amber-300'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold text-slate-500">{asset.shop_code}</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                          isOverdue ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {isOverdue ? 'Overdue' : 'Due in 7 Days'}
                      </span>
                    </div>
                    <div className="font-bold text-xs text-slate-900">{asset.name}</div>
                    <div className="text-[11px] text-slate-500">
                      Outlet: <span className="font-semibold text-slate-700">{asset.shop_name}</span>
                    </div>
                    <div className="text-[11px] text-slate-600 font-mono">
                      Due: <strong>{asset.next_service_due || 'Pending'}</strong>
                    </div>
                  </div>

                  <div className="pt-2 mt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 capitalize">{asset.category}</span>
                    <Button
                      size="sm"
                      onClick={() => handleOpenLogService(asset)}
                      className="h-6 px-2 text-[11px] bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90"
                    >
                      Log Service
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. SEARCH & SHOP FILTER */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search equipment by name, model, serial no, or vendor..."
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
            <option value="all">All Outlets ({formatCount(assets.length)} Equipment)</option>
            {shops.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. ASSETS TABLE */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Equipment & Model</th>
                <th className="py-3 px-3">Outlet Location</th>
                <th className="py-3 px-3">Category</th>
                <th className="py-3 px-3 text-right">Cost (₹)</th>
                <th className="py-3 px-3 text-center">Status</th>
                <th className="py-3 px-3">Service Schedule</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.map((asset) => {
                const urgency = getUrgency(asset.next_service_due);

                return (
                  <tr key={asset.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{asset.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {asset.model ? `Model: ${asset.model}` : ''} {asset.serial_no ? `| S/N: ${asset.serial_no}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="font-semibold text-slate-800">{asset.shop_name}</span>
                      <span className="text-[10px] font-mono text-slate-400 block">({asset.shop_code})</span>
                    </td>
                    <td className="py-3 px-3 capitalize text-slate-700">{asset.category}</td>
                    <td className="py-3 px-3 text-right font-mono font-medium text-slate-900">
                      {asset.cost ? formatMoney(asset.cost) : '—'}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          asset.status === 'working'
                            ? 'bg-emerald-100 text-emerald-800'
                            : asset.status === 'needs_repair'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {asset.status === 'working' ? 'Operational' : asset.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-3 space-y-0.5">
                      <div className="text-[11px] text-slate-500">
                        Last: {asset.last_service_date || 'Never'}
                      </div>
                      <div
                        className={`font-semibold text-[11px] flex items-center gap-1 ${
                          urgency === 'overdue'
                            ? 'text-rose-700'
                            : urgency === 'due_soon'
                            ? 'text-amber-700'
                            : 'text-slate-700'
                        }`}
                      >
                        <Clock className="h-3 w-3" />
                        <span>Due: {asset.next_service_due || 'Not scheduled'}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenLogService(asset)}
                          className="h-7 px-2 text-[11px] text-slate-700 hover:text-slate-900"
                          title="Log maintenance service"
                        >
                          <Wrench className="h-3 w-3 mr-1 text-[var(--brand-primary,#ea580c)]" />
                          <span>Service</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setHistoryAsset(asset)}
                          className="h-7 px-2 text-[11px] text-slate-600 hover:text-slate-900"
                          title="View service logs"
                        >
                          <History className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(asset)}
                          className="h-7 px-2 text-[11px] text-slate-600 hover:text-slate-900"
                          title="Edit asset details"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(asset)}
                          className="h-7 px-2 text-[11px] text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                          title="Remove asset"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ADD / EDIT ASSET MODAL */}
      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Wrench className="h-5 w-5 text-[var(--brand-primary,#ea580c)]" />
              <span>{editingAsset ? 'Edit Equipment Asset' : 'Register New Equipment Asset'}</span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveAsset} className="space-y-3.5 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Assigned Outlet *</label>
                <select
                  value={shopId}
                  onChange={(e) => setShopId(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)] bg-white"
                >
                  {shops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Category *</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)] bg-white"
                >
                  <option value="grinder">Grinder / Coffee Machine</option>
                  <option value="freezer">Freezer</option>
                  <option value="chiller">Under-counter Chiller</option>
                  <option value="fryer">Commercial Fryer</option>
                  <option value="lights">Lighting & Electricals</option>
                  <option value="other">Other Kitchen Appliance</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Asset Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. La Marzocco Linea PB 2-Group"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Model / Make</label>
                <input
                  type="text"
                  placeholder="Linea PB Commercial"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Serial Number</label>
                <input
                  type="text"
                  placeholder="SNX-10928-PB"
                  value={serialNo}
                  onChange={(e) => setSerialNo(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Purchase Date</label>
                <input
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Cost (₹)</label>
                <input
                  type="number"
                  placeholder="650000"
                  value={cost || ''}
                  onChange={(e) => setCost(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)] bg-white"
                >
                  <option value="working">Working</option>
                  <option value="needs_repair">Needs Repair</option>
                  <option value="out_of_service">Out of Service</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Vendor / Supplier</label>
                <input
                  type="text"
                  placeholder="Kaapi Solutions Pvt Ltd"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Service Interval (Days)</label>
                <input
                  type="number"
                  value={serviceIntervalDays}
                  onChange={(e) => setServiceIntervalDays(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Next Maintenance Due Date</label>
              <input
                type="date"
                value={nextServiceDue}
                onChange={(e) => setNextServiceDue(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Notes & Calibration Details</label>
              <textarea
                rows={2}
                placeholder="Descaling instructions, water filter specs..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsAddEditOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90"
              >
                {isSubmitting ? 'Saving...' : editingAsset ? 'Save Changes' : 'Register Equipment'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* SERVICE HISTORY DRAWER / MODAL */}
      <Dialog open={!!historyAsset} onOpenChange={(open) => !open && setHistoryAsset(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <History className="h-5 w-5 text-indigo-600" />
              <span>Maintenance History: {historyAsset?.name}</span>
            </DialogTitle>
          </DialogHeader>

          {historyAsset && (
            <div className="space-y-3 py-2">
              <div className="text-xs text-slate-500">
                Outlet: <strong>{historyAsset.shop_name}</strong> | Serial: {historyAsset.serial_no || 'N/A'}
              </div>

              {(!historyAsset.service_logs || historyAsset.service_logs.length === 0) ? (
                <div className="p-6 text-center bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-500">
                  No service logs recorded yet. Use the "Service" button to log maintenance.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {historyAsset.service_logs.map((log) => (
                    <div key={log.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold text-slate-800">
                        <span>Date: {log.service_date}</span>
                        <span className="font-mono text-emerald-700">{log.cost > 0 ? formatMoney(log.cost) : 'Warranty/Free'}</span>
                      </div>
                      <div className="text-slate-600">Vendor: {log.vendor || 'In-house'}</div>
                      {log.notes && <div className="text-slate-500 italic">"{log.notes}"</div>}
                      {log.next_due && <div className="text-[11px] text-indigo-600 font-medium">Next Due: {log.next_due}</div>}
                    </div>
                  ))}
                </div>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setHistoryAsset(null)}>
                  Close History
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* LOG SERVICE MODAL */}
      <Dialog open={!!serviceAsset} onOpenChange={(open) => !open && setServiceAsset(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Wrench className="h-5 w-5 text-[var(--brand-primary,#ea580c)]" />
              <span>Log Maintenance: {serviceAsset?.name}</span>
            </DialogTitle>
          </DialogHeader>

          {serviceAsset && (
            <form onSubmit={handleSaveServiceLog} className="space-y-3.5 py-2">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 text-xs text-slate-600">
                Logging service for {serviceAsset.name} at {serviceAsset.shop_name}.
                If a maintenance cost is entered, an expense will be automatically booked in that outlet's daily ledger.
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Service Vendor / Technician *</label>
                <input
                  type="text"
                  required
                  value={logVendor}
                  onChange={(e) => setLogVendor(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Service Cost (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={logCost}
                  onChange={(e) => setLogCost(Number(e.target.value))}
                  className="w-full px-3 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Next Service Due Date *</label>
                <input
                  type="date"
                  required
                  value={logNextDue}
                  onChange={(e) => setLogNextDue(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Maintenance Notes</label>
                <textarea
                  rows={2}
                  placeholder="Parts replaced, pressure recalibrated..."
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setServiceAsset(null)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-[var(--brand-primary,#ea580c)] text-white hover:opacity-90"
                >
                  {isSubmitting ? 'Logging...' : 'Confirm Service'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


'use client';

import React, { useState } from 'react';
import {
  History,
  Search,
  Filter,
  Shield,
  Building2,
  Calendar,
  Code,
  CheckCircle2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DemoMasterBrand } from '@/lib/demo-master-data';

export interface AuditRecord {
  id: string;
  brand_id?: string | null;
  brand_name: string;
  user_name: string;
  user_role: string;
  action: string;
  table_name: string;
  record_id: string;
  old_data?: any;
  new_data?: any;
  summary?: string;
  timestamp: string;
}

interface PlatformAuditViewProps {
  initialLogs: AuditRecord[];
  brands: DemoMasterBrand[];
}

export function PlatformAuditView({ initialLogs, brands }: PlatformAuditViewProps) {
  const [logs, setLogs] = useState<AuditRecord[]>(initialLogs);
  const [brandFilter, setBrandFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [tableFilter, setTableFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [inspectLog, setInspectLog] = useState<AuditRecord | null>(null);

  const filteredLogs = logs.filter((log) => {
    const matchesBrand = brandFilter === 'all' || log.brand_name === brandFilter || log.brand_id === brandFilter;
    const matchesAction = actionFilter === 'all' || log.action === actionFilter;
    const matchesTable = tableFilter === 'all' || log.table_name === tableFilter;
    const matchesSearch =
      log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.table_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.brand_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.summary && log.summary.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.new_data && JSON.stringify(log.new_data).toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesBrand && matchesAction && matchesTable && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <History className="h-6 w-6 text-slate-800" />
            <span>Platform-Wide Audit Log & Security Trail</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Immutable system-wide event trail tracking all administrative actions, ledger modifications, and logins across all brands.
          </p>
        </div>
      </div>

      {/* 2. SEARCH & FILTERS */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search audit trail by user, action, table, or payload..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-800"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Brand Filter */}
            <select
              value={brandFilter}
              onChange={(e) => setBrandFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Action Filter */}
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white font-mono uppercase"
            >
              <option value="all">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="SUSPEND">SUSPEND</option>
              <option value="REACTIVATE">REACTIVATE</option>
              <option value="APPROVE">APPROVE</option>
              <option value="REJECT">REJECT</option>
              <option value="VIEW_AS_ADMIN">VIEW_AS_ADMIN</option>
              <option value="IMPORT_EXCEL">IMPORT_EXCEL</option>
              <option value="RESET_PASSWORD">RESET_PASSWORD</option>
            </select>

            {/* Table Filter */}
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg bg-white"
            >
              <option value="all">All Tables</option>
              <option value="brands">brands</option>
              <option value="shops">shops</option>
              <option value="profiles">profiles</option>
              <option value="transactions">transactions</option>
              <option value="item_requests">item_requests</option>
              <option value="items">items</option>
              <option value="assets">assets</option>
              <option value="employees">employees</option>
              <option value="month_openings">month_openings</option>
            </select>
          </div>
        </div>
      </div>

      {/* 3. AUDIT LOGS TABLE */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-3">User & Role</th>
                <th className="py-3 px-3">Brand Context</th>
                <th className="py-3 px-3 text-center">Action</th>
                <th className="py-3 px-3">Table Target</th>
                <th className="py-3 px-3">Record Details</th>
                <th className="py-3 px-4 text-right">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                    {log.timestamp}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-bold text-slate-900">{log.user_name}</div>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 uppercase">
                      {log.user_role}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-medium text-slate-700">{log.brand_name}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                        log.action === 'CREATE'
                          ? 'bg-emerald-100 text-emerald-800'
                          : log.action === 'UPDATE'
                          ? 'bg-blue-100 text-blue-800'
                          : log.action === 'DELETE' || log.action === 'SUSPEND'
                          ? 'bg-rose-100 text-rose-800'
                          : log.action === 'VIEW_AS_ADMIN'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">{log.table_name}</td>
                  <td className="py-2.5 px-3 text-slate-700 max-w-sm truncate">
                    {log.summary || (log.new_data ? JSON.stringify(log.new_data) : log.record_id)}
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setInspectLog(log)}
                      className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      <span>Diff</span>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredLogs.length === 0 && (
        <div className="p-8 text-center bg-white rounded-xl border border-slate-200">
          <History className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-slate-700">No Audit Events Found</h3>
          <p className="text-xs text-slate-500 mt-1">Try resetting the filters or search term.</p>
        </div>
      )}

      {/* INSPECT LOG MODAL */}
      <Dialog open={!!inspectLog} onOpenChange={(open) => !open && setInspectLog(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <Code className="h-5 w-5 text-slate-800" />
              <span>Audit Event Payload Inspector</span>
            </DialogTitle>
          </DialogHeader>

          {inspectLog && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Action</span>
                  <span className="font-mono font-bold text-slate-800">{inspectLog.action}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Target Table</span>
                  <span className="font-mono font-bold text-slate-800">{inspectLog.table_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">User</span>
                  <span className="font-bold text-slate-800">{inspectLog.user_name} ({inspectLog.user_role})</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-semibold">Timestamp</span>
                  <span className="font-mono text-slate-800">{inspectLog.timestamp}</span>
                </div>
              </div>

              {inspectLog.old_data && (
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700">Previous Data Snapshot (old_data):</label>
                  <pre className="p-3 bg-slate-950 text-slate-100 rounded-lg text-[11px] overflow-x-auto max-h-40">
                    {JSON.stringify(inspectLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">New Data Payload (new_data):</label>
                <pre className="p-3 bg-slate-950 text-emerald-400 rounded-lg text-[11px] overflow-x-auto max-h-48 font-mono">
                  {JSON.stringify(inspectLog.new_data || { record_id: inspectLog.record_id }, null, 2)}
                </pre>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setInspectLog(null)}>
                  Close
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


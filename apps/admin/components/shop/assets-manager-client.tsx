'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogServiceModal } from './log-service-modal';
import { formatDate } from '@/lib/calculations/dates';
import { Count } from '@/components/shared/format-values';
import { differenceInCalendarDays, parseISO } from 'date-fns';
import {
  Wrench,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Calendar,
  AlertCircle,
  Search,
} from 'lucide-react';

interface AssetRecord {
  id: string;
  name: string;
  category: string;
  model?: string | null;
  serial_no?: string | null;
  status: string;
  last_service_date?: string | null;
  service_interval_days?: number | null;
  next_service_due?: string | null;
  vendor?: string | null;
  cost?: number | null;
  notes?: string | null;
}

interface AssetsManagerClientProps {
  assets: AssetRecord[];
  today: string;
}

export function AssetsManagerClient({ assets, today }: AssetsManagerClientProps) {
  const [selectedAsset, setSelectedAsset] = useState<AssetRecord | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [healthFilter, setHealthFilter] = useState<'all' | 'overdue' | 'urgent' | 'normal'>('all');

  // Health Status determination:
  // Overdue = Red (next_service_due < today)
  // Due within 7 days = Amber (0 <= days <= 7)
  // Normal = Green (> 7 days)
  const getServiceHealth = (nextDue?: string | null) => {
    if (!nextDue) return { status: 'unknown', label: 'No Schedule', color: 'slate' };

    const daysUntilDue = differenceInCalendarDays(new Date(nextDue), new Date(today));

    if (daysUntilDue < 0) {
      return {
        status: 'overdue',
        label: `OVERDUE (${Math.abs(daysUntilDue)}d ago)`,
        color: 'red',
        days: daysUntilDue,
      };
    }
    if (daysUntilDue <= 7) {
      return {
        status: 'urgent',
        label: `Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`,
        color: 'amber',
        days: daysUntilDue,
      };
    }
    return {
      status: 'normal',
      label: `Due on ${formatDate(nextDue)} (${daysUntilDue}d)`,
      color: 'emerald',
      days: daysUntilDue,
    };
  };

  const overdueCount = assets.filter((a) => {
    const h = getServiceHealth(a.next_service_due);
    return h.status === 'overdue';
  }).length;

  const urgentCount = assets.filter((a) => {
    const h = getServiceHealth(a.next_service_due);
    return h.status === 'urgent';
  }).length;

  const filteredAssets = assets.filter((asset) => {
    const q = searchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      asset.name.toLowerCase().includes(q) ||
      (asset.category || '').toLowerCase().includes(q) ||
      (asset.model || '').toLowerCase().includes(q) ||
      (asset.serial_no || '').toLowerCase().includes(q);
    if (!matchesSearch) return false;
    if (healthFilter === 'all') return true;
    const h = getServiceHealth(asset.next_service_due);
    return h.status === healthFilter;
  });

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-xs">
          <p className="text-xs uppercase font-medium text-slate-500">Total Outfitted Assets</p>
          <p className="text-2xl font-bold font-mono text-slate-900 mt-1"><Count value={assets.length} /></p>
          <p className="text-[11px] text-slate-400 mt-0.5">Assigned to this outlet</p>
        </div>

        <div className="p-4 rounded-xl border border-red-200 bg-red-50/30 shadow-xs">
          <p className="text-xs uppercase font-medium text-red-700">Overdue Service</p>
          <p className="text-2xl font-bold font-mono text-red-700 mt-1"><Count value={overdueCount} /></p>
          <p className="text-[11px] text-red-500 mt-0.5">Service immediately</p>
        </div>

        <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/30 shadow-xs">
          <p className="text-xs uppercase font-medium text-amber-800">Due Within 7 Days</p>
          <p className="text-2xl font-bold font-mono text-amber-800 mt-1"><Count value={urgentCount} /></p>
          <p className="text-[11px] text-amber-600 mt-0.5">Schedule technician</p>
        </div>

        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/30 shadow-xs">
          <p className="text-xs uppercase font-medium text-emerald-800">Healthy & Serviced</p>
          <p className="text-2xl font-bold font-mono text-emerald-800 mt-1">
            <Count value={assets.length - overdueCount - urgentCount} />
          </p>
          <p className="text-[11px] text-emerald-600 mt-0.5">Operating within interval</p>
        </div>
      </div>

      {/* Equipment List */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden shadow-xs">
        <div className="p-4 sm:p-5 space-y-3 border-b border-slate-100 bg-slate-50/50">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Assigned Equipment &amp; Service Schedule
            </h2>
            <p className="text-xs text-slate-500">
              Click &quot;Log Service&quot; after maintenance to update the preventive maintenance timer.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search equipment name, category, model..."
                className="w-full min-h-[40px] pl-8 pr-3 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary,#ea580c)]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1 bg-white border border-slate-200 p-1 rounded-lg self-start sm:self-auto">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'overdue', label: 'Overdue' },
                  { id: 'urgent', label: 'Due Soon' },
                  { id: 'normal', label: 'Healthy' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setHealthFilter(f.id)}
                  className={`min-h-[32px] px-2.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                    healthFilter === f.id
                      ? 'bg-[var(--brand-primary,#ea580c)] text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
              <tr>
                <th className="py-3 px-4">Equipment Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Model &amp; Serial</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Serviced</th>
                <th className="py-3 px-4">Next Service Due</th>
                <th className="py-3 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-slate-400">
                    No equipment matches your search or health filter.
                  </td>
                </tr>
              ) : (
              filteredAssets.map((asset) => {
                const health = getServiceHealth(asset.next_service_due);

                return (
                  <tr key={asset.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {asset.name}
                      {asset.notes && (
                        <div className="text-[11px] font-normal text-slate-400 truncate max-w-xs mt-0.5">
                          {asset.notes}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono uppercase text-slate-500 text-[11px]">
                      {asset.category}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      <div>{asset.model || '-'}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{asset.serial_no || '-'}</div>
                    </td>

                    <td className="py-3 px-4">
                      {asset.status === 'working' ? (
                        <Badge variant="outline" className="text-emerald-700 bg-emerald-50 border-emerald-200 text-[10px]">
                          Working
                        </Badge>
                      ) : asset.status === 'needs_repair' ? (
                        <Badge variant="destructive" className="text-[10px]">
                          Needs Repair
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Out of Service
                        </Badge>
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-600">
                      {formatDate(asset.last_service_date)}
                    </td>

                    {/* Next Due Cell with Highlighting */}
                    <td className="py-3 px-4 font-semibold">
                      {health.color === 'red' ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-100 text-red-800 text-[11px] font-bold border border-red-200">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          <span>{health.label}</span>
                        </div>
                      ) : health.color === 'amber' ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-300">
                          <Clock className="h-3.5 w-3.5 shrink-0" />
                          <span>{health.label}</span>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-emerald-700 text-xs font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                          <span>{health.label}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <Button
                        size="sm"
                        onClick={() => setSelectedAsset(asset)}
                        className="h-8 text-xs font-semibold bg-[var(--brand-primary,#ea580c)] hover:opacity-90 gap-1.5 shadow-2xs"
                      >
                        <Wrench className="h-3.5 w-3.5" />
                        <span>Log Service</span>
                      </Button>
                    </td>
                  </tr>
                );
              })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View (Cards) */}
        <div className="sm:hidden divide-y divide-slate-100">
          {filteredAssets.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No equipment matches your search or health filter.
            </div>
          ) : (
          filteredAssets.map((asset) => {
            const health = getServiceHealth(asset.next_service_due);

            return (
              <div key={asset.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm leading-tight">{asset.name}</h3>
                    <p className="text-xs text-slate-400 capitalize mt-0.5">
                      {asset.category} {asset.model ? `• ${asset.model}` : ''}
                    </p>
                  </div>

                  <div>
                    {asset.status === 'working' ? (
                      <Badge variant="outline" className="text-emerald-700 bg-emerald-50 text-[10px]">
                        Working
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px]">
                        {asset.status}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Service Alarm Block */}
                <div
                  className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                    health.color === 'red'
                      ? 'bg-red-50 border-red-200 text-red-900 font-bold'
                      : health.color === 'amber'
                      ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    {health.color === 'red' ? (
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
                    ) : health.color === 'amber' ? (
                      <Clock className="h-4 w-4 text-amber-600 shrink-0" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    )}
                    <span>{health.label}</span>
                  </div>

                  <span className="text-[10px] text-slate-500 font-normal">
                    Last: {formatDate(asset.last_service_date)}
                  </span>
                </div>

                <Button
                  size="sm"
                  onClick={() => setSelectedAsset(asset)}
                  className="w-full min-h-[44px] text-xs font-semibold bg-[var(--brand-primary,#ea580c)] hover:opacity-90 gap-1.5"
                >
                  <Wrench className="h-3.5 w-3.5" />
                  <span>Log Maintenance Service</span>
                </Button>
              </div>
            );
          })
          )}
        </div>
      </div>

      {/* Log Service Modal */}
      {selectedAsset && (
        <LogServiceModal
          asset={selectedAsset}
          isOpen={!!selectedAsset}
          onClose={() => setSelectedAsset(null)}
        />
      )}
    </div>
  );
}


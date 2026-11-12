'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { TrendingUp, Store, Loader2 } from 'lucide-react';
import { Money } from '@/components/shared/format-values';
import { formatMoney, formatINRCompact } from '@/lib/calculations/format';
import { DemoShop } from '@/lib/demo-admin-data';
import { cn } from '@/lib/utils';

export interface ProgressPoint {
  date: string;
  income: number;
  expense: number;
  profit: number;
}

interface OverallProgressChartProps {
  shops: DemoShop[];
  initialPoints: ProgressPoint[];
  initialStartDate: string;
  initialEndDate: string;
}

type MetricKey = 'income' | 'expense' | 'profit';
type PeriodKey = '7d' | '30d' | 'month' | 'custom';

function formatShortDateLabel(isoDate: string): string {
  try {
    const dt = new Date(`${isoDate}T00:00:00Z`);
    return dt.toLocaleDateString('en-IN', {
      timeZone: 'UTC',
      day: '2-digit',
      month: 'short',
    });
  } catch {
    return isoDate;
  }
}

export function OverallProgressChart({
  shops,
  initialPoints,
  initialStartDate,
  initialEndDate,
}: OverallProgressChartProps) {
  const [metric, setMetric] = useState<MetricKey>('income');
  const [period, setPeriod] = useState<PeriodKey>('30d');
  const [shopId, setShopId] = useState<string>('all');
  const [customStart, setCustomStart] = useState(initialStartDate);
  const [customEnd, setCustomEnd] = useState(initialEndDate);
  const [points, setPoints] = useState<ProgressPoint[]>(initialPoints);
  const [isLoading, setIsLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const loadSeries = useCallback(
    async (nextPeriod: PeriodKey, nextShopId: string, start: string, end: string) => {
      setIsLoading(true);
      try {
        const qs = new URLSearchParams({
          period: nextPeriod,
          shopId: nextShopId,
        });
        if (nextPeriod === 'custom') {
          qs.set('start', start);
          qs.set('end', end);
        }
        const res = await fetch(`/api/admin/progress?${qs.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.points)) {
          setPoints(data.points);
          setActiveIndex(null);
        }
      } catch (err) {
        console.error('Failed to fetch progress series:', err);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Sync if period or shop changes (skip redundant fetch on very first mount if 30d + all)
  const [hasInteracted, setHasInteracted] = useState(false);

  useEffect(() => {
    if (!hasInteracted) return;
    if (period === 'custom') return;
    loadSeries(period, shopId, customStart, customEnd);
  }, [period, shopId, hasInteracted, loadSeries, customStart, customEnd]);

  const metricMeta = {
    income: {
      label: 'Income',
      color: 'var(--brand-primary, #ea580c)',
      fill: 'var(--brand-primary, #ea580c)',
    },
    expense: {
      label: 'Expense',
      color: '#dc2626',
      fill: '#dc2626',
    },
    profit: {
      label: 'Profit',
      color: 'var(--brand-secondary, #0f766e)',
      fill: 'var(--brand-secondary, #0f766e)',
    },
  }[metric];

  const stats = useMemo(() => {
    if (points.length === 0) {
      return { total: 0, avg: 0, peak: 0, peakDate: '-' };
    }
    let total = 0;
    let peak = -Infinity;
    let peakDate = points[0].date;
    points.forEach((p) => {
      const v = p[metric];
      total += v;
      if (v > peak) {
        peak = v;
        peakDate = p.date;
      }
    });
    return {
      total,
      avg: total / points.length,
      peak: peak === -Infinity ? 0 : peak,
      peakDate,
    };
  }, [points, metric]);

  // SVG Chart Geometry
  const W = 760;
  const H = 240;
  const PAD_L = 58;
  const PAD_R = 16;
  const PAD_T = 18;
  const PAD_B = 34;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;

  const { minVal, maxVal, coords, gridTicks } = useMemo(() => {
    const vals = points.map((p) => p[metric]);
    let lo = vals.length > 0 ? Math.min(0, ...vals) : 0;
    let hi = vals.length > 0 ? Math.max(0, ...vals) : 1000;
    if (hi === lo) hi = lo + 1000;
    const pad = (hi - lo) * 0.1;
    hi += pad;
    if (lo < 0) lo -= pad * 0.5;

    const scaleX = (i: number) =>
      points.length <= 1 ? PAD_L + plotW / 2 : PAD_L + (i / (points.length - 1)) * plotW;
    const scaleY = (v: number) => PAD_T + plotH - ((v - lo) / (hi - lo)) * plotH;

    const pts = points.map((p, i) => ({
      x: scaleX(i),
      y: scaleY(p[metric]),
      point: p,
    }));

    const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
      const val = lo + (hi - lo) * t;
      return { val, y: scaleY(val) };
    });

    return { minVal: lo, maxVal: hi, coords: pts, gridTicks: ticks };
  }, [points, metric, plotW, plotH]);

  const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const baselineY =
    PAD_T + plotH - ((0 - minVal) / (maxVal - minVal || 1)) * plotH;
  const areaPath =
    coords.length >= 2
      ? `M ${coords[0].x.toFixed(1)},${baselineY.toFixed(1)} ` +
        coords.map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ') +
        ` L ${coords[coords.length - 1].x.toFixed(1)},${baselineY.toFixed(1)} Z`
      : '';

  const handleSvgPointer = (clientX: number, svgEl: SVGSVGElement) => {
    if (coords.length === 0) return;
    const rect = svgEl.getBoundingClientRect();
    const relX = ((clientX - rect.left) / rect.width) * W;
    let nearestIdx = 0;
    let bestDist = Infinity;
    coords.forEach((c, idx) => {
      const dist = Math.abs(c.x - relX);
      if (dist < bestDist) {
        bestDist = dist;
        nearestIdx = idx;
      }
    });
    setActiveIndex(nearestIdx);
  };

  const activeCoord = activeIndex !== null ? coords[activeIndex] || null : null;
  const selectedShopName =
    shopId === 'all' ? 'All Shops' : shops.find((s) => s.id === shopId)?.name || 'Selected Shop';

  return (
    <div className="report-card-surface rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--brand-primary,#ea580c)]" />
            <span>Overall Progress - {selectedShopName}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily trend from consolidated shop ledgers ({metricMeta.label.toLowerCase()}). Hover or tap a day to inspect.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Metric Toggle */}
          <div className="inline-flex items-center rounded-md bg-slate-100 p-0.5 border border-slate-200">
            {(['income', 'expense', 'profit'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={cn(
                  'no-brand-radius px-2.5 py-1 text-xs font-semibold rounded transition-colors capitalize cursor-pointer',
                  metric === m
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Period Selector */}
          <div className="inline-flex items-center rounded-md bg-slate-100 p-0.5 border border-slate-200">
            {(
              [
                { key: '7d', label: '7 days' },
                { key: '30d', label: '30 days' },
                { key: 'month', label: 'This month' },
                { key: 'custom', label: 'Custom' },
              ] as const
            ).map((p) => (
              <button
                key={p.key}
                type="button"
                onClick={() => {
                  setHasInteracted(true);
                  setPeriod(p.key);
                }}
                className={cn(
                  'no-brand-radius px-2.5 py-1 text-xs font-semibold rounded transition-colors cursor-pointer',
                  period === p.key
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Shop Filter */}
          <div className="flex items-center gap-1.5">
            <Store className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <select
              value={shopId}
              onChange={(e) => {
                setHasInteracted(true);
                setShopId(e.target.value);
              }}
              aria-label="Filter progress chart by shop"
              className="text-xs px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#ea580c)]"
            >
              <option value="all">All shops</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {period === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-slate-50 rounded-md border border-slate-200 text-xs">
          <span className="font-semibold text-slate-600">Date Range:</span>
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded-md bg-white"
          />
          <span className="text-slate-400">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-2 py-1 border border-slate-300 rounded-md bg-white"
          />
          <button
            type="button"
            onClick={() => loadSeries('custom', shopId, customStart, customEnd)}
            className="px-3 py-1 bg-[var(--brand-primary,#ea580c)] text-white font-semibold rounded-md hover:opacity-90 cursor-pointer"
          >
            Apply
          </button>
        </div>
      )}

      {/* Quick Summary Strip */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="px-3 py-2 rounded-md bg-slate-50 border border-slate-100">
          <span className="text-[11px] text-slate-500 block">Period {metricMeta.label}</span>
          <span className="font-bold text-slate-900 text-sm">
            <Money value={stats.total} />
          </span>
        </div>
        <div className="px-3 py-2 rounded-md bg-slate-50 border border-slate-100">
          <span className="text-[11px] text-slate-500 block">Daily Average</span>
          <span className="font-bold text-slate-900 text-sm">
            <Money value={stats.avg} />
          </span>
        </div>
        <div className="px-3 py-2 rounded-md bg-slate-50 border border-slate-100">
          <span className="text-[11px] text-slate-500 block">
            Highest Day ({formatShortDateLabel(stats.peakDate)})
          </span>
          <span className="font-bold text-slate-900 text-sm">
            <Money value={stats.peak} />
          </span>
        </div>
      </div>

      {/* Interactive SVG Line Chart */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 rounded-md">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--brand-primary,#ea580c)]" />
          </div>
        )}

        {points.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-md">
            No daily summary entries recorded for this period yet.
          </div>
        ) : (
          <div className="w-full overflow-hidden">
            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="w-full h-56 sm:h-64 select-none touch-pan-y"
              onMouseMove={(e) => handleSvgPointer(e.clientX, e.currentTarget)}
              onMouseLeave={() => setActiveIndex(null)}
              onClick={(e) => handleSvgPointer(e.clientX, e.currentTarget)}
              role="img"
              aria-label={`Overall Progress line chart showing ${metricMeta.label}`}
            >
              <defs>
                <linearGradient id="progressAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={metricMeta.fill} stopOpacity="0.22" />
                  <stop offset="100%" stopColor={metricMeta.fill} stopOpacity="0.01" />
                </linearGradient>
              </defs>

              {/* Y-Axis Gridlines */}
              {gridTicks.map((t, idx) => (
                <g key={idx}>
                  <line
                    x1={PAD_L}
                    x2={W - PAD_R}
                    y1={t.y}
                    y2={t.y}
                    stroke="#e2e8f0"
                    strokeDasharray="3 3"
                    strokeWidth="1"
                  />
                  <text
                    x={PAD_L - 8}
                    y={t.y + 3}
                    textAnchor="end"
                    fontSize="10"
                    fill="#64748b"
                  >
                    {formatINRCompact(t.val)}
                  </text>
                </g>
              ))}

              {/* Zero baseline if profit dips negative */}
              {minVal < 0 && (
                <line
                  x1={PAD_L}
                  x2={W - PAD_R}
                  y1={baselineY}
                  y2={baselineY}
                  stroke="#94a3b8"
                  strokeWidth="1"
                />
              )}

              {/* Area fill */}
              {areaPath && <path d={areaPath} fill="url(#progressAreaGrad)" />}

              {/* Line */}
              {coords.length >= 2 && (
                <polyline
                  fill="none"
                  stroke={metricMeta.color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={polylinePoints}
                />
              )}

              {/* Data points */}
              {coords.map((c, idx) => {
                const showDot = coords.length <= 15 || idx === activeIndex;
                if (!showDot) return null;
                return (
                  <circle
                    key={c.point.date}
                    cx={c.x}
                    cy={c.y}
                    r={idx === activeIndex ? 5 : 3}
                    fill="#ffffff"
                    stroke={metricMeta.color}
                    strokeWidth="2.5"
                  />
                );
              })}

              {/* X-Axis Labels (~6 evenly spaced dates) */}
              {coords.map((c, idx) => {
                const step = Math.max(1, Math.ceil(coords.length / 6));
                if (idx !== 0 && idx !== coords.length - 1 && idx % step !== 0) return null;
                return (
                  <text
                    key={c.point.date}
                    x={c.x}
                    y={H - 10}
                    textAnchor={
                      idx === 0 ? 'start' : idx === coords.length - 1 ? 'end' : 'middle'
                    }
                    fontSize="10"
                    fill="#64748b"
                  >
                    {formatShortDateLabel(c.point.date)}
                  </text>
                );
              })}

              {/* Crosshair */}
              {activeCoord && (
                <line
                  x1={activeCoord.x}
                  x2={activeCoord.x}
                  y1={PAD_T}
                  y2={H - PAD_B}
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
              )}
            </svg>

            {/* Floating Tooltip */}
            {activeCoord && (
              <div
                className="pointer-events-none absolute top-2 z-20 rounded-md bg-slate-900 text-white px-2.5 py-1.5 text-[11px] shadow-md whitespace-nowrap"
                style={{
                  left: `${Math.min(78, Math.max(8, (activeCoord.x / W) * 100))}%`,
                }}
              >
                <div className="text-slate-300 font-medium">
                  {formatShortDateLabel(activeCoord.point.date)} ({activeCoord.point.date})
                </div>
                <div className="font-bold">
                  {metricMeta.label}: {formatMoney(activeCoord.point[metric])}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

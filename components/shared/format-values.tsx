import React from 'react';
import { formatCount, formatINRCompact, formatMoney } from '@/lib/calculations/format';
import { cn } from '@/lib/utils';

/**
 * Shared Value Display Components for CafeLedger
 * ----------------------------------------------------------------------------
 * STRICT RULE:
 * - Use `<Money value={...} />` ONLY for monetary amounts, balances, income,
 *   expense, profit, salary, cost, and per-unit rates.
 * - Use `<Count value={...} />` for ALL non-money counts (total brands,
 *   shops/outlets, users, employees, assets, entries, days worked, item
 *   counts, payment mode counts, usage counts). NEVER show `₹` on counts.
 */

export function Money({
  value,
  withSymbol = true,
  compact = false,
  className,
}: {
  value: number | string | null | undefined;
  withSymbol?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const num = typeof value === 'string' ? parseFloat(value) : Number(value ?? 0);
  if (compact && !Number.isNaN(num)) {
    const abs = Math.abs(num);
    const sign = num < 0 ? '-' : '';
    let text = formatMoney(num, withSymbol);
    if (abs >= 10000000) text = `${sign}${withSymbol ? '₹' : ''}${(abs / 10000000).toFixed(2)} Cr`;
    else if (abs >= 100000) text = `${sign}${withSymbol ? '₹' : ''}${(abs / 100000).toFixed(2)} L`;
    return <span className={cn('tabular-nums', className)}>{text}</span>;
  }

  return <span className={cn('tabular-nums', className)}>{formatMoney(value, withSymbol)}</span>;
}

export function Count({
  value,
  decimals = 0,
  suffix,
  prefix,
  className,
}: {
  value: number | string | null | undefined;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const formatted = formatCount(value, decimals);
  return (
    <span className={cn('tabular-nums', className)}>
      {prefix ? `${prefix} ` : ''}
      {formatted}
      {suffix ? ` ${suffix}` : ''}
    </span>
  );
}

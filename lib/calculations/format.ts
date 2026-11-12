/**
 * Shared Value Formatting Rules for CafeLedger
 * ----------------------------------------------------------------------------
 * STRICT RULE:
 * - Use `formatMoney()` / `<Money>` ONLY for monetary figures: amounts,
 *   balances, income, expense, profit/loss, salary, cost, and unit rates.
 * - Use `formatCount()` / `<Count>` for ALL non-money numbers: total brands,
 *   shops/outlets, users, employees, assets, entries, days worked, item counts,
 *   payment mode counts, and historical usage counts. NEVER show ₹ on counts.
 */

export function formatMoney(
  amount: number | string | null | undefined,
  includeSymbol: boolean = true
): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return includeSymbol ? '₹0.00' : '0.00';
  }

  const num = typeof amount === 'string' ? parseFloat(amount) : amount;

  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);

  return includeSymbol ? `₹${formatted}` : formatted;
}

export function formatCount(
  value: number | string | null | undefined,
  maxFractionDigits: number = 0
): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '0';
  }

  const num = typeof value === 'string' ? parseFloat(value) : value;

  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: Math.max(0, maxFractionDigits),
  }).format(num);
}

export function formatRatePerUnit(
  rate: number | string | null | undefined,
  unit?: string | null
): string {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) {
    return '-';
  }
  const num = typeof rate === 'string' ? parseFloat(rate) : rate;
  if (num <= 0) return '-';
  const formatted = formatMoney(num, true);
  return unit ? `${formatted} / ${unit}` : formatted;
}

export function formatINRCompact(
  amount: number | string | null | undefined
): string {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) {
    return '₹0';
  }
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `${sign}₹${(abs / 1000).toFixed(1)} k`;
  return `${sign}₹${abs.toFixed(0)}`;
}

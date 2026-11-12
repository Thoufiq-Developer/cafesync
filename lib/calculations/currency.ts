/**
 * Currency & Number formatting utilities for CafeLedger.
 * RULE: Use `formatMoney()` / `formatINR()` ONLY for money (amounts, balances,
 * income, expense, profit, salary, cost). Use `formatCount()` for counts.
 */
import { formatMoney, formatCount, formatRatePerUnit, formatINRCompact } from './format';

export { formatMoney, formatCount, formatRatePerUnit, formatINRCompact };

export function formatINR(amount: number | string | null | undefined, includeSymbol: boolean = true): string {
  return formatMoney(amount, includeSymbol);
}

export function roundINR(val: number): number {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

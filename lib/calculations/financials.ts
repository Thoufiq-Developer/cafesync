/**
 * Financial calculation rules for CafeLedger
 * 
 * Rules:
 * 1. Daily Closing = Opening + Income - Expense
 * 2. Month Opening = Previous Month Closing (auto carry-forward or manual override)
 * 3. Salary Gross = Days Worked * Daily Rate
 * 4. Salary Balance = Gross - Advances - Paid
 * 5. Period Profit / Loss = Total Income - Total Expense (Opening balance excluded)
 * 6. Pagination standard = 50 rows per page
 */

import { roundINR } from './currency';

export const PAGE_SIZE = 50;

export interface DailyLedgerEntry {
  opening: number;
  income: number;
  expense: number;
}

export interface SalaryCalculationInput {
  daysWorked: number;
  ratePerDay: number;
  advancesTotal: number;
  paidTotal: number;
}

export interface SalaryCalculationResult {
  gross: number;
  advancesTotal: number;
  paidTotal: number;
  balance: number;
}

export interface PeriodSummaryInput {
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
}

export interface PeriodSummaryResult {
  openingBalance: number;
  totalIncome: number;
  totalExpense: number;
  netChange: number;
  profitLoss: number; // strictly income - expense, excluding opening
  closingBalance: number;
}

/**
 * Calculates daily closing balance
 */
export function calculateDailyClosing(entry: DailyLedgerEntry): number {
  return roundINR(entry.opening + entry.income - entry.expense);
}

/**
 * Calculates salary breakdown
 */
export function calculateSalary(input: SalaryCalculationInput): SalaryCalculationResult {
  const gross = roundINR(input.daysWorked * input.ratePerDay);
  const balance = roundINR(gross - input.advancesTotal - input.paidTotal);

  return {
    gross,
    advancesTotal: roundINR(input.advancesTotal),
    paidTotal: roundINR(input.paidTotal),
    balance,
  };
}

/**
 * Calculates period financial summary
 */
export function calculatePeriodSummary(input: PeriodSummaryInput): PeriodSummaryResult {
  const netChange = roundINR(input.totalIncome - input.totalExpense);
  const profitLoss = netChange; // Per business rule 5: total income - total expenses
  const closingBalance = roundINR(input.openingBalance + netChange);

  return {
    openingBalance: roundINR(input.openingBalance),
    totalIncome: roundINR(input.totalIncome),
    totalExpense: roundINR(input.totalExpense),
    netChange,
    profitLoss,
    closingBalance,
  };
}

/**
 * Builds formatted note for salary advance transaction
 */
export function formatSalaryAdvanceNote(employeeName: string, customNote?: string | null): string {
  const base = `SA-${employeeName.trim()}`;
  return customNote ? `${base} (${customNote.trim()})` : base;
}


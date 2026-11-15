/**
 * Date utilities for CafeLedger
 * Standardized on timezone 'Asia/Kolkata' and display format DD-MM-YYYY
 */

import { format, parse, startOfMonth, endOfMonth, subMonths, addMonths, isValid } from 'date-fns';

export const TIMEZONE = 'Asia/Kolkata';
export const DISPLAY_DATE_FORMAT = 'dd-MM-yyyy';
export const DB_DATE_FORMAT = 'yyyy-MM-dd';
export const MONTH_FORMAT = 'yyyy-MM';

/**
 * Format a Date or date string to Indian format DD-MM-YYYY
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!isValid(d)) return '-';
  return format(d, DISPLAY_DATE_FORMAT);
}

/**
 * Format to ISO DB date string YYYY-MM-DD
 */
export function formatDBDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, DB_DATE_FORMAT);
}

/**
 * Format to month string YYYY-MM
 */
export function formatMonth(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, MONTH_FORMAT);
}

/**
 * Display formatted month (e.g., "Nov 2026")
 */
export function formatDisplayMonth(monthStr: string): string {
  try {
    const d = parse(monthStr, MONTH_FORMAT, new Date());
    return format(d, 'MMM yyyy');
  } catch {
    return monthStr;
  }
}

/**
 * Parse DD-MM-YYYY to Date
 */
export function parseDate(dateStr: string): Date | null {
  try {
    const parsed = parse(dateStr, DISPLAY_DATE_FORMAT, new Date());
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Get start and end of month in YYYY-MM-DD format
 */
export function getMonthBounds(monthStr: string): { start: string; end: string } {
  const base = parse(monthStr, MONTH_FORMAT, new Date());
  return {
    start: format(startOfMonth(base), DB_DATE_FORMAT),
    end: format(endOfMonth(base), DB_DATE_FORMAT),
  };
}

/**
 * Get previous month string 'YYYY-MM'
 */
export function getPreviousMonth(monthStr: string): string {
  const base = parse(monthStr, MONTH_FORMAT, new Date());
  return format(subMonths(base, 1), MONTH_FORMAT);
}

/**
 * Get next month string 'YYYY-MM'
 */
export function getNextMonth(monthStr: string): string {
  const base = parse(monthStr, MONTH_FORMAT, new Date());
  return format(addMonths(base, 1), MONTH_FORMAT);
}

/**
 * Current date in Asia/Kolkata timezone
 */
export function getTodayKolkata(): string {
  return format(new Date(), DB_DATE_FORMAT);
}

/**
 * Current month in Asia/Kolkata timezone
 */
export function getCurrentMonthKolkata(): string {
  return format(new Date(), MONTH_FORMAT);
}


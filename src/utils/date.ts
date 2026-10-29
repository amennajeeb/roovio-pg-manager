/**
 * Date utilities adhering to Indian conventions (DD/MM/YYYY and DD MMM YYYY).
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

/**
 * Format date string (YYYY-MM-DD) into Indian readable date: "29 Oct 2026"
 */
export function formatIndianDate(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  
  if (isNaN(year) || isNaN(month) || isNaN(day)) return dateStr;
  return `${day.toString().padStart(2, '0')} ${SHORT_MONTH_NAMES[month]} ${year}`;
}

/**
 * Format date string into "DD/MM/YYYY"
 */
export function formatIndianDateShort(dateStr: string): string {
  if (!dateStr) return '—';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

/**
 * Format "YYYY-MM" to readable "October 2026"
 */
export function formatBillingMonth(yearMonth: string): string {
  if (!yearMonth) return '';
  const [year, month] = yearMonth.split('-');
  const mIndex = parseInt(month, 10) - 1;
  if (mIndex >= 0 && mIndex < 12) {
    return `${MONTH_NAMES[mIndex]} ${year}`;
  }
  return yearMonth;
}

/**
 * Get days in a specific year-month (clamps due days that exceed month length)
 */
export function getDaysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Calculate the exact due date for a given billing month and due day.
 * If the month has fewer days than dueDay (e.g. Feb 28/29 or Nov 30 for day 31),
 * it clamps to the final day of the month as required.
 */
export function calculateDueDate(billingMonth: string, dueDay: number): string {
  const [yearStr, monthStr] = billingMonth.split('-');
  const year = parseInt(yearStr, 10);
  const monthIndex = parseInt(monthStr, 10) - 1;
  const maxDays = getDaysInMonth(year, monthIndex);
  const clampedDay = Math.min(Math.max(1, dueDay), maxDays);
  return `${yearStr}-${monthStr.padStart(2, '0')}-${clampedDay.toString().padStart(2, '0')}`;
}

/**
 * Difference in days between two YYYY-MM-DD dates (d2 - d1)
 */
export function diffDays(d1: string, d2: string): number {
  const t1 = new Date(d1).getTime();
  const t2 = new Date(d2).getTime();
  const diffTime = t2 - t1;
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}


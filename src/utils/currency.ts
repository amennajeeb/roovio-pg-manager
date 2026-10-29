/**
 * Currency utilities for Indian Rupee (INR) formatting.
 * Strictly uses Indian number grouping (e.g. 1,04,000 instead of 104,000).
 */

export function formatINR(amount: number, showSign: boolean = false): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  // Format with en-IN locale
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(absAmount);

  if (isNegative) {
    return `-₹${formatted}`;
  }

  if (showSign && amount > 0) {
    return `+₹${formatted}`;
  }

  return `₹${formatted}`;
}

/**
 * Format INR with 2 decimal places if needed (e.g. for exact receipts)
 */
export function formatINRPrecise(amount: number): string {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);

  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(absAmount);

  return isNegative ? `-₹${formatted}` : `₹${formatted}`;
}


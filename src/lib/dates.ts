/** Format a Date as 'YYYY-MM-DD' using its LOCAL calendar day (not UTC). */
export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Today as 'YYYY-MM-DD' in the device's local timezone (not UTC). */
export function localToday(): string {
  return formatLocalDate(new Date());
}

/** 'YYYY-MM-DD' for N days before today, local timezone. */
export function localDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatLocalDate(d);
}

/**
 * Parse a 'YYYY-MM-DD' date-only string at LOCAL midnight.
 * `new Date('YYYY-MM-DD')` parses as UTC midnight, which renders as the
 * previous day in any timezone west of UTC (e.g. Brazil).
 */
export function parseDateOnly(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

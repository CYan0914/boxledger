/** Parses "12", "12.5", "$12.50" into integer cents. Returns null if invalid. */
export function parseMoneyToCents(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '');
  if (cleaned === '') return 0;
  if (!/^\d*(\.\d{0,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value)) return null;
  return Math.round(value * 100);
}

export function centsToInput(cents: number | null): string {
  if (cents === null) return '';
  return (cents / 100).toFixed(2).replace(/\.00$/, '');
}

/** Parses "20" into 0.20. Returns null if out of range. */
export function parsePercent(raw: string): number | null {
  const cleaned = raw.replace(/[%\s]/g, '');
  if (cleaned === '') return 0;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > 100) return null;
  return value / 100;
}

export function percentToInput(fraction: number): string {
  const value = fraction * 100;
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '');
}

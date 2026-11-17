import type { Item } from './types';
import { recordedProfit } from './profit';

/**
 * Tax export. Exactly the six columns the spec asks for, sold items only,
 * newest sale first. RFC 4180 quoting so commas and quotes inside a title do
 * not break the file in Excel.
 */
export function buildTaxCsv(items: Item[]): string {
  const rows = items
    .filter((item) => item.status === 'sold' && item.soldAt && item.salePriceCents !== null)
    .sort((a, b) => (b.soldAt ?? '').localeCompare(a.soldAt ?? ''))
    .map((item) => {
      const profit = recordedProfit(item) ?? 0;
      return [
        (item.soldAt ?? '').slice(0, 10),
        item.title,
        centsToDecimal(item.costCents),
        centsToDecimal(item.salePriceCents ?? 0),
        centsToDecimal(item.feeCents ?? 0),
        centsToDecimal(profit),
      ];
    });

  const header = ['Date', 'Item', 'Cost', 'Sale price', 'Platform fee', 'Profit'];
  return [header, ...rows].map((row) => row.map(escapeCell).join(',')).join('\r\n') + '\r\n';
}

function centsToDecimal(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

function escapeCell(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

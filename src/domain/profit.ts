import { computeFees, configFor, type PlatformFeeConfig } from './fees';
import type { Item, SaleInput } from './types';

export interface ProfitBreakdown {
  salePriceCents: number;
  grossCents: number;
  platformFeeCents: number;
  processingFeeCents: number;
  orderFeeCents: number;
  listingFeeCents: number;
  totalFeeCents: number;
  shippingCostCents: number;
  costCents: number;
  taxReserveCents: number;
  profitCents: number;
}

/**
 * Real profit = sale price − platform fees − shipping the seller paid −
 * acquisition cost − tax reserve.
 *
 * The tax reserve is a percentage of the sale price (not of profit), because
 * that is how sales tax is assessed. It defaults to 0 and is per-item.
 */
export function computeProfit(
  item: Item,
  configs: PlatformFeeConfig[],
  sale: SaleInput
): ProfitBreakdown {
  const config = configFor(configs, item.platform);
  const salePriceCents = Math.max(0, sale.salePriceCents);
  const shippingCostCents = Math.max(0, sale.shippingCostCents);
  const fees = computeFees(config, salePriceCents, shippingCostCents);
  const taxReservePct = Math.min(1, Math.max(0, sale.taxReservePct));
  const taxReserveCents = Math.round(salePriceCents * taxReservePct);

  return {
    salePriceCents,
    grossCents: fees.grossCents,
    platformFeeCents: fees.platformFeeCents,
    processingFeeCents: fees.processingFeeCents,
    orderFeeCents: fees.orderFeeCents,
    listingFeeCents: fees.listingFeeCents,
    totalFeeCents: fees.totalFeeCents,
    shippingCostCents,
    costCents: item.costCents,
    taxReserveCents,
    profitCents:
      salePriceCents -
      fees.totalFeeCents -
      shippingCostCents -
      item.costCents -
      taxReserveCents,
  };
}

/** Profit already recorded on a sold item, or null. */
export function recordedProfit(item: Item): number | null {
  if (item.status !== 'sold' || item.salePriceCents === null || item.feeCents === null) {
    return null;
  }
  const taxReserveCents = Math.round(item.salePriceCents * item.taxReservePct);
  return (
    item.salePriceCents -
    item.feeCents -
    item.shippingCostCents -
    item.costCents -
    taxReserveCents
  );
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const dollars = Math.floor(abs / 100);
  const remainder = abs % 100;
  return `${sign}$${dollars.toLocaleString('en-US')}.${remainder.toString().padStart(2, '0')}`;
}

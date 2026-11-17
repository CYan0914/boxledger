/**
 * Core types. Money is always integer cents so no rounding drift can creep in
 * between the fee engine, the profit figure and the CSV export.
 */

export type PlatformId =
  | 'poshmark'
  | 'ebay'
  | 'mercari'
  | 'etsy'
  | 'depop'
  | 'vinted';

export type ItemStatus = 'in_stock' | 'listed' | 'sold';

export interface Item {
  id: string;
  title: string;
  barcode: string | null;
  photoPath: string | null;
  /** What it cost to acquire. Never negative. */
  costCents: number;
  /** Where it came from: thrift, lot, estate sale, free bin... */
  source: string;
  /** Storage bin code, e.g. B12. Empty string when unassigned. */
  bin: string;
  /** Asking price. Optional while still in stock. */
  listPriceCents: number | null;
  platform: PlatformId;
  status: ItemStatus;
  createdAt: string;
  listedAt: string | null;
  soldAt: string | null;
  /** Actual sale price, set when status becomes sold. */
  salePriceCents: number | null;
  /** Out-of-pocket shipping the seller paid. */
  shippingCostCents: number;
  /** Fee snapshot taken when the item was marked sold. */
  feeCents: number | null;
  /** Tax reserve percentage applied to the sale price, 0-1. */
  taxReservePct: number;
  notes: string;
}

export interface Settings {
  /** Days without a sale before an item counts as stale. */
  staleDays: number;
  /** Default tax reserve percentage for new items, 0-1. */
  defaultTaxReservePct: number;
  /** Free tier cap on the number of items that can be recorded. */
  freeItemLimit: number;
  /**
   * Placeholder for the paid tier. Payments are not implemented in this build;
   * this flag exists so the paywall, the item cap and the CSV export can be
   * wired now and flipped by StoreKit later.
   */
  isPro: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  staleDays: 90,
  defaultTaxReservePct: 0,
  freeItemLimit: 30,
  isPro: false,
};

export interface NewItemInput {
  title: string;
  barcode?: string | null;
  photoPath?: string | null;
  costCents: number;
  source?: string;
  bin?: string;
  listPriceCents?: number | null;
  platform: PlatformId;
  shippingCostCents?: number;
  notes?: string;
}

export interface SaleInput {
  salePriceCents: number;
  shippingCostCents: number;
  taxReservePct: number;
  soldAt?: string;
}

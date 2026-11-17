import type { Item, NewItemInput, PlatformId, SaleInput, Settings } from '../domain/types';
import type { PlatformFeeConfig } from '../domain/fees';

export interface Storage {
  loadItems(): Promise<Item[]>;
  saveItem(item: Item): Promise<void>;
  deleteItem(id: string): Promise<void>;
  loadSettings(): Promise<Settings>;
  saveSettings(settings: Settings): Promise<void>;
  loadFeeConfigs(): Promise<PlatformFeeConfig[]>;
  saveFeeConfigs(configs: PlatformFeeConfig[]): Promise<void>;
  reset(): Promise<void>;
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeItem(input: NewItemInput, settings: Settings, now = new Date()): Item {
  return {
    id: newId(),
    title: input.title.trim(),
    barcode: input.barcode?.trim() || null,
    photoPath: input.photoPath ?? null,
    costCents: Math.max(0, Math.round(input.costCents)),
    source: input.source?.trim() ?? '',
    bin: input.bin?.trim().toUpperCase() ?? '',
    listPriceCents:
      input.listPriceCents === null || input.listPriceCents === undefined
        ? null
        : Math.max(0, Math.round(input.listPriceCents)),
    platform: input.platform,
    status: 'in_stock',
    createdAt: now.toISOString(),
    listedAt: null,
    soldAt: null,
    salePriceCents: null,
    shippingCostCents: Math.max(0, Math.round(input.shippingCostCents ?? 0)),
    feeCents: null,
    taxReservePct: settings.defaultTaxReservePct,
    notes: input.notes?.trim() ?? '',
  };
}

/**
 * The free tier caps how many items can be *recorded*. It never blocks
 * recording a sale on an existing item, and the paid flag lifts it.
 */
export function canAddItem(itemCount: number, settings: Settings): boolean {
  return settings.isPro || itemCount < settings.freeItemLimit;
}

export function applyListing(item: Item, now = new Date()): Item {
  if (item.status !== 'in_stock') return item;
  return { ...item, status: 'listed', listedAt: now.toISOString() };
}

export function applySale(item: Item, sale: SaleInput, feeCents: number, now = new Date()): Item {
  return {
    ...item,
    status: 'sold',
    soldAt: sale.soldAt ?? now.toISOString(),
    salePriceCents: Math.max(0, Math.round(sale.salePriceCents)),
    shippingCostCents: Math.max(0, Math.round(sale.shippingCostCents)),
    taxReservePct: Math.min(1, Math.max(0, sale.taxReservePct)),
    feeCents,
  };
}

export function filterItems(
  items: Item[],
  query: string,
  platform: PlatformId | 'all',
  status: Item['status'] | 'all'
): Item[] {
  const q = query.trim().toLowerCase();
  return items
    .filter((item) => (platform === 'all' ? true : item.platform === platform))
    .filter((item) => (status === 'all' ? true : item.status === status))
    .filter((item) => {
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        (item.barcode ?? '').toLowerCase().includes(q) ||
        item.bin.toLowerCase().includes(q) ||
        item.source.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

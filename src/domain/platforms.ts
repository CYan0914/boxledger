import type { PlatformId } from './types';

export const PLATFORM_ORDER: PlatformId[] = [
  'poshmark',
  'ebay',
  'mercari',
  'etsy',
  'depop',
  'vinted',
];

const LABELS: Record<PlatformId, string> = {
  poshmark: 'Poshmark',
  ebay: 'eBay',
  mercari: 'Mercari',
  etsy: 'Etsy',
  depop: 'Depop',
  vinted: 'Vinted',
};

export function platformLabel(platform: PlatformId): string {
  return LABELS[platform] ?? platform;
}

export const STATUS_LABELS = {
  in_stock: 'In stock',
  listed: 'Listed',
  sold: 'Sold',
} as const;

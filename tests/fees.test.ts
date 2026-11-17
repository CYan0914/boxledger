import { describe, expect, it } from 'vitest';
import {
  computeFees,
  configFor,
  DEFAULT_FEE_CONFIGS,
} from '../src/domain/fees';
import { computeProfit, formatMoney, recordedProfit } from '../src/domain/profit';
import { buildTaxCsv } from '../src/domain/csv';
import { isStale } from '../src/domain/dates';
import { applySale, canAddItem, filterItems, makeItem } from '../src/data/storage';
import type { Item, Settings } from '../src/domain/types';

const settings: Settings = {
  staleDays: 90,
  defaultTaxReservePct: 0,
  freeItemLimit: 30,
  isPro: false,
};

function cfg(id: Parameters<typeof configFor>[1]) {
  return configFor(DEFAULT_FEE_CONFIGS, id);
}

function fee(id: Parameters<typeof configFor>[1], sale: number, shipping = 0) {
  return computeFees(cfg(id), sale, shipping).totalFeeCents;
}

function itemAt(platform: Parameters<typeof configFor>[1], costCents: number): Item {
  return makeItem(
    { title: 'Test item', costCents, platform, bin: 'B12' },
    settings
  );
}

describe('Poshmark', () => {
  it('charges a flat $2.95 below $15', () => {
    expect(fee('poshmark', 1000)).toBe(295);
    expect(fee('poshmark', 1499)).toBe(295);
  });

  it('charges 20% at exactly $15 — the boundary side that must not stay flat', () => {
    expect(fee('poshmark', 1500)).toBe(300);
  });

  it('charges 20% above $15 and ignores shipping', () => {
    expect(fee('poshmark', 10000, 800)).toBe(2000);
  });
});

describe('eBay', () => {
  it('charges 13.6% on the sale plus the $0.40 per-order fee above $10', () => {
    expect(fee('ebay', 10000)).toBe(1360 + 40);
  });

  it('charges the $0.30 per-order fee at $10 and below', () => {
    // $10 order: 13.6% = $1.36, per-order $0.30 (the "or less" band).
    expect(fee('ebay', 1000)).toBe(136 + 30);
  });

  it('charges on shipping as well as the item', () => {
    // $100 item + $10 shipping = $110 gross -> $14.96 + $0.40.
    expect(fee('ebay', 10000, 1000)).toBe(1496 + 40);
  });

  it('applies the lower rate only to the portion above $7,500', () => {
    // $7,600: 13.6% of 7,500 = $1,020.00, 2.35% of 100 = $2.35.
    expect(fee('ebay', 760000)).toBe(102000 + 235 + 40);
  });
});

describe('Mercari', () => {
  it('charges a flat 10% and includes buyer-paid shipping', () => {
    expect(fee('mercari', 10000, 1000)).toBe(1100);
  });

  it('has no extra processing or per-order fee', () => {
    const parts = computeFees(cfg('mercari'), 5000, 0);
    expect(parts.processingFeeCents).toBe(0);
    expect(parts.orderFeeCents).toBe(0);
  });
});

describe('Etsy', () => {
  it('charges 6.5% + 3% + $0.25 + $0.20 listing', () => {
    // 100.00: 6.50 transaction, 3.00 processing, 0.25 fixed, 0.20 listing.
    expect(fee('etsy', 10000)).toBe(650 + 300 + 25 + 20);
  });

  it('includes shipping in both the transaction and processing base', () => {
    // 110.00 gross: 7.15 + 3.30 + 0.25 + 0.20.
    expect(fee('etsy', 10000, 1000)).toBe(715 + 330 + 25 + 20);
  });
});

describe('Depop', () => {
  it('charges 0% selling fee and 3.3% + $0.45 processing (US)', () => {
    expect(fee('depop', 10000)).toBe(330 + 45);
  });

  it('charges processing on shipping too', () => {
    // 110.00 gross: 3.63 + 0.45.
    expect(fee('depop', 10000, 1000)).toBe(363 + 45);
  });
});

describe('Vinted', () => {
  it('charges the seller nothing', () => {
    expect(fee('vinted', 10000, 500)).toBe(0);
  });

  it('has no fee on shipping either', () => {
    expect(cfg('vinted').feeOnShipping).toBe(false);
  });
});

describe('profit', () => {
  it('subtracts fees, shipping, cost and tax reserve from the sale price', () => {
    const item = itemAt('poshmark', 2000);
    const sale = { salePriceCents: 10000, shippingCostCents: 800, taxReservePct: 0.1 };
    const profit = computeProfit(item, DEFAULT_FEE_CONFIGS, sale);
    // 100.00 - 20.00 fee - 8.00 shipping - 20.00 cost - 10.00 tax reserve = 42.00
    expect(profit.profitCents).toBe(4200);
    expect(profit.taxReserveCents).toBe(1000);
  });

  it('can be negative on a bad flip', () => {
    const item = itemAt('ebay', 5000);
    const profit = computeProfit(item, DEFAULT_FEE_CONFIGS, {
      salePriceCents: 4000,
      shippingCostCents: 900,
      taxReservePct: 0,
    });
    // eBay charges on the $49.00 gross (item + shipping): 13.6% = $6.66,
    // plus the $0.40 per-order fee. 40.00 - 7.06 - 9.00 - 50.00.
    expect(profit.profitCents).toBe(4000 - 706 - 900 - 5000);
    expect(profit.profitCents).toBeLessThan(0);
  });

  it('records profit on a sold item after fees are snapshotted', () => {
    const item = itemAt('mercari', 3000);
    const sale = { salePriceCents: 9000, shippingCostCents: 700, taxReservePct: 0 };
    const computed = computeProfit(item, DEFAULT_FEE_CONFIGS, sale);
    const sold = applySale(item, sale, computed.totalFeeCents);
    expect(recordedProfit(sold)).toBe(computed.profitCents);
    expect(recordedProfit(item)).toBeNull();
  });

  it('formats negative money without losing the sign', () => {
    expect(formatMoney(-50)).toBe('-$0.50');
    expect(formatMoney(123456)).toBe('$1,234.56');
  });
});

describe('tax CSV', () => {
  it('exports only sold items with the six required columns', () => {
    const sold = applySale(
      itemAt('ebay', 2500),
      { salePriceCents: 8000, shippingCostCents: 600, taxReservePct: 0 },
      1000
    );
    const csv = buildTaxCsv([sold, itemAt('etsy', 1000)]);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('Date,Item,Cost,Sale price,Platform fee,Profit');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('25.00');
    expect(lines[1]).toContain('80.00');
    expect(lines[1]).toContain('10.00');
  });

  it('quotes titles that contain a comma', () => {
    const sold = applySale(
      { ...itemAt('etsy', 100), title: 'Shirt, blue' },
      { salePriceCents: 1000, shippingCostCents: 0, taxReservePct: 0 },
      0
    );
    const csv = buildTaxCsv([sold]);
    expect(csv).toContain('"Shirt, blue"');
  });
});

describe('stale items', () => {
  const now = new Date('2026-11-17T12:00:00Z');

  it('uses the listing date when the item was listed', () => {
    const item: Item = {
      ...itemAt('poshmark', 1000),
      createdAt: '2026-01-01T00:00:00Z',
      listedAt: '2026-11-10T00:00:00Z',
      status: 'listed',
    };
    expect(isStale(item, 90, now)).toBe(false);
  });

  it('counts from intake when never listed, and ignores sold items', () => {
    const neverListed: Item = {
      ...itemAt('poshmark', 1000),
      createdAt: '2026-06-01T00:00:00Z',
    };
    expect(isStale(neverListed, 90, now)).toBe(true);
    expect(isStale({ ...neverListed, status: 'sold' }, 90, now)).toBe(false);
  });
});

describe('inventory search', () => {
  it('finds an item by bin, barcode, title or source', () => {
    const a: Item = {
      ...itemAt('poshmark', 1000),
      title: 'Levi 501',
      bin: 'B12',
      barcode: '9781234567897',
      source: 'Goodwill',
    };
    const b: Item = { ...itemAt('ebay', 2000), title: 'Coach bag', bin: 'C03' };
    const all = [a, b];
    expect(filterItems(all, 'b12', 'all', 'all').map((i) => i.id)).toEqual([a.id]);
    expect(filterItems(all, 'coach', 'all', 'all').map((i) => i.id)).toEqual([b.id]);
    expect(filterItems(all, '9781234', 'all', 'all').map((i) => i.id)).toEqual([a.id]);
    expect(filterItems(all, 'goodwill', 'all', 'all').map((i) => i.id)).toEqual([a.id]);
    expect(filterItems(all, '', 'ebay', 'all').map((i) => i.id)).toEqual([b.id]);
  });
});

describe('free tier cap', () => {
  it('stops at 30 items on the free tier', () => {
    expect(canAddItem(29, settings)).toBe(true);
    expect(canAddItem(30, settings)).toBe(false);
    expect(canAddItem(31, settings)).toBe(false);
  });

  it('is lifted by the paid flag', () => {
    expect(canAddItem(5000, { ...settings, isPro: true })).toBe(true);
  });
});

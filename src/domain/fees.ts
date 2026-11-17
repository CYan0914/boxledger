import type { PlatformId } from './types';

/**
 * Fee rules are DATA, not code. Every platform here can be edited in Settings,
 * because these marketplaces change their rates faster than an app update
 * ships. `dataDate` is shown in the UI so the seller knows how fresh the
 * defaults are.
 *
 * Two shapes cover every marketplace in scope:
 *
 *  - `whole`: one rule applies to the entire gross amount. Poshmark is the
 *    reason this exists — under $15 it is a flat $2.95, at or above it is 20%
 *    of the whole sale.
 *  - `marginal`: each band's percentage applies only to the portion of the
 *    sale inside that band. eBay is the reason this exists — 2.35% applies to
 *    the part above $7,500, not to the whole sale.
 */
export interface FeeRule {
  /** Inclusive upper bound of the band, in cents. null means "and up". */
  maxCents: number | null;
  /** Percentage as a number, e.g. 13.6 means 13.6%. */
  percent?: number | null;
  /** Flat amount for this band, in cents. Mutually exclusive with percent. */
  flatCents?: number | null;
}

export interface PlatformFeeConfig {
  id: PlatformId;
  label: string;
  mode: 'whole' | 'marginal';
  rules: FeeRule[];
  /** eBay's per-order fee, also tiered (whole mode). */
  orderFees: FeeRule[];
  /** Payment processing, charged on gross by Etsy and Depop. */
  processingPercent: number;
  processingFixedCents: number;
  /** Charged whether or not the item sells, e.g. Etsy's $0.20. */
  listingFeeCents: number;
  /** Whether the platform charges its fee on shipping too. */
  feeOnShipping: boolean;
  /** ISO date the default numbers were checked. */
  dataDate: string;
  sourceUrl: string;
  notes: string;
}

export interface FeeBreakdown {
  grossCents: number;
  platformFeeCents: number;
  processingFeeCents: number;
  orderFeeCents: number;
  listingFeeCents: number;
  totalFeeCents: number;
}

/**
 * Defaults checked 2026-11-17 against the marketplace's own help pages.
 * Sources are listed per platform and shown in Settings.
 */
export const DEFAULT_FEE_CONFIGS: PlatformFeeConfig[] = [
  {
    id: 'poshmark',
    label: 'Poshmark',
    mode: 'whole',
    rules: [
      // Under $15 is the flat band; exactly $15 is charged 20%. 1499 keeps
      // the boundary on the right side of an inclusive upper bound.
      { maxCents: 1499, flatCents: 295 },
      { maxCents: null, percent: 20 },
    ],
    orderFees: [],
    processingPercent: 0,
    processingFixedCents: 0,
    listingFeeCents: 0,
    feeOnShipping: false,
    dataDate: '2026-11-17',
    sourceUrl: 'https://poshmark.com/posh_guide/get_started_on_poshmark',
    notes: '20% at $15 and up; flat $2.95 below $15. Fee applies to listing price only.',
  },
  {
    id: 'ebay',
    label: 'eBay',
    mode: 'marginal',
    rules: [
      { maxCents: 750000, percent: 13.6 },
      { maxCents: null, percent: 2.35 },
    ],
    orderFees: [
      { maxCents: 1000, flatCents: 30 },
      { maxCents: null, flatCents: 40 },
    ],
    processingPercent: 0,
    processingFixedCents: 0,
    listingFeeCents: 0,
    feeOnShipping: true,
    dataDate: '2026-11-17',
    sourceUrl: 'https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4364',
    notes:
      'Most categories: 13.6% up to $7,500, 2.35% above. Per-order fee $0.30 (orders $10 or less), $0.40 above. First 250 listings/month free.',
  },
  {
    id: 'mercari',
    label: 'Mercari',
    mode: 'whole',
    rules: [{ maxCents: null, percent: 10 }],
    orderFees: [],
    processingPercent: 0,
    processingFixedCents: 0,
    listingFeeCents: 0,
    feeOnShipping: true,
    dataDate: '2026-11-17',
    sourceUrl: 'https://www.mercari.com/us/help_center/article/2517/',
    notes: 'Flat 10% selling fee on item price plus buyer-paid shipping. No seller payment processing fee.',
  },
  {
    id: 'etsy',
    label: 'Etsy',
    mode: 'whole',
    rules: [{ maxCents: null, percent: 6.5 }],
    orderFees: [],
    processingPercent: 3,
    processingFixedCents: 25,
    listingFeeCents: 20,
    feeOnShipping: true,
    dataDate: '2026-11-17',
    sourceUrl: 'https://www.etsy.com/legal/fees/',
    notes: '6.5% transaction fee, 3% + $0.25 payment processing (US), $0.20 listing fee.',
  },
  {
    id: 'depop',
    label: 'Depop',
    mode: 'whole',
    rules: [{ maxCents: null, percent: 0 }],
    orderFees: [],
    processingPercent: 3.3,
    processingFixedCents: 45,
    listingFeeCents: 0,
    feeOnShipping: true,
    dataDate: '2026-11-17',
    sourceUrl: 'https://depophelp.zendesk.com/hc/en-gb/articles/360001791127-Seller-fees-and-charges',
    notes:
      'US and UK sellers: 0% selling fee. Payment processing 3.3% + $0.45 (US), 2.9% + £0.30 (UK). Boosted listings add 12%.',
  },
  {
    id: 'vinted',
    label: 'Vinted',
    mode: 'whole',
    rules: [{ maxCents: null, percent: 0 }],
    orderFees: [],
    processingPercent: 0,
    processingFixedCents: 0,
    listingFeeCents: 0,
    feeOnShipping: false,
    dataDate: '2026-11-17',
    sourceUrl: 'https://www.vinted.com/help/1653',
    notes: 'No seller fees. Buyers pay a protection fee at checkout.',
  },
];

function pickRule(rules: FeeRule[], amountCents: number): FeeRule | null {
  if (rules.length === 0) return null;
  for (const rule of rules) {
    if (rule.maxCents === null || amountCents <= rule.maxCents) return rule;
  }
  // Malformed config that has no open-ended band: fall back to the last rule
  // rather than silently charging nothing.
  return rules[rules.length - 1];
}

function ruleAmount(rule: FeeRule, amountCents: number): number {
  if (typeof rule.flatCents === 'number') return rule.flatCents;
  if (typeof rule.percent === 'number') {
    return Math.round((amountCents * rule.percent) / 100);
  }
  return 0;
}

function platformFee(config: PlatformFeeConfig, grossCents: number): number {
  if (config.mode === 'marginal') {
    let remaining = grossCents;
    let lower = 0;
    let total = 0;
    for (const rule of config.rules) {
      const upper = rule.maxCents === null ? grossCents : Math.min(rule.maxCents, grossCents);
      const portion = Math.max(0, upper - lower);
      if (portion > 0 && typeof rule.percent === 'number') {
        total += Math.round((portion * rule.percent) / 100);
      }
      lower = upper;
      if (lower >= grossCents) break;
    }
    remaining = 0;
    return total;
  }

  const rule = pickRule(config.rules, grossCents);
  return rule ? ruleAmount(rule, grossCents) : 0;
}

export function computeFees(
  config: PlatformFeeConfig,
  salePriceCents: number,
  shippingCostCents: number
): FeeBreakdown {
  const grossCents = Math.max(
    0,
    salePriceCents + (config.feeOnShipping ? Math.max(0, shippingCostCents) : 0)
  );

  const platformFeeCents = platformFee(config, grossCents);
  const processingFeeCents =
    Math.round((grossCents * config.processingPercent) / 100) + config.processingFixedCents;

  const orderRule = pickRule(config.orderFees, grossCents);
  const orderFeeCents = orderRule ? ruleAmount(orderRule, grossCents) : 0;

  const listingFeeCents = config.listingFeeCents;

  return {
    grossCents,
    platformFeeCents,
    processingFeeCents,
    orderFeeCents,
    listingFeeCents,
    totalFeeCents:
      platformFeeCents + processingFeeCents + orderFeeCents + listingFeeCents,
  };
}

export function configFor(
  configs: PlatformFeeConfig[],
  platform: PlatformId
): PlatformFeeConfig {
  const found = configs.find((c) => c.id === platform);
  if (found) return found;
  // A stored item can outlive a deleted config. Charge nothing rather than
  // crash the sale screen, and let Settings show the missing platform.
  return {
    id: platform,
    label: platform,
    mode: 'whole',
    rules: [{ maxCents: null, percent: 0 }],
    orderFees: [],
    processingPercent: 0,
    processingFixedCents: 0,
    listingFeeCents: 0,
    feeOnShipping: false,
    dataDate: '—',
    sourceUrl: '',
    notes: 'No fee configuration found for this platform.',
  };
}

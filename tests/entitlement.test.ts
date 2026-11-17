import { describe, expect, it } from 'vitest';
import {
  PRO_PRODUCT_IDS,
  hasProEntitlement,
  isProProduct,
  planForProduct,
} from '../src/domain/entitlement';

describe('product ids', () => {
  it('recognises both ways to buy Pro and nothing else', () => {
    expect(isProProduct(PRO_PRODUCT_IDS.monthly)).toBe(true);
    expect(isProProduct(PRO_PRODUCT_IDS.lifetime)).toBe(true);
    expect(isProProduct('com.boxledger.app.something')).toBe(false);
    expect(isProProduct(null)).toBe(false);
    expect(isProProduct(undefined)).toBe(false);
  });

  it('maps a product id back to the plan it belongs to', () => {
    expect(planForProduct(PRO_PRODUCT_IDS.monthly)).toBe('monthly');
    expect(planForProduct(PRO_PRODUCT_IDS.lifetime)).toBe('lifetime');
    expect(planForProduct('com.other.app')).toBeNull();
  });
});

describe('entitlement', () => {
  it('unlocks on a purchased subscription', () => {
    expect(
      hasProEntitlement([
        { productId: PRO_PRODUCT_IDS.monthly, purchaseState: 'purchased' },
      ])
    ).toBe(true);
  });

  it('unlocks on a purchased lifetime licence', () => {
    expect(
      hasProEntitlement([
        { productId: PRO_PRODUCT_IDS.lifetime, purchaseState: 'purchased' },
      ])
    ).toBe(true);
  });

  it('does not unlock while Ask to Buy is pending', () => {
    expect(
      hasProEntitlement([{ productId: PRO_PRODUCT_IDS.monthly, purchaseState: 'pending' }])
    ).toBe(false);
  });

  it('ignores purchases that are not ours', () => {
    expect(
      hasProEntitlement([{ productId: 'com.someone.else', purchaseState: 'purchased' }])
    ).toBe(false);
    expect(hasProEntitlement([])).toBe(false);
  });

  it('unlocks if any purchase in the list qualifies', () => {
    expect(
      hasProEntitlement([
        { productId: 'com.someone.else', purchaseState: 'purchased' },
        { productId: PRO_PRODUCT_IDS.lifetime, purchaseState: 'purchased' },
      ])
    ).toBe(true);
  });

  it('treats an unknown state as no entitlement', () => {
    expect(
      hasProEntitlement([{ productId: PRO_PRODUCT_IDS.lifetime, purchaseState: 'unknown' }])
    ).toBe(false);
    expect(hasProEntitlement([{ productId: PRO_PRODUCT_IDS.lifetime }])).toBe(false);
  });
});

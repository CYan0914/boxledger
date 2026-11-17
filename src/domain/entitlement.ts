/**
 * The paid tier is one entitlement with two ways to buy it: a monthly
 * subscription and a one-time purchase. Keeping the product ids and the
 * "does this purchase unlock the app" rule here means the StoreKit layer can
 * be swapped without touching the store, the paywall or the cap logic.
 */
export const PRO_PRODUCT_IDS = {
  monthly: 'com.boxledger.app.pro.monthly',
  lifetime: 'com.boxledger.app.pro.lifetime',
} as const;

export type ProPlan = keyof typeof PRO_PRODUCT_IDS;

const PRO_PRODUCT_ID_SET: ReadonlySet<string> = new Set(Object.values(PRO_PRODUCT_IDS));

export function isProProduct(productId: string | null | undefined): boolean {
  return typeof productId === 'string' && PRO_PRODUCT_ID_SET.has(productId);
}

export function planForProduct(productId: string | null | undefined): ProPlan | null {
  if (productId === PRO_PRODUCT_IDS.monthly) return 'monthly';
  if (productId === PRO_PRODUCT_IDS.lifetime) return 'lifetime';
  return null;
}

/**
 * A purchase unlocks the app when it is one of ours and the store reports it as
 * purchased. Pending (Ask to Buy) and unknown states do not unlock anything.
 */
export function hasProEntitlement(
  purchases: ReadonlyArray<{ productId?: string | null; purchaseState?: string | null }>
): boolean {
  return purchases.some(
    (purchase) => isProProduct(purchase.productId) && purchase.purchaseState === 'purchased'
  );
}

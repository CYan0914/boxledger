import { Platform } from 'react-native';
import * as Iap from 'expo-iap';
import {
  PRO_PRODUCT_IDS,
  hasProEntitlement,
  isProProduct,
  type ProPlan,
} from '../domain/entitlement';

/**
 * StoreKit 2 (via expo-iap). No server: StoreKit's own verified transaction is
 * the source of truth, and it works offline from the on-device cache.
 *
 * The web preview has no StoreKit, so every function here reports
 * "unavailable" instead of throwing — the browser build is a layout check, not
 * a way to buy.
 */
export interface ProOffer {
  plan: ProPlan;
  productId: string;
  title: string;
  /** Localized price straight from the store, e.g. "$4.99" */
  displayPrice: string;
  period: string;
}

export type PurchaseOutcome =
  | { status: 'purchased' }
  | { status: 'cancelled' }
  | { status: 'pending' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

export function storeAvailable(): boolean {
  return Platform.OS === 'ios' || Platform.OS === 'android';
}

let connected = false;

async function connect(): Promise<boolean> {
  if (!storeAvailable()) return false;
  if (connected) return true;
  try {
    connected = await Iap.initConnection();
  } catch {
    connected = false;
  }
  return connected;
}

const PLAN_PERIOD: Record<ProPlan, string> = {
  monthly: 'per month',
  lifetime: 'one time',
};

export async function fetchProOffers(): Promise<ProOffer[]> {
  if (!(await connect())) return [];
  try {
    const [subscriptions, oneTime] = await Promise.all([
      Iap.fetchProducts({ skus: [PRO_PRODUCT_IDS.monthly], type: 'subs' }),
      Iap.fetchProducts({ skus: [PRO_PRODUCT_IDS.lifetime], type: 'in-app' }),
    ]);
    const byId = new Map<string, { displayPrice: string; title: string }>();
    for (const product of [...(subscriptions ?? []), ...(oneTime ?? [])]) {
      byId.set(product.id, {
        displayPrice: product.displayPrice,
        title: product.title || product.displayName || product.id,
      });
    }
    const offers: Array<ProOffer | null> = (Object.keys(PRO_PRODUCT_IDS) as ProPlan[]).map(
      (plan): ProOffer | null => {
        const productId: string = PRO_PRODUCT_IDS[plan];
        const product = byId.get(productId);
        if (!product) return null;
        return {
          plan,
          productId,
          title: product.title,
          displayPrice: product.displayPrice,
          period: PLAN_PERIOD[plan],
        };
      }
    );
    return offers.filter((offer): offer is ProOffer => offer !== null);
  } catch {
    return [];
  }
}

export async function purchasePro(plan: ProPlan): Promise<PurchaseOutcome> {
  if (!(await connect())) {
    return {
      status: 'unavailable',
      message: 'In-app purchases need the iOS app. They are not available in the browser preview.',
    };
  }

  const productId = PRO_PRODUCT_IDS[plan];
  const type = plan === 'monthly' ? 'subs' : 'in-app';

  return new Promise<PurchaseOutcome>((resolve) => {
    let settled = false;

    const updated = Iap.purchaseUpdatedListener(async (purchase) => {
      // Finishing first matters: an unfinished transaction replays on every
      // launch and would keep prompting for a purchase the user already made.
      try {
        await Iap.finishTransaction({ purchase, isConsumable: false });
      } catch {
        // Nothing to recover from here; the entitlement check below still runs.
      }
      if (settle()) {
        if (purchase.purchaseState === 'purchased' && isProProduct(purchase.productId)) {
          resolve({ status: 'purchased' });
        } else if (purchase.purchaseState === 'pending') {
          resolve({ status: 'pending' });
        } else {
          resolve({ status: 'error', message: `Unexpected purchase state: ${purchase.purchaseState}` });
        }
      }
    });

    const errored = Iap.purchaseErrorListener((error) => {
      if (settle()) {
        resolve(
          error.code === Iap.ErrorCode.UserCancelled
            ? { status: 'cancelled' }
            : { status: 'error', message: error.message }
        );
      }
    });

    function settle(): boolean {
      if (settled) return false;
      settled = true;
      updated.remove();
      errored.remove();
      return true;
    }

    Iap.requestPurchase({
      type,
      request: {
        apple: { sku: productId },
        google: { skus: [productId] },
      },
    }).catch((error: unknown) => {
      if (settle()) {
        resolve({
          status: 'error',
          message: error instanceof Error ? error.message : String(error),
        });
      }
    });
  });
}

/** Reads the store's current entitlement. null means "could not ask". */
export async function currentEntitlement(): Promise<boolean | null> {
  if (!(await connect())) return null;
  try {
    const purchases = await Iap.getAvailablePurchases({
      onlyIncludeActiveItemsIOS: true,
      alsoPublishToEventListenerIOS: false,
    });
    return hasProEntitlement(purchases);
  } catch {
    return null;
  }
}

/**
 * StoreKit requires a user-visible restore path even for non-consumables.
 * Returns null when the store could not be reached.
 */
export async function restoreEntitlement(): Promise<boolean | null> {
  if (!(await connect())) return null;
  try {
    await Iap.restorePurchases();
    const purchases = await Iap.getAvailablePurchases({
      onlyIncludeActiveItemsIOS: true,
      alsoPublishToEventListenerIOS: false,
    });
    return hasProEntitlement(purchases);
  } catch {
    return null;
  }
}

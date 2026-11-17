import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { canAddItem, makeItem, applyListing, applySale, type Storage } from '../data/storage';
import { getStorage } from '../data/db';
import type { Item, NewItemInput, SaleInput, Settings } from '../domain/types';
import type { PlatformFeeConfig } from '../domain/fees';
import type { ProPlan } from '../domain/entitlement';
import { computeProfit, recordedProfit } from '../domain/profit';
import { isStale, monthKey } from '../domain/dates';
import {
  currentEntitlement,
  fetchProOffers,
  purchasePro,
  restoreEntitlement,
  type ProOffer,
  type PurchaseOutcome,
} from '../services/purchases';

export interface AddResult {
  ok: boolean;
  reason?: 'limit';
  item?: Item;
}

interface StoreValue {
  ready: boolean;
  items: Item[];
  settings: Settings;
  configs: PlatformFeeConfig[];
  inStockCount: number;
  inventoryCostCents: number;
  monthProfitCents: number;
  staleItems: Item[];
  proOffers: ProOffer[];
  offersLoading: boolean;
  addItem(input: NewItemInput): Promise<AddResult>;
  updateItem(item: Item): Promise<void>;
  deleteItem(id: string): Promise<void>;
  markListed(id: string): Promise<void>;
  markSold(id: string, sale: SaleInput): Promise<void>;
  saveSettings(next: Settings): Promise<void>;
  saveConfigs(next: PlatformFeeConfig[]): Promise<void>;
  loadOffers(): Promise<void>;
  buyPro(plan: ProPlan): Promise<PurchaseOutcome>;
  restorePro(): Promise<boolean | null>;
  resetAll(): Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const storage: Storage = useMemo(() => getStorage(), []);
  const [ready, setReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [settings, setSettings] = useState<Settings>({
    staleDays: 90,
    defaultTaxReservePct: 0,
    freeItemLimit: 30,
    isPro: false,
  });
  const [configs, setConfigs] = useState<PlatformFeeConfig[]>([]);
  const [proOffers, setProOffers] = useState<ProOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(false);

  const refresh = useCallback(async () => {
    const [loadedItems, loadedSettings, loadedConfigs] = await Promise.all([
      storage.loadItems(),
      storage.loadSettings(),
      storage.loadFeeConfigs(),
    ]);
    setItems(loadedItems);
    setSettings(loadedSettings);
    setConfigs(loadedConfigs);
    setReady(true);
  }, [storage]);

  /**
   * Write the entitlement through the storage layer rather than through a
   * captured `settings` value: the StoreKit callback can land long after the
   * render that started the purchase, and a stale copy would resurrect a
   * cleared flag.
   */
  const setPro = useCallback(
    async (value: boolean) => {
      const current = await storage.loadSettings();
      if (current.isPro === value) return;
      const next = { ...current, isPro: value };
      await storage.saveSettings(next);
      setSettings(next);
    },
    [storage]
  );

  useEffect(() => {
    refresh()
      .then(async () => {
        // StoreKit is the source of truth. null means "could not ask", and an
        // unasked question must not revoke anything.
        const entitled = await currentEntitlement();
        if (entitled !== null) await setPro(entitled);
      })
      .catch(() => setReady(true));
  }, [refresh, setPro]);

  const loadOffers = useCallback(async () => {
    setOffersLoading(true);
    try {
      setProOffers(await fetchProOffers());
    } finally {
      setOffersLoading(false);
    }
  }, []);

  const buyPro = useCallback(
    async (plan: ProPlan): Promise<PurchaseOutcome> => {
      const outcome = await purchasePro(plan);
      if (outcome.status === 'purchased') await setPro(true);
      return outcome;
    },
    [setPro]
  );

  const restorePro = useCallback(async (): Promise<boolean | null> => {
    const entitled = await restoreEntitlement();
    if (entitled !== null) await setPro(entitled);
    return entitled;
  }, [setPro]);

  const addItem = useCallback(
    async (input: NewItemInput): Promise<AddResult> => {
      if (!canAddItem(items.length, settings)) {
        return { ok: false, reason: 'limit' };
      }
      const item = makeItem(input, settings);
      await storage.saveItem(item);
      setItems((prev) => [item, ...prev]);
      return { ok: true, item };
    },
    [items.length, settings, storage]
  );

  const updateItem = useCallback(
    async (item: Item) => {
      await storage.saveItem(item);
      setItems((prev) => prev.map((existing) => (existing.id === item.id ? item : existing)));
    },
    [storage]
  );

  const deleteItem = useCallback(
    async (id: string) => {
      await storage.deleteItem(id);
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [storage]
  );

  const markListed = useCallback(
    async (id: string) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      const next = applyListing(item);
      await updateItem(next);
    },
    [items, updateItem]
  );

  const markSold = useCallback(
    async (id: string, sale: SaleInput) => {
      const item = items.find((i) => i.id === id);
      if (!item) return;
      const preview = computeProfit(item, configs, sale);
      const next = applySale(item, sale, preview.totalFeeCents);
      await updateItem(next);
    },
    [items, configs, updateItem]
  );

  const saveSettings = useCallback(
    async (next: Settings) => {
      await storage.saveSettings(next);
      setSettings(next);
    },
    [storage]
  );

  const saveConfigs = useCallback(
    async (next: PlatformFeeConfig[]) => {
      await storage.saveFeeConfigs(next);
      setConfigs(next);
    },
    [storage]
  );

  const resetAll = useCallback(async () => {
    await storage.reset();
    await refresh();
  }, [storage, refresh]);

  const derived = useMemo(() => {
    const active = items.filter((item) => item.status !== 'sold');
    const inventoryCostCents = active.reduce((sum, item) => sum + item.costCents, 0);
    const thisMonth = monthKey(new Date().toISOString());
    const monthProfitCents = items.reduce((sum, item) => {
      if (item.status !== 'sold' || !item.soldAt) return sum;
      if (monthKey(item.soldAt) !== thisMonth) return sum;
      return sum + (recordedProfit(item) ?? 0);
    }, 0);
    const staleItems = items
      .filter((item) => isStale(item, settings.staleDays))
      .sort((a, b) => (a.listedAt ?? a.createdAt).localeCompare(b.listedAt ?? b.createdAt));
    return {
      inStockCount: active.length,
      inventoryCostCents,
      monthProfitCents,
      staleItems,
    };
  }, [items, settings.staleDays]);

  const value: StoreValue = {
    ready,
    items,
    settings,
    configs,
    ...derived,
    proOffers,
    offersLoading,
    addItem,
    updateItem,
    deleteItem,
    markListed,
    markSold,
    saveSettings,
    saveConfigs,
    loadOffers,
    buyPro,
    restorePro,
    resetAll,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside StoreProvider');
  return value;
}

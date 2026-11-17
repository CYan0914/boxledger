import { Platform } from 'react-native';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Item, Settings } from '../domain/types';
import { DEFAULT_SETTINGS } from '../domain/types';
import { DEFAULT_FEE_CONFIGS, type PlatformFeeConfig } from '../domain/fees';
import type { Storage } from './storage';

/**
 * SQLite on device. Photos stay on disk as files (path in `photo_path`), never
 * as blobs — a phone with 3,000 items should not hit the database with
 * megabytes of JPEG per query.
 *
 * expo-sqlite's web build needs a WASM asset pipeline; rather than make the
 * native path depend on that, the web preview uses a localStorage adapter with
 * the same interface. The shipped targets are iOS and Android.
 */
let dbPromise: Promise<SQLiteDatabase> | null = null;

async function getDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const SQLite = await import('expo-sqlite');
      const db = await SQLite.openDatabaseAsync('boxledger.db');
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS items (
          id TEXT PRIMARY KEY NOT NULL,
          title TEXT NOT NULL,
          barcode TEXT,
          photo_path TEXT,
          cost_cents INTEGER NOT NULL,
          source TEXT NOT NULL DEFAULT '',
          bin TEXT NOT NULL DEFAULT '',
          list_price_cents INTEGER,
          platform TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          listed_at TEXT,
          sold_at TEXT,
          sale_price_cents INTEGER,
          shipping_cost_cents INTEGER NOT NULL DEFAULT 0,
          fee_cents INTEGER,
          tax_reserve_pct REAL NOT NULL DEFAULT 0,
          notes TEXT NOT NULL DEFAULT ''
        );
        CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
        CREATE INDEX IF NOT EXISTS idx_items_bin ON items(bin);
        CREATE INDEX IF NOT EXISTS idx_items_platform ON items(platform);
        CREATE TABLE IF NOT EXISTS fee_configs (
          platform TEXT PRIMARY KEY NOT NULL,
          json TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

interface ItemRow {
  id: string;
  title: string;
  barcode: string | null;
  photo_path: string | null;
  cost_cents: number;
  source: string;
  bin: string;
  list_price_cents: number | null;
  platform: string;
  status: string;
  created_at: string;
  listed_at: string | null;
  sold_at: string | null;
  sale_price_cents: number | null;
  shipping_cost_cents: number;
  fee_cents: number | null;
  tax_reserve_pct: number;
  notes: string;
}

function rowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    title: row.title,
    barcode: row.barcode,
    photoPath: row.photo_path,
    costCents: row.cost_cents,
    source: row.source,
    bin: row.bin,
    listPriceCents: row.list_price_cents,
    platform: row.platform as Item['platform'],
    status: row.status as Item['status'],
    createdAt: row.created_at,
    listedAt: row.listed_at,
    soldAt: row.sold_at,
    salePriceCents: row.sale_price_cents,
    shippingCostCents: row.shipping_cost_cents,
    feeCents: row.fee_cents,
    taxReservePct: row.tax_reserve_pct,
    notes: row.notes,
  };
}

export class SQLiteStorage implements Storage {
  async loadItems(): Promise<Item[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<ItemRow>('SELECT * FROM items ORDER BY created_at DESC');
    return rows.map(rowToItem);
  }

  async saveItem(item: Item): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO items (
        id, title, barcode, photo_path, cost_cents, source, bin, list_price_cents,
        platform, status, created_at, listed_at, sold_at, sale_price_cents,
        shipping_cost_cents, fee_cents, tax_reserve_pct, notes
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        title=excluded.title, barcode=excluded.barcode, photo_path=excluded.photo_path,
        cost_cents=excluded.cost_cents, source=excluded.source, bin=excluded.bin,
        list_price_cents=excluded.list_price_cents, platform=excluded.platform,
        status=excluded.status, listed_at=excluded.listed_at, sold_at=excluded.sold_at,
        sale_price_cents=excluded.sale_price_cents,
        shipping_cost_cents=excluded.shipping_cost_cents, fee_cents=excluded.fee_cents,
        tax_reserve_pct=excluded.tax_reserve_pct, notes=excluded.notes`,
      [
        item.id,
        item.title,
        item.barcode,
        item.photoPath,
        item.costCents,
        item.source,
        item.bin,
        item.listPriceCents,
        item.platform,
        item.status,
        item.createdAt,
        item.listedAt,
        item.soldAt,
        item.salePriceCents,
        item.shippingCostCents,
        item.feeCents,
        item.taxReservePct,
        item.notes,
      ]
    );
  }

  async deleteItem(id: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM items WHERE id = ?', [id]);
  }

  async loadSettings(): Promise<Settings> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'settings'"
    );
    if (!row) return { ...DEFAULT_SETTINGS };
    try {
      return { ...DEFAULT_SETTINGS, ...(JSON.parse(row.value) as Partial<Settings>) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings(settings: Settings): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "INSERT INTO settings (key, value) VALUES ('settings', ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      [JSON.stringify(settings)]
    );
  }

  async loadFeeConfigs(): Promise<PlatformFeeConfig[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ platform: string; json: string }>(
      'SELECT platform, json FROM fee_configs'
    );
    if (rows.length === 0) {
      for (const config of DEFAULT_FEE_CONFIGS) {
        await this.saveFeeConfig(config);
      }
      return DEFAULT_FEE_CONFIGS.map((c) => ({ ...c }));
    }
    const byId = new Map<string, PlatformFeeConfig>();
    for (const row of rows) {
      try {
        byId.set(row.platform, JSON.parse(row.json) as PlatformFeeConfig);
      } catch {
        // Skip a corrupt row; the default fills in below.
      }
    }
    return DEFAULT_FEE_CONFIGS.map((fallback) => byId.get(fallback.id) ?? { ...fallback });
  }

  async saveFeeConfigs(configs: PlatformFeeConfig[]): Promise<void> {
    for (const config of configs) {
      await this.saveFeeConfig(config);
    }
  }

  private async saveFeeConfig(config: PlatformFeeConfig): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO fee_configs (platform, json) VALUES (?, ?) ON CONFLICT(platform) DO UPDATE SET json=excluded.json',
      [config.id, JSON.stringify(config)]
    );
  }

  async reset(): Promise<void> {
    const db = await getDb();
    await db.execAsync('DELETE FROM items; DELETE FROM settings; DELETE FROM fee_configs;');
  }
}

const WEB_KEY = 'boxledger.v1';

interface WebState {
  items: Item[];
  settings: Settings;
  configs: PlatformFeeConfig[];
}

export class WebStorage implements Storage {
  private read(): WebState {
    try {
      const raw = globalThis.localStorage?.getItem(WEB_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WebState>;
        return {
          items: parsed.items ?? [],
          settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
          configs: parsed.configs ?? DEFAULT_FEE_CONFIGS,
        };
      }
    } catch {
      // Fall through to defaults.
    }
    return { items: [], settings: { ...DEFAULT_SETTINGS }, configs: DEFAULT_FEE_CONFIGS };
  }

  private write(state: WebState): void {
    try {
      globalThis.localStorage?.setItem(WEB_KEY, JSON.stringify(state));
    } catch {
      // Preview only; nothing depends on persistence here.
    }
  }

  async loadItems(): Promise<Item[]> {
    return this.read().items;
  }

  async saveItem(item: Item): Promise<void> {
    const state = this.read();
    const index = state.items.findIndex((i) => i.id === item.id);
    if (index >= 0) state.items[index] = item;
    else state.items.unshift(item);
    this.write(state);
  }

  async deleteItem(id: string): Promise<void> {
    const state = this.read();
    state.items = state.items.filter((i) => i.id !== id);
    this.write(state);
  }

  async loadSettings(): Promise<Settings> {
    return this.read().settings;
  }

  async saveSettings(settings: Settings): Promise<void> {
    const state = this.read();
    state.settings = settings;
    this.write(state);
  }

  async loadFeeConfigs(): Promise<PlatformFeeConfig[]> {
    return this.read().configs;
  }

  async saveFeeConfigs(configs: PlatformFeeConfig[]): Promise<void> {
    const state = this.read();
    state.configs = configs;
    this.write(state);
  }

  async reset(): Promise<void> {
    this.write({
      items: [],
      settings: { ...DEFAULT_SETTINGS },
      configs: DEFAULT_FEE_CONFIGS.map((c) => ({ ...c })),
    });
  }
}

let storageInstance: Storage | null = null;

export function getStorage(): Storage {
  if (!storageInstance) {
    storageInstance = Platform.OS === 'web' ? new WebStorage() : new SQLiteStorage();
  }
  return storageInstance;
}

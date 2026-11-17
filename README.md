# BoxLedger

Inventory and real-profit tracking for second-hand resellers on Poshmark, eBay,
Mercari, Etsy, Depop and Vinted.

- App name: **BoxLedger**
- iOS bundle id: `com.boxledger.app` (Android package id: `com.cyan0914.boxledger`)
- Price model: free up to 30 recorded items; paid tier $39 one-time or $4.99/month
  (payments are a placeholder in this build, see "Not built yet")

The two things this app does that a spreadsheet does not:

1. **Tells you which bin it is in.** Every item can carry a bin code (`B12`),
   and search answers "where is this" in one query.
2. **Computes profit from the platform's actual fee rules.** Fee rates live in
   an editable table, including tiered rules such as Poshmark's flat $2.95
   below $15 and eBay's 13.6% / 2.35% bands.

Deliberately out of scope: cross-listing, marketplace sync, accounts, cloud
sync, social features, AI pricing, web app.

---

## Tech choice

**Expo (React Native) + TypeScript.**

Reason: this machine is Windows with no Mac. Expo ships iOS through a cloud
macOS runner (GitHub Actions, see `.github/workflows/build.yml`), and the same
code runs in a browser for verification. Flutter's iOS build requires a Mac or
a third-party CI.

- Storage: `expo-sqlite` (SQLite, WAL). Photos are files in the app's document
  directory; the database stores only the path.
- Camera / barcode: `expo-camera` (`CameraView` barcode scanning).
- Photos: `expo-image-picker`.
- CSV: `expo-file-system` + `expo-sharing`.
- Tests: Vitest against the pure domain layer (no native modules needed).

The web preview uses a localStorage adapter with the same `Storage` interface,
because `expo-sqlite` on web needs a WASM asset pipeline. iOS and Android are
the shipped targets.

---

## Milestone 1 — data model, intake, list, search

Files:

```
src/domain/types.ts        Item, Settings, status, inputs
src/data/storage.ts        Storage interface, item factory, status transitions,
                           filterItems (title / barcode / bin / source)
src/data/db.ts             SQLite schema + adapter, web localStorage adapter
src/state/store.tsx        app state, derived dashboard numbers
src/screens/HomeScreen.tsx
src/screens/InventoryScreen.tsx
src/screens/AddItemScreen.tsx   photo, barcode scan, cost, source, bin,
                                list price, platform, shipping, notes
src/screens/ItemDetailScreen.tsx
src/ui/theme.ts
src/ui/components.tsx
App.tsx
```

What works:

- Add an item with a photo (camera or library), barcode (scan or type), cost,
  source, bin, list price, platform, shipping cost and notes.
- Status flow: in stock → listed → sold.
- Inventory list with free-text search and status/platform filters.
- Item detail with every stored field and days in the system.

## Milestone 2 — fee engine and profit, with tests

Files:

```
src/domain/fees.ts      editable fee configs + calculation (whole / marginal)
src/domain/profit.ts    real profit = sale − fees − shipping − cost − tax reserve
src/domain/format.ts    money and percent parsing
src/domain/platforms.ts platform labels
tests/fees.test.ts      26 tests
```

The engine supports both rule shapes the marketplaces actually use:

- **whole**: one rule applies to the entire sale (Poshmark, Mercari, Etsy,
  Depop, Vinted).
- **marginal**: each band's percentage applies only to the portion inside that
  band (eBay above $7,500).

Fees also cover per-order fees (eBay $0.30 / $0.40), payment processing
(Etsy 3% + $0.25, Depop 3.3% + $0.45), listing fees (Etsy $0.20) and whether
the platform charges on shipping.

Defaults were checked against the marketplaces' own pages on **2026-11-17**:

| Platform | Seller fee | Also |
|---|---|---|
| Poshmark | 20% for sales of $15 or more; flat $2.95 under $15 | fee on listing price only |
| eBay (most categories) | 13.6% up to $7,500, 2.35% on the portion above | per-order $0.30 (orders ≤ $10) / $0.40; first 250 listings/month free |
| Mercari | 10% on item price + buyer-paid shipping | no seller processing fee |
| Etsy | 6.5% transaction | 3% + $0.25 processing (US), $0.20 listing |
| Depop | 0% in US/UK | processing 3.3% + $0.45 (US), 2.9% + £0.30 (UK); boosts add 12% |
| Vinted | 0% | buyers pay the protection fee |

Sources:

- Poshmark: https://poshmark.com/posh_guide/get_started_on_poshmark
- eBay: https://www.ebay.com/help/selling/fees-credits-invoices/selling-fees?id=4364
  (page updated 2026-11-06)
- Mercari: https://www.mercari.com/us/help_center/article/2517/
- Etsy: https://www.etsy.com/legal/fees/
- Depop: https://depophelp.zendesk.com/hc/en-gb/articles/360001791127-Seller-fees-and-charges
- Vinted: https://www.vinted.com/help/1653

Every row is editable in Settings, and the UI prints the date the defaults
were checked. eBay and Mercari also run category- or tier-specific promotions;
the editable table is how a seller accounts for those without an app update.

## Milestone 3 — dashboard, stale reminder, CSV export

Files:

```
src/screens/HomeScreen.tsx      stock count, capital in stock, monthly profit,
                                stale list
src/domain/dates.ts             stale rule: days since listing (or intake)
src/domain/csv.ts               sold items only, six columns, RFC 4180 quoting
src/services/exportCsv.ts       share sheet / web download
src/screens/SettingsScreen.tsx  fee table editor, stale days, tax reserve,
                                plan placeholder, reset
src/screens/PaywallSheet.tsx    PaywallScreen: $39 / $4.99 options, placeholder unlock
```

CSV columns, exactly as specified: `Date, Item, Cost, Sale price, Platform fee,
Profit`.

Free tier: 30 recorded items, CSV export locked. The cap never blocks recording
a sale on an existing item, only creating new ones.

---

## Run it

```bash
cd D:\projects\boxledger
npm install
npx expo start          # QR code: Expo Go on iPhone / Android
npx expo start --android
npx expo start --web    # browser preview (localStorage adapter)
```

Checks:

```bash
npm test         # 26 tests
npm run typecheck
```

Manual verification path (about two minutes):

1. Add an item: title "Levi's 501", cost 18, bin B12, list 65, platform
   Poshmark. Save.
2. Open Inventory, search `B12`. The item appears.
3. Open it, tap "Sold it", enter 60 as the sale price and 10 in tax reserve.
   The preview must read: platform fee $12.00, tax reserve $6.00, real profit
   $24.00.
4. Confirm. Home now shows $24.00 profit this month.
5. Settings → Export CSV. On the free tier this opens the paywall. Flip
   "Paid tier (placeholder)" and export again; a `boxledger-tax-YYYY-MM-DD.csv`
   should contain the header plus one sold row.

---

## Not built yet

- **Payments.** The paywall and the paid flag exist; StoreKit / Play Billing
  are not wired. The unlock button is labelled as a placeholder.
- **Cross-listing / marketplace sync.** Explicitly out of scope.
- **Accounts, cloud sync, social, AI pricing, web app.** Out of scope.
- **Bulk import.** Not in the spec; not built.
- **Editing an item's fields after creation.** The detail screen shows fields;
  only status and sale are editable today. Say if you want an edit screen.

## Known limitations

- Barcode scanning is disabled in the web preview; type the barcode instead.
- Fee defaults are a snapshot. The Settings table is the source of truth once
  the seller edits it.
- The npm user config (`C:\Users\Cyan\.npmrc`) had a proxy pointing at
  `127.0.0.1:12334` which was down (VPN off). The two proxy lines are commented
  out; the original is at `.npmrc.bak-20261117-noproxy`.

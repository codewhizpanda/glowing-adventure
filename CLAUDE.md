# Khonsu Tech OPS — CLAUDE.md

## What This Project Is

A single-file, zero-dependency Sales Operations System for **Khonsu Electronic Gadgets Trading (ITEL Mobile)**, located at Space No. K424.6, Festival Mall, Alabang, Muntinlupa City, Philippines.

The entire application lives in **one file**: `tecnix-ops_25.html`. There is no build system, no package manager, no dependencies, and no server requirement. Open the file in a browser to run it.

---

## File Structure

```
tecnix-ops_25.html   ← The entire application (HTML + CSS + JS, ~1732 lines)
```

The file has three sections in order:
1. `<style>` block — all CSS, including CSS custom properties
2. HTML body — lock screen, header, nav, and six page `<div>` elements with modals
3. `<script>` block — all application logic (vanilla JS, global scope)

---

## Application Architecture

### Single-Page Application Pattern
Six "pages" are `<div class="page">` elements. Only one has `.active` at a time; `showPage(name, event)` switches between them.

The **Log Sale** page has four sub-screens (`s-picker`, `s-detail`, `s-review`, `s-report`) toggled by `showS(name)`.

### State Management
All state is global JavaScript variables declared at line ~679:

| Variable | Purpose |
|---|---|
| `currentUser` | Active user (Sam, Joyce, Admin) |
| `masterList` | Full product catalog (including obsolete items) |
| `PRODUCTS` | Active products only (`masterList.filter(p => !p.obsolete)`) |
| `inventory` | Map of `productKey → {stock, reorder}` |
| `predefinedBundles` | Seasonal promotion bundles |
| `productFreebies` | Map of `productKey → freebieProductKey` |
| `settings` | `{dailyTarget, lowStockThreshold, globalReorder}` |
| `saleRows` | Confirmed sale rows for the current day |
| `pendingItems` | Items staged but not yet confirmed in the current SO |
| `currentSO` | Active Sales Order number string |
| `purchaseOrders` | Array of PO objects |
| `selectedProduct` | Product selected on the detail screen |
| `selectedAddon` | Add-on selected on the detail screen |
| `scriptUrl` | Google Apps Script Web App URL |

### Persistence
All data is persisted to `localStorage` — no database, no server (unless Google Sheets is connected).

| Key | Content |
|---|---|
| `kt_ml` | Master list array |
| `kt_inv` | Inventory object |
| `kt_bundles` | Bundles/promotions array |
| `kt_freebies` | Freebies object |
| `kt_settings` | Settings object |
| `kt_so` | SO counter integer |
| `kt_pc` | Bundle/promo code counter integer |
| `kt_pos` | Purchase orders array |
| `kt_url` | Google Sheets script URL |

---

## Key Data Structures

### Product
```js
{
  category: 'Smart Phone',   // Bar Phone | Smart Phone | Tablet | Earbuds | Smart Watch | Power Bank | Others
  name: 'A50C',
  ram: '2GB',                // empty string for non-phones
  storage: '64GB',           // empty string for non-phones
  unitPrice: 2789,           // cost / purchase price (₱)
  srp: 2999,                 // suggested retail price (₱)
  colors: 'Black, White',    // comma-separated string
  obsolete: false
}
```

### Inventory Entry
```js
inventory['A50C 2GB/64GB'] = { stock: 4, reorder: 1 }
```
The key is produced by `ik(product)` — see utility functions below.

### Sale Row (confirmed transaction)
```js
{
  id, so, bundle, itemName, variant, color, qty,
  unitPrice, srp, soldPrice, pasaPrice, discount, netSales,
  payment,      // Cash | Card | Home Credit
  soldType,     // Walk-in | Pasa
  promoter, staff, productKey,
  isAddon, isPromotion, isPromoAddon,
  customer      // { name, contact, email } | null
}
```

### Purchase Order
```js
{
  id: 'PO-123456',
  date: '6/21/2026, 10:00:00 AM',
  supplier: 'Tecnix Trading',
  approver: 'Admin',
  items: [{ name, qty, color }],
  status: 'pending' | 'sent'
}
```

---

## Utility Functions

Three short helpers are used everywhere:

| Function | Purpose |
|---|---|
| `ik(p)` | Inventory key: `p.name + ' ' + p.ram + '/' + p.storage` (omits empty parts) |
| `vl(p)` | Variant label: `p.ram + ' / ' + p.storage` (empty string when both missing) |
| `fmt(n)` | Philippine Peso format: `₱1,234.00` or `'N/A'` for zero/null |

---

## Business Logic

### Sales Flow
1. User selects product on **Picker** screen → `openDetail(key)`
2. User fills in variant, color(s), qty, sold type, payment → `recalc()` updates total
3. User taps **"+ Add Another Item"** → `addAnotherItem()` stages to `pendingItems`, returns to Picker
4. User taps **"Review Sale →"** → `goToReview()` stages current item, generates SO number, shows Review screen
5. User taps **"✓ Customer Approved — Confirm"** → `confirmSale()` moves `pendingItems` → `saleRows`, decrements inventory, clears SO
6. **Report** screen aggregates `saleRows` for the day; **Submit** posts to Google Sheets and auto-generates PO for low-stock items

### Pricing
- **Walk-in**: customer pays `SRP`
- **Pasa** (promoter/referral): customer pays `SRP + pasaPrice`; promoter gets the pasa markup
- **Promotion/Bundle**: customer pays fixed `bundlePrice` for phone + accessory combo
- `netSales = (soldPrice - unitPrice) × qty`

### SO / Code Numbering
- Sales Order: `SO-YYMMDD-XXXX` (e.g. `SO-260621-0001`)
- Bundle code: `BDL-YYMMDD-XXX`
- Promo code: `PRO-YYMMDD-XXX`
- PO: `PO-{last 6 digits of Date.now()}`

### Stock Management
- Initial stock defaults to 4 units per product
- `confirmSale()` decrements stock for every item confirmed (main product, add-on, promo add-on, freebie)
- After day submit, items at or below their `reorder` point are automatically added to a pending PO

### Users and Permissions
- **Sam / Joyce**: only see the Log Sale tab
- **Admin**: sees all tabs (Inventory, Purchase Orders, Master List, Settings, Setup)
- No real authentication — user is chosen on the lock screen

---

## CSS Conventions

All styles are in the `<style>` block at the top. Custom properties are declared on `:root`:

```
--bg, --surface, --surface2, --border
--accent (#1b2e6b), --accent2 (#2d4499), --accent-light
--green, --red, --yellow
--text, --muted, --white, --moon (#c8d0e8)
```

**Class naming** is minimal/abbreviated — this is intentional to keep the file compact:
- `.pc` = product card, `.sc` = stat card, `.sw` = search wrapper
- `.sb` = stock badge, `.sok/.slow/.sout` = stock status colors
- `.g2/.g3` = 2/3-column grids, `.pgrid` = product grid
- `.btn-primary/.btn-success/.btn-danger/.btn-outline/.btn-sm/.btn-lg` = button variants

Fonts: **Inter** (UI) and **JetBrains Mono** (prices, codes) loaded from Google Fonts.

---

## Google Sheets Integration (Optional)

The **Setup** tab walks users through connecting a Google Apps Script Web App as a backend. The Apps Script source is embedded in the HTML at line ~506.

### Script Actions (POST)
| Action | What it does |
|---|---|
| `init` | Creates "Sales Log", "Inventory", "Purchase Orders" sheets with headers |
| `logSale` | Appends rows to Sales Log; decrements Inventory sheet stock |
| `logPO` | Appends a row to Purchase Orders sheet |
| `pushInventory` | Replaces all Inventory sheet rows |
| `pushMasterList` | Replaces all Master List sheet rows |

### Script Actions (GET)
| Action | What it does |
|---|---|
| `ping` | Returns `{status: 'ok'}` |
| `getMasterList` | Returns all rows from Master List sheet as JSON |

CORS errors are expected during local development; the deployed Web App URL will work from a browser context.

---

## Development Workflow

### Making Changes
1. Open `tecnix-ops_25.html` in a text editor
2. Modify HTML, the `<style>` block, or the `<script>` block directly
3. Open/refresh the file in a browser to test
4. No build step, no compiler, no linter

### Testing
There is no test suite. Manually test the full sales flow:
- Login as Sam → select a product → fill details → review → confirm
- Login as Admin → check Inventory, Master List, Settings, Setup tabs
- Test Pasa sales, multi-item SOs, bundle promotions, product freebies

### Adding Products
Add entries to the `DEF` array (line ~629) to change the default product catalog. Users can also add products at runtime via Master List → "New Item". The `COLORS` object (line ~628) maps categories to default color options.

### Modifying the Google Apps Script
The script source is stored as the `innerText` of `<span id="scriptText">`. Edit it directly in the HTML. The "Copy" button copies it so users can paste it into Google Apps Script editor.

---

## Important Constraints

- **Single file** — do not split into multiple files unless explicitly requested. The single-file format is intentional for easy deployment (share the file, open in browser).
- **No external dependencies** — do not add npm packages, CDN links beyond Google Fonts, or any framework.
- **No build step** — the file must open and run directly in a browser.
- **Minified style is intentional** — the CSS and JS are written compactly. Maintain this style when adding code.
- **Global scope JS** — all functions and variables are global. This is intentional; do not introduce modules.
- **localStorage only** — all data lives in the browser. Nothing is sent anywhere unless the user connects a Google Sheets URL.
- **Philippine Peso (₱)** — all currency is in PHP. Use `fmt(n)` for display; use `en-PH` locale for formatting.
- **Inline event handlers** — the app uses `onclick="..."` attributes. This is consistent with the existing codebase; do not refactor to `addEventListener` unless the user asks.

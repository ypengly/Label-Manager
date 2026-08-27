# Label Manager

A production label printing app for kitchen/prep-line staff — categories,
products, an editor with a live preview, bulk printing at an exact **30 cm ×
20 cm**, and Google Sheets as the shared database. Built to replace the
`Print Label1.xlsx` workflow.

## Running it

No build step, no npm install. Three files:

```
index.html
styles.css
app.js
```

Open `index.html` directly in a browser, or host the folder on any static
web server (GitHub Pages, Netlify, an internal file share, `python3 -m
http.server`, etc). It's a single-page app — all logic runs client-side.

Your category/product/label data is seeded from the categories, products,
and M→R / M→D day offsets found in your uploaded `Print Label1.xlsx`
(Seafood, Vegetables, Pasta, Pizza).

## What's implemented

- **Dashboard** — category tabs, one-tap product → label, recent labels.
- **Label editor** — live preview, product picker, M/R/D time & date fields,
  auto-calculated R/D dates (per-category day offsets, toggle to edit
  manually), staff name, custom fields (add, remove, reorder by drag,
  show/hide on the printed label), template picker.
- **Products** — per category, add/rename/deactivate/delete, drag to
  reorder, search.
- **Categories** — add/delete, per-category default M/R/D times and day
  offsets, add unlimited categories.
- **Templates** — Standard / Large / Simple presets plus custom templates
  (font, alignment, size, border, which fields print and in what order).
  This is a simplified version of a full drag-and-drop position designer —
  see "Simplifications" below.
- **Print Queue** — add labels, set copies per label, drag to reorder,
  Print All (one PDF/print job, one page per label, exact size).
- **Print preview** — paged preview with Previous/Next before printing.
- **Printing** — `@page { size: 30cm 20cm; margin: 0 }`, only the label
  prints (no nav/sidebar/buttons), one label per physical page with
  `page-break-after`. Verified by generating real print output and
  measuring the resulting PDF pages at 30.0 × 20.0 cm.
- **Search** — global top-bar search across product name, staff name, and
  dates.
- **Local-first storage** — every change is saved to `localStorage`
  immediately (debounced ~700ms), so a refresh, a closed tab, or a lost
  connection never loses data. A "Saved" toast confirms each write.
- **Excel** — Import re-reads a `Print Label1.xlsx`-style workbook (any
  sheet named like `Data <Category>` or `<Category>`) and pulls in
  categories + product names without wiping what's already there. Export
  writes a fresh workbook, one tab per category, from your current labels.
- **JSON backup** — full-state export/import, independent of Excel/Sheets.
- **Google Sheets sync** — real, not mocked. See below.

## Google Sheets sync — how it actually works

This app has no backend, so it uses **Google Identity Services (GIS)**, the
same client-side OAuth flow Google recommends for browser-only apps. There
is no client secret anywhere in this code — a Client ID and an API key are
the only credentials involved, and both are meant to be public; they're
restricted by domain/API in Google Cloud Console, not by secrecy.

**One-time setup (do this once for your organization):**

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create
   a project (or use an existing one).
2. **APIs & Services → Library** → enable the **Google Sheets API**.
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   → Application type **Web application**. Under *Authorized JavaScript
   origins*, add the exact URL this app is hosted at (e.g.
   `https://yourteam.github.io` or `http://localhost:8080`). Copy the
   generated **Client ID**.
4. **Create Credentials → API key**. Restrict it to the Sheets API. Copy
   the **API key**.
5. Create a blank Google Sheet, share it with whoever needs write access,
   and copy the ID from its URL:
   `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`.
6. In the app, go to **Google Sheets**, paste the Client ID, API key, and
   Spreadsheet ID, click **Sign in with Google**, then **Create Sheet
   Structure** (this adds the four tabs below with header rows).

**Sheet structure created automatically:**

| Sheet | Columns |
|---|---|
| Categories | id, name, m_time, r_time, d_time, m_to_r_days, m_to_d_days, auto_calc, created_at |
| Products | id, category_id, name, sort_order, active |
| Labels | id, product_id, category_id, product_name, m_time, m_date, r_time, r_date, d_time, d_date, name, template_id, custom_fields_json, created_at, updated_at |
| Settings | key, value |

**Sync model:** *Push* overwrites the sheet's data rows with what's in this
browser; *Pull* overwrites this browser's categories/products/labels with
what's in the sheet. Saved edits push automatically ~2.5s after you stop
typing whenever you're connected and online. If the connection drops or a
push fails, nothing is lost locally — your data stays in `localStorage` and
the sync pill shows the error; retry with **Push to Sheets**.

This is intentionally a "last write wins" model rather than row-level
merge/conflict resolution — reasonable for a small prep team, not built for
many people editing simultaneously. If several stations need to write at
once, treat Pull/Push as an explicit "get latest" / "publish" action rather
than something left running unattended.

## Printing correctly

In the browser print dialog: set **Scale → 100% / Actual size** and turn
off "Fit to page". The stylesheet already fixes the physical page to 30cm ×
20cm and hides everything except the label; if your printer driver
overrides paper size, pick a matching 30×20cm (or closest custom) media
size in its settings.

## Simplifications vs. the original brief

A few items were deliberately scoped down so the app is something you can
actually open and use today, rather than a half-finished framework:

- **Template field *positioning*** is order + typography + borders, not a
  free-form drag-and-drop canvas with absolute pixel coordinates. Reordering
  which block appears where, plus font/alignment/size/border, covers the
  same real need (differently laid-out label types) with far less to break.
- **Google Sheets sync is last-write-wins**, not per-row operational
  transforms — see above.
- **No server-rendered PDF** — printing goes through the browser's native
  print dialog (as the brief specified), not a generated PDF file.
- There's no separate backend/build step (no React/Vite/TypeScript project)
  — everything is plain HTML/CSS/JS so it runs anywhere with zero setup.
  If you'd like this rebuilt as a proper Vite+React+TypeScript project for
  a team that wants to extend it in that stack, that's a reasonable next
  step but a separate, larger piece of work from what's here.

## Data model reference (also mirrors the Sheets columns)

```
Category   { id, name, mTime, rTime, dTime, mToR, mToD, autoCalc }
Product    { id, categoryId, name, sortOrder, active }
Label      { id, productId, categoryId, productName,
             mTime, mDate, rTime, rDate, dTime, dDate,
             name, templateId, customFields:[{id,name,value,show}],
             createdAt, updatedAt }
Template   { id, name, font, align, border, scale, fieldOrder }
```

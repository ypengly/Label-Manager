# 🏷️ Label Manager

<p align="center">
  <strong>A production-ready kitchen label printing system built for speed, accuracy, and simplicity.</strong>
</p>

<p align="center">
  Replace manual Excel-based label workflows with a fast browser-based application for managing products, preparing labels, synchronizing data, and printing at an exact <strong>30 cm × 20 cm</strong>.
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-screenshots">Screenshots</a> •
  <a href="#-getting-started">Getting Started</a> •
  <a href="#-google-sheets-sync">Google Sheets</a> •
  <a href="#-printing">Printing</a> •
  <a href="#-data-model">Data Model</a>
</p>

<p align="center">

![Status](https://img.shields.io/badge/status-production--ready-success?style=for-the-badge)
![JavaScript](https://img.shields.io/badge/JavaScript-Vanilla-F7DF1E?style=for-the-badge\&logo=javascript\&logoColor=black)
![HTML5](https://img.shields.io/badge/HTML5-Static-E34F26?style=for-the-badge\&logo=html5\&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-Static-1572B6?style=for-the-badge\&logo=css3\&logoColor=white)
![Google Sheets](https://img.shields.io/badge/Google%20Sheets-Sync-34A853?style=for-the-badge\&logo=googlesheets\&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)

</p>

---

## ✨ Overview

**Label Manager** is a lightweight production label printing application designed for **kitchen, food-preparation, and prep-line teams**.

It was built to replace a manual `Print Label1.xlsx` workflow with a dedicated interface where staff can:

* Select products in seconds
* Automatically calculate preparation and expiry dates
* Customize label information
* Build a print queue
* Preview labels before printing
* Print multiple labels in one operation
* Manage products and categories
* Synchronize shared data through Google Sheets
* Continue working even when offline

The entire application runs in the browser with **no backend and no build process**.

> **Built for the real workflow — not for the spreadsheet.**

---

## 🎯 Why Label Manager?

Traditional Excel-based label printing can become difficult to maintain when multiple products, categories, dates, and staff members are involved.

Label Manager turns that workflow into a purpose-built application:

```text
OLD WORKFLOW

Open Excel
   ↓
Find product
   ↓
Enter dates manually
   ↓
Calculate expiry
   ↓
Format label
   ↓
Select print area
   ↓
Print
```

```text
LABEL MANAGER

Select Product
      ↓
Dates Calculated Automatically
      ↓
Review Live Preview
      ↓
Add to Print Queue
      ↓
Print All
```

---

# 🚀 Features

## 📊 Dashboard

A clean production dashboard designed for fast operation.

* Category-based product tabs
* One-tap product selection
* Recent labels
* Global search
* Quick access to label creation
* Production-friendly workflow

---

## 🏷️ Label Editor

Create and customize labels using a live editor.

### Supported fields

* Product
* M — Preparation / Made time
* R — Ready / Retention time
* D — Date / Expiry time
* Staff name
* Custom fields

### Smart date calculation

Configure category-specific rules such as:

```text
M → R = +2 days
M → D = +5 days
```

The application automatically calculates the resulting dates.

Users can also disable automatic calculation and manually edit the dates when required.

---

## 🖨️ Precision Printing

Labels are designed specifically for:

**30 cm × 20 cm**

The application uses browser print CSS:

```css
@page {
  size: 30cm 20cm;
  margin: 0;
}
```

Each label becomes exactly one physical print page.

### Print workflow

```text
Create Label
     ↓
Add to Queue
     ↓
Set Copies
     ↓
Reorder Labels
     ↓
Preview
     ↓
Print All
```

The print stylesheet automatically hides:

* Navigation
* Sidebar
* Buttons
* Editor controls
* Other application UI

Only the label is printed.

---

## 📦 Print Queue

Prepare multiple labels before printing.

* Add labels to queue
* Set copies per label
* Drag to reorder
* Remove individual labels
* Preview all labels
* Print everything in one operation

Perfect for busy prep-line workflows where multiple labels need to be produced together.

---

## 👨‍🍳 Product Management

Manage the products used by the kitchen.

* Add products
* Rename products
* Deactivate products
* Delete products
* Search products
* Drag and drop to reorder
* Organize products by category

Inactive products can remain in historical data without appearing in normal production workflows.

---

## 🗂️ Category Management

Create unlimited categories.

Each category can define its own:

* Default M time
* Default R time
* Default D time
* M → R day offset
* M → D day offset
* Automatic date calculation setting

Example:

```text
Seafood
├── M: 08:00
├── R: 12:00
├── D: 08:00
├── M → R: +1 day
└── M → D: +3 days
```

---

## 🎨 Templates

Choose from built-in templates:

* Standard
* Large
* Simple

Or create custom templates.

### Customization

* Font
* Alignment
* Font size
* Border
* Scale
* Printed fields
* Field order

Templates make it possible to create different label styles without modifying the application code.

---

## 🔄 Google Sheets Sync

Google Sheets can act as the team's shared database.

The application uses **Google Identity Services (GIS)** and the **Google Sheets API** directly from the browser.

No application backend is required.

### Sync capabilities

* Push browser data → Google Sheets
* Pull Google Sheets data → browser
* Automatic sync after edits
* Offline-first local storage
* Retry failed synchronization
* Shared organizational data

### Sync architecture

```text
┌──────────────────────┐
│    Label Manager     │
│      Browser         │
└──────────┬───────────┘
           │
           │ Google OAuth
           │ + Sheets API
           ▼
┌──────────────────────┐
│    Google Sheets     │
│   Shared Database     │
└──────────────────────┘
```

The application intentionally uses a **last-write-wins** synchronization model.

This keeps the system simple and reliable for small kitchen/prep teams.

---

## 💾 Local-First Storage

Every change is persisted to `localStorage`.

Benefits:

* Works without an internet connection
* Refresh-safe
* Browser-close-safe
* Connection-loss-safe
* No backend required

Changes are saved automatically with a small debounce window.

A **Saved** notification confirms successful local persistence.

> Local data remains available even when Google Sheets synchronization is temporarily unavailable.

---

## 📥 Excel Import / Export

Existing Excel workflows can be migrated without manually recreating every product.

### Import

The application can read `Print Label1.xlsx`-style workbooks.

Supported sheets include:

```text
Data Seafood
Data Vegetables
Data Pasta
Data Pizza
```

or category-named sheets.

Imported data is merged into the existing application state rather than blindly replacing it.

### Export

Export the current application data into a fresh workbook with one worksheet per category.

---

## 🔐 JSON Backup

Create a complete backup of the application state.

JSON backup includes:

* Categories
* Products
* Labels
* Templates
* Settings

This provides a second backup mechanism independent of Google Sheets and Excel.

---

# 📸 Screenshots

> Add your actual screenshots here once available.

### Dashboard

```text
┌─────────────────────────────────────────────────────────┐
│  🏷️ Label Manager                         🔍 Search     │
├──────────────┬──────────────────────────────────────────┤
│ Categories   │                                          │
│              │       PRODUCTS                           │
│ Seafood      │  ┌──────────┐ ┌──────────┐              │
│ Vegetables   │  │ Salmon   │ │ Shrimp   │              │
│ Pasta        │  └──────────┘ └──────────┘              │
│ Pizza        │                                          │
└──────────────┴──────────────────────────────────────────┘
```

**Screenshot placeholder:**

`docs/screenshots/dashboard.png`

---

### Label Editor

**Screenshot placeholder:**

`docs/screenshots/label-editor.png`

---

### Print Queue

**Screenshot placeholder:**

`docs/screenshots/print-queue.png`

---

### Print Preview

**Screenshot placeholder:**

`docs/screenshots/print-preview.png`

---

### Google Sheets Sync

**Screenshot placeholder:**

`docs/screenshots/google-sheets.png`

---

# 🎬 Demo

> Replace this section with a GIF or video when available.

```text
docs/demo/label-manager-demo.gif
```

Example Markdown:

```md
![Label Manager Demo](docs/demo/label-manager-demo.gif)
```

---

# 🧭 Table of Contents

* [Overview](#-overview)
* [Why Label Manager?](#-why-label-manager)
* [Features](#-features)

  * [Dashboard](#-dashboard)
  * [Label Editor](#-label-editor)
  * [Precision Printing](#-precision-printing)
  * [Print Queue](#-print-queue)
  * [Product Management](#-product-management)
  * [Category Management](#-category-management)
  * [Templates](#-templates)
  * [Google Sheets Sync](#-google-sheets-sync)
  * [Local-First Storage](#-local-first-storage)
  * [Excel Import / Export](#-excel-import--export)
  * [JSON Backup](#-json-backup)
* [Getting Started](#-getting-started)
* [Google Cloud Setup](#-google-cloud-setup)
* [Google Sheets Structure](#-google-sheets-structure)
* [Printing](#-printing)
* [Architecture](#-architecture)
* [Data Model](#-data-model)
* [Project Structure](#-project-structure)
* [Simplifications](#-simplifications)
* [Deployment](#-deployment)
* [Roadmap](#-roadmap)
* [License](#-license)

---

# ⚡ Getting Started

Label Manager intentionally has **zero build dependencies**.

There is no:

```bash
npm install
npm run build
npm run dev
```

required.

## 1. Clone the repository

```bash
git clone https://github.com/yourusername/label-manager.git
cd label-manager
```

## 2. Open the application

The project consists of:

```text
index.html
styles.css
app.js
```

You can simply open:

```text
index.html
```

in a modern browser.

### Or run a local server

Using Python:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

---

# ☁️ Google Cloud Setup

Google Sheets synchronization requires a one-time Google Cloud configuration.

## 1. Create a Google Cloud Project

Create or select a project in Google Cloud Console.

## 2. Enable Google Sheets API

Navigate to:

```text
APIs & Services
→ Library
→ Google Sheets API
→ Enable
```

## 3. Create OAuth Client

Navigate to:

```text
APIs & Services
→ Credentials
→ Create Credentials
→ OAuth client ID
```

Choose:

```text
Application type:
Web application
```

Add your application's exact URL under:

```text
Authorized JavaScript origins
```

For example:

```text
https://yourteam.github.io
```

or:

```text
http://localhost:8080
```

Copy the generated **Client ID**.

## 4. Create an API Key

Create:

```text
Create Credentials
→ API key
```

Restrict the key to the **Google Sheets API**.

## 5. Create a Google Sheet

Create a blank spreadsheet and copy the spreadsheet ID from:

```text
https://docs.google.com/spreadsheets/d/THIS_PART/edit
```

You will need:

```text
Client ID
API Key
Spreadsheet ID
```

inside Label Manager.

---

# 📑 Google Sheets Structure

Label Manager automatically creates the following worksheets.

| Sheet          | Columns                                                                                                                                                                                |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Categories** | `id`, `name`, `m_time`, `r_time`, `d_time`, `m_to_r_days`, `m_to_d_days`, `auto_calc`, `created_at`                                                                                    |
| **Products**   | `id`, `category_id`, `name`, `sort_order`, `active`                                                                                                                                    |
| **Labels**     | `id`, `product_id`, `category_id`, `product_name`, `m_time`, `m_date`, `r_time`, `r_date`, `d_time`, `d_date`, `name`, `template_id`, `custom_fields_json`, `created_at`, `updated_at` |
| **Settings**   | `key`, `value`                                                                                                                                                                         |

After signing in:

```text
Google Sheets
      ↓
Sign in with Google
      ↓
Create Sheet Structure
      ↓
Ready to Sync
```

---

# 🔄 Sync Behavior

The application follows a simple **last-write-wins** model.

### Push

```text
Browser
   ↓
Push to Sheets
   ↓
Google Sheets data replaced
```

### Pull

```text
Google Sheets
   ↓
Pull from Sheets
   ↓
Browser data replaced
```

### Automatic Sync

When connected and online, saved changes are automatically pushed approximately **2.5 seconds after editing stops**.

If synchronization fails:

```text
Local Data
    ↓
Still Safe
    ↓
Retry Later
```

Your local data remains intact.

> For multiple stations editing simultaneously, use Pull/Push as an explicit **Get Latest / Publish** workflow rather than relying on unattended simultaneous editing.

---

# 🖨️ Printing

Label Manager is designed around a physical label size of:

```text
30 cm × 20 cm
```

The application uses:

```css
@page {
  size: 30cm 20cm;
  margin: 0;
}
```

## Recommended browser settings

Before printing:

```text
Scale:       100% / Actual Size
Margins:     None
Fit to Page: OFF
```

If your printer driver supports custom media sizes, select:

```text
30 cm × 20 cm
```

or the closest supported paper size.

### Important

Printer drivers can override browser print settings.

Always verify the printer's physical media configuration when installing the application in a new environment.

---

# 🏗️ Architecture

Label Manager intentionally uses a simple architecture.

```text
┌─────────────────────────────────────────────┐
│                  Browser                    │
│                                             │
│  ┌─────────────┐  ┌─────────────────────┐  │
│  │    HTML     │  │        CSS          │  │
│  └─────────────┘  └─────────────────────┘  │
│                                             │
│             ┌──────────────┐                │
│             │  app.js      │                │
│             │ Application  │                │
│             │    Logic     │                │
│             └──────┬───────┘                │
│                    │                        │
│        ┌───────────┴───────────┐            │
│        ▼                       ▼            │
│  ┌──────────────┐      ┌───────────────┐   │
│  │ localStorage │      │ Google Sheets  │   │
│  │ Local Data   │      │ Shared Data    │   │
│  └──────────────┘      └───────────────┘   │
│                                             │
└─────────────────────────────────────────────┘
```

### Technology Stack

| Technology               | Purpose                     |
| ------------------------ | --------------------------- |
| HTML5                    | Application structure       |
| CSS3                     | UI and print styling        |
| Vanilla JavaScript       | Application logic           |
| LocalStorage             | Local persistence           |
| Google Identity Services | Authentication              |
| Google Sheets API        | Shared data synchronization |
| Excel                    | Import/export               |
| Browser Print API        | Physical label printing     |

---

# 🗃️ Data Model

## Category

```js
Category {
  id,
  name,
  mTime,
  rTime,
  dTime,
  mToR,
  mToD,
  autoCalc
}
```

## Product

```js
Product {
  id,
  categoryId,
  name,
  sortOrder,
  active
}
```

## Label

```js
Label {
  id,
  productId,
  categoryId,
  productName,

  mTime,
  mDate,

  rTime,
  rDate,

  dTime,
  dDate,

  name,
  templateId,

  customFields: [
    {
      id,
      name,
      value,
      show
    }
  ],

  createdAt,
  updatedAt
}
```

## Template

```js
Template {
  id,
  name,
  font,
  align,
  border,
  scale,
  fieldOrder
}
```

---

# 📁 Project Structure

```text
label-manager/
│
├── index.html
├── styles.css
├── app.js
│
├── docs/
│   ├── screenshots/
│   │   ├── dashboard.png
│   │   ├── label-editor.png
│   │   ├── print-queue.png
│   │   ├── print-preview.png
│   │   └── google-sheets.png
│   │
│   └── demo/
│       └── label-manager-demo.gif
│
└── README.md
```

The core application intentionally contains only three runtime files:

```text
index.html
styles.css
app.js
```

---

# 🌐 Deployment

Because Label Manager is a static web application, it can be deployed almost anywhere.

### GitHub Pages

```text
Repository
    ↓
GitHub Pages
    ↓
Open URL
    ↓
Use Label Manager
```

### Netlify

Drag the project folder into Netlify or connect the GitHub repository.

### Internal Network

Host the three files on an internal web server for kitchen/prep-line access.

### Local Server

```bash
python3 -m http.server 8080
```

No server-side runtime is required.

---

# 🧩 Design Decisions & Simplifications

The application intentionally avoids unnecessary complexity.

## Template positioning

Instead of a full free-form drag-and-drop canvas, templates use:

* Field order
* Typography
* Alignment
* Size
* Borders
* Scale

This provides flexible label layouts while keeping the system easier to maintain.

## Google Sheets synchronization

Synchronization uses **last-write-wins** rather than complex row-level conflict resolution.

This is appropriate for small teams but is not intended to replace a full multi-user database architecture.

## PDF generation

The application does not generate PDFs server-side.

Printing uses the browser's native print system and CSS physical dimensions.

## No build system

The project deliberately avoids React/Vite/TypeScript and keeps the application deployable as a simple static website.

---

# 🛣️ Roadmap

Potential future improvements:

* [ ] Drag-and-drop visual template designer
* [ ] Advanced label positioning
* [ ] Barcode / QR code support
* [ ] User roles and permissions
* [ ] Print history
* [ ] Label duplication
* [ ] Advanced reporting
* [ ] Multi-location support
* [ ] Real-time database synchronization
* [ ] Conflict resolution
* [ ] PWA installation
* [ ] Dedicated kitchen display mode
* [ ] Printer presets
* [ ] Automatic printer selection
* [ ] Dark mode
* [ ] Multi-language support

---

# 🔒 Security Notes

Google authentication uses a browser-based OAuth flow through Google Identity Services.

The application does **not** contain a Google client secret.

The following values are designed to be used client-side:

```text
Google Client ID
Google API Key
Spreadsheet ID
```

API keys should still be restricted in Google Cloud Console by:

* Allowed API
* HTTP referrers / application restrictions

OAuth origins should be restricted to the application's actual domains.

---

# 📌 Current Scope

Label Manager is designed primarily for:

* Restaurants
* Kitchens
* Food preparation teams
* Prep lines
* Cafés
* Catering operations
* Small food-production environments

It is optimized for teams that need to produce many standardized labels quickly without managing complicated software infrastructure.

---

# 💡 Core Philosophy

> **Fast enough for a busy kitchen. Simple enough for anyone to use. Reliable enough for production.**

Label Manager transforms a spreadsheet-based process into a dedicated workflow while keeping deployment and maintenance extremely simple.

---

# 📄 License

This project is licensed under the **MIT License**.

See [`LICENSE`](LICENSE) for details.

---

<p align="center">
  <strong>🏷️ Label Manager</strong>
  <br>
  Production labels without the spreadsheet headache.
  <br><br>
  ⭐ Star the repository if you find it useful.
</p>

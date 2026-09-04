# 🏷️ Label Manager

> **Production label printing for kitchen & prep-line teams**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Made with JavaScript](https://img.shields.io/badge/Made%20with-JavaScript-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Google Sheets API](https://img.shields.io/badge/Google%20Sheets-API-34A853?logo=googlesheets&logoColor=white)](https://developers.google.com/sheets/api)
[![Local First](https://img.shields.io/badge/Local-First-FF6B6B)](https://localfirstweb.dev/)
[![Open Source](https://img.shields.io/badge/Open%20Source-❤️-red)](https://github.com)

---

## ✨ Hero Section

<div align="center">

  
  <p><strong>Streamline your kitchen labeling workflow—categories, products, live preview, and bulk printing at exact 30cm × 20cm</strong></p>
  
  <p>
    <a href="#-features">Features</a> •
    <a href="#-quick-start">Quick Start</a> •
    <a href="#-google-sheets-sync">Google Sheets Sync</a> •
    <a href="#-printing">Printing</a> •
    <a href="#-contributing">Contributing</a>
  </p>
</div>

---

## 📚 Table of Contents

- [🎯 Overview](#-overview)
- [✨ Features](#-features)
- [📸 Demo](#-demo)
- [🚀 Quick Start](#-quick-start)
- [🗄️ Google Sheets Sync](#-google-sheets-sync)
- [🖨️ Printing](#-printing)
- [📁 Data Model](#-data-model)
- [🔧 Technical Details](#-technical-details)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

---

## 🎯 Overview

**Label Manager** replaces the manual `Print Label1.xlsx` workflow with a modern, offline-first web application. Designed for kitchen and prep-line staff, it provides:

- **Category & product management** with drag-to-reorder
- **Live label preview** as you edit
- **Bulk printing** at exact 30cm × 20cm labels
- **Google Sheets** as a shared database
- **Local-first storage**—never lose data, even offline

### Why Label Manager?

📦 **Replace Excel workflows** with an intuitive app  
🖨️ **Print exact-size labels** without manual formatting  
☁️ **Sync via Google Sheets** for team collaboration  
📱 **Works anywhere**—no installation required  

---

## ✨ Features

<div align="center">
  <table>
    <tr>
      <td align="center">
        <strong>📋</strong><br />
        <strong>Dashboard</strong><br />
        <sub>Category tabs, one-tap product labels, recent labels</sub>
      </td>
      <td align="center">
        <strong>✏️</strong><br />
        <strong>Label Editor</strong><br />
        <sub>Live preview, M/R/D dates, custom fields, templates</sub>
      </td>
      <td align="center">
        <strong>📦</strong><br />
        <strong>Products</strong><br />
        <sub>Add, rename, reorder, search, activate/deactivate</sub>
      </td>
    </tr>
    <tr>
      <td align="center">
        <strong>📁</strong><br />
        <strong>Categories</strong><br />
        <sub>Add unlimited, set default times &amp; day offsets</sub>
      </td>
      <td align="center">
        <strong>🖨️</strong><br />
        <strong>Print Queue</strong><br />
        <sub>Bulk add, copy counts, reorder, print all</sub>
      </td>
      <td align="center">
        <strong>🔍</strong><br />
        <strong>Global Search</strong><br />
        <sub>Search products, staff names, and dates</sub>
      </td>
    </tr>
    <tr>
      <td align="center">
        <strong>☁️</strong><br />
        <strong>Google Sheets Sync</strong><br />
        <sub>Real push/pull with OAuth 2.0</sub>
      </td>
      <td align="center">
        <strong>💾</strong><br />
        <strong>Local-First</strong><br />
        <sub>Auto-save to localStorage, never lose data</sub>
      </td>
      <td align="center">
        <strong>📊</strong><br />
        <strong>Excel Import/Export</strong><br />
        <sub>Migrate from Print Label1.xlsx workflows</sub>
      </td>
    </tr>
  </table>
</div>

---

## 📸 Demo

<div align="center">
  <table>
    <tr>
      <td><img src="https://via.placeholder.com/400x250/34495e/ffffff?text=Dashboard" alt="Dashboard" width="400"/></td>
      <td><img src="https://via.placeholder.com/400x250/34495e/ffffff?text=Label+Editor" alt="Label Editor" width="400"/></td>
    </tr>
    <tr>
      <td><img src="https://via.placeholder.com/400x250/34495e/ffffff?text=Print+Queue" alt="Print Queue" width="400"/></td>
      <td><img src="https://via.placeholder.com/400x250/34495e/ffffff?text=Google+Sheets+Sync" alt="Google Sheets Sync" width="400"/></td>
    </tr>
  </table>
  
  <p><sub><em>Placeholder images – replace with actual screenshots</em></sub></p>
</div>

---

## 🚀 Quick Start

### Prerequisites

- Any modern web browser (Chrome, Firefox, Safari, Edge)
- (Optional) Google Cloud project for Sheets sync
- (Optional) Excel file for importing existing labels

### Installation

```bash
# Clone or download the repository
git clone https://github.com/yourusername/label-manager.git

# Navigate to the project directory
cd label-manager

# Open index.html in your browser
open index.html  # or double-click the file
```

That's it! No build tools, no npm install, no dependencies—just three files:

```
index.html
styles.css
app.js
```

### Hosting Options

- **Local**: Open `index.html` directly in a browser
- **GitHub Pages**: Push to a repository and enable Pages
- **Netlify**: Drag-and-drop the folder
- **Internal server**: `python3 -m http.server` or any static web server

---

## 🗄️ Google Sheets Sync

Label Manager uses **Google Identity Services (GIS)** for client-side OAuth—no backend required. This enables real-time team sync with a shared spreadsheet.

### One-Time Setup (Admin)

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable the Sheets API**
   - Navigate to **APIs & Services → Library**
   - Search for "Google Sheets API" and enable it

3. **Create OAuth Credentials**
   - Go to **APIs & Services → Credentials**
   - Click **Create Credentials → OAuth client ID**
   - Application type: **Web application**
   - Add **Authorized JavaScript origins**:
     - `https://your-domain.com` (production)
     - `http://localhost:8080` (local development)
   - Copy the **Client ID**

4. **Create an API Key**
   - Click **Create Credentials → API key**
   - Restrict it to the Sheets API
   - Copy the **API key**

5. **Create a Shared Google Sheet**
   - Create a new blank Google Sheet
   - Share it with team members who need write access
   - Copy the **Spreadsheet ID** from the URL:
     ```
     https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
     ```

6. **Connect in the App**
   - Open Label Manager
   - Go to **Google Sheets** section
   - Paste Client ID, API Key, and Spreadsheet ID
   - Click **Sign in with Google**
   - Click **Create Sheet Structure** (creates four tabs with headers)

### Sheet Structure

| Sheet | Columns |
|-------|---------|
| **Categories** | `id`, `name`, `m_time`, `r_time`, `d_time`, `m_to_r_days`, `m_to_d_days`, `auto_calc`, `created_at` |
| **Products** | `id`, `category_id`, `name`, `sort_order`, `active` |
| **Labels** | `id`, `product_id`, `category_id`, `product_name`, `m_time`, `m_date`, `r_time`, `r_date`, `d_time`, `d_date`, `name`, `template_id`, `custom_fields_json`, `created_at`, `updated_at` |
| **Settings** | `key`, `value` |

### Sync Model

- **Push**: Overwrites sheet data with browser data
- **Pull**: Overwrites browser data with sheet data
- **Auto-sync**: Changes push automatically ~2.5 seconds after you stop typing
- **Conflict resolution**: Last-write-wins (ideal for small teams, not concurrent editing)

---

## 🖨️ Printing

### Label Dimensions

- **Exact size**: 30cm × 20cm per label
- **Print settings**: Scale 100%, disable "Fit to page"
- **Print preview**: Paged preview with Previous/Next navigation

### Print Queue Features

- Add individual labels with copy counts
- Drag to reorder labels
- Print all labels in one job
- Each label prints on a separate physical page

### Browser Print Settings

1. Open the **Print Queue**
2. Click **Print All**
3. In the print dialog:
   - Set **Scale** to **100%** or **Actual size**
   - Turn off **Fit to page**
   - Select **30cm × 20cm** paper size (or nearest custom size)

---

## 📁 Data Model

### Category
```javascript
{
  id: string,
  name: string,
  mTime: string,        // "HH:MM" for M (Make)
  rTime: string,        // "HH:MM" for R (Refrigerate)
  dTime: string,        // "HH:MM" for D (Discard)
  mToR: number,         // Days from M to R
  mToD: number,         // Days from M to D
  autoCalc: boolean     // Auto-calculate R/D dates
}
```

### Product
```javascript
{
  id: string,
  categoryId: string,
  name: string,
  sortOrder: number,
  active: boolean
}
```

### Label
```javascript
{
  id: string,
  productId: string,
  categoryId: string,
  productName: string,
  mTime: string,
  mDate: string,        // "YYYY-MM-DD"
  rTime: string,
  rDate: string,
  dTime: string,
  dDate: string,
  name: string,         // Staff name
  templateId: string,
  customFields: [
    { id, name, value, show }
  ],
  createdAt: string,
  updatedAt: string
}
```

### Template
```javascript
{
  id: string,
  name: string,         // "Standard", "Large", "Simple", or custom
  font: string,         // "sans-serif", "serif", "monospace"
  align: string,        // "left", "center", "right"
  border: string,       // "none", "thin", "bold"
  scale: number,        // 1-3
  fieldOrder: string[]  // Ordered list of field names
}
```

---

## 🔧 Technical Details

### Architecture

- **Three-file app**: `index.html`, `styles.css`, `app.js`
- **Zero dependencies**: Pure HTML/CSS/JavaScript
- **Local-first**: All data saved to `localStorage` with debounced auto-save
- **Offline capable**: Works without internet (except Sheets sync)
- **Progressive enhancement**: Works in all modern browsers

### Key Features Implemented

| Feature | Implementation |
|---------|---------------|
| Local storage | Debounced ~700ms, "Saved" toast confirmation |
| Drag & drop | Native HTML5 drag API for reordering |
| Google Sheets | Client-side OAuth with Google Identity Services |
| Print exact size | `@page { size: 30cm 20cm; margin: 0 }` |
| Live preview | Real-time label rendering as user types |
| Search | Global search across products, staff names, dates |
| Excel import/export | Reads `Print Label1.xlsx` format via SheetJS |
| Templates | Standard/Large/Simple presets + custom templates |

### Simplifications

- **Template positioning**: Order + typography + borders (not absolute positioning)
- **Google Sheets**: Last-write-wins (not per-row conflict resolution)
- **PDF generation**: Uses browser print dialog (not server-rendered)
- **No build step**: Pure HTML/CSS/JS (not React/Vite/TypeScript)

---

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### 🐛 Report Bugs
- Open an issue with detailed reproduction steps
- Include screenshots and browser version

### 💡 Suggest Features
- Open an issue with a clear description
- Explain the use case and expected behavior

### 🔧 Improve Code
- Fork the repository
- Create a feature branch
- Submit a pull request with clear description

### 📝 Documentation
- Improve this README
- Add usage examples
- Create video tutorials

---

## 📄 License

This project is licensed under the MIT License – see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- The kitchen and prep-line teams who inspired this tool
- Google for the Sheets API and Identity Services
- SheetJS for Excel import/export
- The open-source community for tools and inspiration

---

<div align="center">
  <p>
    <strong>Built with ❤️ for kitchen teams</strong>
  </p>
  <p>
    <sub>⭐ Star this repo if you find it useful! ⭐</sub>
  </p>
</div>

# Portfolio Tax Tracker

A privacy-first, client-side web application for analyzing **Groww Stocks P&L Excel reports** at the individual purchase-lot level. Every transaction is parsed locally in your browser—no portfolio data ever leaves your device.

## Key Features

- **Lot-Level Preservation**: Every active purchase lot and closed trade is displayed on its own independent row (never grouped or averaged by stock).
- **Dynamic Groww Workbook Parsing**: Reads the `Trade Level` worksheet (`Summary`, `Realised trades`, `Unrealised trades`) dynamically and cross-validates totals against `Scrip Level`.
- **True Calendar-Month Classification**: Calculates exact calendar-day holding periods using the report's valuation date and classifies lots as **Long-Term (LT)** or **Short-Term (ST)** using a configurable calendar-month threshold (preset at 12 months).
- **Interactive Analysis**: Filter by Script dropdown, `LT` / `ST` / `All` classification buttons, or live partial script search; sort by any numeric, date, or script column; and paginate (`10`, `25`, `50`, `100`).
- **Dynamic Summary Cards**: Portfolio Value, Unrealised P&L, Long-Term Lots, and Short-Term Lots update automatically with your active filters.
- **Excel & CSV Export**: Export your currently filtered ungrouped rows as `.xlsx` (with `Active Holdings` / `Closed Trades` sheet names) or `.csv`.

---

## Local Execution

### Prerequisites

- Node.js 20+ and npm

### Steps

```bash
# 1. Install dependencies
npm install

# 2. Start the local development server (port 3000)
npm run dev

# 3. Build static production bundle into dist/
npm run build
```

Open `http://localhost:3000` in your browser.

---

## GitHub Repository Setup

```bash
git init
git add .
git commit -m "Initial commit: Portfolio Tax Tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/portfolio-tax-tracker.git
git push -u origin main
```

---

## GitHub Pages Deployment

The Vite build uses relative asset paths (`base: './'`) and requires zero backend, environment variables, or database setup.

### Option A: Automated Deployment via GitHub Actions (Recommended)

The included `.github/workflows/deploy.yml` installs dependencies from `bun.lock`
using Bun 1.4.4 and Node.js 24, runs the TypeScript check, builds the static
bundle, and deploys only after those checks pass.

1. Set **Repository Settings → Pages → Source** to **GitHub Actions**.
2. Push to `main`, or manually run **Deploy to GitHub Pages** from the **Actions** tab.
3. Open **https://svmgarg.github.io/PortfolioTracker/**.

### Option B: Manual Static Publish

1. Run `npm run build` locally.
2. Deploy the contents of the generated `dist/` folder to your `gh-pages` branch or static host.

---

## Uploading a Groww P&L Excel Report

1. Log in to your Groww account and navigate to **Reports → Stocks → P&L Report**.
2. Select your desired date range and download the `.xlsx` report (e.g., `Stocks_PnL_Report_...xlsx`).
3. Open **Portfolio Tax Tracker** and drag and drop the `.xlsx` file onto the upload area (or click **Select .xlsx File**).
4. Review **Active Holdings** and **Closed Trades** immediately. To load an updated report later without refreshing, click **Change File** in the top-right header.

> **Disclaimer**: LT and ST badges represent holding-period classifications based on your configured calendar-month threshold. Verify instrument-specific tax rules with a qualified tax advisor before filing.

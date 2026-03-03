# Ledgr

A personal expense tracking app that connects to your bank accounts, parses PDF/text statements, and stores everything in your own Google Sheet. No third-party servers, no subscription — your data stays in your Google account.

## What it does

- **Bank Sync** — Connect real bank accounts via Plaid and import transactions directly
- **PDF Import** — Upload a bank statement PDF; an LLM extracts the transactions automatically
- **Paste Import** — Copy-paste transaction rows from your bank's website; the LLM parses them
- **Manual Entry** — Add individual expenses by hand
- **Merchant Memory** — Remembers category corrections you make and applies them automatically on future imports
- **Duplicate Detection** — Flags transactions that look like they already exist in your sheet
- **Payment Detection** — Identifies credit card payments and transfers so they aren't counted as real expenses; shows them highlighted and unchecked so you can decide
- **Edit & Delete** — Fix or remove any expense directly from the dashboard
- **Budgets** — Set monthly spending targets per category with visual progress bars
- **Trends** — 12-month heatmap table showing spending by category over time
- **Google Sheets backend** — All data is stored in a spreadsheet in your own Google account; export to CSV anytime from Sheets

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| Storage | Google Sheets API (OAuth 2.0) |
| AI parsing | Anthropic Claude (`claude-haiku-4-5`) — called directly from the browser |
| Bank sync | Plaid Link + Plaid Transactions API |
| Plaid server | Node.js + Express (port 3001) |

---

## Prerequisites

- **Node.js** 18+ and npm
- A **Google account** (for Sheets storage and OAuth sign-in)
- An **Anthropic API key** (for PDF/paste parsing) — [console.anthropic.com](https://console.anthropic.com)
- A **Plaid account** *(optional — only needed for bank sync)* — [dashboard.plaid.com](https://dashboard.plaid.com)

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/ledgr.git
cd ledgr
npm install
```

### 2. Google Cloud — OAuth & Sheets API

1. Go to [Google Cloud Console](https://console.cloud.google.com) and create a new project
2. Enable these two APIs:
   - **Google Sheets API**
   - **Google Identity Services** (enabled by default for OAuth)
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:5173`
4. Copy the **Client ID** — you'll need it for `VITE_GOOGLE_CLIENT_ID`
5. Create a new **Google Sheet** in your Google Drive and copy the ID from its URL:
   ```
   https://docs.google.com/spreadsheets/d/THIS_IS_THE_ID/edit
   ```

### 3. Environment variables

Copy the example file and fill in your values:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id.apps.googleusercontent.com
VITE_SPREADSHEET_ID=your-google-spreadsheet-id
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...

# Only needed if using bank sync via Plaid:
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret-key
PLAID_ENV=sandbox
```

> **Note:** `VITE_` prefixed variables are bundled into the browser. The Anthropic API key is sent from the browser to the Anthropic API directly. This is fine for personal/local use but be aware of this if you plan to share or host the app publicly.

### 4. Run the app

**Frontend only** (no bank sync):
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173)

**With bank sync** (Plaid requires the Express server):
```bash
# Terminal 1 — Plaid server
npm run server

# Terminal 2 — Frontend
npm run dev
```

### 5. First sign-in

1. Click **Sign in with Google**
2. The app automatically creates three sheets in your spreadsheet: `Expenses`, `MerchantRules`, `Budgets`
3. Start importing or adding expenses

---

## Features in detail

### Expenses Dashboard

The main view. Shows all expenses in a filterable, sortable table with:
- Filters by date range, category, source, description, and amount
- Inline edit — click the edit icon on any row to change any field
- Inline delete — with a "Delete? Yes / No" confirmation in the row
- Sidebar widgets showing spending by category (current month or filtered), monthly totals, and yearly totals

### Add Manually

Simple form to log a single expense. Includes duplicate detection — warns if a very similar expense already exists.

### Paste Text

Paste raw transaction data copied from your bank's website (any format). The LLM identifies dates, amounts, and merchant names, assigns categories, and presents a review table. You can correct categories before importing; corrections are saved as merchant memory rules for next time.

Detected payment rows (credit card autopay, account transfers, etc.) are shown with a purple highlight and unchecked by default.

### Import Statement

Drag-and-drop or click to upload a bank statement PDF. Works with text-based PDFs (most bank exports). The LLM extracts transactions the same way as Paste Text.

### Bank Sync

Connect real bank accounts using Plaid Link. Fetches the last 7–90 days of transactions. Requires the Express server running on port 3001.

- Transactions are shown in a review table before import
- Duplicate and payment rows are auto-deselected
- Supports multiple banks simultaneously
- Remove a connected bank at any time

### Trends

A 12-month heatmap table. Rows are expense categories sorted by total spend; columns are months. Cell color intensity shows relative spending within each category. Useful for spotting seasonal patterns.

### Budgets

Set a monthly spending target for any category. Each row shows:
- Category name
- Amount spent this month
- Budget input field
- Progress bar (green under 80%, amber 80–99%, red at 100%+)

Budgets are saved to your Google Sheet.

### Merchant Memory

Every time you correct a category on an import, the merchant name is saved to the `MerchantRules` sheet. On future imports the rule is applied automatically — if you once changed "NFLX" to "OTT/Streaming Fees", it will pre-fill that category next time.

### Payment / Transfer Detection

Credit card payments, autopay, balance transfers, and inter-account transfers are flagged as `isPayment` and shown:
- With a purple row background
- Labeled "payment?" next to the description
- Unchecked by default in the review table

You can still check and import them if you want to track them.

---

## Google Sheets structure

The app manages three sheets automatically:

| Sheet | Columns | Description |
|---|---|---|
| `Expenses` | ID, Date, Description, Amount, Category, Source, CreatedAt | All imported/added expenses |
| `MerchantRules` | Merchant, Category | Learned merchant → category mappings |
| `Budgets` | Category, MonthlyAmount | Per-category monthly budget targets |

You can add your own sheets, formulas, or charts alongside these — the app only reads/writes to these three tabs.

---

## Privacy

- No app server — your expenses go directly from your browser to Google Sheets via the Google API
- The Plaid Express server (`server/index.ts`) runs locally and is only needed for bank sync
- Plaid access tokens are stored in `server/plaid-accounts.json` on your local machine (this file is gitignored)
- The Anthropic API receives the text of your bank statements for parsing; no data is stored by Anthropic beyond standard API logging

---

## Contributing / running your own copy

This project is designed to be self-hosted per user. Each person needs their own:
- Google Cloud project + OAuth credentials
- Google Spreadsheet
- Anthropic API key
- Plaid credentials (optional)

There is no shared backend.

---

## Security notes

- `.env.local` is gitignored — never commit it
- `server/plaid-accounts.json` is gitignored — it contains Plaid access tokens
- If you fork this repo, double-check that no credentials have been accidentally committed with `git log -p`

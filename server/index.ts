import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Load .env.local before anything else — use absolute path to be safe
const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });

import express from 'express';
import cors from 'cors';
import fs from 'node:fs/promises';
import {
  PlaidApi,
  PlaidEnvironments,
  Configuration,
  Products,
  CountryCode,
} from 'plaid';
import type { PlaidItem, PlaidTransactionRaw } from './types.js';

const ACCOUNTS_FILE = path.join(__dirname, 'plaid-accounts.json');
const PORT = 3001;

// --- Plaid client ---
const plaidEnv = (process.env['PLAID_ENV'] ?? 'sandbox') as keyof typeof PlaidEnvironments;
const PLAID_CLIENT_ID = process.env['PLAID_CLIENT_ID'] ?? '';
const PLAID_SECRET = process.env['PLAID_SECRET'] ?? '';

const plaidConfig = new Configuration({
  basePath: PlaidEnvironments[plaidEnv],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
      'PLAID-SECRET': PLAID_SECRET,
      'Plaid-Version': '2020-09-14',
    },
  },
});
const plaid = new PlaidApi(plaidConfig);

// --- Storage helpers ---
async function readAccounts(): Promise<{ items: PlaidItem[] }> {
  try {
    const raw = await fs.readFile(ACCOUNTS_FILE, 'utf-8');
    return JSON.parse(raw) as { items: PlaidItem[] };
  } catch {
    return { items: [] };
  }
}

async function writeAccounts(data: { items: PlaidItem[] }): Promise<void> {
  await fs.writeFile(ACCOUNTS_FILE, JSON.stringify(data, null, 2));
}

interface PlaidErrorResponse {
  response?: {
    data?: {
      error_type?: string;
      error_code?: string;
      error_message?: string;
      display_message?: string;
      request_id?: string;
    };
    status?: number;
  };
}

function errorMessage(err: unknown): string {
  // Extract Plaid-specific error details from Axios error response
  const plaidErr = err as PlaidErrorResponse;
  const data = plaidErr?.response?.data;
  if (data?.error_message) {
    const code = data.error_code ? `[${data.error_code}] ` : '';
    return `${code}${data.display_message ?? data.error_message}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function logPlaidError(context: string, err: unknown): void {
  const plaidErr = err as PlaidErrorResponse;
  const data = plaidErr?.response?.data;
  if (data) {
    console.error(`[${context}] Plaid error:`, JSON.stringify(data, null, 2));
  } else {
    console.error(`[${context}]`, err);
  }
}

// --- Express app ---
const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// POST /api/plaid/link-token
app.post('/api/plaid/link-token', async (_req, res) => {
  try {
    const response = await plaid.linkTokenCreate({
      user: { client_user_id: 'local-user' },
      client_name: 'Ledgr',
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    logPlaidError('link-token', err);
    res.status(500).json({ error: errorMessage(err) });
  }
});

// POST /api/plaid/exchange-token
// Body: { public_token, institution: { name, institution_id }, accounts: [...] }
app.post('/api/plaid/exchange-token', async (req, res) => {
  try {
    const { public_token, institution, accounts } = req.body as {
      public_token: string;
      institution: { name: string; institution_id: string };
      accounts: Array<{ id: string; name: string; mask: string; type: string; subtype: string }>;
    };

    const exchangeRes = await plaid.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeRes.data;

    const data = await readAccounts();
    // Replace existing item if reconnecting
    data.items = data.items.filter((i) => i.itemId !== item_id);
    data.items.push({
      itemId: item_id,
      accessToken: access_token,
      institutionName: institution.name,
      institutionId: institution.institution_id,
      accounts: accounts.map((a) => ({
        accountId: a.id,
        name: a.name,
        mask: a.mask,
        type: a.type,
        subtype: a.subtype,
      })),
      connectedAt: new Date().toISOString(),
    });
    await writeAccounts(data);

    res.json({ itemId: item_id, institutionName: institution.name });
  } catch (err) {
    logPlaidError('exchange-token', err);
    res.status(500).json({ error: errorMessage(err) });
  }
});

// GET /api/plaid/accounts
app.get('/api/plaid/accounts', async (_req, res) => {
  try {
    const data = await readAccounts();
    // Strip access tokens before sending to browser
    const safe = data.items.map(({ accessToken: _tok, ...rest }) => rest);
    res.json({ items: safe });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

// GET /api/plaid/transactions?days=30
app.get('/api/plaid/transactions', async (req, res) => {
  try {
    const days = parseInt((req.query['days'] as string) ?? '30', 10);
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

    const data = await readAccounts();
    if (data.items.length === 0) {
      res.json({ transactions: [] });
      return;
    }

    const allTransactions = await Promise.all(
      data.items.map(async (item) => {
        const txRes = await plaid.transactionsGet({
          access_token: item.accessToken,
          start_date: startDate,
          end_date: endDate,
        });
        return txRes.data.transactions.map((tx) => ({
          plaidTransactionId: tx.transaction_id,
          date: tx.date,
          description: tx.merchant_name ?? tx.name,
          amount: tx.amount, // Plaid: positive = debit
          plaidCategory: tx.personal_finance_category?.primary ?? 'OTHER',
          plaidCategoryDetailed: tx.personal_finance_category?.detailed,
          accountId: tx.account_id,
          institutionName: item.institutionName,
        }));
      })
    );

    // Categories that represent credit card payments, transfers, or income
    const PAYMENT_CATEGORIES = new Set([
      'TRANSFER_IN',
      'TRANSFER_OUT',   // includes credit card payments, account-to-account transfers
      'INCOME',
    ]);
    // Detailed categories that also indicate a payment/transfer
    const PAYMENT_DETAILED = new Set([
      'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT',
    ]);

    const transactions = allTransactions
      .flat()
      .filter((tx) => tx.amount > 0) // debit only (money going out)
      .map((tx) => ({
        ...tx,
        isPayment:
          PAYMENT_CATEGORIES.has(tx.plaidCategory) ||
          Boolean(tx.plaidCategoryDetailed && PAYMENT_DETAILED.has(tx.plaidCategoryDetailed)),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    res.json({ transactions });
  } catch (err) {
    logPlaidError('transactions', err);
    res.status(500).json({ error: errorMessage(err) });
  }
});

// POST /api/llm/parse
// Body: { prompt }
// LLM provider is configured via env vars in .env.local:
//   ANTHROPIC_API_KEY  — use Anthropic Claude (default)
//   LLM_BASE_URL + LLM_API_KEY + LLM_MODEL — use any OpenAI-compatible provider
app.post('/api/llm/parse', async (req, res) => {
  try {
    const { prompt } = req.body as { prompt: string };

    if (!prompt) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    const LLM_BASE_URL = process.env['LLM_BASE_URL'];
    const LLM_API_KEY  = process.env['LLM_API_KEY'] ?? '';
    const LLM_MODEL    = process.env['LLM_MODEL'] ?? '';
    const ANTHROPIC_KEY = process.env['ANTHROPIC_API_KEY'] ?? '';

    let result: string;

    if (LLM_BASE_URL && LLM_MODEL) {
      // OpenAI-compatible path (OpenAI, Groq, Ollama, any custom provider)
      const url = LLM_BASE_URL.replace(/\/$/, '') + '/chat/completions';
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (LLM_API_KEY) headers['Authorization'] = `Bearer ${LLM_API_KEY}`;

      const upstream = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: LLM_MODEL,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        const msg =
          (err as { error?: { message?: string } })?.error?.message ??
          `LLM API error ${upstream.status}`;
        res.status(upstream.status).json({ error: msg });
        return;
      }

      const data = (await upstream.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      result = data.choices[0]?.message?.content ?? '[]';

    } else if (ANTHROPIC_KEY) {
      // Anthropic native API path
      const model = LLM_MODEL || 'claude-haiku-4-5-20251001';
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: 4096,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!upstream.ok) {
        const err = await upstream.json().catch(() => ({}));
        const msg =
          (err as { error?: { message?: string } })?.error?.message ??
          `Anthropic API error ${upstream.status}`;
        res.status(upstream.status).json({ error: msg });
        return;
      }

      const data = (await upstream.json()) as {
        content: Array<{ type: string; text: string }>;
      };
      result = data.content.find((b) => b.type === 'text')?.text ?? '[]';

    } else {
      res.status(500).json({
        error:
          'No LLM configured. Set ANTHROPIC_API_KEY (for Claude) or LLM_BASE_URL + LLM_API_KEY + LLM_MODEL (for any OpenAI-compatible provider) in .env.local.',
      });
      return;
    }

    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'LLM request failed' });
  }
});

// DELETE /api/plaid/account/:itemId
app.delete('/api/plaid/account/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    const data = await readAccounts();
    const item = data.items.find((i) => i.itemId === itemId);

    if (item) {
      await plaid.itemRemove({ access_token: item.accessToken }).catch(() => {
        // best-effort revocation; continue regardless
      });
      data.items = data.items.filter((i) => i.itemId !== itemId);
      await writeAccounts(data);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: errorMessage(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Plaid server running on http://localhost:${PORT}`);
  console.log(`Environment: ${plaidEnv}`);

  if (!PLAID_CLIENT_ID || PLAID_CLIENT_ID === 'your-plaid-client-id') {
    console.warn('⚠  PLAID_CLIENT_ID is not set — update .env.local with your Plaid credentials');
  } else {
    console.log(`   Client ID: ${PLAID_CLIENT_ID.slice(0, 6)}…`);
  }
  if (!PLAID_SECRET || PLAID_SECRET === 'your-plaid-secret-key') {
    console.warn('⚠  PLAID_SECRET is not set — update .env.local with your Plaid credentials');
  } else {
    console.log(`   Secret:    ${PLAID_SECRET.slice(0, 4)}… (loaded)`);
  }
});

import type { Expense } from '../types';

const SHEET_NAME = 'Expenses';
const MERCHANT_SHEET = 'MerchantRules';
const BUDGET_SHEET = 'Budgets';
const HEADER_ROW = ['ID', 'Date', 'Description', 'Amount', 'Category', 'Source', 'CreatedAt'];
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function sheetsRequest(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${SHEETS_API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeader(token),
      ...(options.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? `Sheets API error ${res.status}`);
  }
  return res;
}

/**
 * Ensure the spreadsheet has Expenses, MerchantRules, and Budgets sheets.
 */
export async function initSheet(token: string, spreadsheetId: string): Promise<void> {
  const metaRes = await sheetsRequest(token, `/${spreadsheetId}?fields=sheets.properties.title`);
  const meta = await metaRes.json();
  const sheets: Array<{ properties: { title: string } }> = meta.sheets ?? [];
  const titles = sheets.map((s) => s.properties.title);

  const sheetsToCreate = [
    { name: SHEET_NAME, missing: !titles.includes(SHEET_NAME) },
    { name: MERCHANT_SHEET, missing: !titles.includes(MERCHANT_SHEET) },
    { name: BUDGET_SHEET, missing: !titles.includes(BUDGET_SHEET) },
  ].filter((s) => s.missing);

  if (sheetsToCreate.length > 0) {
    await sheetsRequest(token, `/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: sheetsToCreate.map((s) => ({
          addSheet: { properties: { title: s.name } },
        })),
      }),
    });
  }

  // Ensure Expenses header
  const rangeRes = await sheetsRequest(
    token,
    `/${spreadsheetId}/values/${SHEET_NAME}!A1:G1`
  );
  const rangeData = await rangeRes.json();
  const firstRow: string[] = rangeData.values?.[0] ?? [];
  if (firstRow[0] !== 'ID') {
    await sheetsRequest(
      token,
      `/${spreadsheetId}/values/${SHEET_NAME}!A1:G1?valueInputOption=RAW`,
      {
        method: 'PUT',
        body: JSON.stringify({ values: [HEADER_ROW] }),
      }
    );
  }

  // Ensure MerchantRules header
  const mrRes = await sheetsRequest(token, `/${spreadsheetId}/values/${MERCHANT_SHEET}!A1:B1`);
  const mrData = await mrRes.json();
  if ((mrData.values?.[0]?.[0] ?? '') !== 'Merchant') {
    await sheetsRequest(
      token,
      `/${spreadsheetId}/values/${MERCHANT_SHEET}!A1:B1?valueInputOption=RAW`,
      { method: 'PUT', body: JSON.stringify({ values: [['Merchant', 'Category']] }) }
    );
  }

  // Ensure Budgets header
  const bRes = await sheetsRequest(token, `/${spreadsheetId}/values/${BUDGET_SHEET}!A1:B1`);
  const bData = await bRes.json();
  if ((bData.values?.[0]?.[0] ?? '') !== 'Category') {
    await sheetsRequest(
      token,
      `/${spreadsheetId}/values/${BUDGET_SHEET}!A1:B1?valueInputOption=RAW`,
      { method: 'PUT', body: JSON.stringify({ values: [['Category', 'MonthlyAmount']] }) }
    );
  }
}

/** Fetch all expenses from the sheet. */
export async function fetchExpenses(
  token: string,
  spreadsheetId: string
): Promise<Expense[]> {
  const res = await sheetsRequest(
    token,
    `/${spreadsheetId}/values/${SHEET_NAME}!A2:G`
  );
  const data = await res.json();
  const rows: string[][] = data.values ?? [];
  return rows
    .filter((r) => r[0])
    .map((r) => ({
      id: r[0] ?? '',
      date: r[1] ?? '',
      description: r[2] ?? '',
      amount: parseFloat(r[3] ?? '0'),
      category: r[4] ?? 'Other',
      source: (r[5] as Expense['source']) ?? 'manual',
      createdAt: r[6] ?? '',
    }));
}

/** Append one or more expenses as rows. */
export async function appendExpenses(
  token: string,
  spreadsheetId: string,
  expenses: Expense[]
): Promise<void> {
  const values = expenses.map((e) => [
    e.id,
    e.date,
    e.description,
    e.amount,
    e.category,
    e.source,
    e.createdAt,
  ]);

  await sheetsRequest(
    token,
    `/${spreadsheetId}/values/${SHEET_NAME}!A:G:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      body: JSON.stringify({ values }),
    }
  );
}

/** Update an existing expense row in the sheet (finds by ID). */
export async function updateExpense(
  token: string,
  spreadsheetId: string,
  expense: Expense
): Promise<void> {
  const idsRes = await sheetsRequest(token, `/${spreadsheetId}/values/${SHEET_NAME}!A2:A`);
  const idsData = await idsRes.json();
  const ids: string[][] = idsData.values ?? [];
  const rowIndex = ids.findIndex((r) => r[0] === expense.id);
  if (rowIndex === -1) throw new Error('Expense not found in sheet');
  const sheetRow = rowIndex + 2; // 1-indexed + header offset

  await sheetsRequest(
    token,
    `/${spreadsheetId}/values/${SHEET_NAME}!A${sheetRow}:G${sheetRow}?valueInputOption=RAW`,
    {
      method: 'PUT',
      body: JSON.stringify({
        values: [[
          expense.id,
          expense.date,
          expense.description,
          expense.amount,
          expense.category,
          expense.source,
          expense.createdAt,
        ]],
      }),
    }
  );
}

/** Delete an expense row from the sheet (finds by ID). */
export async function deleteExpense(
  token: string,
  spreadsheetId: string,
  id: string
): Promise<void> {
  // Get numeric sheetId for the Expenses sheet
  const metaRes = await sheetsRequest(
    token,
    `/${spreadsheetId}?fields=sheets.properties`
  );
  const meta = await metaRes.json();
  const sheetMeta = (meta.sheets as Array<{ properties: { title: string; sheetId: number } }>)
    .find((s) => s.properties.title === SHEET_NAME);
  if (!sheetMeta) throw new Error('Expenses sheet not found');
  const sheetId = sheetMeta.properties.sheetId;

  // Find the row
  const idsRes = await sheetsRequest(token, `/${spreadsheetId}/values/${SHEET_NAME}!A2:A`);
  const idsData = await idsRes.json();
  const ids: string[][] = idsData.values ?? [];
  const rowIndex = ids.findIndex((r) => r[0] === id);
  if (rowIndex === -1) throw new Error('Expense not found in sheet');
  const startIndex = rowIndex + 1; // 0-indexed in batchUpdate (row 0 = header, row 1 = first data row)

  await sheetsRequest(token, `/${spreadsheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [{
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            startIndex,
            endIndex: startIndex + 1,
          },
        },
      }],
    }),
  });
}

/** Fetch all merchant → category rules. */
export async function fetchMerchantRules(
  token: string,
  spreadsheetId: string
): Promise<Record<string, string>> {
  const res = await sheetsRequest(token, `/${spreadsheetId}/values/${MERCHANT_SHEET}!A2:B`);
  const data = await res.json();
  const rows: string[][] = data.values ?? [];
  const rules: Record<string, string> = {};
  rows.forEach((r) => {
    if (r[0] && r[1]) rules[r[0]] = r[1];
  });
  return rules;
}

/** Save or update a single merchant → category rule. */
export async function saveMerchantRule(
  token: string,
  spreadsheetId: string,
  merchant: string,
  category: string
): Promise<void> {
  // Fetch existing rules to find if this merchant already has a row
  const res = await sheetsRequest(token, `/${spreadsheetId}/values/${MERCHANT_SHEET}!A2:A`);
  const data = await res.json();
  const merchants: string[][] = data.values ?? [];
  const rowIndex = merchants.findIndex((r) => r[0] === merchant);

  if (rowIndex !== -1) {
    // Update existing row
    const sheetRow = rowIndex + 2;
    await sheetsRequest(
      token,
      `/${spreadsheetId}/values/${MERCHANT_SHEET}!A${sheetRow}:B${sheetRow}?valueInputOption=RAW`,
      { method: 'PUT', body: JSON.stringify({ values: [[merchant, category]] }) }
    );
  } else {
    // Append new row
    await sheetsRequest(
      token,
      `/${spreadsheetId}/values/${MERCHANT_SHEET}!A:B:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values: [[merchant, category]] }) }
    );
  }
}

/** Fetch all category budgets (monthly amounts). */
export async function fetchBudgets(
  token: string,
  spreadsheetId: string
): Promise<Record<string, number>> {
  const res = await sheetsRequest(token, `/${spreadsheetId}/values/${BUDGET_SHEET}!A2:B`);
  const data = await res.json();
  const rows: string[][] = data.values ?? [];
  const budgets: Record<string, number> = {};
  rows.forEach((r) => {
    if (r[0] && r[1]) budgets[r[0]] = parseFloat(r[1]);
  });
  return budgets;
}

/** Overwrite all budgets (clears sheet, re-writes non-zero entries). */
export async function saveBudgets(
  token: string,
  spreadsheetId: string,
  budgets: Record<string, number>
): Promise<void> {
  // Clear existing data rows
  await sheetsRequest(
    token,
    `/${spreadsheetId}/values/${BUDGET_SHEET}!A2:B?valueInputOption=RAW`,
    { method: 'PUT', body: JSON.stringify({ values: [] }) }
  );

  const nonZero = Object.entries(budgets).filter(([, v]) => v > 0);
  if (nonZero.length === 0) return;

  await sheetsRequest(
    token,
    `/${spreadsheetId}/values/${BUDGET_SHEET}!A:B:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { method: 'POST', body: JSON.stringify({ values: nonZero }) }
  );
}

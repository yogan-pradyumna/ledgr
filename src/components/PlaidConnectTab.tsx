import { useCallback, useEffect, useState } from 'react';
import type { Expense, PlaidTransactionRow } from '../types';
import { CATEGORIES } from '../types';
import { mapPlaidCategory } from '../utils/plaidCategories';
import { findDuplicateIndices } from '../utils/duplicates';
import { applyMerchantRules } from '../utils/merchantMemory';
import { CURRENCY } from '../utils/currency';

interface Props {
  expenses: Expense[];
  onImport: (expenses: Expense[]) => Promise<void>;
  merchantRules: Record<string, string>;
  onMerchantLearned: (description: string, category: string) => void;
}

type Phase = 'idle' | 'connected' | 'review';

interface ConnectedItem {
  itemId: string;
  institutionName: string;
  accounts: Array<{ accountId: string; name: string; mask: string }>;
  connectedAt: string;
}

interface PlaidMetadata {
  institution: { name: string; institution_id: string };
  accounts: Array<{ id: string; name: string; mask: string; type: string; subtype: string }>;
}

interface PlaidHandler {
  open: () => void;
}

interface PlaidWindow extends Window {
  Plaid: {
    create: (config: {
      token: string;
      onSuccess: (publicToken: string, metadata: PlaidMetadata) => void;
      onExit: () => void;
      onLoad: () => void;
    }) => PlaidHandler;
  };
}

async function loadPlaidScript(): Promise<void> {
  if ((window as unknown as PlaidWindow).Plaid) return;
  return new Promise((resolve, reject) => {
    if (document.getElementById('plaid-link-script')) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = 'plaid-link-script';
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Plaid Link script'));
    document.head.appendChild(script);
  });
}

export default function PlaidConnectTab({ expenses, onImport, merchantRules, onMerchantLearned }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [connectedItems, setConnectedItems] = useState<ConnectedItem[]>([]);
  const [transactions, setTransactions] = useState<PlaidTransactionRow[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [fetchingTransactions, setFetchingTransactions] = useState(false);
  const [importing, setImporting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [linkLoading, setLinkLoading] = useState(false);
  const [days, setDays] = useState(30);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadAccounts = useCallback(async () => {
    setLoadingAccounts(true);
    setError('');
    try {
      const res = await fetch('/api/plaid/accounts');
      if (!res.ok) throw new Error('Could not reach the Plaid server. Is it running?');
      const data = await res.json() as { items: ConnectedItem[] };
      setConnectedItems(data.items);
      setPhase(data.items.length > 0 ? 'connected' : 'idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connected accounts.');
    } finally {
      setLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const exchangeToken = useCallback(async (public_token: string, metadata: PlaidMetadata) => {
    try {
      const res = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_token,
          institution: metadata.institution,
          accounts: metadata.accounts,
        }),
      });
      if (!res.ok) throw new Error('Token exchange failed');
      await loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect bank account.');
    }
  }, [loadAccounts]);

  const handleConnectBank = useCallback(async () => {
    setLinkLoading(true);
    setError('');
    try {
      const res = await fetch('/api/plaid/link-token', { method: 'POST' });
      const data = await res.json() as { link_token?: string; error?: string };
      if (!data.link_token) throw new Error(data.error ?? 'Failed to get link token');

      await loadPlaidScript();

      const handler = (window as unknown as PlaidWindow).Plaid.create({
        token: data.link_token,
        onSuccess: async (public_token: string, metadata: PlaidMetadata) => {
          setLinkLoading(false);
          await exchangeToken(public_token, metadata);
        },
        onExit: () => setLinkLoading(false),
        onLoad: () => setLinkLoading(false),
      });
      handler.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize Plaid Link.');
      setLinkLoading(false);
    }
  }, [exchangeToken]);

  const handleFetchTransactions = async () => {
    setFetchingTransactions(true);
    setError('');
    setTransactions([]);
    try {
      const res = await fetch(`/api/plaid/transactions?days=${days}`);
      const data = await res.json() as {
        transactions: Array<{
          plaidTransactionId: string;
          date: string;
          description: string;
          amount: number;
          plaidCategory: string;
          plaidCategoryDetailed?: string;
          institutionName: string;
          isPayment: boolean;
        }>;
        error?: string;
      };

      if (data.error) throw new Error(data.error);

      if (data.transactions.length === 0) {
        setError(`No transactions found in the last ${days} days.`);
        return;
      }

      const rawRows = data.transactions.map((tx) => ({
        plaidTransactionId: tx.plaidTransactionId,
        date: tx.date,
        description: tx.description,
        amount: tx.amount,
        category: mapPlaidCategory(tx.plaidCategory, tx.plaidCategoryDetailed),
        institutionName: tx.institutionName,
        isPayment: tx.isPayment,
      }));

      const withRules = applyMerchantRules(rawRows, merchantRules);
      const dupeIndices = findDuplicateIndices(expenses, withRules);

      const rows: PlaidTransactionRow[] = withRules.map((tx, idx) => ({
        ...tx,
        selected: !dupeIndices.has(idx) && !tx.isPayment,
        isDuplicate: dupeIndices.has(idx),
      }));

      setTransactions(rows);
      setPhase('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions.');
    } finally {
      setFetchingTransactions(false);
    }
  };

  const toggleRow = (idx: number) =>
    setTransactions((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, selected: !t.selected } : t))
    );

  const updateCategory = (idx: number, category: string) => {
    const desc = transactions[idx]?.description;
    if (desc) onMerchantLearned(desc, category);
    setTransactions((prev) =>
      prev.map((t, i) => (i === idx ? { ...t, category } : t))
    );
  };

  const toggleAll = (selected: boolean) =>
    setTransactions((prev) =>
      prev.map((t) => ({
        ...t,
        // When selecting all, skip duplicate and payment rows; they can be manually re-checked
        selected: selected && (t.isDuplicate || t.isPayment) ? false : selected,
      }))
    );

  const handleImport = async () => {
    const selected = transactions.filter((t) => t.selected);
    if (selected.length === 0) {
      setError('Select at least one transaction to import.');
      return;
    }
    setImporting(true);
    setError('');
    try {
      const importedExpenses: Expense[] = selected.map((t) => ({
        id: crypto.randomUUID(),
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        source: 'plaid' as const,
        createdAt: new Date().toISOString(),
      }));
      await onImport(importedExpenses);
      setTransactions([]);
      setPhase('connected');
      setSuccess(`Imported ${importedExpenses.length} transaction${importedExpenses.length !== 1 ? 's' : ''} successfully.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import transactions.');
    } finally {
      setImporting(false);
    }
  };

  const handleRemoveAccount = async (itemId: string) => {
    setRemovingId(itemId);
    setError('');
    try {
      await fetch(`/api/plaid/account/${itemId}`, { method: 'DELETE' });
      await loadAccounts();
    } catch {
      setError('Failed to remove account.');
    } finally {
      setRemovingId(null);
    }
  };

  const selectedCount = transactions.filter((t) => t.selected).length;
  const duplicateCount = transactions.filter((t) => t.isDuplicate).length;
  const paymentCount = transactions.filter((t) => t.isPayment).length;

  if (loadingAccounts) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
        Loading connected accounts…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connected banks */}
      {connectedItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-700">Connected banks</p>
          {connectedItems.map((item) => (
            <div
              key={item.itemId}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">{item.institutionName}</p>
                <p className="text-xs text-gray-500">
                  {item.accounts.map((a) => `${a.name} (••••${a.mask})`).join(', ')}
                </p>
              </div>
              <button
                onClick={() => handleRemoveAccount(item.itemId)}
                disabled={removingId === item.itemId}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                {removingId === item.itemId ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Connect button */}
      <button
        onClick={handleConnectBank}
        disabled={linkLoading}
        className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm font-medium text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <BankIcon />
        {linkLoading
          ? 'Opening Plaid Link…'
          : connectedItems.length > 0
          ? 'Connect another bank'
          : 'Connect your bank account'}
      </button>

      {/* Fetch controls */}
      {connectedItems.length > 0 && phase !== 'review' && (
        <div className="flex items-center gap-3">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={handleFetchTransactions}
            disabled={fetchingTransactions}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {fetchingTransactions ? 'Fetching transactions…' : 'Fetch transactions'}
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      {/* Review table */}
      {phase === 'review' && transactions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} found
              </p>
              {paymentCount > 0 && (
                <p className="text-xs text-purple-600">
                  {paymentCount} payment/transfer{paymentCount !== 1 ? 's' : ''} auto-deselected
                </p>
              )}
              {duplicateCount > 0 && (
                <p className="text-xs text-amber-600">
                  {duplicateCount} possible duplicate{duplicateCount !== 1 ? 's' : ''} auto-deselected
                </p>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              <button onClick={() => toggleAll(true)} className="text-blue-600 hover:underline">All</button>
              <span className="text-gray-400">/</span>
              <button onClick={() => toggleAll(false)} className="text-blue-600 hover:underline">None</button>
              <span className="text-gray-300">|</span>
              <button onClick={() => setPhase('connected')} className="text-gray-500 hover:underline">
                ← Back
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-96 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="px-3 py-2 text-left w-8"></th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Description</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Bank</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((t, idx) => (
                  <tr
                    key={t.plaidTransactionId}
                    className={`transition-colors ${
                      t.isPayment
                        ? 'bg-purple-50'
                        : t.isDuplicate
                        ? 'bg-amber-50'
                        : t.selected
                        ? 'bg-white'
                        : 'bg-gray-50 opacity-50'
                    }`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={t.selected}
                        onChange={() => toggleRow(idx)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{t.date}</td>
                    <td className="px-3 py-2 text-gray-900 max-w-xs truncate">
                      {t.description}
                      {t.isPayment && (
                        <span className="ml-1.5 text-xs font-medium text-purple-600">payment?</span>
                      )}
                      {t.isDuplicate && (
                        <span className="ml-1.5 text-xs font-medium text-amber-600">duplicate?</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{t.institutionName}</td>
                    <td className="px-3 py-2 text-right font-mono font-medium text-gray-900">
                      {CURRENCY}{t.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={t.category}
                        onChange={(e) => updateCategory(idx, e.target.value)}
                        disabled={!t.selected}
                        className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white focus:outline-none disabled:opacity-60"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            onClick={handleImport}
            disabled={importing || selectedCount === 0}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing
              ? 'Importing…'
              : `Import ${selectedCount} Transaction${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}

function BankIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="3" y1="22" x2="21" y2="22" />
      <line x1="6" y1="18" x2="6" y2="11" />
      <line x1="10" y1="18" x2="10" y2="11" />
      <line x1="14" y1="18" x2="14" y2="11" />
      <line x1="18" y1="18" x2="18" y2="11" />
      <polygon points="12 2 2 7 22 7" />
    </svg>
  );
}

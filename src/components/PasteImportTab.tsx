import { useState } from 'react';
import type { Expense, ParsedTransaction } from '../types';
import { CATEGORIES } from '../types';
import { parseWithLLM } from '../services/pdfParser';
import { findDuplicateIndices } from '../utils/duplicates';
import { applyMerchantRules } from '../utils/merchantMemory';
import { CURRENCY } from '../utils/currency';

interface Props {
  expenses: Expense[];
  onImport: (expenses: Expense[]) => Promise<void>;
  merchantRules: Record<string, string>;
  onMerchantLearned: (description: string, category: string) => void;
}

interface ReviewRow extends ParsedTransaction {
  isDuplicate: boolean;
}

export default function PasteImportTab({ expenses, onImport, merchantRules, onMerchantLearned }: Props) {
  const [text, setText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [transactions, setTransactions] = useState<ReviewRow[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleParse = async () => {
    if (!text.trim()) {
      setError('Paste some transaction text first.');
      return;
    }
    setError('');
    setSuccess('');
    setParsing(true);
    try {
      const parsed = await parseWithLLM(text);
      if (parsed.length === 0) {
        setError('No transactions found. Make sure the text contains transaction data with dates and amounts.');
        return;
      }
      const withRules = applyMerchantRules(parsed, merchantRules);
      const dupeIndices = findDuplicateIndices(expenses, withRules);
      const rows: ReviewRow[] = withRules.map((t, idx) => ({
        ...t,
        selected: !dupeIndices.has(idx) && !t.isPayment,
        isDuplicate: dupeIndices.has(idx),
      }));
      setTransactions(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse transactions.');
    } finally {
      setParsing(false);
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
      prev.map((t) => ({ ...t, selected: selected && (t.isDuplicate || t.isPayment) ? false : selected }))
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
      const imported: Expense[] = selected.map((t) => ({
        id: crypto.randomUUID(),
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        source: 'statement' as const,
        createdAt: new Date().toISOString(),
      }));
      await onImport(imported);
      setTransactions([]);
      setText('');
      setSuccess(`Imported ${imported.length} transaction${imported.length !== 1 ? 's' : ''} successfully.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import transactions.');
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = transactions.filter((t) => t.selected).length;
  const duplicateCount = transactions.filter((t) => t.isDuplicate).length;
  const paymentCount = transactions.filter((t) => t.isPayment).length;

  return (
    <div className="space-y-4">
      {transactions.length === 0 ? (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paste transaction data from your bank's website
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Copy transaction rows from your bank's online portal and paste them here. Your LLM will extract the dates, descriptions, amounts, and categories automatically.
            </p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Example:\nDate        Description              Amount\n01/15/2025  AMAZON.COM               $45.99\n01/16/2025  NETFLIX                  $15.99\n01/17/2025  WHOLEFOODS MARKET        $87.42`}
              rows={12}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleParse}
            disabled={parsing || !text.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {parsing ? 'Parsing…' : 'Parse Transactions'}
          </button>
        </>
      ) : (
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
              <button
                onClick={() => { setTransactions([]); setError(''); }}
                className="text-gray-500 hover:underline"
              >
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
                  <th className="px-3 py-2 text-right font-medium text-gray-600">Amount</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-600">Category</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {transactions.map((t, idx) => (
                  <tr
                    key={idx}
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

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

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

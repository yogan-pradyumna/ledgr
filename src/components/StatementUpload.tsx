import { useCallback, useState } from 'react';
import type { Expense, ParsedTransaction } from '../types';
import { CATEGORIES } from '../types';
import { parsePDFStatement } from '../services/pdfParser';
import { applyMerchantRules } from '../utils/merchantMemory';

interface Props {
  onImport: (expenses: Expense[]) => Promise<void>;
  merchantRules: Record<string, string>;
  onMerchantLearned: (description: string, category: string) => void;
}

export default function StatementUpload({ onImport, merchantRules, onMerchantLearned }: Props) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const processFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please upload a PDF file.');
      return;
    }
    setError('');
    setSuccess('');
    setParsing(true);
    try {
      const parsed = await parsePDFStatement(file);
      if (parsed.length === 0) {
        setError('No transactions found in this PDF. The parser works best with text-based PDFs from banks.');
      } else {
        setTransactions(applyMerchantRules(parsed, merchantRules));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse PDF.');
    } finally {
      setParsing(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
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
      prev.map((t) => ({ ...t, selected: selected && t.isPayment ? false : selected }))
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
      const expenses: Expense[] = selected.map((t) => ({
        id: crypto.randomUUID(),
        date: t.date,
        description: t.description,
        amount: t.amount,
        category: t.category,
        source: 'statement',
        createdAt: new Date().toISOString(),
      }));
      await onImport(expenses);
      setTransactions([]);
      setSuccess(`Imported ${expenses.length} transaction${expenses.length !== 1 ? 's' : ''} successfully.`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import transactions.');
    } finally {
      setImporting(false);
    }
  };

  const selectedCount = transactions.filter((t) => t.selected).length;
  const paymentCount = transactions.filter((t) => t.isPayment).length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
          dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
        onClick={() => document.getElementById('pdf-input')?.click()}
      >
        <input
          id="pdf-input"
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={onFileChange}
        />
        <div className="flex flex-col items-center gap-2">
          <PdfIcon />
          {parsing ? (
            <p className="text-sm text-blue-600 font-medium">Parsing PDF…</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-700">
                Drop your bank statement PDF here, or click to browse
              </p>
              <p className="text-xs text-gray-500">Works with text-based PDF exports from most banks</p>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">{success}</p>}

      {/* Review table */}
      {transactions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-700">
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''} found — review and select which to import
              </p>
              {paymentCount > 0 && (
                <p className="text-xs text-purple-600">
                  {paymentCount} payment/transfer{paymentCount !== 1 ? 's' : ''} auto-deselected
                </p>
              )}
            </div>
            <div className="flex gap-2 text-xs">
              <button onClick={() => toggleAll(true)} className="text-blue-600 hover:underline">All</button>
              <span className="text-gray-400">/</span>
              <button onClick={() => toggleAll(false)} className="text-blue-600 hover:underline">None</button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 max-h-80 overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
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
                  <tr key={idx} className={t.isPayment ? 'bg-purple-50' : t.selected ? 'bg-white' : 'bg-gray-50 opacity-50'}>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={t.selected}
                        onChange={() => toggleRow(idx)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{t.date}</td>
                    <td className="px-3 py-2 text-gray-700 max-w-xs truncate">
                      {t.description}
                      {t.isPayment && (
                        <span className="ml-1.5 text-xs font-medium text-purple-600">payment?</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-gray-900">
                      ${t.amount.toFixed(2)}
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={t.category}
                        onChange={(e) => updateCategory(idx, e.target.value)}
                        className="text-xs border border-gray-200 rounded px-1 py-0.5 bg-white"
                        disabled={!t.selected}
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
            {importing ? 'Importing…' : `Import ${selectedCount} Transaction${selectedCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  );
}

function PdfIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="13" x2="15" y2="13"/>
      <line x1="9" y1="17" x2="15" y2="17"/>
      <polyline points="9 9 10 9 11 9"/>
    </svg>
  );
}

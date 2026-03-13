import { useState } from 'react';
import type { Expense } from '../types';
import { CATEGORIES } from '../types';
import { findDuplicate } from '../utils/duplicates';
import { CURRENCY } from '../utils/currency';

interface Props {
  expenses: Expense[];
  onSubmit: (expense: Expense) => Promise<void>;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

export default function ExpenseForm({ expenses, onSubmit }: Props) {
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string>('Other');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Duplicate confirmation state
  const [pendingExpense, setPendingExpense] = useState<Expense | null>(null);
  const [duplicate, setDuplicate] = useState<Expense | null>(null);

  const resetForm = () => {
    setDescription('');
    setAmount('');
    setDate(today());
    setCategory('Other');
  };

  const save = async (expense: Expense) => {
    setSaving(true);
    try {
      await onSubmit(expense);
      resetForm();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const amt = parseFloat(amount);
    if (!date || !description.trim() || isNaN(amt) || amt <= 0) {
      setError('Please fill in all fields with valid values.');
      return;
    }

    const expense: Expense = {
      id: crypto.randomUUID(),
      date,
      description: description.trim(),
      amount: amt,
      category,
      source: 'manual',
      createdAt: new Date().toISOString(),
    };

    const dup = findDuplicate(expenses, expense);
    if (dup) {
      setPendingExpense(expense);
      setDuplicate(dup);
      return;
    }

    await save(expense);
  };

  const handleConfirmAdd = async () => {
    if (!pendingExpense) return;
    setDuplicate(null);
    setPendingExpense(null);
    await save(pendingExpense);
  };

  const handleCancelAdd = () => {
    setDuplicate(null);
    setPendingExpense(null);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount ({CURRENCY})</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <input
          type="text"
          placeholder="e.g. Grocery store, Netflix, Uber"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Duplicate warning */}
      {duplicate && pendingExpense && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-amber-500 text-base leading-none mt-0.5">⚠</span>
            <div className="text-sm text-amber-800">
              <p className="font-medium mb-1">Possible duplicate detected</p>
              <p className="text-amber-700">
                An identical entry already exists:
              </p>
              <p className="mt-1 font-mono text-xs bg-amber-100 rounded px-2 py-1 text-amber-900">
                {formatDate(duplicate.date)} · {duplicate.description} · ${duplicate.amount.toFixed(2)} · {duplicate.category}
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancelAdd}
              className="px-3 py-1.5 text-sm font-medium text-gray-600 border border-gray-300 bg-white rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAdd}
              disabled={saving}
              className="px-3 py-1.5 text-sm font-medium text-amber-800 border border-amber-400 bg-amber-100 rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Add Anyway'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {success && <p className="text-sm text-green-600">Expense saved!</p>}

      {!duplicate && (
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Add Expense'}
        </button>
      )}
    </form>
  );
}

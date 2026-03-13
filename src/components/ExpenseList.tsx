import { useMemo, useState } from 'react';
import type { Expense } from '../types';
import { CATEGORIES } from '../types';
import { CURRENCY } from '../utils/currency';

interface Props {
  expenses: Expense[];
  loading: boolean;
  onUpdate: (expense: Expense) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onMerchantLearned: (description: string, category: string) => void;
}

const ALL = 'All';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function ExpenseList({ expenses, loading, onUpdate, onDelete, onMerchantLearned }: Props) {
  const [filterCategory, setFilterCategory] = useState(ALL);
  const [filterSource, setFilterSource] = useState(ALL);
  const [filterYear, setFilterYear] = useState(ALL);
  const [filterMonth, setFilterMonth] = useState(ALL);
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [filterSearch, setFilterSearch] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Expense | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const currentYear = new Date().getFullYear();

  const availableYears = useMemo(() =>
    Array.from(new Set(expenses.map((e) => e.date.split('-')[0]))).sort((a, b) => b.localeCompare(a)),
    [expenses]
  );

  const filtered = useMemo(() => {
    const search = filterSearch.toLowerCase();
    return expenses
      .filter((e) => filterCategory === ALL || e.category === filterCategory)
      .filter((e) => filterSource === ALL || e.source === filterSource)
      .filter((e) => filterYear === ALL || e.date.startsWith(filterYear))
      .filter((e) => filterMonth === ALL || e.date.split('-')[1] === filterMonth)
      .filter((e) => !filterFrom || e.date >= filterFrom)
      .filter((e) => !filterTo || e.date <= filterTo)
      .filter((e) => !search || e.description.toLowerCase().includes(search))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, filterCategory, filterSource, filterYear, filterMonth, filterFrom, filterTo, filterSearch]);

  const total = useMemo(() => filtered.reduce((sum, e) => sum + e.amount, 0), [filtered]);

  const displayYear = filterYear !== ALL ? filterYear : String(currentYear);

  const yearlyTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    filtered.forEach((e) => {
      const year = e.date.split('-')[0];
      totals[year] = (totals[year] ?? 0) + e.amount;
    });
    return Object.entries(totals).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filtered]);

  const maxYearly = Math.max(...yearlyTotals.map(([, v]) => v), 1);

  const monthlyTotals = useMemo(() => {
    const totals = Array(12).fill(0) as number[];
    filtered.forEach((e) => {
      if (e.date.startsWith(displayYear)) {
        const month = parseInt(e.date.split('-')[1]) - 1;
        totals[month] += e.amount;
      }
    });
    return totals;
  }, [filtered, displayYear]);

  const maxMonthly = Math.max(...monthlyTotals, 1);

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthName = `${MONTHS[now.getMonth()]} ${now.getFullYear()}`;

  const hasActiveFilter =
    filterMonth !== ALL || filterYear !== ALL || !!filterFrom || !!filterTo ||
    filterCategory !== ALL || filterSource !== ALL || !!filterSearch;

  const categoryTotals = useMemo(() => {
    const source = hasActiveFilter
      ? filtered
      : filtered.filter((e) => e.date.startsWith(currentYearMonth));
    const totals: Record<string, number> = {};
    source.forEach((e) => {
      totals[e.category] = (totals[e.category] ?? 0) + e.amount;
    });
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1]);
  }, [filtered, hasActiveFilter, currentYearMonth]);

  const maxCategory = Math.max(...categoryTotals.map(([, v]) => v), 1);

  const startEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setEditDraft({ ...expense });
    setConfirmDeleteId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft(null);
  };

  const saveEdit = async () => {
    if (!editDraft) return;
    setSavingId(editDraft.id);
    try {
      const original = expenses.find((e) => e.id === editDraft.id);
      await onUpdate(editDraft);
      if (original && original.category !== editDraft.category) {
        onMerchantLearned(editDraft.description, editDraft.category);
      }
      setEditingId(null);
      setEditDraft(null);
    } finally {
      setSavingId(null);
    }
  };

  const confirmDelete = (id: string) => {
    setConfirmDeleteId(id);
    setEditingId(null);
    setEditDraft(null);
  };

  const executeDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDelete(id);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
        Loading expenses…
      </div>
    );
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search by description…"
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => {
              setFilterCategory(ALL);
              setFilterSource(ALL);
              setFilterYear(ALL);
              setFilterMonth(ALL);
              setFilterFrom('');
              setFilterTo('');
              setFilterSearch('');
            }}
            className="px-3 py-2 text-sm font-medium text-gray-500 border border-gray-200 bg-gray-100 rounded-lg hover:bg-gray-200 hover:text-gray-700 transition-colors whitespace-nowrap"
          >
            Reset
          </button>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={ALL}>All</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Source</label>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={ALL}>All</option>
              <option value="manual">Manual</option>
              <option value="statement">Statement</option>
              <option value="plaid">Bank Sync</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Year</label>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={ALL}>All</option>
              {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Month</label>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={ALL}>All</option>
              {MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="flex items-center justify-between bg-blue-50 rounded-lg px-4 py-3">
          <span className="text-sm text-blue-700 font-medium">
            {filtered.length} expense{filtered.length !== 1 ? 's' : ''}
          </span>
          <span className="text-base font-semibold text-blue-900">
            Total: {CURRENCY}{total.toFixed(2)}
          </span>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            {expenses.length === 0
              ? 'No expenses yet. Add one manually or import from a statement.'
              : 'No expenses match your filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Description</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Category</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">Amount</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600">Source</th>
                  <th className="px-4 py-3 text-center font-medium text-gray-600 w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((expense) => {
                  const isEditing = editingId === expense.id;
                  const isConfirmingDelete = confirmDeleteId === expense.id;
                  const isSaving = savingId === expense.id;
                  const isDeleting = deletingId === expense.id;

                  if (isEditing && editDraft) {
                    return (
                      <tr key={expense.id} className="bg-blue-50">
                        <td className="px-4 py-2">
                          <input
                            type="date"
                            value={editDraft.date}
                            onChange={(e) => setEditDraft({ ...editDraft, date: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <input
                            type="text"
                            value={editDraft.description}
                            onChange={(e) => setEditDraft({ ...editDraft, description: e.target.value })}
                            className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2">
                          <select
                            value={editDraft.category}
                            onChange={(e) => setEditDraft({ ...editDraft, category: e.target.value })}
                            className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={editDraft.amount}
                            onChange={(e) => setEditDraft({ ...editDraft, amount: parseFloat(e.target.value) || 0 })}
                            className="w-24 border border-gray-300 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                            expense.source === 'manual' ? 'bg-purple-100 text-purple-700'
                            : expense.source === 'plaid' ? 'bg-blue-100 text-blue-700'
                            : 'bg-teal-100 text-teal-700'
                          }`}>
                            {expense.source === 'manual' ? 'Manual' : expense.source === 'plaid' ? 'Bank Sync' : 'Statement'}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={saveEdit}
                              disabled={isSaving}
                              title="Save"
                              className="p-1.5 rounded text-green-600 hover:bg-green-50 disabled:opacity-50 transition-colors"
                            >
                              {isSaving ? <SpinnerIcon /> : <CheckIcon />}
                            </button>
                            <button
                              onClick={cancelEdit}
                              title="Cancel"
                              className="p-1.5 rounded text-gray-500 hover:bg-gray-100 transition-colors"
                            >
                              <XIcon />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr key={expense.id} className={`transition-colors ${isConfirmingDelete ? 'bg-red-50' : 'hover:bg-gray-50'}`}>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(expense.date)}
                      </td>
                      <td className="px-4 py-3 text-gray-900 max-w-xs truncate">
                        {expense.description}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor(expense.category)}`}>
                          {expense.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-gray-900">
                        {CURRENCY}{expense.amount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          expense.source === 'manual' ? 'bg-purple-100 text-purple-700'
                          : expense.source === 'plaid' ? 'bg-blue-100 text-blue-700'
                          : 'bg-teal-100 text-teal-700'
                        }`}>
                          {expense.source === 'manual' ? 'Manual' : expense.source === 'plaid' ? 'Bank Sync' : 'Statement'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isConfirmingDelete ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-xs text-red-600 font-medium mr-1">Delete?</span>
                            <button
                              onClick={() => executeDelete(expense.id)}
                              disabled={isDeleting}
                              className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50 px-1"
                            >
                              {isDeleting ? '…' : 'Yes'}
                            </button>
                            <button
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-xs font-medium text-gray-500 hover:text-gray-700 px-1"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => startEdit(expense)}
                              title="Edit"
                              className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              onClick={() => confirmDelete(expense.id)}
                              title="Delete"
                              className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Sidebar widgets */}
      <div className="w-48 shrink-0 space-y-4 sticky top-4">
        {/* Category breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">By Category</p>
          <p className="text-xs text-gray-400 mb-3">
            {hasActiveFilter ? 'filtered view' : currentMonthName}
          </p>
          {categoryTotals.length === 0 ? (
            <p className="text-xs text-gray-400">No data</p>
          ) : (
            <div className="space-y-1.5">
              {categoryTotals.map(([cat, total]) => (
                <div key={cat} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-16 shrink-0 truncate" title={cat}>{cat}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${(total / maxCategory) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-12 text-right shrink-0">
                    {CURRENCY}{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Monthly breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Monthly ({displayYear})</p>
          <div className="space-y-1.5">
            {MONTHS.map((month, i) => (
              <div key={month} className="flex items-center gap-2">
                <span className="text-xs text-gray-500 w-7 shrink-0">{month}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{ width: monthlyTotals[i] > 0 ? `${(monthlyTotals[i] / maxMonthly) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs font-medium text-gray-700 w-16 text-right shrink-0">
                  {monthlyTotals[i] > 0 ? `${CURRENCY}${monthlyTotals[i].toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Yearly breakdown */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">By Year</p>
          {yearlyTotals.length === 0 ? (
            <p className="text-xs text-gray-400">No data</p>
          ) : (
            <div className="space-y-1.5">
              {yearlyTotals.map(([year, total]) => (
                <div key={year} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 w-9 shrink-0">{year}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-violet-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${(total / maxYearly) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs font-medium text-gray-700 w-16 text-right shrink-0">
                    {CURRENCY}{total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${MONTHS[parseInt(m) - 1]} ${parseInt(d)}, ${y}`;
}

function categoryColor(cat: string): string {
  const map: Record<string, string> = {
    Insurance:                  'bg-sky-100 text-sky-700',
    'Commute/Car':              'bg-blue-100 text-blue-700',
    Mobile:                     'bg-cyan-100 text-cyan-700',
    'Self-development/Learning':'bg-violet-100 text-violet-700',
    Groceries:                  'bg-lime-100 text-lime-700',
    Food:                       'bg-orange-100 text-orange-700',
    Gifts:                      'bg-pink-100 text-pink-700',
    Travel:                     'bg-teal-100 text-teal-700',
    Household:                  'bg-amber-100 text-amber-700',
    Health:                     'bg-red-100 text-red-700',
    Internet:                   'bg-indigo-100 text-indigo-700',
    Rent:                       'bg-rose-100 text-rose-700',
    'OTT/Streaming Fees':       'bg-purple-100 text-purple-700',
    Entertainment:              'bg-fuchsia-100 text-fuchsia-700',
    Apparel:                    'bg-emerald-100 text-emerald-700',
    Utilities:                  'bg-yellow-100 text-yellow-700',
    Sports:                     'bg-green-100 text-green-700',
    'Art Supplies':             'bg-stone-100 text-stone-700',
    Furniture:                  'bg-orange-100 text-orange-700',
    Other:                      'bg-gray-100 text-gray-600',
  };
  return map[cat] ?? 'bg-gray-100 text-gray-600';
}

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="animate-spin">
      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
    </svg>
  );
}

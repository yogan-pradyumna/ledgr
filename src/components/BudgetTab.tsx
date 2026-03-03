import { useEffect, useState } from 'react';
import type { Expense } from '../types';
import { CATEGORIES } from '../types';

interface Props {
  expenses: Expense[];
  budgets: Record<string, number>;
  onSave: (budgets: Record<string, number>) => Promise<void>;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function BudgetTab({ expenses, budgets, onSave }: Props) {
  const [local, setLocal] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');

  // Sync local state when budgets prop changes
  useEffect(() => {
    const init: Record<string, string> = {};
    CATEGORIES.forEach((c) => {
      init[c] = budgets[c] ? String(budgets[c]) : '';
    });
    setLocal(init);
  }, [budgets]);

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthName = MONTHS[now.getMonth()];

  const monthlySpending = expenses.reduce<Record<string, number>>((acc, e) => {
    if (e.date.startsWith(currentYearMonth)) {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    }
    return acc;
  }, {});

  const hasChanges = CATEGORIES.some((c) => {
    const localVal = parseFloat(local[c] || '0') || 0;
    const savedVal = budgets[c] ?? 0;
    return localVal !== savedVal;
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated: Record<string, number> = {};
      CATEGORIES.forEach((c) => {
        const val = parseFloat(local[c] || '0');
        if (!isNaN(val) && val > 0) updated[c] = val;
      });
      await onSave(updated);
      setSuccess('Budgets saved.');
      setTimeout(() => setSuccess(''), 2500);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-800">Monthly Budgets</h2>
          <p className="text-xs text-gray-500 mt-0.5">{monthName} {now.getFullYear()} · leave blank to set no budget</p>
        </div>
        <div className="flex items-center gap-3">
          {success && <p className="text-sm text-green-600">{success}</p>}
          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-1.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {CATEGORIES.map((category) => {
          const spent = monthlySpending[category] ?? 0;
          const budget = parseFloat(local[category] || '0') || 0;
          const pct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
          const overBudget = budget > 0 && spent > budget;
          const nearBudget = budget > 0 && !overBudget && pct >= 80;

          const barColor = overBudget
            ? 'bg-red-500'
            : nearBudget
            ? 'bg-amber-400'
            : 'bg-green-500';

          return (
            <div key={category} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50 hover:bg-white transition-colors">
              {/* Category badge */}
              <div className="w-40 shrink-0">
                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${categoryColor(category)}`}>
                  {category}
                </span>
              </div>

              {/* Progress section */}
              <div className="flex-1 min-w-0">
                {budget > 0 ? (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span className={overBudget ? 'text-red-600 font-medium' : ''}>
                        ${spent.toFixed(0)} / ${budget.toFixed(0)}
                      </span>
                      <span className={`font-medium ${overBudget ? 'text-red-600' : nearBudget ? 'text-amber-600' : 'text-green-600'}`}>
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-gray-400">
                    {spent > 0 ? `$${spent.toFixed(2)} spent · no budget set` : 'no budget set'}
                  </span>
                )}
              </div>

              {/* Budget input */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-sm text-gray-400">$</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={local[category] ?? ''}
                  onChange={(e) => setLocal((prev) => ({ ...prev, [category]: e.target.value }))}
                  placeholder="—"
                  className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">/mo</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
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

import { useMemo } from 'react';
import type { Expense } from '../types';

interface Props {
  expenses: Expense[];
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Returns the last 12 calendar months as ['YYYY-MM', ...], oldest first. */
function last12Months(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return months;
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-');
  return `${MONTH_LABELS[parseInt(m) - 1]} '${y.slice(2)}`;
}

export default function TrendsTab({ expenses }: Props) {
  const months = useMemo(() => last12Months(), []);

  // category → month → total
  const grid = useMemo(() => {
    const earliest = months[0];
    const data: Record<string, Record<string, number>> = {};
    expenses.forEach((e) => {
      const ym = e.date.slice(0, 7);
      if (ym < earliest) return;
      if (!months.includes(ym)) return;
      if (!data[e.category]) data[e.category] = {};
      data[e.category][ym] = (data[e.category][ym] ?? 0) + e.amount;
    });
    return data;
  }, [expenses, months]);

  // Category row totals, sorted descending
  const categories = useMemo(() =>
    Object.entries(grid)
      .map(([cat, byMonth]) => ({
        cat,
        total: Object.values(byMonth).reduce((s, v) => s + v, 0),
      }))
      .filter(({ total }) => total > 0)
      .sort((a, b) => b.total - a.total)
      .map(({ cat }) => cat),
    [grid]
  );

  // Monthly totals (bottom row)
  const monthTotals = useMemo(() =>
    months.map((ym) =>
      categories.reduce((s, cat) => s + (grid[cat]?.[ym] ?? 0), 0)
    ),
    [months, categories, grid]
  );

  // Per-category max (for heatmap intensity within each row)
  const catMax = useMemo(() => {
    const m: Record<string, number> = {};
    categories.forEach((cat) => {
      m[cat] = Math.max(...months.map((ym) => grid[cat]?.[ym] ?? 0), 1);
    });
    return m;
  }, [categories, months, grid]);

  const grandTotal = monthTotals.reduce((s, v) => s + v, 0);
  const maxMonthTotal = Math.max(...monthTotals, 1);

  if (categories.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400 text-sm">
        No expense data in the last 12 months.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-gray-800">Spending Trends</h2>
        <p className="text-xs text-gray-500 mt-0.5">Month-over-month breakdown by category · last 12 months · sorted by total spend</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2.5 text-left font-medium text-gray-600 w-36 sticky left-0 bg-gray-50 z-10">Category</th>
              {months.map((ym) => (
                <th key={ym} className="px-2 py-2.5 text-center font-medium text-gray-500 whitespace-nowrap min-w-[72px]">
                  {monthLabel(ym)}
                </th>
              ))}
              <th className="px-3 py-2.5 text-right font-medium text-gray-600 whitespace-nowrap">12-mo Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {categories.map((cat) => {
              const rowTotal = months.reduce((s, ym) => s + (grid[cat]?.[ym] ?? 0), 0);
              const max = catMax[cat];
              return (
                <tr key={cat} className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-2 font-medium text-gray-700 sticky left-0 bg-white hover:bg-gray-50 z-10 max-w-[144px] truncate" title={cat}>
                    {cat}
                  </td>
                  {months.map((ym) => {
                    const val = grid[cat]?.[ym] ?? 0;
                    const intensity = val > 0 ? Math.max((val / max) * 0.85, 0.12) : 0;
                    return (
                      <td key={ym} className="px-2 py-2 text-center">
                        {val > 0 ? (
                          <span
                            className="inline-block px-1.5 py-0.5 rounded font-medium text-emerald-900"
                            style={{ backgroundColor: `rgba(16, 185, 129, ${intensity})` }}
                          >
                            ${val.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-semibold text-gray-800">
                    ${rowTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td className="px-3 py-2.5 font-semibold text-gray-700 sticky left-0 bg-gray-50 z-10">Total</td>
              {monthTotals.map((total, i) => {
                const intensity = total > 0 ? Math.max((total / maxMonthTotal) * 0.7, 0.1) : 0;
                return (
                  <td key={months[i]} className="px-2 py-2.5 text-center">
                    {total > 0 ? (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded font-semibold text-blue-900"
                        style={{ backgroundColor: `rgba(59, 130, 246, ${intensity})` }}
                      >
                        ${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                );
              })}
              <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                ${grandTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

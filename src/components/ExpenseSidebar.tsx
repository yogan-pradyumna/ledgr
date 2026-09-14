import { CURRENCY } from '../utils/currency';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const NEAR_BUDGET_THRESHOLD = 80;

interface BudgetAlert {
  category: string;
  budget: number;
  spent: number;
  pct: number;
}

interface Props {
  categoryTotals: [string, number][];
  maxCategory: number;
  hasActiveFilter: boolean;
  currentMonthName: string;
  budgets: Record<string, number>;
  budgetAlerts: BudgetAlert[];
  monthlyTotals: number[];
  maxMonthly: number;
  displayYear: string;
  yearlyTotals: [string, number][];
  maxYearly: number;
}

export default function ExpenseSidebar({
  categoryTotals,
  maxCategory,
  hasActiveFilter,
  currentMonthName,
  budgets,
  budgetAlerts,
  monthlyTotals,
  maxMonthly,
  displayYear,
  yearlyTotals,
  maxYearly,
}: Props) {
  return (
    <div className="w-48 shrink-0 space-y-4 sticky top-4 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-hover">
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

      {/* Budget watch */}
      {Object.keys(budgets).length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-0.5">Budget Watch</p>
          <p className="text-xs text-gray-400 mb-3">{currentMonthName}</p>
          {budgetAlerts.length === 0 ? (
            <p className="text-xs text-gray-400">No budgets set</p>
          ) : (
            <div className="space-y-2">
              {budgetAlerts.map(({ category, budget, spent, pct }) => {
                const over = spent > budget;
                const near = !over && pct >= NEAR_BUDGET_THRESHOLD;
                const dotColor = over ? 'bg-red-500' : near ? 'bg-amber-400' : 'bg-emerald-500';
                const textColor = over ? 'text-red-600' : near ? 'text-amber-600' : 'text-gray-700';
                return (
                  <div key={category} className="flex items-center gap-2">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
                    <span className="text-xs text-gray-600 flex-1 min-w-0 truncate" title={category}>{category}</span>
                    <span className={`text-xs font-medium shrink-0 ${textColor}`}>
                      {CURRENCY}{spent.toFixed(0)}/{CURRENCY}{budget.toFixed(0)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

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
  );
}

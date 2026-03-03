import { useCallback, useEffect, useState } from 'react';
import GoogleAuthButton from './components/GoogleAuthButton';
import ExpenseForm from './components/ExpenseForm';
import StatementUpload from './components/StatementUpload';
import ExpenseList from './components/ExpenseList';
import PlaidConnectTab from './components/PlaidConnectTab';
import PasteImportTab from './components/PasteImportTab';
import BudgetTab from './components/BudgetTab';
import TrendsTab from './components/TrendsTab';
import type { Expense } from './types';
import {
  initSheet,
  fetchExpenses,
  appendExpenses,
  updateExpense,
  deleteExpense,
  fetchMerchantRules,
  saveMerchantRule,
  fetchBudgets,
  saveBudgets,
} from './services/googleSheets';
import { normalizeMerchant } from './utils/merchantMemory';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string;
const SPREADSHEET_ID = import.meta.env.VITE_SPREADSHEET_ID as string;

type Tab = 'list' | 'trends' | 'add' | 'upload' | 'paste' | 'budget' | 'bank';

export default function App() {
  const [token, setToken] = useState('');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loadingExpenses, setLoadingExpenses] = useState(false);
  const [tab, setTab] = useState<Tab>('list');
  const [sheetReady, setSheetReady] = useState(false);
  const [initError, setInitError] = useState('');
  const [merchantRules, setMerchantRules] = useState<Record<string, string>>({});
  const [budgets, setBudgets] = useState<Record<string, number>>({});

  const isSignedIn = Boolean(token);

  // Initialize sheet and load all data after sign-in
  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoadingExpenses(true);
      setInitError('');
      try {
        await initSheet(token, SPREADSHEET_ID);
        setSheetReady(true);
        const [rows, rules, fetchedBudgets] = await Promise.all([
          fetchExpenses(token, SPREADSHEET_ID),
          fetchMerchantRules(token, SPREADSHEET_ID),
          fetchBudgets(token, SPREADSHEET_ID),
        ]);
        setExpenses(rows);
        setMerchantRules(rules);
        setBudgets(fetchedBudgets);
      } catch (err) {
        setInitError(err instanceof Error ? err.message : 'Failed to connect to Google Sheets.');
      } finally {
        setLoadingExpenses(false);
      }
    })();
  }, [token]);

  const handleToken = useCallback((t: string) => {
    setToken(t);
  }, []);

  const handleSignOut = () => {
    setToken('');
    setExpenses([]);
    setMerchantRules({});
    setBudgets({});
    setSheetReady(false);
  };

  const handleAddExpense = async (expense: Expense) => {
    await appendExpenses(token, SPREADSHEET_ID, [expense]);
    setExpenses((prev) => [expense, ...prev]);
  };

  const handleImport = async (imported: Expense[]) => {
    await appendExpenses(token, SPREADSHEET_ID, imported);
    setExpenses((prev) => [...imported, ...prev]);
    setTab('list');
  };

  const handleUpdateExpense = async (expense: Expense) => {
    await updateExpense(token, SPREADSHEET_ID, expense);
    setExpenses((prev) => prev.map((e) => (e.id === expense.id ? expense : e)));
  };

  const handleDeleteExpense = async (id: string) => {
    await deleteExpense(token, SPREADSHEET_ID, id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const handleMerchantLearned = useCallback(async (description: string, category: string) => {
    const merchant = normalizeMerchant(description);
    setMerchantRules((prev) => ({ ...prev, [merchant]: category }));
    await saveMerchantRule(token, SPREADSHEET_ID, merchant, category);
  }, [token]);

  const handleSaveBudgets = async (updated: Record<string, number>) => {
    await saveBudgets(token, SPREADSHEET_ID, updated);
    setBudgets(updated);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold text-gray-900">Ledgr</span>
          {isSignedIn && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
              Connected to your Google Sheet
            </span>
          )}
        </div>
        {isSignedIn && (
          <GoogleAuthButton
            clientId={CLIENT_ID}
            onToken={handleToken}
            onSignOut={handleSignOut}
            isSignedIn={isSignedIn}
          />
        )}
      </header>

      <main className="max-w-screen-xl mx-auto px-4 py-6">
        {!isSignedIn ? (
          <div className="text-center py-20 space-y-4">
            <h1 className="text-2xl font-bold text-gray-800">Track your expenses</h1>
            <p className="text-gray-500 max-w-sm mx-auto text-sm">
              Sign in with Google to get started. Your expenses are stored in a Google Sheet in your own account.
            </p>
            <div className="flex justify-center mt-6">
              <GoogleAuthButton
                clientId={CLIENT_ID}
                onToken={handleToken}
                onSignOut={handleSignOut}
                isSignedIn={false}
              />
            </div>
          </div>
        ) : (
          <>
            {initError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {initError}
              </div>
            )}

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 bg-gray-200 rounded-lg p-1 mb-6 w-fit">
              {(([
                { id: 'list', label: 'Expenses Dashboard' },
                { id: 'add', label: 'Add Manually' },
                { id: 'paste', label: 'Paste Text' },
                { id: 'upload', label: 'Import Statement' },
                { id: 'bank', label: 'Bank Sync' },
                { id: 'trends', label: 'Trends' },
                { id: 'budget', label: 'Budgets' },
              ]) as { id: Tab; label: string }[]).map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    tab === id
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              {tab === 'list' && (
                <ExpenseList
                  expenses={expenses}
                  loading={loadingExpenses}
                  onUpdate={handleUpdateExpense}
                  onDelete={handleDeleteExpense}
                  onMerchantLearned={handleMerchantLearned}
                />
              )}
              {tab === 'trends' && (
                <TrendsTab expenses={expenses} />
              )}
              {tab === 'add' && sheetReady && (
                <ExpenseForm expenses={expenses} onSubmit={handleAddExpense} />
              )}
              {tab === 'upload' && sheetReady && (
                <StatementUpload
                  onImport={handleImport}
                  merchantRules={merchantRules}
                  onMerchantLearned={handleMerchantLearned}
                />
              )}
              {tab === 'paste' && sheetReady && (
                <PasteImportTab
                  expenses={expenses}
                  onImport={handleImport}
                  merchantRules={merchantRules}
                  onMerchantLearned={handleMerchantLearned}
                />
              )}
              {tab === 'budget' && sheetReady && (
                <BudgetTab
                  expenses={expenses}
                  budgets={budgets}
                  onSave={handleSaveBudgets}
                />
              )}
              {tab === 'bank' && sheetReady && (
                <PlaidConnectTab
                  expenses={expenses}
                  onImport={handleImport}
                  merchantRules={merchantRules}
                  onMerchantLearned={handleMerchantLearned}
                />
              )}
              {(tab === 'add' || tab === 'upload' || tab === 'paste' || tab === 'budget' || tab === 'bank' || tab === 'trends') && !sheetReady && !initError && (
                <p className="text-sm text-gray-400 text-center py-8">Connecting to Google Sheets…</p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

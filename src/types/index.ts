export interface Expense {
  id: string;
  date: string; // ISO date string YYYY-MM-DD
  description: string;
  amount: number; // positive = expense
  category: string;
  source: 'manual' | 'statement' | 'plaid';
  createdAt: string; // ISO datetime string
}

export interface PlaidTransactionRow {
  plaidTransactionId: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  selected: boolean;
  isDuplicate: boolean;
  isPayment: boolean;
  institutionName: string;
}

export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  selected: boolean;
  category: string;
  isPayment?: boolean;
}

export const CATEGORIES = [
  'Insurance',
  'Commute/Car',
  'Mobile',
  'Self-development/Learning',
  'Groceries',
  'Food',
  'Gifts',
  'Travel',
  'Household',
  'Health',
  'Internet',
  'Rent',
  'OTT/Streaming Fees',
  'Entertainment',
  'Apparel',
  'Utilities',
  'Sports',
  'Art Supplies',
  'Furniture',
  'Other',
] as const;

export type Category = (typeof CATEGORIES)[number];

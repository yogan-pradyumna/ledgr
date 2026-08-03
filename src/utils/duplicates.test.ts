import { describe, it, expect } from 'vitest';
import {
  findDuplicate,
  findDuplicateIndices,
  findPossibleImportDuplicate,
} from './duplicates';
import type { Expense } from '../types';

const makeExpense = (overrides: Partial<Expense> = {}): Expense => ({
  id: 'e1',
  date: '2024-03-15',
  description: 'Whole Foods',
  amount: 87.43,
  category: 'Groceries',
  source: 'plaid',
  createdAt: '2024-03-15T10:00:00Z',
  ...overrides,
});

describe('findDuplicate', () => {
  it('returns undefined when list is empty', () => {
    expect(findDuplicate([], { date: '2024-03-15', description: 'Whole Foods', amount: 87.43 })).toBeUndefined();
  });

  it('finds an exact match', () => {
    const existing = makeExpense();
    const result = findDuplicate([existing], { date: '2024-03-15', description: 'Whole Foods', amount: 87.43 });
    expect(result).toBe(existing);
  });

  it('matches description case-insensitively', () => {
    const existing = makeExpense({ description: 'WHOLE FOODS' });
    const result = findDuplicate([existing], { date: '2024-03-15', description: 'whole foods', amount: 87.43 });
    expect(result).toBe(existing);
  });

  it('matches description after trimming whitespace', () => {
    const existing = makeExpense({ description: 'Whole Foods' });
    const result = findDuplicate([existing], { date: '2024-03-15', description: '  Whole Foods  ', amount: 87.43 });
    expect(result).toBe(existing);
  });

  it('returns undefined when date differs', () => {
    const existing = makeExpense({ date: '2024-03-14' });
    expect(findDuplicate([existing], { date: '2024-03-15', description: 'Whole Foods', amount: 87.43 })).toBeUndefined();
  });

  it('returns undefined when description differs', () => {
    const existing = makeExpense({ description: 'Trader Joes' });
    expect(findDuplicate([existing], { date: '2024-03-15', description: 'Whole Foods', amount: 87.43 })).toBeUndefined();
  });

  it('returns undefined when amount differs', () => {
    const existing = makeExpense({ amount: 50.00 });
    expect(findDuplicate([existing], { date: '2024-03-15', description: 'Whole Foods', amount: 87.43 })).toBeUndefined();
  });

  it('matches amounts differing only by floating point rounding', () => {
    const existing = makeExpense({ amount: 14.99 });
    // 14.9 + 0.09 = 14.99 in theory but can be 14.989999999999999 in practice
    const candidate = { date: '2024-03-15', description: 'Whole Foods', amount: 14.9 + 0.09 };
    expect(findDuplicate([existing], candidate)).toBe(existing);
  });

  it('returns the first match when multiple exist', () => {
    const first = makeExpense({ id: 'e1' });
    const second = makeExpense({ id: 'e2' });
    const result = findDuplicate([first, second], { date: '2024-03-15', description: 'Whole Foods', amount: 87.43 });
    expect(result).toBe(first);
  });
});

describe('findDuplicateIndices', () => {
  it('returns empty set for no candidates', () => {
    const expenses = [makeExpense()];
    const result = findDuplicateIndices(expenses, []);
    expect(result.size).toBe(0);
  });

  it('returns empty set when no candidates match', () => {
    const expenses = [makeExpense({ description: 'Costco' })];
    const candidates = [{ date: '2024-03-15', description: 'Whole Foods', amount: 87.43 }];
    expect(findDuplicateIndices(expenses, candidates).size).toBe(0);
  });

  it('returns correct indices for duplicates', () => {
    const expenses = [makeExpense()];
    const candidates = [
      { date: '2024-01-01', description: 'New expense', amount: 10 },   // index 0 — not duplicate
      { date: '2024-03-15', description: 'Whole Foods', amount: 87.43 }, // index 1 — duplicate
      { date: '2024-04-01', description: 'Another new', amount: 25 },   // index 2 — not duplicate
    ];
    const result = findDuplicateIndices(expenses, candidates);
    expect(result.has(0)).toBe(false);
    expect(result.has(1)).toBe(true);
    expect(result.has(2)).toBe(false);
  });

  it('identifies all duplicates when multiple candidates match', () => {
    const expenses = [makeExpense(), makeExpense({ id: 'e2', description: 'Costco', amount: 55 })];
    const candidates = [
      { date: '2024-03-15', description: 'Whole Foods', amount: 87.43 },
      { date: '2024-03-15', description: 'Costco', amount: 55 },
    ];
    const result = findDuplicateIndices(expenses, candidates);
    expect(result).toEqual(new Set([0, 1]));
  });

  it('flags the same description and amount when the posting date shifts', () => {
    const expenses = [makeExpense({ date: '2024-03-15' })];
    const candidates = [
      { date: '2024-03-18', description: 'Whole Foods', amount: 87.43 },
    ];

    expect(findDuplicateIndices(expenses, candidates)).toEqual(new Set([0]));
  });

  it('does not flag matching transactions outside the import date window', () => {
    const expenses = [makeExpense({ date: '2024-03-15' })];
    const candidates = [
      { date: '2024-03-20', description: 'Whole Foods', amount: 87.43 },
    ];

    expect(findDuplicateIndices(expenses, candidates).size).toBe(0);
  });

  it('flags duplicate rows within the same import', () => {
    const candidates = [
      { date: '2024-03-15', description: 'Whole Foods', amount: 87.43 },
      { date: '2024-03-17', description: 'whole foods', amount: 87.43 },
    ];

    expect(findDuplicateIndices([], candidates)).toEqual(new Set([1]));
  });
});

describe('findPossibleImportDuplicate', () => {
  it('supports a custom date window', () => {
    const existing = makeExpense({ date: '2024-03-15' });
    const candidate = { date: '2024-03-17', description: 'Whole Foods', amount: 87.43 };

    expect(findPossibleImportDuplicate([existing], candidate, 1)).toBeUndefined();
    expect(findPossibleImportDuplicate([existing], candidate, 2)).toBe(existing);
  });

  it('does not treat malformed dates as nearby', () => {
    const existing = makeExpense({ date: 'not-a-date' });
    const candidate = { date: 'also-not-a-date', description: 'Whole Foods', amount: 87.43 };

    expect(findPossibleImportDuplicate([existing], candidate)).toBeUndefined();
  });
});

import type { Expense } from '../types';

export interface DuplicateCandidate {
  date: string;
  description: string;
  amount: number;
}

export const IMPORT_DUPLICATE_DATE_WINDOW_DAYS = 4;

function normalizeDescription(description: string): string {
  return description.toLowerCase().trim();
}

function amountsMatch(a: number, b: number): boolean {
  return Math.round(a * 100) === Math.round(b * 100);
}

function parseIsoDate(date: string): number | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return undefined;

  const [, year, month, day] = match;
  const timestamp = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    return undefined;
  }
  return timestamp;
}

function dateDifferenceDays(a: string, b: string): number | undefined {
  const aTimestamp = parseIsoDate(a);
  const bTimestamp = parseIsoDate(b);
  if (aTimestamp === undefined || bTimestamp === undefined) return undefined;
  return Math.abs(aTimestamp - bTimestamp) / 86_400_000;
}

/** Find an existing expense matching on date + description (case-insensitive) + amount. */
export function findDuplicate(
  expenses: Expense[],
  candidate: DuplicateCandidate
): Expense | undefined {
  const descNorm = normalizeDescription(candidate.description);
  return expenses.find(
    (e) =>
      e.date === candidate.date &&
      normalizeDescription(e.description) === descNorm &&
      amountsMatch(e.amount, candidate.amount)
  );
}

/**
 * Find a likely import duplicate. Card transaction dates may move between the
 * authorization and posting dates, so imports use a small date window.
 */
export function findPossibleImportDuplicate(
  expenses: Expense[],
  candidate: DuplicateCandidate,
  maxDateDifferenceDays = IMPORT_DUPLICATE_DATE_WINDOW_DAYS
): Expense | undefined {
  const descNorm = normalizeDescription(candidate.description);
  return expenses.find((expense) => {
    if (
      normalizeDescription(expense.description) !== descNorm ||
      !amountsMatch(expense.amount, candidate.amount)
    ) {
      return false;
    }

    const difference = dateDifferenceDays(expense.date, candidate.date);
    return difference !== undefined
      ? difference <= maxDateDifferenceDays
      : expense.date === candidate.date;
  });
}

/** Return indices that are likely duplicates of existing or earlier imported rows. */
export function findDuplicateIndices(
  expenses: Expense[],
  candidates: DuplicateCandidate[],
  maxDateDifferenceDays = IMPORT_DUPLICATE_DATE_WINDOW_DAYS
): Set<number> {
  const dupeIndices = new Set<number>();
  const comparisonExpenses = [...expenses];

  candidates.forEach((candidate, idx) => {
    if (findPossibleImportDuplicate(comparisonExpenses, candidate, maxDateDifferenceDays)) {
      dupeIndices.add(idx);
      return;
    }

    comparisonExpenses.push({
      id: `import-candidate-${idx}`,
      date: candidate.date,
      description: candidate.description,
      amount: candidate.amount,
      category: '',
      source: 'statement',
      createdAt: '',
    });
  });
  return dupeIndices;
}

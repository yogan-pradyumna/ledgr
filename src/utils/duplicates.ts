import type { Expense } from '../types';

export interface DuplicateCandidate {
  date: string;
  description: string;
  amount: number;
}

/** Find an existing expense matching on date + description (case-insensitive) + amount. */
export function findDuplicate(
  expenses: Expense[],
  candidate: DuplicateCandidate
): Expense | undefined {
  const descNorm = candidate.description.toLowerCase().trim();
  return expenses.find(
    (e) =>
      e.date === candidate.date &&
      e.description.toLowerCase().trim() === descNorm &&
      e.amount === candidate.amount
  );
}

/** Return the set of indices in `candidates` that are duplicates of existing expenses. */
export function findDuplicateIndices(
  expenses: Expense[],
  candidates: DuplicateCandidate[]
): Set<number> {
  const dupeIndices = new Set<number>();
  candidates.forEach((candidate, idx) => {
    if (findDuplicate(expenses, candidate)) {
      dupeIndices.add(idx);
    }
  });
  return dupeIndices;
}

/**
 * Normalize a merchant description to a stable key for rule matching.
 * Takes the first 25 chars, lowercased and trimmed, to handle varying
 * transaction suffixes (e.g. "AMZN MKTP US*AB123CD" → "amzn mktp us*ab123cd").
 */
export function normalizeMerchant(description: string): string {
  return description.toLowerCase().trim().slice(0, 25).trimEnd();
}

/**
 * Apply merchant → category rules to a list of transactions.
 * Tries exact match first, then prefix match as fallback.
 * Returns a new array with overridden categories where rules exist.
 */
export function applyMerchantRules<T extends { description: string; category: string }>(
  transactions: T[],
  rules: Record<string, string>
): T[] {
  return transactions.map((t) => {
    const key = normalizeMerchant(t.description);
    const exactMatch = rules[key];
    if (exactMatch) return { ...t, category: exactMatch };

    const prefixMatch = Object.entries(rules).find(([k]) => key.startsWith(k))?.[1];
    if (prefixMatch) return { ...t, category: prefixMatch };

    return t;
  });
}

import { describe, it, expect } from 'vitest';
import { normalizeMerchant, applyMerchantRules } from './merchantMemory';

describe('normalizeMerchant', () => {
  it('lowercases the description', () => {
    expect(normalizeMerchant('WHOLE FOODS')).toBe('whole foods');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normalizeMerchant('  Uber  ')).toBe('uber');
  });

  it('slices to 25 characters', () => {
    expect(normalizeMerchant('AMZN MKTP US*AB123CD EXTRA')).toHaveLength(25);
    expect(normalizeMerchant('AMZN MKTP US*AB123CD EXTRA')).toBe('amzn mktp us*ab123cd extr');
  });

  it('trimEnd after slice removes trailing space from cut', () => {
    // 25 chars of 'amzn mktp us ' ends with space — should be trimmed
    const desc = 'AMZN MKTP US            '; // more than 25 chars
    const result = normalizeMerchant(desc);
    expect(result.endsWith(' ')).toBe(false);
  });

  it('returns shorter descriptions unchanged in length', () => {
    expect(normalizeMerchant('Uber')).toBe('uber');
  });

  it('two descriptions with same 25-char prefix map to same key', () => {
    // 'AMAZON PURCHASE ABC12345Z' is exactly 25 chars; the trailing suffix is cut
    const base = 'AMAZON PURCHASE ABC12345Z';
    expect(normalizeMerchant(base + ' VERSION1')).toBe(normalizeMerchant(base + ' VERSION2'));
  });
});

describe('applyMerchantRules', () => {
  const rules: Record<string, string> = {
    'whole foods':     'Groceries',
    'amzn mktp us*ab1': 'Household',
  };

  it('returns original transactions when rules are empty', () => {
    const txns = [{ description: 'Whole Foods', category: 'Other' }];
    expect(applyMerchantRules(txns, {})).toEqual(txns);
  });

  it('applies exact match rule', () => {
    const txns = [{ description: 'Whole Foods', category: 'Other' }];
    const result = applyMerchantRules(txns, rules);
    expect(result[0]?.category).toBe('Groceries');
  });

  it('applies exact match case-insensitively via normalization', () => {
    const txns = [{ description: 'WHOLE FOODS', category: 'Other' }];
    const result = applyMerchantRules(txns, rules);
    expect(result[0]?.category).toBe('Groceries');
  });

  it('applies prefix match as fallback', () => {
    const txns = [{ description: 'AMZN MKTP US*AB123CD', category: 'Other' }];
    const result = applyMerchantRules(txns, rules);
    expect(result[0]?.category).toBe('Household');
  });

  it('exact match takes priority over prefix match', () => {
    const txns = [{ description: 'Whole Foods', category: 'Other' }];
    const mixedRules = { 'whole foods': 'Groceries', 'whole': 'Food' };
    const result = applyMerchantRules(txns, mixedRules);
    expect(result[0]?.category).toBe('Groceries');
  });

  it('leaves category unchanged when no rule matches', () => {
    const txns = [{ description: 'Starbucks', category: 'Food' }];
    const result = applyMerchantRules(txns, rules);
    expect(result[0]?.category).toBe('Food');
  });

  it('does not mutate the original transaction objects', () => {
    const txns = [{ description: 'Whole Foods', category: 'Other' }];
    applyMerchantRules(txns, rules);
    expect(txns[0]?.category).toBe('Other');
  });

  it('handles multiple transactions independently', () => {
    const txns = [
      { description: 'Whole Foods', category: 'Other' },
      { description: 'Unknown Store', category: 'Other' },
    ];
    const result = applyMerchantRules(txns, rules);
    expect(result[0]?.category).toBe('Groceries');
    expect(result[1]?.category).toBe('Other');
  });
});

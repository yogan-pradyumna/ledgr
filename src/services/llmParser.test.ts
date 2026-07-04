import { describe, it, expect } from 'vitest';
import { parseResponseText } from './llmParser';

describe('parseResponseText', () => {
  const validTransaction = {
    date: '2024-03-15',
    description: 'Whole Foods',
    amount: 87.43,
    category: 'Groceries',
    isPayment: false,
  };

  it('parses a valid JSON array', () => {
    const raw = JSON.stringify([validTransaction]);
    const result = parseResponseText(raw);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      date: '2024-03-15',
      description: 'Whole Foods',
      amount: 87.43,
      category: 'Groceries',
      isPayment: false,
      selected: true,
    });
  });

  it('strips ```json ... ``` code fences', () => {
    const raw = '```json\n[' + JSON.stringify(validTransaction) + ']\n```';
    expect(parseResponseText(raw)).toHaveLength(1);
  });

  it('strips plain ``` code fences', () => {
    const raw = '```\n[' + JSON.stringify(validTransaction) + ']\n```';
    expect(parseResponseText(raw)).toHaveLength(1);
  });

  it('converts negative amounts to positive via Math.abs', () => {
    const raw = JSON.stringify([{ ...validTransaction, amount: -87.43 }]);
    expect(parseResponseText(raw)[0]?.amount).toBe(87.43);
  });

  it('marks payment transactions as not selected', () => {
    const raw = JSON.stringify([{ ...validTransaction, isPayment: true }]);
    const result = parseResponseText(raw);
    expect(result[0]?.isPayment).toBe(true);
    expect(result[0]?.selected).toBe(false);
  });

  it('marks non-payment transactions as selected', () => {
    const raw = JSON.stringify([{ ...validTransaction, isPayment: false }]);
    expect(parseResponseText(raw)[0]?.selected).toBe(true);
  });

  it('defaults isPayment to false when missing', () => {
    const { isPayment: _ip, ...withoutFlag } = validTransaction;
    const raw = JSON.stringify([withoutFlag]);
    const result = parseResponseText(raw);
    expect(result[0]?.isPayment).toBe(false);
    expect(result[0]?.selected).toBe(true);
  });

  it('replaces unknown category with Other', () => {
    const raw = JSON.stringify([{ ...validTransaction, category: 'FakeCategory' }]);
    expect(parseResponseText(raw)[0]?.category).toBe('Other');
  });

  it('preserves valid category as-is', () => {
    const raw = JSON.stringify([{ ...validTransaction, category: 'Commute/Car' }]);
    expect(parseResponseText(raw)[0]?.category).toBe('Commute/Car');
  });

  it('recovers from truncated JSON (missing closing bracket)', () => {
    const two = [validTransaction, { ...validTransaction, description: 'Uber', amount: 18.5 }];
    const full = JSON.stringify(two);
    // Simulate truncation — drop last 5 chars which removes the closing `]`
    const truncated = full.slice(0, -5);
    const result = parseResponseText(truncated);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.description).toBe('Whole Foods');
  });

  it('throws on completely unparseable output', () => {
    expect(() => parseResponseText('not json at all, no braces')).toThrow();
  });

  it('throws when truncated output has no complete objects', () => {
    expect(() => parseResponseText('[{"date":')).toThrow();
  });

  it('parses multiple transactions correctly', () => {
    const transactions = [
      validTransaction,
      { ...validTransaction, description: 'Uber', amount: 18.5, category: 'Commute/Car' },
      { ...validTransaction, description: 'Credit Card Payment', amount: 500, category: 'Other', isPayment: true },
    ];
    const result = parseResponseText(JSON.stringify(transactions));
    expect(result).toHaveLength(3);
    expect(result[1]?.category).toBe('Commute/Car');
    expect(result[2]?.selected).toBe(false);
  });
});

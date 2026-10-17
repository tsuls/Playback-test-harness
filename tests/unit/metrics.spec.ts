import { test, expect } from '@playwright/test';
import { percentile, summarize } from '../../src/metrics';
import { isTodo } from './todo';

// These are pure-function tests. They never ask for the `page` fixture, so
// Playwright does not open a browser for them.

test.describe('percentile (nearest-rank)', () => {
  test.skip(isTodo(() => percentile([1], 50)), 'src/metrics.ts percentile() not implemented yet');

  const tenValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

  test('single value is every percentile', () => {
    expect(percentile([42], 0)).toBe(42);
    expect(percentile([42], 50)).toBe(42);
    expect(percentile([42], 100)).toBe(42);
  });

  test('nearest rank on ten values', () => {
    // rank = ceil(p/100 * n), 1-based
    expect(percentile(tenValues, 50)).toBe(50); // rank 5
    expect(percentile(tenValues, 90)).toBe(90); // rank 9
    expect(percentile(tenValues, 95)).toBe(100); // rank ceil(9.5) = 10
    expect(percentile(tenValues, 100)).toBe(100);
  });

  test('p50 of an even count picks a real value, not an average', () => {
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
  });

  test('p = 0 returns the minimum', () => {
    expect(percentile([5, 3, 9], 0)).toBe(3);
  });

  test('works on unsorted input without modifying it', () => {
    const input = [90, 10, 50, 30, 70];
    expect(percentile(input, 50)).toBe(50);
    expect(input).toEqual([90, 10, 50, 30, 70]);
  });

  test('no floating-point off-by-one in the rank', () => {
    // (7 / 100) * 100 is 7.000000000000001 in floating point; ceil would make it rank 8.
    const oneToHundred = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(oneToHundred, 7)).toBe(7);
    expect(percentile(oneToHundred, 14)).toBe(14);
    expect(percentile(oneToHundred, 28)).toBe(28);
  });

  test('handles duplicates', () => {
    expect(percentile([7, 7, 7, 1], 50)).toBe(7);
  });

  test('rejects empty input and out-of-range p', () => {
    expect(() => percentile([], 50)).toThrow(RangeError);
    expect(() => percentile([1, 2], -1)).toThrow(RangeError);
    expect(() => percentile([1, 2], 101)).toThrow(RangeError);
  });
});

test.describe('summarize', () => {
  test.skip(isTodo(() => summarize([1])), 'src/metrics.ts summarize() not implemented yet');

  test('returns p50 and p95', () => {
    const values = Array.from({ length: 20 }, (_, i) => i + 1); // 1..20
    expect(summarize(values)).toEqual({ p50: 10, p95: 19 });
  });

  test('rejects empty input', () => {
    expect(() => summarize([])).toThrow(RangeError);
  });
});

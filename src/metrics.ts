// Tyler implements this file. The expected behaviour is pinned down by
// tests/unit/metrics.spec.ts, which is skipped until these stop throwing 'TODO'.

/**
 * The p-th percentile of `values` using the nearest-rank method: the smallest
 * value such that at least p% of the values are less than or equal to it.
 *
 * - `p` is between 0 and 100 inclusive. `p = 0` returns the minimum.
 * - `values` does not need to be sorted and must not be modified.
 * - Throws a RangeError if `values` is empty or `p` is out of range.
 */
export function percentile(values: readonly number[], p: number): number {
  throw new Error('TODO');
}

/** p50 and p95 of `values`. Same error rules as `percentile`. */
export function summarize(values: readonly number[]): { p50: number; p95: number } {
  throw new Error('TODO');
}

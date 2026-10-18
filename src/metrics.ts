/**
 * The p-th percentile of `values` using the nearest-rank method: the smallest
 * value such that at least p% of the values are less than or equal to it.
 *
 * - `p` is between 0 and 100 inclusive. `p = 0` returns the minimum.
 * - `values` does not need to be sorted and must not be modified.
 * - Throws a RangeError if `values` is empty or `p` is out of range.
 */
export function percentile(values: readonly number[], p: number): number {

  //throws a RangeError if values is empty or p is out of range.
  if(values.length == 0){
    throw new RangeError('Values is empty');
  }

  if(p < 0 || p > 100 || Number.isNaN(p)){
    throw new RangeError('p is out of range: p must be between 0 and 100 inclusive');
  }

  // use a shallow copy, as to not change the caller's value.
  // typescript infers the type
  const valuesCopy = [...values];

  // sort the copy using a numerical comparator
  valuesCopy.sort((a,b) => a - b);

  // the edge case of p = 0, return index 0, or the min value.
  // rank is 1-based, and index is 0-based. so p of 0 converted is index[-1]. clamp to index[0] 
  if (p == 0){
    return valuesCopy[0];
  }

  // find the rank. Multiply before dividing: (p / 100) * n can pick up
  // floating-point error (e.g. p=7, n=100 gives 7.000000000000001, which ceil rounds up to 8).
  const rank = Math.ceil((p * valuesCopy.length) / 100);

  // now convert the 1-based rank to 0-based index and return
  return valuesCopy[rank - 1];
}

/** p50 and p95 of `values`. Same error rules as `percentile`. */
// This PR will purposely fail test for CI failure example.
export function summarize(values: readonly number[]): { p50: number; p95: number } {
  return { p50: percentile(values, 9999), p95: percentile(values, 95) };
}

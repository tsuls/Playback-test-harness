import { percentile } from './metrics';

// Compares the two arms of an A/B experiment on one metric.
// tests/unit/experiment.spec.ts describes the expected behaviour.

/** What the comparison concludes about the treatment arm. */
export enum Verdict {
  /** The treatment's p50 is lower (the metric is lower-is-better, like TTFF). */
  Better = 'better',
  Worse = 'worse',
  /** Too few runs, or a change too small to tell apart from noise. */
  Inconclusive = 'inconclusive',
  /** The metric improved, but at the cost of a guardrail (see decide()). */
  TradeOff = 'trade-off',
}

/** When a difference is big enough, and backed by enough runs, to call. */
export interface ComparisonRules {
  /** Each arm needs at least this many runs, or the verdict is Inconclusive. */
  minRuns: number;
  /** A change smaller than this many percent (of the control's p50) is Inconclusive. */
  minEffectPct: number;
}

export const DEFAULT_RULES: ComparisonRules = { minRuns: 5, minEffectPct: 10 };

export interface ArmComparison {
  controlP50: number;
  treatmentP50: number;
  /** treatmentP50 - controlP50. Negative means the treatment is lower. */
  delta: number;
  /** delta as a percentage of controlP50, e.g. -12.5. NaN when controlP50 is 0. */
  deltaPct: number;
  verdict: Verdict;
}

/**
 * Compares a lower-is-better metric (e.g. TTFF in ms) between the control and
 * treatment arms of an experiment.
 *
 * - p50s use the nearest-rank `percentile` from src/metrics.ts.
 * - `delta` = treatmentP50 - controlP50; `deltaPct` = delta / controlP50 * 100.
 * - Verdict is Inconclusive if either arm has fewer than `rules.minRuns` values,
 *   or if |deltaPct| is less than `rules.minEffectPct`. A change of exactly
 *   `minEffectPct` counts. Otherwise Better when delta < 0, Worse when delta > 0.
 * - If controlP50 is 0 there is no baseline to take a percentage of: deltaPct is
 *   NaN and the verdict is Inconclusive.
 * - Neither input array is modified.
 * - Throws a RangeError if either arm is empty.
 */
export function compareArms(
  control: readonly number[],
  treatment: readonly number[],
  rules: ComparisonRules = DEFAULT_RULES,
): ArmComparison {

  // compute the median metric from each arm, even when there are too few runs
  // to call a winner: the numbers are still real. percentile() rejects an
  // empty arm with a RangeError and does not modify its input.
  const controlP50 = percentile(control, 50);
  const treatmentP50 = percentile(treatment, 50);

  // compute deltas. A percentage of 0 is undefined (x / 0 is Infinity or NaN),
  // so with a 0 ms control there is no baseline and no winner can be called.
  const delta = treatmentP50 - controlP50;
  const hasBaseline = controlP50 > 0;
  const deltaPct = hasBaseline ? delta / controlP50 * 100 : NaN;

  // only call a winner with enough runs in both arms and a big enough change
  const enoughRuns = control.length >= rules.minRuns && treatment.length >= rules.minRuns;
  const bigEnough = Math.abs(deltaPct) >= rules.minEffectPct;

  let verdict = Verdict.Inconclusive;
  if(hasBaseline && enoughRuns && bigEnough){
    // lower is better, so a negative delta means the treatment improved
    verdict = delta < 0 ? Verdict.Better : Verdict.Worse;
  }

  return { controlP50, treatmentP50, delta, deltaPct, verdict };
}

/**
 * A check the treatment must not make worse, whatever happens to the main
 * metric. For example: playback must not start at a lower quality.
 */
export interface Guardrail {
  name: string;
  passed: boolean;
  /** Human-readable evidence, e.g. "576p → 144p". */
  detail: string;
}

/**
 * The experiment's overall decision, from compareArms()'s verdict on the main
 * metric plus the guardrails.
 *
 * - Better, and every guardrail passed: Better.
 * - Better, but at least one guardrail failed: TradeOff (it won by giving
 *   something else up).
 * - Anything else: the verdict unchanged (Worse stays Worse, Inconclusive stays
 *   Inconclusive), whatever the guardrails say.
 * - No guardrails counts as "every guardrail passed".
 * - The guardrails array is not modified.
 */
export function decide(verdict: Verdict, guardrails: readonly Guardrail[]): Verdict {
  // Guardrails only matter when the main metric improved: a loss or a
  // non-result stays what it is.
  if(verdict !== Verdict.Better){
    return verdict;
  }

  // every() is true for an empty list, so no guardrails counts as all passed.
  const allPassed = guardrails.every((g) => g.passed);
  return allPassed ? Verdict.Better : Verdict.TradeOff;
}

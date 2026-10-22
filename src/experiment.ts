import { percentile } from './metrics'; 

// Compares the two arms of an A/B experiment on one metric.
// Tyler implements compareArms(); tests/unit/experiment.spec.ts describes the
// expected behaviour, and is skipped until the stub is replaced.

/** What the comparison concludes about the treatment arm. */
export enum Verdict {
  /** The treatment's p50 is lower (the metric is lower-is-better, like TTFF). */
  Better = 'better',
  Worse = 'worse',
  /** Too few runs, or a change too small to tell apart from noise. */
  Inconclusive = 'inconclusive',
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
  /** delta as a percentage of controlP50, e.g. -12.5. */
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
 * - Neither input array is modified.
 * - Throws a RangeError if either arm is empty.
 */
export function compareArms(
  control: readonly number[],
  treatment: readonly number[],
  rules: ComparisonRules = DEFAULT_RULES,
): ArmComparison {

  let result = {
    controlP50: 0,
    treatmentP50: 0,
    delta: 0,
    deltaPct: 0,
    verdict: Verdict.Inconclusive
  };

  // is there enough runs?
  if(control.length >= rules.minRuns && treatment.length >= rules.minRuns){

    // auto rejects empty arm & does not modify inputs
    // compute meadian metric from each arm
    result.controlP50 = percentile(control, 50);
    result.treatmentP50 = percentile(treatment, 50);
    
    // compute deltas
    result.delta = result.treatmentP50 - result.controlP50;
    result.deltaPct = result.delta / (result.controlP50 * 100);

    // is the change big enough?
    if(Math.abs(result.deltaPct) >= rules.minEffectPct){
      if(result.delta < 0){
        result.verdict = Verdict.Better;
      }
      else{
        result.verdict = Verdict.Worse;
      }
    }
  }

  return result;
}

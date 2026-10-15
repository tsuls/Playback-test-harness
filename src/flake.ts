// Tyler implements this file. The expected behaviour is pinned down by
// tests/unit/flake.spec.ts, which is skipped until these stop throwing 'TODO'.

import type { AttemptStatus, FlakeSummary, RunOutcome, TestRun } from './types';

/**
 * How one run ended, given its attempts in order:
 * - 'pass'    the first attempt passed
 * - 'flaky'   an earlier attempt did not pass, but a later one did
 * - 'fail'    no attempt passed
 * - 'skipped' every attempt was skipped
 */
export function classifyRun(attempts: readonly AttemptStatus[]): RunOutcome {
  throw new Error('TODO');
}

/**
 * Groups runs by `title` and counts outcomes. Skipped runs are left out of
 * every count, including `runs`. Output is sorted by title.
 */
export function summarizeFlakes(runs: readonly TestRun[]): FlakeSummary[] {
  throw new Error('TODO');
}

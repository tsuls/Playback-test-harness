/** Where an event came from: the <video> element, Shaka Player, or the page script itself. */
export type EventSource = 'video' | 'shaka' | 'page';

/**
 * One entry of `window.__events` on the test page (site/index.html).
 *
 * `t` is `performance.now()` in milliseconds, so it is only meaningful relative
 * to other events from the same page load.
 */
export interface PlaybackEvent {
  type:
    | 'load-start' // the page is about to call player.load()
    | 'first-frame' // first frame presented (requestVideoFrameCallback)
    | 'loadstart'
    | 'playing'
    | 'waiting'
    | 'buffering'
    | 'adaptation'
    | 'error';
  source: EventSource;
  t: number;
  detail?: Record<string, unknown>;
}

/** Metrics computed for a single playback run. Phase 1 fills in TTFF only. */
export interface RunMetrics {
  /** Time to first frame in ms: from `load-start` to `first-frame`. */
  ttffMs: number;
  rebufferCount?: number;
  rebufferMs?: number;
  errorCodes?: number[];
}

/**
 * Status of one attempt of a test, as Playwright reports it
 * (same values as Playwright's `TestResult.status`).
 */
export enum AttemptStatus {
  Passed = 'passed',
  Failed = 'failed',
  TimedOut = 'timedOut',
  Skipped = 'skipped',
  Interrupted = 'interrupted'
}

/**
 * One run of one test. With `--repeat-each=3 --retries=1`, every test produces
 * three TestRuns, and each TestRun has one attempt, or two if it was retried.
 */
export interface TestRun {
  /** Stable test name, e.g. "playback.spec.ts > clear stream plays". */
  title: string;
  /** Attempts in order: the first try, then any retries. */
  attempts: AttemptStatus[];
}

/** How a single TestRun ended, after retries. */
export enum RunOutcome {
  Pass = 'pass',
  Fail = 'fail',
  Flaky = 'flaky',
  Skipped = 'skipped'
}


/** Per-test summary printed by the flake report. */
export interface FlakeSummary {
  title: string;
  /** TestRuns that actually ran (skipped runs are not counted). */
  runs: number;
  passes: number;
  failures: number;
  flaky: number;
  /** flaky / runs, between 0 and 1. 0 when runs is 0. */
  flakeRate: number;
}

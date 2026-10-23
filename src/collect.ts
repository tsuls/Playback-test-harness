// Helpers that run on the Node side of a Playwright test: build the page URL,
// wait for playback, pull data out of the browser and turn it into metrics.

import { test, type Page } from '@playwright/test';
import type { PlaybackEvent, RunMetrics, ShakaCrossCheck } from './types';
import type { Stream } from './streams';
import { METRICS_ATTACHMENT } from './report';

/** One entry of Shaka's `stateHistory`. Times are in seconds. */
interface ShakaStateChange {
  state: string; // 'buffering' | 'playing' | 'paused' | 'ended' | ...
  timestamp: number;
  duration: number;
}

/** The subset of Shaka's `player.getStats()` we read. Times are in seconds. */
export interface ShakaStats {
  timeToFirstFrame: number;
  loadLatency: number;
  bufferingTime: number;
  stallsDetected: number;
  stateHistory: ShakaStateChange[];
  currentCodecs: string;
  width: number;
  height: number;
}

// Tell TypeScript about the globals the test page creates, so code inside
// page.evaluate() / page.waitForFunction() type-checks.
declare global {
  interface Window {
    __events: PlaybackEvent[];
    __player: { getStats(): ShakaStats; keySystem(): string };
  }
}

export interface PageOptions {
  /** false pins the highest variant (see site/index.html). */
  abr?: boolean;
  /** Overrides the stream's ClearKey key, e.g. to test a wrong key. */
  clearKey?: string;
  /** Start position in seconds. */
  start?: number;
  /** Extra Shaka settings, passed to player.configure() (see site/index.html). */
  config?: Record<string, unknown>;
}

/** Path of the test page for a stream, relative to the config's baseURL. */
export function pageUrl(stream: Stream, opts: PageOptions = {}): string {
  const params = new URLSearchParams({ src: stream.manifest });
  if (opts.abr === false) params.set('abr', 'off');
  const clearKey = opts.clearKey ?? stream.clearKey;
  if (clearKey) params.set('clearkey', clearKey);
  if (stream.widevineLicense) params.set('license', stream.widevineLicense);
  if (opts.start !== undefined) params.set('start', String(opts.start));
  if (opts.config) params.set('config', JSON.stringify(opts.config));
  return `/?${params}`;
}

/**
 * Waits until the first frame is on screen, or fails fast if an error event
 * arrives first, so a broken stream does not just look like a timeout.
 */
export async function waitForFirstFrame(page: Page, timeoutMs = 30_000): Promise<void> {
  await page.waitForFunction(
    () => window.__events.some((e) => e.type === 'first-frame' || e.type === 'error'),
    undefined,
    { timeout: timeoutMs },
  );
  const errors = errorEvents(await readEvents(page));
  if (errors.length > 0) {
    throw new Error(`playback error before first frame: ${JSON.stringify(errors)}`);
  }
}

/** Waits until the video's playhead has reached `seconds`. */
export async function waitForPlayhead(page: Page, seconds: number, timeoutMs = 30_000): Promise<void> {
  await page.waitForFunction(
    (s) => document.querySelector('video')!.currentTime >= s,
    seconds,
    { timeout: timeoutMs },
  );
}

/** Current playhead position in seconds. */
export function currentTime(page: Page): Promise<number> {
  return page.evaluate(() => document.querySelector('video')!.currentTime);
}

/** Waits until a rebuffer has started: a `waiting` event after the first `playing`. */
export async function waitForRebufferStart(page: Page, timeoutMs: number): Promise<void> {
  await page.waitForFunction(
    () => {
      const firstPlaying = window.__events.findIndex((e) => e.type === 'playing');
      return firstPlaying >= 0 && window.__events.slice(firstPlaying).some((e) => e.type === 'waiting');
    },
    undefined,
    { timeout: timeoutMs },
  );
}

/** Waits until playback has resumed: the last `waiting` is followed by a `playing`. */
export async function waitForRecovery(page: Page, timeoutMs: number): Promise<void> {
  await page.waitForFunction(
    () => {
      const types = window.__events.map((e) => e.type);
      return types.lastIndexOf('playing') > types.lastIndexOf('waiting');
    },
    undefined,
    { timeout: timeoutMs },
  );
}

/** Copies `window.__events` out of the browser. */
export function readEvents(page: Page): Promise<PlaybackEvent[]> {
  return page.evaluate(() => window.__events);
}

export function readShakaStats(page: Page): Promise<ShakaStats> {
  return page.evaluate(() => window.__player.getStats());
}

export function errorEvents(events: readonly PlaybackEvent[]): PlaybackEvent[] {
  return events.filter((e) => e.type === 'error');
}

/** Time to first frame in ms: from the `load-start` mark to the first presented frame. */
export function timeToFirstFrame(events: readonly PlaybackEvent[]): number {
  const start = events.find((e) => e.type === 'load-start');
  const frame = events.find((e) => e.type === 'first-frame');
  if (!start || !frame) {
    throw new Error(`cannot compute TTFF: load-start=${!!start} first-frame=${!!frame}`);
  }
  return frame.t - start.t;
}

/**
 * Rebuffers from the video element's events: each `waiting` after the first
 * `playing` opens a rebuffer, and the next `playing` closes it. Startup
 * buffering (before the first `playing`) is not a rebuffer. A rebuffer still
 * open at the end is counted up to `endT`.
 */
export function computeRebuffers(
  events: readonly PlaybackEvent[],
  endT: number,
): { count: number; totalMs: number } {
  // first-frame uses the frame's presentation time, so the array is not
  // guaranteed to be in time order. Sort a copy.
  const ordered = [...events].sort((a, b) => a.t - b.t);
  let started = false;
  let stallStart: number | undefined;
  let count = 0;
  let totalMs = 0;

  for (const e of ordered) {
    if (e.type === 'playing') {
      if (stallStart !== undefined) {
        totalMs += e.t - stallStart;
        stallStart = undefined;
      }
      started = true;
    } else if (e.type === 'waiting' && started && stallStart === undefined) {
      stallStart = e.t;
      count++;
    }
  }
  if (stallStart !== undefined) totalMs += endT - stallStart;
  return { count, totalMs };
}

/** Height of the first presented frame, if the page recorded it. */
export function startHeight(events: readonly PlaybackEvent[]): number | undefined {
  const height = events.find((e) => e.type === 'first-frame')?.detail?.height;
  return typeof height === 'number' ? height : undefined;
}

/** Errors as "source:code", e.g. "shaka:3014". */
export function errorCodes(events: readonly PlaybackEvent[]): string[] {
  return errorEvents(events).map((e) => `${e.source}:${String(e.detail?.code ?? 'unknown')}`);
}

/** Shaka's numbers for the same run, rebuilt to match our definitions where possible. */
export function shakaCrossCheck(stats: ShakaStats): ShakaCrossCheck {
  const firstPlaying = stats.stateHistory.findIndex((s) => s.state === 'playing');
  const rebuffers = firstPlaying < 0
    ? []
    : stats.stateHistory.slice(firstPlaying).filter((s) => s.state === 'buffering');
  return {
    ttffMs: stats.timeToFirstFrame * 1000,
    rebufferCount: rebuffers.length,
    rebufferMs: rebuffers.reduce((sum, s) => sum + s.duration, 0) * 1000,
    bufferingMs: stats.bufferingTime * 1000,
    stallsDetected: stats.stallsDetected,
  };
}

export function computeRunMetrics(
  events: readonly PlaybackEvent[],
  stats: ShakaStats,
  endT: number,
): RunMetrics {
  const rebuffers = computeRebuffers(events, endT);
  return {
    ttffMs: timeToFirstFrame(events),
    rebufferCount: rebuffers.count,
    rebufferMs: rebuffers.totalMs,
    errors: errorCodes(events),
    startHeight: startHeight(events),
    shaka: shakaCrossCheck(stats),
  };
}

/**
 * Reads everything from the page, computes this run's metrics and attaches
 * them to the current test:
 * - annotations: short key/value lines shown in the HTML report
 * - a `metrics` JSON attachment that the report scripts read back from the
 *   JSON reporter output
 * - the raw event log, for debugging
 */
export async function recordRun(page: Page): Promise<{ metrics: RunMetrics; events: PlaybackEvent[] }> {
  const events = await readEvents(page);
  const stats = await readShakaStats(page);
  const endT = await page.evaluate(() => performance.now());
  const metrics = computeRunMetrics(events, stats, endT);

  const info = test.info();
  const ms = (n: number) => n.toFixed(0);
  info.annotations.push(
    { type: 'ttff_ms', description: `${ms(metrics.ttffMs)} (shaka ${ms(metrics.shaka.ttffMs)})` },
    {
      type: 'rebuffers',
      description:
        `${metrics.rebufferCount} / ${ms(metrics.rebufferMs)} ms ` +
        `(shaka ${metrics.shaka.rebufferCount} / ${ms(metrics.shaka.rebufferMs)} ms, ` +
        `bufferingTime ${ms(metrics.shaka.bufferingMs)} ms, stallsDetected ${metrics.shaka.stallsDetected})`,
    },
    { type: 'errors', description: metrics.errors.join(', ') || 'none' },
    { type: 'start_height', description: `${metrics.startHeight ?? 'unknown'}p` },
    { type: 'codecs', description: `${stats.currentCodecs} @ ${stats.width}x${stats.height}` },
  );
  await info.attach(METRICS_ATTACHMENT, { body: JSON.stringify(metrics), contentType: 'application/json' });
  await info.attach('events.json', { body: JSON.stringify(events, null, 2), contentType: 'application/json' });
  return { metrics, events };
}

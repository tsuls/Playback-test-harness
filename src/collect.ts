// Helpers that run on the Node side of a Playwright test: build the page URL,
// wait for playback, pull data out of the browser and turn it into metrics.

import type { Page } from '@playwright/test';
import type { PlaybackEvent } from './types';
import type { Stream } from './streams';

/** The subset of Shaka's `player.getStats()` we read. Times are in seconds. */
export interface ShakaStats {
  timeToFirstFrame: number;
  loadLatency: number;
  bufferingTime: number;
  stallsDetected: number;
  currentCodecs: string;
  width: number;
  height: number;
}

// Tell TypeScript about the globals the test page creates, so code inside
// page.evaluate() / page.waitForFunction() type-checks.
declare global {
  interface Window {
    __events: PlaybackEvent[];
    __player: { getStats(): ShakaStats };
  }
}

/** Path of the test page for a stream, relative to the config's baseURL. */
export function pageUrl(stream: Stream, opts: { abr?: boolean } = {}): string {
  const params = new URLSearchParams({ src: stream.manifest });
  if (opts.abr === false) params.set('abr', 'off');
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

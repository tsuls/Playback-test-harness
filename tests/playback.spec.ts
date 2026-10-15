import { test, expect } from '@playwright/test';
import { STREAMS } from '../src/streams';
import {
  errorEvents,
  pageUrl,
  readEvents,
  readShakaStats,
  timeToFirstFrame,
  waitForFirstFrame,
  waitForPlayhead,
} from '../src/collect';

/** How much content must play before we call a run successful. */
const PLAY_SECONDS = 5;

// `page` is a Playwright *fixture*: the runner creates a fresh browser page for
// each test, hands it in as an argument, and closes it after the test.

test('browser reports H.264/AAC support', async ({ page }) => {
  await page.goto('/');
  const support = await page.evaluate(() => ({
    h264: MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"'),
    aac: MediaSource.isTypeSupported('audio/mp4; codecs="mp4a.40.2"'),
    vp9: MediaSource.isTypeSupported('video/webm; codecs="vp09.00.10.08"'),
    opus: MediaSource.isTypeSupported('audio/webm; codecs="opus"'),
  }));
  // Annotations show up in the HTML report and the JSON reporter output.
  test.info().annotations.push({ type: 'codec support', description: JSON.stringify(support) });

  expect(support.h264).toBe(true);
  expect(support.aac).toBe(true);
});

test('clear stream starts and plays', async ({ page }) => {
  const stream = STREAMS.angelOneClear;
  await page.goto(pageUrl(stream));

  await waitForFirstFrame(page);
  await waitForPlayhead(page, PLAY_SECONDS);

  const events = await readEvents(page);
  const stats = await readShakaStats(page);
  const ttffMs = timeToFirstFrame(events);

  const info = test.info();
  info.annotations.push(
    { type: 'ttff_ms', description: ttffMs.toFixed(0) },
    // Shaka's own measurement, for comparison. It starts its clock at a slightly
    // different point inside load(), so expect a small gap, not an exact match.
    { type: 'shaka_ttff_ms', description: (stats.timeToFirstFrame * 1000).toFixed(0) },
    { type: 'codecs', description: `${stats.currentCodecs} @ ${stats.width}x${stats.height}` },
  );
  await info.attach('events.json', { body: JSON.stringify(events, null, 2), contentType: 'application/json' });

  expect(errorEvents(events)).toEqual([]);
  expect(ttffMs).toBeGreaterThan(0);
  // Generous bound: this is a smoke check against "never started", not a perf target.
  expect(ttffMs).toBeLessThan(20_000);
});

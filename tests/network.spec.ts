import { test, expect } from '@playwright/test';
import { STREAMS } from '../src/streams';
import {
  currentTime,
  pageUrl,
  recordRun,
  waitForFirstFrame,
  waitForPlayhead,
  waitForRebufferStart,
  waitForRecovery,
} from '../src/collect';

/** Bytes per second while throttled: ~160 kbit/s, far below the ~1 Mbit/s top variant. */
const THROTTLED_BYTES_PER_SEC = 20_000;
/** How long to keep the network throttled once the stall has started. */
const STALL_HOLD_MS = 3_000;

test('stall under throttling is detected and recovers', async ({ page }) => {
  // Draining the ~12 s buffer takes a while, so allow more than the default.
  test.setTimeout(120_000);

  // abr: false pins the highest variant. With ABR on, Shaka would just switch
  // down to a lower bitrate and never stall, which is not what we want to test.
  await page.goto(pageUrl(STREAMS.angelOneClear, { abr: false }));
  await waitForFirstFrame(page);
  await waitForPlayhead(page, 2);

  // A CDP session is a direct line to Chromium's DevTools Protocol, the same
  // API the DevTools "Network throttling" dropdown uses.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: THROTTLED_BYTES_PER_SEC,
    uploadThroughput: THROTTLED_BYTES_PER_SEC,
  });

  // Playback continues from the buffer, then stalls once it runs dry.
  await waitForRebufferStart(page, 60_000);
  // Keep the stall going for a moment so it has a measurable duration.
  await page.waitForTimeout(STALL_HOLD_MS);

  // -1 means "no limit".
  await cdp.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: -1,
  });
  await waitForRecovery(page, 30_000);
  // Recovered means the playhead is moving again, not just a `playing` event.
  await waitForPlayhead(page, (await currentTime(page)) + 2);

  const { metrics } = await recordRun(page);
  expect(metrics.rebufferCount).toBeGreaterThanOrEqual(1);
  expect(metrics.rebufferMs).toBeGreaterThan(0);
  expect(metrics.errors).toEqual([]);
});

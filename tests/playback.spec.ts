import { test, expect } from '@playwright/test';
import { PAST_CLEAR_LEAD_SECONDS, STREAMS } from '../src/streams';
import { pageUrl, readEvents, recordRun, waitForFirstFrame, waitForPlayhead } from '../src/collect';

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
  await page.goto(pageUrl(STREAMS.angelOneClear));
  await waitForFirstFrame(page);
  await waitForPlayhead(page, PLAY_SECONDS);

  const { metrics } = await recordRun(page);

  expect(metrics.errors).toEqual([]);
  expect(metrics.ttffMs).toBeGreaterThan(0);
  // Generous bound: this is a smoke check against "never started", not a perf target.
  expect(metrics.ttffMs).toBeLessThan(20_000);
});

test.describe('ClearKey (EME)', () => {
  // Both tests start at 20 s, past the stream's unencrypted "clear lead".
  // Without that, a wrong key would also appear to play.
  const start = PAST_CLEAR_LEAD_SECONDS;

  test('decrypts and plays with the right key', async ({ page }) => {
    await page.goto(pageUrl(STREAMS.angelOneClearKey, { start }));
    await waitForFirstFrame(page);
    await waitForPlayhead(page, start + PLAY_SECONDS);

    // keySystem() is the EME key system Shaka actually used ('' means none).
    expect(await page.evaluate(() => window.__player.keySystem())).toBe('org.w3.clearkey');
    const { metrics } = await recordRun(page);
    expect(metrics.errors).toEqual([]);
  });

  // A negative control: proves the test above really depends on decryption.
  test('fails to decode with a wrong key', async ({ page }) => {
    const wrongKey = 'feedf00deedeadbeeff0baadf00dd00d:ffffffffffffffffffffffffffffffff';
    await page.goto(pageUrl(STREAMS.angelOneClearKey, { start, clearKey: wrongKey }));

    await page.waitForFunction(() => window.__events.some((e) => e.type === 'error'), undefined, {
      timeout: 30_000,
    });
    const errors = (await readEvents(page)).filter((e) => e.type === 'error');
    await test.info().attach('errors.json', { body: JSON.stringify(errors, null, 2), contentType: 'application/json' });
    // We saw MEDIA_ERR_DECODE (3) from the video element and Shaka 3014/3015, but
    // the exact codes are Chromium's business; assert only that decoding failed.
    expect(errors.length).toBeGreaterThan(0);
  });
});

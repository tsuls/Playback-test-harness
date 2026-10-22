import { test, expect } from '@playwright/test';
import { STREAMS } from '../src/streams';
import { pageUrl, recordRun, waitForFirstFrame, waitForPlayhead } from '../src/collect';

// An A/B experiment on a player setting: what should the player assume about
// bandwidth before it has measured any? That guess picks the starting quality.
//
// - control:   Shaka as shipped. In Chromium-based browsers Shaka takes its first
//              guess from the browser's own estimate (navigator.connection.downlink,
//              about 10 Mbit/s here), so it starts at the top quality.
// - treatment: a conservative start. Assume 100 kbit/s and ignore the browser's
//              estimate, so playback starts at the lowest quality and switches up.
//
// Turning the browser's estimate off matters: with it on, Shaka ignores
// defaultBandwidthEstimate entirely, and both arms would behave the same.
//
// Each run tags itself with its experiment and arm; scripts/experiment-report.ts
// groups runs by those annotations and compares the arms' TTFF with
// src/experiment.ts. Run it with enough samples:
//
//   npm run experiment     (--repeat-each=10, then the report)

const EXPERIMENT = 'startup-bandwidth-estimate';
const PLAY_SECONDS = 5;

const ARMS = [
  { arm: 'control', config: {} },
  { arm: 'treatment', config: { abr: { useNetworkInformation: false, defaultBandwidthEstimate: 100_000 } } },
];

test.describe(`experiment: ${EXPERIMENT}`, { tag: '@experiment' }, () => {
  for (const { arm, config } of ARMS) {
    test(arm, async ({ page }) => {
      test.info().annotations.push(
        { type: 'experiment', description: EXPERIMENT },
        { type: 'arm', description: arm },
      );

      await page.goto(pageUrl(STREAMS.angelOneClear, { config }));
      await waitForFirstFrame(page);
      await waitForPlayhead(page, PLAY_SECONDS);
      const { metrics } = await recordRun(page);

      // Guardrail, not the outcome: whichever arm wins on TTFF, it must not
      // break playback. The outcome is decided by the report, across all runs.
      expect(metrics.errors).toEqual([]);
    });
  }
});

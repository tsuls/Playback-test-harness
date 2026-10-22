import { test, expect, type Page } from '@playwright/test';

// Which DRM key systems does this platform offer? Every EME browser must offer
// ClearKey; Widevine depends on the browser build.
//
// The answers are recorded on each run (annotation + attachment), so CI shows a
// per-platform DRM matrix. Assertions only cover what has been observed:
// - Linux Chromium (Playwright's open-source build): ClearKey only.
// - Edge on Windows: ClearKey and Widevine.
//
// PlayReady is deliberately left out: on GPU-less Windows Server VMs (all we can
// run CI on) Edge renders in software only and never offers it.

const KEY_SYSTEMS = {
  clearkey: 'org.w3.clearkey',
  widevine: 'com.widevine.alpha',
} as const;

type Offered = Record<keyof typeof KEY_SYSTEMS, boolean>;

async function offeredKeySystems(page: Page): Promise<Offered> {
  // EME only exists on secure pages; http://localhost counts as secure.
  await page.goto('/');
  return page.evaluate(async (keySystems) => {
    // A basic request: CENC-encrypted H.264 + AAC, the most widely supported combination.
    const config: MediaKeySystemConfiguration[] = [{
      initDataTypes: ['cenc'],
      videoCapabilities: [{ contentType: 'video/mp4; codecs="avc1.42E01E"' }],
      audioCapabilities: [{ contentType: 'audio/mp4; codecs="mp4a.40.2"' }],
    }];
    const result: Record<string, boolean> = {};
    for (const [name, keySystem] of Object.entries(keySystems)) {
      result[name] = await navigator.requestMediaKeySystemAccess(keySystem, config).then(() => true, () => false);
    }
    return result as Offered;
  }, KEY_SYSTEMS);
}

test('records which DRM key systems this platform offers', async ({ page }, testInfo) => {
  const offered = await offeredKeySystems(page);

  const platform = `${testInfo.project.name} on ${process.platform}`;
  testInfo.annotations.push({ type: 'drm', description: `${platform}: ${JSON.stringify(offered)}` });
  await testInfo.attach('drm-capabilities.json', {
    body: JSON.stringify({ platform, offered }, null, 2),
    contentType: 'application/json',
  });

  expect(offered.clearkey, 'ClearKey is required by the EME spec').toBe(true);
});

// DEMO (dev/platform_ci_fail_demo, do not merge): the `@edge` tag is removed, so
// the chromium project runs this test too. Linux Chromium has no Widevine, so it
// fails on Linux on both attempts and passes on Windows: a real platform failure.
test('Edge on Windows offers Widevine', async ({ page }) => {
  const offered = await offeredKeySystems(page);
  expect(offered.widevine, 'needs --disable-component-update removed; see playwright.config.ts').toBe(true);
});

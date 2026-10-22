import { test, expect } from '@playwright/test';

// DEMONSTRATION ONLY (dev/platform_ci_fail_demo, do not merge): a test that is
// flaky on Windows and stable on Linux, like a timing bug that only one platform
// hits. To make the demo certain rather than random, it fails on its first
// attempt on Windows and passes on the retry (`retries: 1`), so Playwright marks
// it "flaky" every time: the Windows job stays green and only the flake report
// shows it.
test('DEMO: flaky on Windows only', () => {
  const onWindows = process.platform === 'win32';
  const firstAttempt = test.info().retry === 0;
  expect(onWindows && firstAttempt, 'deliberate first-attempt failure on Windows').toBe(false);
});

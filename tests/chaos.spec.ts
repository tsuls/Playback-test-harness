import { test, expect } from '@playwright/test';

// DEMONSTRATION ONLY. This test is flaky on purpose so the flake report has
// something to catch. It is skipped unless CHAOS=1 is set:
//
//   CHAOS=1 npx playwright test tests/chaos.spec.ts --repeat-each=10
//
// With `retries: 1`, a run that fails and then passes on retry is reported by
// Playwright as "flaky".
test.skip(!process.env.CHAOS, 'demo flaky test: set CHAOS=1 to enable');

test('DEMO: fails randomly about 30% of the time', () => {
  expect(Math.random(), 'deliberate random failure for the flake demo').toBeGreaterThanOrEqual(0.3);
});

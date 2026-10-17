import { defineConfig, devices } from '@playwright/test';

const PORT = 3000;

export default defineConfig({
  testDir: 'tests',
  // Network playback is slow and variable; give each test room.
  timeout: 60_000,
  // A test that fails and then passes on its retry is reported as "flaky".
  // That label is the signal the flake report counts.
  retries: 1,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    // Machine-readable results (every attempt, annotations, attachments) for
    // scripts/flake-report.ts and scripts/metrics-report.ts.
    ['json', { outputFile: 'results/report.json' }],
  ],

  use: {
    // Lets tests call page.goto('/?src=...') instead of repeating the host.
    baseURL: `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },

  // `webServer`: Playwright starts this command before the tests, waits until
  // `url` responds, and shuts it down when the run ends.
  webServer: {
    command: 'node scripts/serve.mjs',
    url: `http://localhost:${PORT}`,
    env: { PORT: String(PORT) },
    // Locally, reuse a server you already started by hand; in CI always start fresh.
    reuseExistingServer: !process.env.CI,
  },

  // A project is a named group of tests with its own settings. Unit tests and
  // browser tests are split so each can be run alone (`--project=unit`).
  projects: [
    { name: 'unit', testDir: 'tests/unit' },
    {
      name: 'chromium',
      testIgnore: 'unit/**',
      // Playwright's bundled Chromium. Phase 1 checked that it supports H.264/AAC,
      // so the `chrome` channel is not needed.
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});

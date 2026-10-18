import { defineConfig, devices } from '@playwright/test';

const PORT = 3000;

// Each platform tests its own browser: Playwright's Chromium on Linux, Microsoft
// Edge on Windows. This matches the two CI platforms, and keeps `npm test` working on
// both (Linux has no Edge; the Windows job doesn't need Chromium).
const onWindows = process.platform === 'win32';

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
    // JUnit XML is the format Jenkins (and most CI servers) read natively to
    // show per-test results and history.
    ['junit', { outputFile: 'results/junit.xml' }],
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
    onWindows
      ? {
          name: 'edge',
          testIgnore: 'unit/**',
          // `channel: 'msedge'` drives the Edge installed on the machine instead
          // of a Playwright-downloaded browser. Edge is Chromium-based, so CDP
          // (used by the throttling test) works the same way.
          use: {
            ...devices['Desktop Edge'],
            channel: 'msedge',
            launchOptions: {
              // Playwright launches browsers with --disable-component-update,
              // which stops Edge from registering its bundled Widevine module.
              // Dropping that one flag makes Edge offer Widevine like a normal install.
              ignoreDefaultArgs: ['--disable-component-update'],
            },
          },
        }
      : {
          name: 'chromium',
          testIgnore: 'unit/**',
          // Tests tagged @edge describe Edge-on-Windows behaviour; skip them here.
          grepInvert: /@edge/,
          // Playwright's bundled Chromium. Phase 1 checked that it supports H.264/AAC,
          // so the `chrome` channel is not needed.
          use: { ...devices['Desktop Chrome'] },
        },
  ],
});

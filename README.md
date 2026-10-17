# Playback-test-harness

[![CI](https://github.com/tsuls/Playback-test-harness/actions/workflows/ci.yml/badge.svg)](https://github.com/tsuls/Playback-test-harness/actions/workflows/ci.yml)

Automated video playback tests in TypeScript with Playwright and Shaka Player: time to first frame, rebuffering, errors, flake detection, and CI on every push.

It plays real DASH streams in headless Chromium, measures playback quality from the player's events, cross-checks those numbers against Shaka's own statistics, and reports which tests are flaky.

## Quick start

```sh
npm ci
npx playwright install chromium
npm test              # type check + all tests
npm run report        # flake table + metrics summary from the last run
npm run test:chaos    # demo: a deliberately flaky test, run 10 times
```

Developed and verified on Node 22, which is also what CI uses.

## What it measures, and how

`site/index.html` is a small test page that loads Shaka Player, plays the manifest given in `?src=`, and pushes timestamped events into `window.__events`. Playwright opens the page, lets it play, then reads the events and `player.getStats()` back out.

| Metric | Definition |
| --- | --- |
| **Time to first frame (TTFF)** | From the page calling `player.load()` to the first frame the browser presents (`requestVideoFrameCallback`). |
| **Rebuffer count and time** | Each `waiting` event after the first `playing`, until the next `playing`. Startup buffering is not a rebuffer. |
| **Errors** | Every error event, as `source:code` (e.g. `shaka:3014`, `video:3`). |

Each run attaches its metrics to the test, and `scripts/metrics-report.ts` aggregates them across runs into `results/metrics.json` and a Markdown table, with TTFF p50 and p95 (nearest-rank percentiles).

### Cross-check against Shaka

Every run also records Shaka's view of the same playback. What we found:

- **Rebuffers agree.** Rebuilding rebuffers from Shaka's `stateHistory` with the same definition matches ours to within about 1 ms.
- **`bufferingTime` is higher than our rebuffer time,** because Shaka also counts startup buffering.
- **`stallsDetected` stays at 0 even during a real stall.** Shaka's stall detector fires when the playhead is stuck *with* data buffered (a decoder problem), not when the buffer runs empty. It measures something different from rebuffering.

### Tests

| Test | What it checks |
| --- | --- |
| Codec support | Chromium reports H.264/AAC support through `MediaSource.isTypeSupported`. |
| Clear stream | A clear DASH stream starts, plays 5 s, has a sane TTFF and no errors. |
| ClearKey, right key | An encrypted stream decrypts through EME (`org.w3.clearkey`) and plays. |
| ClearKey, wrong key | A negative control: with a wrong key, decoding fails. Proves the test above really depends on decryption. |
| Throttled stall | ABR is turned off to pin the top bitrate, bandwidth is cut through the Chrome DevTools Protocol until the buffer runs dry, then restored. Asserts a rebuffer was detected and the playhead moves again. |

## How flakes are detected

1. The suite runs with `retries: 1` and, in CI, `--repeat-each=3`.
2. A run that fails and then passes on its retry is labelled **flaky** by Playwright. A run that fails both attempts is a **failure**.
3. Playwright's JSON reporter writes every attempt to `results/report.json`.
4. `scripts/flake-report.ts` reads that file and prints, per test: runs, passes, failures, flaky runs and the flake rate (flaky / runs).

Flaky runs are tracked, not blocking: CI fails only on a real failure. `tests/chaos.spec.ts` is a clearly labelled demonstration test that fails about 30% of the time. It only runs with `CHAOS=1`, so the report has something to catch.

## Sample results

From a local run with `--repeat-each=3` (test names shortened):

| Test | Runs | TTFF p50 (ms) | TTFF p95 (ms) | Rebuffers | Rebuffer ms | Shaka rebuffers | Shaka rebuffer ms | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Throttled stall | 3 | 559 | 599 | 3 | 9814 | 3 | 9813 | none |
| Clear stream | 3 | 455 | 477 | 0 | 0 | 0 | 0 | none |
| ClearKey, right key | 3 | 633 | 813 | 0 | 0 | 0 | 0 | none |

And the chaos demo, 10 runs:

| Test | Runs | Passes | Failures | Flaky | Flake rate |
| --- | --- | --- | --- | --- | --- |
| DEMO: fails randomly about 30% of the time | 10 | 6 | 1 | 3 | 30% |

CI writes both tables to each run's summary page and uploads the HTML report and `results/` as artifacts.

## Known constraints

- **DRM:** headless Chromium has no Widevine, so the suite uses clear streams plus one ClearKey stream. ClearKey exercises the same EME path without a licence server.
- **Clear lead:** the ClearKey demo stream's first few seconds are unencrypted, so *any* key appears to work at the start. The ClearKey tests start playback at 20 s to get past it.
- **Codecs:** Playwright's bundled Chromium supports H.264/AAC and VP9/Opus, so the `chrome` channel isn't needed. Shaka chooses VP9 for these streams, and each run records the codec actually used.
- **Network variance:** streams come from a public CDN, so timings vary between runs and machines. Assertions check behaviour ("a rebuffer happened and playback recovered"), not exact numbers, and use generous timeouts. With only 3 runs, p95 is effectively the slowest run.

## Project layout

```
site/index.html            test page: Shaka Player + event recording
src/streams.ts             stream URLs (all verified to load)
src/types.ts               shared types
src/collect.ts             read events/stats from the page, compute run metrics
src/metrics.ts             percentiles
src/flake.ts               flake classification
src/report.ts              read Playwright's JSON report
tests/                     playback, network and chaos tests
tests/unit/                unit tests for the pure functions
scripts/flake-report.ts    JSON report → flake table
scripts/metrics-report.ts  JSON report → results/metrics.json + summary table
scripts/serve.mjs          static server started by Playwright's webServer
.github/workflows/ci.yml   CI on every push and pull request
```

## What to add next

- **A device matrix:** run the same suite across browsers (Firefox, WebKit) and real Chrome, on Linux, macOS and Windows.
- **Real TVs and streaming devices:** drive the same test page on living-room hardware, where decoders, memory and network stacks differ most from a desktop browser.
- **Regression alerts against a baseline:** store each `main` run's `metrics.json`, and flag a pull request when TTFF p95 or rebuffer time gets meaningfully worse than the baseline, or when a test's flake rate rises.

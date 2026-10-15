# Playback Test Harness

A small, public TypeScript project that runs automated video playback tests in a real browser, measures playback quality, detects flaky tests, and runs in CI on every push. It is a miniature of what a player test-automation team does.

Owner: Tyler. He will present this in a technical interview on Oct 22, so he has to be able to explain every line. Clarity beats cleverness everywhere.

## Hard rules

1. **No commits.** Never run `git commit`, `git push`, `git add`, `git reset`, `git rebase`, `git stash`, `git checkout -- <file>`, `git restore`, or anything else that changes git history, the index or the remote. Never use `gh` to create repos, PRs or releases. Read-only git (`status`, `diff`, `log`) is fine. Tyler commits and pushes himself. At the end of each phase, suggest a one-line commit message for him to use.
2. **Stop after each phase.** Summarize what changed, list the files, explain any non-obvious line, then wait for Tyler before you start the next phase.
3. **Explain as you go.** For every new concept (Playwright fixtures, CDP sessions, reporters, Actions syntax), add a one- or two-sentence comment or explain it in your summary. Don't write comments that only restate the code.
4. **Keep it small.** No frameworks beyond the stack below. Few dependencies. If you want to add a package, ask first and say why.
5. **No employer content.** This is a personal project. No references to any employer, internal system, codename or proprietary SDK anywhere in code, comments, commit suggestions or the README.
6. **Verify, don't assume.** Run the tests after every change. If a stream URL, API or flag doesn't behave the way you expected, say so and show the evidence. Don't paper over it.
7. **Leave the core logic to Tyler.** `src/metrics.ts` (percentiles) and `src/flake.ts` (flake classification) are his to write. Create typed stubs that throw `new Error('TODO')` and write their unit tests. Don't implement the stubs unless he asks.

## Stack

- Node 20+, TypeScript with `strict: true`
- Playwright Test (Chromium)
- Shaka Player from npm, served from a local static page
- GitHub Actions
- Unit tests for pure functions: Playwright's test runner is fine, no need for a second framework

## What it does

1. A local HTML page (`site/index.html`) loads Shaka Player and plays a stream passed in through a query parameter, for example `?src=<manifest>&abr=off`. It attaches listeners and pushes timestamped events into `window.__events`: `loadstart`, `playing`, `waiting`, `error` from the video element, plus Shaka's `error`, `buffering` and `adaptation` events. Once playback starts, it also records first-frame time with `requestVideoFrameCallback`.
2. Playwright opens the page, waits for playback to run for a fixed duration, then reads `window.__events` and `player.getStats()`.
3. For each run, compute and attach as a test annotation or attachment:
   - **Time to first frame (TTFF):** from `player.load()` start to the first rendered frame
   - **Rebuffer count and total rebuffer time:** each `waiting` after the first `playing`, until the next `playing`
   - **Playback errors:** count and codes
   - Cross-check your rebuffer numbers against Shaka's `getStats()` (`bufferingTime`, `stallsDetected`) and note any disagreement. Disagreements are interesting interview material, not something to hide.
4. **Network throttling test:** open a CDP session (`page.context().newCDPSession(page)`) and call `Network.emulateNetworkConditions` to drop bandwidth sharply mid-playback. Note that ABR will simply switch down instead of stalling, so for the stall test, pin the highest variant (`abr.enabled = false`) so a rebuffer really happens. Assert that rebuffering is detected and recovered from.
5. **Flake detection:** run with `--repeat-each` and `retries: 1`. A test that fails and then passes on retry is marked `flaky` by Playwright. Use the JSON reporter, and have `scripts/flake-report.ts` read the JSON and print per test: runs, passes, failures, flaky count, flake rate. It calls Tyler's `src/flake.ts`.
6. **Deliberate flaky test:** one test, enabled only when `CHAOS=1`, that fails randomly about 30% of the time, so the flake report has something to catch. Label it clearly as a demonstration.
7. **Metrics output:** write `results/metrics.json` (per test: TTFF list, p50/p95 from `src/metrics.ts`, rebuffer stats, errors) and a Markdown summary table.

## Known constraints (check these early and report back)

- **DRM:** automated headless Chromium has no Widevine. Use clear streams, plus one ClearKey stream to exercise EME. Mention this in the README.
- **Codecs:** Playwright's bundled Chromium may not support H.264/AAC. In phase 1, check `MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E"')`. If it's false, either use the `chrome` channel (`npx playwright install chrome`) or choose VP9/WebM streams. Tell Tyler which you chose and why.
- **Autoplay:** launch with `--autoplay-policy=no-user-gesture-required`, or mute the video.
- **Streams:** use Shaka's public demo assets (for example the Angel One clear and ClearKey DASH manifests under `storage.googleapis.com/shaka-demo-assets/`). Confirm each URL actually loads before writing tests against it. Keep the URLs in one file, `src/streams.ts`.
- **Determinism:** network-based tests vary by nature. Use generous timeouts and assertions on behavior ("a rebuffer was detected and playback recovered"), not on exact numbers.

## Suggested layout

```
site/index.html            test page
src/streams.ts             stream URLs
src/types.ts               PlaybackEvent, RunMetrics, TestResult types
src/metrics.ts             percentiles (Tyler)
src/flake.ts               flake classification (Tyler)
src/collect.ts             read events from the page, compute run metrics
tests/playback.spec.ts     startup, steady playback, ClearKey
tests/network.spec.ts      throttled stall and recovery
tests/chaos.spec.ts        demo flaky test (CHAOS=1)
tests/unit/*.spec.ts       unit tests for metrics.ts and flake.ts
scripts/flake-report.ts    JSON report to flake table
.github/workflows/ci.yml
playwright.config.ts
README.md
```

## Phases

**Phase 1: Page and first metric.** Scaffold the project, add the static page served through Playwright's `webServer` config, add the codec check, one clear stream that plays, and a TTFF measurement. `npm test` passes locally. Add stubs and unit tests for `metrics.ts` and `flake.ts`.

**Phase 2: Quality metrics and flakes.** Rebuffer and error metrics, the `getStats()` cross-check, the throttled stall test, the ClearKey test, the chaos test, the JSON reporter, the flake report script and `results/metrics.json`.

**Phase 3: CI and README.** GitHub Actions on push and pull request: checkout, setup-node with npm cache, `npm ci`, install the browser with dependencies, run the suite with `--repeat-each=3`, upload the HTML report and `results/` as artifacts, and write the summary table to `$GITHUB_STEP_SUMMARY`. Write the workflow file but don't push. README sections: what it measures and how, how flakes are detected, a sample results table, known constraints (DRM, codecs, network variance), and what to add next (a device matrix, real TVs, regression alerts against a baseline).

## Interview framing

When a design choice comes up, prefer the option that's easy to explain in one sentence. Tyler should be able to answer "why did you do it this way?" for every file.

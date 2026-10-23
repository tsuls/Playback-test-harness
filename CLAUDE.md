# Playback Test Harness

A small, public TypeScript project that runs automated video playback tests in a real browser, measures playback quality, detects flaky tests, and runs in CI on every push. It is a miniature of what a player test-automation team does.

Owner: Tyler. He has to be able to explain every line. Clarity beats cleverness everywhere.

## Hard rules

1. **No commits.** Never run `git commit`, `git push`, `git add`, `git reset`, `git rebase`, `git stash`, `git checkout -- <file>`, `git restore`, or anything else that changes git history, the index or the remote. Never use `gh` to create repos, PRs or releases. Read-only git (`status`, `diff`, `log`) is fine. Tyler commits and pushes himself. At the end of each phase, suggest a one-line commit message for him to use.
2. **Stop after each phase.** Summarize what changed, list the files, explain any non-obvious line, then wait for Tyler before you start the next phase.
3. **Explain as you go.** For every new concept (Playwright fixtures, CDP sessions, reporters, Actions syntax), add a one- or two-sentence comment or explain it in your summary. Don't write comments that only restate the code.
4. **Keep it small.** No frameworks beyond the stack below. Few dependencies. If you want to add a package, ask first and say why.
5. **No employer content.** This is a personal project. No references to any employer, internal system, codename or proprietary SDK anywhere in code, comments, commit suggestions or the README.
6. **Verify, don't assume.** Run the tests after every change. If a stream URL, API or flag doesn't behave the way you expected, say so and show the evidence. Don't paper over it.
7. **Leave the core logic to Tyler.** `src/metrics.ts` (percentiles), `src/flake.ts` (flake classification), and `compareArms` and `decide` in `src/experiment.ts` (A/B comparison and decision) are his. All four are implemented; don't rewrite them unless he asks. New core logic starts as a typed stub throwing `new Error('TODO')`, with unit tests that skip themselves (`isTodo`) while it is still a stub. Don't implement a stub unless he asks.

## Stack

- Node 20+, TypeScript with `strict: true`
- Playwright Test (Chromium; Microsoft Edge from Phase 5)
- Shaka Player from npm, served from a local static page
- GitHub Actions, plus a self-hosted Jenkins (Phase 4)
- `tsx` to run the TypeScript report scripts (no build step)
- Unit tests for pure functions: Playwright's test runner is fine, no need for a second framework

## What it does

1. A local HTML page (`site/index.html`) loads Shaka Player and plays a stream passed in through a query parameter, for example `?src=<manifest>&abr=off`. It attaches listeners and pushes timestamped events into `window.__events`: `loadstart`, `playing`, `waiting`, `error` from the video element, plus Shaka's `error`, `buffering` and `adaptation` events. Once playback starts, it also records first-frame time with `requestVideoFrameCallback`.
2. Playwright opens the page, waits for playback to run for a fixed duration, then reads `window.__events` and `player.getStats()`.
3. For each run, compute and attach as a test annotation or attachment:
   - **Time to first frame (TTFF):** from `player.load()` start to the first rendered frame
   - **Rebuffer count and total rebuffer time:** each `waiting` after the first `playing`, until the next `playing`
   - **Playback errors:** count and codes
   - Cross-check your rebuffer numbers against Shaka's `getStats()` (`bufferingTime`, `stallsDetected`) and note any disagreement. Disagreements are interesting findings, not something to hide.
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
src/experiment.ts          compareArms + decide: A/B verdict and decision (Tyler)
src/collect.ts             read events from the page, compute run metrics
tests/playback.spec.ts     startup, steady playback, ClearKey
tests/network.spec.ts      throttled stall and recovery
tests/chaos.spec.ts        demo flaky test (CHAOS=1)
tests/experiment.spec.ts   A/B experiment arms (@experiment)
tests/drm-capabilities.spec.ts  key systems per platform; @edge Widevine offered + played
tests/unit/*.spec.ts       unit tests for metrics.ts, flake.ts, experiment.ts and collect.ts
scripts/flake-report.ts    JSON report to flake table
scripts/metrics-report.ts  JSON report to results/metrics.json + summary table
scripts/experiment-report.ts  JSON report to results/experiment.md (arms compared)
scripts/serve.mjs          static server for Playwright's webServer
scripts/archive-results.mjs  copy reports into archive/<platform>/ (Jenkins)
src/report.ts              shared reader for Playwright's JSON report
.github/workflows/ci.yml
.github/workflows/experiment.yml  A/B experiment, nightly + on demand
Jenkinsfile
playwright.config.ts
README.md                  narrative overview + high-level diagram
ARCHITECTURE.md            detailed diagram, CI flow, security boundaries
```

## Phases

**Phase 1: Page and first metric.** Scaffold the project, add the static page served through Playwright's `webServer` config, add the codec check, one clear stream that plays, and a TTFF measurement. `npm test` passes locally. Add stubs and unit tests for `metrics.ts` and `flake.ts`.

**Phase 2: Quality metrics and flakes.** Rebuffer and error metrics, the `getStats()` cross-check, the throttled stall test, the ClearKey test, the chaos test, the JSON reporter, the flake report script and `results/metrics.json`.

**Phase 3: CI and README.** GitHub Actions on push and pull request: checkout, setup-node with npm cache, `npm ci`, install the browser with dependencies, run the suite with `--repeat-each=3`, upload the HTML report and `results/` as artifacts, and write the summary table to `$GITHUB_STEP_SUMMARY`. Write the workflow file but don't push. README sections: what it measures and how, how flakes are detected, a sample results table, known constraints (DRM, codecs, network variance), and what to add next (a device matrix, real TVs, regression alerts against a baseline).

**Phase 4: Jenkins (done).** A `Jenkinsfile` that mirrors `ci.yml`: a declarative pipeline running inside Microsoft's Playwright Docker image (tag matches the installed `@playwright/test`), `npm ci` → `tsc` → tests with `--repeat-each=3`, then a `post { always }` block that runs each report script separately, publishes `results/junit.xml` (Playwright's built-in JUnit reporter) and archives artifacts. A Multibranch Pipeline job builds every branch and PR from the origin repo (fork PRs are deliberately not built), triggered by a signed GitHub webhook, and reports a status check back to the PR. README: a GitHub Actions vs Jenkins comparison, the flaky-vs-CI trade-off, and an architecture diagram. Note: JUnit XML has no "flaky" status, so the flake report is the only place flakiness shows up in Jenkins.

**Phase 5: A second platform (Windows + Edge) (done).** Mirror the "Linux tests and Windows tests" split of a real player team.
- **Playwright projects (done):** `unit`, plus `chromium` on Linux or `edge` (`channel: 'msedge'`, with `--disable-component-update` removed so Widevine registers) on Windows, chosen by `process.platform`. Platform-specific tests carry the tag `@edge`; `chromium` excludes them with `grepInvert`, so there is one test codebase.
- **Platform-specific test (done):** a DRM capability check that records which key systems each platform offers (ClearKey, Widevine) via `navigator.requestMediaKeySystemAccess`, and asserts only what has been observed: ClearKey everywhere, Widevine on Edge/Windows (`@edge`). PlayReady is out of scope: Edge on GPU-less Windows Server VMs never offers it.
- **Widevine playback and a stricter negative control (review fixes):** `site/index.html` takes `&license=<URL>` (Widevine licence server); `STREAMS.angelOneWidevine` uses Shaka's public test licence server; an `@edge` test plays it from `PAST_CLEAR_LEAD_SECONDS` and asserts `keySystem() === 'com.widevine.alpha'`. A first run once failed with Shaka 6012 (no licence server): a startup race, Edge registers Widevine asynchronously and the manifest's generic `cenc` entry let Shaka fall back to another key system. Fixed in the page: wait (≤10 s) until `requestMediaKeySystemAccess('com.widevine.alpha')` succeeds, and set `drm.preferredKeySystems`; then 5/5 on a fresh copy, suite 153 passed. Page errors record `err.data`. Widevine TTFF ≈ 2.9 s vs ClearKey ≈ 0.44 s on Edge (licence round trip + CDM init). The ClearKey wrong-key test now requires a decode/DRM error (video code 3, or Shaka category 3 or 6) and no Shaka network error (category 1).
- **GitHub Actions (done):** one matrix job, `playback`, runs in parallel on `linux-chromium` (`ubuntu-latest`) and `windows-edge` (`windows-latest`, where Edge is preinstalled); both run the unit tests. A gate job `CI passed` (`needs: playback`, `if: always()`) is the only check the merge ruleset requires. `push` triggers only on `main`; PR branches run via `pull_request`, so each job reports once.
- **Jenkins (done):** a Windows agent (a Windows VM Tyler provides) labelled `windows`, connected by the controller over SSH so Jenkins stays private. The `Jenkinsfile` has `agent none` and parallel `linux-chromium` / `windows-edge` stages (`failFast false`); the Windows stage runs directly on the agent with `bat` (no Docker), with Java, Node 22, Git and Edge installed there. Each stage copies its reports into `archive/<platform>/` (`scripts/archive-results.mjs`) before archiving, so the platforms don't overwrite each other.
- **Cross-platform check:** anything run on Windows must not rely on POSIX shell syntax, and paths must use Node's `path` module. Known exception, documented in the README: `npm run test:chaos` uses `CHAOS=1 …`; CI never runs it.
- **README (done):** the platform matrix, what differs per platform (DRM, codecs), the GitHub Actions and Jenkins sections, and the updated architecture diagram.

**Phase 6: A/B experiment (done).** Show experimentation on a player setting, the way a player team would evaluate an ABR change.
- **Page support:** `site/index.html` takes `&config=<JSON>` and passes it to `player.configure()`; the first-frame event records the frame's height (start quality). `RunMetrics.startHeight` carries it; `src/report.ts` exposes each run's annotations.
- **Experiment:** `tests/experiment.spec.ts` (`@experiment`), experiment `startup-bandwidth-estimate`. Control = Shaka as shipped (in Chromium/Edge it uses `navigator.connection.downlink`, ~10 Mbit/s, so it starts at 576p). Treatment = `abr.useNetworkInformation: false` + `defaultBandwidthEstimate: 100000` (starts at 144p, switches up). Each run carries `experiment` and `arm` annotations. Guardrail assertion only: no errors.
- **Pitfall found (verified):** changing only `defaultBandwidthEstimate` has no effect in Chromium, because Shaka prefers the Network Information estimate; both arms started at 576p.
- **Results (verified, Linux, 3 batches × 10 runs per arm):** treatment TTFF p50 400–411 ms vs control 475–499 ms (−16 to −18%), at 144p vs 576p, no rebuffers or errors. Edge on Windows (3 runs) points the same way. An earlier 6-run probe with a different control pointed the other way: small samples mislead.
- **Comparison:** `compareArms(control, treatment, rules)` in `src/experiment.ts` is Tyler's; `tests/unit/experiment.spec.ts` specifies it (p50s via `percentile`, delta and deltaPct, Inconclusive below `minRuns` 5 or `minEffectPct` 10%, exactly 10% counts). p50s and deltas are always reported; only the verdict depends on the rules. First full run with the verdict: control 558 ms vs treatment 446 ms, −20.2%, **better**.
- **CI: experiments measure, they don't gate.** The main suite runs with `--grep-invert @experiment`. GitHub: `.github/workflows/experiment.yml` (Linux + Windows matrix, `--repeat-each=10`), nightly on main (`schedule`) and on demand (`workflow_dispatch`); not part of `CI passed`. Jenkins: an `Experiment` stage after `Platforms` (so it doesn't compete with the suite for CPU), `when { branch 'main' }`.
- **Reports:** `scripts/experiment-report.ts` → `results/experiment.md`, added to `npm run report`, the experiment workflow's summary and the Jenkins experiment stages. `npm run experiment` = `--grep @experiment --repeat-each=10` + the report (cross-platform: no env vars).
- **Guardrails and decision:** the report adds a start-height guardrail (treatment start-height p50 must not be lower than control's) and calls `decide(verdict, guardrails)`: Better + all guardrails pass → Better; Better + any fails → `Verdict.TradeOff`; otherwise the verdict unchanged. The current experiment's decision is **trade-off** (TTFF better, start height 576p → 144p).
- **Docs:** README rewritten as a narrative that reflects what a player quality / test-infrastructure team does (quality metrics, platforms and content protection, experimentation, CI/CD and developer productivity, AI-assisted workflow), with a small diagram; the full diagram moved to `ARCHITECTURE.md`.

## Infrastructure

The self-hosted CI machines are documented outside this public repo, in Tyler's private notes on the Linux VM. Never put server addresses, account names, credentials or firewall details in the repo.

## Design framing

When a design choice comes up, prefer the option that's easy to explain in one sentence. Tyler should be able to answer "why did you do it this way?" for every file.

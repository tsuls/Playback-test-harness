// Reads Playwright's JSON reporter output (results/report.json) and flattens it
// into one record per test run. Shared by scripts/flake-report.ts and
// scripts/metrics-report.ts.

import { readFileSync } from 'node:fs';
import type { JSONReport, JSONReportSuite } from '@playwright/test/reporter';
import { AttemptStatus, type RunMetrics, type TestRun } from './types';

export const DEFAULT_REPORT_PATH = 'results/report.json';

/** Name of the per-run attachment that src/collect.ts writes and this file reads. */
export const METRICS_ATTACHMENT = 'metrics';

/** One run of one test: its attempts, plus the metrics it recorded (if any). */
export interface RunRecord extends TestRun {
  project: string;
  /** Metrics from the final attempt, the one that decided the outcome. */
  metrics?: RunMetrics;
}

/**
 * The JSON report gives statuses as plain strings. Convert each one to the
 * AttemptStatus enum, and fail loudly on a value we do not know about.
 */
export function toAttemptStatus(status: string | undefined): AttemptStatus {
  const known = Object.values(AttemptStatus) as string[];
  // Playwright's types mark `status` optional; treat a missing one as an error too.
  if (status === undefined || !known.includes(status)) {
    throw new Error(`unknown Playwright status: ${status}`);
  }
  return status as AttemptStatus;
}

export function loadRuns(path = DEFAULT_REPORT_PATH): RunRecord[] {
  const report = JSON.parse(readFileSync(path, 'utf8')) as JSONReport;
  const runs: RunRecord[] = [];

  // Suites nest: file > describe > describe ... > spec. Each spec has one
  // entry in `tests` per project and per --repeat-each copy, and each of those
  // has one `results` entry per attempt (the first try, then retries).
  const walk = (suite: JSONReportSuite, path: string[]) => {
    const here = [...path, suite.title];
    for (const spec of suite.specs) {
      for (const t of spec.tests) {
        const final = t.results.at(-1);
        const attachment = final?.attachments.find((a) => a.name === METRICS_ATTACHMENT);
        runs.push({
          title: [...here, spec.title].join(' › '),
          project: t.projectName,
          attempts: t.results.map((r) => toAttemptStatus(r.status)),
          metrics: attachment?.body
            ? (JSON.parse(Buffer.from(attachment.body, 'base64').toString('utf8')) as RunMetrics)
            : undefined,
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const suite of report.suites) walk(suite, []);
  return runs;
}

/** A GitHub-flavoured Markdown table, so the same output works in a terminal and in CI summaries. */
export function markdownTable(headers: string[], rows: (string | number)[][]): string {
  const line = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n');
}

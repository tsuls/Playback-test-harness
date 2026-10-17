// Prints a per-test flake table from Playwright's JSON report.
//
//   npx tsx scripts/flake-report.ts [path/to/report.json]
//
// Also writes the table to results/flakes.md so CI can add it to the job summary.

import { writeFileSync } from 'node:fs';
import { summarizeFlakes } from '../src/flake';
import { DEFAULT_REPORT_PATH, loadRuns, markdownTable } from '../src/report';

// Unit tests are left out: pure functions do not flake. Flakes come from the
// browser, the network and timing, which is what the chromium project covers.
const runs = loadRuns(process.argv[2] ?? DEFAULT_REPORT_PATH).filter((r) => r.project !== 'unit');

const table = markdownTable(
  ['Test', 'Runs', 'Passes', 'Failures', 'Flaky', 'Flake rate'],
  summarizeFlakes(runs).map((s) => [
    s.title,
    s.runs,
    s.passes,
    s.failures,
    s.flaky,
    `${(s.flakeRate * 100).toFixed(0)}%`,
  ]),
);

// Trailing blank line so another report can be appended after it (CI's job summary).
const markdown = `## Flake report\n\n${table}\n\n`;
writeFileSync('results/flakes.md', markdown);
console.log(markdown);

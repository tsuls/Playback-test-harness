// Aggregates per-run playback metrics from Playwright's JSON report.
//
//   npx tsx scripts/metrics-report.ts [path/to/report.json]
//
// Writes results/metrics.json (full data) and results/summary.md (a table),
// and prints the table.

import { writeFileSync } from 'node:fs';
import { summarize } from '../src/metrics';
import { DEFAULT_REPORT_PATH, loadRuns, markdownTable, type RunRecord } from '../src/report';

const runs = loadRuns(process.argv[2] ?? DEFAULT_REPORT_PATH).filter((r) => r.metrics);

// Group runs by test title.
const byTitle = new Map<string, RunRecord[]>();
for (const run of runs) byTitle.set(run.title, [...(byTitle.get(run.title) ?? []), run]);

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);

const tests = [...byTitle.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([title, group]) => {
    const m = group.map((r) => r.metrics!);
    const ttffMs = m.map((x) => x.ttffMs);
    return {
      title,
      runs: group.length,
      ttffMs,
      ttff: summarize(ttffMs),
      rebuffers: {
        count: sum(m.map((x) => x.rebufferCount)),
        totalMs: sum(m.map((x) => x.rebufferMs)),
      },
      // The same totals as Shaka measured them, for the cross-check.
      shakaRebuffers: {
        count: sum(m.map((x) => x.shaka.rebufferCount)),
        totalMs: sum(m.map((x) => x.shaka.rebufferMs)),
        bufferingMs: sum(m.map((x) => x.shaka.bufferingMs)),
        stallsDetected: sum(m.map((x) => x.shaka.stallsDetected)),
      },
      errors: [...new Set(m.flatMap((x) => x.errors))],
    };
  });

writeFileSync('results/metrics.json', JSON.stringify({ generatedAt: new Date().toISOString(), tests }, null, 2));

const ms = (n: number) => n.toFixed(0);
const table = markdownTable(
  ['Test', 'Runs', 'TTFF p50 (ms)', 'TTFF p95 (ms)', 'Rebuffers', 'Rebuffer ms', 'Shaka rebuffers', 'Shaka rebuffer ms', 'Errors'],
  tests.map((t) => [
    t.title,
    t.runs,
    ms(t.ttff.p50),
    ms(t.ttff.p95),
    t.rebuffers.count,
    ms(t.rebuffers.totalMs),
    t.shakaRebuffers.count,
    ms(t.shakaRebuffers.totalMs),
    t.errors.join(', ') || 'none',
  ]),
);

// Trailing blank line so another report can be appended after it (CI's job summary).
const markdown = `## Playback metrics\n\n${table}\n\n`;
writeFileSync('results/summary.md', markdown);
console.log(markdown);

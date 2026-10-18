// Compares the arms of each A/B experiment in Playwright's JSON report.
//
//   npx tsx scripts/experiment-report.ts [path/to/report.json]
//
// Runs are matched to an experiment and arm by their `experiment` and `arm`
// annotations (see tests/experiment.spec.ts). Writes results/experiment.md and
// prints it.

import { writeFileSync } from 'node:fs';
import { compareArms, DEFAULT_RULES } from '../src/experiment';
import { percentile, summarize } from '../src/metrics';
import { annotation, DEFAULT_REPORT_PATH, loadRuns, markdownTable, type RunRecord } from '../src/report';

const runs = loadRuns(process.argv[2] ?? DEFAULT_REPORT_PATH).filter((r) => r.metrics && annotation(r, 'experiment'));

// experiment name -> arm name -> runs
const experiments = new Map<string, Map<string, RunRecord[]>>();
for (const run of runs) {
  const name = annotation(run, 'experiment')!;
  const arm = annotation(run, 'arm') ?? 'unknown';
  const arms = experiments.get(name) ?? new Map<string, RunRecord[]>();
  arms.set(arm, [...(arms.get(arm) ?? []), run]);
  experiments.set(name, arms);
}

const ms = (n: number) => n.toFixed(0);
const ttffs = (group: RunRecord[]) => group.map((r) => r.metrics!.ttffMs);

const sections = [...experiments.entries()].map(([name, arms]) => {
  const table = markdownTable(
    ['Arm', 'Runs', 'TTFF p50 (ms)', 'TTFF p95 (ms)', 'Start height p50', 'Rebuffers', 'Errors'],
    [...arms.entries()].map(([arm, group]) => {
      const m = group.map((r) => r.metrics!);
      const ttff = summarize(ttffs(group));
      const heights = m.flatMap((x) => (x.startHeight === undefined ? [] : [x.startHeight]));
      return [
        arm,
        group.length,
        ms(ttff.p50),
        ms(ttff.p95),
        heights.length > 0 ? `${percentile(heights, 50)}p` : 'unknown',
        m.reduce((sum, x) => sum + x.rebufferCount, 0),
        [...new Set(m.flatMap((x) => x.errors))].join(', ') || 'none',
      ];
    }),
  );

  const control = arms.get('control');
  const treatment = arms.get('treatment');
  let verdict: string;
  if (!control || !treatment) {
    verdict = 'Needs a `control` and a `treatment` arm to compare.';
  } else {
    try {
      const c = compareArms(ttffs(control), ttffs(treatment));
      const sign = c.delta > 0 ? '+' : '';
      verdict =
        `**Treatment vs control, TTFF p50:** ${sign}${ms(c.delta)} ms (${sign}${c.deltaPct.toFixed(1)}%), ` +
        `verdict **${c.verdict}** (rules: at least ${DEFAULT_RULES.minRuns} runs per arm ` +
        `and a change of at least ${DEFAULT_RULES.minEffectPct}%).`;
    } catch (err) {
      verdict = err instanceof Error && err.message === 'TODO'
        ? 'Verdict: `compareArms()` in src/experiment.ts is not implemented yet.'
        : `Verdict: comparison failed: ${String(err)}`;
    }
  }
  return `### ${name}\n\n${table}\n\n${verdict}`;
});

// Trailing blank line so another report can be appended after it (CI's job summary).
const markdown = `## Experiments\n\n${sections.join('\n\n') || 'No experiment runs in this report.'}\n\n`;
writeFileSync('results/experiment.md', markdown);
console.log(markdown);

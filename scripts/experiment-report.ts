// Compares the arms of each A/B experiment in Playwright's JSON report.
//
//   npx tsx scripts/experiment-report.ts [path/to/report.json]
//
// Runs are matched to an experiment and arm by their `experiment` and `arm`
// annotations (see tests/experiment.spec.ts). Writes results/experiment.md and
// prints it.

import { writeFileSync } from 'node:fs';
import { compareArms, decide, DEFAULT_RULES, type Guardrail } from '../src/experiment';
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
const startHeights = (group: RunRecord[]) =>
  group.flatMap((r) => (r.metrics!.startHeight === undefined ? [] : [r.metrics!.startHeight]));

/**
 * Guardrail: the treatment must not start at a lower quality than the control.
 * A faster start bought by starting blurry is a trade-off, not a win.
 * Undefined when either arm has no start heights recorded.
 */
function startHeightGuardrail(control: RunRecord[], treatment: RunRecord[]): Guardrail | undefined {
  const c = startHeights(control);
  const t = startHeights(treatment);
  if (c.length === 0 || t.length === 0) return undefined;
  const cP50 = percentile(c, 50);
  const tP50 = percentile(t, 50);
  return { name: 'start height p50', passed: tP50 >= cP50, detail: `${cP50}p → ${tP50}p` };
}

const sections = [...experiments.entries()].map(([name, arms]) => {
  const table = markdownTable(
    ['Arm', 'Runs', 'TTFF p50 (ms)', 'TTFF p95 (ms)', 'Start height p50', 'Rebuffers', 'Errors'],
    [...arms.entries()].map(([arm, group]) => {
      const m = group.map((r) => r.metrics!);
      const ttff = summarize(ttffs(group));
      const heights = startHeights(group);
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

      // Guardrails: what the treatment must not make worse, whatever TTFF does.
      const guardrails = [startHeightGuardrail(control, treatment)].filter((g) => g !== undefined);
      const lines = guardrails.map((g) => `- ${g.passed ? '✅' : '❌'} ${g.name}: ${g.detail}`);
      verdict += `\n\n**Guardrails:**\n${lines.join('\n') || '- none could be evaluated'}`;
      try {
        verdict += `\n\n**Decision:** **${decide(c.verdict, guardrails)}**`;
      } catch (err) {
        verdict += err instanceof Error && err.message === 'TODO'
          ? '\n\n**Decision:** `decide()` in src/experiment.ts is not implemented yet.'
          : `\n\n**Decision:** failed: ${String(err)}`;
      }
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

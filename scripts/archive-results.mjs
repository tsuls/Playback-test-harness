// Copies this run's reports into archive/<platform>/, so Jenkins can archive
// every platform's reports in one build without one overwriting another.
// Node instead of cp/xcopy, so the same command works on Linux and Windows.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const platform = process.argv[2];
if (!platform) throw new Error('usage: node scripts/archive-results.mjs <platform>');

const dest = join('archive', platform);
rmSync(dest, { recursive: true, force: true });
for (const dir of ['results', 'playwright-report']) {
  if (existsSync(dir)) cpSync(dir, join(dest, dir), { recursive: true });
}

import { test, expect } from '@playwright/test';
import { classifyRun, summarizeFlakes } from '../../src/flake';
import { AttemptStatus, RunOutcome } from '../../src/types';
import type { TestRun } from '../../src/types';
import { isTodo } from './todo';

const { Passed, Failed, TimedOut, Skipped } = AttemptStatus;

test.describe('classifyRun', () => {
  test.skip(isTodo(() => classifyRun([Passed])), 'src/flake.ts classifyRun() not implemented yet');

  test('passed first time is a pass', () => {
    expect(classifyRun([Passed])).toBe(RunOutcome.Pass);
  });

  test('failed then passed on retry is flaky', () => {
    expect(classifyRun([Failed, Passed])).toBe(RunOutcome.Flaky);
  });

  test('a timeout counts as a failed attempt', () => {
    expect(classifyRun([TimedOut, Passed])).toBe(RunOutcome.Flaky);
    expect(classifyRun([TimedOut])).toBe(RunOutcome.Fail);
  });

  test('failed on every attempt is a fail', () => {
    expect(classifyRun([Failed])).toBe(RunOutcome.Fail);
    expect(classifyRun([Failed, Failed])).toBe(RunOutcome.Fail);
  });

  test('a mix of skipped and failed, with no pass, is a fail', () => {
    expect(classifyRun([Skipped, Failed])).toBe(RunOutcome.Fail);
  });

  test('all attempts skipped is skipped', () => {
    expect(classifyRun([Skipped])).toBe(RunOutcome.Skipped);
  });
});

test.describe('summarizeFlakes', () => {
  test.skip(isTodo(() => summarizeFlakes([])), 'src/flake.ts summarizeFlakes() not implemented yet');

  test('empty input gives an empty report', () => {
    expect(summarizeFlakes([])).toEqual([]);
  });

  test('counts outcomes per test title', () => {
    const runs: TestRun[] = [
      { title: 'b', attempts: [Passed] },
      { title: 'a', attempts: [Passed] },
      { title: 'a', attempts: [Failed, Passed] },
      { title: 'a', attempts: [Failed, Failed] },
      { title: 'a', attempts: [Failed, Passed] },
    ];
    expect(summarizeFlakes(runs)).toEqual([
      { title: 'a', runs: 4, passes: 1, failures: 1, flaky: 2, flakeRate: 0.5 },
      { title: 'b', runs: 1, passes: 1, failures: 0, flaky: 0, flakeRate: 0 },
    ]);
  });

  test('skipped runs are not counted', () => {
    const runs: TestRun[] = [
      { title: 'chaos', attempts: [Skipped] },
      { title: 'chaos', attempts: [Skipped] },
    ];
    expect(summarizeFlakes(runs)).toEqual([
      { title: 'chaos', runs: 0, passes: 0, failures: 0, flaky: 0, flakeRate: 0 },
    ]);
  });
});

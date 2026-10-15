import { test, expect } from '@playwright/test';
import { classifyRun, summarizeFlakes } from '../../src/flake';
import type { TestRun } from '../../src/types';
import { isTodo } from './todo';

test.describe('classifyRun', () => {
  test.skip(isTodo(() => classifyRun(['passed'])), 'src/flake.ts classifyRun() not implemented yet');

  test('passed first time is a pass', () => {
    expect(classifyRun(['passed'])).toBe('pass');
  });

  test('failed then passed on retry is flaky', () => {
    expect(classifyRun(['failed', 'passed'])).toBe('flaky');
  });

  test('a timeout counts as a failed attempt', () => {
    expect(classifyRun(['timedOut', 'passed'])).toBe('flaky');
    expect(classifyRun(['timedOut'])).toBe('fail');
  });

  test('failed on every attempt is a fail', () => {
    expect(classifyRun(['failed'])).toBe('fail');
    expect(classifyRun(['failed', 'failed'])).toBe('fail');
  });

  test('all attempts skipped is skipped', () => {
    expect(classifyRun(['skipped'])).toBe('skipped');
  });
});

test.describe('summarizeFlakes', () => {
  test.skip(isTodo(() => summarizeFlakes([])), 'src/flake.ts summarizeFlakes() not implemented yet');

  test('empty input gives an empty report', () => {
    expect(summarizeFlakes([])).toEqual([]);
  });

  test('counts outcomes per test title', () => {
    const runs: TestRun[] = [
      { title: 'b', attempts: ['passed'] },
      { title: 'a', attempts: ['passed'] },
      { title: 'a', attempts: ['failed', 'passed'] },
      { title: 'a', attempts: ['failed', 'failed'] },
      { title: 'a', attempts: ['failed', 'passed'] },
    ];
    expect(summarizeFlakes(runs)).toEqual([
      { title: 'a', runs: 4, passes: 1, failures: 1, flaky: 2, flakeRate: 0.5 },
      { title: 'b', runs: 1, passes: 1, failures: 0, flaky: 0, flakeRate: 0 },
    ]);
  });

  test('skipped runs are not counted', () => {
    const runs: TestRun[] = [
      { title: 'chaos', attempts: ['skipped'] },
      { title: 'chaos', attempts: ['skipped'] },
    ];
    expect(summarizeFlakes(runs)).toEqual([
      { title: 'chaos', runs: 0, passes: 0, failures: 0, flaky: 0, flakeRate: 0 },
    ]);
  });
});

import { test, expect } from '@playwright/test';
import { compareArms, DEFAULT_RULES, Verdict } from '../../src/experiment';
import { isTodo } from './todo';

test.describe('compareArms', () => {
  test.skip(isTodo(() => compareArms([1], [1])), 'src/experiment.ts compareArms() not implemented yet');

  // Five runs per arm: enough for the default rules (minRuns 5).
  const control = [500, 300, 400, 200, 100]; // p50 = 300 (nearest rank 3 of 5)

  test('reports both p50s and the difference', () => {
    const treatment = [250, 150, 350, 450, 50]; // p50 = 250
    const result = compareArms(control, treatment);
    expect(result.controlP50).toBe(300);
    expect(result.treatmentP50).toBe(250);
    expect(result.delta).toBe(-50);
    expect(result.deltaPct).toBeCloseTo(-16.67, 2);
  });

  test('a lower treatment p50, by at least minEffectPct, is better', () => {
    const treatment = [400, 240, 320, 160, 80]; // p50 240: -20%
    expect(compareArms(control, treatment).verdict).toBe(Verdict.Better);
  });

  test('a higher treatment p50, by at least minEffectPct, is worse', () => {
    const treatment = [600, 360, 480, 240, 120]; // p50 360: +20%
    expect(compareArms(control, treatment).verdict).toBe(Verdict.Worse);
  });

  test('a change smaller than minEffectPct is inconclusive', () => {
    const treatment = [525, 315, 420, 210, 105]; // p50 315: +5%
    expect(compareArms(control, treatment).verdict).toBe(Verdict.Inconclusive);
  });

  test('a change of exactly minEffectPct counts', () => {
    const treatment = [550, 330, 440, 220, 110]; // p50 330: exactly +10%
    expect(compareArms(control, treatment).verdict).toBe(Verdict.Worse);
  });

  test('too few runs in either arm is inconclusive, however big the change', () => {
    const big = [1500, 900, 1200, 600, 300]; // +200%
    expect(compareArms(control.slice(0, 4), big).verdict).toBe(Verdict.Inconclusive);
    expect(compareArms(control, big.slice(0, 4)).verdict).toBe(Verdict.Inconclusive);
  });

  test('custom rules are used instead of the defaults', () => {
    const treatment = [525, 315, 420, 210, 105]; // +5%
    expect(compareArms(control, treatment, { minRuns: 5, minEffectPct: 5 }).verdict).toBe(Verdict.Worse);
    expect(compareArms([300], [600], { minRuns: 1, minEffectPct: 10 }).verdict).toBe(Verdict.Worse);
    expect(DEFAULT_RULES).toEqual({ minRuns: 5, minEffectPct: 10 });
  });

  test('does not modify its inputs', () => {
    const c = [...control];
    const t = [3, 1, 2, 5, 4];
    compareArms(c, t);
    expect(c).toEqual(control);
    expect(t).toEqual([3, 1, 2, 5, 4]);
  });

  test('rejects an empty arm', () => {
    expect(() => compareArms([], control)).toThrow(RangeError);
    expect(() => compareArms(control, [])).toThrow(RangeError);
  });
});

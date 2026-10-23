import { test, expect } from '@playwright/test';
import { computeRebuffers, errorCodes, shakaCrossCheck, startHeight, type ShakaStats } from '../../src/collect';
import type { PlaybackEvent } from '../../src/types';

/** Shorthand for a video-element event at time t (ms). */
const ev = (type: PlaybackEvent['type'], t: number): PlaybackEvent => ({ type, source: 'video', t });

test.describe('computeRebuffers', () => {
  test('startup buffering before the first playing is not a rebuffer', () => {
    const events = [ev('waiting', 0), ev('playing', 500)];
    expect(computeRebuffers(events, 1000)).toEqual({ count: 0, totalMs: 0 });
  });

  test('waiting after playing, until the next playing, is one rebuffer', () => {
    const events = [ev('playing', 0), ev('waiting', 1000), ev('playing', 1400)];
    expect(computeRebuffers(events, 2000)).toEqual({ count: 1, totalMs: 400 });
  });

  test('repeated waiting during one stall counts once', () => {
    const events = [ev('playing', 0), ev('waiting', 1000), ev('waiting', 1100), ev('playing', 1500)];
    expect(computeRebuffers(events, 2000)).toEqual({ count: 1, totalMs: 500 });
  });

  test('two stalls are summed', () => {
    const events = [
      ev('playing', 0),
      ev('waiting', 1000), ev('playing', 1200),
      ev('waiting', 3000), ev('playing', 3300),
    ];
    expect(computeRebuffers(events, 4000)).toEqual({ count: 2, totalMs: 500 });
  });

  test('a stall still open at the end runs until endT', () => {
    const events = [ev('playing', 0), ev('waiting', 1000)];
    expect(computeRebuffers(events, 1750)).toEqual({ count: 1, totalMs: 750 });
  });

  test('events out of time order are sorted first', () => {
    const events = [ev('playing', 1200), ev('playing', 0), ev('waiting', 1000)];
    expect(computeRebuffers(events, 2000)).toEqual({ count: 1, totalMs: 200 });
  });
});

test('startHeight reads the first frame\'s height, if recorded', () => {
  expect(startHeight([ev('playing', 0), { type: 'first-frame', source: 'video', t: 1, detail: { height: 144 } }])).toBe(144);
  expect(startHeight([ev('first-frame', 1)])).toBeUndefined();
  expect(startHeight([])).toBeUndefined();
});

test('errorCodes formats source:code', () => {
  const events: PlaybackEvent[] = [
    { type: 'error', source: 'video', t: 1, detail: { code: 3 } },
    { type: 'error', source: 'shaka', t: 2, detail: { code: 3014 } },
    ev('playing', 3),
  ];
  expect(errorCodes(events)).toEqual(['video:3', 'shaka:3014']);
});

test('shakaCrossCheck ignores startup buffering for rebuffers but not for bufferingTime', () => {
  const stats = {
    timeToFirstFrame: 0.5,
    bufferingTime: 0.4,
    stallsDetected: 0,
    stateHistory: [
      { state: 'buffering', timestamp: 0, duration: 0.25 }, // startup
      { state: 'playing', timestamp: 0.25, duration: 15 },
      { state: 'buffering', timestamp: 15.25, duration: 0.15 }, // rebuffer
      { state: 'playing', timestamp: 15.4, duration: 5 },
    ],
  } as ShakaStats;
  const check = shakaCrossCheck(stats);
  expect(check.ttffMs).toBe(500);
  expect(check.rebufferCount).toBe(1);
  expect(check.rebufferMs).toBeCloseTo(150);
  expect(check.bufferingMs).toBeCloseTo(400);
});

test('shakaCrossCheck reports DRM timings only when DRM is in use', () => {
  const base = { timeToFirstFrame: 1, loadLatency: 1, bufferingTime: 0, stallsDetected: 0, stateHistory: [], currentCodecs: '', width: 0, height: 0 };
  const drm = shakaCrossCheck({ ...base, licenseTime: 1.2, drmTimeSeconds: 1.5 } as ShakaStats);
  expect(drm.licenseMs).toBeCloseTo(1200);
  expect(drm.drmMs).toBeCloseTo(1500);
  // Shaka reports NaN for "no DRM": that must not turn into a misleading 0.
  const clear = shakaCrossCheck({ ...base, licenseTime: NaN, drmTimeSeconds: NaN } as ShakaStats);
  expect(clear.licenseMs).toBeUndefined();
  expect(clear.drmMs).toBeUndefined();
});

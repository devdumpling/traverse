import { describe, test, expect } from 'bun:test';
import { calculateDiff, calculateAggregatedDiff, formatDiffPercent } from './diff.ts';
import type { AggregatedMetric } from '../types.ts';

describe('calculateDiff', () => {
  test('calculates positive diff (regression for lower-is-better)', () => {
    const diff = calculateDiff(100, 120);
    expect(diff.baseline).toBe(100);
    expect(diff.current).toBe(120);
    expect(diff.absoluteDiff).toBe(20);
    expect(diff.percentDiff).toBe(20);
    expect(diff.improved).toBe(false);
  });

  test('calculates negative diff (improvement for lower-is-better)', () => {
    const diff = calculateDiff(100, 80);
    expect(diff.baseline).toBe(100);
    expect(diff.current).toBe(80);
    expect(diff.absoluteDiff).toBe(-20);
    expect(diff.percentDiff).toBe(-20);
    expect(diff.improved).toBe(true);
  });

  test('handles higher-is-better direction', () => {
    const diff = calculateDiff(100, 120, 'higher-is-better');
    expect(diff.improved).toBe(true);

    const diff2 = calculateDiff(100, 80, 'higher-is-better');
    expect(diff2.improved).toBe(false);
  });

  test('handles zero baseline', () => {
    const diff = calculateDiff(0, 100);
    expect(diff.percentDiff).toBe(100);

    const diff2 = calculateDiff(0, 0);
    expect(diff2.percentDiff).toBe(0);
  });

  test('handles identical values', () => {
    const diff = calculateDiff(100, 100);
    expect(diff.absoluteDiff).toBe(0);
    expect(diff.percentDiff).toBe(0);
  });
});

describe('calculateAggregatedDiff', () => {
  const makeMetric = (median: number, p75: number, p95: number): AggregatedMetric => ({
    median,
    p75,
    p95,
    min: median * 0.8,
    max: p95 * 1.2,
    variance: 10,
    values: [median],
  });

  test('calculates diffs for all percentiles', () => {
    const baseline = makeMetric(100, 120, 150);
    const current = makeMetric(90, 110, 140);
    
    const diff = calculateAggregatedDiff(baseline, current);
    
    expect(diff.median.absoluteDiff).toBe(-10);
    expect(diff.p75.absoluteDiff).toBe(-10);
    expect(diff.p95.absoluteDiff).toBe(-10);
  });
});

describe('formatDiffPercent', () => {
  test('formats positive diff with plus sign', () => {
    const diff = calculateDiff(100, 120);
    expect(formatDiffPercent(diff)).toBe('+20.0%');
  });

  test('formats negative diff without plus sign', () => {
    const diff = calculateDiff(100, 80);
    expect(formatDiffPercent(diff)).toBe('-20.0%');
  });

  test('formats zero diff', () => {
    const diff = calculateDiff(100, 100);
    expect(formatDiffPercent(diff)).toBe('+0.0%');
  });
});

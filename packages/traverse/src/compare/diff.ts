/**
 * Diff calculation utilities.
 * 
 * Calculates absolute and percentage differences between metrics.
 */

import type { AggregatedMetric } from '../types.ts';

export interface MetricDiff {
  readonly baseline: number;
  readonly current: number;
  readonly absoluteDiff: number;
  readonly percentDiff: number;
  readonly improved: boolean;
}

export interface AggregatedMetricDiff {
  readonly median: MetricDiff;
  readonly p75: MetricDiff;
  readonly p95: MetricDiff;
}

export type Direction = 'lower-is-better' | 'higher-is-better';

export const calculateDiff = (
  baseline: number,
  current: number,
  direction: Direction = 'lower-is-better'
): MetricDiff => {
  const absoluteDiff = current - baseline;
  const percentDiff = baseline === 0 ? (current === 0 ? 0 : 100) : (absoluteDiff / baseline) * 100;
  const improved = direction === 'lower-is-better' 
    ? absoluteDiff < 0 
    : absoluteDiff > 0;

  return {
    baseline,
    current,
    absoluteDiff,
    percentDiff,
    improved,
  };
};

export const calculateAggregatedDiff = (
  baseline: AggregatedMetric,
  current: AggregatedMetric,
  direction: Direction = 'lower-is-better'
): AggregatedMetricDiff => ({
  median: calculateDiff(baseline.median, current.median, direction),
  p75: calculateDiff(baseline.p75, current.p75, direction),
  p95: calculateDiff(baseline.p95, current.p95, direction),
});

export const calculateNullableDiff = (
  baseline: AggregatedMetric | null,
  current: AggregatedMetric | null,
  direction: Direction = 'lower-is-better'
): AggregatedMetricDiff | null => {
  if (baseline === null || current === null) return null;
  return calculateAggregatedDiff(baseline, current, direction);
};

// Formatting helpers
export const formatDiffPercent = (diff: MetricDiff): string => {
  const sign = diff.percentDiff >= 0 ? '+' : '';
  return `${sign}${diff.percentDiff.toFixed(1)}%`;
};

export const formatDiffAbsolute = (diff: MetricDiff, unit: string = ''): string => {
  const sign = diff.absoluteDiff >= 0 ? '+' : '';
  return `${sign}${diff.absoluteDiff.toFixed(1)}${unit}`;
};

export const formatDiffIndicator = (diff: MetricDiff): string => {
  if (Math.abs(diff.percentDiff) < 1) return '~';
  return diff.improved ? 'v' : '^';
};

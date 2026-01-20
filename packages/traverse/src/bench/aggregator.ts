/**
 * Statistical aggregation for benchmark runs.
 */

import type { AggregatedMetric } from '../types.ts';

const sortNumbers = (values: readonly number[]): number[] =>
  [...values].sort((a, b) => a - b);

const percentile = (sorted: readonly number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, index)] ?? 0;
};

const median = (sorted: readonly number[]): number =>
  percentile(sorted, 50);

const variance = (values: readonly number[]): number => {
  if (values.length < 2) return 0;
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length;
};

export const aggregate = (values: readonly number[]): AggregatedMetric => {
  const sorted = sortNumbers(values);
  return {
    median: median(sorted),
    p75: percentile(sorted, 75),
    p95: percentile(sorted, 95),
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    variance: variance(values),
    values,
  };
};

export const aggregateNullable = (
  values: readonly (number | null)[]
): AggregatedMetric | null => {
  const nonNull = values.filter((v): v is number => v !== null);
  if (nonNull.length === 0) return null;
  return aggregate(nonNull);
};

/**
 * Compare module exports.
 */

export {
  compare,
  loadCapture,
  type CaptureFile,
  type CaptureType,
  type ComparisonResult,
  type BenchmarkComparison,
  type StaticComparison,
  type CompareError,
  type LoadError,
} from './engine.ts';

export {
  calculateDiff,
  calculateAggregatedDiff,
  calculateNullableDiff,
  formatDiffPercent,
  formatDiffAbsolute,
  formatDiffIndicator,
  type MetricDiff,
  type AggregatedMetricDiff,
  type Direction,
} from './diff.ts';

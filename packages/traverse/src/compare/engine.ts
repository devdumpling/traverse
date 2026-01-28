/**
 * Comparison engine.
 *
 * Loads and compares capture files, producing structured diffs.
 */

import { readFile, access } from 'node:fs/promises';
import type {
  Result,
  RuntimeBenchmark,
  JourneyResult,
  StaticAnalysis,
  AggregatedMetric,
} from '../types.ts';
import { ok, err, fromPromise } from '../result.ts';
import {
  calculateAggregatedDiff,
  calculateNullableDiff,
  type AggregatedMetricDiff,
  type Direction,
} from './diff.ts';

// =============================================================================
// Capture Types Detection
// =============================================================================

export type CaptureType = 'benchmark' | 'journey' | 'static';

export interface CaptureFile {
  readonly path: string;
  readonly label: string;
  readonly type: CaptureType;
  readonly data: RuntimeBenchmark | JourneyResult | StaticAnalysis;
}

const detectCaptureType = (data: unknown): CaptureType | null => {
  if (typeof data !== 'object' || data === null) return null;

  const obj = data as Record<string, unknown>;

  // Benchmark has meta.url
  if ('meta' in obj && typeof obj['meta'] === 'object' && obj['meta'] !== null) {
    const meta = obj['meta'] as Record<string, unknown>;
    if ('url' in meta && 'runs' in meta && 'cwv' in obj) {
      return 'benchmark';
    }
    if ('name' in meta && 'baseUrl' in meta && 'steps' in obj) {
      return 'journey';
    }
    if ('framework' in meta && 'bundles' in obj) {
      return 'static';
    }
  }

  return null;
};

export interface LoadError {
  readonly code: 'FILE_NOT_FOUND' | 'INVALID_JSON' | 'UNKNOWN_FORMAT';
  readonly message: string;
  readonly path: string;
}

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const loadCapture = async (
  path: string,
  label?: string
): Promise<Result<CaptureFile, LoadError>> => {
  const exists = await fileExists(path);

  if (!exists) {
    return err({
      code: 'FILE_NOT_FOUND',
      message: `File not found: ${path}`,
      path,
    });
  }

  const textResult = await fromPromise(
    readFile(path, 'utf-8'),
    (): LoadError => ({
      code: 'INVALID_JSON',
      message: `Failed to read file: ${path}`,
      path,
    })
  );

  if (!textResult.ok) return textResult;

  let data: unknown;
  try {
    data = JSON.parse(textResult.value);
  } catch {
    return err({
      code: 'INVALID_JSON',
      message: `Invalid JSON in file: ${path}`,
      path,
    });
  }

  const type = detectCaptureType(data);
  if (type === null) {
    return err({
      code: 'UNKNOWN_FORMAT',
      message: `Unknown capture format in file: ${path}`,
      path,
    });
  }

  return ok({
    path,
    label: label ?? path.split('/').pop() ?? path,
    type,
    data: data as RuntimeBenchmark | JourneyResult | StaticAnalysis,
  });
};

// =============================================================================
// Benchmark Comparison
// =============================================================================

export interface BenchmarkComparison {
  readonly type: 'benchmark';
  readonly baseline: CaptureFile;
  readonly current: CaptureFile;
  readonly cwv: {
    readonly lcp: AggregatedMetricDiff;
    readonly fcp: AggregatedMetricDiff;
    readonly cls: AggregatedMetricDiff;
    readonly ttfb: AggregatedMetricDiff;
  };
  readonly extended: {
    readonly tbt: AggregatedMetricDiff;
    readonly domContentLoaded: AggregatedMetricDiff;
    readonly load: AggregatedMetricDiff;
  };
  readonly resources: {
    readonly totalTransfer: AggregatedMetricDiff;
    readonly totalCount: AggregatedMetricDiff;
  };
  readonly javascript: {
    readonly heapSize: AggregatedMetricDiff;
    readonly longTasks: AggregatedMetricDiff;
  };
  readonly ssr: {
    readonly hasContent: AggregatedMetricDiff;
    readonly inlineScriptSize: AggregatedMetricDiff;
    readonly hydrationPayloadSize: AggregatedMetricDiff;
    readonly rscPayloadSize: AggregatedMetricDiff | null;
  };
}

const compareBenchmarks = (
  baseline: CaptureFile,
  current: CaptureFile
): BenchmarkComparison => {
  const b = baseline.data as RuntimeBenchmark;
  const c = current.data as RuntimeBenchmark;

  return {
    type: 'benchmark',
    baseline,
    current,
    cwv: {
      lcp: calculateAggregatedDiff(b.cwv.lcp, c.cwv.lcp),
      fcp: calculateAggregatedDiff(b.cwv.fcp, c.cwv.fcp),
      cls: calculateAggregatedDiff(b.cwv.cls, c.cwv.cls),
      ttfb: calculateAggregatedDiff(b.cwv.ttfb, c.cwv.ttfb),
    },
    extended: {
      tbt: calculateAggregatedDiff(b.extended.tbt, c.extended.tbt),
      domContentLoaded: calculateAggregatedDiff(b.extended.domContentLoaded, c.extended.domContentLoaded),
      load: calculateAggregatedDiff(b.extended.load, c.extended.load),
    },
    resources: {
      totalTransfer: calculateAggregatedDiff(b.resources.totalTransfer, c.resources.totalTransfer),
      totalCount: calculateAggregatedDiff(b.resources.totalCount, c.resources.totalCount),
    },
    javascript: {
      heapSize: calculateAggregatedDiff(b.javascript.heapSize, c.javascript.heapSize),
      longTasks: calculateAggregatedDiff(b.javascript.longTasks, c.javascript.longTasks),
    },
    ssr: {
      hasContent: calculateAggregatedDiff(b.ssr.hasContent, c.ssr.hasContent, 'higher-is-better'),
      inlineScriptSize: calculateAggregatedDiff(b.ssr.inlineScriptSize, c.ssr.inlineScriptSize),
      hydrationPayloadSize: calculateAggregatedDiff(b.ssr.hydrationPayloadSize, c.ssr.hydrationPayloadSize),
      rscPayloadSize: calculateNullableDiff(b.ssr.rscPayloadSize, c.ssr.rscPayloadSize),
    },
  };
};

// =============================================================================
// Static Analysis Comparison
// =============================================================================

export interface StaticComparison {
  readonly type: 'static';
  readonly baseline: CaptureFile;
  readonly current: CaptureFile;
  readonly bundles: {
    readonly totalRaw: { baseline: number; current: number; diff: number; percent: number };
    readonly totalGzip: { baseline: number; current: number; diff: number; percent: number };
    readonly jsRaw: { baseline: number; current: number; diff: number; percent: number };
    readonly jsGzip: { baseline: number; current: number; diff: number; percent: number };
    readonly cssRaw: { baseline: number; current: number; diff: number; percent: number };
    readonly cssGzip: { baseline: number; current: number; diff: number; percent: number };
  };
  readonly routes: {
    readonly baselineCount: number;
    readonly currentCount: number;
  };
}

const compareStatic = (
  baseline: CaptureFile,
  current: CaptureFile
): StaticComparison => {
  const b = baseline.data as StaticAnalysis;
  const c = current.data as StaticAnalysis;

  const calcBundleDiff = (bVal: number, cVal: number) => ({
    baseline: bVal,
    current: cVal,
    diff: cVal - bVal,
    percent: bVal === 0 ? (cVal === 0 ? 0 : 100) : ((cVal - bVal) / bVal) * 100,
  });

  return {
    type: 'static',
    baseline,
    current,
    bundles: {
      totalRaw: calcBundleDiff(b.bundles.total.raw, c.bundles.total.raw),
      totalGzip: calcBundleDiff(b.bundles.total.gzip, c.bundles.total.gzip),
      jsRaw: calcBundleDiff(b.bundles.javascript.raw, c.bundles.javascript.raw),
      jsGzip: calcBundleDiff(b.bundles.javascript.gzip, c.bundles.javascript.gzip),
      cssRaw: calcBundleDiff(b.bundles.css.raw, c.bundles.css.raw),
      cssGzip: calcBundleDiff(b.bundles.css.gzip, c.bundles.css.gzip),
    },
    routes: {
      baselineCount: b.routes.length,
      currentCount: c.routes.length,
    },
  };
};

// =============================================================================
// Comparison Result
// =============================================================================

export type ComparisonResult = BenchmarkComparison | StaticComparison;

export interface CompareError {
  readonly code: 'TYPE_MISMATCH' | 'LOAD_ERROR';
  readonly message: string;
}

export const compare = async (
  baselinePath: string,
  currentPath: string,
  baselineLabel?: string,
  currentLabel?: string
): Promise<Result<ComparisonResult, CompareError>> => {
  const baselineResult = await loadCapture(baselinePath, baselineLabel);
  if (!baselineResult.ok) {
    return err({
      code: 'LOAD_ERROR',
      message: baselineResult.error.message,
    });
  }

  const currentResult = await loadCapture(currentPath, currentLabel);
  if (!currentResult.ok) {
    return err({
      code: 'LOAD_ERROR',
      message: currentResult.error.message,
    });
  }

  const baseline = baselineResult.value;
  const current = currentResult.value;

  if (baseline.type !== current.type) {
    return err({
      code: 'TYPE_MISMATCH',
      message: `Cannot compare ${baseline.type} with ${current.type}`,
    });
  }

  if (baseline.type === 'benchmark' && current.type === 'benchmark') {
    return ok(compareBenchmarks(baseline, current));
  }

  if (baseline.type === 'static' && current.type === 'static') {
    return ok(compareStatic(baseline, current));
  }

  // Journey comparison - TODO
  return err({
    code: 'TYPE_MISMATCH',
    message: 'Journey comparison not yet implemented',
  });
};

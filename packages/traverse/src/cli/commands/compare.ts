/**
 * Compare command implementation.
 */

import type { CompareCommand, RuntimeBenchmark, StaticAnalysis } from '../../types.ts';
import {
  compare,
  formatDiffPercent,
  type BenchmarkComparison,
  type StaticComparison,
  type ComparisonResult,
  type AggregatedMetricDiff,
} from '../../compare/index.ts';
import { formatTable, formatBytes, formatMs } from '../format.ts';

const formatDiff = (diff: AggregatedMetricDiff, formatter: (n: number) => string): string => {
  const sign = diff.median.absoluteDiff >= 0 ? '+' : '-';
  const percentSign = diff.median.percentDiff >= 0 ? '+' : '';
  const indicator = Math.abs(diff.median.percentDiff) < 1 
    ? '~' 
    : diff.median.improved ? '++' : '--';
  return `${sign}${formatter(Math.abs(diff.median.absoluteDiff))} (${percentSign}${diff.median.percentDiff.toFixed(1)}%) ${indicator}`;
};

const formatBenchmarkComparison = (result: BenchmarkComparison): string => {
  const b = result.baseline.data as RuntimeBenchmark;
  const c = result.current.data as RuntimeBenchmark;

  const rows: string[][] = [
    ['LCP', formatMs(b.cwv.lcp.median), formatMs(c.cwv.lcp.median), formatDiff(result.cwv.lcp, formatMs)],
    ['FCP', formatMs(b.cwv.fcp.median), formatMs(c.cwv.fcp.median), formatDiff(result.cwv.fcp, formatMs)],
    ['CLS', b.cwv.cls.median.toFixed(3), c.cwv.cls.median.toFixed(3), formatDiff(result.cwv.cls, n => n.toFixed(3))],
    ['TTFB', formatMs(b.cwv.ttfb.median), formatMs(c.cwv.ttfb.median), formatDiff(result.cwv.ttfb, formatMs)],
    ['TBT', formatMs(b.extended.tbt.median), formatMs(c.extended.tbt.median), formatDiff(result.extended.tbt, formatMs)],
    ['DOM Load', formatMs(b.extended.domContentLoaded.median), formatMs(c.extended.domContentLoaded.median), formatDiff(result.extended.domContentLoaded, formatMs)],
    ['Load', formatMs(b.extended.load.median), formatMs(c.extended.load.median), formatDiff(result.extended.load, formatMs)],
    ['Transfer', formatBytes(b.resources.totalTransfer.median), formatBytes(c.resources.totalTransfer.median), formatDiff(result.resources.totalTransfer, formatBytes)],
    ['Requests', b.resources.totalCount.median.toFixed(0), c.resources.totalCount.median.toFixed(0), formatDiff(result.resources.totalCount, n => n.toFixed(0))],
    ['Heap', formatBytes(b.javascript.heapSize.median), formatBytes(c.javascript.heapSize.median), formatDiff(result.javascript.heapSize, formatBytes)],
    ['Long Tasks', b.javascript.longTasks.median.toFixed(0), c.javascript.longTasks.median.toFixed(0), formatDiff(result.javascript.longTasks, n => n.toFixed(0))],
  ];

  // Add SSR rows if relevant
  const hasSSR = b.ssr.hydrationPayloadSize.median > 0 || c.ssr.hydrationPayloadSize.median > 0;
  if (hasSSR) {
    rows.push(
      ['Inline Scripts', formatBytes(b.ssr.inlineScriptSize.median), formatBytes(c.ssr.inlineScriptSize.median), formatDiff(result.ssr.inlineScriptSize, formatBytes)],
      ['Hydration', formatBytes(b.ssr.hydrationPayloadSize.median), formatBytes(c.ssr.hydrationPayloadSize.median), formatDiff(result.ssr.hydrationPayloadSize, formatBytes)],
    );
    if (result.ssr.rscPayloadSize) {
      rows.push(['RSC Payload', formatBytes(b.ssr.rscPayloadSize?.median ?? 0), formatBytes(c.ssr.rscPayloadSize?.median ?? 0), formatDiff(result.ssr.rscPayloadSize, formatBytes)]);
    }
  }

  const table = formatTable(['Metric', 'Baseline', 'Current', 'Change'], rows);

  return `# Benchmark Comparison

**Baseline:** ${result.baseline.label}  
**Current:** ${result.current.label}  

## Metrics Comparison

${table}

### Legend
- **++** = Improved (lower is better for timing/size metrics)
- **--** = Regressed  
- **~** = No significant change (<1%)
`;
};

const formatStaticComparison = (result: StaticComparison): string => {
  const formatBundleChange = (
    data: { baseline: number; current: number; diff: number; percent: number }
  ): string => {
    const sign = data.diff >= 0 ? '+' : '';
    const indicator = Math.abs(data.percent) < 1 ? '~' : data.diff < 0 ? '++' : '--';
    return `${sign}${formatBytes(Math.abs(data.diff))} (${sign}${data.percent.toFixed(1)}%) ${indicator}`;
  };

  const bundleRows: string[][] = [
    ['Total (raw)', formatBytes(result.bundles.totalRaw.baseline), formatBytes(result.bundles.totalRaw.current), formatBundleChange(result.bundles.totalRaw)],
    ['Total (gzip)', formatBytes(result.bundles.totalGzip.baseline), formatBytes(result.bundles.totalGzip.current), formatBundleChange(result.bundles.totalGzip)],
    ['JS (raw)', formatBytes(result.bundles.jsRaw.baseline), formatBytes(result.bundles.jsRaw.current), formatBundleChange(result.bundles.jsRaw)],
    ['JS (gzip)', formatBytes(result.bundles.jsGzip.baseline), formatBytes(result.bundles.jsGzip.current), formatBundleChange(result.bundles.jsGzip)],
    ['CSS (raw)', formatBytes(result.bundles.cssRaw.baseline), formatBytes(result.bundles.cssRaw.current), formatBundleChange(result.bundles.cssRaw)],
    ['CSS (gzip)', formatBytes(result.bundles.cssGzip.baseline), formatBytes(result.bundles.cssGzip.current), formatBundleChange(result.bundles.cssGzip)],
  ];

  const bundleTable = formatTable(['Metric', 'Baseline', 'Current', 'Change'], bundleRows);

  const routesTable = formatTable(
    ['', 'Baseline', 'Current'],
    [['Route Count', String(result.routes.baselineCount), String(result.routes.currentCount)]]
  );

  return `# Static Analysis Comparison

**Baseline:** ${result.baseline.label}  
**Current:** ${result.current.label}  

## Bundle Size Comparison

${bundleTable}

## Routes

${routesTable}

### Legend
- **++** = Improved (smaller size)
- **--** = Regressed (larger size)
- **~** = No significant change (<1%)
`;
};

const formatComparison = (
  result: ComparisonResult,
  format: 'json' | 'markdown' | 'html'
): string => {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  if (format === 'markdown') {
    if (result.type === 'benchmark') {
      return formatBenchmarkComparison(result);
    }
    if (result.type === 'static') {
      return formatStaticComparison(result);
    }
  }

  // HTML - simple for now
  if (format === 'html') {
    const md = format === 'html' 
      ? (result.type === 'benchmark' ? formatBenchmarkComparison(result) : formatStaticComparison(result))
      : '';
    return `<!DOCTYPE html>
<html>
<head>
  <title>Traverse Comparison</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .improved { color: green; }
    .regressed { color: red; }
  </style>
</head>
<body>
  <pre>${md}</pre>
</body>
</html>`;
  }

  return 'Unknown format';
};

export const executeCompare = async (command: CompareCommand): Promise<number> => {
  console.error(`Comparing captures...`);
  console.error(`  Baseline: ${command.baseline}`);
  console.error(`  Current: ${command.current}`);
  console.error();

  const result = await compare(command.baseline, command.current);

  if (!result.ok) {
    console.error(`Comparison failed: ${result.error.message}`);
    return 1;
  }

  const output = formatComparison(result.value, command.format);

  if (command.output) {
    await Bun.write(command.output, output);
    console.error(`Results written to ${command.output}`);
  } else {
    console.log(output);
  }

  return 0;
};

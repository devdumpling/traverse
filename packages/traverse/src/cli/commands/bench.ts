/**
 * Bench command implementation.
 */

import type { BenchCommand, RuntimeBenchmark, ResourceType } from '../../types.ts';
import { runBenchmark } from '../../bench/index.ts';
import { getDeviceConfig, getNetworkConfig } from '../../config/index.ts';

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatMs = (ms: number): string => `${ms.toFixed(0)}ms`;

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  script: 'JavaScript',
  stylesheet: 'CSS',
  image: 'Images',
  font: 'Fonts',
  fetch: 'Fetch/XHR',
  document: 'Document',
  other: 'Other',
};

const formatResourcesByType = (result: RuntimeBenchmark): string => {
  const types = Object.entries(result.resources.byType) as [ResourceType, NonNullable<typeof result.resources.byType[ResourceType]>][];
  
  if (types.length === 0) return '';

  const rows = types
    .sort(([, a], [, b]) => b.transferSize.median - a.transferSize.median)
    .map(([type, metrics]) => 
      `| ${RESOURCE_TYPE_LABELS[type]} | ${metrics.count.median.toFixed(0)} | ${formatBytes(metrics.transferSize.median)} | ${formatBytes(metrics.decodedSize.median)} |`
    )
    .join('\n');

  return `## Resources by Type

| Type | Count | Transfer | Decoded |
|------|-------|----------|---------|
${rows}

`;
};

const formatOutput = (result: RuntimeBenchmark, format: 'json' | 'markdown' | 'html'): string => {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  if (format === 'markdown') {
    const ssrSection = result.ssr.hydrationFramework 
      ? `## SSR & Hydration

| Metric | Median |
|--------|--------|
| Framework | ${result.ssr.hydrationFramework} |
| Has SSR Content | ${result.ssr.hasContent.median > 0.5 ? 'Yes' : 'No'} |
| Inline Script Size | ${formatBytes(result.ssr.inlineScriptSize.median)} |
| Inline Script Count | ${result.ssr.inlineScriptCount.median.toFixed(0)} |
| Hydration Payload | ${formatBytes(result.ssr.hydrationPayloadSize.median)} |
${result.ssr.rscPayloadSize ? `| RSC Payload | ${formatBytes(result.ssr.rscPayloadSize.median)} |` : ''}
${result.ssr.nextDataSize ? `| __NEXT_DATA__ Size | ${formatBytes(result.ssr.nextDataSize.median)} |` : ''}
${result.ssr.reactRouterDataSize ? `| React Router Data | ${formatBytes(result.ssr.reactRouterDataSize.median)} |` : ''}

`
      : '';

    return `# Benchmark Results

**URL:** ${result.meta.url}  
**Captured:** ${result.meta.capturedAt}  
**Runs:** ${result.meta.runs}  

## Core Web Vitals

| Metric | Median | P75 | P95 |
|--------|--------|-----|-----|
| LCP | ${formatMs(result.cwv.lcp.median)} | ${formatMs(result.cwv.lcp.p75)} | ${formatMs(result.cwv.lcp.p95)} |
| FCP | ${formatMs(result.cwv.fcp.median)} | ${formatMs(result.cwv.fcp.p75)} | ${formatMs(result.cwv.fcp.p95)} |
| CLS | ${result.cwv.cls.median.toFixed(3)} | ${result.cwv.cls.p75.toFixed(3)} | ${result.cwv.cls.p95.toFixed(3)} |
| TTFB | ${formatMs(result.cwv.ttfb.median)} | ${formatMs(result.cwv.ttfb.p75)} | ${formatMs(result.cwv.ttfb.p95)} |

## Resources

| Metric | Median |
|--------|--------|
| Total Transfer | ${formatBytes(result.resources.totalTransfer.median)} |
| Resource Count | ${result.resources.totalCount.median.toFixed(0)} |

${formatResourcesByType(result)}## Timing & Blocking

| Metric | Median |
|--------|--------|
| DOM Content Loaded | ${formatMs(result.extended.domContentLoaded.median)} |
| Load | ${formatMs(result.extended.load.median)} |
| Total Blocking Time | ${formatMs(result.extended.tbt.median)} |
| Long Tasks | ${result.javascript.longTasks.median.toFixed(0)} |
| Heap Size | ${formatBytes(result.javascript.heapSize.median)} |

${ssrSection}`;
  }

  // HTML format - simple for now
  return `<!DOCTYPE html>
<html>
<head>
  <title>Benchmark: ${result.meta.url}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
  <h1>Benchmark Results</h1>
  <p><strong>URL:</strong> ${result.meta.url}</p>
  <p><strong>Captured:</strong> ${result.meta.capturedAt}</p>
  <p><strong>Runs:</strong> ${result.meta.runs}</p>
  
  <h2>Core Web Vitals</h2>
  <table>
    <tr><th>Metric</th><th>Median</th><th>P75</th><th>P95</th></tr>
    <tr><td>LCP</td><td>${formatMs(result.cwv.lcp.median)}</td><td>${formatMs(result.cwv.lcp.p75)}</td><td>${formatMs(result.cwv.lcp.p95)}</td></tr>
    <tr><td>FCP</td><td>${formatMs(result.cwv.fcp.median)}</td><td>${formatMs(result.cwv.fcp.p75)}</td><td>${formatMs(result.cwv.fcp.p95)}</td></tr>
    <tr><td>CLS</td><td>${result.cwv.cls.median.toFixed(3)}</td><td>${result.cwv.cls.p75.toFixed(3)}</td><td>${result.cwv.cls.p95.toFixed(3)}</td></tr>
    <tr><td>TTFB</td><td>${formatMs(result.cwv.ttfb.median)}</td><td>${formatMs(result.cwv.ttfb.p75)}</td><td>${formatMs(result.cwv.ttfb.p95)}</td></tr>
  </table>
</body>
</html>`;
};

export const executeBench = async (command: BenchCommand): Promise<number> => {
  const device = getDeviceConfig(command.device);
  if (!device) {
    console.error(`Unknown device preset: ${command.device}`);
    return 1;
  }

  const network = command.network ? getNetworkConfig(command.network) : null;
  if (command.network && !network) {
    console.error(`Unknown network preset: ${command.network}`);
    return 1;
  }

  // Status messages go to stderr so stdout is clean for output
  console.error(`Benchmarking ${command.url}...`);
  console.error(`  Runs: ${command.runs}`);
  console.error(`  Device: ${command.device}`);
  console.error(`  Network: ${command.network ?? 'none'}`);
  console.error();

  const result = await runBenchmark({
    url: command.url,
    runs: command.runs,
    device,
    network,
  });

  if (!result.ok) {
    console.error(`Benchmark failed: ${result.error.message}`);
    return 1;
  }

  const output = formatOutput(result.value, command.format);

  if (command.output) {
    await Bun.write(command.output, output);
    console.error(`Results written to ${command.output}`);
  } else {
    console.log(output);
  }

  return 0;
};

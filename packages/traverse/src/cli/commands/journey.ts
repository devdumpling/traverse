/**
 * Journey command implementation.
 */

import type { JourneyCommand, JourneyResult } from '../../types.ts';
import { runJourney, loadJourney } from '../../journey/index.ts';
import { getDeviceConfig } from '../../config/index.ts';

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatMs = (ms: number): string => `${ms.toFixed(0)}ms`;

const formatOutput = (result: JourneyResult, format: 'json' | 'markdown' | 'html'): string => {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  if (format === 'markdown') {
    let md = `# Journey: ${result.meta.name}

${result.meta.description}

**Base URL:** ${result.meta.baseUrl}  
**Captured:** ${result.meta.capturedAt}  
**Runs:** ${result.meta.runs}  

## Steps

| Step | Duration | Nav Type | LCP | CLS | Resources |
|------|----------|----------|-----|-----|-----------|
`;

    for (const step of result.steps) {
      const lcp = step.cwv.lcp ? formatMs(step.cwv.lcp.median) : '-';
      const cls = step.cwv.cls.median.toFixed(3);
      const resources = step.resources.loaded.median.toFixed(0);
      md += `| ${step.name} | ${formatMs(step.navigation.duration.median)} | ${step.navigation.type} | ${lcp} | ${cls} | ${resources} |\n`;
    }

    md += `
## Cumulative Metrics

| Metric | Value |
|--------|-------|
| Total Duration | ${formatMs(result.cumulative.totalDuration.median)} |
| Total Transferred | ${formatBytes(result.cumulative.totalTransferred.median)} |
| Cache Hit Rate | ${result.cumulative.cacheHitRate.median.toFixed(1)}% |
| Memory High Water | ${formatBytes(result.cumulative.memoryHighWater.median)} |
| Total CLS | ${result.cumulative.totalCls.median.toFixed(3)} |
`;

    return md;
  }

  // HTML format
  return `<!DOCTYPE html>
<html>
<head>
  <title>Journey: ${result.meta.name}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 900px; margin: 2rem auto; padding: 0 1rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .step { margin: 1rem 0; padding: 1rem; border: 1px solid #eee; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Journey: ${result.meta.name}</h1>
  <p>${result.meta.description}</p>
  <p><strong>Base URL:</strong> ${result.meta.baseUrl}</p>
  <p><strong>Runs:</strong> ${result.meta.runs}</p>
  
  <h2>Steps</h2>
  <table>
    <tr><th>Step</th><th>Duration</th><th>Nav Type</th><th>LCP</th><th>CLS</th><th>Resources</th></tr>
    ${result.steps.map((step) => `
    <tr>
      <td>${step.name}</td>
      <td>${formatMs(step.navigation.duration.median)}</td>
      <td>${step.navigation.type}</td>
      <td>${step.cwv.lcp ? formatMs(step.cwv.lcp.median) : '-'}</td>
      <td>${step.cwv.cls.median.toFixed(3)}</td>
      <td>${step.resources.loaded.median.toFixed(0)}</td>
    </tr>
    `).join('')}
  </table>

  <h2>Cumulative Metrics</h2>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Total Duration</td><td>${formatMs(result.cumulative.totalDuration.median)}</td></tr>
    <tr><td>Total Transferred</td><td>${formatBytes(result.cumulative.totalTransferred.median)}</td></tr>
    <tr><td>Cache Hit Rate</td><td>${result.cumulative.cacheHitRate.median.toFixed(1)}%</td></tr>
  </table>
</body>
</html>`;
};

export const executeJourney = async (command: JourneyCommand): Promise<number> => {
  const device = getDeviceConfig(command.device);
  if (!device) {
    console.error(`Unknown device preset: ${command.device}`);
    return 1;
  }

  // Status messages go to stderr so stdout is clean for output
  console.error(`Loading journey: ${command.journeyFile}...`);
  
  const loadResult = await loadJourney(command.journeyFile);
  if (!loadResult.ok) {
    console.error(`Failed to load journey: ${loadResult.error.message}`);
    return 1;
  }

  const journey = loadResult.value;
  
  console.error(`Running journey: ${journey.name}`);
  console.error(`  Description: ${journey.description}`);
  console.error(`  Base URL: ${command.baseUrl}`);
  console.error(`  Runs: ${command.runs}`);
  console.error();

  const result = await runJourney({
    journey,
    baseUrl: command.baseUrl,
    runs: command.runs,
    device,
  });

  if (!result.ok) {
    console.error(`Journey failed: ${result.error.message}`);
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

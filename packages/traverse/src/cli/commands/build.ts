/**
 * Build command implementation.
 * Measures cold build time for a project.
 */

import type { BuildCommand } from '../../types.ts';
import { measureColdBuild, formatBuildTime, type BuildMetrics } from '../../dx/index.ts';

const formatOutput = (
  result: BuildMetrics,
  format: 'json' | 'markdown' | 'html'
): string => {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  if (format === 'markdown') {
    return `# Build Metrics

| Metric | Value |
|--------|-------|
| Cold Build Time | ${formatBuildTime(result.coldBuildTime)} |
| Command | \`${result.command}\` |
| Cache Cleared | ${result.cacheCleared ? 'Yes' : 'No'} |
| Exit Code | ${result.exitCode} |
`;
  }

  // HTML format
  return `<!DOCTYPE html>
<html>
<head>
  <title>Build Metrics</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 2rem auto; padding: 0 1rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .time { font-size: 2rem; font-weight: bold; color: #333; }
  </style>
</head>
<body>
  <h1>Build Metrics</h1>
  <p class="time">${formatBuildTime(result.coldBuildTime)}</p>
  <table>
    <tr><th>Metric</th><th>Value</th></tr>
    <tr><td>Command</td><td><code>${result.command}</code></td></tr>
    <tr><td>Cache Cleared</td><td>${result.cacheCleared ? 'Yes' : 'No'}</td></tr>
    <tr><td>Exit Code</td><td>${result.exitCode}</td></tr>
  </table>
</body>
</html>`;
};

export const executeBuild = async (command: BuildCommand): Promise<number> => {
  const { resolve } = await import('path');
  const projectDir = resolve(process.cwd(), command.projectDir);

  console.error(`Measuring build time for ${projectDir}...`);
  if (command.buildCmd) {
    console.error(`  Command: ${command.buildCmd}`);
  }
  console.error(`  Clear cache: ${command.clearCache ? 'yes' : 'no'}`);
  console.error();

  const result = await measureColdBuild({
    projectDir,
    buildCommand: command.buildCmd ?? undefined,
    clearCache: command.clearCache,
  });

  if (!result.ok) {
    console.error(`Build measurement failed: ${result.error.message}`);
    if (result.error.exitCode !== undefined) {
      console.error(`  Exit code: ${result.error.exitCode}`);
    }
    return 1;
  }

  console.error(`Build completed in ${formatBuildTime(result.value.coldBuildTime)}`);
  console.error();

  const output = formatOutput(result.value, command.format);

  if (command.output) {
    await Bun.write(command.output, output);
    console.error(`Results written to ${command.output}`);
  } else {
    console.log(output);
  }

  return 0;
};

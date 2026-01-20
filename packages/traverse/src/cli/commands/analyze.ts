/**
 * Analyze command implementation.
 * Static analysis of build outputs.
 */

import type { AnalyzeCommand, StaticAnalysis } from '../../types.ts';
import { analyze, formatByteSize } from '../../analyze/index.ts';

const formatOutput = (
  result: StaticAnalysis,
  format: 'json' | 'markdown' | 'html'
): string => {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  if (format === 'markdown') {
    const { meta, bundles, routes, frameworkSpecific } = result;
    
    let md = `# Static Analysis

**Framework:** ${meta.framework}${meta.frameworkVersion ? ` v${meta.frameworkVersion}` : ''}  
**Analyzed:** ${meta.analyzedAt}  
**Source:** ${meta.sourceDir}  
**Build:** ${meta.buildDir}  

## Bundle Sizes

| Type | Raw | Gzip | Brotli |
|------|-----|------|--------|
| **Total** | ${formatByteSize(bundles.total.raw)} | ${formatByteSize(bundles.total.gzip)} | ${formatByteSize(bundles.total.brotli)} |
| JavaScript | ${formatByteSize(bundles.javascript.raw)} | ${formatByteSize(bundles.javascript.gzip)} | ${formatByteSize(bundles.javascript.brotli)} |
| CSS | ${formatByteSize(bundles.css.raw)} | ${formatByteSize(bundles.css.gzip)} | ${formatByteSize(bundles.css.brotli)} |

## Chunks (${bundles.chunks.length})

| Chunk | Raw | Gzip |
|-------|-----|------|
`;

    // Sort chunks by size descending, show top 10
    const sortedChunks = [...bundles.chunks]
      .sort((a, b) => b.size.raw - a.size.raw)
      .slice(0, 10);
    
    for (const chunk of sortedChunks) {
      const name = chunk.id.length > 40 ? `...${chunk.id.slice(-37)}` : chunk.id;
      md += `| ${name} | ${formatByteSize(chunk.size.raw)} | ${formatByteSize(chunk.size.gzip)} |\n`;
    }
    
    if (bundles.chunks.length > 10) {
      md += `| ... and ${bundles.chunks.length - 10} more | | |\n`;
    }

    if (routes.length > 0) {
      md += `
## Routes (${routes.length})

| Route | Type |
|-------|------|
`;
      for (const route of routes) {
        md += `| ${route.path} | ${route.type} |\n`;
      }
    }

    if (frameworkSpecific && meta.framework === 'nextjs') {
      const nextjs = frameworkSpecific;
      md += `
## Next.js Details

| Property | Value |
|----------|-------|
| Router Type | ${nextjs.routerType} |
| Middleware | ${nextjs.hasMiddleware ? 'Yes' : 'No'} |
| Turbopack | ${nextjs.turbopack ? 'Yes' : 'No'} |
`;
    }

    return md;
  }

  // HTML format
  const { meta, bundles, routes, frameworkSpecific } = result;
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>Static Analysis: ${meta.framework}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1000px; margin: 2rem auto; padding: 0 1rem; }
    table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
    th, td { border: 1px solid #ddd; padding: 0.5rem; text-align: left; }
    th { background: #f5f5f5; }
    .size-cell { text-align: right; font-family: monospace; }
    h2 { margin-top: 2rem; }
    .meta { background: #f9f9f9; padding: 1rem; border-radius: 4px; margin-bottom: 2rem; }
    .meta p { margin: 0.25rem 0; }
  </style>
</head>
<body>
  <h1>Static Analysis</h1>
  
  <div class="meta">
    <p><strong>Framework:</strong> ${meta.framework}${meta.frameworkVersion ? ` v${meta.frameworkVersion}` : ''}</p>
    <p><strong>Analyzed:</strong> ${meta.analyzedAt}</p>
    <p><strong>Source:</strong> ${meta.sourceDir}</p>
    <p><strong>Build:</strong> ${meta.buildDir}</p>
  </div>
  
  <h2>Bundle Sizes</h2>
  <table>
    <tr><th>Type</th><th class="size-cell">Raw</th><th class="size-cell">Gzip</th><th class="size-cell">Brotli</th></tr>
    <tr>
      <td><strong>Total</strong></td>
      <td class="size-cell">${formatByteSize(bundles.total.raw)}</td>
      <td class="size-cell">${formatByteSize(bundles.total.gzip)}</td>
      <td class="size-cell">${formatByteSize(bundles.total.brotli)}</td>
    </tr>
    <tr>
      <td>JavaScript</td>
      <td class="size-cell">${formatByteSize(bundles.javascript.raw)}</td>
      <td class="size-cell">${formatByteSize(bundles.javascript.gzip)}</td>
      <td class="size-cell">${formatByteSize(bundles.javascript.brotli)}</td>
    </tr>
    <tr>
      <td>CSS</td>
      <td class="size-cell">${formatByteSize(bundles.css.raw)}</td>
      <td class="size-cell">${formatByteSize(bundles.css.gzip)}</td>
      <td class="size-cell">${formatByteSize(bundles.css.brotli)}</td>
    </tr>
  </table>

  <h2>Chunks (${bundles.chunks.length})</h2>
  <table>
    <tr><th>Chunk</th><th class="size-cell">Raw</th><th class="size-cell">Gzip</th></tr>
    ${bundles.chunks
      .sort((a, b) => b.size.raw - a.size.raw)
      .slice(0, 20)
      .map(chunk => `
    <tr>
      <td>${chunk.id}</td>
      <td class="size-cell">${formatByteSize(chunk.size.raw)}</td>
      <td class="size-cell">${formatByteSize(chunk.size.gzip)}</td>
    </tr>`).join('')}
  </table>

  ${routes.length > 0 ? `
  <h2>Routes (${routes.length})</h2>
  <table>
    <tr><th>Route</th><th>Type</th></tr>
    ${routes.map(r => `<tr><td>${r.path}</td><td>${r.type}</td></tr>`).join('')}
  </table>
  ` : ''}

  ${frameworkSpecific && meta.framework === 'nextjs' ? `
  <h2>Next.js Details</h2>
  <table>
    <tr><th>Property</th><th>Value</th></tr>
    <tr><td>Router Type</td><td>${frameworkSpecific.routerType}</td></tr>
    <tr><td>Middleware</td><td>${frameworkSpecific.hasMiddleware ? 'Yes' : 'No'}</td></tr>
    <tr><td>Turbopack</td><td>${frameworkSpecific.turbopack ? 'Yes' : 'No'}</td></tr>
  </table>
  ` : ''}
</body>
</html>`;
};

export const executeAnalyze = async (command: AnalyzeCommand): Promise<number> => {
  // Resolve paths relative to where the user ran the command
  const { resolve } = await import('path');
  const sourceDir = resolve(process.cwd(), command.sourceDir);
  const buildDir = command.buildDir ? resolve(process.cwd(), command.buildDir) : undefined;

  console.log(`Analyzing ${sourceDir}...`);
  if (buildDir) {
    console.log(`  Build dir: ${buildDir}`);
  }
  if (command.framework) {
    console.log(`  Framework hint: ${command.framework}`);
  }
  console.log();

  const result = await analyze({
    sourceDir,
    buildDir,
    framework: command.framework ?? undefined,
  });

  if (!result.ok) {
    console.error(`Analysis failed: ${result.error.message}`);
    return 1;
  }

  const output = formatOutput(result.value, command.format);

  if (command.output) {
    await Bun.write(command.output, output);
    console.log(`Results written to ${command.output}`);
  } else {
    console.log(output);
  }

  return 0;
};

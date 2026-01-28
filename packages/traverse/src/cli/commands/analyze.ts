/**
 * Analyze command implementation.
 * Static analysis of build outputs.
 */

import { writeFile } from 'node:fs/promises';
import type { AnalyzeCommand, StaticAnalysis, ArchitectureType, HydrationStrategy, DataStrategy } from '../../types.ts';
import { analyze, formatByteSize } from '../../analyze/index.ts';
import { formatTable } from '../format.ts';

const ARCHITECTURE_LABELS: Record<ArchitectureType, string> = {
  mpa: 'Multi-Page App',
  spa: 'Single-Page App',
  transitional: 'Transitional',
  islands: 'Islands',
  unknown: 'Unknown',
};

const HYDRATION_LABELS: Record<HydrationStrategy, string> = {
  full: 'Full hydration',
  progressive: 'Progressive/Selective',
  partial: 'Partial',
  islands: 'Islands',
  resumable: 'Resumable',
  none: 'None',
};

const DATA_STRATEGY_LABELS: Record<DataStrategy, string> = {
  rsc: 'React Server Components',
  loaders: 'Route Loaders',
  getServerSideProps: 'getServerSideProps',
  'client-fetch': 'Client-side Fetch',
  static: 'Static/Build-time',
  mixed: 'Mixed',
};

const formatOutput = (
  result: StaticAnalysis,
  format: 'json' | 'markdown' | 'html'
): string => {
  if (format === 'json') {
    return JSON.stringify(result, null, 2);
  }

  if (format === 'markdown') {
    const { meta, bundles, dependencies, routes, frameworkSpecific, architecture, runtime, routeCosts } = result;
    
    // Calculate vendor ratio
    const vendorRatio = bundles.javascript.gzip > 0
      ? ((bundles.vendor.gzip / bundles.javascript.gzip) * 100).toFixed(1)
      : '0';
    const appRatio = bundles.javascript.gzip > 0
      ? ((bundles.nonVendor.gzip / bundles.javascript.gzip) * 100).toFixed(1)
      : '0';
    
    let md = `# Static Analysis

**Framework:** ${meta.framework}${meta.frameworkVersion ? ` v${meta.frameworkVersion}` : ''}  
**Analyzed:** ${meta.analyzedAt}  
**Source:** ${meta.sourceDir}  
**Build:** ${meta.buildDir}  
`;

    // Architecture section (if available)
    if (architecture) {
      const archTable = formatTable(
        ['Property', 'Value'],
        [
          ['Type', `**${ARCHITECTURE_LABELS[architecture.type]}**`],
          ['Hydration', HYDRATION_LABELS[architecture.hydration]],
          ['Data Strategy', DATA_STRATEGY_LABELS[architecture.dataStrategy]],
          ['Client Router', architecture.hasClientRouter ? 'Yes' : 'No'],
          ['Server Components', architecture.hasServerComponents ? 'Yes' : 'No'],
          ['Streaming', architecture.supportsStreaming ? 'Yes' : 'No'],
        ]
      );
      md += `
## Architecture

${archTable}

`;
    }

    const bundleTable = formatTable(
      ['Type', 'Raw', 'Gzip', 'Brotli'],
      [
        ['**Total**', formatByteSize(bundles.total.raw), formatByteSize(bundles.total.gzip), formatByteSize(bundles.total.brotli)],
        ['JavaScript', formatByteSize(bundles.javascript.raw), formatByteSize(bundles.javascript.gzip), formatByteSize(bundles.javascript.brotli)],
        ['CSS', formatByteSize(bundles.css.raw), formatByteSize(bundles.css.gzip), formatByteSize(bundles.css.brotli)],
      ]
    );
    md += `## Bundle Sizes

${bundleTable}

`;

    // Runtime breakdown (if available)
    if (runtime) {
      const categories = [
        runtime.framework,
        runtime.router,
        runtime.hydration,
        runtime.polyfills,
        runtime.application,
        runtime.other,
      ].filter(c => c.size.gzip > 0)
       .sort((a, b) => b.size.gzip - a.size.gzip);

      const runtimeTable = formatTable(
        ['Category', 'Gzip', '% of JS', 'Chunks'],
        categories.map(cat => [cat.name, formatByteSize(cat.size.gzip), `${cat.percentage}%`, String(cat.chunks.length)])
      );
      md += `## Runtime Breakdown

${runtimeTable}

`;
    } else {
      // Fallback to simple vendor/app breakdown
      const jsTable = formatTable(
        ['Category', 'Gzip', '% of JS'],
        [
          ['Vendor/Framework', formatByteSize(bundles.vendor.gzip), `${vendorRatio}%`],
          ['Application Code', formatByteSize(bundles.nonVendor.gzip), `${appRatio}%`],
        ]
      );
      md += `## JavaScript Breakdown

${jsTable}

`;
    }

    // Route costs (if available)
    if (routeCosts && routeCosts.routes.length > 0) {
      const routeRows: string[][] = routeCosts.routes.slice(0, 10).map(route => {
        const name = route.route.length > 25 ? `${route.route.slice(0, 22)}...` : route.route;
        return [name, formatByteSize(route.total.gzip), formatByteSize(route.unique.gzip), formatByteSize(route.shared.gzip)];
      });
      if (routeCosts.routes.length > 10) {
        routeRows.push([`... and ${routeCosts.routes.length - 10} more`, '', '', '']);
      }
      const routeCostTable = formatTable(['Route', 'Total', 'Unique', 'Shared'], routeRows);
      md += `## Route Costs

**Entry Point:** ${formatByteSize(routeCosts.entryPointCost.gzip)} (gzip)  
**Average Route:** ${formatByteSize(routeCosts.averageRouteCost.gzip)} (gzip)

${routeCostTable}

`;
    }

    const depsTable = formatTable(
      ['Category', 'Count'],
      [
        ['Production', String(dependencies.dependencies)],
        ['Dev', String(dependencies.devDependencies)],
        ['**Total**', String(dependencies.total)],
      ]
    );
    md += `## Dependencies

${depsTable}

${dependencies.topDependencies.length > 0 ? `**Key dependencies:** ${dependencies.topDependencies.slice(0, 5).join(', ')}` : ''}

`;

    // Sort chunks by size descending, show top 10
    const sortedChunks = [...bundles.chunks]
      .sort((a, b) => b.size.raw - a.size.raw)
      .slice(0, 10);
    
    const chunkRows: string[][] = sortedChunks.map(chunk => {
      const name = chunk.id.length > 40 ? `...${chunk.id.slice(-37)}` : chunk.id;
      return [name, formatByteSize(chunk.size.raw), formatByteSize(chunk.size.gzip)];
    });
    if (bundles.chunks.length > 10) {
      chunkRows.push([`... and ${bundles.chunks.length - 10} more`, '', '']);
    }
    const chunksTable = formatTable(['Chunk', 'Raw', 'Gzip'], chunkRows);
    md += `## Chunks (${bundles.chunks.length})

${chunksTable}
`;

    if (routes.length > 0) {
      const routesTable = formatTable(
        ['Route', 'Type'],
        routes.map(route => [route.path, route.type])
      );
      md += `
## Routes (${routes.length})

${routesTable}
`;
    }

    if (frameworkSpecific && meta.framework === 'nextjs') {
      const nextjs = frameworkSpecific;
      const nextTable = formatTable(
        ['Property', 'Value'],
        [
          ['Router Type', nextjs.routerType],
          ['Middleware', nextjs.hasMiddleware ? 'Yes' : 'No'],
          ['Turbopack', nextjs.turbopack ? 'Yes' : 'No'],
        ]
      );
      md += `
## Next.js Details

${nextTable}
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
    ${[...bundles.chunks]
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

  // Status messages go to stderr so stdout is clean for output
  console.error(`Analyzing ${sourceDir}...`);
  if (buildDir) {
    console.error(`  Build dir: ${buildDir}`);
  }
  if (command.framework) {
    console.error(`  Framework hint: ${command.framework}`);
  }
  console.error();

  const result = await analyze({
    sourceDir,
    ...(buildDir !== undefined && { buildDir }),
    ...(command.framework && { framework: command.framework }),
  });

  if (!result.ok) {
    console.error(`Analysis failed: ${result.error.message}`);
    return 1;
  }

  const output = formatOutput(result.value, command.format);

  if (command.output) {
    await writeFile(command.output, output);
    console.error(`Results written to ${command.output}`);
  } else {
    console.log(output);
  }

  return 0;
};

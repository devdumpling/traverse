/**
 * Route-level cost analysis.
 * 
 * Calculates the JS cost to load each route, including:
 * - Unique chunks for that route
 * - Shared chunks it depends on
 * - Total cost to navigate to that route
 */

import type { Result, ByteSize, FrameworkType } from '../types.ts';
import { ok, err } from '../result.ts';
import { calculateByteSizeFromFile, sumByteSizes, emptyByteSize } from './utils.ts';

export interface RouteCost {
  readonly route: string;
  readonly unique: ByteSize;           // JS unique to this route
  readonly shared: ByteSize;           // Shared chunks needed
  readonly total: ByteSize;            // Total to load this route
  readonly chunks: readonly string[];  // All chunks for this route
  readonly uniqueChunks: readonly string[];
  readonly sharedChunks: readonly string[];
}

export interface RouteAnalysisResult {
  readonly routes: readonly RouteCost[];
  readonly sharedChunks: readonly SharedChunk[];
  readonly entryPointCost: ByteSize;   // Cost to load before any route
  readonly averageRouteCost: ByteSize; // Average per-route cost
  readonly largestRoute: RouteCost | null;
  readonly smallestRoute: RouteCost | null;
}

export interface SharedChunk {
  readonly name: string;
  readonly size: ByteSize;
  readonly usedByRoutes: readonly string[];
}

export interface RouteAnalysisError {
  readonly code: 'MANIFEST_NOT_FOUND' | 'ANALYSIS_FAILED';
  readonly message: string;
}

interface ChunkSizeCache {
  [path: string]: ByteSize;
}

/**
 * Get chunk sizes with caching.
 */
const getChunkSizes = async (
  buildDir: string,
  chunks: readonly string[],
  cache: ChunkSizeCache
): Promise<ByteSize[]> => {
  const sizes: ByteSize[] = [];
  
  for (const chunk of chunks) {
    if (cache[chunk]) {
      sizes.push(cache[chunk]);
    } else {
      // Try various path combinations
      const paths = [
        `${buildDir}/${chunk}`,
        `${buildDir}/static/${chunk}`,
        `${buildDir}/client/${chunk}`,
        `${buildDir}/client/assets/${chunk.replace(/^assets\//, '')}`,
      ];
      
      let size: ByteSize | null = null;
      for (const path of paths) {
        size = await calculateByteSizeFromFile(path);
        if (size) break;
      }
      
      if (size) {
        cache[chunk] = size;
        sizes.push(size);
      }
    }
  }
  
  return sizes;
};

/**
 * Analyze Next.js routes using build-manifest.json.
 */
const analyzeNextJsRoutes = async (
  buildDir: string
): Promise<Result<RouteAnalysisResult, RouteAnalysisError>> => {
  interface BuildManifest {
    pages: Record<string, readonly string[]>;
    rootMainFiles: readonly string[];
    polyfillFiles?: readonly string[];
  }

  let manifest: BuildManifest | null = null;
  try {
    const content = await Bun.file(`${buildDir}/build-manifest.json`).text();
    manifest = JSON.parse(content) as BuildManifest;
  } catch {
    return err({
      code: 'MANIFEST_NOT_FOUND',
      message: 'build-manifest.json not found',
    });
  }

  const cache: ChunkSizeCache = {};
  
  // Calculate entry point cost (rootMainFiles + polyfills)
  const entryChunks = [
    ...manifest.rootMainFiles,
    ...(manifest.polyfillFiles ?? []),
  ];
  const entrySizes = await getChunkSizes(buildDir, entryChunks, cache);
  const entryPointCost = sumByteSizes(entrySizes);

  // Track which chunks are used by multiple routes
  const chunkUsage: Record<string, string[]> = {};
  
  // Calculate per-route costs
  const routes: RouteCost[] = [];
  
  for (const [route, chunks] of Object.entries(manifest.pages)) {
    // Skip internal routes
    if (route.startsWith('/_')) continue;
    
    // Track chunk usage
    for (const chunk of chunks) {
      if (!chunkUsage[chunk]) chunkUsage[chunk] = [];
      chunkUsage[chunk].push(route);
    }
  }

  // Now calculate route costs with shared/unique breakdown
  for (const [route, chunks] of Object.entries(manifest.pages)) {
    if (route.startsWith('/_')) continue;
    
    const uniqueChunks: string[] = [];
    const sharedChunks: string[] = [];
    
    for (const chunk of chunks) {
      if (chunkUsage[chunk]?.length === 1) {
        uniqueChunks.push(chunk);
      } else {
        sharedChunks.push(chunk);
      }
    }
    
    const uniqueSizes = await getChunkSizes(buildDir, uniqueChunks, cache);
    const sharedSizes = await getChunkSizes(buildDir, sharedChunks, cache);
    
    const unique = sumByteSizes(uniqueSizes);
    const shared = sumByteSizes(sharedSizes);
    const total = sumByteSizes([unique, shared]);
    
    routes.push({
      route,
      unique,
      shared,
      total,
      chunks: [...chunks],
      uniqueChunks,
      sharedChunks,
    });
  }

  // Build shared chunks list
  const sharedChunks: SharedChunk[] = [];
  for (const [chunk, usedBy] of Object.entries(chunkUsage)) {
    if (usedBy.length > 1) {
      const sizes = await getChunkSizes(buildDir, [chunk], cache);
      if (sizes.length > 0) {
        sharedChunks.push({
          name: chunk,
          size: sizes[0],
          usedByRoutes: usedBy,
        });
      }
    }
  }

  // Sort routes by total cost
  routes.sort((a, b) => b.total.gzip - a.total.gzip);

  // Calculate average
  const avgGzip = routes.length > 0
    ? routes.reduce((sum, r) => sum + r.total.gzip, 0) / routes.length
    : 0;
  const averageRouteCost: ByteSize = {
    raw: routes.length > 0 ? routes.reduce((sum, r) => sum + r.total.raw, 0) / routes.length : 0,
    gzip: avgGzip,
    brotli: Math.round(avgGzip * 0.85),
  };

  return ok({
    routes,
    sharedChunks: sharedChunks.sort((a, b) => b.size.gzip - a.size.gzip),
    entryPointCost,
    averageRouteCost,
    largestRoute: routes[0] ?? null,
    smallestRoute: routes[routes.length - 1] ?? null,
  });
};

/**
 * Analyze React Router / Vite routes.
 */
const analyzeViteRoutes = async (
  buildDir: string
): Promise<Result<RouteAnalysisResult, RouteAnalysisError>> => {
  interface ViteManifest {
    [key: string]: {
      file: string;
      src?: string;
      isEntry?: boolean;
      imports?: readonly string[];
    };
  }

  // Try to find Vite manifest
  const manifestPaths = [
    `${buildDir}/client/.vite/manifest.json`,
    `${buildDir}/.vite/manifest.json`,
  ];

  let manifest: ViteManifest | null = null;
  for (const path of manifestPaths) {
    try {
      const content = await Bun.file(path).text();
      manifest = JSON.parse(content) as ViteManifest;
      break;
    } catch {
      // Try next path
    }
  }

  if (!manifest) {
    return err({
      code: 'MANIFEST_NOT_FOUND',
      message: 'Vite manifest.json not found',
    });
  }

  const cache: ChunkSizeCache = {};
  const clientDir = `${buildDir}/client`;

  // Find entry point
  let entryChunks: string[] = [];
  for (const [key, entry] of Object.entries(manifest)) {
    if (entry.isEntry) {
      entryChunks.push(entry.file);
      if (entry.imports) {
        for (const imp of entry.imports) {
          const impEntry = manifest[imp];
          if (impEntry) entryChunks.push(impEntry.file);
        }
      }
    }
  }

  const entrySizes = await getChunkSizes(clientDir, entryChunks, cache);
  const entryPointCost = sumByteSizes(entrySizes);

  // Find route modules
  const routes: RouteCost[] = [];
  const chunkUsage: Record<string, string[]> = {};

  for (const [key, entry] of Object.entries(manifest)) {
    // Look for route patterns
    const isRoute = entry.src?.includes('routes/') || 
                    entry.src?.includes('app/') ||
                    key.includes('route');
    
    if (!isRoute || entry.isEntry) continue;

    // Extract route path from source
    let route = '/';
    if (entry.src) {
      const match = entry.src.match(/routes\/(.+)\.(tsx?|jsx?)$/);
      if (match) {
        route = '/' + match[1]
          .replace(/\$/g, ':')
          .replace(/_index$/, '')
          .replace(/index$/, '')
          .replace(/\/_/g, '/');
        if (route === '/') route = '/';
      }
    }

    // Collect all chunks for this route
    const routeChunks = [entry.file];
    if (entry.imports) {
      for (const imp of entry.imports) {
        const impEntry = manifest[imp];
        if (impEntry && !entryChunks.includes(impEntry.file)) {
          routeChunks.push(impEntry.file);
        }
      }
    }

    // Track usage
    for (const chunk of routeChunks) {
      if (!chunkUsage[chunk]) chunkUsage[chunk] = [];
      chunkUsage[chunk].push(route);
    }

    const sizes = await getChunkSizes(clientDir, routeChunks, cache);
    const total = sumByteSizes(sizes);

    routes.push({
      route,
      unique: total, // Will refine below
      shared: emptyByteSize(),
      total,
      chunks: routeChunks,
      uniqueChunks: routeChunks,
      sharedChunks: [],
    });
  }

  // Refine unique vs shared and recalculate sizes
  const refinedRoutes: RouteCost[] = [];
  
  for (const r of routes) {
    const uniqueChunks: string[] = [];
    const sharedChunks: string[] = [];
    
    for (const chunk of r.chunks) {
      if (chunkUsage[chunk]?.length === 1) {
        uniqueChunks.push(chunk);
      } else {
        sharedChunks.push(chunk);
      }
    }

    const uniqueSizes = await getChunkSizes(clientDir, uniqueChunks, cache);
    const sharedSizes = await getChunkSizes(clientDir, sharedChunks, cache);
    const unique = sumByteSizes(uniqueSizes);
    const shared = sumByteSizes(sharedSizes);

    refinedRoutes.push({
      route: r.route,
      unique,
      shared,
      total: r.total,
      chunks: r.chunks,
      uniqueChunks,
      sharedChunks,
    });
  }

  // Build shared chunks list
  const sharedChunks: SharedChunk[] = [];
  for (const [chunk, usedBy] of Object.entries(chunkUsage)) {
    if (usedBy.length > 1) {
      const sizes = await getChunkSizes(clientDir, [chunk], cache);
      if (sizes.length > 0) {
        sharedChunks.push({
          name: chunk,
          size: sizes[0],
          usedByRoutes: usedBy,
        });
      }
    }
  }

  // Sort and calculate stats
  refinedRoutes.sort((a, b) => b.total.gzip - a.total.gzip);

  const avgGzip = refinedRoutes.length > 0
    ? refinedRoutes.reduce((sum, r) => sum + r.total.gzip, 0) / refinedRoutes.length
    : 0;
  const averageRouteCost: ByteSize = {
    raw: refinedRoutes.length > 0 ? refinedRoutes.reduce((sum, r) => sum + r.total.raw, 0) / refinedRoutes.length : 0,
    gzip: avgGzip,
    brotli: Math.round(avgGzip * 0.85),
  };

  return ok({
    routes: refinedRoutes,
    sharedChunks: sharedChunks.sort((a, b) => b.size.gzip - a.size.gzip),
    entryPointCost,
    averageRouteCost,
    largestRoute: refinedRoutes[0] ?? null,
    smallestRoute: refinedRoutes[refinedRoutes.length - 1] ?? null,
  });
};

/**
 * Analyze route-level costs for a build directory.
 */
export const analyzeRouteCosts = async (
  buildDir: string,
  framework: FrameworkType = 'unknown'
): Promise<Result<RouteAnalysisResult, RouteAnalysisError>> => {
  if (framework === 'nextjs') {
    return analyzeNextJsRoutes(buildDir);
  }

  if (framework === 'react-router') {
    return analyzeViteRoutes(buildDir);
  }

  // Try both
  const nextResult = await analyzeNextJsRoutes(buildDir);
  if (nextResult.ok) return nextResult;

  return analyzeViteRoutes(buildDir);
};

/**
 * Format route analysis for display.
 */
export const formatRouteCosts = (analysis: RouteAnalysisResult): string => {
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  let output = `## Route-Level Costs\n\n`;
  output += `**Entry Point Cost:** ${formatSize(analysis.entryPointCost.gzip)} (gzip)\n`;
  output += `**Average Route Cost:** ${formatSize(analysis.averageRouteCost.gzip)} (gzip)\n\n`;

  if (analysis.largestRoute) {
    output += `**Largest Route:** \`${analysis.largestRoute.route}\` - ${formatSize(analysis.largestRoute.total.gzip)}\n`;
  }
  if (analysis.smallestRoute && analysis.routes.length > 1) {
    output += `**Smallest Route:** \`${analysis.smallestRoute.route}\` - ${formatSize(analysis.smallestRoute.total.gzip)}\n`;
  }

  output += `\n### Routes by Size\n\n`;
  output += `| Route | Total | Unique | Shared | Chunks |\n`;
  output += `|-------|-------|--------|--------|--------|\n`;

  for (const route of analysis.routes.slice(0, 15)) {
    const name = route.route.length > 30 ? `${route.route.slice(0, 27)}...` : route.route;
    output += `| ${name} | ${formatSize(route.total.gzip)} | ${formatSize(route.unique.gzip)} | ${formatSize(route.shared.gzip)} | ${route.chunks.length} |\n`;
  }

  if (analysis.routes.length > 15) {
    output += `| ... and ${analysis.routes.length - 15} more routes | | | | |\n`;
  }

  if (analysis.sharedChunks.length > 0) {
    output += `\n### Shared Chunks\n\n`;
    output += `| Chunk | Size | Used By |\n`;
    output += `|-------|------|--------|\n`;

    for (const chunk of analysis.sharedChunks.slice(0, 10)) {
      const name = chunk.name.length > 40 ? `...${chunk.name.slice(-37)}` : chunk.name;
      output += `| ${name} | ${formatSize(chunk.size.gzip)} | ${chunk.usedByRoutes.length} routes |\n`;
    }
  }

  return output;
};

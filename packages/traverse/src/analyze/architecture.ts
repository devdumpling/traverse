/**
 * Framework architecture classification.
 * 
 * Detects the app's rendering/navigation strategy:
 * - MPA: Multi-page app with full page loads
 * - SPA: Single-page app with client router
 * - Transitional: Starts minimal, upgrades to SPA-like navigation
 * - Islands: Isolated interactive components in static HTML
 */

import type { Result, FrameworkType } from '../types.ts';
import { ok, err } from '../result.ts';
import { readJson, fileExists } from './utils.ts';

export type ArchitectureType = 'mpa' | 'spa' | 'transitional' | 'islands' | 'unknown';

export type HydrationStrategy = 
  | 'full'           // Traditional: hydrate entire page
  | 'progressive'    // React 18+: selective/progressive hydration
  | 'partial'        // Only hydrate interactive parts
  | 'islands'        // Isolated island components
  | 'resumable'      // Qwik-style: serialize state, no replay
  | 'none';          // No hydration (pure MPA/SSG)

export type DataStrategy =
  | 'rsc'            // React Server Components (Flight protocol)
  | 'loaders'        // Route loaders (Remix/RR7 style)
  | 'getServerSideProps' // Next.js pages router
  | 'client-fetch'   // Client-side data fetching
  | 'static'         // Build-time data only
  | 'mixed';         // Combination of strategies

export interface ArchitectureAnalysis {
  readonly type: ArchitectureType;
  readonly hydration: HydrationStrategy;
  readonly dataStrategy: DataStrategy;
  readonly hasClientRouter: boolean;
  readonly hasServerComponents: boolean;
  readonly supportsStreaming: boolean;
  readonly signals: readonly ArchitectureSignal[];
}

export interface ArchitectureSignal {
  readonly indicator: string;
  readonly detected: boolean;
  readonly weight: number;
  readonly implies: ArchitectureType | null;
}

export interface ArchitectureError {
  readonly code: 'DETECTION_FAILED';
  readonly message: string;
}

/**
 * Check if any chunk contains a pattern (by reading file content).
 */
const chunkContains = async (
  buildDir: string, 
  chunks: readonly string[], 
  pattern: RegExp
): Promise<boolean> => {
  for (const chunk of chunks.slice(0, 10)) { // Limit to avoid reading too many files
    try {
      const content = await Bun.file(`${buildDir}/${chunk}`).text();
      if (pattern.test(content)) return true;
    } catch {
      // Skip unreadable files
    }
  }
  return false;
};

/**
 * Detect architecture signals from Next.js build.
 */
const detectNextJsArchitecture = async (
  buildDir: string
): Promise<ArchitectureSignal[]> => {
  const signals: ArchitectureSignal[] = [];

  // Check for App Router (RSC-based)
  const hasAppRouter = await fileExists(`${buildDir}/app-paths-manifest.json`);
  signals.push({
    indicator: 'App Router (app/ directory)',
    detected: hasAppRouter,
    weight: 3,
    implies: hasAppRouter ? 'transitional' : null,
  });

  // Check for Pages Router
  const hasPagesRouter = await fileExists(`${buildDir}/server/pages-manifest.json`);
  signals.push({
    indicator: 'Pages Router (pages/ directory)',
    detected: hasPagesRouter,
    weight: 2,
    implies: hasPagesRouter && !hasAppRouter ? 'spa' : null,
  });

  // Check for Server Actions
  const serverActionsManifest = await readJson<Record<string, unknown>>(
    `${buildDir}/server/server-reference-manifest.json`
  );
  const hasServerActions = serverActionsManifest !== null && 
    Object.keys(serverActionsManifest).length > 0;
  signals.push({
    indicator: 'Server Actions',
    detected: hasServerActions,
    weight: 2,
    implies: 'transitional',
  });

  // Check for static export (MPA-like)
  const prerenderManifest = await readJson<{ routes?: Record<string, unknown> }>(
    `${buildDir}/prerender-manifest.json`
  );
  const staticRouteCount = prerenderManifest?.routes 
    ? Object.keys(prerenderManifest.routes).length 
    : 0;
  const hasStaticExport = staticRouteCount > 0;
  signals.push({
    indicator: `Static/ISR routes (${staticRouteCount} routes)`,
    detected: hasStaticExport,
    weight: 1,
    implies: null, // Could be either
  });

  // Check for client components (indicates hydration needed)
  const buildManifest = await readJson<{ pages?: Record<string, string[]> }>(
    `${buildDir}/build-manifest.json`
  );
  const hasClientChunks = buildManifest?.pages 
    ? Object.values(buildManifest.pages).some(chunks => chunks.length > 0)
    : false;
  signals.push({
    indicator: 'Client-side JavaScript chunks',
    detected: hasClientChunks,
    weight: 2,
    implies: hasClientChunks ? 'transitional' : 'mpa',
  });

  return signals;
};

/**
 * Detect architecture signals from React Router / Vite build.
 */
const detectReactRouterArchitecture = async (
  buildDir: string
): Promise<ArchitectureSignal[]> => {
  const signals: ArchitectureSignal[] = [];

  // Check for client entry (indicates SPA/transitional)
  const hasClientEntry = await fileExists(`${buildDir}/client/assets`) ||
    await fileExists(`${buildDir}/client`);
  signals.push({
    indicator: 'Client entry bundle',
    detected: hasClientEntry,
    weight: 3,
    implies: hasClientEntry ? 'transitional' : 'mpa',
  });

  // Check for server entry
  const hasServerEntry = await fileExists(`${buildDir}/server/index.js`);
  signals.push({
    indicator: 'Server entry (SSR)',
    detected: hasServerEntry,
    weight: 2,
    implies: null,
  });

  // Check for route modules (loaders pattern)
  // Look for .data endpoint patterns in client code
  const clientDir = `${buildDir}/client/assets`;
  try {
    const files = await Array.fromAsync(
      new Bun.Glob('*.js').scan({ cwd: clientDir, absolute: false })
    );
    
    // Check if any client file references .data endpoints (Single Fetch)
    for (const file of files.slice(0, 5)) {
      const content = await Bun.file(`${clientDir}/${file}`).text();
      if (content.includes('.data') || content.includes('turbo-stream')) {
        signals.push({
          indicator: 'Single Fetch / turbo-stream',
          detected: true,
          weight: 2,
          implies: 'transitional',
        });
        break;
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return signals;
};

/**
 * Detect architecture signals from generic/unknown framework.
 */
const detectGenericArchitecture = async (
  buildDir: string,
  chunks: readonly string[]
): Promise<ArchitectureSignal[]> => {
  const signals: ArchitectureSignal[] = [];

  // Check for common SPA routers
  const routerPatterns = [
    { name: 'React Router', pattern: /createBrowserRouter|RouterProvider/ },
    { name: 'Vue Router', pattern: /createRouter|VueRouter/ },
    { name: 'Svelte Router', pattern: /goto|navigating/ },
  ];

  for (const { name, pattern } of routerPatterns) {
    const detected = await chunkContains(buildDir, chunks, pattern);
    if (detected) {
      signals.push({
        indicator: `${name} detected`,
        detected: true,
        weight: 3,
        implies: 'spa',
      });
      break;
    }
  }

  // Check for hydration
  const hydrationPatterns = [
    { name: 'React hydration', pattern: /hydrateRoot|hydrate\(/ },
    { name: 'Vue hydration', pattern: /createSSRApp/ },
    { name: 'Svelte hydration', pattern: /hydrate:true/ },
  ];

  for (const { name, pattern } of hydrationPatterns) {
    const detected = await chunkContains(buildDir, chunks, pattern);
    if (detected) {
      signals.push({
        indicator: name,
        detected: true,
        weight: 2,
        implies: null,
      });
      break;
    }
  }

  // Check for islands patterns
  const islandsPatterns = /astro:island|client:load|client:visible|client:idle/;
  const hasIslands = await chunkContains(buildDir, chunks, islandsPatterns);
  signals.push({
    indicator: 'Islands architecture (Astro-style)',
    detected: hasIslands,
    weight: 4,
    implies: hasIslands ? 'islands' : null,
  });

  return signals;
};

/**
 * Determine hydration strategy from signals.
 */
const determineHydrationStrategy = (
  framework: FrameworkType,
  signals: readonly ArchitectureSignal[]
): HydrationStrategy => {
  const hasIslands = signals.some(s => s.indicator.includes('Islands') && s.detected);
  if (hasIslands) return 'islands';

  const hasRSC = signals.some(s => 
    (s.indicator.includes('App Router') || s.indicator.includes('Server Components')) && s.detected
  );
  if (hasRSC) return 'progressive';

  const hasHydration = signals.some(s => 
    s.indicator.toLowerCase().includes('hydration') && s.detected
  );
  if (!hasHydration) return 'none';

  // Next.js App Router uses progressive hydration
  if (framework === 'nextjs') {
    const hasAppRouter = signals.some(s => s.indicator.includes('App Router') && s.detected);
    return hasAppRouter ? 'progressive' : 'full';
  }

  return 'full';
};

/**
 * Determine data strategy from signals.
 */
const determineDataStrategy = (
  framework: FrameworkType,
  signals: readonly ArchitectureSignal[]
): DataStrategy => {
  if (framework === 'nextjs') {
    const hasAppRouter = signals.some(s => s.indicator.includes('App Router') && s.detected);
    const hasPagesRouter = signals.some(s => s.indicator.includes('Pages Router') && s.detected);
    
    if (hasAppRouter && hasPagesRouter) return 'mixed';
    if (hasAppRouter) return 'rsc';
    if (hasPagesRouter) return 'getServerSideProps';
  }

  if (framework === 'react-router') {
    // React Router 7 uses loaders pattern regardless of Single Fetch
    return 'loaders';
  }

  return 'client-fetch';
};

/**
 * Calculate architecture type from weighted signals.
 */
const calculateArchitectureType = (
  signals: readonly ArchitectureSignal[]
): ArchitectureType => {
  const scores: Record<ArchitectureType, number> = {
    mpa: 0,
    spa: 0,
    transitional: 0,
    islands: 0,
    unknown: 0,
  };

  for (const signal of signals) {
    if (signal.detected && signal.implies) {
      scores[signal.implies] += signal.weight;
    }
  }

  // Find highest score
  let maxType: ArchitectureType = 'unknown';
  let maxScore = 0;

  for (const [type, score] of Object.entries(scores) as [ArchitectureType, number][]) {
    if (score > maxScore) {
      maxScore = score;
      maxType = type;
    }
  }

  return maxType;
};

/**
 * Analyze the architecture of a built application.
 */
export const analyzeArchitecture = async (
  buildDir: string,
  framework: FrameworkType,
  chunks: readonly string[] = []
): Promise<Result<ArchitectureAnalysis, ArchitectureError>> => {
  try {
    let signals: ArchitectureSignal[] = [];

    // Framework-specific detection
    if (framework === 'nextjs') {
      signals = await detectNextJsArchitecture(buildDir);
    } else if (framework === 'react-router') {
      signals = await detectReactRouterArchitecture(buildDir);
    } else {
      signals = await detectGenericArchitecture(buildDir, chunks);
    }

    const type = calculateArchitectureType(signals);
    const hydration = determineHydrationStrategy(framework, signals);
    const dataStrategy = determineDataStrategy(framework, signals);

    // Derive boolean flags
    const hasClientRouter = signals.some(s => 
      (s.indicator.includes('Router') || s.indicator.includes('Client entry')) && s.detected
    );
    const hasServerComponents = framework === 'nextjs' && 
      signals.some(s => s.indicator.includes('App Router') && s.detected);
    const supportsStreaming = hasServerComponents || 
      signals.some(s => s.indicator.includes('turbo-stream') && s.detected);

    return ok({
      type,
      hydration,
      dataStrategy,
      hasClientRouter,
      hasServerComponents,
      supportsStreaming,
      signals,
    });
  } catch (e) {
    return err({
      code: 'DETECTION_FAILED',
      message: e instanceof Error ? e.message : 'Architecture detection failed',
    });
  }
};

/**
 * Get human-readable description of architecture type.
 */
export const describeArchitecture = (type: ArchitectureType): string => {
  const descriptions: Record<ArchitectureType, string> = {
    mpa: 'Multi-Page App - Full page loads, minimal/no client JS',
    spa: 'Single-Page App - Client router handles all navigation',
    transitional: 'Transitional - Server-rendered, upgrades to SPA-like navigation',
    islands: 'Islands - Static HTML with isolated interactive components',
    unknown: 'Unknown architecture pattern',
  };
  return descriptions[type];
};

/**
 * Get human-readable description of hydration strategy.
 */
export const describeHydration = (strategy: HydrationStrategy): string => {
  const descriptions: Record<HydrationStrategy, string> = {
    full: 'Full hydration - Entire page hydrated on load',
    progressive: 'Progressive - Selective hydration with streaming',
    partial: 'Partial - Only interactive components hydrated',
    islands: 'Islands - Independent component hydration',
    resumable: 'Resumable - Serialized state, no replay needed',
    none: 'None - No client-side hydration',
  };
  return descriptions[strategy];
};

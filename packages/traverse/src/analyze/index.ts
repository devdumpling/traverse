/**
 * Static analysis module.
 * Analyzes build outputs to extract bundle sizes, routes, and framework-specific data.
 */

import type { Result, StaticAnalysis, RouteAnalysis, DependencyCount, ArchitectureAnalysis, RuntimeBreakdown, RouteCostAnalysis } from '../types.ts';
import { ok, err } from '../result.ts';
import { detectFramework, type DetectionResult } from './detect.ts';
import { analyzeBundles } from './bundles.ts';
import { analyzeNextJs } from './nextjs.ts';
import { analyzeDependencies } from './dependencies.ts';
import { analyzeArchitecture } from './architecture.ts';
import { analyzeRuntime } from './runtime.ts';
import { analyzeRouteCosts } from './routes.ts';

export interface AnalyzeError {
  readonly code: 'NO_SOURCE_DIR' | 'NO_BUILD_DIR' | 'ANALYSIS_FAILED';
  readonly message: string;
}

export interface AnalyzeOptions {
  readonly sourceDir: string;
  readonly buildDir?: string;
  readonly framework?: string;
}

/**
 * Run static analysis on a project.
 */
export const analyze = async (
  options: AnalyzeOptions
): Promise<Result<StaticAnalysis, AnalyzeError>> => {
  // Detect framework
  const detectionResult = await detectFramework(options.sourceDir);
  if (!detectionResult.ok) {
    return err({
      code: 'NO_SOURCE_DIR',
      message: detectionResult.error.message,
    });
  }

  const detection = detectionResult.value;
  const buildDir = options.buildDir ?? detection.buildDir;

  if (!buildDir) {
    return err({
      code: 'NO_BUILD_DIR',
      message: 'No build directory found. Run a production build first or specify --build-dir.',
    });
  }

  // Analyze bundles with framework info for better vendor detection
  const bundleResult = await analyzeBundles({
    buildDir,
    framework: detection.framework,
  });
  if (!bundleResult.ok) {
    return err({
      code: 'ANALYSIS_FAILED',
      message: bundleResult.error.message,
    });
  }

  // Analyze dependencies
  const depsResult = await analyzeDependencies(options.sourceDir);
  const dependencies: DependencyCount = depsResult.ok 
    ? depsResult.value 
    : { dependencies: 0, devDependencies: 0, total: 0, topDependencies: [] };

  // Framework-specific analysis
  let frameworkSpecific = null;
  let routes: RouteAnalysis[] = [];

  if (detection.framework === 'nextjs') {
    const nextResult = await analyzeNextJs(buildDir);
    if (nextResult.ok) {
      frameworkSpecific = nextResult.value;
      routes = nextResult.value.routes.map(r => ({
        path: r.path,
        type: r.type,
        segments: r.segments,
        chunks: [],
      }));
    }
  }

  // Architecture analysis
  let architecture: ArchitectureAnalysis | undefined;
  const archResult = await analyzeArchitecture(buildDir, detection.framework, bundleResult.value.chunks.map(c => c.id));
  if (archResult.ok) {
    architecture = {
      type: archResult.value.type,
      hydration: archResult.value.hydration,
      dataStrategy: archResult.value.dataStrategy,
      hasClientRouter: archResult.value.hasClientRouter,
      hasServerComponents: archResult.value.hasServerComponents,
      supportsStreaming: archResult.value.supportsStreaming,
    };
  }

  // Runtime breakdown
  let runtime: RuntimeBreakdown | undefined;
  const runtimeResult = await analyzeRuntime(buildDir, detection.framework);
  if (runtimeResult.ok) {
    runtime = {
      total: runtimeResult.value.total,
      framework: runtimeResult.value.categories.framework,
      router: runtimeResult.value.categories.router,
      hydration: runtimeResult.value.categories.hydration,
      polyfills: runtimeResult.value.categories.polyfills,
      application: runtimeResult.value.categories.application,
      other: runtimeResult.value.categories.other,
    };
  }

  // Route cost analysis
  let routeCosts: RouteCostAnalysis | undefined;
  const routeCostResult = await analyzeRouteCosts(buildDir, detection.framework);
  if (routeCostResult.ok) {
    routeCosts = {
      routes: routeCostResult.value.routes.map(r => ({
        route: r.route,
        unique: r.unique,
        shared: r.shared,
        total: r.total,
        chunks: r.chunks,
      })),
      entryPointCost: routeCostResult.value.entryPointCost,
      averageRouteCost: routeCostResult.value.averageRouteCost,
    };
  }

  return ok({
    meta: {
      analyzedAt: new Date().toISOString(),
      framework: detection.framework,
      frameworkVersion: detection.version,
      sourceDir: options.sourceDir,
      buildDir,
    },
    bundles: bundleResult.value,
    dependencies,
    routes,
    frameworkSpecific,
    ...(architecture !== undefined && { architecture }),
    ...(runtime !== undefined && { runtime }),
    ...(routeCosts !== undefined && { routeCosts }),
  });
};

// Re-export utilities
export { detectFramework } from './detect.ts';
export { analyzeBundles, formatByteSize } from './bundles.ts';
export { analyzeNextJs } from './nextjs.ts';
export { analyzeDependencies } from './dependencies.ts';
export { parseManifest, parseNextJsManifest, parseViteManifest } from './manifests.ts';
export { analyzeArchitecture, describeArchitecture, describeHydration } from './architecture.ts';
export { analyzeRuntime, formatRuntimeBreakdown } from './runtime.ts';
export { analyzeRouteCosts, formatRouteCosts } from './routes.ts';
export { formatBytes, sumByteSizes, emptyByteSize } from './utils.ts';

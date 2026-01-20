/**
 * Static analysis module.
 * Analyzes build outputs to extract bundle sizes, routes, and framework-specific data.
 */

import type { Result, StaticAnalysis, RouteAnalysis } from '../types.ts';
import { ok, err } from '../result.ts';
import { detectFramework, type DetectionResult } from './detect.ts';
import { analyzeBundles } from './bundles.ts';
import { analyzeNextJs } from './nextjs.ts';

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

  // Analyze bundles
  const bundleResult = await analyzeBundles(buildDir);
  if (!bundleResult.ok) {
    return err({
      code: 'ANALYSIS_FAILED',
      message: bundleResult.error.message,
    });
  }

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

  return ok({
    meta: {
      analyzedAt: new Date().toISOString(),
      framework: detection.framework,
      frameworkVersion: detection.version,
      sourceDir: options.sourceDir,
      buildDir,
    },
    bundles: bundleResult.value,
    routes,
    frameworkSpecific,
  });
};

// Re-export utilities
export { detectFramework } from './detect.ts';
export { analyzeBundles, formatByteSize } from './bundles.ts';
export { analyzeNextJs } from './nextjs.ts';

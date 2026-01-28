/**
 * Framework manifest parsing for accurate vendor/framework detection.
 * 
 * Parses build manifests from Next.js and Vite (React Router) to identify:
 * - Framework chunks (core framework code)
 * - Vendor chunks (third-party dependencies)
 * - Route-to-chunk mappings
 */

import type { Result, FrameworkType } from '../types.ts';
import { ok, err } from '../result.ts';
import { readJson } from './utils.ts';

export interface ManifestError {
  readonly code: 'NOT_FOUND' | 'PARSE_ERROR';
  readonly message: string;
}

export interface ChunkClassification {
  readonly framework: readonly string[];
  readonly vendor: readonly string[];
  readonly app: readonly string[];
}

export interface RouteChunkMapping {
  readonly route: string;
  readonly chunks: readonly string[];
}

export interface ManifestAnalysis {
  readonly classification: ChunkClassification;
  readonly routeChunks: readonly RouteChunkMapping[];
  readonly entryChunks: readonly string[];
}

// Next.js build-manifest.json structure
interface NextBuildManifest {
  readonly polyfillFiles?: readonly string[];
  readonly rootMainFiles: readonly string[];
  readonly pages: Record<string, readonly string[]>;
  readonly ampFirstPages?: readonly string[];
}

// Vite manifest.json structure
interface ViteManifest {
  readonly [key: string]: {
    readonly file: string;
    readonly src?: string;
    readonly isEntry?: boolean;
    readonly isDynamicEntry?: boolean;
    readonly imports?: readonly string[];
    readonly dynamicImports?: readonly string[];
    readonly css?: readonly string[];
  };
}

const isFrameworkChunk = (chunkPath: string): boolean => {
  const lower = chunkPath.toLowerCase();
  return (
    lower.includes('framework') ||
    lower.includes('react-dom') ||
    lower.includes('react.') ||
    lower.includes('scheduler') ||
    lower.includes('webpack-runtime') ||
    lower.includes('_buildManifest') ||
    lower.includes('_ssgManifest')
  );
};

const isPolyfillChunk = (chunkPath: string): boolean => {
  const lower = chunkPath.toLowerCase();
  return lower.includes('polyfill');
};

/**
 * Parse Next.js build-manifest.json for chunk classification.
 */
export const parseNextJsManifest = async (
  buildDir: string
): Promise<Result<ManifestAnalysis, ManifestError>> => {
  const manifestPath = `${buildDir}/build-manifest.json`;
  const manifest = await readJson<NextBuildManifest>(manifestPath);

  if (!manifest) {
    return err({
      code: 'NOT_FOUND',
      message: `build-manifest.json not found at ${manifestPath}`,
    });
  }

  try {
    const framework: string[] = [];
    const vendor: string[] = [];
    const app: string[] = [];

    // rootMainFiles are framework/runtime chunks
    for (const chunk of manifest.rootMainFiles) {
      if (isFrameworkChunk(chunk)) {
        framework.push(chunk);
      } else if (isPolyfillChunk(chunk)) {
        vendor.push(chunk);
      } else {
        // Main app entry chunks
        app.push(chunk);
      }
    }

    // polyfillFiles are vendor
    if (manifest.polyfillFiles) {
      vendor.push(...manifest.polyfillFiles);
    }

    // Parse route-to-chunk mappings
    const routeChunks: RouteChunkMapping[] = Object.entries(manifest.pages)
      .filter(([route]) => !route.startsWith('/_'))
      .map(([route, chunks]) => ({
        route,
        chunks,
      }));

    // Categorize page chunks
    for (const [, chunks] of Object.entries(manifest.pages)) {
      for (const chunk of chunks) {
        if (!framework.includes(chunk) && !vendor.includes(chunk) && !app.includes(chunk)) {
          // Hash-only chunks in rootMainFiles are typically vendor splits
          const fileName = chunk.split('/').pop() ?? '';
          const baseName = fileName.replace(/\.[^.]+$/, '').replace(/-[a-f0-9]+$/, '');
          
          if (baseName === '' || /^[a-f0-9]+$/i.test(baseName)) {
            vendor.push(chunk);
          } else {
            app.push(chunk);
          }
        }
      }
    }

    return ok({
      classification: {
        framework: [...new Set(framework)],
        vendor: [...new Set(vendor)],
        app: [...new Set(app)],
      },
      routeChunks,
      entryChunks: manifest.rootMainFiles,
    });
  } catch (e) {
    return err({
      code: 'PARSE_ERROR',
      message: e instanceof Error ? e.message : 'Failed to parse Next.js manifest',
    });
  }
};

/**
 * Parse Vite manifest.json for chunk classification.
 * Used by React Router and other Vite-based frameworks.
 */
export const parseViteManifest = async (
  buildDir: string
): Promise<Result<ManifestAnalysis, ManifestError>> => {
  // Vite manifest can be in different locations
  const possiblePaths = [
    `${buildDir}/client/.vite/manifest.json`,
    `${buildDir}/.vite/manifest.json`,
    `${buildDir}/manifest.json`,
  ];

  let manifest: ViteManifest | null = null;
  for (const path of possiblePaths) {
    manifest = await readJson<ViteManifest>(path);
    if (manifest) break;
  }

  if (!manifest) {
    return err({
      code: 'NOT_FOUND',
      message: `Vite manifest.json not found in ${buildDir}`,
    });
  }

  try {
    const framework: string[] = [];
    const vendor: string[] = [];
    const app: string[] = [];
    const entryChunks: string[] = [];
    const routeChunks: RouteChunkMapping[] = [];

    for (const [key, entry] of Object.entries(manifest)) {
      const filePath = entry.file;
      
      if (entry.isEntry) {
        entryChunks.push(filePath);
        
        // Entry imports are typically framework/vendor
        if (entry.imports) {
          for (const imp of entry.imports) {
            const impEntry = manifest[imp];
            if (impEntry) {
              const impFile = impEntry.file;
              if (isFrameworkChunk(impFile)) {
                framework.push(impFile);
              } else {
                vendor.push(impFile);
              }
            }
          }
        }
      }

      // Classify the chunk itself
      if (isFrameworkChunk(filePath)) {
        framework.push(filePath);
      } else if (key.includes('node_modules') || filePath.includes('vendor')) {
        vendor.push(filePath);
      } else if (entry.src?.includes('routes/') || entry.src?.includes('app/')) {
        app.push(filePath);
        
        // Extract route from source path
        const routeMatch = entry.src?.match(/routes\/(.+)\.(tsx?|jsx?)$/);
        const matchedRoute = routeMatch?.[1];
        if (matchedRoute) {
          const routePath = '/' + matchedRoute.replace(/\$/g, ':').replace(/index$/, '');
          routeChunks.push({
            route: routePath || '/',
            chunks: [filePath, ...(entry.imports ?? []).map(i => manifest[i]?.file).filter(Boolean) as string[]],
          });
        }
      } else {
        app.push(filePath);
      }
    }

    return ok({
      classification: {
        framework: [...new Set(framework)],
        vendor: [...new Set(vendor)],
        app: [...new Set(app)],
      },
      routeChunks,
      entryChunks,
    });
  } catch (e) {
    return err({
      code: 'PARSE_ERROR',
      message: e instanceof Error ? e.message : 'Failed to parse Vite manifest',
    });
  }
};

/**
 * Parse manifest based on detected framework.
 */
export const parseManifest = async (
  buildDir: string,
  framework: FrameworkType
): Promise<Result<ManifestAnalysis, ManifestError>> => {
  if (framework === 'nextjs') {
    return parseNextJsManifest(buildDir);
  }

  if (framework === 'react-router' || framework === 'sveltekit') {
    return parseViteManifest(buildDir);
  }

  // Try both for unknown frameworks
  const nextResult = await parseNextJsManifest(buildDir);
  if (nextResult.ok) return nextResult;

  const viteResult = await parseViteManifest(buildDir);
  if (viteResult.ok) return viteResult;

  return err({
    code: 'NOT_FOUND',
    message: 'No supported manifest found',
  });
};

/**
 * Check if a chunk path is classified as vendor/framework.
 */
export const isVendorOrFramework = (
  chunkPath: string,
  classification: ChunkClassification
): boolean => {
  const normalized = chunkPath.replace(/^\//, '');
  return (
    classification.framework.some(f => normalized.includes(f) || f.includes(normalized)) ||
    classification.vendor.some(v => normalized.includes(v) || v.includes(normalized))
  );
};

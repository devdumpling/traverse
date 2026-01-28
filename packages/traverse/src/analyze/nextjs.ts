/**
 * Next.js specific analysis.
 * Parses .next/ build output to extract routes, manifests, and framework details.
 */

import { readFile, access } from 'node:fs/promises';
import type { Result, NextJsAnalysis, RouteAnalysis, RouterType } from '../types.ts';
import { ok, err } from '../result.ts';

export interface NextJsError {
  readonly code: 'NOT_NEXTJS' | 'MANIFEST_MISSING' | 'PARSE_ERROR';
  readonly message: string;
}

// Types for Next.js manifest files
interface RoutesManifest {
  version: number;
  appType?: 'app' | 'pages';
  staticRoutes: Array<{
    page: string;
    regex: string;
    routeKeys: Record<string, string>;
  }>;
  dynamicRoutes: Array<{
    page: string;
    regex: string;
    routeKeys: Record<string, string>;
  }>;
}

interface AppPathRoutesManifest {
  [key: string]: string;
}

interface BuildManifest {
  pages: Record<string, string[]>;
  rootMainFiles: string[];
  polyfillFiles: string[];
}

const readJson = async <T>(path: string): Promise<T | null> => {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Detect router type from manifests.
 */
const detectRouterType = async (buildDir: string): Promise<RouterType> => {
  const routesManifest = await readJson<RoutesManifest>(
    `${buildDir}/routes-manifest.json`
  );

  if (routesManifest?.appType === 'app') return 'app';

  // Check for app-path-routes-manifest (App Router indicator)
  const appRoutes = await readJson<AppPathRoutesManifest>(
    `${buildDir}/app-path-routes-manifest.json`
  );

  if (appRoutes && Object.keys(appRoutes).length > 0) {
    // If we also have pages, it's hybrid
    const buildManifest = await readJson<BuildManifest>(
      `${buildDir}/build-manifest.json`
    );
    const hasPages = buildManifest?.pages &&
      Object.keys(buildManifest.pages).some(p => p !== '/_app' && p !== '/_document');

    return hasPages ? 'hybrid' : 'app';
  }

  // Check for pages-manifest (Pages Router indicator)
  const pagesManifest = await fileExists(`${buildDir}/server/pages-manifest.json`);
  if (pagesManifest) return 'pages';

  return 'unknown';
};

/**
 * Parse route segments from a route path.
 */
const parseSegments = (routePath: string): string[] => {
  return routePath
    .split('/')
    .filter(Boolean)
    .map(segment => {
      // Handle dynamic segments like [id] or [...slug]
      if (segment.startsWith('[') && segment.endsWith(']')) {
        return segment;
      }
      return segment;
    });
};

/**
 * Determine route type from path.
 */
const getRouteType = (routePath: string): 'static' | 'dynamic' | 'catch-all' => {
  if (routePath.includes('[...') || routePath.includes('[[...')) {
    return 'catch-all';
  }
  if (routePath.includes('[')) {
    return 'dynamic';
  }
  return 'static';
};

/**
 * Parse routes from Next.js manifests.
 */
const parseRoutes = async (buildDir: string): Promise<RouteAnalysis[]> => {
  const routes: RouteAnalysis[] = [];

  // Parse routes-manifest.json for static and dynamic routes
  const routesManifest = await readJson<RoutesManifest>(
    `${buildDir}/routes-manifest.json`
  );

  if (routesManifest) {
    // Add static routes
    for (const route of routesManifest.staticRoutes) {
      // Skip internal routes
      if (route.page.startsWith('/_')) continue;

      routes.push({
        path: route.page,
        type: 'static',
        segments: parseSegments(route.page),
        chunks: [], // Would need build-manifest correlation
      });
    }

    // Add dynamic routes
    for (const route of routesManifest.dynamicRoutes) {
      if (route.page.startsWith('/_')) continue;

      routes.push({
        path: route.page,
        type: getRouteType(route.page),
        segments: parseSegments(route.page),
        chunks: [],
      });
    }
  }

  return routes;
};

/**
 * Analyze a Next.js build directory.
 */
export const analyzeNextJs = async (
  buildDir: string
): Promise<Result<NextJsAnalysis, NextJsError>> => {
  // Verify this is a Next.js build
  const buildIdExists = await fileExists(`${buildDir}/BUILD_ID`);
  if (!buildIdExists) {
    return err({
      code: 'NOT_NEXTJS',
      message: `${buildDir} does not appear to be a Next.js build (no BUILD_ID)`,
    });
  }

  try {
    const routerType = await detectRouterType(buildDir);
    const parsedRoutes = await parseRoutes(buildDir);

    // Check for middleware
    const hasMiddleware = await fileExists(`${buildDir}/server/middleware-manifest.json`);

    // Check for Turbopack (presence of turbopack file or specific chunks)
    const hasTurbopack = await fileExists(`${buildDir}/turbopack`);

    const routes = parsedRoutes.map(r => ({
      path: r.path,
      type: r.type === 'catch-all' ? 'dynamic' as const : r.type,
      segments: r.segments,
    }));

    return ok({
      routerType,
      routes,
      hasMiddleware,
      turbopack: hasTurbopack,
    });
  } catch (e) {
    return err({
      code: 'PARSE_ERROR',
      message: e instanceof Error ? e.message : 'Failed to parse Next.js manifests',
    });
  }
};

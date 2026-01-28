/**
 * Framework detection for static analysis.
 * Detects which framework built the application based on build output signatures.
 */

import { readFile, access } from 'node:fs/promises';
import type { Result } from '../types.ts';
import type { FrameworkType } from '../types.ts';
import { ok, err } from '../result.ts';

export interface DetectionResult {
  readonly framework: FrameworkType;
  readonly version: string | null;
  readonly buildDir: string | null;
}

export interface DetectionError {
  readonly code: 'DETECTION_FAILED' | 'DIR_NOT_FOUND';
  readonly message: string;
}

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const readJson = async <T>(path: string): Promise<T | null> => {
  try {
    const content = await readFile(path, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};

const getPackageVersion = (
  pkg: PackageJson,
  name: string
): string | null => {
  const version = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
  if (!version) return null;
  // Strip leading ^ or ~ from semver
  return version.replace(/^[\^~]/, '');
};

const detectNextJs = async (
  sourceDir: string
): Promise<DetectionResult | null> => {
  // Check for .next directory (production build)
  const nextDirExists = await fileExists(`${sourceDir}/.next/BUILD_ID`);

  // Check for next in package.json
  const pkg = await readJson<PackageJson>(`${sourceDir}/package.json`);
  const hasNext = pkg && (
    pkg.dependencies?.['next'] !== undefined ||
    pkg.devDependencies?.['next'] !== undefined
  );

  if (!nextDirExists && !hasNext) return null;

  const version = pkg ? getPackageVersion(pkg, 'next') : null;

  return {
    framework: 'nextjs',
    version,
    buildDir: nextDirExists ? `${sourceDir}/.next` : null,
  };
};

const detectReactRouter = async (
  sourceDir: string
): Promise<DetectionResult | null> => {
  // Check for build directory (React Router framework mode)
  const buildExists = await fileExists(`${sourceDir}/build/server/index.js`);

  // Check for react-router in package.json
  const pkg = await readJson<PackageJson>(`${sourceDir}/package.json`);
  const hasReactRouter = pkg && (
    pkg.dependencies?.['react-router'] !== undefined ||
    pkg.devDependencies?.['react-router'] !== undefined ||
    pkg.dependencies?.['@react-router/node'] !== undefined
  );

  if (!buildExists && !hasReactRouter) return null;

  const version = pkg ? getPackageVersion(pkg, 'react-router') : null;

  return {
    framework: 'react-router',
    version,
    buildDir: buildExists ? `${sourceDir}/build` : null,
  };
};

const detectGenericSpa = async (
  sourceDir: string
): Promise<DetectionResult | null> => {
  // Check for common SPA build directories
  const distExists = await fileExists(`${sourceDir}/dist/index.html`);
  const buildExists = await fileExists(`${sourceDir}/build/index.html`);

  // Check for React in package.json (but not Next.js or React Router)
  const pkg = await readJson<PackageJson>(`${sourceDir}/package.json`);
  const hasReact = pkg && (
    pkg.dependencies?.['react'] !== undefined ||
    pkg.devDependencies?.['react'] !== undefined
  );

  if (!distExists && !buildExists && !hasReact) return null;

  const buildDir = distExists ? `${sourceDir}/dist`
    : buildExists ? `${sourceDir}/build`
    : null;

  return {
    framework: 'generic-spa',
    version: null,
    buildDir,
  };
};

/**
 * Detect the framework used to build an application.
 * Checks for framework-specific signatures in build output and package.json.
 */
export const detectFramework = async (
  sourceDir: string
): Promise<Result<DetectionResult, DetectionError>> => {
  // Check if directory exists
  const pkgExists = await fileExists(`${sourceDir}/package.json`);
  if (!pkgExists) {
    return err({
      code: 'DIR_NOT_FOUND',
      message: `No package.json found in ${sourceDir}`,
    });
  }

  // Try detection in order of specificity (most specific first)
  const nextResult = await detectNextJs(sourceDir);
  if (nextResult) return ok(nextResult);

  const rrResult = await detectReactRouter(sourceDir);
  if (rrResult) return ok(rrResult);

  const spaResult = await detectGenericSpa(sourceDir);
  if (spaResult) return ok(spaResult);

  // Unknown framework
  return ok({
    framework: 'unknown',
    version: null,
    buildDir: null,
  });
};

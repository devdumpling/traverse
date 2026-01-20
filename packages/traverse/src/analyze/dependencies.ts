/**
 * Dependency analysis.
 * Parses package.json to extract dependency counts.
 */

import type { Result, DependencyCount } from '../types.ts';
import { ok, err } from '../result.ts';

export interface DependencyError {
  readonly code: 'NO_PACKAGE_JSON' | 'INVALID_PACKAGE_JSON';
  readonly message: string;
}

interface PackageJson {
  readonly name?: string;
  readonly dependencies?: Record<string, string>;
  readonly devDependencies?: Record<string, string>;
  readonly peerDependencies?: Record<string, string>;
}

/**
 * Analyze dependencies from package.json.
 */
export const analyzeDependencies = async (
  sourceDir: string
): Promise<Result<DependencyCount, DependencyError>> => {
  const packageJsonPath = `${sourceDir}/package.json`;
  const file = Bun.file(packageJsonPath);
  
  const exists = await file.exists();
  if (!exists) {
    return err({
      code: 'NO_PACKAGE_JSON',
      message: `No package.json found in ${sourceDir}`,
    });
  }

  try {
    const content = await file.text();
    const pkg = JSON.parse(content) as PackageJson;

    const deps = Object.keys(pkg.dependencies ?? {});
    const devDeps = Object.keys(pkg.devDependencies ?? {});

    // Get top dependencies (most significant for bundle size)
    // Prioritize known large dependencies
    const knownLarge = [
      'react', 'react-dom', 'next', 'react-router', 'react-router-dom',
      '@remix-run/react', 'lodash', 'moment', 'date-fns', 'axios',
      'framer-motion', 'three', 'd3', 'chart.js', 'recharts',
      '@tanstack/react-query', 'zustand', 'redux', '@reduxjs/toolkit',
      'tailwindcss', '@emotion/react', 'styled-components',
    ];

    const topDeps = deps
      .filter(d => knownLarge.some(k => d.includes(k)))
      .slice(0, 10);

    // If not enough known large deps, add the first ones alphabetically
    if (topDeps.length < 10) {
      const remaining = deps
        .filter(d => !topDeps.includes(d))
        .slice(0, 10 - topDeps.length);
      topDeps.push(...remaining);
    }

    return ok({
      dependencies: deps.length,
      devDependencies: devDeps.length,
      total: deps.length + devDeps.length,
      topDependencies: topDeps,
    });
  } catch (e) {
    return err({
      code: 'INVALID_PACKAGE_JSON',
      message: `Failed to parse package.json: ${e instanceof Error ? e.message : 'unknown error'}`,
    });
  }
};

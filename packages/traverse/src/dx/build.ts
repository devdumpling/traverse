/**
 * Build time measurement.
 * 
 * Measures cold build time by:
 * 1. Cleaning build caches
 * 2. Running the build command
 * 3. Measuring elapsed time
 */

import type { Result } from '../types.ts';
import { ok, err } from '../result.ts';

export interface BuildMetrics {
  readonly coldBuildTime: number;
  readonly command: string;
  readonly exitCode: number;
  readonly cacheCleared: boolean;
}

export interface BuildError {
  readonly code: 'BUILD_FAILED' | 'COMMAND_NOT_FOUND' | 'TIMEOUT';
  readonly message: string;
  readonly exitCode?: number;
}

export interface BuildOptions {
  readonly projectDir: string;
  readonly buildCommand?: string;
  readonly clearCache?: boolean;
  readonly timeout?: number;
}

// Framework-specific cache directories
const CACHE_DIRS: Record<string, readonly string[]> = {
  nextjs: ['.next', 'node_modules/.cache'],
  'react-router': ['build', '.cache', 'node_modules/.cache'],
  vite: ['dist', 'node_modules/.vite'],
  generic: ['node_modules/.cache', 'dist', 'build'],
};

// Framework-specific build commands
const BUILD_COMMANDS: Record<string, string> = {
  nextjs: 'npm run build',
  'react-router': 'npm run build',
  vite: 'npm run build',
  generic: 'npm run build',
};

/**
 * Detect the framework and return appropriate cache dirs and build command.
 */
const detectBuildConfig = async (
  projectDir: string
): Promise<{ cacheDirs: readonly string[]; buildCommand: string }> => {
  const packageJsonPath = `${projectDir}/package.json`;
  const file = Bun.file(packageJsonPath);
  
  if (!(await file.exists())) {
    return { cacheDirs: CACHE_DIRS.generic, buildCommand: BUILD_COMMANDS.generic };
  }

  try {
    const content = await file.text();
    const pkg = JSON.parse(content);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if ('next' in deps) {
      return { cacheDirs: CACHE_DIRS.nextjs, buildCommand: BUILD_COMMANDS.nextjs };
    }
    if ('@react-router/dev' in deps || 'react-router' in deps) {
      return { cacheDirs: CACHE_DIRS['react-router'], buildCommand: BUILD_COMMANDS['react-router'] };
    }
    if ('vite' in deps) {
      return { cacheDirs: CACHE_DIRS.vite, buildCommand: BUILD_COMMANDS.vite };
    }
  } catch {
    // Ignore parse errors
  }

  return { cacheDirs: CACHE_DIRS.generic, buildCommand: BUILD_COMMANDS.generic };
};

/**
 * Check if a path exists (file or directory).
 */
const pathExists = async (path: string): Promise<boolean> => {
  try {
    const { stat } = await import('fs/promises');
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Clear build caches for a project.
 */
const clearCaches = async (projectDir: string, cacheDirs: readonly string[]): Promise<boolean> => {
  let cleared = false;

  for (const dir of cacheDirs) {
    const fullPath = `${projectDir}/${dir}`;
    try {
      const exists = await pathExists(fullPath);
      if (exists) {
        // Use rm -rf via shell since Bun doesn't have recursive delete
        const proc = Bun.spawn(['rm', '-rf', fullPath], {
          cwd: projectDir,
          stdout: 'ignore',
          stderr: 'ignore',
        });
        await proc.exited;
        cleared = true;
      }
    } catch {
      // Ignore errors
    }
  }

  return cleared;
};

/**
 * Measure cold build time for a project.
 */
export const measureColdBuild = async (
  options: BuildOptions
): Promise<Result<BuildMetrics, BuildError>> => {
  const { projectDir, timeout = 300000 } = options; // 5 minute default timeout
  
  const config = await detectBuildConfig(projectDir);
  const buildCommand = options.buildCommand ?? config.buildCommand;

  // Clear caches if requested (default true)
  const shouldClearCache = options.clearCache !== false;
  let cacheCleared = false;
  
  if (shouldClearCache) {
    cacheCleared = await clearCaches(projectDir, config.cacheDirs);
  }

  // Parse command into parts
  const parts = buildCommand.split(' ');
  const cmd = parts[0];
  const args = parts.slice(1);

  if (!cmd) {
    return err({
      code: 'COMMAND_NOT_FOUND',
      message: 'No build command specified',
    });
  }

  // Run build and measure time
  const startTime = performance.now();

  try {
    const proc = Bun.spawn([cmd, ...args], {
      cwd: projectDir,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        ...process.env,
        // Ensure consistent environment
        CI: 'true',
        FORCE_COLOR: '0',
      },
    });

    // Set up timeout
    const timeoutId = setTimeout(() => {
      proc.kill();
    }, timeout);

    const exitCode = await proc.exited;
    clearTimeout(timeoutId);

    const endTime = performance.now();
    const coldBuildTime = endTime - startTime;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return err({
        code: 'BUILD_FAILED',
        message: `Build failed with exit code ${exitCode}: ${stderr.slice(0, 500)}`,
        exitCode,
      });
    }

    return ok({
      coldBuildTime,
      command: buildCommand,
      exitCode,
      cacheCleared,
    });
  } catch (e) {
    return err({
      code: 'BUILD_FAILED',
      message: e instanceof Error ? e.message : 'Build failed',
    });
  }
};

/**
 * Format build time for display.
 */
export const formatBuildTime = (ms: number): string => {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
};

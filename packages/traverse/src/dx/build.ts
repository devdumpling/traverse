/**
 * Build time measurement.
 *
 * Measures cold build time by:
 * 1. Cleaning build caches
 * 2. Running the build command
 * 3. Measuring elapsed time
 */

import { readFile, stat, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import type { EventEmitter } from 'node:events';
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

  try {
    const content = await readFile(packageJsonPath, 'utf-8');
    const pkg = JSON.parse(content);
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if ('next' in deps) {
      return { cacheDirs: CACHE_DIRS['nextjs'] ?? [], buildCommand: BUILD_COMMANDS['nextjs'] ?? 'npm run build' };
    }
    if ('@react-router/dev' in deps || 'react-router' in deps) {
      return { cacheDirs: CACHE_DIRS['react-router'] ?? [], buildCommand: BUILD_COMMANDS['react-router'] ?? 'npm run build' };
    }
    if ('vite' in deps) {
      return { cacheDirs: CACHE_DIRS['vite'] ?? [], buildCommand: BUILD_COMMANDS['vite'] ?? 'npm run build' };
    }
  } catch {
    // Ignore errors
  }

  return { cacheDirs: CACHE_DIRS['generic'] ?? [], buildCommand: BUILD_COMMANDS['generic'] ?? 'npm run build' };
};

/**
 * Check if a path exists (file or directory).
 */
const pathExists = async (path: string): Promise<boolean> => {
  try {
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
        await rm(fullPath, { recursive: true, force: true });
        cleared = true;
      }
    } catch {
      // Ignore errors
    }
  }

  return cleared;
};

/**
 * Run a command and return the result.
 */
const runCommand = (
  cmd: string,
  args: string[],
  options: { cwd: string; timeout: number; env?: NodeJS.ProcessEnv }
): Promise<{ exitCode: number; stderr: string }> => {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd: options.cwd,
      env: options.env,
      shell: true,
    });

    let stderr = '';
    proc.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    const timeoutId = setTimeout(() => {
      proc.kill();
      reject(new Error('Command timed out'));
    }, options.timeout);

    (proc as unknown as EventEmitter).on('close', (code: number | null) => {
      clearTimeout(timeoutId);
      resolve({ exitCode: code ?? 1, stderr });
    });

    (proc as unknown as EventEmitter).on('error', (e: Error) => {
      clearTimeout(timeoutId);
      reject(e);
    });
  });
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
    const result = await runCommand(cmd, args, {
      cwd: projectDir,
      timeout,
      env: {
        ...process.env,
        CI: 'true',
        FORCE_COLOR: '0',
      },
    });

    const endTime = performance.now();
    const coldBuildTime = endTime - startTime;

    if (result.exitCode !== 0) {
      return err({
        code: 'BUILD_FAILED',
        message: `Build failed with exit code ${result.exitCode}: ${result.stderr.slice(0, 500)}`,
        exitCode: result.exitCode,
      });
    }

    return ok({
      coldBuildTime,
      command: buildCommand,
      exitCode: result.exitCode,
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

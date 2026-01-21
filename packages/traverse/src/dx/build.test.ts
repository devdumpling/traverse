/**
 * Tests for build time measurement.
 */

import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { measureColdBuild, formatBuildTime } from './build.ts';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';

const TEST_DIR = join(import.meta.dir, '__test_build__');

describe('build', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('measureColdBuild', () => {
    test('clears cache directories when they exist', async () => {
      // Create a fake project with cache directory
      await writeFile(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'test', scripts: { build: 'echo done' } })
      );
      
      // Create a cache directory that should be cleared
      const cacheDir = join(TEST_DIR, 'node_modules/.cache');
      await mkdir(cacheDir, { recursive: true });
      await writeFile(join(cacheDir, 'test.txt'), 'cached data');

      const result = await measureColdBuild({
        projectDir: TEST_DIR,
        buildCommand: 'echo build-complete',
        clearCache: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.cacheCleared).toBe(true);
      }

      // Verify cache was actually deleted
      const { stat } = await import('fs/promises');
      let cacheExists = true;
      try {
        await stat(cacheDir);
      } catch {
        cacheExists = false;
      }
      expect(cacheExists).toBe(false);
    });

    test('reports cacheCleared=false when no cache directories exist', async () => {
      // Create a minimal project with no cache
      await writeFile(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'test', scripts: { build: 'echo done' } })
      );

      const result = await measureColdBuild({
        projectDir: TEST_DIR,
        buildCommand: 'echo build-complete',
        clearCache: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.cacheCleared).toBe(false);
      }
    });

    test('skips cache clearing when clearCache=false', async () => {
      // Create project with cache
      await writeFile(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'test', scripts: { build: 'echo done' } })
      );
      
      const cacheDir = join(TEST_DIR, 'node_modules/.cache');
      await mkdir(cacheDir, { recursive: true });
      await writeFile(join(cacheDir, 'test.txt'), 'cached data');

      const result = await measureColdBuild({
        projectDir: TEST_DIR,
        buildCommand: 'echo build-complete',
        clearCache: false,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.cacheCleared).toBe(false);
      }

      // Verify cache was NOT deleted
      const { stat } = await import('fs/promises');
      const cacheExists = await stat(cacheDir).then(() => true).catch(() => false);
      expect(cacheExists).toBe(true);
    });

    test('clears Next.js .next directory', async () => {
      // Create a Next.js project
      await writeFile(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({
          name: 'test-next',
          dependencies: { next: '16.0.0' },
          scripts: { build: 'echo done' },
        })
      );
      
      // Create .next cache directory
      const nextDir = join(TEST_DIR, '.next');
      await mkdir(nextDir, { recursive: true });
      await writeFile(join(nextDir, 'BUILD_ID'), '123');

      const result = await measureColdBuild({
        projectDir: TEST_DIR,
        buildCommand: 'echo build-complete',
        clearCache: true,
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.cacheCleared).toBe(true);
      }

      // Verify .next was deleted
      const { stat } = await import('fs/promises');
      const nextExists = await stat(nextDir).then(() => true).catch(() => false);
      expect(nextExists).toBe(false);
    });

    test('measures build time', async () => {
      await writeFile(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'test' })
      );

      const result = await measureColdBuild({
        projectDir: TEST_DIR,
        buildCommand: 'sleep 0.1',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        // Should take at least 100ms
        expect(result.value.coldBuildTime).toBeGreaterThan(50);
        expect(result.value.command).toBe('sleep 0.1');
        expect(result.value.exitCode).toBe(0);
      }
    });

    test('returns error for failed build', async () => {
      await writeFile(
        join(TEST_DIR, 'package.json'),
        JSON.stringify({ name: 'test' })
      );

      // 'false' is a shell command that always exits with code 1
      const result = await measureColdBuild({
        projectDir: TEST_DIR,
        buildCommand: 'false',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('BUILD_FAILED');
        expect(result.error.exitCode).toBe(1);
      }
    });
  });

  describe('formatBuildTime', () => {
    test('formats milliseconds', () => {
      expect(formatBuildTime(500)).toBe('500ms');
      expect(formatBuildTime(999)).toBe('999ms');
    });

    test('formats seconds', () => {
      expect(formatBuildTime(1000)).toBe('1.0s');
      expect(formatBuildTime(5500)).toBe('5.5s');
      expect(formatBuildTime(59999)).toBe('60.0s');
    });

    test('formats minutes', () => {
      expect(formatBuildTime(60000)).toBe('1m 0s');
      expect(formatBuildTime(90000)).toBe('1m 30s');
      expect(formatBuildTime(125000)).toBe('2m 5s');
    });
  });
});

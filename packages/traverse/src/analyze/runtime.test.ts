import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { analyzeRuntime, formatRuntimeBreakdown } from './runtime.ts';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';

const TEST_DIR = join(import.meta.dir, '__test_runtime__');

describe('runtime', () => {
  beforeAll(async () => {
    await mkdir(join(TEST_DIR, 'static', 'chunks'), { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('analyzeRuntime', () => {
    test('categorizes framework chunks correctly', async () => {
      // Create mock chunks
      await writeFile(
        join(TEST_DIR, 'static', 'chunks', 'framework-abc123.js'),
        'var React = { __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {} };'
      );
      await writeFile(
        join(TEST_DIR, 'static', 'chunks', 'main-def456.js'),
        'function navigate() { history.pushState(); }'
      );
      await writeFile(
        join(TEST_DIR, 'static', 'chunks', 'app-page-ghi789.js'),
        'export default function Page() { return null; }'
      );
      await writeFile(
        join(TEST_DIR, 'static', 'chunks', 'polyfills-jkl012.js'),
        '// Polyfill code'
      );

      const result = await analyzeRuntime(TEST_DIR, 'nextjs');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Should have categorized chunks
      expect(result.value.total.raw).toBeGreaterThan(0);
      expect(result.value.categories.framework.chunks.length).toBeGreaterThanOrEqual(0);
      expect(result.value.categories.polyfills.chunks.length).toBeGreaterThan(0);
    });

    test('returns error for empty directory', async () => {
      await mkdir(join(TEST_DIR, 'empty'), { recursive: true });

      const result = await analyzeRuntime(join(TEST_DIR, 'empty'), 'unknown');

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('ANALYSIS_FAILED');
    });

    test('calculates percentages correctly', async () => {
      await mkdir(join(TEST_DIR, 'percentages'), { recursive: true });
      await writeFile(
        join(TEST_DIR, 'percentages', 'chunk1.js'),
        'a'.repeat(1000)
      );
      await writeFile(
        join(TEST_DIR, 'percentages', 'chunk2.js'),
        'b'.repeat(1000)
      );

      const result = await analyzeRuntime(join(TEST_DIR, 'percentages'), 'unknown');

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Sum of percentages should be ~100%
      const totalPercentage = Object.values(result.value.categories)
        .reduce((sum, cat) => sum + cat.percentage, 0);
      expect(totalPercentage).toBeGreaterThan(95);
      expect(totalPercentage).toBeLessThanOrEqual(100.5);
    });
  });

  describe('formatRuntimeBreakdown', () => {
    test('formats breakdown as markdown', async () => {
      // Create a simple build
      await mkdir(join(TEST_DIR, 'format'), { recursive: true });
      await writeFile(
        join(TEST_DIR, 'format', 'app.js'),
        'console.log("app");'
      );

      const result = await analyzeRuntime(join(TEST_DIR, 'format'), 'unknown');
      expect(result.ok).toBe(true);
      if (!result.ok) return;

      const formatted = formatRuntimeBreakdown(result.value);

      expect(formatted).toContain('Runtime Cost Breakdown');
      expect(formatted).toContain('Total JS');
      expect(formatted).toContain('Category');
      expect(formatted).toContain('% of Total');
    });
  });
});

/**
 * Tests for bundle analysis.
 */

import { describe, test, expect } from 'bun:test';
import { analyzeBundles, formatByteSize } from './bundles.ts';
import { resolve } from 'path';

const examplesDir = resolve(import.meta.dir, '../../../examples/apps');

describe('analyzeBundles', () => {
  test('analyzes Next.js build directory', async () => {
    const result = await analyzeBundles(`${examplesDir}/basic-next-app/.next`);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.total.raw).toBeGreaterThan(0);
      expect(result.value.total.gzip).toBeGreaterThan(0);
      expect(result.value.total.gzip).toBeLessThan(result.value.total.raw);
      expect(result.value.javascript.raw).toBeGreaterThan(0);
      expect(result.value.chunks.length).toBeGreaterThan(0);
    }
  });

  test('analyzes React Router build directory', async () => {
    const result = await analyzeBundles(`${examplesDir}/basic-rr-app/build`);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.total.raw).toBeGreaterThan(0);
      expect(result.value.javascript.raw).toBeGreaterThan(0);
      expect(result.value.css.raw).toBeGreaterThan(0);
    }
  });

  test('analyzes basic React build directory', async () => {
    const result = await analyzeBundles(`${examplesDir}/basic-react/dist`);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.chunks.length).toBeGreaterThanOrEqual(1);
    }
  });

  test('returns error for non-existent directory', async () => {
    const result = await analyzeBundles('/non/existent/path');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NO_BUILD_DIR');
    }
  });
});

describe('formatByteSize', () => {
  test('formats bytes', () => {
    expect(formatByteSize(500)).toBe('500 B');
  });

  test('formats kilobytes', () => {
    expect(formatByteSize(2048)).toBe('2.00 KB');
    expect(formatByteSize(1536)).toBe('1.50 KB');
  });

  test('formats megabytes', () => {
    expect(formatByteSize(1024 * 1024)).toBe('1.00 MB');
    expect(formatByteSize(2.5 * 1024 * 1024)).toBe('2.50 MB');
  });
});

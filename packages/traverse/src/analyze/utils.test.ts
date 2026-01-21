import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import {
  readJson,
  fileExists,
  calculateByteSize,
  calculateByteSizeFromFile,
  sumByteSizes,
  emptyByteSize,
  formatBytes,
} from './utils.ts';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';

const TEST_DIR = join(import.meta.dir, '__test_utils__');

describe('utils', () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('readJson', () => {
    test('reads and parses valid JSON', async () => {
      const data = { foo: 'bar', num: 42 };
      await writeFile(join(TEST_DIR, 'valid.json'), JSON.stringify(data));

      const result = await readJson<typeof data>(join(TEST_DIR, 'valid.json'));
      expect(result).toEqual(data);
    });

    test('returns null for missing file', async () => {
      const result = await readJson(join(TEST_DIR, 'missing.json'));
      expect(result).toBeNull();
    });

    test('returns null for invalid JSON', async () => {
      await writeFile(join(TEST_DIR, 'invalid.json'), 'not json');

      const result = await readJson(join(TEST_DIR, 'invalid.json'));
      expect(result).toBeNull();
    });
  });

  describe('fileExists', () => {
    test('returns true for existing file', async () => {
      await writeFile(join(TEST_DIR, 'exists.txt'), 'content');

      const result = await fileExists(join(TEST_DIR, 'exists.txt'));
      expect(result).toBe(true);
    });

    test('returns false for missing file', async () => {
      const result = await fileExists(join(TEST_DIR, 'missing.txt'));
      expect(result).toBe(false);
    });
  });

  describe('calculateByteSize', () => {
    test('calculates sizes correctly', () => {
      const content = new Uint8Array(Buffer.from('hello world'.repeat(100)));
      const size = calculateByteSize(content);

      expect(size.raw).toBe(content.length);
      expect(size.gzip).toBeLessThan(size.raw); // Gzip should compress
      expect(size.brotli).toBeLessThan(size.gzip); // Brotli estimate < gzip
    });

    test('handles empty content', () => {
      const size = calculateByteSize(new Uint8Array(0));

      expect(size.raw).toBe(0);
      expect(size.gzip).toBeGreaterThanOrEqual(0);
    });
  });

  describe('calculateByteSizeFromFile', () => {
    test('calculates size from file', async () => {
      const content = 'test content'.repeat(50);
      await writeFile(join(TEST_DIR, 'sized.txt'), content);

      const size = await calculateByteSizeFromFile(join(TEST_DIR, 'sized.txt'));

      expect(size).not.toBeNull();
      expect(size!.raw).toBe(content.length);
    });

    test('returns null for missing file', async () => {
      const size = await calculateByteSizeFromFile(join(TEST_DIR, 'missing.txt'));
      expect(size).toBeNull();
    });
  });

  describe('sumByteSizes', () => {
    test('sums multiple sizes', () => {
      const sizes = [
        { raw: 100, gzip: 50, brotli: 45 },
        { raw: 200, gzip: 100, brotli: 90 },
        { raw: 300, gzip: 150, brotli: 135 },
      ];

      const sum = sumByteSizes(sizes);

      expect(sum.raw).toBe(600);
      expect(sum.gzip).toBe(300);
      expect(sum.brotli).toBe(270);
    });

    test('returns zeros for empty array', () => {
      const sum = sumByteSizes([]);

      expect(sum.raw).toBe(0);
      expect(sum.gzip).toBe(0);
      expect(sum.brotli).toBe(0);
    });
  });

  describe('emptyByteSize', () => {
    test('returns zeroed object', () => {
      const empty = emptyByteSize();

      expect(empty.raw).toBe(0);
      expect(empty.gzip).toBe(0);
      expect(empty.brotli).toBe(0);
    });
  });

  describe('formatBytes', () => {
    test('formats bytes', () => {
      expect(formatBytes(500)).toBe('500 B');
    });

    test('formats kilobytes', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(10240)).toBe('10.0 KB');
    });

    test('formats megabytes', () => {
      expect(formatBytes(1048576)).toBe('1.00 MB');
      expect(formatBytes(2621440)).toBe('2.50 MB');
    });

    test('handles zero', () => {
      expect(formatBytes(0)).toBe('0 B');
    });
  });
});

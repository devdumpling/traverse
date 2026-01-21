/**
 * Shared utilities for static analysis modules.
 */

import { gzipSync } from 'bun';
import type { ByteSize } from '../types.ts';

/**
 * Read and parse a JSON file, returning null if it fails.
 */
export const readJson = async <T>(path: string): Promise<T | null> => {
  try {
    const content = await Bun.file(path).text();
    return JSON.parse(content) as T;
  } catch {
    return null;
  }
};

/**
 * Check if a file exists by attempting to read it.
 */
export const fileExists = async (path: string): Promise<boolean> => {
  try {
    const file = Bun.file(path);
    return await file.exists();
  } catch {
    return false;
  }
};

/**
 * Calculate raw, gzip, and brotli sizes for content.
 * Brotli is estimated as ~85% of gzip size.
 */
export const calculateByteSize = (content: Uint8Array): ByteSize => {
  const raw = content.length;
  const gzipped = gzipSync(content, { level: 9 });
  const gzip = gzipped.length;
  // Brotli typically achieves ~15% better compression than gzip
  const brotli = Math.round(gzip * 0.85);
  return { raw, gzip, brotli };
};

/**
 * Calculate byte size from a file path.
 */
export const calculateByteSizeFromFile = async (filePath: string): Promise<ByteSize | null> => {
  try {
    const content = new Uint8Array(await Bun.file(filePath).arrayBuffer());
    return calculateByteSize(content);
  } catch {
    return null;
  }
};

/**
 * Sum multiple ByteSize objects.
 */
export const sumByteSizes = (sizes: readonly ByteSize[]): ByteSize => ({
  raw: sizes.reduce((sum, s) => sum + s.raw, 0),
  gzip: sizes.reduce((sum, s) => sum + s.gzip, 0),
  brotli: sizes.reduce((sum, s) => sum + s.brotli, 0),
});

/**
 * Create an empty ByteSize object.
 */
export const emptyByteSize = (): ByteSize => ({ raw: 0, gzip: 0, brotli: 0 });

/**
 * Format bytes for human-readable display.
 */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

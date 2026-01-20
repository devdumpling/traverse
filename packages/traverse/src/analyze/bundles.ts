/**
 * Bundle size analysis.
 * Calculates raw, gzip, and brotli sizes for JavaScript and CSS bundles.
 */

import { gzipSync } from 'bun';
import type { ByteSize, ChunkAnalysis, BundleAnalysis, Result } from '../types.ts';
import { ok, err } from '../result.ts';

export interface BundleError {
  readonly code: 'NO_BUILD_DIR' | 'ANALYSIS_FAILED';
  readonly message: string;
}

interface FileInfo {
  readonly path: string;
  readonly name: string;
  readonly content: Uint8Array;
  readonly type: 'js' | 'css' | 'other';
}

const getFileType = (path: string): 'js' | 'css' | 'other' => {
  if (path.endsWith('.js') || path.endsWith('.mjs')) return 'js';
  if (path.endsWith('.css')) return 'css';
  return 'other';
};

const calculateByteSize = (content: Uint8Array): ByteSize => {
  const raw = content.length;
  
  // gzip compression
  const gzipped = gzipSync(content, { level: 9 });
  const gzip = gzipped.length;
  
  // Brotli - Bun doesn't have native brotli, estimate as ~85% of gzip
  // In production, you'd use a brotli library
  const brotli = Math.round(gzip * 0.85);
  
  return { raw, gzip, brotli };
};

const sumByteSizes = (sizes: readonly ByteSize[]): ByteSize => ({
  raw: sizes.reduce((sum, s) => sum + s.raw, 0),
  gzip: sizes.reduce((sum, s) => sum + s.gzip, 0),
  brotli: sizes.reduce((sum, s) => sum + s.brotli, 0),
});

const emptyByteSize = (): ByteSize => ({ raw: 0, gzip: 0, brotli: 0 });

/**
 * Recursively find all files matching extensions in a directory.
 */
const findFiles = async (
  dir: string,
  extensions: readonly string[]
): Promise<string[]> => {
  const results: string[] = [];
  
  const processDir = async (currentDir: string): Promise<void> => {
    try {
      const entries = await Array.fromAsync(
        new Bun.Glob(`**/*{${extensions.join(',')}}`).scan({
          cwd: currentDir,
          absolute: true,
        })
      );
      results.push(...entries);
    } catch {
      // Directory doesn't exist or can't be read
    }
  };

  await processDir(dir);
  return results;
};

/**
 * Check if a file path should be included in client bundle analysis.
 * Excludes server-side files, source maps, and other non-client assets.
 */
const isClientBundle = (path: string, buildDir: string): boolean => {
  const relativePath = path.replace(buildDir + '/', '');
  
  // Exclude source maps
  if (path.endsWith('.map')) return false;
  
  // Next.js specific: only include static/ directory for client bundles
  if (buildDir.endsWith('.next')) {
    // Include: static/chunks/, static/css/, static/media/
    // Exclude: server/, cache/, build/
    return relativePath.startsWith('static/');
  }
  
  // React Router: include client/ directory
  if (relativePath.startsWith('server/')) return false;
  
  return true;
};

/**
 * Read file info for all JS and CSS files in a directory.
 * Filters to only include client-side bundles.
 */
const readBundleFiles = async (buildDir: string): Promise<FileInfo[]> => {
  const files = await findFiles(buildDir, ['.js', '.mjs', '.css']);
  
  const fileInfos: FileInfo[] = [];
  
  for (const path of files) {
    // Skip non-client bundles
    if (!isClientBundle(path, buildDir)) continue;
    
    try {
      const file = Bun.file(path);
      const content = new Uint8Array(await file.arrayBuffer());
      const name = path.replace(buildDir + '/', '');
      
      fileInfos.push({
        path,
        name,
        content,
        type: getFileType(path),
      });
    } catch {
      // Skip files that can't be read
    }
  }
  
  return fileInfos;
};

/**
 * Analyze bundles in a build directory.
 * Returns size information for all JavaScript and CSS files.
 */
export const analyzeBundles = async (
  buildDir: string
): Promise<Result<BundleAnalysis, BundleError>> => {
  try {
    const files = await readBundleFiles(buildDir);
    
    if (files.length === 0) {
      return err({
        code: 'NO_BUILD_DIR',
        message: `No JS or CSS files found in ${buildDir}`,
      });
    }

    const jsFiles = files.filter(f => f.type === 'js');
    const cssFiles = files.filter(f => f.type === 'css');

    // Calculate sizes for each file
    const chunks: ChunkAnalysis[] = files.map(file => {
      const size = calculateByteSize(file.content);
      return {
        id: file.name,
        path: file.path,
        size,
        shared: file.name.includes('chunk') || file.name.includes('vendor'),
        loadedBy: [], // Would need manifest parsing to determine this
      };
    });

    // Calculate totals
    const jsSizes = jsFiles.map(f => calculateByteSize(f.content));
    const cssSizes = cssFiles.map(f => calculateByteSize(f.content));
    
    const javascript = sumByteSizes(jsSizes);
    const css = sumByteSizes(cssSizes);
    const total = sumByteSizes([javascript, css]);

    return ok({
      total,
      javascript,
      css,
      entries: [], // Would need manifest parsing to determine entry points
      chunks,
      duplicates: [], // Would need source map analysis
    });
  } catch (e) {
    return err({
      code: 'ANALYSIS_FAILED',
      message: e instanceof Error ? e.message : 'Bundle analysis failed',
    });
  }
};

/**
 * Format byte size for display.
 */
export const formatByteSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

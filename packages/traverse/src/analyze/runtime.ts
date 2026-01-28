/**
 * Runtime cost breakdown analysis.
 *
 * Categorizes JavaScript bundles into:
 * - Framework Core: React, React-DOM, Vue, Svelte runtime, etc.
 * - Router: Next.js router, React Router, Vue Router, etc.
 * - Hydration: RSC Flight decoder, turbo-stream, hydration runtime
 * - Polyfills: Browser compatibility code
 * - Application: Your actual components and logic
 */

import { readFile } from 'node:fs/promises';
import fg from 'fast-glob';
import type { Result, ByteSize, FrameworkType } from '../types.ts';
import { ok, err } from '../result.ts';
import { calculateByteSize, sumByteSizes } from './utils.ts';

export interface RuntimeCategory {
  readonly name: string;
  readonly size: ByteSize;
  readonly percentage: number;
  readonly chunks: readonly string[];
}

export interface RuntimeBreakdown {
  readonly total: ByteSize;
  readonly categories: {
    readonly framework: RuntimeCategory;
    readonly router: RuntimeCategory;
    readonly hydration: RuntimeCategory;
    readonly polyfills: RuntimeCategory;
    readonly application: RuntimeCategory;
    readonly other: RuntimeCategory;
  };
  readonly topChunks: readonly ChunkCost[];
}

export interface ChunkCost {
  readonly name: string;
  readonly size: ByteSize;
  readonly category: string;
}

export interface RuntimeError {
  readonly code: 'ANALYSIS_FAILED';
  readonly message: string;
}

// Patterns to identify chunk categories
const FRAMEWORK_PATTERNS = [
  // React
  /react-dom/i,
  /react\.production/i,
  /scheduler/i,
  /react-jsx-runtime/i,
  // Vue
  /vue\.runtime/i,
  /@vue\/runtime/i,
  // Svelte
  /svelte\/internal/i,
  // Solid
  /solid-js/i,
  // Preact
  /preact/i,
];

const ROUTER_PATTERNS = [
  // Next.js router
  /app-router/i,
  /router-reducer/i,
  /navigation/i,
  /link\.js/i,
  // React Router
  /react-router/i,
  /\brouter\b.*\.js$/i,
  // Vue Router
  /vue-router/i,
  // Svelte
  /\$app\/navigation/i,
];

const HYDRATION_PATTERNS = [
  // RSC / Flight
  /flight/i,
  /react-server/i,
  /server-dom/i,
  /x-component/i,
  // turbo-stream
  /turbo-stream/i,
  /single-fetch/i,
  // Generic hydration
  /hydrat/i,
];

const POLYFILL_PATTERNS = [
  /polyfill/i,
  /core-js/i,
  /regenerator-runtime/i,
  /whatwg/i,
  /es6-shim/i,
  /babel-runtime/i,
];

// Framework-specific patterns for better categorization
const NEXTJS_PATTERNS = {
  framework: [
    /framework-[a-f0-9]+\.js$/i,
    /main-app-[a-f0-9]+\.js$/i,
    /_buildManifest\.js$/i,
    /_ssgManifest\.js$/i,
  ],
  router: [
    /app-pages-internals/i,
    /client\/router/i,
    /page-bootstrap/i,
  ],
  hydration: [
    /react-refresh/i,
    /render-from-template-context/i,
  ],
};

const REACT_ROUTER_PATTERNS = {
  framework: [
    /chunk-[A-Z0-9]+\.js$/i, // Vite vendor chunks
  ],
  router: [
    /entry\.client/i,
    /\broutes\b/i,
  ],
  hydration: [
    /ssr/i,
  ],
};

type CategoryType = 'framework' | 'router' | 'hydration' | 'polyfills' | 'application' | 'other';

const categorizeChunk = (
  name: string,
  content: string,
  framework: FrameworkType
): CategoryType => {
  const lower = name.toLowerCase();

  // Check polyfills first (explicit)
  if (POLYFILL_PATTERNS.some(p => p.test(lower))) {
    return 'polyfills';
  }

  // Framework-specific patterns
  if (framework === 'nextjs') {
    if (NEXTJS_PATTERNS.framework.some(p => p.test(name))) return 'framework';
    if (NEXTJS_PATTERNS.router.some(p => p.test(name))) return 'router';
    if (NEXTJS_PATTERNS.hydration.some(p => p.test(name))) return 'hydration';
  }

  if (framework === 'react-router') {
    if (REACT_ROUTER_PATTERNS.router.some(p => p.test(name))) return 'router';
    if (REACT_ROUTER_PATTERNS.hydration.some(p => p.test(name))) return 'hydration';
  }

  // Generic pattern matching
  if (FRAMEWORK_PATTERNS.some(p => p.test(lower) || p.test(content.slice(0, 5000)))) {
    return 'framework';
  }

  if (ROUTER_PATTERNS.some(p => p.test(lower) || p.test(content.slice(0, 5000)))) {
    return 'router';
  }

  if (HYDRATION_PATTERNS.some(p => p.test(lower) || p.test(content.slice(0, 5000)))) {
    return 'hydration';
  }

  // Check content for framework signatures
  const contentSample = content.slice(0, 10000);

  // React signatures
  if (contentSample.includes('__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED') ||
      contentSample.includes('react.element') ||
      contentSample.includes('$$typeof')) {
    return 'framework';
  }

  // Router signatures
  if (contentSample.includes('pushState') && contentSample.includes('popstate') ||
      contentSample.includes('createBrowserHistory') ||
      contentSample.includes('navigate(')) {
    return 'router';
  }

  // If in node_modules path pattern, likely vendor/framework
  if (lower.includes('node_modules') || /^[a-f0-9]{8,}\.js$/i.test(name.split('/').pop() ?? '')) {
    // Short hash-only names are typically framework splits
    return 'other';
  }

  // Default to application code
  return 'application';
};

/**
 * Find all JS files in build directory.
 */
const findJsFiles = async (buildDir: string): Promise<string[]> => {
  try {
    const entries = await fg('**/*.{js,mjs}', {
      cwd: buildDir,
      absolute: false,
    });

    // Filter out source maps and server-side files
    return entries.filter(entry => {
      if (entry.endsWith('.map')) return false;
      if (entry.includes('server/') && !entry.includes('client')) return false;
      return true;
    });
  } catch {
    // Directory doesn't exist
    return [];
  }
};

/**
 * Analyze runtime cost breakdown of JavaScript bundles.
 */
export const analyzeRuntime = async (
  buildDir: string,
  framework: FrameworkType = 'unknown'
): Promise<Result<RuntimeBreakdown, RuntimeError>> => {
  try {
    const files = await findJsFiles(buildDir);

    if (files.length === 0) {
      return err({
        code: 'ANALYSIS_FAILED',
        message: 'No JavaScript files found in build directory',
      });
    }

    const categorized: Record<CategoryType, { chunks: string[]; sizes: ByteSize[] }> = {
      framework: { chunks: [], sizes: [] },
      router: { chunks: [], sizes: [] },
      hydration: { chunks: [], sizes: [] },
      polyfills: { chunks: [], sizes: [] },
      application: { chunks: [], sizes: [] },
      other: { chunks: [], sizes: [] },
    };

    const allChunkCosts: ChunkCost[] = [];

    for (const file of files) {
      try {
        const fullPath = `${buildDir}/${file}`;
        const content = await readFile(fullPath);
        // Decode to text for pattern matching (only first 10KB for efficiency)
        const textContent = new TextDecoder().decode(content.slice(0, 10000));

        const size = calculateByteSize(new Uint8Array(content));
        const category = categorizeChunk(file, textContent, framework);

        categorized[category].chunks.push(file);
        categorized[category].sizes.push(size);

        allChunkCosts.push({
          name: file,
          size,
          category,
        });
      } catch {
        // Skip unreadable files
      }
    }

    // Calculate totals
    const allSizes = Object.values(categorized).flatMap(c => c.sizes);
    const total = sumByteSizes(allSizes);
    const totalGzip = total.gzip || 1; // Avoid division by zero

    const createCategory = (
      name: string,
      data: { chunks: string[]; sizes: ByteSize[] }
    ): RuntimeCategory => {
      const size = sumByteSizes(data.sizes);
      return {
        name,
        size,
        percentage: Math.round((size.gzip / totalGzip) * 1000) / 10,
        chunks: data.chunks,
      };
    };

    // Sort chunks by size for top chunks
    const topChunks = allChunkCosts
      .sort((a, b) => b.size.gzip - a.size.gzip)
      .slice(0, 15);

    return ok({
      total,
      categories: {
        framework: createCategory('Framework Core', categorized.framework),
        router: createCategory('Router', categorized.router),
        hydration: createCategory('Hydration Runtime', categorized.hydration),
        polyfills: createCategory('Polyfills', categorized.polyfills),
        application: createCategory('Application', categorized.application),
        other: createCategory('Other/Vendor', categorized.other),
      },
      topChunks,
    });
  } catch (e) {
    return err({
      code: 'ANALYSIS_FAILED',
      message: e instanceof Error ? e.message : 'Runtime analysis failed',
    });
  }
};

/**
 * Format runtime breakdown for display.
 */
export const formatRuntimeBreakdown = (breakdown: RuntimeBreakdown): string => {
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const categories = [
    breakdown.categories.framework,
    breakdown.categories.router,
    breakdown.categories.hydration,
    breakdown.categories.polyfills,
    breakdown.categories.application,
    breakdown.categories.other,
  ].filter(c => c.size.gzip > 0);

  let output = `## Runtime Cost Breakdown\n\n`;
  output += `**Total JS:** ${formatSize(breakdown.total.gzip)} (gzip)\n\n`;
  output += `| Category | Size (gzip) | % of Total | Chunks |\n`;
  output += `|----------|-------------|------------|--------|\n`;

  for (const cat of categories.sort((a, b) => b.size.gzip - a.size.gzip)) {
    output += `| ${cat.name} | ${formatSize(cat.size.gzip)} | ${cat.percentage}% | ${cat.chunks.length} |\n`;
  }

  output += `\n### Top Chunks by Size\n\n`;
  output += `| Chunk | Category | Size (gzip) |\n`;
  output += `|-------|----------|-------------|\n`;

  for (const chunk of breakdown.topChunks.slice(0, 10)) {
    const name = chunk.name.length > 50 ? `...${chunk.name.slice(-47)}` : chunk.name;
    output += `| ${name} | ${chunk.category} | ${formatSize(chunk.size.gzip)} |\n`;
  }

  return output;
};

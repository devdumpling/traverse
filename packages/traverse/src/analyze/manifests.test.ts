import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { parseNextJsManifest, parseViteManifest, isVendorOrFramework } from './manifests.ts';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';

const TEST_DIR = join(import.meta.dir, '__test_manifests__');

describe('manifests', () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('parseNextJsManifest', () => {
    test('parses build-manifest.json correctly', async () => {
      const manifest = {
        polyfillFiles: ['static/chunks/polyfills-abc123.js'],
        rootMainFiles: [
          'static/chunks/webpack-def456.js',
          'static/chunks/framework-ghi789.js',
          'static/chunks/main-jkl012.js',
        ],
        pages: {
          '/': ['static/chunks/pages/index-mno345.js'],
          '/about': ['static/chunks/pages/about-pqr678.js'],
          '/_app': ['static/chunks/pages/_app-stu901.js'],
        },
      };

      await writeFile(
        join(TEST_DIR, 'build-manifest.json'),
        JSON.stringify(manifest)
      );

      const result = await parseNextJsManifest(TEST_DIR);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Framework chunks should include framework-*
      expect(result.value.classification.framework).toContain(
        'static/chunks/framework-ghi789.js'
      );

      // Polyfills should be vendor
      expect(result.value.classification.vendor).toContain(
        'static/chunks/polyfills-abc123.js'
      );

      // Entry chunks should be rootMainFiles
      expect(result.value.entryChunks).toEqual(manifest.rootMainFiles);

      // Route chunks should exclude internal routes
      const routePaths = result.value.routeChunks.map((r) => r.route);
      expect(routePaths).toContain('/');
      expect(routePaths).toContain('/about');
      expect(routePaths).not.toContain('/_app');
    });

    test('returns error for missing manifest', async () => {
      const result = await parseNextJsManifest('/nonexistent/path');
      
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('parseViteManifest', () => {
    test('parses .vite/manifest.json correctly', async () => {
      await mkdir(join(TEST_DIR, 'client', '.vite'), { recursive: true });

      const manifest = {
        'src/entry.client.tsx': {
          file: 'assets/entry.client-abc123.js',
          src: 'src/entry.client.tsx',
          isEntry: true,
          imports: ['_react-vendor'],
        },
        '_react-vendor': {
          file: 'assets/react-dom-def456.js',
        },
        'src/routes/index.tsx': {
          file: 'assets/index-ghi789.js',
          src: 'src/routes/index.tsx',
        },
      };

      await writeFile(
        join(TEST_DIR, 'client', '.vite', 'manifest.json'),
        JSON.stringify(manifest)
      );

      const result = await parseViteManifest(TEST_DIR);

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Entry should be identified
      expect(result.value.entryChunks).toContain('assets/entry.client-abc123.js');

      // React vendor chunk should be classified as framework/vendor
      const allVendorFramework = [
        ...result.value.classification.framework,
        ...result.value.classification.vendor,
      ];
      expect(allVendorFramework.some((c) => c.includes('react-dom'))).toBe(true);
    });

    test('returns error for missing manifest', async () => {
      const result = await parseViteManifest('/nonexistent/path');
      
      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe('NOT_FOUND');
    });
  });

  describe('isVendorOrFramework', () => {
    const classification = {
      framework: ['static/chunks/framework-abc.js', 'assets/react-dom.js'],
      vendor: ['static/chunks/polyfills.js', 'vendor-xyz.js'],
      app: ['static/chunks/pages/index.js'],
    };

    test('identifies framework chunks', () => {
      expect(isVendorOrFramework('static/chunks/framework-abc.js', classification)).toBe(true);
      expect(isVendorOrFramework('framework-abc.js', classification)).toBe(true);
    });

    test('identifies vendor chunks', () => {
      expect(isVendorOrFramework('static/chunks/polyfills.js', classification)).toBe(true);
      expect(isVendorOrFramework('vendor-xyz.js', classification)).toBe(true);
    });

    test('rejects app chunks', () => {
      expect(isVendorOrFramework('static/chunks/pages/index.js', classification)).toBe(false);
      expect(isVendorOrFramework('my-component.js', classification)).toBe(false);
    });
  });
});

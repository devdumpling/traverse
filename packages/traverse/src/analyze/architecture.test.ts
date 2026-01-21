import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { analyzeArchitecture, describeArchitecture, describeHydration } from './architecture.ts';
import { mkdir, rm, writeFile } from 'fs/promises';
import { join } from 'path';

const TEST_DIR = join(import.meta.dir, '__test_architecture__');

describe('architecture', () => {
  beforeAll(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterAll(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('analyzeArchitecture', () => {
    test('detects Next.js App Router as transitional', async () => {
      // Create mock Next.js build structure
      await mkdir(join(TEST_DIR, 'nextjs-app'), { recursive: true });
      await writeFile(
        join(TEST_DIR, 'nextjs-app', 'app-paths-manifest.json'),
        JSON.stringify({ '/': 'app/page.js' })
      );
      await writeFile(
        join(TEST_DIR, 'nextjs-app', 'build-manifest.json'),
        JSON.stringify({
          pages: { '/': ['chunks/app.js'] },
          rootMainFiles: ['chunks/main.js'],
        })
      );

      const result = await analyzeArchitecture(
        join(TEST_DIR, 'nextjs-app'),
        'nextjs',
        []
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.value.type).toBe('transitional');
      expect(result.value.hydration).toBe('progressive');
      expect(result.value.dataStrategy).toBe('rsc');
      expect(result.value.hasServerComponents).toBe(true);
    });

    test('detects Next.js Pages Router as SPA', async () => {
      await mkdir(join(TEST_DIR, 'nextjs-pages', 'server'), { recursive: true });
      await writeFile(
        join(TEST_DIR, 'nextjs-pages', 'server', 'pages-manifest.json'),
        JSON.stringify({ '/': 'pages/index.js' })
      );
      await writeFile(
        join(TEST_DIR, 'nextjs-pages', 'build-manifest.json'),
        JSON.stringify({
          pages: { '/': ['chunks/pages.js'] },
          rootMainFiles: ['chunks/main.js'],
        })
      );

      const result = await analyzeArchitecture(
        join(TEST_DIR, 'nextjs-pages'),
        'nextjs',
        []
      );

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      // Pages router without App Router signals SPA
      expect(['spa', 'transitional']).toContain(result.value.type);
    });

    test('handles missing build directory gracefully', async () => {
      const result = await analyzeArchitecture(
        '/nonexistent/path',
        'nextjs',
        []
      );

      // Should succeed with unknown/fallback values
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.type).toBe('unknown');
    });
  });

  describe('describeArchitecture', () => {
    test('returns description for each type', () => {
      expect(describeArchitecture('mpa')).toContain('Multi-Page');
      expect(describeArchitecture('spa')).toContain('Single-Page');
      expect(describeArchitecture('transitional')).toContain('Server-rendered');
      expect(describeArchitecture('islands')).toContain('Static HTML');
      expect(describeArchitecture('unknown')).toContain('Unknown');
    });
  });

  describe('describeHydration', () => {
    test('returns description for each strategy', () => {
      expect(describeHydration('full')).toContain('Entire page');
      expect(describeHydration('progressive')).toContain('Selective');
      expect(describeHydration('islands')).toContain('Independent');
      expect(describeHydration('none')).toContain('No');
    });
  });
});

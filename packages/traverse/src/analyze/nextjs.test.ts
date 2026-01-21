/**
 * Tests for Next.js specific analysis.
 * 
 * Requires: cd packages/examples/apps/basic-next-app && npm i && npm run build
 */

import { describe, test, expect } from 'bun:test';
import { analyzeNextJs } from './nextjs.ts';
import { resolve } from 'path';

const nextAppBuildDir = resolve(
  import.meta.dir,
  '../../../examples/apps/basic-next-app/.next'
);

describe('analyzeNextJs', () => {
  test('analyzes Next.js build directory', async () => {
    const result = await analyzeNextJs(nextAppBuildDir);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.routerType).toBe('app');
      expect(result.value.turbopack).toBe(true);
      expect(result.value.routes.length).toBeGreaterThan(0);
    }
  });

  test('detects routes correctly', async () => {
    const result = await analyzeNextJs(nextAppBuildDir);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      const routes = result.value.routes;
      
      // Should have home route
      const homeRoute = routes.find(r => r.path === '/');
      expect(homeRoute).toBeDefined();
      expect(homeRoute?.type).toBe('static');
      
      // Should have products route
      const productsRoute = routes.find(r => r.path === '/products');
      expect(productsRoute).toBeDefined();
      expect(productsRoute?.type).toBe('static');
      
      // Should have dynamic product detail route
      const detailRoute = routes.find(r => r.path === '/products/[id]');
      expect(detailRoute).toBeDefined();
      expect(detailRoute?.type).toBe('dynamic');
    }
  });

  test('returns error for non-Next.js directory', async () => {
    const result = await analyzeNextJs('/tmp');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NOT_NEXTJS');
    }
  });
});

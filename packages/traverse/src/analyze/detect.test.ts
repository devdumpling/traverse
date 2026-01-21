/**
 * Tests for framework detection.
 * 
 * These tests require the example apps to be built:
 *   cd packages/examples/apps/basic-next-app && npm run build
 *   cd packages/examples/apps/basic-rr-app && npm run build
 *   cd packages/examples/apps/basic-react && npm run build
 */

import { describe, test, expect } from 'bun:test';
import { detectFramework } from './detect.ts';
import { resolve } from 'path';

const examplesDir = resolve(import.meta.dir, '../../../examples/apps');

describe('detectFramework', () => {
  test('detects Next.js app', async () => {
    const result = await detectFramework(`${examplesDir}/basic-next-app`);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.framework).toBe('nextjs');
      expect(result.value.version).toBeDefined();
      expect(result.value.buildDir).toContain('.next');
    }
  });

  test('detects React Router app', async () => {
    const result = await detectFramework(`${examplesDir}/basic-rr-app`);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.framework).toBe('react-router');
      expect(result.value.version).toBeDefined();
      expect(result.value.buildDir).toContain('build');
    }
  });

  test('detects generic SPA', async () => {
    const result = await detectFramework(`${examplesDir}/basic-react`);
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.framework).toBe('generic-spa');
      expect(result.value.buildDir).toContain('dist');
    }
  });

  test('returns error for non-existent directory', async () => {
    const result = await detectFramework('/non/existent/path');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DIR_NOT_FOUND');
    }
  });
});

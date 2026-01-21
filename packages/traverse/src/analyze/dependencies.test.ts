import { describe, test, expect } from 'bun:test';
import { analyzeDependencies } from './dependencies.ts';

describe('analyzeDependencies', () => {
  test('analyzes dependencies from package.json', async () => {
    // Use our own package.json as a test fixture
    const result = await analyzeDependencies(process.cwd());
    
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dependencies).toBeGreaterThan(0);
      expect(result.value.total).toBe(result.value.dependencies + result.value.devDependencies);
      expect(Array.isArray(result.value.topDependencies)).toBe(true);
    }
  });

  test('returns error for missing package.json', async () => {
    const result = await analyzeDependencies('/nonexistent/path');
    
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('NO_PACKAGE_JSON');
    }
  });
});

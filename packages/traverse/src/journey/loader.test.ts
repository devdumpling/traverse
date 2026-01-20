import { describe, test, expect } from 'bun:test';
import { loadJourney, validateJourney } from './loader.ts';
import { dirname, join } from 'path';

// Get the package root directory
const packageRoot = join(dirname(import.meta.path), '../..');
const exampleJourneyPath = join(packageRoot, 'journeys/example.journey.ts');

describe('loadJourney', () => {
  test('returns error for non-existent file', async () => {
    const result = await loadJourney('non-existent.ts');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_NOT_FOUND');
    }
  });

  test('loads valid journey file', async () => {
    const result = await loadJourney(exampleJourneyPath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe('example-journey');
      expect(result.value.description).toBeDefined();
      expect(typeof result.value.run).toBe('function');
    }
  });
});

describe('validateJourney', () => {
  test('returns error for non-existent file', async () => {
    const result = await validateJourney('non-existent.ts');
    expect(result.ok).toBe(false);
  });

  test('validates existing journey file', async () => {
    const result = await validateJourney(exampleJourneyPath);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.valid).toBe(true);
      expect(result.value.name).toBe('example-journey');
    }
  });
});

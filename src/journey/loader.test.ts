import { describe, test, expect } from 'bun:test';
import { loadJourney, validateJourney } from './loader.ts';

describe('loadJourney', () => {
  test('returns error for non-existent file', async () => {
    const result = await loadJourney('non-existent.ts');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('FILE_NOT_FOUND');
    }
  });

  test('loads valid journey file', async () => {
    const result = await loadJourney('journeys/example.journey.ts');
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
    const result = await validateJourney('journeys/example.journey.ts');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.valid).toBe(true);
      expect(result.value.name).toBe('example-journey');
    }
  });
});

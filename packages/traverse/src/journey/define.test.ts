import { describe, test, expect } from 'bun:test';
import { defineJourney } from './define.ts';

describe('defineJourney', () => {
  test('returns the journey definition unchanged', () => {
    const journey = defineJourney({
      name: 'test-journey',
      description: 'A test journey',
      run: async () => {},
    });

    expect(journey.name).toBe('test-journey');
    expect(journey.description).toBe('A test journey');
    expect(typeof journey.run).toBe('function');
  });

  test('preserves run function', async () => {
    let called = false;
    
    const journey = defineJourney({
      name: 'test',
      description: 'test',
      run: async (ctx) => {
        called = true;
        expect(ctx.step).toBeDefined();
      },
    });

    await journey.run({ step: async () => {} });
    expect(called).toBe(true);
  });
});

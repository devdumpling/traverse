/**
 * Tests for capture context and navigation tracking.
 */

import { describe, test, expect, mock } from 'bun:test';
import { createNavigationTracker } from './context.ts';

// Mock Page object for testing
const createMockPage = (timing: {
  url: string;
  navType: string | null;
  requestStart: number;
  loadEventEnd: number;
  startTime: number;
}) => ({
  evaluate: mock(() => Promise.resolve(timing)),
});

describe('NavigationTracker', () => {
  test('first step is always initial', async () => {
    const tracker = createNavigationTracker();
    const page = createMockPage({
      url: 'http://localhost:3000/',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });

    const result = await tracker.captureAndClassify(page as any);
    await tracker.finalizeStep(page as any);

    expect(result.type).toBe('initial');
    expect(result.trigger).toBe('link');
  });

  test('same URL is detected as none', async () => {
    const tracker = createNavigationTracker();
    const page = createMockPage({
      url: 'http://localhost:3000/',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });

    // First step - initial
    await tracker.captureAndClassify(page as any);
    await tracker.finalizeStep(page as any);

    // Second step - same URL, no navigation
    const result = await tracker.captureAndClassify(page as any);
    await tracker.finalizeStep(page as any);

    expect(result.type).toBe('none');
    expect(result.trigger).toBeNull();
  });

  test('URL change with same requestStart is soft navigation', async () => {
    const tracker = createNavigationTracker();

    // First step - initial page load
    const page1 = createMockPage({
      url: 'http://localhost:3000/',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });
    await tracker.captureAndClassify(page1 as any);
    await tracker.finalizeStep(page1 as any);

    // Second step - URL changed, but same requestStart (SPA navigation)
    const page2 = createMockPage({
      url: 'http://localhost:3000/products',
      navType: 'navigate',
      requestStart: 100, // Same as before - no page reload
      loadEventEnd: 500,
      startTime: 0,
    });
    const result = await tracker.captureAndClassify(page2 as any);
    await tracker.finalizeStep(page2 as any);

    expect(result.type).toBe('soft');
    expect(result.trigger).toBe('programmatic');
  });

  test('URL change with different requestStart is hard navigation', async () => {
    const tracker = createNavigationTracker();

    // First step - initial page load
    const page1 = createMockPage({
      url: 'http://localhost:3000/',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });
    await tracker.captureAndClassify(page1 as any);
    await tracker.finalizeStep(page1 as any);

    // Second step - URL changed, different requestStart (full reload)
    const page2 = createMockPage({
      url: 'http://localhost:3000/other',
      navType: 'navigate',
      requestStart: 600, // Different - page was reloaded
      loadEventEnd: 900,
      startTime: 0,
    });
    const result = await tracker.captureAndClassify(page2 as any);
    await tracker.finalizeStep(page2 as any);

    expect(result.type).toBe('hard');
    expect(result.trigger).toBe('link');
  });

  test('back-forward navigation is detected correctly', async () => {
    const tracker = createNavigationTracker();

    // First step
    const page1 = createMockPage({
      url: 'http://localhost:3000/',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });
    await tracker.captureAndClassify(page1 as any);
    await tracker.finalizeStep(page1 as any);

    // Second step - back/forward navigation (different requestStart)
    const page2 = createMockPage({
      url: 'http://localhost:3000/previous',
      navType: 'back_forward',
      requestStart: 600,
      loadEventEnd: 900,
      startTime: 0,
    });
    const result = await tracker.captureAndClassify(page2 as any);
    await tracker.finalizeStep(page2 as any);

    expect(result.type).toBe('hard');
    expect(result.trigger).toBe('back-forward');
  });

  test('reload navigation is detected correctly', async () => {
    const tracker = createNavigationTracker();

    // First step
    const page1 = createMockPage({
      url: 'http://localhost:3000/',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });
    await tracker.captureAndClassify(page1 as any);
    await tracker.finalizeStep(page1 as any);

    // Second step - reload (same URL but different requestStart)
    const page2 = createMockPage({
      url: 'http://localhost:3000/page',
      navType: 'reload',
      requestStart: 600,
      loadEventEnd: 900,
      startTime: 0,
    });
    const result = await tracker.captureAndClassify(page2 as any);
    await tracker.finalizeStep(page2 as any);

    expect(result.type).toBe('hard');
    expect(result.trigger).toBe('reload');
  });

  test('tracks state across multiple steps', async () => {
    const tracker = createNavigationTracker();

    // Step 1: Initial
    const page1 = createMockPage({
      url: 'http://localhost:3000/',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });
    const r1 = await tracker.captureAndClassify(page1 as any);
    await tracker.finalizeStep(page1 as any);
    expect(r1.type).toBe('initial');

    // Step 2: Soft navigation
    const page2 = createMockPage({
      url: 'http://localhost:3000/products',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });
    const r2 = await tracker.captureAndClassify(page2 as any);
    await tracker.finalizeStep(page2 as any);
    expect(r2.type).toBe('soft');

    // Step 3: Another soft navigation
    const page3 = createMockPage({
      url: 'http://localhost:3000/products/1',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });
    const r3 = await tracker.captureAndClassify(page3 as any);
    await tracker.finalizeStep(page3 as any);
    expect(r3.type).toBe('soft');

    // Step 4: No navigation (same URL)
    const page4 = createMockPage({
      url: 'http://localhost:3000/products/1',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });
    const r4 = await tracker.captureAndClassify(page4 as any);
    await tracker.finalizeStep(page4 as any);
    expect(r4.type).toBe('none');
  });

  test('soft navigation after hard navigation uses new requestStart baseline', async () => {
    const tracker = createNavigationTracker();

    // Step 1: Initial load
    const page1 = createMockPage({
      url: 'http://localhost:3000/',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });
    const r1 = await tracker.captureAndClassify(page1 as any);
    await tracker.finalizeStep(page1 as any);
    expect(r1.type).toBe('initial');

    // Step 2: Hard navigation (e.g., form submit, external link return)
    const page2 = createMockPage({
      url: 'http://localhost:3000/checkout',
      navType: 'navigate',
      requestStart: 800, // New document loaded
      loadEventEnd: 1200,
      startTime: 0,
    });
    const r2 = await tracker.captureAndClassify(page2 as any);
    await tracker.finalizeStep(page2 as any);
    expect(r2.type).toBe('hard');

    // Step 3: Soft navigation from the new page
    // requestStart stays at 800 (the new baseline)
    const page3 = createMockPage({
      url: 'http://localhost:3000/checkout/confirm',
      navType: 'navigate',
      requestStart: 800, // Same as step 2 - soft nav within new document
      loadEventEnd: 1200,
      startTime: 0,
    });
    const r3 = await tracker.captureAndClassify(page3 as any);
    await tracker.finalizeStep(page3 as any);
    expect(r3.type).toBe('soft');
  });

  test('handles hash-only URL changes as soft navigation', async () => {
    const tracker = createNavigationTracker();

    // Step 1: Initial
    const page1 = createMockPage({
      url: 'http://localhost:3000/docs',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });
    await tracker.captureAndClassify(page1 as any);
    await tracker.finalizeStep(page1 as any);

    // Step 2: Hash change (same page, different anchor)
    const page2 = createMockPage({
      url: 'http://localhost:3000/docs#section-2',
      navType: 'navigate',
      requestStart: 100, // Same - no reload
      loadEventEnd: 500,
      startTime: 0,
    });
    const r2 = await tracker.captureAndClassify(page2 as any);
    await tracker.finalizeStep(page2 as any);
    
    // Currently detected as 'soft' - URL changed, same requestStart
    // This is technically correct behavior, though we could add
    // special handling for hash-only changes in the future
    expect(r2.type).toBe('soft');
  });

  test('finalizeStep updates state even without capture', async () => {
    const tracker = createNavigationTracker();

    // Step 1: Initial (with capture)
    const page1 = createMockPage({
      url: 'http://localhost:3000/',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });
    const r1 = await tracker.captureAndClassify(page1 as any);
    await tracker.finalizeStep(page1 as any);
    expect(r1.type).toBe('initial');

    // Step 2: Navigation happens but NO capture.navigation() called
    // Only finalizeStep is called (simulating step without capture)
    const page2 = createMockPage({
      url: 'http://localhost:3000/products',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });
    // Don't call captureAndClassify - just finalize
    await tracker.finalizeStep(page2 as any);

    // Step 3: Capture should correctly detect relative to step 2's state
    const page3 = createMockPage({
      url: 'http://localhost:3000/products/1',
      navType: 'navigate',
      requestStart: 100,
      loadEventEnd: 500,
      startTime: 0,
    });
    const r3 = await tracker.captureAndClassify(page3 as any);
    await tracker.finalizeStep(page3 as any);
    
    // Should be soft (URL changed from /products to /products/1)
    // NOT compared against step 1's URL (/)
    expect(r3.type).toBe('soft');
  });
});

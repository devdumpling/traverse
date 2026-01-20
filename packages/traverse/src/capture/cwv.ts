/**
 * Core Web Vitals capture via Performance Observer.
 * 
 * Note: Functions passed to page.evaluate() run in browser context.
 * We use type assertions to bridge the Node/browser type gap.
 */

import type { Page } from 'playwright';
import type { Result, BrowserError } from '../types.ts';
import { fromPromise } from '../result.ts';

export interface CwvCapture {
  readonly lcp: number | null;
  readonly fcp: number | null;
  readonly cls: number;
  readonly ttfb: number | null;
}

// Browser-context function to capture CWV metrics
// This gets serialized and run in the browser, not in Node
const cwvCaptureFunction = `async () => {
  const metrics = {
    lcp: null,
    fcp: null,
    cls: 0,
    ttfb: null,
  };

  // Get TTFB from Navigation Timing
  const navEntries = performance.getEntriesByType('navigation');
  const navEntry = navEntries[0];
  if (navEntry) {
    metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
  }

  // Get FCP from paint entries
  const paintEntries = performance.getEntriesByType('paint');
  const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');
  if (fcpEntry) {
    metrics.fcp = fcpEntry.startTime;
  }

  // For LCP and CLS, we need to wait a bit and observe
  return new Promise((resolve) => {
    let clsValue = 0;
    let lcpValue = null;
    let resolved = false;

    const resolveMetrics = () => {
      if (resolved) return;
      resolved = true;
      metrics.lcp = lcpValue;
      metrics.cls = clsValue;
      resolve(metrics);
    };

    // Observe LCP
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) {
          lcpValue = lastEntry.startTime;
        }
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {
      // LCP not supported
    }

    // Observe CLS
    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput && entry.value) {
            clsValue += entry.value;
          }
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {
      // CLS not supported
    }

    // Wait for load + a bit more for LCP to finalize
    if (document.readyState === 'complete') {
      setTimeout(resolveMetrics, 500);
    } else {
      window.addEventListener('load', () => {
        setTimeout(resolveMetrics, 500);
      });
    }

    // Fallback timeout
    setTimeout(resolveMetrics, 5000);
  });
}`;

export const captureCwv = async (
  page: Page
): Promise<Result<CwvCapture, BrowserError>> => {
  const result = await fromPromise(
    page.evaluate(`(${cwvCaptureFunction})()`) as Promise<CwvCapture>,
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to capture CWV',
      cause: e,
    })
  );
  return result;
};

// Browser-context function for navigation timing
const navTimingFunction = `() => {
  const entries = performance.getEntriesByType('navigation');
  const navEntry = entries[0];
  if (!navEntry) {
    return { domContentLoaded: 0, load: 0 };
  }
  return {
    domContentLoaded: navEntry.domContentLoadedEventEnd - navEntry.startTime,
    load: navEntry.loadEventEnd - navEntry.startTime,
  };
}`;

export const captureNavigationTiming = async (
  page: Page
): Promise<Result<{ domContentLoaded: number; load: number }, BrowserError>> => {
  const result = await fromPromise(
    page.evaluate(`(${navTimingFunction})()`) as Promise<{ domContentLoaded: number; load: number }>,
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to capture navigation timing',
      cause: e,
    })
  );
  return result;
};

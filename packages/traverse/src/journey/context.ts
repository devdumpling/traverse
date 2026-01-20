/**
 * Capture context for journey steps.
 * Provides methods to capture various metrics during step execution.
 */

import type { Page, CDPSession } from 'playwright';
import type { NavigationType, NavigationTrigger, PrefetchStatus } from '../types.ts';
import { createCdpSession, getHeapSize } from '../browser/cdp.ts';

export interface CwvData {
  readonly lcp: number | null;
  readonly fcp: number | null;
  readonly cls: number;
  readonly ttfb: number | null;
}

export interface ResourceData {
  readonly loaded: number;
  readonly fromCache: number;
  readonly transferred: number;
}

export interface NavigationData {
  readonly type: NavigationType;
  readonly trigger: NavigationTrigger | null;
  readonly prefetchStatus: PrefetchStatus | null;
  readonly duration: number;
}

export interface StepCaptureData {
  cwv: CwvData | null;
  resources: ResourceData | null;
  navigation: NavigationData | null;
  memory: number | null;
  interaction: { start: number; end: number } | null;
  custom: Record<string, number>;
}

export interface CaptureContext {
  cwv(): Promise<void>;
  resources(): Promise<void>;
  navigation(): Promise<void>;
  memory(): Promise<void>;
  startInteraction(): Promise<void>;
  endInteraction(): Promise<void>;
  mark(name: string, value: number): void;
}

// Browser-context CWV capture function
const cwvCaptureScript = `async () => {
  const metrics = { lcp: null, fcp: null, cls: 0, ttfb: null };

  const navEntries = performance.getEntriesByType('navigation');
  const navEntry = navEntries[0];
  if (navEntry) {
    metrics.ttfb = navEntry.responseStart - navEntry.requestStart;
  }

  const paintEntries = performance.getEntriesByType('paint');
  const fcpEntry = paintEntries.find((e) => e.name === 'first-contentful-paint');
  if (fcpEntry) {
    metrics.fcp = fcpEntry.startTime;
  }

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

    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        if (lastEntry) lcpValue = lastEntry.startTime;
      });
      lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (e) {}

    try {
      const clsObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput && entry.value) clsValue += entry.value;
        }
      });
      clsObserver.observe({ type: 'layout-shift', buffered: true });
    } catch (e) {}

    if (document.readyState === 'complete') {
      setTimeout(resolveMetrics, 300);
    } else {
      window.addEventListener('load', () => setTimeout(resolveMetrics, 300));
    }
    setTimeout(resolveMetrics, 3000);
  });
}`;

// Browser-context resource capture function
const resourceCaptureScript = `() => {
  const entries = performance.getEntriesByType('resource');
  let transferred = 0;
  let fromCache = 0;
  
  for (const entry of entries) {
    transferred += entry.transferSize || 0;
    if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
      fromCache++;
    }
  }
  
  return {
    loaded: entries.length,
    fromCache,
    transferred,
  };
}`;

// Browser-context script to get navigation timing data
const getNavigationTimingScript = `() => {
  const navEntries = performance.getEntriesByType('navigation');
  const navEntry = navEntries[0];
  
  return {
    url: window.location.href,
    navType: navEntry?.type ?? null,
    requestStart: navEntry?.requestStart ?? 0,
    loadEventEnd: navEntry?.loadEventEnd ?? 0,
    startTime: navEntry?.startTime ?? 0,
  };
}`;

interface NavigationTimingData {
  url: string;
  navType: string | null;
  requestStart: number;
  loadEventEnd: number;
  startTime: number;
}

/**
 * Tracks navigation state across journey steps.
 * Determines if navigations are initial, hard (full reload), or soft (SPA).
 * 
 * IMPORTANT: Call `finalizeStep()` after each step completes to ensure
 * accurate tracking even if `captureAndClassify()` wasn't called.
 */
export interface NavigationTracker {
  /** Capture current navigation state and classify the navigation type */
  captureAndClassify(page: Page): Promise<NavigationData>;
  /** Update internal state after a step completes (call even if navigation wasn't captured) */
  finalizeStep(page: Page): Promise<void>;
}

export const createNavigationTracker = (): NavigationTracker => {
  let previousUrl: string | null = null;
  let previousRequestStart: number | null = null;
  let stepIndex = 0;
  let capturedThisStep = false;

  const getTiming = async (page: Page): Promise<NavigationTimingData> => {
    return page.evaluate(`(${getNavigationTimingScript})()`) as Promise<NavigationTimingData>;
  };

  const classify = (timing: NavigationTimingData): NavigationData => {
    const currentStepIndex = stepIndex;

    // First step is always initial
    if (currentStepIndex === 0) {
      return {
        type: 'initial',
        trigger: 'link',
        prefetchStatus: null,
        duration: timing.loadEventEnd - timing.startTime,
      };
    }

    // No previous URL means we can't compare - treat as initial
    if (!previousUrl) {
      return {
        type: 'initial',
        trigger: 'link',
        prefetchStatus: null,
        duration: timing.loadEventEnd - timing.startTime,
      };
    }

    // URL didn't change - no navigation
    if (previousUrl === timing.url) {
      return {
        type: 'none',
        trigger: null,
        prefetchStatus: null,
        duration: 0,
      };
    }

    // URL changed - determine if hard or soft navigation
    // Hard navigation: requestStart changed (page fully reloaded)
    // Soft navigation: same requestStart (client-side routing via History API)
    const isHardNavigation = 
      previousRequestStart !== null && 
      timing.requestStart !== previousRequestStart;

    if (isHardNavigation) {
      const trigger: NavigationTrigger = 
        timing.navType === 'back_forward' ? 'back-forward' :
        timing.navType === 'reload' ? 'reload' : 'link';
      return {
        type: 'hard',
        trigger,
        prefetchStatus: null,
        duration: timing.loadEventEnd - timing.startTime,
      };
    }

    // URL changed but requestStart unchanged = soft navigation (SPA)
    return {
      type: 'soft',
      trigger: 'programmatic',
      prefetchStatus: null,
      duration: 0, // Soft navigations don't have navigation timing
    };
  };

  return {
    async captureAndClassify(page: Page): Promise<NavigationData> {
      const timing = await getTiming(page);
      capturedThisStep = true;
      
      const result = classify(timing);
      
      // Update state immediately when captured
      previousUrl = timing.url;
      previousRequestStart = timing.requestStart;
      
      return result;
    },

    async finalizeStep(page: Page): Promise<void> {
      // If navigation wasn't captured this step, update state anyway
      // to ensure next step has accurate comparison baseline
      if (!capturedThisStep) {
        const timing = await getTiming(page);
        previousUrl = timing.url;
        previousRequestStart = timing.requestStart;
      }
      
      // Reset for next step and increment counter
      capturedThisStep = false;
      stepIndex++;
    },
  };
};

export const createCaptureContext = (
  page: Page,
  data: StepCaptureData,
  navigationTracker: NavigationTracker
): CaptureContext => {
  let cdpSession: CDPSession | null = null;
  let interactionStartTime: number | null = null;

  const ensureCdp = async (): Promise<CDPSession> => {
    if (!cdpSession) {
      const result = await createCdpSession(page);
      if (!result.ok) {
        throw new Error(`Failed to create CDP session: ${result.error.message}`);
      }
      cdpSession = result.value;
    }
    return cdpSession;
  };

  return {
    async cwv(): Promise<void> {
      const cwvData = await page.evaluate(`(${cwvCaptureScript})()`) as CwvData;
      data.cwv = cwvData;
    },

    async resources(): Promise<void> {
      const resourceData = await page.evaluate(`(${resourceCaptureScript})()`) as ResourceData;
      data.resources = resourceData;
    },

    async navigation(): Promise<void> {
      const navData = await navigationTracker.captureAndClassify(page);
      data.navigation = navData;
    },

    async memory(): Promise<void> {
      const cdp = await ensureCdp();
      const result = await getHeapSize(cdp);
      if (result.ok) {
        data.memory = result.value;
      }
    },

    async startInteraction(): Promise<void> {
      interactionStartTime = performance.now();
    },

    async endInteraction(): Promise<void> {
      if (interactionStartTime !== null) {
        data.interaction = {
          start: interactionStartTime,
          end: performance.now(),
        };
        interactionStartTime = null;
      }
    },

    mark(name: string, value: number): void {
      data.custom[name] = value;
    },
  };
};

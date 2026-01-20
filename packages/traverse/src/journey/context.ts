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

// Browser-context navigation detection
const navigationDetectScript = `() => {
  const navEntries = performance.getEntriesByType('navigation');
  const navEntry = navEntries[0];
  
  if (!navEntry) {
    return { type: 'none', trigger: null, prefetchStatus: null, duration: 0 };
  }
  
  const navType = navEntry.type;
  let type = 'hard';
  
  if (navType === 'navigate') type = 'initial';
  else if (navType === 'reload') type = 'hard';
  else if (navType === 'back_forward') type = 'hard';
  
  // Check for soft navigation API (if available)
  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const softNavEntries = performance.getEntriesByType('soft-navigation');
      if (softNavEntries && softNavEntries.length > 0) {
        type = 'soft';
      }
    } catch (e) {}
  }
  
  const trigger = navType === 'back_forward' ? 'back-forward' 
    : navType === 'reload' ? 'reload' 
    : 'link';
  
  return {
    type,
    trigger,
    prefetchStatus: null,
    duration: navEntry.loadEventEnd - navEntry.startTime,
  };
}`;

export const createCaptureContext = (
  page: Page,
  data: StepCaptureData
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
      const navData = await page.evaluate(`(${navigationDetectScript})()`) as NavigationData;
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

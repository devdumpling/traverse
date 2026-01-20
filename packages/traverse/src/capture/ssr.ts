/**
 * SSR and hydration payload capture.
 * 
 * Captures:
 * - Inline script content and sizes
 * - Framework-specific hydration data (__reactRouter, self.__next_f, etc.)
 * - SSR content presence detection
 * - RSC payload detection
 */

import type { Page } from 'playwright';
import type { Result, BrowserError } from '../types.ts';
import { ok, fromPromise } from '../result.ts';

export interface InlineScript {
  readonly content: string;
  readonly size: number;
  readonly isHydrationData: boolean;
  readonly framework: 'next' | 'react-router' | 'remix' | 'unknown' | null;
}

export interface SsrCapture {
  readonly hasContent: boolean;
  readonly rootElement: {
    readonly id: string | null;
    readonly childCount: number;
    readonly textLength: number;
  };
  readonly inlineScripts: {
    readonly count: number;
    readonly totalSize: number;
    readonly scripts: readonly InlineScript[];
  };
  readonly hydration: {
    readonly detected: boolean;
    readonly framework: 'next' | 'react-router' | 'remix' | 'unknown' | null;
    readonly payloadSize: number;
    readonly nextData: {
      readonly present: boolean;
      readonly size: number;
    };
    readonly reactRouterData: {
      readonly present: boolean;
      readonly size: number;
    };
    readonly rscPayload: {
      readonly present: boolean;
      readonly size: number;
      readonly chunkCount: number;
    };
  };
}

// Browser-context function to capture SSR data
const ssrCaptureFunction = `() => {
  const result = {
    hasContent: false,
    rootElement: {
      id: null,
      childCount: 0,
      textLength: 0,
    },
    inlineScripts: {
      count: 0,
      totalSize: 0,
      scripts: [],
    },
    hydration: {
      detected: false,
      framework: null,
      payloadSize: 0,
      nextData: { present: false, size: 0 },
      reactRouterData: { present: false, size: 0 },
      rscPayload: { present: false, size: 0, chunkCount: 0 },
    },
  };

  // Find root element (common patterns)
  const rootSelectors = ['#root', '#__next', '#app', '[data-reactroot]', 'main', 'body > div:first-child'];
  let rootEl = null;
  for (const selector of rootSelectors) {
    const el = document.querySelector(selector);
    if (el && el.children.length > 0) {
      rootEl = el;
      result.rootElement.id = el.id || null;
      break;
    }
  }

  if (rootEl) {
    result.rootElement.childCount = rootEl.children.length;
    result.rootElement.textLength = (rootEl.textContent || '').trim().length;
    // Has meaningful content if there's significant text or multiple children
    result.hasContent = result.rootElement.textLength > 50 || result.rootElement.childCount > 2;
  }

  // Capture inline scripts (no src attribute)
  const scripts = document.querySelectorAll('script:not([src])');
  for (const script of scripts) {
    const content = script.textContent || '';
    const size = new Blob([content]).size;
    
    // Detect framework-specific hydration data
    let isHydrationData = false;
    let framework = null;

    // Next.js patterns
    if (content.includes('self.__next_f') || content.includes('__NEXT_DATA__')) {
      isHydrationData = true;
      framework = 'next';
      result.hydration.detected = true;
      result.hydration.framework = 'next';
      
      if (content.includes('__NEXT_DATA__')) {
        result.hydration.nextData.present = true;
        result.hydration.nextData.size += size;
      }
      if (content.includes('self.__next_f')) {
        result.hydration.rscPayload.present = true;
        result.hydration.rscPayload.size += size;
        result.hydration.rscPayload.chunkCount++;
      }
    }
    // React Router / Remix patterns
    else if (content.includes('__reactRouterContext') || content.includes('window.__remixContext')) {
      isHydrationData = true;
      framework = content.includes('__remixContext') ? 'remix' : 'react-router';
      result.hydration.detected = true;
      result.hydration.framework = framework;
      result.hydration.reactRouterData.present = true;
      result.hydration.reactRouterData.size += size;
    }
    // Generic React hydration marker
    else if (content.includes('__REACT_DEVTOOLS_GLOBAL_HOOK__') || 
             content.includes('hydrateRoot') ||
             content.includes('ReactDOM.hydrate')) {
      isHydrationData = true;
      framework = 'unknown';
    }

    if (isHydrationData) {
      result.hydration.payloadSize += size;
    }

    result.inlineScripts.scripts.push({
      content: content.slice(0, 500), // Truncate for storage
      size,
      isHydrationData,
      framework,
    });
    result.inlineScripts.count++;
    result.inlineScripts.totalSize += size;
  }

  // Check for __NEXT_DATA__ in a script tag with id
  const nextDataScript = document.querySelector('#__NEXT_DATA__');
  if (nextDataScript) {
    const content = nextDataScript.textContent || '';
    const size = new Blob([content]).size;
    result.hydration.nextData.present = true;
    result.hydration.nextData.size = size;
    result.hydration.detected = true;
    result.hydration.framework = 'next';
  }

  return result;
}`;

export const captureSsr = async (
  page: Page
): Promise<Result<SsrCapture, BrowserError>> => {
  const result = await fromPromise(
    page.evaluate(`(${ssrCaptureFunction})()`) as Promise<SsrCapture>,
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to capture SSR data',
      cause: e,
    })
  );
  return result;
};

// Capture RSC payloads during navigation (for soft navs)
export interface RscNavigationPayload {
  readonly url: string;
  readonly size: number;
  readonly type: 'rsc' | 'json' | 'unknown';
}

export const captureRscNavigationPayloads = async (
  page: Page
): Promise<Result<readonly RscNavigationPayload[], BrowserError>> => {
  const captureFunction = `() => {
    // Access captured data from our injected observer
    return window.__traverse_rsc_payloads || [];
  }`;

  const result = await fromPromise(
    page.evaluate(captureFunction) as Promise<RscNavigationPayload[]>,
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to capture RSC payloads',
      cause: e,
    })
  );

  return result.ok ? ok(result.value) : result;
};

// Inject RSC payload observer before navigation
export const injectRscObserver = async (
  page: Page
): Promise<Result<void, BrowserError>> => {
  const observerScript = `
    window.__traverse_rsc_payloads = [];
    
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      const url = typeof args[0] === 'string' ? args[0] : args[0].url;
      
      // Detect RSC payloads (Next.js uses _rsc query param or text/x-component content type)
      if (url.includes('_rsc') || url.includes('.rsc')) {
        const clone = response.clone();
        try {
          const text = await clone.text();
          window.__traverse_rsc_payloads.push({
            url,
            size: new Blob([text]).size,
            type: 'rsc',
          });
        } catch (e) {
          // Ignore errors
        }
      }
      
      return response;
    };
  `;

  const result = await fromPromise(
    page.evaluate(observerScript),
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to inject RSC observer',
      cause: e,
    })
  );

  return result.ok ? ok(undefined) : result;
};

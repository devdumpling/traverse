/**
 * Resource timing capture.
 * 
 * Note: Functions passed to page.evaluate() run in browser context.
 */

import type { Page } from 'playwright';
import type { Result, BrowserError, ResourceType, ResourceCacheStatus } from '../types.ts';
import { ok, fromPromise } from '../result.ts';

export interface ResourceEntry {
  readonly name: string;
  readonly type: ResourceType;
  readonly transferSize: number;
  readonly encodedBodySize: number;
  readonly decodedBodySize: number;
  readonly duration: number;
  readonly cacheStatus: ResourceCacheStatus;
}

export interface ResourceCapture {
  readonly entries: readonly ResourceEntry[];
  readonly document: {
    readonly transferSize: number;
    readonly decodedBodySize: number;
  };
  readonly totalTransfer: number;
  readonly totalCount: number;
  readonly fromCache: number;
}

interface RawResourceEntry {
  name: string;
  initiatorType: string;
  transferSize: number;
  encodedBodySize: number;
  decodedBodySize: number;
  duration: number;
}

const inferResourceType = (entry: RawResourceEntry): ResourceType => {
  const url = entry.name.toLowerCase();
  const initiator = entry.initiatorType;

  if (initiator === 'script' || url.endsWith('.js') || url.endsWith('.mjs')) {
    return 'script';
  }
  if (initiator === 'link' || url.endsWith('.css')) {
    return 'stylesheet';
  }
  if (initiator === 'img' || /\.(png|jpg|jpeg|gif|webp|svg|ico)/.test(url)) {
    return 'image';
  }
  if (/\.(woff|woff2|ttf|otf|eot)/.test(url)) {
    return 'font';
  }
  if (initiator === 'fetch' || initiator === 'xmlhttprequest') {
    return 'fetch';
  }
  if (initiator === 'navigation') {
    return 'document';
  }
  return 'other';
};

const inferCacheStatus = (entry: RawResourceEntry): ResourceCacheStatus => {
  if (entry.transferSize === 0 && entry.decodedBodySize > 0) {
    if (entry.duration < 10) {
      return 'memory';
    }
    return 'disk';
  }
  return 'network';
};

// Browser-context function to capture resource entries and document
const resourceCaptureFunction = `() => {
  const resourceEntries = performance.getEntriesByType('resource');
  const navEntries = performance.getEntriesByType('navigation');
  const navEntry = navEntries[0];
  
  return {
    resources: resourceEntries.map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      transferSize: entry.transferSize,
      encodedBodySize: entry.encodedBodySize,
      decodedBodySize: entry.decodedBodySize,
      duration: entry.duration,
    })),
    document: navEntry ? {
      transferSize: navEntry.transferSize,
      decodedBodySize: navEntry.decodedBodySize,
    } : null,
  };
}`;

interface RawCaptureResult {
  resources: RawResourceEntry[];
  document: { transferSize: number; decodedBodySize: number } | null;
}

export const captureResources = async (
  page: Page
): Promise<Result<ResourceCapture, BrowserError>> => {
  const result = await fromPromise(
    page.evaluate(`(${resourceCaptureFunction})()`) as Promise<RawCaptureResult>,
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to capture resources',
      cause: e,
    })
  );

  if (!result.ok) return result;

  const entries: ResourceEntry[] = result.value.resources.map((raw) => ({
    name: raw.name,
    type: inferResourceType(raw),
    transferSize: raw.transferSize,
    encodedBodySize: raw.encodedBodySize,
    decodedBodySize: raw.decodedBodySize,
    duration: raw.duration,
    cacheStatus: inferCacheStatus(raw),
  }));

  const document = result.value.document ?? { transferSize: 0, decodedBodySize: 0 };
  const resourceTransfer = entries.reduce((sum, e) => sum + e.transferSize, 0);
  const totalTransfer = resourceTransfer + document.transferSize;
  const fromCache = entries.filter((e) => e.cacheStatus !== 'network').length;

  return ok({
    entries,
    document,
    totalTransfer,
    totalCount: entries.length + 1, // +1 for document
    fromCache,
  });
};

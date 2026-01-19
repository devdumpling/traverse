/**
 * Chrome DevTools Protocol session management.
 */

import type { CDPSession, Page } from 'playwright';
import type { Result, BrowserError, NetworkConfig } from '../types.ts';
import { ok, err, fromPromise } from '../result.ts';

export const createCdpSession = async (
  page: Page
): Promise<Result<CDPSession, BrowserError>> => {
  const result = await fromPromise(
    page.context().newCDPSession(page),
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to create CDP session',
      cause: e,
    })
  );
  return result;
};

export const enablePerformanceMetrics = async (
  cdp: CDPSession
): Promise<Result<void, BrowserError>> => {
  const result = await fromPromise(
    cdp.send('Performance.enable'),
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to enable performance metrics',
      cause: e,
    })
  );
  return result.ok ? ok(undefined) : result;
};

export const getPerformanceMetrics = async (
  cdp: CDPSession
): Promise<Result<Map<string, number>, BrowserError>> => {
  const result = await fromPromise(
    cdp.send('Performance.getMetrics'),
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to get performance metrics',
      cause: e,
    })
  );

  if (!result.ok) return result;

  const metrics = new Map<string, number>();
  for (const metric of result.value.metrics) {
    metrics.set(metric.name, metric.value);
  }
  return ok(metrics);
};

export const emulateNetworkConditions = async (
  cdp: CDPSession,
  config: NetworkConfig
): Promise<Result<void, BrowserError>> => {
  const result = await fromPromise(
    cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: config.downloadThroughput,
      uploadThroughput: config.uploadThroughput,
      latency: config.latency,
    }),
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to emulate network conditions',
      cause: e,
    })
  );
  return result.ok ? ok(undefined) : result;
};

export const clearBrowserCache = async (
  cdp: CDPSession
): Promise<Result<void, BrowserError>> => {
  const result = await fromPromise(
    cdp.send('Network.clearBrowserCache'),
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to clear browser cache',
      cause: e,
    })
  );
  return result.ok ? ok(undefined) : result;
};

export const getHeapSize = async (
  cdp: CDPSession
): Promise<Result<number, BrowserError>> => {
  const result = await fromPromise(
    cdp.send('Runtime.getHeapUsage'),
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to get heap usage',
      cause: e,
    })
  );

  if (!result.ok) return result;
  return ok(result.value.usedSize);
};

/**
 * Single-page benchmark runner.
 */

import type { Page } from 'playwright';
import type {
  Result,
  BrowserError,
  DeviceConfig,
  NetworkConfig,
  RuntimeBenchmark,
  RuntimeRun,
} from '../types.ts';
import { ok, err } from '../result.ts';
import { launchBrowser, createContext, closeBrowser } from '../browser/launch.ts';
import { createCdpSession, enablePerformanceMetrics, emulateNetworkConditions, clearBrowserCache, getHeapSize } from '../browser/cdp.ts';
import { captureCwv, captureNavigationTiming } from '../capture/cwv.ts';
import { captureResources } from '../capture/resources.ts';
import { aggregate, aggregateNullable } from './aggregator.ts';

export interface BenchOptions {
  readonly url: string;
  readonly runs: number;
  readonly device: DeviceConfig;
  readonly network: NetworkConfig | null;
}

interface SingleRunResult {
  readonly cwv: {
    readonly lcp: number | null;
    readonly fcp: number | null;
    readonly cls: number;
    readonly ttfb: number | null;
  };
  readonly resources: {
    readonly totalTransfer: number;
    readonly totalCount: number;
    readonly fromCache: number;
  };
  readonly timing: {
    readonly domContentLoaded: number;
    readonly load: number;
  };
  readonly heapSize: number;
}

const runSingleBenchmark = async (
  page: Page,
  url: string,
  network: NetworkConfig | null
): Promise<Result<SingleRunResult, BrowserError>> => {
  const cdpResult = await createCdpSession(page);
  if (!cdpResult.ok) return cdpResult;
  const cdp = cdpResult.value;

  const enableResult = await enablePerformanceMetrics(cdp);
  if (!enableResult.ok) return enableResult;

  if (network) {
    const networkResult = await emulateNetworkConditions(cdp, network);
    if (!networkResult.ok) return networkResult;
  }

  const clearResult = await clearBrowserCache(cdp);
  if (!clearResult.ok) return clearResult;

  try {
    await page.goto(url, { waitUntil: 'networkidle' });
  } catch (e) {
    return err({
      code: 'NAVIGATION_FAILED',
      message: e instanceof Error ? e.message : 'Navigation failed',
      cause: e,
    });
  }

  const cwvResult = await captureCwv(page);
  if (!cwvResult.ok) return cwvResult;

  const resourcesResult = await captureResources(page);
  if (!resourcesResult.ok) return resourcesResult;

  const timingResult = await captureNavigationTiming(page);
  if (!timingResult.ok) return timingResult;

  const heapResult = await getHeapSize(cdp);
  if (!heapResult.ok) return heapResult;

  return ok({
    cwv: {
      lcp: cwvResult.value.lcp,
      fcp: cwvResult.value.fcp,
      cls: cwvResult.value.cls,
      ttfb: cwvResult.value.ttfb,
    },
    resources: {
      totalTransfer: resourcesResult.value.totalTransfer,
      totalCount: resourcesResult.value.totalCount,
      fromCache: resourcesResult.value.fromCache,
    },
    timing: timingResult.value,
    heapSize: heapResult.value,
  });
};

export const runBenchmark = async (
  options: BenchOptions
): Promise<Result<RuntimeBenchmark, BrowserError>> => {
  const browserResult = await launchBrowser();
  if (!browserResult.ok) return browserResult;
  const browser = browserResult.value;

  try {
    const contextResult = await createContext(browser, { device: options.device });
    if (!contextResult.ok) {
      await closeBrowser(browser);
      return contextResult;
    }
    const context = contextResult.value;

    const runs: RuntimeRun[] = [];
    const singleResults: SingleRunResult[] = [];

    for (let i = 0; i < options.runs; i++) {
      const page = await context.newPage();

      const result = await runSingleBenchmark(page, options.url, options.network);
      await page.close();

      if (!result.ok) {
        await context.close();
        await closeBrowser(browser);
        return result;
      }

      singleResults.push(result.value);
      runs.push({
        index: i,
        cwv: {
          lcp: result.value.cwv.lcp,
          inp: null,
          cls: result.value.cwv.cls,
          fcp: result.value.cwv.fcp,
          ttfb: result.value.cwv.ttfb,
        },
        resources: {
          totalTransfer: result.value.resources.totalTransfer,
          totalCount: result.value.resources.totalCount,
          fromCache: result.value.resources.fromCache,
        },
        javascript: {
          mainThreadBlocking: 0,
          longTaskCount: 0,
          heapSize: result.value.heapSize,
        },
        timing: result.value.timing,
      });
    }

    await context.close();
    await closeBrowser(browser);

    const benchmark: RuntimeBenchmark = {
      meta: {
        url: options.url,
        capturedAt: new Date().toISOString(),
        runs: options.runs,
        device: options.device,
        network: options.network,
      },
      cwv: {
        lcp: aggregateNullable(singleResults.map((r) => r.cwv.lcp)) ?? aggregate([0]),
        inp: null,
        cls: aggregate(singleResults.map((r) => r.cwv.cls)),
        fcp: aggregateNullable(singleResults.map((r) => r.cwv.fcp)) ?? aggregate([0]),
        ttfb: aggregateNullable(singleResults.map((r) => r.cwv.ttfb)) ?? aggregate([0]),
      },
      extended: {
        tti: null,
        tbt: aggregate(singleResults.map(() => 0)),
        domContentLoaded: aggregate(singleResults.map((r) => r.timing.domContentLoaded)),
        load: aggregate(singleResults.map((r) => r.timing.load)),
        hydration: null,
      },
      resources: {
        totalTransfer: aggregate(singleResults.map((r) => r.resources.totalTransfer)),
        totalCount: aggregate(singleResults.map((r) => r.resources.totalCount)),
        byType: {},
      },
      javascript: {
        mainThreadBlocking: aggregate(singleResults.map(() => 0)),
        longTasks: aggregate(singleResults.map(() => 0)),
        heapSize: aggregate(singleResults.map((r) => r.heapSize)),
      },
      runs,
    };

    return ok(benchmark);
  } catch (e) {
    await closeBrowser(browser);
    return err({
      code: 'LAUNCH_FAILED',
      message: e instanceof Error ? e.message : 'Benchmark failed',
      cause: e,
    });
  }
};

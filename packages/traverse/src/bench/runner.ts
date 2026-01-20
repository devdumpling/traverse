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
  HydrationFramework,
  ResourceType,
  ResourceTypeMetrics,
} from '../types.ts';
import { ok, err } from '../result.ts';
import { launchBrowser, createContext, closeBrowser } from '../browser/launch.ts';
import { createCdpSession, enablePerformanceMetrics, emulateNetworkConditions, clearBrowserCache, getHeapSize } from '../browser/cdp.ts';
import { captureCwv, captureNavigationTiming } from '../capture/cwv.ts';
import { captureResources } from '../capture/resources.ts';
import { captureSsr } from '../capture/ssr.ts';
import { captureBlocking, injectLongTaskObserver } from '../capture/blocking.ts';
import { aggregate, aggregateNullable } from './aggregator.ts';

export interface BenchOptions {
  readonly url: string;
  readonly runs: number;
  readonly device: DeviceConfig;
  readonly network: NetworkConfig | null;
}

interface ResourceTypeBreakdown {
  readonly count: number;
  readonly transferSize: number;
  readonly decodedSize: number;
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
    readonly byType: Record<string, ResourceTypeBreakdown>;
  };
  readonly timing: {
    readonly domContentLoaded: number;
    readonly load: number;
  };
  readonly heapSize: number;
  readonly blocking: {
    readonly totalBlockingTime: number;
    readonly longTaskCount: number;
  };
  readonly ssr: {
    readonly hasContent: boolean;
    readonly inlineScriptSize: number;
    readonly inlineScriptCount: number;
    readonly hydrationPayloadSize: number;
    readonly hydrationFramework: HydrationFramework;
    readonly nextDataSize: number;
    readonly reactRouterDataSize: number;
    readonly rscPayloadSize: number;
    readonly rscChunkCount: number;
  };
}

const RESOURCE_TYPES: readonly ResourceType[] = [
  'script', 'stylesheet', 'image', 'font', 'fetch', 'document', 'other'
] as const;

const aggregateByType = (
  results: readonly SingleRunResult[]
): Partial<Record<ResourceType, ResourceTypeMetrics>> => {
  const aggregated: Partial<Record<ResourceType, ResourceTypeMetrics>> = {};

  for (const type of RESOURCE_TYPES) {
    const counts = results.map((r) => r.resources.byType[type]?.count ?? 0);
    const transfers = results.map((r) => r.resources.byType[type]?.transferSize ?? 0);
    const decoded = results.map((r) => r.resources.byType[type]?.decodedSize ?? 0);

    // Only include types that have data
    if (counts.some((c) => c > 0)) {
      aggregated[type] = {
        count: aggregate(counts),
        transferSize: aggregate(transfers),
        decodedSize: aggregate(decoded),
      };
    }
  }

  return aggregated;
};

const runSingleBenchmark = async (
  page: Page,
  url: string,
  network: NetworkConfig | null
): Promise<Result<SingleRunResult, BrowserError>> => {
  // Inject long task observer before navigation
  const observerResult = await injectLongTaskObserver(page);
  if (!observerResult.ok) return observerResult;

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

  const blockingResult = await captureBlocking(page);
  if (!blockingResult.ok) return blockingResult;

  const ssrResult = await captureSsr(page);
  if (!ssrResult.ok) return ssrResult;

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
      byType: resourcesResult.value.byType,
    },
    timing: timingResult.value,
    heapSize: heapResult.value,
    blocking: {
      totalBlockingTime: blockingResult.value.totalBlockingTime,
      longTaskCount: blockingResult.value.longTaskCount,
    },
    ssr: {
      hasContent: ssrResult.value.hasContent,
      inlineScriptSize: ssrResult.value.inlineScripts.totalSize,
      inlineScriptCount: ssrResult.value.inlineScripts.count,
      hydrationPayloadSize: ssrResult.value.hydration.payloadSize,
      hydrationFramework: ssrResult.value.hydration.framework,
      nextDataSize: ssrResult.value.hydration.nextData.size,
      reactRouterDataSize: ssrResult.value.hydration.reactRouterData.size,
      rscPayloadSize: ssrResult.value.hydration.rscPayload.size,
      rscChunkCount: ssrResult.value.hydration.rscPayload.chunkCount,
    },
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
          mainThreadBlocking: result.value.blocking.totalBlockingTime,
          longTaskCount: result.value.blocking.longTaskCount,
          heapSize: result.value.heapSize,
        },
        timing: result.value.timing,
        ssr: {
          hasContent: result.value.ssr.hasContent,
          inlineScriptSize: result.value.ssr.inlineScriptSize,
          inlineScriptCount: result.value.ssr.inlineScriptCount,
          hydrationPayloadSize: result.value.ssr.hydrationPayloadSize,
          hydrationFramework: result.value.ssr.hydrationFramework,
        },
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
        tbt: aggregate(singleResults.map((r) => r.blocking.totalBlockingTime)),
        domContentLoaded: aggregate(singleResults.map((r) => r.timing.domContentLoaded)),
        load: aggregate(singleResults.map((r) => r.timing.load)),
        hydration: null,
      },
      resources: {
        totalTransfer: aggregate(singleResults.map((r) => r.resources.totalTransfer)),
        totalCount: aggregate(singleResults.map((r) => r.resources.totalCount)),
        byType: aggregateByType(singleResults),
      },
      javascript: {
        mainThreadBlocking: aggregate(singleResults.map((r) => r.blocking.totalBlockingTime)),
        longTasks: aggregate(singleResults.map((r) => r.blocking.longTaskCount)),
        heapSize: aggregate(singleResults.map((r) => r.heapSize)),
      },
      ssr: {
        hasContent: aggregate(singleResults.map((r) => r.ssr.hasContent ? 1 : 0)),
        inlineScriptSize: aggregate(singleResults.map((r) => r.ssr.inlineScriptSize)),
        inlineScriptCount: aggregate(singleResults.map((r) => r.ssr.inlineScriptCount)),
        hydrationPayloadSize: aggregate(singleResults.map((r) => r.ssr.hydrationPayloadSize)),
        hydrationFramework: singleResults[0]?.ssr.hydrationFramework ?? null,
        nextDataSize: singleResults.some((r) => r.ssr.nextDataSize > 0)
          ? aggregate(singleResults.map((r) => r.ssr.nextDataSize))
          : null,
        reactRouterDataSize: singleResults.some((r) => r.ssr.reactRouterDataSize > 0)
          ? aggregate(singleResults.map((r) => r.ssr.reactRouterDataSize))
          : null,
        rscPayloadSize: singleResults.some((r) => r.ssr.rscPayloadSize > 0)
          ? aggregate(singleResults.map((r) => r.ssr.rscPayloadSize))
          : null,
        rscChunkCount: singleResults.some((r) => r.ssr.rscChunkCount > 0)
          ? aggregate(singleResults.map((r) => r.ssr.rscChunkCount))
          : null,
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

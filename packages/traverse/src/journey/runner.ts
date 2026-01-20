/**
 * Journey runner - executes journeys and collects metrics.
 */

import type { Browser, Page } from 'playwright';
import type {
  Result,
  BrowserError,
  DeviceConfig,
  JourneyResult,
  JourneyStepResult,
  CumulativeMetrics,
  JourneyRun,
  AggregatedMetric,
} from '../types.ts';
import { ok, err } from '../result.ts';
import { launchBrowser, createContext, closeBrowser } from '../browser/launch.ts';
import { aggregate, aggregateNullable } from '../bench/aggregator.ts';
import type { JourneyDefinition, StepContext } from './define.ts';
import { createCaptureContext, createNavigationTracker, type StepCaptureData } from './context.ts';

export interface JourneyRunOptions {
  readonly journey: JourneyDefinition;
  readonly baseUrl: string;
  readonly runs: number;
  readonly device: DeviceConfig;
}

interface SingleStepResult {
  readonly name: string;
  readonly startTime: number;
  readonly endTime: number;
  readonly data: StepCaptureData;
}

interface SingleRunResult {
  readonly steps: readonly SingleStepResult[];
}

const createEmptyCaptureData = (): StepCaptureData => ({
  cwv: null,
  resources: null,
  navigation: null,
  memory: null,
  interaction: null,
  custom: {},
});

const runSingleJourney = async (
  browser: Browser,
  options: JourneyRunOptions
): Promise<Result<SingleRunResult, BrowserError>> => {
  const contextResult = await createContext(browser, { 
    device: options.device,
    baseURL: options.baseUrl,
  });
  if (!contextResult.ok) return contextResult;
  const context = contextResult.value;

  const page = await context.newPage();
  const steps: SingleStepResult[] = [];
  const navigationTracker = createNavigationTracker();

  try {
    await options.journey.run({
      step: async (name, fn) => {
        const data = createEmptyCaptureData();
        const captureContext = createCaptureContext(page, data, navigationTracker);
        const stepContext: StepContext = { page, capture: captureContext };

        const startTime = performance.now();
        await fn(stepContext);
        const endTime = performance.now();

        // Always finalize navigation state after step completes
        // This ensures accurate tracking even if capture.navigation() wasn't called
        await navigationTracker.finalizeStep(page);

        steps.push({ name, startTime, endTime, data });
      },
    });

    await page.close();
    await context.close();

    return ok({ steps });
  } catch (e) {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    return err({
      code: 'NAVIGATION_FAILED',
      message: e instanceof Error ? e.message : 'Journey execution failed',
      cause: e,
    });
  }
};

const aggregateStepResults = (
  allRuns: readonly SingleRunResult[]
): readonly JourneyStepResult[] => {
  if (allRuns.length === 0) return [];

  const firstRun = allRuns[0];
  if (!firstRun) return [];

  return firstRun.steps.map((_, stepIndex) => {
    const stepName = firstRun.steps[stepIndex]?.name ?? `step-${stepIndex}`;
    
    const stepDataAcrossRuns = allRuns.map((run) => {
      const step = run.steps[stepIndex];
      return step ?? { name: stepName, startTime: 0, endTime: 0, data: createEmptyCaptureData() };
    });

    const durations = stepDataAcrossRuns.map((s) => s.endTime - s.startTime);
    const lcpValues = stepDataAcrossRuns.map((s) => s.data.cwv?.lcp ?? null);
    const clsValues = stepDataAcrossRuns.map((s) => s.data.cwv?.cls ?? 0);
    const loadedValues = stepDataAcrossRuns.map((s) => s.data.resources?.loaded ?? 0);
    const fromCacheValues = stepDataAcrossRuns.map((s) => s.data.resources?.fromCache ?? 0);
    const transferredValues = stepDataAcrossRuns.map((s) => s.data.resources?.transferred ?? 0);
    const memoryValues = stepDataAcrossRuns.map((s) => s.data.memory ?? 0);

    const firstStepNav = stepDataAcrossRuns[0]?.data.navigation;

    return {
      name: stepName,
      index: stepIndex,
      navigation: {
        type: firstStepNav?.type ?? (stepIndex === 0 ? 'initial' : 'soft'),
        trigger: firstStepNav?.trigger ?? null,
        prefetchStatus: firstStepNav?.prefetchStatus ?? null,
        duration: aggregate(durations),
      },
      cwv: {
        lcp: aggregateNullable(lcpValues),
        cls: aggregate(clsValues),
        inp: null,
      },
      resources: {
        loaded: aggregate(loadedValues),
        fromCache: aggregate(fromCacheValues),
        transferred: aggregate(transferredValues),
      },
      javascript: {
        executionTime: aggregate(durations),
        longTasks: aggregate(stepDataAcrossRuns.map(() => 0)),
        heapDelta: aggregate(memoryValues),
      },
      custom: {},
    } satisfies JourneyStepResult;
  });
};

const calculateCumulativeMetrics = (
  allRuns: readonly SingleRunResult[]
): CumulativeMetrics => {
  const totalDurations = allRuns.map((run) =>
    run.steps.reduce((sum, step) => sum + (step.endTime - step.startTime), 0)
  );

  const totalTransferred = allRuns.map((run) =>
    run.steps.reduce((sum, step) => sum + (step.data.resources?.transferred ?? 0), 0)
  );

  const totalCls = allRuns.map((run) =>
    run.steps.reduce((sum, step) => sum + (step.data.cwv?.cls ?? 0), 0)
  );

  const memoryHighWater = allRuns.map((run) =>
    Math.max(...run.steps.map((step) => step.data.memory ?? 0))
  );

  const cacheHitRates = allRuns.map((run) => {
    const totalLoaded = run.steps.reduce((sum, step) => sum + (step.data.resources?.loaded ?? 0), 0);
    const totalFromCache = run.steps.reduce((sum, step) => sum + (step.data.resources?.fromCache ?? 0), 0);
    return totalLoaded > 0 ? (totalFromCache / totalLoaded) * 100 : 0;
  });

  return {
    totalDuration: aggregate(totalDurations),
    totalTransferred: aggregate(totalTransferred),
    uniqueJsLoaded: aggregate(totalTransferred.map(() => 0)), // TODO: Track unique JS
    cacheHitRate: aggregate(cacheHitRates),
    memoryHighWater: aggregate(memoryHighWater),
    totalLongTaskTime: aggregate(allRuns.map(() => 0)),
    totalCls: aggregate(totalCls),
  };
};

const buildJourneyRuns = (allRuns: readonly SingleRunResult[]): readonly JourneyRun[] =>
  allRuns.map((run, index) => ({
    index,
    steps: run.steps.map((step) => ({
      name: step.name,
      duration: step.endTime - step.startTime,
      navigationType: step.data.navigation?.type ?? 'none',
    })),
    cumulative: {
      totalDuration: run.steps.reduce((sum, s) => sum + (s.endTime - s.startTime), 0),
      totalTransferred: run.steps.reduce((sum, s) => sum + (s.data.resources?.transferred ?? 0), 0),
      memoryHighWater: Math.max(...run.steps.map((s) => s.data.memory ?? 0)),
    },
  }));

export const runJourney = async (
  options: JourneyRunOptions
): Promise<Result<JourneyResult, BrowserError>> => {
  const browserResult = await launchBrowser();
  if (!browserResult.ok) return browserResult;
  const browser = browserResult.value;

  try {
    const allRuns: SingleRunResult[] = [];

    for (let i = 0; i < options.runs; i++) {
      const runResult = await runSingleJourney(browser, options);
      if (!runResult.ok) {
        await closeBrowser(browser);
        return runResult;
      }
      allRuns.push(runResult.value);
    }

    await closeBrowser(browser);

    const result: JourneyResult = {
      meta: {
        name: options.journey.name,
        description: options.journey.description,
        capturedAt: new Date().toISOString(),
        baseUrl: options.baseUrl,
        runs: options.runs,
        device: options.device,
      },
      steps: aggregateStepResults(allRuns),
      cumulative: calculateCumulativeMetrics(allRuns),
      runs: buildJourneyRuns(allRuns),
    };

    return ok(result);
  } catch (e) {
    await closeBrowser(browser);
    return err({
      code: 'LAUNCH_FAILED',
      message: e instanceof Error ? e.message : 'Journey run failed',
      cause: e,
    });
  }
};

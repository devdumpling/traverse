/**
 * Blocking time and long task capture.
 * 
 * Total Blocking Time (TBT) is the sum of the blocking portion of all long tasks
 * between FCP and Time to Interactive. A long task is any task > 50ms, and the
 * blocking portion is the time beyond 50ms.
 */

import type { Page } from 'playwright';
import type { Result, BrowserError } from '../types.ts';
import { ok, fromPromise } from '../result.ts';

export interface LongTask {
  readonly startTime: number;
  readonly duration: number;
  readonly blockingTime: number;
}

export interface BlockingCapture {
  readonly totalBlockingTime: number;
  readonly longTaskCount: number;
  readonly longTasks: readonly LongTask[];
  readonly totalLongTaskTime: number;
}

// Browser-context function to capture blocking metrics
// This should be injected early and collected after load
const blockingCaptureFunction = `() => {
  const LONG_TASK_THRESHOLD = 50;
  const tasks = [];
  let totalBlockingTime = 0;
  let totalLongTaskTime = 0;

  // Check if we have buffered entries from a pre-injected observer
  if (window.__traverse_long_tasks) {
    for (const task of window.__traverse_long_tasks) {
      const blockingTime = Math.max(0, task.duration - LONG_TASK_THRESHOLD);
      tasks.push({
        startTime: task.startTime,
        duration: task.duration,
        blockingTime,
      });
      totalBlockingTime += blockingTime;
      totalLongTaskTime += task.duration;
    }
  }

  // Also try to get any from PerformanceObserver buffered entries
  try {
    const entries = performance.getEntriesByType('longtask');
    for (const entry of entries) {
      // Avoid duplicates if already captured by observer
      const isDuplicate = tasks.some(t => 
        Math.abs(t.startTime - entry.startTime) < 1 && 
        Math.abs(t.duration - entry.duration) < 1
      );
      if (!isDuplicate) {
        const blockingTime = Math.max(0, entry.duration - LONG_TASK_THRESHOLD);
        tasks.push({
          startTime: entry.startTime,
          duration: entry.duration,
          blockingTime,
        });
        totalBlockingTime += blockingTime;
        totalLongTaskTime += entry.duration;
      }
    }
  } catch (e) {
    // longtask type may not be available
  }

  return {
    totalBlockingTime,
    longTaskCount: tasks.length,
    longTasks: tasks,
    totalLongTaskTime,
  };
}`;

export const captureBlocking = async (
  page: Page
): Promise<Result<BlockingCapture, BrowserError>> => {
  const result = await fromPromise(
    page.evaluate(`(${blockingCaptureFunction})()`) as Promise<BlockingCapture>,
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to capture blocking metrics',
      cause: e,
    })
  );
  return result;
};

// Inject long task observer early in page lifecycle
// Should be called before navigation to capture all long tasks
export const injectLongTaskObserver = async (
  page: Page
): Promise<Result<void, BrowserError>> => {
  const observerScript = `
    window.__traverse_long_tasks = [];
    
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          window.__traverse_long_tasks.push({
            startTime: entry.startTime,
            duration: entry.duration,
          });
        }
      });
      observer.observe({ type: 'longtask', buffered: true });
    } catch (e) {
      // longtask observation not supported
    }
  `;

  const result = await fromPromise(
    page.addInitScript(observerScript),
    (e): BrowserError => ({
      code: 'CDP_ERROR',
      message: e instanceof Error ? e.message : 'Failed to inject long task observer',
      cause: e,
    })
  );

  return result.ok ? ok(undefined) : result;
};

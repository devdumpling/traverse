/**
 * Traverse - Performance data capture and analysis toolkit
 */

// Core types
export type {
  Result,
  ByteSize,
  AggregatedMetric,
  DeviceConfig,
  NetworkConfig,
  TraverseConfig,
  NavigationType,
  NavigationTrigger,
  PrefetchStatus,
  ResourceType,
  RuntimeBenchmark,
  JourneyResult,
  JourneyStepResult,
  CumulativeMetrics,
} from './types.ts';

// Result utilities
export { ok, err, isOk, isErr, unwrap, unwrapOr, map, flatMap, match } from './result.ts';

// Journey API
export { defineJourney } from './journey/index.ts';
export type { JourneyDefinition, JourneyContext, StepContext, CaptureContext } from './journey/index.ts';

// Config
export { defineConfig, loadConfig, getDeviceConfig, getNetworkConfig } from './config/index.ts';

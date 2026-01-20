/**
 * Core type definitions for Traverse.
 * All domain types live here - the single source of truth.
 */

// =============================================================================
// Result Type
// =============================================================================

export type Result<T, E> = 
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

// =============================================================================
// Primitive Types
// =============================================================================

export interface ByteSize {
  readonly raw: number;
  readonly gzip: number;
  readonly brotli: number;
}

export interface AggregatedMetric {
  readonly median: number;
  readonly p75: number;
  readonly p95: number;
  readonly min: number;
  readonly max: number;
  readonly variance: number;
  readonly values: readonly number[];
}

// =============================================================================
// Configuration Types
// =============================================================================

export interface DeviceConfig {
  readonly viewport: {
    readonly width: number;
    readonly height: number;
  };
  readonly userAgent?: string;
  readonly deviceScaleFactor: number;
  readonly isMobile: boolean;
  readonly hasTouch: boolean;
}

export interface NetworkConfig {
  readonly downloadThroughput: number;
  readonly uploadThroughput: number;
  readonly latency: number;
}

export interface TraverseConfig {
  readonly defaults: {
    readonly runs: number;
    readonly device: string;
    readonly network: string;
  };
  readonly devices: Record<string, DeviceConfig>;
  readonly networks: Record<string, NetworkConfig>;
  readonly output: {
    readonly dir: string;
    readonly baselineFile: string;
  };
  readonly journeys: {
    readonly dir: string;
    readonly pattern: string;
  };
}

// =============================================================================
// Navigation Types
// =============================================================================

export type NavigationType = 'initial' | 'hard' | 'soft' | 'none';

export type NavigationTrigger = 'link' | 'programmatic' | 'back-forward' | 'reload';

export type PrefetchStatus = 'prefetched' | 'not-prefetched' | 'partial';

export type ResourceCacheStatus = 'memory' | 'disk' | 'service-worker' | 'network';

export type ResourceType = 'script' | 'stylesheet' | 'image' | 'font' | 'fetch' | 'document' | 'other';

// =============================================================================
// Static Analysis Types
// =============================================================================

export type FrameworkType = 'nextjs' | 'react-router' | 'sveltekit' | 'generic-spa' | 'unknown';

export type RouterType = 'app' | 'pages' | 'hybrid' | 'unknown';

export interface StaticAnalysisMeta {
  readonly analyzedAt: string;
  readonly framework: FrameworkType;
  readonly frameworkVersion: string | null;
  readonly sourceDir: string;
  readonly buildDir: string | null;
}

export interface EntryAnalysis {
  readonly name: string;
  readonly route: string | null;
  readonly size: ByteSize;
  readonly chunks: readonly string[];
}

export interface ChunkAnalysis {
  readonly id: string;
  readonly path: string;
  readonly size: ByteSize;
  readonly shared: boolean;
  readonly loadedBy: readonly string[];
}

export interface RouteAnalysis {
  readonly path: string;
  readonly type: 'static' | 'dynamic' | 'catch-all';
  readonly segments: readonly string[];
  readonly chunks: readonly string[];
}

export interface DuplicateDependency {
  readonly name: string;
  readonly versions: readonly string[];
  readonly locations: readonly string[];
}

export interface NextJsAnalysis {
  readonly routerType: RouterType;
  readonly routes: readonly {
    readonly path: string;
    readonly type: 'static' | 'dynamic';
    readonly segments: readonly string[];
  }[];
  readonly hasMiddleware: boolean;
  readonly turbopack: boolean;
}

export interface BundleAnalysis {
  readonly total: ByteSize;
  readonly javascript: ByteSize;
  readonly css: ByteSize;
  readonly entries: readonly EntryAnalysis[];
  readonly chunks: readonly ChunkAnalysis[];
  readonly duplicates: readonly DuplicateDependency[];
}

export interface StaticAnalysis {
  readonly meta: StaticAnalysisMeta;
  readonly bundles: BundleAnalysis;
  readonly routes: readonly RouteAnalysis[];
  readonly frameworkSpecific: NextJsAnalysis | null;
}

// =============================================================================
// Capture State
// =============================================================================

export type CaptureState =
  | { readonly status: 'idle' }
  | { readonly status: 'running'; readonly startedAt: number }
  | { readonly status: 'complete'; readonly result: RuntimeBenchmark }
  | { readonly status: 'failed'; readonly error: CaptureError };

export interface CaptureError {
  readonly code: string;
  readonly message: string;
  readonly cause?: unknown;
}

// =============================================================================
// Runtime Benchmark Types
// =============================================================================

export interface RuntimeBenchmarkMeta {
  readonly url: string;
  readonly capturedAt: string;
  readonly runs: number;
  readonly device: DeviceConfig;
  readonly network: NetworkConfig | null;
}

export interface CoreWebVitals {
  readonly lcp: AggregatedMetric;
  readonly inp: AggregatedMetric | null;
  readonly cls: AggregatedMetric;
  readonly fcp: AggregatedMetric;
  readonly ttfb: AggregatedMetric;
}

export interface ExtendedMetrics {
  readonly tti: AggregatedMetric | null;
  readonly tbt: AggregatedMetric;
  readonly domContentLoaded: AggregatedMetric;
  readonly load: AggregatedMetric;
  readonly hydration: AggregatedMetric | null;
}

export interface ResourceMetrics {
  readonly count: AggregatedMetric;
  readonly transferred: AggregatedMetric;
  readonly fromCache: AggregatedMetric;
}

export interface JavaScriptMetrics {
  readonly mainThreadBlocking: AggregatedMetric;
  readonly longTasks: AggregatedMetric;
  readonly heapSize: AggregatedMetric;
}

export type HydrationFramework = 'next' | 'react-router' | 'remix' | 'unknown' | null;

export interface SsrMetrics {
  readonly hasContent: AggregatedMetric;
  readonly inlineScriptSize: AggregatedMetric;
  readonly inlineScriptCount: AggregatedMetric;
  readonly hydrationPayloadSize: AggregatedMetric;
  readonly hydrationFramework: HydrationFramework;
  readonly nextDataSize: AggregatedMetric | null;
  readonly reactRouterDataSize: AggregatedMetric | null;
  readonly rscPayloadSize: AggregatedMetric | null;
  readonly rscChunkCount: AggregatedMetric | null;
}

export interface RuntimeRun {
  readonly index: number;
  readonly cwv: {
    readonly lcp: number | null;
    readonly inp: number | null;
    readonly cls: number;
    readonly fcp: number | null;
    readonly ttfb: number | null;
  };
  readonly resources: {
    readonly totalTransfer: number;
    readonly totalCount: number;
    readonly fromCache: number;
  };
  readonly javascript: {
    readonly mainThreadBlocking: number;
    readonly longTaskCount: number;
    readonly heapSize: number;
  };
  readonly timing: {
    readonly domContentLoaded: number;
    readonly load: number;
  };
  readonly ssr: {
    readonly hasContent: boolean;
    readonly inlineScriptSize: number;
    readonly inlineScriptCount: number;
    readonly hydrationPayloadSize: number;
    readonly hydrationFramework: HydrationFramework;
  };
}

export interface RuntimeBenchmark {
  readonly meta: RuntimeBenchmarkMeta;
  readonly cwv: CoreWebVitals;
  readonly extended: ExtendedMetrics;
  readonly resources: {
    readonly totalTransfer: AggregatedMetric;
    readonly totalCount: AggregatedMetric;
    readonly byType: Partial<Record<ResourceType, ResourceMetrics>>;
  };
  readonly javascript: JavaScriptMetrics;
  readonly ssr: SsrMetrics;
  readonly runs: readonly RuntimeRun[];
}

// =============================================================================
// Journey Types
// =============================================================================

export interface JourneyMeta {
  readonly name: string;
  readonly description: string;
  readonly capturedAt: string;
  readonly baseUrl: string;
  readonly runs: number;
  readonly device: DeviceConfig;
}

export interface JourneyStepNavigation {
  readonly type: NavigationType;
  readonly trigger: NavigationTrigger | null;
  readonly prefetchStatus: PrefetchStatus | null;
  readonly duration: AggregatedMetric;
}

export interface JourneyStepResult {
  readonly name: string;
  readonly index: number;
  readonly navigation: JourneyStepNavigation;
  readonly cwv: {
    readonly lcp: AggregatedMetric | null;
    readonly cls: AggregatedMetric;
    readonly inp: AggregatedMetric | null;
  };
  readonly resources: {
    readonly loaded: AggregatedMetric;
    readonly fromCache: AggregatedMetric;
    readonly transferred: AggregatedMetric;
  };
  readonly javascript: {
    readonly executionTime: AggregatedMetric;
    readonly longTasks: AggregatedMetric;
    readonly heapDelta: AggregatedMetric;
  };
  readonly custom: Record<string, AggregatedMetric>;
}

export interface CumulativeMetrics {
  readonly totalDuration: AggregatedMetric;
  readonly totalTransferred: AggregatedMetric;
  readonly uniqueJsLoaded: AggregatedMetric;
  readonly cacheHitRate: AggregatedMetric;
  readonly memoryHighWater: AggregatedMetric;
  readonly totalLongTaskTime: AggregatedMetric;
  readonly totalCls: AggregatedMetric;
}

export interface JourneyRun {
  readonly index: number;
  readonly steps: readonly {
    readonly name: string;
    readonly duration: number;
    readonly navigationType: NavigationType;
  }[];
  readonly cumulative: {
    readonly totalDuration: number;
    readonly totalTransferred: number;
    readonly memoryHighWater: number;
  };
}

export interface JourneyResult {
  readonly meta: JourneyMeta;
  readonly steps: readonly JourneyStepResult[];
  readonly cumulative: CumulativeMetrics;
  readonly runs: readonly JourneyRun[];
}

// =============================================================================
// CLI Types
// =============================================================================

export type OutputFormat = 'json' | 'markdown' | 'html';

export interface BenchCommand {
  readonly command: 'bench';
  readonly url: string;
  readonly runs: number;
  readonly device: string;
  readonly network: string | null;
  readonly output: string | null;
  readonly format: OutputFormat;
}

export interface JourneyCommand {
  readonly command: 'journey';
  readonly journeyFile: string;
  readonly baseUrl: string;
  readonly runs: number;
  readonly device: string;
  readonly output: string | null;
  readonly format: OutputFormat;
}

export interface AnalyzeCommand {
  readonly command: 'analyze';
  readonly sourceDir: string;
  readonly buildDir: string | null;
  readonly framework: string | null;
  readonly output: string | null;
  readonly format: OutputFormat;
}

export interface CompareCommand {
  readonly command: 'compare';
  readonly baseline: string;
  readonly current: string;
  readonly additional: readonly string[];
  readonly output: string | null;
  readonly format: OutputFormat;
}

export interface ReportCommand {
  readonly command: 'report';
  readonly captureFile: string;
  readonly output: string | null;
  readonly format: OutputFormat;
  readonly template: string | null;
}

export interface InitCommand {
  readonly command: 'init';
}

export interface ValidateCommand {
  readonly command: 'validate';
  readonly journeyFile: string;
}

export interface HelpCommand {
  readonly command: 'help';
  readonly subcommand: string | null;
}

export interface VersionCommand {
  readonly command: 'version';
}

export type Command =
  | BenchCommand
  | JourneyCommand
  | AnalyzeCommand
  | CompareCommand
  | ReportCommand
  | InitCommand
  | ValidateCommand
  | HelpCommand
  | VersionCommand;

// =============================================================================
// Error Types
// =============================================================================

export type ParseErrorCode =
  | 'UNKNOWN_COMMAND'
  | 'MISSING_REQUIRED_ARG'
  | 'INVALID_ARG_VALUE'
  | 'UNKNOWN_FLAG';

export interface ParseError {
  readonly code: ParseErrorCode;
  readonly message: string;
  readonly arg?: string;
}

export type ConfigErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_INVALID'
  | 'CONFIG_LOAD_FAILED';

export interface ConfigError {
  readonly code: ConfigErrorCode;
  readonly message: string;
  readonly path?: string;
}

export type BrowserErrorCode =
  | 'LAUNCH_FAILED'
  | 'NAVIGATION_FAILED'
  | 'TIMEOUT'
  | 'CDP_ERROR';

export interface BrowserError {
  readonly code: BrowserErrorCode;
  readonly message: string;
  readonly cause?: unknown;
}

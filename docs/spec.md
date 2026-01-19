# Traverse

**General-purpose web application performance data capture and analysis toolkit**

---

## Executive Summary

Traverse is a CLI tool for capturing detailed performance data from web applications, with a specific focus on measuring the cumulative user experience across multi-step journeys rather than isolated page loads.

Modern web frameworks (Next.js, React Router, SvelteKit, etc.) have diverged significantly in how they handle client-side navigation, prefetching, code splitting, and hydration. Standard performance tools like Lighthouse provide single-page snapshots, but they don't answer questions like:

- "After navigating through 4 pages, what does the 5th page load feel like?"
- "How much JavaScript has accumulated in memory after a typical user session?"
- "What's the cache hit rate on subsequent navigations?"
- "How do soft navigations compare to hard navigations across frameworks?"

Traverse captures this data systematically, enabling apples-to-apples comparisons across framework choices and architectural decisions.

---

## Core Philosophy

### Data Capture, Not Testing

Traverse is **not** a test runner. It does not make assertions or pass/fail judgments. Its job is to:

1. Execute defined scenarios against web applications
2. Capture comprehensive performance telemetry
3. Structure that data for analysis and comparison
4. Generate reports that surface insights

The user decides what the data means. Traverse provides the evidence.

### Journey-Centric Measurement

Single-page metrics (LCP, FCP, TTFB) are necessary but insufficient. Real users don't experience single pages—they experience sessions. A user who lands on a homepage, browses products, adds to cart, and checks out has a fundamentally different experience than what Lighthouse captures on any individual page.

Traverse treats the **journey** as the primary unit of measurement:

- Each step in a journey captures its own metrics
- Cumulative metrics track resource accumulation across steps
- Navigation type (hard load, soft navigation, prefetched, cached) is recorded
- The relationship between steps is preserved in the data model

### Framework-Agnostic, Framework-Aware

Traverse works with any web application that runs in a browser. However, it includes framework-specific analysis modules that understand:

- Next.js: RSC payloads, route segment structure, prefetch behavior, `.next/` build output
- React Router: Loader waterfalls, deferred data, client-side routing patterns
- Generic SPA: Standard client-side routing, code splitting patterns

Framework-specific modules are opt-in and additive—they enrich the data, they don't gate functionality.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Traverse CLI                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Static    │  │   Runtime    │  │   Journey    │          │
│  │   Analyzer   │  │  Benchmark   │  │   Runner     │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                   │
│         ▼                 ▼                 ▼                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Data Collector                        │   │
│  │  (Unified telemetry capture from all analysis modes)     │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Data Store                            │   │
│  │  (JSON-based, supports baselines and comparisons)        │   │
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Report Generator                       │   │
│  │  (JSON, Markdown, HTML dashboard, CI annotations)        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Module Specifications

### 1. Static Analyzer

**Purpose:** Analyze source code and build outputs without running the application.

**Inputs:**
- Source directory (for AST analysis)
- Build output directory (`.next/`, `dist/`, etc.)
- Source maps (when available)

**Capabilities:**

#### Bundle Analysis
- Total bundle size (raw, gzip, brotli)
- Per-route/entry-point breakdown
- Per-chunk breakdown with dependency attribution
- Shared chunk identification
- Duplicate dependency detection (same package at multiple versions)
- Tree-shaking effectiveness (dead code estimation)

#### Source Code Analysis
- Route structure mapping (file-system routes, dynamic segments)
- Component dependency graph
- Data fetching pattern detection (server components, loaders, use hooks)
- Third-party dependency weight attribution ("lodash contributes 45KB to /checkout")

#### Framework-Specific (Next.js initial focus)
- App Router vs Pages Router detection
- Server Component vs Client Component boundaries
- Route segment config parsing (dynamic, revalidate, etc.)
- Middleware analysis
- RSC payload size estimation per route

**Output Schema:**
```typescript
interface StaticAnalysis {
  meta: {
    analyzedAt: string;
    framework: string | null;
    frameworkVersion: string | null;
    sourceDir: string;
    buildDir: string | null;
  };
  bundles: {
    total: ByteSize;
    entries: EntryAnalysis[];
    chunks: ChunkAnalysis[];
    duplicates: DuplicateDependency[];
  };
  routes: RouteAnalysis[];
  dependencies: DependencyAnalysis[];
  frameworkSpecific?: NextJsAnalysis | ReactRouterAnalysis;
}

interface ByteSize {
  raw: number;
  gzip: number;
  brotli: number;
}

interface EntryAnalysis {
  name: string;
  route: string | null;
  size: ByteSize;
  chunks: string[];
  dependencies: string[];
}

interface ChunkAnalysis {
  id: string;
  size: ByteSize;
  modules: ModuleAttribution[];
  shared: boolean;
  loadedBy: string[]; // entry points that load this chunk
}

interface ModuleAttribution {
  path: string;
  size: number;
  package: string | null; // null for first-party code
}
```

---

### 2. Runtime Benchmark

**Purpose:** Capture performance metrics from live page loads.

**Inputs:**
- URL(s) to benchmark
- Device/viewport configuration
- Network throttling settings
- Number of runs for statistical aggregation

**Capabilities:**

#### Core Web Vitals
- Largest Contentful Paint (LCP)
- Interaction to Next Paint (INP) — requires interaction simulation
- Cumulative Layout Shift (CLS)
- First Contentful Paint (FCP)
- Time to First Byte (TTFB)

#### Extended Metrics
- Time to Interactive (TTI)
- Total Blocking Time (TBT)
- First Input Delay (FID) simulation
- DOM Content Loaded
- Load event
- Hydration timing (framework-specific instrumentation)

#### Resource Metrics
- Total transfer size
- Total resource count
- Resource breakdown by type (JS, CSS, images, fonts, data)
- Cache utilization (from-cache vs network)
- Network waterfall data

#### JavaScript Metrics
- Main thread blocking time
- Long task count and duration
- Script evaluation time
- Heap size snapshots

#### Statistical Aggregation
- Multiple runs (configurable, default 5)
- Median, p75, p95 calculations
- Outlier detection and optional exclusion
- Variance reporting

**Output Schema:**
```typescript
interface RuntimeBenchmark {
  meta: {
    url: string;
    capturedAt: string;
    runs: number;
    device: DeviceConfig;
    network: NetworkConfig;
  };
  cwv: {
    lcp: AggregatedMetric;
    inp: AggregatedMetric | null; // null if no interactions
    cls: AggregatedMetric;
    fcp: AggregatedMetric;
    ttfb: AggregatedMetric;
  };
  extended: {
    tti: AggregatedMetric;
    tbt: AggregatedMetric;
    domContentLoaded: AggregatedMetric;
    load: AggregatedMetric;
    hydration: AggregatedMetric | null;
  };
  resources: {
    totalTransfer: AggregatedMetric;
    totalCount: AggregatedMetric;
    byType: Record<ResourceType, ResourceMetrics>;
  };
  javascript: {
    mainThreadBlocking: AggregatedMetric;
    longTasks: AggregatedMetric;
    heapSize: AggregatedMetric;
  };
  runs: RuntimeRun[]; // individual run data for drill-down
}

interface AggregatedMetric {
  median: number;
  p75: number;
  p95: number;
  min: number;
  max: number;
  variance: number;
  values: number[];
}
```

---

### 3. Journey Runner

**Purpose:** Execute multi-step user journeys and capture per-step and cumulative metrics.

This is the differentiating module. It answers questions that single-page tools cannot.

**Inputs:**
- Journey definition (TypeScript/JavaScript script)
- Base URL
- Device/viewport configuration
- Number of complete journey runs

**Journey Definition Format:**

Journeys are defined as async functions that receive a Traverse context object. This provides full Playwright power while capturing telemetry automatically.

```typescript
// journeys/checkout-flow.ts
import { defineJourney } from 'traverse';

export default defineJourney({
  name: 'checkout-flow',
  description: 'Complete purchase flow from homepage to order confirmation',
  
  async run(ctx) {
    // Step 1: Landing
    await ctx.step('homepage', async ({ page, capture }) => {
      await page.goto('/');
      await capture.cwv();
      await capture.resources();
    });

    // Step 2: Browse to product
    await ctx.step('product-listing', async ({ page, capture }) => {
      await page.click('[data-testid="shop-link"]');
      await page.waitForLoadState('networkidle');
      await capture.cwv();
      await capture.navigation(); // records soft vs hard nav
    });

    // Step 3: View product detail
    await ctx.step('product-detail', async ({ page, capture }) => {
      await page.click('[data-testid="product-card"]:first-child');
      await page.waitForSelector('[data-testid="add-to-cart"]');
      await capture.cwv();
      await capture.navigation();
    });

    // Step 4: Add to cart (interaction, not navigation)
    await ctx.step('add-to-cart', async ({ page, capture }) => {
      await capture.startInteraction();
      await page.click('[data-testid="add-to-cart"]');
      await page.waitForSelector('[data-testid="cart-count"]:has-text("1")');
      await capture.endInteraction(); // captures INP-style metric
    });

    // Step 5: View cart
    await ctx.step('cart', async ({ page, capture }) => {
      await page.click('[data-testid="cart-icon"]');
      await page.waitForSelector('[data-testid="cart-items"]');
      await capture.cwv();
      await capture.navigation();
      await capture.memory(); // heap snapshot
    });

    // Step 6: Checkout
    await ctx.step('checkout', async ({ page, capture }) => {
      await page.click('[data-testid="checkout-button"]');
      await page.waitForSelector('[data-testid="checkout-form"]');
      await capture.cwv();
      await capture.navigation();
      await capture.resources(); // see what's loaded by this point
    });
  }
});
```

**Capture Context API:**

```typescript
interface CaptureContext {
  // Core Web Vitals at current state
  cwv(): Promise<void>;
  
  // Resource loading state
  resources(): Promise<void>;
  
  // Navigation metadata (type, duration, prefetch status)
  navigation(): Promise<void>;
  
  // Memory/heap snapshot
  memory(): Promise<void>;
  
  // Bracket an interaction for INP-style measurement
  startInteraction(): Promise<void>;
  endInteraction(): Promise<void>;
  
  // Custom metric
  mark(name: string, value: number): void;
  
  // Full performance timeline (expensive, opt-in)
  timeline(): Promise<void>;
}
```

**Per-Step Metrics:**

Each step captures:
- Step name and duration
- Navigation type: `initial` | `hard` | `soft` | `none`
- Navigation trigger: `link` | `programmatic` | `back-forward` | `reload`
- Prefetch status: `prefetched` | `not-prefetched` | `partial`
- CWV deltas (LCP, CLS, etc. for this step specifically)
- Resources loaded during step
- Resources served from cache vs network
- JS execution time during step
- Heap delta (memory growth)
- Long tasks during step

**Cumulative Metrics:**

Across the entire journey:
- Total JS loaded (unique, accounting for shared chunks)
- Total data transferred
- Total navigation time
- Resource cache hit rate (after first page)
- Memory high-water mark
- Total long task time
- Total CLS (accumulated)

**Journey vs Journey Comparison:**

When comparing journeys across frameworks:
- Step-by-step metric diffs
- Cumulative metric diffs
- Navigation type comparison (framework A uses soft navs, framework B uses hard)
- Cache utilization patterns

**Output Schema:**
```typescript
interface JourneyResult {
  meta: {
    name: string;
    description: string;
    capturedAt: string;
    baseUrl: string;
    runs: number;
    device: DeviceConfig;
  };
  steps: JourneyStepResult[];
  cumulative: CumulativeMetrics;
  runs: JourneyRun[]; // individual runs for drill-down
}

interface JourneyStepResult {
  name: string;
  index: number;
  navigation: {
    type: 'initial' | 'hard' | 'soft' | 'none';
    trigger: 'link' | 'programmatic' | 'back-forward' | 'reload' | null;
    prefetchStatus: 'prefetched' | 'not-prefetched' | 'partial' | null;
    duration: AggregatedMetric;
  };
  cwv: {
    lcp: AggregatedMetric | null;
    cls: AggregatedMetric;
    inp: AggregatedMetric | null;
  };
  resources: {
    loaded: AggregatedMetric; // count
    fromCache: AggregatedMetric; // count
    transferred: AggregatedMetric; // bytes
  };
  javascript: {
    executionTime: AggregatedMetric;
    longTasks: AggregatedMetric;
    heapDelta: AggregatedMetric;
  };
  custom: Record<string, AggregatedMetric>;
}

interface CumulativeMetrics {
  totalDuration: AggregatedMetric;
  totalTransferred: AggregatedMetric;
  uniqueJsLoaded: AggregatedMetric;
  cacheHitRate: AggregatedMetric; // percentage
  memoryHighWater: AggregatedMetric;
  totalLongTaskTime: AggregatedMetric;
  totalCls: AggregatedMetric;
}
```

---

### 4. DX Metrics (Secondary Priority)

**Purpose:** Capture developer experience metrics for framework comparison.

**Capabilities:**
- Dev server cold start time
- Dev server warm start time
- HMR round-trip (file save → browser update)
- Production build time (clean)
- Production build time (incremental)
- Type-check duration
- Dependency install time

**Implementation Notes:**
- Requires ability to invoke framework CLI commands
- HMR measurement requires file system manipulation + browser observation
- Lower priority than runtime analysis modules

---

### 5. Comparison Engine

**Purpose:** Compare results across different captures.

**Capabilities:**
- Baseline comparison (current vs stored baseline)
- A/B comparison (two captures side-by-side)
- Multi-way comparison (3+ captures, e.g., framework shootout)
- Trend analysis (multiple captures over time)

**Comparison Output:**
```typescript
interface Comparison {
  type: 'baseline' | 'ab' | 'multi' | 'trend';
  subjects: ComparisonSubject[];
  diffs: {
    static?: StaticAnalysisDiff;
    runtime?: RuntimeBenchmarkDiff;
    journey?: JourneyResultDiff;
  };
  summary: ComparisonSummary;
}

interface ComparisonSubject {
  label: string;
  capturedAt: string;
  source: string; // file path or identifier
}
```

---

### 6. Report Generator

**Purpose:** Transform captured data into human-readable reports.

**Output Formats:**

#### JSON
- Raw data export for external tooling
- Structured for easy parsing

#### Markdown
- Summary tables
- Metric highlights
- Suitable for PR comments or documentation

#### HTML Dashboard
- Interactive visualizations
- Journey step breakdown
- Comparison charts
- Drill-down capability

#### CI Annotations
- GitHub Actions annotations
- Regression warnings
- Metric summaries in PR checks

---

## Technical Stack

### Runtime
- **Bun** — Fast startup, native TypeScript, good DX for CLI tools

### Browser Automation
- **Playwright** — Direct usage (not via Vitest), for maximum control over:
  - CDP (Chrome DevTools Protocol) access
  - Performance timeline capture
  - Tracing
  - Network interception
  - Multiple browser support

### Static Analysis
- **TypeScript Compiler API** — For source code AST analysis
- **Custom parsers** — For build output analysis (webpack stats, Vite manifest, Next.js build manifest)
- **Source map parsing** — For attribution back to original modules

### Data Storage
- **JSON files** — Simple, portable, diffable
- **SQLite** (future) — For trend analysis and querying historical data

### CLI Framework
- **Bun's native arg parsing** or lightweight alternative
- Emphasis on scriptability and composability

---

## CLI Interface

```bash
# Static analysis
traverse analyze [source-dir] [options]
  --build-dir, -b     Build output directory
  --framework         Framework hint (auto-detected if omitted)
  --output, -o        Output file path
  --format            json | markdown (default: json)

# Single-page benchmark
traverse bench <url> [options]
  --runs, -n          Number of runs (default: 5)
  --device            Device preset or config file
  --network           Network preset (4g, 3g, offline) or config
  --output, -o        Output file path
  --format            json | markdown | html

# Journey execution
traverse journey <journey-file> [options]
  --base-url, -u      Base URL for the journey
  --runs, -n          Number of complete journey runs (default: 3)
  --device            Device preset or config file
  --output, -o        Output file path
  --format            json | markdown | html

# Comparison
traverse compare [options]
  --baseline, -b      Baseline capture file
  --current, -c       Current capture file (or multiple with --add)
  --add, -a           Add capture to comparison (repeatable)
  --output, -o        Output file path
  --format            json | markdown | html

# Report generation (from existing captures)
traverse report <capture-file> [options]
  --format            json | markdown | html
  --output, -o        Output file path
  --template          Custom report template

# Configuration
traverse init                    # Create traverse.config.ts
traverse validate <journey-file> # Validate journey syntax
```

---

## Configuration

```typescript
// traverse.config.ts
import { defineConfig } from 'traverse';

export default defineConfig({
  // Default settings
  defaults: {
    runs: 5,
    device: 'desktop', // or custom config
    network: 'none', // no throttling by default
  },
  
  // Device presets
  devices: {
    desktop: {
      viewport: { width: 1920, height: 1080 },
      userAgent: '...',
      deviceScaleFactor: 1,
    },
    mobile: {
      viewport: { width: 390, height: 844 },
      userAgent: '...',
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    },
  },
  
  // Network presets
  networks: {
    '4g': {
      downloadThroughput: 4 * 1024 * 1024 / 8,
      uploadThroughput: 3 * 1024 * 1024 / 8,
      latency: 20,
    },
    '3g': {
      downloadThroughput: 1.5 * 1024 * 1024 / 8,
      uploadThroughput: 750 * 1024 / 8,
      latency: 100,
    },
  },
  
  // Framework-specific settings
  frameworks: {
    nextjs: {
      buildDir: '.next',
      // Additional Next.js-specific options
    },
  },
  
  // Output settings
  output: {
    dir: './traverse-reports',
    baselineFile: './traverse-baseline.json',
  },
  
  // Journey discovery
  journeys: {
    dir: './journeys',
    pattern: '**/*.journey.ts',
  },
});
```

---

## Implementation Priorities

### Phase 1: Foundation
1. CLI scaffolding and config system
2. Playwright integration with basic metric capture
3. Single-page runtime benchmark (CWV, resources)
4. JSON output

### Phase 2: Journey System
1. Journey definition format and runner
2. Per-step metric capture
3. Cumulative metric calculation
4. Navigation type detection

### Phase 3: Static Analysis
1. Next.js build output parsing
2. Bundle size analysis
3. Source code route analysis
4. Dependency attribution

### Phase 4: Comparison & Reporting
1. Baseline comparison
2. Multi-capture comparison
3. Markdown reports
4. HTML dashboard

### Phase 5: Expansion
1. Additional framework support (React Router, SvelteKit)
2. DX metrics
3. CI integrations
4. Trend analysis

---

## Non-Goals (Explicit Scope Boundaries)

- **Not a test runner** — No assertions, no pass/fail. Data capture only.
- **Not a monitoring tool** — Synthetic benchmarks, not production RUM.
- **Not a build tool** — Analyzes outputs, doesn't create them.
- **Not a Lighthouse replacement** — Complementary, focused on journeys.
- **Not framework-specific** — Works with any web app, enhanced by framework knowledge.

---

## Success Criteria

Traverse is successful if it can definitively answer:

1. "Which framework produces smaller bundles for equivalent functionality?"
2. "Which framework provides faster subsequent navigations?"
3. "How much JS accumulates during a typical user session?"
4. "What's the performance delta between SSR and SPA modes of the same framework?"
5. "Where is the performance bottleneck in this user journey?"

---

## Appendix: Key Metric Definitions

### Navigation Types

| Type | Definition |
|------|------------|
| `initial` | First page load, full document request |
| `hard` | Full page navigation (document request, full re-render) |
| `soft` | Client-side navigation (no document request, partial re-render) |
| `none` | Interaction without navigation (modal, accordion, etc.) |

### Prefetch Status

| Status | Definition |
|--------|------------|
| `prefetched` | All resources for navigation were pre-loaded |
| `partial` | Some resources prefetched, others loaded on-demand |
| `not-prefetched` | No prefetching occurred |

### Resource Cache Status

| Status | Definition |
|--------|------------|
| `memory` | Served from browser memory cache |
| `disk` | Served from browser disk cache |
| `service-worker` | Served from service worker cache |
| `network` | Fetched from network |

---

## Appendix: Example Journey Comparison Output

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Journey: checkout-flow                                                      │
│ Comparing: Next.js 16 (App Router) vs React Router 7 (SSR) vs RR7 (SPA)    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│ Step 1: homepage (initial)                                                  │
│ ─────────────────────────────────────────────────────────────────────────── │
│           │ Next.js 16  │ RR7 SSR     │ RR7 SPA     │                       │
│ LCP       │ 1,240ms     │ 1,180ms     │ 1,890ms     │ ← SPA slower initial  │
│ FCP       │   890ms     │   920ms     │ 1,450ms     │                       │
│ JS Load   │   245KB     │   198KB     │   312KB     │                       │
│                                                                             │
│ Step 2: product-listing (soft)                                              │
│ ─────────────────────────────────────────────────────────────────────────── │
│           │ Next.js 16  │ RR7 SSR     │ RR7 SPA     │                       │
│ Nav Type  │ soft        │ soft        │ soft        │                       │
│ Duration  │   180ms     │   220ms     │   145ms     │ ← SPA fastest soft    │
│ JS Load   │    45KB     │    38KB     │     0KB     │ ← SPA already loaded  │
│ Prefetch  │ yes         │ partial     │ n/a         │                       │
│                                                                             │
│ ... (steps 3-6) ...                                                         │
│                                                                             │
│ CUMULATIVE                                                                  │
│ ─────────────────────────────────────────────────────────────────────────── │
│                │ Next.js 16  │ RR7 SSR     │ RR7 SPA     │                  │
│ Total Duration │ 4,200ms     │ 4,890ms     │ 3,950ms     │                  │
│ Total JS       │   380KB     │   342KB     │   312KB     │                  │
│ Cache Hit Rate │    78%      │    72%      │    85%      │                  │
│ Memory Peak    │  18.2MB     │  15.8MB     │  22.4MB     │                  │
│ Total CLS      │ 0.042       │ 0.038       │ 0.089       │                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*Specification Version: 1.0*  
*Last Updated: January 2026*

# Traverse Implementation Roadmap

> Performance data capture and analysis toolkit for web applications.

---

## Project Overview

Traverse captures detailed performance data from web applications, focusing on **journey-centric measurement** - tracking cumulative user experience across multi-step sessions rather than isolated page loads.

### Core Philosophy

- **Data capture, not testing** - No assertions, no pass/fail. Evidence only.
- **Journey-centric** - The journey is the primary unit of measurement.
- **Framework-agnostic, framework-aware** - Works with any web app, enhanced by framework knowledge.

### Success Criteria

Traverse should definitively answer:

1. Which framework produces smaller bundles for equivalent functionality?
2. Which framework provides faster subsequent navigations?
3. How much JS accumulates during a typical user session?
4. What's the performance delta between SSR and SPA modes?
5. Where is the performance bottleneck in this user journey?

---

## Technical Stack

| Technology | Purpose |
|------------|---------|
| **Bun** | Runtime, native TypeScript, CLI, testing |
| **Playwright** | Browser automation, CDP access, tracing |
| **TypeScript Compiler API** | AST analysis (Phase 3) |

### Dependencies (Minimal)

| Package | Version | Purpose |
|---------|---------|---------|
| `playwright` | ^1.50.0 | Browser automation, CDP access |
| `typescript` | ^5.7.0 | Type checking (dev) |
| `@types/bun` | ^1.2.0 | Bun types (dev) |

No CLI framework - hand-rolled with `Bun.argv`.

---

## Architecture

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
│  └─────────────────────────┬───────────────────────────────┘   │
│                            │                                    │
│                            ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Report Generator                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
traverse/
├── docs/
│   ├── spec.md              # Full specification
│   └── roadmap.md           # This file
├── src/
│   ├── types.ts             # Core type definitions
│   ├── result.ts            # Result<T,E> utilities
│   ├── cli/
│   │   ├── index.ts         # CLI entry point
│   │   ├── parser.ts        # Argument parsing
│   │   └── commands/
│   │       ├── bench.ts     # traverse bench
│   │       ├── journey.ts   # traverse journey
│   │       ├── analyze.ts   # traverse analyze
│   │       ├── compare.ts   # traverse compare
│   │       └── report.ts    # traverse report
│   ├── config/
│   │   ├── loader.ts        # Load traverse.config.ts
│   │   ├── defaults.ts      # Default presets
│   │   └── schema.ts        # Config type definitions
│   ├── browser/
│   │   ├── launch.ts        # Playwright browser launch
│   │   ├── context.ts       # Page context management
│   │   └── cdp.ts           # CDP session helpers
│   ├── capture/
│   │   ├── cwv.ts           # Core Web Vitals
│   │   ├── resources.ts     # Resource timing
│   │   ├── navigation.ts    # Navigation type detection
│   │   ├── memory.ts        # Heap snapshots
│   │   └── timeline.ts      # Performance timeline
│   ├── bench/
│   │   ├── runner.ts        # Single-page benchmark runner
│   │   └── aggregator.ts    # Statistical aggregation
│   ├── journey/
│   │   ├── runner.ts        # Journey executor
│   │   ├── context.ts       # CaptureContext implementation
│   │   ├── define.ts        # defineJourney helper
│   │   └── cumulative.ts    # Cumulative metric calculation
│   ├── analyze/
│   │   ├── bundles.ts       # Bundle size analysis
│   │   ├── routes.ts        # Route structure mapping
│   │   ├── dependencies.ts  # Dependency attribution
│   │   └── frameworks/
│   │       ├── nextjs.ts    # Next.js specific analysis
│   │       └── detect.ts    # Framework detection
│   ├── compare/
│   │   ├── engine.ts        # Comparison logic
│   │   └── diff.ts          # Diff calculation
│   └── report/
│       ├── json.ts          # JSON output
│       ├── markdown.ts      # Markdown output
│       └── html.ts          # HTML dashboard
├── journeys/                 # Example journey definitions
├── package.json
├── tsconfig.json
├── traverse.config.ts       # Default config template
└── CLAUDE.md
```

---

## Implementation Phases

### Phase 1: Foundation (MVP)

**Goal:** `traverse bench <url>` captures CWV + resources across N runs, outputs JSON.

#### 1.1 Project Scaffolding
- [ ] `package.json` with Bun + Playwright deps
- [ ] `tsconfig.json` with strict settings
- [ ] Directory structure creation

#### 1.2 Core Types (`src/types.ts`)
- [ ] `Result<T, E>` type and utilities
- [ ] `ByteSize` (raw, gzip, brotli)
- [ ] `AggregatedMetric` (median, p75, p95, etc.)
- [ ] `DeviceConfig`, `NetworkConfig`
- [ ] `RuntimeBenchmark` interface
- [ ] `CaptureState` discriminated union

#### 1.3 CLI Framework (`src/cli/`)
- [ ] Argument parser with `Bun.argv`
- [ ] Command routing
- [ ] Help text generation
- [ ] `traverse bench` command skeleton

#### 1.4 Config System (`src/config/`)
- [ ] `defineConfig` helper
- [ ] Config file loader
- [ ] Default device presets (desktop, mobile)
- [ ] Default network presets (4g, 3g)

#### 1.5 Browser Integration (`src/browser/`)
- [ ] Playwright browser launch with options
- [ ] Page context creation with device emulation
- [ ] CDP session establishment
- [ ] Network throttling setup

#### 1.6 Metric Capture (`src/capture/`)
- [ ] Core Web Vitals via CDP (LCP, FCP, CLS, TTFB)
- [ ] Resource timing capture
- [ ] Basic performance timeline

#### 1.7 Benchmark Runner (`src/bench/`)
- [ ] Multi-run execution
- [ ] Statistical aggregation (median, percentiles)
- [ ] JSON output formatting

**Deliverable:** Working `traverse bench <url> --runs 5 --output results.json`

---

### Phase 2: Journey System

**Goal:** `traverse journey <file>` executes multi-step journeys with per-step metrics.

#### 2.1 Journey Definition (`src/journey/`)
- [ ] `defineJourney` API
- [ ] Journey file loading and validation
- [ ] `traverse validate` command

#### 2.2 Journey Runner
- [ ] Step execution with context
- [ ] `CaptureContext` implementation (cwv, resources, navigation, memory)
- [ ] Interaction bracketing (startInteraction/endInteraction)

#### 2.3 Navigation Detection
- [ ] Navigation type classification (initial, hard, soft, none)
- [ ] Prefetch status detection
- [ ] Navigation trigger identification

#### 2.4 Cumulative Metrics
- [ ] Total JS loaded tracking
- [ ] Cache hit rate calculation
- [ ] Memory high-water mark
- [ ] Total CLS accumulation

**Deliverable:** Working `traverse journey checkout-flow.ts --base-url http://localhost:3000`

---

### Phase 3: Static Analysis

**Goal:** `traverse analyze` inspects build outputs without running the app.

#### 3.1 Framework Detection
- [ ] Auto-detect Next.js, React Router, SvelteKit, generic SPA
- [ ] Version detection

#### 3.2 Bundle Analysis
- [ ] Total bundle size (raw, gzip, brotli)
- [ ] Per-entry breakdown
- [ ] Chunk analysis with module attribution
- [ ] Duplicate dependency detection

#### 3.3 Next.js Specifics
- [ ] `.next/` build manifest parsing
- [ ] App Router vs Pages Router detection
- [ ] Server/Client Component boundary detection
- [ ] RSC payload estimation

#### 3.4 Route Analysis
- [ ] Route structure mapping
- [ ] Dynamic segment detection
- [ ] Route-to-bundle mapping

**Deliverable:** Working `traverse analyze ./my-app --build-dir .next`

---

### Phase 4: Comparison & Reporting

**Goal:** Compare captures and generate rich reports.

#### 4.1 Comparison Engine
- [ ] Baseline comparison (current vs stored)
- [ ] A/B comparison (two captures)
- [ ] Multi-way comparison (framework shootouts)

#### 4.2 Report Formats
- [ ] JSON (already exists from Phase 1)
- [ ] Markdown tables for PR comments
- [ ] HTML dashboard with visualizations

#### 4.3 CI Integration
- [ ] GitHub Actions annotations
- [ ] Regression warnings
- [ ] PR check summaries

**Deliverable:** `traverse compare --baseline old.json --current new.json --format markdown`

---

### Phase 5: Expansion

**Goal:** Broaden framework support and add DX metrics.

#### 5.1 Additional Frameworks
- [ ] React Router analysis module
- [ ] SvelteKit analysis module

#### 5.2 DX Metrics
- [ ] Dev server cold/warm start time
- [ ] HMR round-trip measurement
- [ ] Production build time

#### 5.3 Trend Analysis
- [ ] SQLite storage for historical data
- [ ] Trend visualization
- [ ] Regression detection over time

---

## CLI Reference

```bash
# Single-page benchmark
traverse bench <url> [options]
  --runs, -n          Number of runs (default: 5)
  --device            Device preset or config file
  --network           Network preset (4g, 3g) or config
  --output, -o        Output file path
  --format            json | markdown | html

# Journey execution
traverse journey <journey-file> [options]
  --base-url, -u      Base URL for the journey
  --runs, -n          Number of complete runs (default: 3)
  --device            Device preset or config file
  --output, -o        Output file path

# Static analysis
traverse analyze [source-dir] [options]
  --build-dir, -b     Build output directory
  --framework         Framework hint (auto-detected)
  --output, -o        Output file path

# Comparison
traverse compare [options]
  --baseline, -b      Baseline capture file
  --current, -c       Current capture file
  --add, -a           Add capture (repeatable)
  --output, -o        Output file path

# Report generation
traverse report <capture-file> [options]
  --format            json | markdown | html
  --output, -o        Output file path

# Configuration
traverse init         # Create traverse.config.ts
traverse validate     # Validate journey file
```

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| CLI parsing | `Bun.argv` hand-rolled | Simple enough, zero deps |
| Config format | `traverse.config.ts` | Type-safe, Bun runs TS natively |
| Error handling | `Result<T, E>` types | Never throw for expected failures |
| Testing | `bun test`, colocated | `foo.ts` paired with `foo.test.ts` |
| File I/O | `Bun.file()` / `Bun.write()` | Native Bun APIs |
| VCS | `jj` with git backend | Logical change management |

---

## Non-Goals

- **Not a test runner** - No assertions, no pass/fail
- **Not a monitoring tool** - Synthetic benchmarks, not production RUM
- **Not a build tool** - Analyzes outputs, doesn't create them
- **Not a Lighthouse replacement** - Complementary, journey-focused

---

*Last updated: January 2026*

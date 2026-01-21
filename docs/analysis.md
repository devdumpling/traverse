# Static Analysis System

This document explains how Traverse's static analysis works, including the architecture classification, runtime breakdown, and route-level cost analysis.

## Overview

The static analysis system examines build outputs to understand:

1. **Architecture Type** - Is this an MPA, SPA, transitional app, or islands?
2. **Runtime Breakdown** - Where are the JavaScript bytes going?
3. **Route Costs** - How much JS does each route require?
4. **Vendor Detection** - What's framework code vs application code?

## Module Structure

```
src/analyze/
├── index.ts           # Main entry point, orchestrates all analysis
├── utils.ts           # Shared utilities (readJson, calculateByteSize, etc.)
├── detect.ts          # Framework detection (Next.js, React Router, etc.)
├── architecture.ts    # Architecture classification (MPA/SPA/Transitional)
├── runtime.ts         # JS categorization (framework/router/app)
├── routes.ts          # Per-route cost analysis
├── bundles.ts         # Bundle size analysis with vendor split
├── manifests.ts       # Framework manifest parsing
├── nextjs.ts          # Next.js-specific analysis
└── dependencies.ts    # package.json dependency analysis
```

## How Each Module Works

### 1. Framework Detection (`detect.ts`)

Detects the framework by looking for signature files:

| Framework | Detection Method |
|-----------|------------------|
| Next.js | `.next/BUILD_ID`, `next.config.js` |
| React Router | `react-router.config.ts`, `vite.config.ts` with RR plugin |
| SvelteKit | `svelte.config.js`, `.svelte-kit/` |
| Generic SPA | `vite.config.ts`, `webpack.config.js` |

### 2. Architecture Classification (`architecture.ts`)

Determines the app's rendering/navigation strategy using a weighted signal system.

#### Architecture Types

| Type | Description | Typical Frameworks |
|------|-------------|-------------------|
| `mpa` | Full page loads, minimal client JS | Static sites, traditional server apps |
| `spa` | Client router handles all navigation | React with react-router (client-only) |
| `transitional` | Server-rendered, upgrades to SPA | Next.js App Router, React Router 7 |
| `islands` | Static HTML with isolated components | Astro |

#### Detection Signals

Each signal has a weight and may imply an architecture type:

```typescript
// Example: Next.js App Router detection
{
  indicator: 'App Router (app/ directory)',
  detected: true,
  weight: 3,
  implies: 'transitional'
}
```

The final type is determined by summing weights:

```typescript
// Scores are accumulated
scores['transitional'] += 3;  // App Router
scores['transitional'] += 2;  // Server Actions
// Highest score wins
```

#### Hydration Strategy Detection

Based on signals, determines hydration approach:

| Strategy | Detection | Frameworks |
|----------|-----------|------------|
| `progressive` | App Router detected | Next.js 13+ |
| `full` | Pages Router only | Next.js Pages, traditional React |
| `islands` | `client:load` patterns | Astro |
| `none` | No hydration signals | Pure MPA |

#### Data Strategy Detection

| Strategy | Detection | Examples |
|----------|-----------|----------|
| `rsc` | App Router | Next.js App Router |
| `loaders` | Single Fetch patterns | React Router 7 |
| `getServerSideProps` | Pages Router only | Next.js Pages |
| `client-fetch` | No server data patterns | Client-only SPAs |

### 3. Runtime Breakdown (`runtime.ts`)

Categorizes JavaScript chunks by reading file contents and matching patterns.

#### Categories

| Category | Patterns Matched |
|----------|------------------|
| Framework Core | `react-dom`, `scheduler`, `$$typeof` |
| Router | `pushState`, `navigate(`, `react-router` |
| Hydration | `flight`, `turbo-stream`, `hydrat` |
| Polyfills | `polyfill`, `core-js`, `regenerator` |
| Application | Everything else that's not vendor |
| Other/Vendor | Hash-only filenames, `node_modules` |

#### Classification Process

```typescript
// 1. Check filename patterns first
if (POLYFILL_PATTERNS.some(p => p.test(filename))) return 'polyfills';

// 2. Check framework-specific patterns
if (framework === 'nextjs' && /framework-.*\.js/.test(filename)) return 'framework';

// 3. Read first 10KB of content for signatures
if (content.includes('__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED')) {
  return 'framework';  // React internal signature
}

// 4. Default to application
return 'application';
```

### 4. Route Cost Analysis (`routes.ts`)

Calculates JS cost per route by parsing framework manifests.

#### Next.js Analysis

Uses `build-manifest.json`:

```json
{
  "pages": {
    "/": ["static/chunks/pages/index-abc123.js"],
    "/about": ["static/chunks/pages/about-def456.js", "static/chunks/shared-xyz.js"]
  },
  "rootMainFiles": ["static/chunks/main.js", "static/chunks/framework.js"]
}
```

Process:
1. Parse `pages` to get route-to-chunk mappings
2. Track which chunks are used by multiple routes (shared)
3. Calculate unique vs shared sizes per route
4. Sum `rootMainFiles` for entry point cost

#### React Router / Vite Analysis

Uses `.vite/manifest.json`:

```json
{
  "src/routes/index.tsx": {
    "file": "assets/index-abc123.js",
    "src": "src/routes/index.tsx",
    "imports": ["_shared-xyz"]
  }
}
```

Process:
1. Find entries with `isEntry: true` for entry point cost
2. Identify route modules by `src` containing `routes/`
3. Track `imports` to find shared dependencies
4. Calculate unique vs shared per route

#### Output Metrics

| Metric | Description |
|--------|-------------|
| Entry Point Cost | JS loaded before any route (framework, router) |
| Route Total | All JS needed to render that route |
| Route Unique | JS only loaded for that specific route |
| Route Shared | JS shared with other routes |

### 5. Manifest Parsing (`manifests.ts`)

Parses framework-specific manifests for accurate chunk classification.

#### Next.js Manifest Structure

```
.next/
├── build-manifest.json      # Route-to-chunk mappings
├── routes-manifest.json     # Route definitions
├── prerender-manifest.json  # Static/ISR pages
└── server/
    └── server-reference-manifest.json  # Server Actions
```

#### Vite Manifest Structure

```
build/client/.vite/manifest.json
```

The manifest maps source files to output chunks with import dependencies.

### 6. Bundle Analysis (`bundles.ts`)

Calculates sizes with gzip and brotli estimates.

#### Vendor Detection Hierarchy

1. **Manifest-based** (most accurate): Uses `ChunkClassification` from manifests
2. **Heuristic-based** (fallback): Pattern matching on filenames

```typescript
// Manifest-based (preferred)
if (isVendorOrFramework(chunkName, classification)) return true;

// Heuristic fallback
if (name.includes('framework-')) return true;
if (name.includes('polyfill')) return true;
if (/^[a-f0-9]+\.js$/.test(name)) return true;  // Hash-only = vendor
```

## Analysis Flow

```
┌─────────────────┐
│ analyze(opts)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ detectFramework │ → Identifies Next.js, React Router, etc.
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ analyzeBundles  │ → Calculates sizes, vendor split
└────────┬────────┘
         │
         ▼
┌─────────────────────┐
│ analyzeArchitecture │ → MPA/SPA/Transitional classification
└────────┬────────────┘
         │
         ▼
┌─────────────────┐
│ analyzeRuntime  │ → Framework/Router/App breakdown
└────────┬────────┘
         │
         ▼
┌──────────────────┐
│ analyzeRouteCosts│ → Per-route JS costs
└────────┬─────────┘
         │
         ▼
┌─────────────────┐
│ StaticAnalysis  │ → Combined result
└─────────────────┘
```

## Shared Utilities (`utils.ts`)

Common functions used across modules:

| Function | Purpose |
|----------|---------|
| `readJson<T>(path)` | Safely read and parse JSON files |
| `fileExists(path)` | Check if a file exists |
| `calculateByteSize(content)` | Calculate raw/gzip/brotli sizes |
| `calculateByteSizeFromFile(path)` | Calculate sizes from file path |
| `sumByteSizes(sizes)` | Sum multiple ByteSize objects |
| `emptyByteSize()` | Create zeroed ByteSize |
| `formatBytes(bytes)` | Human-readable byte formatting |

## Type Definitions

Key types from `types.ts`:

```typescript
type ArchitectureType = 'mpa' | 'spa' | 'transitional' | 'islands' | 'unknown';

type HydrationStrategy = 
  | 'full'        // Hydrate entire page
  | 'progressive' // Selective hydration
  | 'partial'     // Only interactive parts
  | 'islands'     // Independent components
  | 'resumable'   // Qwik-style
  | 'none';       // No hydration

type DataStrategy =
  | 'rsc'                  // React Server Components
  | 'loaders'              // Route loaders (RR7)
  | 'getServerSideProps'   // Next.js Pages
  | 'client-fetch'         // Client-only
  | 'static'               // Build-time
  | 'mixed';               // Combination

interface ByteSize {
  raw: number;    // Uncompressed bytes
  gzip: number;   // Gzip compressed
  brotli: number; // Brotli estimated (gzip * 0.85)
}
```

## Accuracy Considerations

### What's Accurate

- **Bundle sizes**: Actual file sizes with real gzip compression
- **Route-to-chunk mappings**: From framework manifests
- **Framework detection**: Based on definitive marker files

### What's Estimated

- **Brotli size**: Estimated as 85% of gzip (actual varies by content)
- **Category classification**: Heuristic-based when manifest unavailable
- **Shared vs unique**: Based on usage count, not actual runtime behavior

### Limitations

1. **Dynamic imports**: May not be fully tracked in manifests
2. **CSS-in-JS**: Bundled JS includes styles, inflating "application" size
3. **Source maps**: Excluded from analysis (`.map` files filtered)
4. **Server chunks**: Excluded to focus on client-side impact

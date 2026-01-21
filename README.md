# Traverse

Performance data capture and analysis toolkit for web applications. Built with Bun + Playwright.

## What It Does

Traverse captures detailed performance data from web applications, focusing on **journey-centric measurement** - tracking cumulative user experience across multi-step sessions rather than isolated page loads.

It's designed for framework comparisons (Next.js vs React Router vs SvelteKit) and performance regression tracking.

## Installation

```bash
# Clone and install
git clone https://github.com/your-org/traverse
cd traverse
bun install

# Run from repo root
bun run traverse <command>
```

## Commands

### `traverse bench <url>` - Runtime Benchmark

Single-page cold load benchmark. Clears cache, loads page, captures comprehensive metrics.

```bash
traverse bench http://localhost:3000 --runs 5 --format markdown
```

**Options:**
- `--runs, -n` - Number of runs (default: 5)
- `--device` - Device preset: `desktop` or `mobile`
- `--network` - Network preset: `4g`, `3g`, or `none`
- `--output, -o` - Write to file instead of stdout
- `--format` - Output format: `json`, `markdown`, `html`

**Captures:**

| Category | Metrics |
|----------|---------|
| Core Web Vitals | LCP, FCP, CLS, TTFB |
| Timing | DOM Content Loaded, Load, Total Blocking Time |
| Resources | Transfer size, request count, cache hits |
| JavaScript | Heap size, long task count |
| SSR & Hydration | Framework detection, inline script size, hydration payload |

**Example Output (markdown):**

```
## Core Web Vitals

| Metric | Median | P75 | P95 |
|--------|--------|-----|-----|
| LCP | 1200ms | 1400ms | 1600ms |
| FCP | 800ms | 900ms | 1000ms |
| CLS | 0.050 | 0.060 | 0.080 |
| TTFB | 150ms | 180ms | 200ms |

## SSR & Hydration

| Metric | Median |
|--------|--------|
| Framework | next |
| Has SSR Content | Yes |
| Inline Script Size | 5.4 KB |
| Hydration Payload | 5.4 KB |
| RSC Payload | 5.4 KB |
```

---

### `traverse analyze <dir>` - Static Analysis

Analyze build outputs without running the app. Inspects bundle sizes, dependencies, and framework-specific data.

```bash
traverse analyze ./my-next-app --format markdown
```

**Options:**
- `--build-dir, -b` - Build output directory (auto-detected)
- `--framework` - Framework hint (auto-detected)
- `--output, -o` - Write to file
- `--format` - Output format: `json`, `markdown`, `html`

**Captures:**

| Category | Metrics |
|----------|---------|
| Bundle Sizes | Total, JS, CSS (raw, gzip, brotli) |
| Bundle Split | Vendor JS vs non-vendor JS |
| Dependencies | Production count, dev count, top dependencies |
| Chunks | Individual chunk sizes |
| Routes | Route paths and types (Next.js) |
| Framework | Type, version, router type, turbopack usage |

**Example Output:**

```
## Bundle Sizes

| Type | Raw | Gzip | Brotli |
|------|-----|------|--------|
| **Total** | 563 KB | 171 KB | 145 KB |
| JavaScript | 550 KB | 167 KB | 142 KB |
| CSS | 14 KB | 4 KB | 3 KB |
| Vendor (JS) | 540 KB | 163 KB | 138 KB |
| Non-Vendor (JS) | 10 KB | 4 KB | 4 KB |

## Dependencies

| Category | Count |
|----------|-------|
| Production | 3 |
| Dev | 8 |
| **Total** | 11 |

**Key dependencies:** next, react, react-dom
```

**Supported Frameworks:**
- Next.js (App Router & Pages Router)
- React Router 7
- Generic SPAs (Vite, etc.)

---

### `traverse compare` - Compare Captures

Compare two benchmark or analysis captures to see improvements and regressions.

```bash
traverse compare --baseline old.json --current new.json --format markdown
```

**Options:**
- `--baseline, -b` - Baseline capture file (required)
- `--current, -c` - Current capture file (required)
- `--output, -o` - Write to file
- `--format` - Output format: `json`, `markdown`, `html`

**Example Output:**

```
## Metrics Comparison

| Metric | Baseline | Current | Change |
|--------|----------|---------|--------|
| LCP | 1200ms | 1050ms | -150ms (-12.5%) ++ |
| FCP | 800ms | 750ms | -50ms (-6.3%) ++ |
| Transfer | 488 KB | 508 KB | +20 KB (+4.0%) -- |
| Inline Scripts | 24 KB | 22 KB | -3 KB (-12.0%) ++ |
| Hydration | 20 KB | 18 KB | -2 KB (-10.0%) ++ |

### Legend
- **++** = Improved (lower is better for timing/size metrics)
- **--** = Regressed
- **~** = No significant change (<1%)
```

---

### `traverse build <dir>` - Build Time Metrics

Measure cold build time for a project.

```bash
traverse build ./my-app --format markdown
```

**Options:**
- `--cmd, -c` - Custom build command (auto-detected)
- `--no-cache` - Skip cache clearing
- `--output, -o` - Write to file
- `--format` - Output format: `json`, `markdown`, `html`

**What it does:**
1. Detects framework and build command
2. Clears build caches (`.next/`, `build/`, `node_modules/.cache/`)
3. Runs production build
4. Reports elapsed time

**Example Output:**

```
## Build Metrics

| Metric | Value |
|--------|-------|
| Cold Build Time | 23.4s |
| Command | `npm run build` |
| Cache Cleared | Yes |
```

---

### `traverse journey <file>` - Multi-Step Flows

Execute multi-step user journeys and capture per-step metrics with navigation detection.

```bash
traverse journey ./journeys/checkout.ts --base-url http://localhost:3000 --runs 3
```

**Options:**
- `--base-url, -u` - Base URL for the journey (required)
- `--runs, -n` - Number of complete runs (default: 3)
- `--device` - Device preset
- `--output, -o` - Write to file
- `--format` - Output format

**Journey Definition:**

```typescript
import { defineJourney } from 'traverse';

export default defineJourney({
  name: 'checkout-flow',
  description: 'Complete purchase from homepage to confirmation',

  async run(ctx) {
    await ctx.step('homepage', async ({ page, capture }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await capture.navigation();
      await capture.cwv();
      await capture.resources();
    });

    await ctx.step('products', async ({ page, capture }) => {
      await page.click('[data-testid="browse-products"]');
      await page.waitForSelector('[data-testid="product-card"]');
      await capture.navigation(); // Detects soft vs hard nav
      await capture.cwv();
      await capture.resources();
    });

    await ctx.step('product-detail', async ({ page, capture }) => {
      await page.click('[data-testid="product-card"]:first-child');
      await page.waitForSelector('[data-testid="add-to-cart"]');
      await capture.navigation();
      await capture.cwv();
    });
  },
});
```

**Navigation Types Detected:**

| Type | Meaning | Example |
|------|---------|---------|
| `initial` | First page load | Landing on site |
| `soft` | Client-side routing (URL changes) | Next.js Link, React Router |
| `hard` | Full page reload | Form submit, window.location |
| `none` | No URL change | React state update, modal open |

---

### `traverse validate <file>` - Validate Journey

Check journey file syntax without running it.

```bash
traverse validate ./journeys/checkout.ts
```

---

## Output Formats

All commands support `--format json|markdown|html`:

```bash
# JSON for CI/scripts
traverse bench http://localhost:3000 --format json > results.json

# Markdown for PR comments
traverse analyze ./app --format markdown

# Pipe to jq (stderr has status messages)
traverse bench http://localhost:3000 --format json 2>/dev/null | jq '.cwv'

# Save to file
traverse compare --baseline a.json --current b.json -o comparison.md --format markdown
```

---

## Metrics Reference

### Core Web Vitals
| Metric | Description |
|--------|-------------|
| **LCP** | Largest Contentful Paint - when main content is visible |
| **FCP** | First Contentful Paint - when first content is visible |
| **CLS** | Cumulative Layout Shift - visual stability score |
| **TTFB** | Time to First Byte - server response time |

### Extended Metrics
| Metric | Description |
|--------|-------------|
| **TBT** | Total Blocking Time - sum of blocking portions of long tasks |
| **DOM Content Loaded** | When HTML is parsed |
| **Load** | When page is fully loaded |
| **Long Tasks** | Count of tasks > 50ms |
| **Heap Size** | JavaScript heap memory usage |

### SSR & Hydration
| Metric | Description |
|--------|-------------|
| **Framework** | Detected framework (next, react-router, remix) |
| **Has SSR Content** | Whether HTML contains meaningful content |
| **Inline Script Size** | Total size of `<script>` tags without `src` |
| **Hydration Payload** | Size of framework hydration data |
| **RSC Payload** | Size of React Server Component data (Next.js) |
| **__NEXT_DATA__** | Size of Next.js page props (Pages Router) |
| **React Router Data** | Size of React Router context data |

### Bundle Analysis
| Metric | Description |
|--------|-------------|
| **Total** | Combined JS + CSS size |
| **JavaScript** | All JS bundle size |
| **CSS** | All CSS bundle size |
| **Vendor** | Third-party/framework JS |
| **Non-Vendor** | Your application code |
| **Dependencies** | Count from package.json |

---

## Example: Framework Comparison

Compare Next.js vs React Router performance:

```bash
# 1. Analyze static bundles
traverse analyze ./next-app --format json -o next-static.json
traverse analyze ./rr-app --format json -o rr-static.json

# 2. Start both apps
PORT=3001 bun run start  # Next.js
PORT=3000 bun run start  # React Router

# 3. Benchmark runtime
traverse bench http://localhost:3001 --runs 5 -o next-bench.json
traverse bench http://localhost:3000 --runs 5 -o rr-bench.json

# 4. Compare
traverse compare --baseline next-bench.json --current rr-bench.json --format markdown
```

---

## Example Apps

The repo includes example apps for testing:

```bash
# Build
bun run build:next && bun run build:rr && bun run build:react

# Start (separate terminals)
PORT=3001 bun run start:next   # Next.js 16 App Router
PORT=3000 bun run start:rr     # React Router 7
PORT=3002 bun run start:react  # Basic React SPA
```

---

## Known Limitations

- **Favicon** not captured (browser internal request)
- **Cross-origin resources** (e.g., Google Fonts) may not report transfer size
- **Source map analysis** not implemented (can't attribute bundle contents)
- **Vendor detection** uses naming heuristics, may misclassify some chunks
- **HMR timing** not yet implemented (only cold builds)

---

## Development

```bash
# Run tests (115 tests)
bun test

# Type check
bun run typecheck

# Run specific test file
bun test src/capture/ssr.test.ts
```

## License

MIT

# Traverse

Performance data capture and analysis toolkit for web applications. Built with Bun + Playwright.

## What It Does

Traverse captures detailed performance data from web applications, focusing on **journey-centric measurement** - tracking cumulative user experience across multi-step sessions rather than isolated page loads.

```bash
# Single-page benchmark (cold load)
traverse bench https://example.com --runs 5

# Multi-step journey
traverse journey ./journeys/checkout-flow.ts --base-url http://localhost:3000

# Static bundle analysis
traverse analyze ./my-app
```

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

### `traverse bench <url>`

Single-page cold load benchmark. Clears cache, loads page, captures metrics.

```bash
traverse bench http://localhost:3000 --runs 5 --format markdown
```

**Captures:** LCP, FCP, CLS, TTFB, resource count/size, DOM timing, heap size

### `traverse journey <file>`

Multi-step user flow with navigation detection.

```bash
traverse journey ./journeys/product-flow.ts --base-url http://localhost:3000 --runs 3
```

**Captures:** Per-step metrics, navigation type (initial/soft/hard/none), cumulative resources

Example journey file:

```typescript
import { defineJourney } from 'traverse';

export default defineJourney({
  name: 'product-flow',
  description: 'Browse products and view details',

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
      await capture.navigation();
      await capture.cwv();
      await capture.resources();
    });
  },
});
```

### `traverse analyze <dir>`

Static analysis of build output. No browser needed.

```bash
traverse analyze ./my-next-app --format markdown
```

**Detects:** Framework (Next.js, React Router, generic SPA), version, bundle sizes (raw/gzip/brotli), routes

### `traverse validate <file>`

Validate journey file syntax.

```bash
traverse validate ./journeys/checkout.ts
```

## Output Formats

All commands support `--format json|markdown|html`:

```bash
# JSON for CI/scripts
traverse bench http://localhost:3000 --format json > results.json

# Markdown for PR comments
traverse analyze ./app --format markdown

# Pipe to jq
traverse journey ./flow.ts --base-url http://localhost:3000 --format json 2>/dev/null | jq '.steps'
```

## Example Apps

The repo includes three example apps for testing:

```bash
# Build all
bun run build:next && bun run build:rr && bun run build:react

# Start (separate terminals)
bun run start:next   # http://localhost:3001 (Next.js 16)
bun run start:rr     # http://localhost:3000 (React Router 7)
bun run start:react  # http://localhost:3002 (Basic React SPA)
```

## Navigation Detection

Traverse detects four navigation types:

| Type | Meaning | Example |
|------|---------|---------|
| `initial` | First page load | Landing on site |
| `soft` | Client-side routing (URL changes) | Next.js Link, React Router |
| `hard` | Full page reload | Form submit, window.location |
| `none` | No URL change | React state update |

## Known Limitations

- **Favicon** not captured (browser internal request)
- **Cross-origin fonts** (e.g., Google Fonts) may not report transfer size
- **Source map analysis** not yet implemented (can't see what's inside chunks)

## Development

```bash
# Run tests
bun test

# Type check
bun run typecheck
```

## License

MIT

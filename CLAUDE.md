# CLAUDE.md

## Project: Traverse

Performance data capture and analysis toolkit. Built with Bun + Playwright.

## Code Standards

### Functional First

Write pure functions. Avoid mutation. Use `const` exclusively.

```typescript
// Yes
const processSteps = (steps: Step[]): ProcessedStep[] =>
  steps.map(transformStep).filter(isValid);

// No
function processSteps(steps: Step[]): ProcessedStep[] {
  const result: ProcessedStep[] = [];
  for (let i = 0; i < steps.length; i++) {
    const transformed = transformStep(steps[i]);
    if (isValid(transformed)) {
      result.push(transformed);
    }
  }
  return result;
}
```

Use Result types for operations that can fail. Never throw for expected failures.

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

const parseConfig = (raw: string): Result<Config, ParseError> => { ... };
```

Prefer pipelines over nested calls. Prefer small composable functions over large ones.

### Types

No `any`. No `as` casts unless unavoidable (document why). 

Use discriminated unions for state:

```typescript
type CaptureState =
  | { status: 'idle' }
  | { status: 'running'; startedAt: number }
  | { status: 'complete'; result: CaptureResult }
  | { status: 'failed'; error: CaptureError };
```

Derive types from data. Use `satisfies` for type-safe object literals. Use `const` assertions for literals.

### Comments

No comments explaining what code does. The code explains itself.

```typescript
// No
// Loop through steps and calculate total duration
const total = steps.reduce((sum, s) => sum + s.duration, 0);

// Yes (explains WHY, not what)
// CDP reports duration in microseconds, convert to ms for consistency
const durationMs = cdpDuration / 1000;
```

### Structure

One concept per file. One responsibility per function.

```
src/
  capture/
    cwv.ts        # Core Web Vitals capture
    resources.ts  # Resource timing capture
    navigation.ts # Navigation type detection
  analyze/
    bundles.ts
    routes.ts
  journey/
    runner.ts
    context.ts
```

Functions should be <30 lines. If longer, decompose.

### Testing

Test all logic. Use `bun test`. Colocate tests: `foo.ts` → `foo.test.ts`.

```typescript
import { describe, test, expect } from 'bun:test';

describe('calculateCumulativeMetrics', () => {
  test('sums durations across steps', () => {
    const steps = [{ duration: 100 }, { duration: 200 }];
    expect(calculateCumulativeMetrics(steps).totalDuration).toBe(300);
  });
});
```

Test pure functions directly. For Playwright integration, use focused integration tests against fixture apps.

### Bun

Use Bun APIs:
- `Bun.file()` / `Bun.write()` for file I/O
- `Bun.spawn()` for subprocesses
- `bun test` for testing
- Native TypeScript (no build step for dev)

### Dependencies

**Do not add dependencies without asking.** State what you need and why. Prefer:
1. Built-in Bun APIs
2. Playwright APIs (already included)
3. Single-purpose small packages over large frameworks

## Key Files

- `docs/spec.md` — Full project specification
- `docs/roadmap.md` — Implementation roadmap with progress
- `packages/traverse/src/types.ts` — Core type definitions (start here)
- `packages/traverse/src/cli/index.ts` — CLI entry point

## Project Structure

```
traverse/
├── packages/
│   └── traverse/           # Main CLI package
│       ├── src/
│       │   ├── cli/        # CLI commands (bench, journey, analyze, validate)
│       │   ├── bench/      # Single-page benchmark runner
│       │   ├── journey/    # Multi-step journey runner
│       │   ├── analyze/    # Static bundle analysis
│       │   ├── capture/    # CWV and resource capture
│       │   ├── browser/    # Playwright + CDP integration
│       │   ├── config/     # Device/network presets
│       │   ├── types.ts    # Core type definitions
│       │   └── result.ts   # Result<T,E> utilities
│       └── journeys/       # Test journey files
└── docs/
    ├── spec.md             # Full specification
    └── roadmap.md          # Implementation roadmap
```

### Workflow

This project uses `jj` as the VCS frontend with `git` as the "backend". Break changes down into nice changes by using `jj new -m "describe your changes"` and `jj describe -m "describing a change"`. Work in logical steps and make sure to use `jj` to break down incremental work. Never push without asking.

### Dependencies

For any dependencies, make sure to search the web to see what the latest version is. It is 2026, and this being a new project means we should be using the latest versions and patterns. Prefer modern, readable code and do not add dependencies without asking. Dependencies should only make sense to solve problems, not bloat. 


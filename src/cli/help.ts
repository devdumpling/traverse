/**
 * Help text generation for CLI commands.
 */

const VERSION = '0.1.0';

const MAIN_HELP = `
traverse v${VERSION}
Performance data capture and analysis toolkit for web applications.

USAGE:
  traverse <command> [options]

COMMANDS:
  bench <url>           Run single-page performance benchmark
  journey <file>        Execute multi-step journey
  analyze [dir]         Analyze build outputs (static analysis)
  compare               Compare capture results
  report <file>         Generate report from capture data
  init                  Create traverse.config.ts
  validate <file>       Validate journey definition

OPTIONS:
  -h, --help            Show help
  -v, --version         Show version

Run 'traverse <command> --help' for command-specific help.
`.trim();

const BENCH_HELP = `
traverse bench - Run single-page performance benchmark

USAGE:
  traverse bench <url> [options]

ARGUMENTS:
  <url>                 URL to benchmark

OPTIONS:
  -n, --runs <n>        Number of runs (default: 5)
  -d, --device <name>   Device preset (default: desktop)
  --network <name>      Network preset (4g, 3g, or custom)
  -o, --output <file>   Output file path
  --format <fmt>        Output format: json, markdown, html (default: json)
  -h, --help            Show this help

EXAMPLES:
  traverse bench https://example.com
  traverse bench https://example.com --runs 10 --device mobile
  traverse bench https://example.com --network 4g --output results.json
`.trim();

const JOURNEY_HELP = `
traverse journey - Execute multi-step journey

USAGE:
  traverse journey <journey-file> [options]

ARGUMENTS:
  <journey-file>        Path to journey definition file

OPTIONS:
  -u, --base-url <url>  Base URL for the journey (required)
  -n, --runs <n>        Number of complete runs (default: 3)
  -d, --device <name>   Device preset (default: desktop)
  -o, --output <file>   Output file path
  --format <fmt>        Output format: json, markdown, html (default: json)
  -h, --help            Show this help

EXAMPLES:
  traverse journey checkout.ts --base-url https://example.com
  traverse journey flows/login.ts -u http://localhost:3000 --runs 5
`.trim();

const ANALYZE_HELP = `
traverse analyze - Analyze build outputs (static analysis)

USAGE:
  traverse analyze [source-dir] [options]

ARGUMENTS:
  [source-dir]          Source directory (default: current directory)

OPTIONS:
  -b, --build-dir <dir> Build output directory (.next, dist, etc.)
  --framework <name>    Framework hint (auto-detected if omitted)
  -o, --output <file>   Output file path
  --format <fmt>        Output format: json, markdown (default: json)
  -h, --help            Show this help

EXAMPLES:
  traverse analyze ./my-app --build-dir .next
  traverse analyze --framework nextjs --output analysis.json
`.trim();

const COMPARE_HELP = `
traverse compare - Compare capture results

USAGE:
  traverse compare [options]

OPTIONS:
  -b, --baseline <file> Baseline capture file (required)
  -c, --current <file>  Current capture file (required)
  -a, --add <file>      Add additional capture (repeatable)
  -o, --output <file>   Output file path
  --format <fmt>        Output format: json, markdown, html (default: json)
  -h, --help            Show this help

EXAMPLES:
  traverse compare --baseline old.json --current new.json
  traverse compare -b baseline.json -c pr-123.json --format markdown
`.trim();

const REPORT_HELP = `
traverse report - Generate report from capture data

USAGE:
  traverse report <capture-file> [options]

ARGUMENTS:
  <capture-file>        Path to capture JSON file

OPTIONS:
  -o, --output <file>   Output file path
  --format <fmt>        Output format: json, markdown, html (default: json)
  --template <file>     Custom report template
  -h, --help            Show this help

EXAMPLES:
  traverse report results.json --format markdown
  traverse report capture.json --format html --output report.html
`.trim();

const INIT_HELP = `
traverse init - Create traverse.config.ts

USAGE:
  traverse init

Creates a default traverse.config.ts in the current directory.
`.trim();

const VALIDATE_HELP = `
traverse validate - Validate journey definition

USAGE:
  traverse validate <journey-file>

ARGUMENTS:
  <journey-file>        Path to journey definition file

Validates the journey file syntax without executing it.
`.trim();

export const getHelp = (subcommand: string | null): string => {
  switch (subcommand) {
    case 'bench':
      return BENCH_HELP;
    case 'journey':
      return JOURNEY_HELP;
    case 'analyze':
      return ANALYZE_HELP;
    case 'compare':
      return COMPARE_HELP;
    case 'report':
      return REPORT_HELP;
    case 'init':
      return INIT_HELP;
    case 'validate':
      return VALIDATE_HELP;
    default:
      return MAIN_HELP;
  }
};

export const getVersion = (): string => VERSION;

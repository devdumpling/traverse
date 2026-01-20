/**
 * CLI argument parser.
 * Hand-rolled with Bun.argv - simple enough, zero deps.
 */

import type { Command, ParseError, OutputFormat } from '../types.ts';
import { ok, err } from '../result.ts';
import type { Result } from '../types.ts';

const VALID_FORMATS = ['json', 'markdown', 'html'] as const;

const isValidFormat = (value: string): value is OutputFormat =>
  VALID_FORMATS.includes(value as OutputFormat);

interface ParsedFlags {
  readonly positional: readonly string[];
  readonly flags: Record<string, string | true>;
}

const parseFlags = (args: readonly string[]): ParsedFlags => {
  const positional: string[] = [];
  const flags: Record<string, string | true> = {};

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === undefined) {
      i++;
      continue;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      const next = args[i + 1];
      if (next !== undefined && !next.startsWith('-')) {
        flags[key] = next;
        i += 2;
      } else {
        flags[key] = true;
        i++;
      }
    } else {
      positional.push(arg);
      i++;
    }
  }

  return { positional, flags };
};

const getFlag = (
  flags: Record<string, string | true>,
  ...keys: readonly string[]
): string | null => {
  for (const key of keys) {
    const value = flags[key];
    if (typeof value === 'string') return value;
  }
  return null;
};

const hasFlag = (
  flags: Record<string, string | true>,
  ...keys: readonly string[]
): boolean => keys.some((key) => key in flags);

const getFormat = (
  flags: Record<string, string | true>,
  defaultFormat: OutputFormat = 'json'
): Result<OutputFormat, ParseError> => {
  const format = getFlag(flags, 'format', 'f');
  if (format === null) return ok(defaultFormat);
  if (isValidFormat(format)) return ok(format);
  return err({
    code: 'INVALID_ARG_VALUE',
    message: `Invalid format: "${format}". Must be one of: ${VALID_FORMATS.join(', ')}`,
    arg: 'format',
  });
};

const getRuns = (
  flags: Record<string, string | true>,
  defaultRuns: number
): Result<number, ParseError> => {
  const runs = getFlag(flags, 'runs', 'n');
  if (runs === null) return ok(defaultRuns);
  const parsed = parseInt(runs, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return err({
      code: 'INVALID_ARG_VALUE',
      message: `Invalid runs: "${runs}". Must be a positive integer.`,
      arg: 'runs',
    });
  }
  return ok(parsed);
};

const parseBench = (
  positional: readonly string[],
  flags: Record<string, string | true>
): Result<Command, ParseError> => {
  const url = positional[1];
  if (url === undefined) {
    return err({
      code: 'MISSING_REQUIRED_ARG',
      message: 'Missing required argument: <url>',
      arg: 'url',
    });
  }

  const formatResult = getFormat(flags);
  if (!formatResult.ok) return formatResult;

  const runsResult = getRuns(flags, 5);
  if (!runsResult.ok) return runsResult;

  return ok({
    command: 'bench',
    url,
    runs: runsResult.value,
    device: getFlag(flags, 'device', 'd') ?? 'desktop',
    network: getFlag(flags, 'network'),
    output: getFlag(flags, 'output', 'o'),
    format: formatResult.value,
  });
};

const parseJourney = (
  positional: readonly string[],
  flags: Record<string, string | true>
): Result<Command, ParseError> => {
  const journeyFile = positional[1];
  if (journeyFile === undefined) {
    return err({
      code: 'MISSING_REQUIRED_ARG',
      message: 'Missing required argument: <journey-file>',
      arg: 'journey-file',
    });
  }

  const baseUrl = getFlag(flags, 'base-url', 'u');
  if (baseUrl === null) {
    return err({
      code: 'MISSING_REQUIRED_ARG',
      message: 'Missing required option: --base-url',
      arg: 'base-url',
    });
  }

  const formatResult = getFormat(flags);
  if (!formatResult.ok) return formatResult;

  const runsResult = getRuns(flags, 3);
  if (!runsResult.ok) return runsResult;

  return ok({
    command: 'journey',
    journeyFile,
    baseUrl,
    runs: runsResult.value,
    device: getFlag(flags, 'device', 'd') ?? 'desktop',
    output: getFlag(flags, 'output', 'o'),
    format: formatResult.value,
  });
};

const parseAnalyze = (
  positional: readonly string[],
  flags: Record<string, string | true>
): Result<Command, ParseError> => {
  const sourceDir = positional[1] ?? '.';

  const formatResult = getFormat(flags);
  if (!formatResult.ok) return formatResult;

  return ok({
    command: 'analyze',
    sourceDir,
    buildDir: getFlag(flags, 'build-dir', 'b'),
    framework: getFlag(flags, 'framework'),
    output: getFlag(flags, 'output', 'o'),
    format: formatResult.value,
  });
};

const parseCompare = (
  _positional: readonly string[],
  flags: Record<string, string | true>
): Result<Command, ParseError> => {
  const baseline = getFlag(flags, 'baseline', 'b');
  if (baseline === null) {
    return err({
      code: 'MISSING_REQUIRED_ARG',
      message: 'Missing required option: --baseline',
      arg: 'baseline',
    });
  }

  const current = getFlag(flags, 'current', 'c');
  if (current === null) {
    return err({
      code: 'MISSING_REQUIRED_ARG',
      message: 'Missing required option: --current',
      arg: 'current',
    });
  }

  const formatResult = getFormat(flags);
  if (!formatResult.ok) return formatResult;

  const additional: string[] = [];
  for (const [key, value] of Object.entries(flags)) {
    if ((key === 'add' || key === 'a') && typeof value === 'string') {
      additional.push(value);
    }
  }

  return ok({
    command: 'compare',
    baseline,
    current,
    additional,
    output: getFlag(flags, 'output', 'o'),
    format: formatResult.value,
  });
};

const parseReport = (
  positional: readonly string[],
  flags: Record<string, string | true>
): Result<Command, ParseError> => {
  const captureFile = positional[1];
  if (captureFile === undefined) {
    return err({
      code: 'MISSING_REQUIRED_ARG',
      message: 'Missing required argument: <capture-file>',
      arg: 'capture-file',
    });
  }

  const formatResult = getFormat(flags);
  if (!formatResult.ok) return formatResult;

  return ok({
    command: 'report',
    captureFile,
    output: getFlag(flags, 'output', 'o'),
    format: formatResult.value,
    template: getFlag(flags, 'template'),
  });
};

const parseValidate = (
  positional: readonly string[],
  _flags: Record<string, string | true>
): Result<Command, ParseError> => {
  const journeyFile = positional[1];
  if (journeyFile === undefined) {
    return err({
      code: 'MISSING_REQUIRED_ARG',
      message: 'Missing required argument: <journey-file>',
      arg: 'journey-file',
    });
  }

  return ok({
    command: 'validate',
    journeyFile,
  });
};

export const parse = (argv: readonly string[]): Result<Command, ParseError> => {
  // Skip first two args (bun executable and script path)
  const args = argv.slice(2);
  const { positional, flags } = parseFlags(args);

  // Handle version flag anywhere
  if (hasFlag(flags, 'version', 'v')) {
    return ok({ command: 'version' });
  }

  // Handle help flag anywhere
  if (hasFlag(flags, 'help', 'h')) {
    return ok({ command: 'help', subcommand: positional[0] ?? null });
  }

  const command = positional[0];

  // No command = show help
  if (command === undefined) {
    return ok({ command: 'help', subcommand: null });
  }

  switch (command) {
    case 'bench':
      return parseBench(positional, flags);
    case 'journey':
      return parseJourney(positional, flags);
    case 'analyze':
      return parseAnalyze(positional, flags);
    case 'compare':
      return parseCompare(positional, flags);
    case 'report':
      return parseReport(positional, flags);
    case 'init':
      return ok({ command: 'init' });
    case 'validate':
      return parseValidate(positional, flags);
    case 'help':
      return ok({ command: 'help', subcommand: positional[1] ?? null });
    default:
      return err({
        code: 'UNKNOWN_COMMAND',
        message: `Unknown command: "${command}"`,
        arg: command,
      });
  }
};

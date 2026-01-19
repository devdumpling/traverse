import { describe, test, expect } from 'bun:test';
import { parse } from './parser.ts';

describe('CLI parser', () => {
  const argv = (args: string) => ['bun', 'traverse', ...args.split(' ').filter(Boolean)];

  describe('help and version', () => {
    test('no args shows help', () => {
      const result = parse(['bun', 'traverse']);
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.command).toBe('help');
      }
    });

    test('--help shows help', () => {
      const result = parse(argv('--help'));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.command).toBe('help');
      }
    });

    test('-h shows help', () => {
      const result = parse(argv('-h'));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.command).toBe('help');
      }
    });

    test('--version shows version', () => {
      const result = parse(argv('--version'));
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.command).toBe('version');
      }
    });

    test('help <command> shows command help', () => {
      const result = parse(argv('help bench'));
      expect(result.ok).toBe(true);
      if (result.ok && result.value.command === 'help') {
        expect(result.value.subcommand).toBe('bench');
      }
    });
  });

  describe('bench command', () => {
    test('parses basic bench command', () => {
      const result = parse(argv('bench https://example.com'));
      expect(result.ok).toBe(true);
      if (result.ok && result.value.command === 'bench') {
        expect(result.value.url).toBe('https://example.com');
        expect(result.value.runs).toBe(5); // default
        expect(result.value.device).toBe('desktop'); // default
        expect(result.value.format).toBe('json'); // default
      }
    });

    test('parses bench with options', () => {
      const result = parse(argv('bench https://example.com --runs 10 --device mobile --network 4g'));
      expect(result.ok).toBe(true);
      if (result.ok && result.value.command === 'bench') {
        expect(result.value.runs).toBe(10);
        expect(result.value.device).toBe('mobile');
        expect(result.value.network).toBe('4g');
      }
    });

    test('parses bench with short options', () => {
      const result = parse(argv('bench https://example.com -n 3 -d tablet -o results.json'));
      expect(result.ok).toBe(true);
      if (result.ok && result.value.command === 'bench') {
        expect(result.value.runs).toBe(3);
        expect(result.value.device).toBe('tablet');
        expect(result.value.output).toBe('results.json');
      }
    });

    test('requires url argument', () => {
      const result = parse(argv('bench'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MISSING_REQUIRED_ARG');
      }
    });

    test('rejects invalid format', () => {
      const result = parse(argv('bench https://example.com --format invalid'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ARG_VALUE');
      }
    });

    test('rejects invalid runs', () => {
      const result = parse(argv('bench https://example.com --runs abc'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('INVALID_ARG_VALUE');
      }
    });
  });

  describe('journey command', () => {
    test('parses journey command', () => {
      const result = parse(argv('journey checkout.ts --base-url https://example.com'));
      expect(result.ok).toBe(true);
      if (result.ok && result.value.command === 'journey') {
        expect(result.value.journeyFile).toBe('checkout.ts');
        expect(result.value.baseUrl).toBe('https://example.com');
        expect(result.value.runs).toBe(3); // default
      }
    });

    test('requires journey file', () => {
      const result = parse(argv('journey --base-url https://example.com'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MISSING_REQUIRED_ARG');
      }
    });

    test('requires base-url', () => {
      const result = parse(argv('journey checkout.ts'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('MISSING_REQUIRED_ARG');
      }
    });
  });

  describe('analyze command', () => {
    test('parses analyze with defaults', () => {
      const result = parse(argv('analyze'));
      expect(result.ok).toBe(true);
      if (result.ok && result.value.command === 'analyze') {
        expect(result.value.sourceDir).toBe('.');
      }
    });

    test('parses analyze with options', () => {
      const result = parse(argv('analyze ./my-app --build-dir .next --framework nextjs'));
      expect(result.ok).toBe(true);
      if (result.ok && result.value.command === 'analyze') {
        expect(result.value.sourceDir).toBe('./my-app');
        expect(result.value.buildDir).toBe('.next');
        expect(result.value.framework).toBe('nextjs');
      }
    });
  });

  describe('compare command', () => {
    test('parses compare command', () => {
      const result = parse(argv('compare --baseline old.json --current new.json'));
      expect(result.ok).toBe(true);
      if (result.ok && result.value.command === 'compare') {
        expect(result.value.baseline).toBe('old.json');
        expect(result.value.current).toBe('new.json');
      }
    });

    test('requires baseline', () => {
      const result = parse(argv('compare --current new.json'));
      expect(result.ok).toBe(false);
    });

    test('requires current', () => {
      const result = parse(argv('compare --baseline old.json'));
      expect(result.ok).toBe(false);
    });
  });

  describe('unknown command', () => {
    test('returns error for unknown command', () => {
      const result = parse(argv('unknown'));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('UNKNOWN_COMMAND');
      }
    });
  });
});

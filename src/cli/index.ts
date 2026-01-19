#!/usr/bin/env bun
/**
 * Traverse CLI entry point.
 */

import { parse } from './parser.ts';
import { getHelp, getVersion } from './help.ts';
import { executeBench } from './commands/bench.ts';
import { match } from '../result.ts';
import type { Command } from '../types.ts';

const runCommand = async (command: Command): Promise<number> => {
  switch (command.command) {
    case 'help':
      console.log(getHelp(command.subcommand));
      return 0;

    case 'version':
      console.log(`traverse v${getVersion()}`);
      return 0;

    case 'bench':
      return executeBench(command);

    case 'journey':
      console.log(`Running journey: ${command.journeyFile}`);
      console.log(`  Base URL: ${command.baseUrl}`);
      console.log(`  Runs: ${command.runs}`);
      // TODO: Implement journey runner
      console.log('\nJourney command not yet implemented.');
      return 1;

    case 'analyze':
      console.log(`Analyzing: ${command.sourceDir}`);
      console.log(`  Build dir: ${command.buildDir ?? 'auto-detect'}`);
      // TODO: Implement static analysis
      console.log('\nAnalyze command not yet implemented.');
      return 1;

    case 'compare':
      console.log(`Comparing:`);
      console.log(`  Baseline: ${command.baseline}`);
      console.log(`  Current: ${command.current}`);
      // TODO: Implement comparison
      console.log('\nCompare command not yet implemented.');
      return 1;

    case 'report':
      console.log(`Generating report from: ${command.captureFile}`);
      // TODO: Implement report generation
      console.log('\nReport command not yet implemented.');
      return 1;

    case 'init':
      console.log('Creating traverse.config.ts...');
      // TODO: Implement config initialization
      console.log('\nInit command not yet implemented.');
      return 1;

    case 'validate':
      console.log(`Validating: ${command.journeyFile}`);
      // TODO: Implement validation
      console.log('\nValidate command not yet implemented.');
      return 1;

    default: {
      const _exhaustive: never = command;
      return 1;
    }
  }
};

const main = async (): Promise<void> => {
  const result = parse(Bun.argv);

  const exitCode = await match(result, {
    ok: runCommand,
    err: (error) => {
      console.error(`Error: ${error.message}`);
      if (error.code === 'UNKNOWN_COMMAND') {
        console.error(`Run 'traverse --help' for usage information.`);
      }
      return Promise.resolve(1);
    },
  });

  process.exit(exitCode);
};

main();

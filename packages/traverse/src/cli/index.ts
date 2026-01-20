#!/usr/bin/env bun
/**
 * Traverse CLI entry point.
 */

import { parse } from './parser.ts';
import { getHelp, getVersion } from './help.ts';
import { executeBench } from './commands/bench.ts';
import { executeJourney } from './commands/journey.ts';
import { executeValidate } from './commands/validate.ts';
import { executeAnalyze } from './commands/analyze.ts';
import { executeCompare } from './commands/compare.ts';
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
      return executeJourney(command);

    case 'validate':
      return executeValidate(command);

    case 'analyze':
      return executeAnalyze(command);

    case 'compare':
      return executeCompare(command);

    case 'report':
      console.log(`Generating report from: ${command.captureFile}`);
      console.log('\nReport command not yet implemented.');
      return 1;

    case 'init':
      console.log('Creating traverse.config.ts...');
      console.log('\nInit command not yet implemented.');
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

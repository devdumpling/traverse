/**
 * Build script for Node.js distribution.
 * Compiles TypeScript source to Node.js-compatible JavaScript and generates type declarations.
 */

import { $ } from 'bun';

const buildCli = async (): Promise<void> => {
  const result = await Bun.build({
    entrypoints: ['./src/cli/index.ts'],
    outdir: './dist/cli',
    target: 'node',
    format: 'esm',
    external: ['playwright'],
    sourcemap: 'linked',
  });

  if (!result.success) {
    console.error('CLI build failed:');
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }
};

const buildLibrary = async (): Promise<void> => {
  const result = await Bun.build({
    entrypoints: [
      './src/index.ts',
      './src/journey/index.ts',
      './src/config/index.ts',
    ],
    outdir: './dist',
    target: 'node',
    format: 'esm',
    external: ['playwright'],
    sourcemap: 'linked',
    splitting: true,
  });

  if (!result.success) {
    console.error('Library build failed:');
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }
};

const generateTypes = async (): Promise<void> => {
  await $`bun run tsc --project tsconfig.build.json`;
};

const main = async (): Promise<void> => {
  console.log('Building for Node.js distribution...\n');

  console.log('Building CLI...');
  await buildCli();
  console.log('CLI built successfully.\n');

  console.log('Building library...');
  await buildLibrary();
  console.log('Library built successfully.\n');

  console.log('Generating type declarations...');
  await generateTypes();
  console.log('Types generated successfully.\n');

  console.log('Build complete! Output in ./dist');
};

main();

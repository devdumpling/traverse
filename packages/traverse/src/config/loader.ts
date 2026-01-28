/**
 * Configuration file loader.
 * Loads traverse.config.ts using native TypeScript support.
 */

import { access } from 'node:fs/promises';
import type { Result, TraverseConfig, ConfigError } from '../types.ts';
import { ok, err } from '../result.ts';
import { DEFAULT_CONFIG } from './defaults.ts';

const CONFIG_FILENAMES = [
  'traverse.config.ts',
  'traverse.config.js',
  'traverse.config.mjs',
] as const;

const findConfigFile = async (cwd: string): Promise<string | null> => {
  for (const filename of CONFIG_FILENAMES) {
    const path = `${cwd}/${filename}`;
    try {
      await access(path);
      return path;
    } catch {
      // File doesn't exist, try next
    }
  }
  return null;
};

const loadConfigFile = async (
  path: string
): Promise<Result<Partial<TraverseConfig>, ConfigError>> => {
  try {
    const module = await import(path);
    const config = module.default as Partial<TraverseConfig>;
    return ok(config);
  } catch (e) {
    return err({
      code: 'CONFIG_LOAD_FAILED',
      message: e instanceof Error ? e.message : 'Failed to load config file',
      path,
    });
  }
};

const mergeConfig = (
  base: TraverseConfig,
  override: Partial<TraverseConfig>
): TraverseConfig => ({
  defaults: { ...base.defaults, ...override.defaults },
  devices: { ...base.devices, ...override.devices },
  networks: { ...base.networks, ...override.networks },
  output: { ...base.output, ...override.output },
  journeys: { ...base.journeys, ...override.journeys },
});

export const loadConfig = async (
  cwd: string = process.cwd()
): Promise<Result<TraverseConfig, ConfigError>> => {
  const configPath = await findConfigFile(cwd);

  if (configPath === null) {
    return ok(DEFAULT_CONFIG);
  }

  const configResult = await loadConfigFile(configPath);
  if (!configResult.ok) {
    return configResult;
  }

  return ok(mergeConfig(DEFAULT_CONFIG, configResult.value));
};

export const defineConfig = (config: Partial<TraverseConfig>): Partial<TraverseConfig> =>
  config;

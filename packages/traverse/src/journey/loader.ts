/**
 * Journey file loader and validator.
 */

import { access } from 'node:fs/promises';
import type { Result } from '../types.ts';
import { ok, err } from '../result.ts';
import type { JourneyDefinition } from './define.ts';

export interface LoadError {
  readonly code: 'FILE_NOT_FOUND' | 'INVALID_JOURNEY' | 'LOAD_FAILED';
  readonly message: string;
  readonly path: string;
}

const isValidJourneyDefinition = (obj: unknown): obj is JourneyDefinition => {
  if (typeof obj !== 'object' || obj === null) return false;
  const def = obj as Record<string, unknown>;
  return (
    typeof def['name'] === 'string' &&
    typeof def['description'] === 'string' &&
    typeof def['run'] === 'function'
  );
};

const fileExists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

export const loadJourney = async (
  path: string
): Promise<Result<JourneyDefinition, LoadError>> => {
  const exists = await fileExists(path);

  if (!exists) {
    return err({
      code: 'FILE_NOT_FOUND',
      message: `Journey file not found: ${path}`,
      path,
    });
  }

  try {
    // Resolve to absolute path for import
    const absolutePath = path.startsWith('/') ? path : `${process.cwd()}/${path}`;
    const module = await import(absolutePath);
    const journey = module.default as unknown;

    if (!isValidJourneyDefinition(journey)) {
      return err({
        code: 'INVALID_JOURNEY',
        message: `Invalid journey definition. Must export default with name, description, and run function.`,
        path,
      });
    }

    return ok(journey);
  } catch (e) {
    return err({
      code: 'LOAD_FAILED',
      message: e instanceof Error ? e.message : 'Failed to load journey file',
      path,
    });
  }
};

export const validateJourney = async (
  path: string
): Promise<Result<{ valid: true; name: string; description: string }, LoadError>> => {
  const result = await loadJourney(path);

  if (!result.ok) {
    return result;
  }

  return ok({
    valid: true,
    name: result.value.name,
    description: result.value.description,
  });
};

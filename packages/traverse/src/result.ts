/**
 * Result type utilities for functional error handling.
 * Never throw for expected failures - use Result instead.
 */

import type { Result } from './types.ts';

// =============================================================================
// Constructors
// =============================================================================

export const ok = <T>(value: T): Result<T, never> => ({
  ok: true,
  value,
});

export const err = <E>(error: E): Result<never, E> => ({
  ok: false,
  error,
});

// =============================================================================
// Guards
// =============================================================================

export const isOk = <T, E>(result: Result<T, E>): result is { ok: true; value: T } =>
  result.ok;

export const isErr = <T, E>(result: Result<T, E>): result is { ok: false; error: E } =>
  !result.ok;

// =============================================================================
// Extractors
// =============================================================================

export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (result.ok) return result.value;
  throw new Error(`Attempted to unwrap an error result: ${JSON.stringify(result.error)}`);
};

export const unwrapOr = <T, E>(result: Result<T, E>, defaultValue: T): T =>
  result.ok ? result.value : defaultValue;

export const unwrapOrElse = <T, E>(result: Result<T, E>, fn: (error: E) => T): T =>
  result.ok ? result.value : fn(result.error);

// =============================================================================
// Transformers
// =============================================================================

export const map = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

export const mapErr = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> =>
  result.ok ? result : err(fn(result.error));

export const flatMap = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> =>
  result.ok ? fn(result.value) : result;

// =============================================================================
// Combinators
// =============================================================================

export const all = <T, E>(results: readonly Result<T, E>[]): Result<readonly T[], E> => {
  const values: T[] = [];
  for (const result of results) {
    if (!result.ok) return result;
    values.push(result.value);
  }
  return ok(values);
};

export const any = <T, E>(results: readonly Result<T, E>[]): Result<T, readonly E[]> => {
  const errors: E[] = [];
  for (const result of results) {
    if (result.ok) return result;
    errors.push(result.error);
  }
  return err(errors);
};

// =============================================================================
// Async Utilities
// =============================================================================

export const fromPromise = async <T, E = unknown>(
  promise: Promise<T>,
  mapError: (e: unknown) => E = (e) => e as E
): Promise<Result<T, E>> => {
  try {
    const value = await promise;
    return ok(value);
  } catch (e) {
    return err(mapError(e));
  }
};

export const toPromise = <T, E>(result: Result<T, E>): Promise<T> =>
  result.ok ? Promise.resolve(result.value) : Promise.reject(result.error);

// =============================================================================
// Pattern Matching
// =============================================================================

export const match = <T, E, U>(
  result: Result<T, E>,
  handlers: {
    readonly ok: (value: T) => U;
    readonly err: (error: E) => U;
  }
): U =>
  result.ok ? handlers.ok(result.value) : handlers.err(result.error);

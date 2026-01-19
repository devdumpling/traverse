import { describe, test, expect } from 'bun:test';
import { ok, err, isOk, isErr, unwrap, unwrapOr, map, flatMap, all, match } from './result.ts';

describe('Result constructors', () => {
  test('ok creates success result', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(42);
  });

  test('err creates error result', () => {
    const result = err('failed');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('failed');
  });
});

describe('Result guards', () => {
  test('isOk returns true for ok result', () => {
    expect(isOk(ok(42))).toBe(true);
    expect(isOk(err('failed'))).toBe(false);
  });

  test('isErr returns true for err result', () => {
    expect(isErr(err('failed'))).toBe(true);
    expect(isErr(ok(42))).toBe(false);
  });
});

describe('Result extractors', () => {
  test('unwrap returns value for ok result', () => {
    expect(unwrap(ok(42))).toBe(42);
  });

  test('unwrap throws for err result', () => {
    expect(() => unwrap(err('failed'))).toThrow();
  });

  test('unwrapOr returns value for ok result', () => {
    expect(unwrapOr(ok(42), 0)).toBe(42);
  });

  test('unwrapOr returns default for err result', () => {
    expect(unwrapOr(err('failed'), 0)).toBe(0);
  });
});

describe('Result transformers', () => {
  test('map transforms ok value', () => {
    const result = map(ok(2), (x) => x * 2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(4);
  });

  test('map passes through err', () => {
    const result = map(err('failed'), (x: number) => x * 2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('failed');
  });

  test('flatMap chains ok results', () => {
    const double = (x: number) => ok(x * 2);
    const result = flatMap(ok(2), double);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(4);
  });

  test('flatMap short-circuits on err', () => {
    const double = (x: number) => ok(x * 2);
    const result = flatMap(err('failed') as ReturnType<typeof err<string>>, double);
    expect(result.ok).toBe(false);
  });
});

describe('Result combinators', () => {
  test('all returns array of values when all ok', () => {
    const result = all([ok(1), ok(2), ok(3)]);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual([1, 2, 3]);
  });

  test('all returns first error when any err', () => {
    const result = all([ok(1), err('failed'), ok(3)]);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('failed');
  });
});

describe('Result pattern matching', () => {
  test('match calls ok handler for ok result', () => {
    const result = match(ok(42), {
      ok: (v) => `value: ${v}`,
      err: (e) => `error: ${e}`,
    });
    expect(result).toBe('value: 42');
  });

  test('match calls err handler for err result', () => {
    const result = match(err('failed'), {
      ok: (v) => `value: ${v}`,
      err: (e) => `error: ${e}`,
    });
    expect(result).toBe('error: failed');
  });
});

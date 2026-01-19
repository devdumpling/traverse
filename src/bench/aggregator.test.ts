import { describe, test, expect } from 'bun:test';
import { aggregate, aggregateNullable } from './aggregator.ts';

describe('aggregate', () => {
  test('calculates correct median for odd count', () => {
    const result = aggregate([1, 2, 3, 4, 5]);
    expect(result.median).toBe(3);
  });

  test('calculates correct median for even count', () => {
    const result = aggregate([1, 2, 3, 4]);
    expect(result.median).toBe(2);
  });

  test('calculates correct percentiles', () => {
    const values = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const result = aggregate(values);
    expect(result.p75).toBe(80);
    expect(result.p95).toBe(100);
  });

  test('calculates correct min and max', () => {
    const result = aggregate([5, 1, 9, 3, 7]);
    expect(result.min).toBe(1);
    expect(result.max).toBe(9);
  });

  test('calculates variance', () => {
    const result = aggregate([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(result.variance).toBeCloseTo(4, 1);
  });

  test('preserves original values', () => {
    const values = [3, 1, 2];
    const result = aggregate(values);
    expect(result.values).toEqual(values);
  });

  test('handles single value', () => {
    const result = aggregate([42]);
    expect(result.median).toBe(42);
    expect(result.min).toBe(42);
    expect(result.max).toBe(42);
    expect(result.variance).toBe(0);
  });

  test('handles empty array', () => {
    const result = aggregate([]);
    expect(result.median).toBe(0);
    expect(result.min).toBe(0);
    expect(result.max).toBe(0);
  });
});

describe('aggregateNullable', () => {
  test('returns null for all-null values', () => {
    const result = aggregateNullable([null, null, null]);
    expect(result).toBeNull();
  });

  test('filters out null values', () => {
    const result = aggregateNullable([1, null, 3, null, 5]);
    expect(result).not.toBeNull();
    expect(result?.median).toBe(3);
    expect(result?.values).toEqual([1, 3, 5]);
  });

  test('returns aggregated result for non-null values', () => {
    const result = aggregateNullable([10, 20, 30]);
    expect(result).not.toBeNull();
    expect(result?.median).toBe(20);
  });
});

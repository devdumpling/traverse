import { describe, test, expect } from 'bun:test';

describe('Blocking time calculation', () => {
  const LONG_TASK_THRESHOLD = 50;

  const calculateBlockingTime = (duration: number) => {
    return Math.max(0, duration - LONG_TASK_THRESHOLD);
  };

  const calculateTotalBlockingTime = (tasks: { duration: number }[]) => {
    return tasks.reduce((sum, task) => sum + calculateBlockingTime(task.duration), 0);
  };

  test('calculates blocking time for task > 50ms', () => {
    expect(calculateBlockingTime(100)).toBe(50);
    expect(calculateBlockingTime(150)).toBe(100);
    expect(calculateBlockingTime(51)).toBe(1);
  });

  test('returns 0 for tasks <= 50ms', () => {
    expect(calculateBlockingTime(50)).toBe(0);
    expect(calculateBlockingTime(30)).toBe(0);
    expect(calculateBlockingTime(0)).toBe(0);
  });

  test('calculates total blocking time from multiple tasks', () => {
    const tasks = [
      { duration: 100 }, // 50ms blocking
      { duration: 60 },  // 10ms blocking
      { duration: 40 },  // 0ms blocking
      { duration: 200 }, // 150ms blocking
    ];
    expect(calculateTotalBlockingTime(tasks)).toBe(210);
  });

  test('returns 0 for no long tasks', () => {
    const tasks = [
      { duration: 20 },
      { duration: 40 },
      { duration: 50 },
    ];
    expect(calculateTotalBlockingTime(tasks)).toBe(0);
  });

  test('handles empty task list', () => {
    expect(calculateTotalBlockingTime([])).toBe(0);
  });
});

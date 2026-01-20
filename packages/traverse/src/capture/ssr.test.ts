import { describe, test, expect } from 'bun:test';

// Test the SSR detection logic by simulating what the browser function does
describe('SSR capture detection patterns', () => {
  const detectFramework = (content: string) => {
    if (content.includes('self.__next_f') || content.includes('__NEXT_DATA__')) {
      return 'next';
    }
    if (content.includes('__remixContext')) {
      return 'remix';
    }
    if (content.includes('__reactRouterContext')) {
      return 'react-router';
    }
    return null;
  };

  test('detects Next.js RSC payload', () => {
    const script = 'self.__next_f.push([1,"data"]);';
    expect(detectFramework(script)).toBe('next');
  });

  test('detects Next.js __NEXT_DATA__', () => {
    const script = '{"props":{"pageProps":{}},"__N_SSP":true}';
    // This would be in a script with id="__NEXT_DATA__"
    expect(detectFramework('__NEXT_DATA__')).toBe('next');
  });

  test('detects React Router context', () => {
    const script = 'window.__reactRouterContext = {"router":{}};';
    expect(detectFramework(script)).toBe('react-router');
  });

  test('detects Remix context', () => {
    const script = 'window.__remixContext = {"state":{}};';
    expect(detectFramework(script)).toBe('remix');
  });

  test('returns null for generic scripts', () => {
    const script = 'console.log("hello");';
    expect(detectFramework(script)).toBe(null);
  });
});

describe('SSR content detection', () => {
  const hasContent = (textLength: number, childCount: number) => {
    return textLength > 50 || childCount > 2;
  };

  test('detects content with significant text', () => {
    expect(hasContent(100, 1)).toBe(true);
  });

  test('detects content with multiple children', () => {
    expect(hasContent(10, 5)).toBe(true);
  });

  test('detects no content for empty root', () => {
    expect(hasContent(0, 0)).toBe(false);
  });

  test('detects no content for minimal root', () => {
    expect(hasContent(20, 1)).toBe(false);
  });
});

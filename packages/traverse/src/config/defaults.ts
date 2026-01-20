/**
 * Default configuration presets.
 */

import type { DeviceConfig, NetworkConfig, TraverseConfig } from '../types.ts';

export const DEVICE_PRESETS = {
  desktop: {
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
  laptop: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    isMobile: false,
    hasTouch: false,
  },
  tablet: {
    viewport: { width: 768, height: 1024 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  mobile: {
    viewport: { width: 390, height: 844 },
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  },
} as const satisfies Record<string, DeviceConfig>;

export const NETWORK_PRESETS = {
  '4g': {
    downloadThroughput: (4 * 1024 * 1024) / 8,
    uploadThroughput: (3 * 1024 * 1024) / 8,
    latency: 20,
  },
  '3g': {
    downloadThroughput: (1.5 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
    latency: 100,
  },
  'slow-3g': {
    downloadThroughput: (500 * 1024) / 8,
    uploadThroughput: (500 * 1024) / 8,
    latency: 400,
  },
} as const satisfies Record<string, NetworkConfig>;

export const DEFAULT_CONFIG: TraverseConfig = {
  defaults: {
    runs: 5,
    device: 'desktop',
    network: 'none',
  },
  devices: DEVICE_PRESETS,
  networks: NETWORK_PRESETS,
  output: {
    dir: './traverse-reports',
    baselineFile: './traverse-baseline.json',
  },
  journeys: {
    dir: './journeys',
    pattern: '**/*.journey.ts',
  },
};

export const getDeviceConfig = (name: string): DeviceConfig | null =>
  DEVICE_PRESETS[name as keyof typeof DEVICE_PRESETS] ?? null;

export const getNetworkConfig = (name: string): NetworkConfig | null =>
  NETWORK_PRESETS[name as keyof typeof NETWORK_PRESETS] ?? null;

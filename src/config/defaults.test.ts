import { describe, test, expect } from 'bun:test';
import { 
  DEVICE_PRESETS, 
  NETWORK_PRESETS, 
  DEFAULT_CONFIG,
  getDeviceConfig,
  getNetworkConfig,
} from './defaults.ts';

describe('device presets', () => {
  test('desktop has correct viewport', () => {
    expect(DEVICE_PRESETS.desktop.viewport.width).toBe(1920);
    expect(DEVICE_PRESETS.desktop.viewport.height).toBe(1080);
    expect(DEVICE_PRESETS.desktop.isMobile).toBe(false);
  });

  test('mobile has correct viewport', () => {
    expect(DEVICE_PRESETS.mobile.viewport.width).toBe(390);
    expect(DEVICE_PRESETS.mobile.viewport.height).toBe(844);
    expect(DEVICE_PRESETS.mobile.isMobile).toBe(true);
    expect(DEVICE_PRESETS.mobile.hasTouch).toBe(true);
  });

  test('getDeviceConfig returns preset for valid name', () => {
    const device = getDeviceConfig('desktop');
    expect(device).not.toBeNull();
    expect(device?.viewport.width).toBe(1920);
  });

  test('getDeviceConfig returns null for invalid name', () => {
    const device = getDeviceConfig('invalid');
    expect(device).toBeNull();
  });
});

describe('network presets', () => {
  test('4g has reasonable throughput', () => {
    expect(NETWORK_PRESETS['4g'].downloadThroughput).toBeGreaterThan(0);
    expect(NETWORK_PRESETS['4g'].latency).toBe(20);
  });

  test('3g is slower than 4g', () => {
    expect(NETWORK_PRESETS['3g'].downloadThroughput).toBeLessThan(
      NETWORK_PRESETS['4g'].downloadThroughput
    );
    expect(NETWORK_PRESETS['3g'].latency).toBeGreaterThan(
      NETWORK_PRESETS['4g'].latency
    );
  });

  test('getNetworkConfig returns preset for valid name', () => {
    const network = getNetworkConfig('4g');
    expect(network).not.toBeNull();
  });

  test('getNetworkConfig returns null for invalid name', () => {
    const network = getNetworkConfig('invalid');
    expect(network).toBeNull();
  });
});

describe('default config', () => {
  test('has sensible defaults', () => {
    expect(DEFAULT_CONFIG.defaults.runs).toBe(5);
    expect(DEFAULT_CONFIG.defaults.device).toBe('desktop');
  });

  test('includes all device presets', () => {
    expect(DEFAULT_CONFIG.devices.desktop).toBeDefined();
    expect(DEFAULT_CONFIG.devices.mobile).toBeDefined();
    expect(DEFAULT_CONFIG.devices.tablet).toBeDefined();
  });

  test('includes all network presets', () => {
    expect(DEFAULT_CONFIG.networks['4g']).toBeDefined();
    expect(DEFAULT_CONFIG.networks['3g']).toBeDefined();
  });
});

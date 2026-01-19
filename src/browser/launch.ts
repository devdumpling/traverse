/**
 * Browser launch utilities.
 */

import { chromium, type Browser, type BrowserContext } from 'playwright';
import type { Result, DeviceConfig, NetworkConfig, BrowserError } from '../types.ts';
import { ok, err } from '../result.ts';

export interface LaunchOptions {
  readonly headless?: boolean;
  readonly device: DeviceConfig;
  readonly network?: NetworkConfig;
}

export const launchBrowser = async (): Promise<Result<Browser, BrowserError>> => {
  try {
    const browser = await chromium.launch({
      headless: true,
    });
    return ok(browser);
  } catch (e) {
    return err({
      code: 'LAUNCH_FAILED',
      message: e instanceof Error ? e.message : 'Failed to launch browser',
      cause: e,
    });
  }
};

export const createContext = async (
  browser: Browser,
  options: LaunchOptions
): Promise<Result<BrowserContext, BrowserError>> => {
  try {
    const contextOptions: Parameters<Browser['newContext']>[0] = {
      viewport: options.device.viewport,
      deviceScaleFactor: options.device.deviceScaleFactor,
      isMobile: options.device.isMobile,
      hasTouch: options.device.hasTouch,
    };
    
    if (options.device.userAgent) {
      contextOptions.userAgent = options.device.userAgent;
    }

    const context = await browser.newContext(contextOptions);
    return ok(context);
  } catch (e) {
    return err({
      code: 'LAUNCH_FAILED',
      message: e instanceof Error ? e.message : 'Failed to create browser context',
      cause: e,
    });
  }
};

export const closeBrowser = async (browser: Browser): Promise<void> => {
  await browser.close();
};

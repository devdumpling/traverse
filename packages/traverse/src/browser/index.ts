/**
 * Browser module exports.
 */

export { launchBrowser, createContext, closeBrowser, type LaunchOptions } from './launch.ts';
export {
  createCdpSession,
  enablePerformanceMetrics,
  getPerformanceMetrics,
  emulateNetworkConditions,
  clearBrowserCache,
  getHeapSize,
} from './cdp.ts';

/**
 * Capture module exports.
 */

export { captureCwv, captureNavigationTiming, type CwvCapture } from './cwv.ts';
export { captureResources, type ResourceCapture, type ResourceEntry, type ResourceTypeBreakdown } from './resources.ts';
export {
  captureSsr,
  captureRscNavigationPayloads,
  injectRscObserver,
  type SsrCapture,
  type InlineScript,
  type RscNavigationPayload,
} from './ssr.ts';
export {
  captureBlocking,
  injectLongTaskObserver,
  type BlockingCapture,
  type LongTask,
} from './blocking.ts';

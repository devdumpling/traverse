/**
 * Journey definition API.
 * 
 * Journeys are defined as async functions that receive a Traverse context.
 * This provides full Playwright power while capturing telemetry automatically.
 */

import type { Page } from 'playwright';
import type { CaptureContext } from './context.ts';

export interface StepContext {
  readonly page: Page;
  readonly capture: CaptureContext;
}

export type StepFn = (ctx: StepContext) => Promise<void>;

export interface JourneyContext {
  step: (name: string, fn: StepFn) => Promise<void>;
}

export type JourneyRunFn = (ctx: JourneyContext) => Promise<void>;

export interface JourneyDefinition {
  readonly name: string;
  readonly description: string;
  readonly run: JourneyRunFn;
}

/**
 * Define a journey for Traverse to execute.
 * 
 * @example
 * ```typescript
 * import { defineJourney } from 'traverse';
 * 
 * export default defineJourney({
 *   name: 'checkout-flow',
 *   description: 'Complete purchase from homepage to confirmation',
 *   
 *   async run(ctx) {
 *     await ctx.step('homepage', async ({ page, capture }) => {
 *       await page.goto('/');
 *       await capture.cwv();
 *     });
 * 
 *     await ctx.step('product', async ({ page, capture }) => {
 *       await page.click('[data-testid="product"]');
 *       await capture.cwv();
 *       await capture.navigation();
 *     });
 *   }
 * });
 * ```
 */
export const defineJourney = (definition: JourneyDefinition): JourneyDefinition => 
  definition;

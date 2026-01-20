/**
 * Example journey: Navigate through example.com and google.com
 */

import { defineJourney } from '../src/journey/index.ts';

export default defineJourney({
  name: 'example-journey',
  description: 'Simple multi-page navigation test',

  async run(ctx) {
    await ctx.step('homepage', async ({ page, capture }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await capture.cwv();
      await capture.resources();
      await capture.memory();
    });

    await ctx.step('about-page', async ({ page, capture }) => {
      // Example.com doesn't have internal links, so we'll navigate to another URL
      await page.goto('https://www.iana.org/domains/reserved');
      await page.waitForLoadState('networkidle');
      await capture.cwv();
      await capture.resources();
      await capture.navigation();
      await capture.memory();
    });
  },
});

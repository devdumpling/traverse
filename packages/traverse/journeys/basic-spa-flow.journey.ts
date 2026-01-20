/**
 * Journey: Basic React SPA navigation flow
 * Tests state-based navigation in a simple SPA
 */

import { defineJourney } from '../src/journey/index.ts';

export default defineJourney({
  name: 'basic-spa-product-flow',
  description: 'Navigate through basic React SPA: home → products → detail',

  async run(ctx) {
    // Step 1: Land on homepage (initial load)
    await ctx.step('homepage', async ({ page, capture }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await capture.navigation();
      await capture.cwv();
      await capture.resources();
      await capture.memory();
    });

    // Step 2: Click CTA to go to products (state change, no navigation)
    await ctx.step('products-list', async ({ page, capture }) => {
      await page.click('[data-testid="browse-products"]');
      await page.waitForSelector('[data-testid="product-card-1"]');
      await capture.cwv();
      await capture.resources();
      await capture.navigation();
      await capture.memory();
    });

    // Step 3: Click a product card (state change)
    await ctx.step('product-detail', async ({ page, capture }) => {
      await page.click('[data-testid="product-card-1"]');
      await page.waitForSelector('[data-testid="add-to-cart"]');
      await capture.cwv();
      await capture.resources();
      await capture.navigation();
      await capture.memory();
    });

    // Step 4: Navigate back (state change)
    await ctx.step('back-to-products', async ({ page, capture }) => {
      await page.click('[data-testid="back-link"]');
      await page.waitForSelector('[data-testid="product-card-1"]');
      await capture.cwv();
      await capture.resources();
      await capture.navigation();
      await capture.memory();
    });
  },
});

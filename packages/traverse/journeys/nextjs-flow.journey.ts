/**
 * Journey: Next.js App Router navigation flow
 * Tests soft navigation behavior in Next.js 16
 */

import { defineJourney } from '../src/journey/index.ts';

export default defineJourney({
  name: 'nextjs-product-flow',
  description: 'Navigate through Next.js app: home → products → detail',

  async run(ctx) {
    // Step 1: Land on homepage (initial load)
    await ctx.step('homepage', async ({ page, capture }) => {
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      await capture.cwv();
      await capture.resources();
      await capture.memory();
    });

    // Step 2: Click CTA to go to products (soft navigation)
    await ctx.step('products-list', async ({ page, capture }) => {
      await page.click('[data-testid="browse-products"]');
      await page.waitForSelector('[data-testid="product-card-1"]');
      await capture.cwv();
      await capture.resources();
      await capture.navigation();
      await capture.memory();
    });

    // Step 3: Click a product card (soft navigation)
    await ctx.step('product-detail', async ({ page, capture }) => {
      await page.click('[data-testid="product-card-1"]');
      await page.waitForSelector('[data-testid="add-to-cart"]');
      await capture.cwv();
      await capture.resources();
      await capture.navigation();
      await capture.memory();
    });

    // Step 4: Navigate back (soft navigation)
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

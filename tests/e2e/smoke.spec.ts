import { test, expect } from '@playwright/test';

// Gate G3: the dev URL serves the product. Replace the heading with your own.
test('the product loads and shows its name', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

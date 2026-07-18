import { test, expect } from '@playwright/test';

test('home page loads and nav routes to the catalog', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('DaleelEx');

  await page.getByRole('navigation').getByRole('link', { name: 'Catalog', exact: true }).click();
  await expect(page).toHaveURL(/\/services$/);
});

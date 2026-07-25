import { test, expect } from '@playwright/test';

test('unauthenticated visitor is redirected to the login page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('heading', { name: 'Sign in to DaleelEx' })).toBeVisible();
});

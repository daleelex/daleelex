import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // e2e/ holds Playwright specs (playwright.config.ts, run via `pnpm e2e`), which use
    // an incompatible test() API — Vitest's default glob would otherwise pick them up
    // too, since *.spec.ts matches both.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
});

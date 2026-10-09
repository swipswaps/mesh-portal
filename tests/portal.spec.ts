import { expect, test } from '@playwright/test';

// Backend-absent mode: the portal must render status + onboarding,
// never crash, never h-scroll on mobile. Mirrors the receipts-ocr
// evaluation (which caught a useRef pageerror and CORS spam there).
test('offline renders status, no crash, no h-scroll', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  // Deterministic offline: unroutable backends (headless shell ignores
  // cert errors, so live backends would flip the dots green here).
  await page.goto('/?api-mesh=https://127.0.0.1:9&api-dash=https://127.0.0.1:9', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(6000);
  await expect(page.getByRole('status')).toBeVisible();
  await expect(page.getByText(/Offline/)).toHaveCount(2);
  expect(errors, 'pageerrors: ' + errors.join('; ')).toHaveLength(0);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

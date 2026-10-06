import {test, expect} from '@playwright/test';
import {loadEnv} from 'vite';

const measurementId = loadEnv('production', process.cwd()).VITE_GA_MEASUREMENT_ID?.trim();
const analyticsEnabled = /^G-[A-Z0-9]+$/.test(measurementId || '');

test('analytics initializes on page load without a cookie notice', async ({page}) => {
  await page.route('https://www.googletagmanager.com/gtag/js?*', route => route.fulfill({
    contentType: 'application/javascript', body: 'window.analyticsScriptLoaded = true;',
  }));
  await page.goto('./');
  for (let visit = 0; visit < 2; visit++) {
    await expect(page.getByRole('button', {name: 'Open ROM file'})).toBeVisible();
    await expect(page.locator('#cc-main')).toHaveCount(0);
    await expect(page.getByRole('button', {name: 'Cookie settings', exact: true})).toHaveCount(0);
    const script = page.locator('script[src*="googletagmanager.com/gtag/js"]');
    await expect(script).toHaveCount(analyticsEnabled ? 1 : 0);
    if (analyticsEnabled) {
      await expect(script).toHaveAttribute('src', `https://www.googletagmanager.com/gtag/js?id=${measurementId}`);
      await page.waitForFunction(() => window.analyticsScriptLoaded === true);
      const configs = await page.evaluate(() => window.dataLayer.filter(args => args[0] === 'config').map(args => Array.from(args)));
      expect(configs).toEqual([['config', measurementId, expect.objectContaining({allow_google_signals: false})]]);
    }
    if (visit === 0) await page.reload();
  }
});

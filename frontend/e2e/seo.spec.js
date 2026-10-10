import {test, expect} from '@playwright/test';
import {readFileSync} from 'node:fs';

const {version} = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const title = 'Sensible Soccer ROM Editor for Mega Drive / Genesis';
const canonical = 'https://maidavale.org/sensi/';

test('publishes metadata and static content', async ({page, request}) => {
  await page.route('https://www.googletagmanager.com/gtag/js?*', route => route.fulfill({body: ''}));
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('./');
  await expect(page).toHaveTitle(title);
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText(title);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
  const description = await page.locator('meta[name="description"]').getAttribute('content');
  expect(description).toContain('Import team JSON');
  for (const [property, content] of Object.entries({'og:title': title, 'og:description': description, 'og:url': canonical, 'og:type': 'website'})) {
    await expect(page.locator(`meta[property="${property}"]`)).toHaveAttribute('content', content);
  }
  await expect(page.getByRole('button', {name: 'Open ROM file'})).toBeVisible();
  await expect(page.locator('footer')).toContainText(`v${version}`);
  for (const id of ['supported-versions', 'editable-data', 'how-to-use', 'common-questions']) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  const raw = await request.get('./');
  const html = await raw.text();
  expect(html).toContain('<h1>');
  expect(html).toContain('Supported versions');
  expect(html).not.toContain('%APP_VERSION%');
  expect(errors).toEqual([]);
});

test('instructions remain readable and styled without JavaScript', async ({browser, baseURL}) => {
  const context = await browser.newContext({javaScriptEnabled: false});
  const page = await context.newPage();
  try {
    await page.goto(baseURL);
    await expect(page.getByRole('heading', {level: 1})).toHaveText(title);
    await expect(page.getByText('The editor requires JavaScript.', {exact: false})).toBeVisible();
    await expect(page.getByRole('heading', {name: 'How to use the editor', exact: true})).toBeVisible();
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(7, 26, 7)');
    await expect(page.locator('footer')).toContainText(`v${version}`);
  } finally {
    await context.close();
  }
});

test('landing page fits a mobile viewport', async ({page}) => {
  await page.setViewportSize({width: 375, height: 812});
  await page.route('https://www.googletagmanager.com/gtag/js?*', route => route.fulfill({body: ''}));
  await page.goto('./');
  await expect(page.getByRole('button', {name: 'Open ROM file'})).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

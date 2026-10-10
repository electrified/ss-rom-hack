import {test, expect} from '@playwright/test';
import {readFileSync, mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = fileURLToPath(new URL('.', import.meta.url));
const romPath = resolve(here, '../../ssint_orig.md');
const screenshotDir = resolve(here, '../../docs/screenshots');

async function capture(page, name, locator) {
  mkdirSync(screenshotDir, {recursive: true});
  await page.evaluate(() => document.fonts.ready);
  await locator.screenshot({path: resolve(screenshotDir, `${name}.png`), animations: 'disabled'});
}

async function chooseFile(page, button, file) {
  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', {name: button}).click();
  await (await chooserPromise).setFiles(file);
}

async function openStockRom(page) {
  await page.route('https://www.googletagmanager.com/gtag/js?*', route => route.fulfill({body: ''}));
  await page.goto('./');
  await chooseFile(page, 'Open ROM file', romPath);
  await expect(page.getByRole('button', {name: 'national (51)'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'club (64)'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'custom (64)'})).toBeVisible();
}

async function setColour(page, label, colour) {
  await page.getByRole('button', {name: new RegExp(`^${label}:`)}).click();
  await page.getByRole('group', {name: `${label} colours`})
    .getByRole('button', {name: colour, exact: true}).click();
  await expect(page.getByRole('button', {name: `${label}: ${colour}`})).toBeVisible();
}

test('stock ROM documentation: edit, validate, export, import and download', async ({page}) => {
  const exceptions = [];
  page.on('pageerror', error => exceptions.push(error.message));
  await page.setViewportSize({width: 1440, height: 900});
  await page.route('https://www.googletagmanager.com/gtag/js?*', route => route.fulfill({body: ''}));
  await page.goto('./');
  await capture(page, '01-open-rom', page.locator('.upload-area'));
  await chooseFile(page, 'Open ROM file', romPath);
  await expect(page.getByRole('button', {name: 'national (51)'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'club (64)'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'custom (64)'})).toBeVisible();
  await capture(page, '02-team-browser', page.locator('.team-editor'));

  for (const category of ['club (64)', 'custom (64)', 'national (51)']) {
    await page.getByRole('button', {name: category}).click();
    await expect(page.locator('.team-list-item').first()).toBeVisible();
  }
  const firstTeam = (await page.locator('.team-list-item').first().innerText()).split('\n')[0];
  const search = page.getByRole('textbox', {name: 'Search teams'});
  await search.fill('NO SUCH TEAM');
  await expect(page.getByText('No matches', {exact: true})).toBeVisible();
  await search.fill(firstTeam);
  await expect(page.locator('.team-list-item')).toHaveCount(1);
  await page.locator('.team-list-item').first().click();
  await search.clear();

  const teamName = page.getByLabel('Team Name', {exact: true});
  await expect(teamName).toHaveValue('ALBANIA');
  const originalPosition = await page.getByLabel('Player 1: Position', {exact: true}).inputValue();
  await page.getByRole('button', {name: 'Help: Not used by custom or national teams.'}).click();
  await expect(page.getByRole('note')).toContainText('Not used by custom or national teams.');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('note')).toHaveCount(0);
  await teamName.fill('DEMO FC');
  await page.getByLabel('Country', {exact: true}).fill('DEMO');
  await page.getByLabel('Coach', {exact: true}).fill('EDITOR');
  await page.getByLabel('Formation', {exact: true}).selectOption('4-3-3');
  await page.getByLabel('Skill (0=best, 7=worst)', {exact: true}).selectOption('2');
  await page.getByLabel('Flag', {exact: true}).selectOption('1');
  await expect(teamName).toHaveValue('DEMO FC');
  await capture(page, '03-team-info', page.locator('.team-detail-sections .editor-section').first());
  await teamName.fill('BAD!');
  await expect(page.getByRole('button', {name: 'Download Modified ROM'})).toBeDisabled();
  await teamName.fill('DEMO FC');
  await expect(page.getByRole('button', {name: 'Download Modified ROM'})).toBeEnabled();

  await page.getByRole('button', {name: 'First Kit style: Stripes'}).click();
  await page.getByRole('button', {name: 'Second Kit style: Hoops'}).click();
  await page.getByRole('button', {name: /^First Kit: Shirt 1:/}).click();
  const colourOptions = page.getByRole('group', {name: 'First Kit: Shirt 1 colours'}).getByRole('button');
  await expect(colourOptions).toHaveCount(10);
  expect(await colourOptions.evaluateAll(buttons => buttons.map(button => ({
    name: button.getAttribute('aria-label'), colour: getComputedStyle(button).backgroundColor,
  })))).toEqual([
    {name: 'grey', colour: 'rgb(172, 172, 172)'},
    {name: 'white', colour: 'rgb(255, 255, 255)'},
    {name: 'black', colour: 'rgb(0, 0, 0)'},
    {name: 'orange', colour: 'rgb(255, 116, 0)'},
    {name: 'red', colour: 'rgb(255, 0, 0)'},
    {name: 'blue', colour: 'rgb(0, 0, 255)'},
    {name: 'dark red', colour: 'rgb(116, 0, 52)'},
    {name: 'light blue', colour: 'rgb(144, 144, 255)'},
    {name: 'green', colour: 'rgb(52, 144, 0)'},
    {name: 'yellow', colour: 'rgb(255, 255, 0)'},
  ]);
  await page.locator('.kit-sets').evaluate(element => element.scrollIntoView({block: 'start'}));
  await page.screenshot({path: resolve(screenshotDir, '04-colour-options.png'), animations: 'disabled'});
  await page.getByRole('group', {name: 'First Kit: Shirt 1 colours'})
    .getByRole('button', {name: 'red', exact: true}).click();
  await setColour(page, 'First Kit: Shirt 2', 'white');
  await setColour(page, 'First Kit: Shorts', 'blue');
  await setColour(page, 'First Kit: Socks', 'white');
  await setColour(page, 'Second Kit: Shirt 1', 'yellow');
  await setColour(page, 'Second Kit: Shirt 2', 'black');
  await setColour(page, 'Second Kit: Shorts', 'black');
  await setColour(page, 'Second Kit: Socks', 'yellow');
  await capture(page, '04-kits', page.locator('.kit-sets'));

  await expect(page.getByLabel('Player 2: Shirt number', {exact: true})).toHaveValue('12');
  await expect(page.getByLabel('Player 3: Shirt number', {exact: true})).toHaveValue('2');
  await page.getByLabel('Player 2: Shirt number', {exact: true}).fill('2');
  await page.getByLabel('Player 3: Shirt number', {exact: true}).fill('12');
  await page.getByLabel('Player 1: Name', {exact: true}).fill('DEMO KEEPER');
  await page.getByLabel('Player 1: Skin/Hair', {exact: true}).selectOption('white_blonde');
  await page.getByLabel('Player 1: Star player', {exact: true}).check();
  await capture(page, '05-players', page.locator('.player-table-wrapper'));

  await page.locator('.advanced-player-settings summary').click();
  await page.getByLabel('Player 1: Stored role', {exact: true}).selectOption('forward');
  await expect(page.getByText('Stored role: Forward')).toBeVisible();
  await capture(page, '06-advanced-roles', page.locator('.advanced-player-settings'));
  await page.getByLabel('Player 1: Use usual role', {exact: true}).click();
  await expect(page.getByLabel('Player 1: Stored role', {exact: true})).toHaveValue('goalkeeper');
  await page.locator('.advanced-player-settings summary').click();

  await page.getByLabel('Player 1: Position', {exact: true}).selectOption('sub:goalkeeper');
  await expect(page.getByRole('button', {name: 'Download Modified ROM'})).toBeDisabled();
  await capture(page, '07-validation', page.locator('.team-detail-sections'));
  await page.getByLabel('Player 1: Position', {exact: true}).selectOption(originalPosition);
  await page.getByLabel('Player 1: Shirt number', {exact: true}).fill('17');
  await expect(page.getByLabel('Player 1: Shirt number', {exact: true})).toHaveAttribute('aria-invalid', 'true');
  await expect(page.getByRole('button', {name: 'Download Modified ROM'})).toBeDisabled();
  await page.getByLabel('Player 1: Shirt number', {exact: true}).fill('1');
  await expect(page.getByRole('button', {name: 'Download Modified ROM'})).toBeEnabled();

  const jsonPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Export JSON'}).click();
  const jsonDownload = await jsonPromise;
  const exported = JSON.parse(readFileSync(await jsonDownload.path(), 'utf8'));
  expect(exported.national[0]).toMatchObject({
    team: 'DEMO FC', country: 'DEMO', coach: 'EDITOR', formation: '4-3-3', skill: 2, flag: 1,
    kit: {first: {style: 'vertical', shirt1: 'red', shirt2: 'white', shorts: 'blue', socks: 'white'},
      second: {style: 'horizontal', shirt1: 'yellow', shirt2: 'black', shorts: 'black', socks: 'yellow'}},
  });
  expect(exported.national[0].players[0]).toMatchObject({number: 1, name: 'DEMO KEEPER',
    position: originalPosition, role: 'goalkeeper', head: 'white_blonde', star: true});
  expect(exported.national[0].players[1].number).toBe(2);
  expect(exported.national[0].players[2].number).toBe(12);

  await chooseFile(page, 'Import JSON', {name: 'bad.json', mimeType: 'application/json',
    buffer: Buffer.from('{"national":{}}')});
  await expect(page.getByRole('alert')).toContainText('Import failed');
  await expect(teamName).toHaveValue('DEMO FC');
  exported.national[0].team = 'IMPORT FC';
  await chooseFile(page, 'Import JSON', {name: 'teams.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported))});
  await expect(page.getByText('Select a team from the list to edit')).toBeVisible();
  await page.locator('.team-list-item').first().click();
  await expect(teamName).toHaveValue('IMPORT FC');
  await capture(page, '08-imported-team', page.locator('.team-editor'));
  await capture(page, '09-download-rom', page.getByRole('heading', {name: 'Download ROM'}).locator('..'));

  const romPromise = page.waitForEvent('download');
  await page.getByRole('button', {name: 'Download Modified ROM'}).click();
  const romDownload = await romPromise;
  expect(romDownload.suggestedFilename()).toMatch(/^modified_rom_.*\.md$/);
  const modifiedRom = readFileSync(await romDownload.path());
  expect(modifiedRom.length).toBe(readFileSync(romPath).length);
  expect(modifiedRom.equals(readFileSync(romPath))).toBe(false);

  await page.getByRole('button', {name: 'Start Over (Open Another ROM)'}).click();
  await expect(page.getByRole('button', {name: 'Export JSON'})).toHaveCount(0);
  await chooseFile(page, 'Open ROM file', {name: 'modified.md', mimeType: 'application/octet-stream', buffer: modifiedRom});
  await page.locator('.team-list-item').first().click();
  await expect(teamName).toHaveValue('IMPORT FC');
  await expect(page.getByLabel('Player 1: Name', {exact: true})).toHaveValue('DEMO KEEPER');
  expect(exceptions).toEqual([]);
});

test('stock ROM documentation: mobile editor', async ({page}) => {
  await page.setViewportSize({width: 390, height: 844});
  await openStockRom(page);
  await page.locator('.team-list-item').first().click();
  await expect(page.getByLabel('Team Name', {exact: true})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  mkdirSync(screenshotDir, {recursive: true});
  await page.evaluate(async () => {
    await document.fonts.ready;
    document.querySelector('.team-editor').scrollIntoView({block: 'start'});
  });
  await page.screenshot({path: resolve(screenshotDir, '10-mobile-editor.png'), animations: 'disabled'});
});

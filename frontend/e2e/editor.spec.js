import { test, expect } from '@playwright/test';
import { fixtureRom, fixtureTeams } from '../src/lib/sslib/__tests__/fixtures.ts';
const rom = Buffer.from(fixtureRom());
const teams = fixtureTeams();
const upload = {name:'synthetic.md', mimeType:'application/octet-stream', buffer:rom};

test('serves football favicons at the configured site base', async ({page, request}) => {
  await page.route('https://www.googletagmanager.com/gtag/js?*', route => route.fulfill({body: ''}));
  await page.goto('./');
  const icons = await page.locator('link[rel~="icon"]').evaluateAll(nodes => nodes.map(node => ({
    href: node.href, type: node.getAttribute('type'),
  })));
  expect(icons.map(icon => icon.type)).toEqual(['image/svg+xml', 'image/png', null]);
  for (const icon of icons) {
    const response = await request.get(icon.href);
    expect(response.ok()).toBe(true);
  }
});

test('keyboard workflow, labels, validation, imports and immediate downloads', async ({page}) => {
  const exceptions=[];page.on('pageerror',e=>exceptions.push(e.message));
  await page.goto('./');
  // Native button activation opens the chooser without pointer input.
  const open=page.getByRole('button',{name:'Open ROM file'});await open.focus();
  const chooserPromise=page.waitForEvent('filechooser');await page.keyboard.press('Enter');const chooser=await chooserPromise;await chooser.setFiles(upload);
  const team=page.getByRole('button',{name:/ALPHA/});await expect(team).toBeVisible();await team.focus();await page.keyboard.press('Enter');
  await expect(page.getByLabel('Team Name',{exact:true})).toHaveValue('ALPHA');
  expect(await page.locator('.team-detail-sections input,.team-detail-sections select').evaluateAll(nodes=>nodes.filter(e=>!e.labels.length&&!e.getAttribute('aria-label')).length)).toBe(0);
  await page.getByLabel('Team Name',{exact:true}).fill('EDITED');
  await page.getByLabel('Coach',{exact:true}).fill('NEW COACH');
  await page.getByLabel('Country',{exact:true}).fill('USA');
  await page.getByLabel('Formation',{exact:true}).selectOption('4-3-3');
  await page.getByLabel('Skill (0=best, 7=worst)',{exact:true}).selectOption('2');
  await page.getByLabel('Flag',{exact:true}).selectOption('1');
  await page.getByLabel('Player 1: Name',{exact:true}).fill('NEW PLAYER');
  await page.getByLabel('Player 1: Star player',{exact:true}).check();
  const colour=page.getByRole('button',{name:'First Kit: Shirt 1: white',exact:true});await colour.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('group',{name:'First Kit: Shirt 1 colours'})).toBeVisible();
  const red=page.getByRole('button',{name:'red',exact:true});await red.focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('button',{name:'First Kit: Shirt 1: red',exact:true})).toBeFocused();
  await page.getByRole('button',{name:'First Kit style: Stripes'}).press('Enter');
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON',exact:true}).press('Enter');const download=await downloadPromise;
  const stream=await download.createReadStream();const chunks=[];for await (const chunk of stream)chunks.push(chunk);const result=JSON.parse(Buffer.concat(chunks).toString());
  expect(result.national[0]).toMatchObject({team:'EDITED',coach:'NEW COACH',country:'USA',formation:'4-3-3',skill:2,flag:1,kit:{first:{shirt1:'red',style:'vertical'}}});
  expect(result.national[0].players[0]).toMatchObject({name:'NEW PLAYER',star:true});
  await page.getByLabel('Player 1: Shirt number',{exact:true}).fill('17');await expect(page.getByRole('button',{name:'Download Modified ROM'})).toBeDisabled();
  await expect(page.getByLabel('Player 1: Shirt number',{exact:true})).toHaveAttribute('aria-invalid','true');
  await page.getByLabel('Player 1: Shirt number',{exact:true}).fill('1');
  const romDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download Modified ROM'}).press('Enter');await romDownload;
  await page.locator('.json-file-input').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"national":{},"club":[],"custom":[]}')});
  await expect(page.getByRole('alert')).toContainText('Import failed');await expect(page.getByLabel('Team Name',{exact:true})).toHaveValue('EDITED');
  await page.locator('.json-file-input').setInputFiles({name:'teams.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(teams))});
  await expect(page.getByText('Select a team from the list to edit')).toBeVisible();
  await team.focus();await page.keyboard.press('Enter');await expect(page.getByLabel('Team Name',{exact:true})).toHaveValue('ALPHA');
  expect(exceptions).toEqual([]);
});

for (const width of [1280, 375]) test(`combined positions, overrides and clash feedback at ${width}px`, async ({page}, testInfo) => {
  await page.setViewportSize({width, height: 900});
  await page.route('https://www.googletagmanager.com/gtag/js?*', route => route.fulfill({body: ''}));
  await page.goto('./');
  await page.locator('.file-input').setInputFiles(upload);
  await page.getByRole('button',{name:/ALPHA/}).click();
  const advanced = page.locator('.advanced-player-settings');
  await expect(advanced).not.toHaveAttribute('open');
  await expect(page.getByLabel('Player 6: Position',{exact:true})).toHaveValue('right_midfielder');
  await expect(page.getByLabel('Player 6: Stored role',{exact:true})).toHaveValue('forward');
  await page.getByLabel('Player 6: Position',{exact:true}).selectOption('centre_midfielder');
  await expect(page.getByText('Missing formation position: Right midfield.',{exact:true})).toBeVisible();
  await expect(page.getByText('Duplicate position: Centre midfield.',{exact:true})).toHaveCount(2);
  await expect(page.getByRole('button',{name:'Download Modified ROM'})).toBeDisabled();
  await page.getByLabel('Player 7: Position',{exact:true}).selectOption('right_midfielder');
  await expect(page.getByText('Missing formation position: Right midfield.',{exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Download Modified ROM'})).toBeEnabled();
  await expect(page.getByRole('columnheader', {name: 'Skin/Hair'})).toBeVisible();
  await expect(page.getByLabel('Player 6: Skin/Hair', {exact:true})).toHaveCount(1);
  await page.getByLabel('Formation',{exact:true}).selectOption({label:'Attack'});
  await expect(page.getByLabel('Formation',{exact:true})).toHaveValue('Attack');
  await page.getByLabel('Formation',{exact:true}).selectOption({label:'Defend'});
  await expect(page.getByLabel('Formation',{exact:true})).toHaveValue('Defend');
  await page.getByLabel('Formation',{exact:true}).selectOption('5-4-1');
  await expect(page.getByLabel('Player 6: Position',{exact:true}).locator('option:checked')).toHaveText('Defender (slot 7)');
  await expect(page.getByLabel('Player 6: Stored role',{exact:true})).toHaveValue('defender');
  await advanced.locator('summary').focus();
  await page.keyboard.press('Enter');
  await expect(advanced).toHaveAttribute('open','');
  await page.getByLabel('Player 6: Stored role',{exact:true}).selectOption('forward');
  await page.getByLabel('Player 6: Use usual role',{exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByLabel('Player 6: Stored role',{exact:true})).toHaveValue('defender');
  await page.getByLabel('Player 6: Position',{exact:true}).selectOption('sub:goalkeeper');
  await expect(page.getByLabel('Player 6: Stored role',{exact:true})).toHaveValue('goalkeeper');
  await expect(page.getByText('Missing formation position: Defender (slot 7).',{exact:true})).toBeVisible();
  await page.getByLabel('Player 6: Position',{exact:true}).selectOption('centre_midfielder');
  await expect(page.getByRole('button',{name:'Download Modified ROM'})).toBeEnabled();
  await advanced.locator('summary').click();
  await page.getByLabel('Player 6: Position',{exact:true}).scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('players.png')});
});

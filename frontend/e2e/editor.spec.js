import { test, expect } from '@playwright/test';
import { fixtureRom, fixtureTeams } from '../src/lib/sslib/__tests__/fixtures.ts';
const rom = Buffer.from(fixtureRom());
const teams = fixtureTeams();
const upload = {name:'synthetic.md', mimeType:'application/octet-stream', buffer:rom};

test('keyboard workflow, labels, validation, imports and immediate downloads', async ({page}) => {
  const exceptions=[];page.on('pageerror',e=>exceptions.push(e.message));
  await page.goto('./');
  const reject=page.getByRole('button',{name:'Reject optional cookies',exact:true});
  if (await reject.isVisible()) await reject.click();
  // Native button activation opens the chooser without pointer input.
  const open=page.getByRole('button',{name:'Open ROM file'});await open.focus();
  const chooserPromise=page.waitForEvent('filechooser');await page.keyboard.press('Enter');const chooser=await chooserPromise;await chooser.setFiles(upload);
  const team=page.getByRole('button',{name:/ALPHA/});await expect(team).toBeVisible();await team.focus();await page.keyboard.press('Enter');
  await expect(page.getByLabel('Team Name',{exact:true})).toHaveValue('ALPHA');
  expect(await page.locator('.team-detail-sections input,.team-detail-sections select').evaluateAll(nodes=>nodes.filter(e=>!e.labels.length&&!e.getAttribute('aria-label')).length)).toBe(0);
  await page.getByLabel('Team Name',{exact:true}).fill('EDITED');
  await page.getByLabel('Coach',{exact:true}).fill('NEW COACH');
  await page.getByLabel('Country',{exact:true}).fill('USA');
  await page.getByLabel('Tactic',{exact:true}).selectOption('4-3-3');
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
  expect(result.national[0]).toMatchObject({team:'EDITED',coach:'NEW COACH',country:'USA',tactic:'4-3-3',skill:2,flag:1,kit:{first:{shirt1:'red',style:'vertical'}}});
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

test('MOD playback loads local worklets, routes audio and closes its context on stop', async ({page}) => {
  await page.addInitScript(() => {
    window.reviewContexts=[];window.reviewPlayCount=0;window.reviewConnections=0;
    const Original=window.AudioContext;
    window.AudioContext=class extends Original {
      constructor(...args){super(...args);window.reviewContexts.push(this);}
      createGain(){const node=super.createGain();const connect=node.connect.bind(node);node.connect=(target,...args)=>{if(target===this.destination)window.reviewConnections++;return connect(target,...args);};return node;}
    };
    const post=MessagePort.prototype.postMessage;
    MessagePort.prototype.postMessage=function(value,...args){if(value?.cmd==='play')window.reviewPlayCount++;return post.call(this,value,...args);};
  });
  await page.goto('./');
  const reject=page.getByRole('button',{name:'Reject optional cookies',exact:true});if(await reject.isVisible())await reject.click();
  await page.evaluate(()=>{Math.random=()=>0;});
  await page.getByRole('button',{name:'▶ Play Music'}).click();
  await page.waitForFunction(()=>window.reviewPlayCount===1);
  expect(await page.evaluate(()=>window.reviewConnections)).toBe(1);
  await page.getByRole('button',{name:'⏹ Stop Music'}).click();
  await page.waitForFunction(()=>window.reviewContexts.every(context=>context.state==='closed'));
  await expect(page.getByRole('button',{name:'Open ROM file'})).toBeEnabled();
});

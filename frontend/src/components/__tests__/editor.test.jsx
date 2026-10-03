// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import App from '../../App';
import { fixtureRom, fixtureTeams } from '../../lib/sslib/__tests__/fixtures';
import { updateRom, decodeRom } from '../../lib/sslib';
vi.mock('../MusicPlayer', () => ({default: () => null}));
vi.mock('../../cookieConsent', () => ({showCookiePreferences: vi.fn()}));
const rom = fixtureRom();
let downloaded;
afterEach(() => {cleanup();vi.restoreAllMocks();});
function fileRead(selector, file) { fireEvent.change(document.querySelector(selector), {target:{files:[file]}}); }
async function setup(strict = true) {
  downloaded = null;
  URL.createObjectURL = vi.fn(blob => {downloaded=blob;return 'blob:test';});URL.revokeObjectURL=vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(() => {});
  Element.prototype.scrollIntoView=vi.fn();
  render(strict ? <React.StrictMode><App /></React.StrictMode> : <App />);
  fileRead('.file-input',{name:'test.md',size:rom.length,arrayBuffer:async()=>rom.buffer});
  await screen.findByRole('button',{name:/ALPHA/});
  fireEvent.click(screen.getByRole('button',{name:/ALPHA/}));
}
function readBlob(blob) {return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsArrayBuffer(blob);});}
async function exportJSON(){fireEvent.click(screen.getByRole('button',{name:'Export JSON'}));return JSON.parse(new TextDecoder().decode(await readBlob(downloaded)));}
function importJSON(value){fileRead('.json-file-input',{name:'teams.json',text:async()=>JSON.stringify(value)});}

describe('editor document lifecycle',()=>{
  for(const strict of [true,false]) it(`exports current edits immediately and imports replace them (strict=${strict})`,async()=>{
    await setup(strict);
    fireEvent.change(screen.getByLabelText('Team Name'),{target:{value:'EDITED'}});
    fireEvent.change(screen.getByLabelText('Player 1: Name'),{target:{value:'NEW NAME'}});
    fireEvent.change(screen.getByLabelText('Player 1: Shirt number'),{target:{value:'2'}});
    fireEvent.click(screen.getByLabelText('Player 1: Star player'));
    let d=await exportJSON();expect(d.national[0].team).toBe('EDITED');expect(d.national[0].players[0]).toMatchObject({name:'NEW NAME',number:2,star:true});
    fireEvent.click(screen.getByRole('button',{name:'Download Modified ROM'}));
    expect(decodeRom(new Uint8Array(await readBlob(downloaded))).national[0].players[0].name).toBe('NEW NAME');
    importJSON(fixtureTeams());await waitFor(()=>expect(document.querySelector('.team-detail-empty')).not.toBeNull());
    await act(async()=>{await new Promise(r=>setTimeout(r,650));});
    d=await exportJSON();expect(d).toEqual(fixtureTeams());
  });
  it('never downloads invalid latest values',async()=>{
    await setup();fireEvent.change(screen.getByLabelText('Player 1: Shirt number'),{target:{value:'17'}});
    expect(screen.getByRole('button',{name:'Download Modified ROM'}).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button',{name:'Download Modified ROM'}));expect(downloaded).toBeNull();
  });
  it('keeps the current document when malformed imports fail',async()=>{
    await setup();importJSON({national:{},club:[],custom:[]});await screen.findByRole('alert');expect(await exportJSON()).toEqual(fixtureTeams());
  });
  it('resets selected editor and rejects older ROM read completions',async()=>{
    await setup();let release;fileRead('.file-input',{name:'old.md',arrayBuffer:()=>new Promise(r=>release=r)});
    const d=fixtureTeams();d.national[0].team='NEW';const replacement=updateRom(rom,d);
    fileRead('.file-input',{name:'new.md',arrayBuffer:async()=>replacement.buffer});
    await screen.findByRole('button',{name:/NEW/});expect(document.querySelector('.team-detail-empty')).not.toBeNull();
    await act(async()=>release(rom.buffer));expect((await exportJSON()).national[0].team).toBe('NEW');
    fireEvent.click(screen.getByRole('button',{name:/NEW/}));expect(screen.getByLabelText('Team Name').value).toBe('NEW');
  });
  it('ignores JSON reads after a ROM replacement and ROM reads after reset',async()=>{
    await setup();let releaseJSON;fileRead('.json-file-input',{name:'old.json',text:()=>new Promise(r=>releaseJSON=r)});
    const d=fixtureTeams();d.national[0].team='NEW';const replacement=updateRom(rom,d);fileRead('.file-input',{name:'new.md',arrayBuffer:async()=>replacement.buffer});
    await screen.findByRole('button',{name:/NEW/});await act(async()=>releaseJSON(JSON.stringify(fixtureTeams())));expect((await exportJSON()).national[0].team).toBe('NEW');
    let releaseROM;fileRead('.file-input',{name:'old.md',arrayBuffer:()=>new Promise(r=>releaseROM=r)});
    fireEvent.click(screen.getByRole('button',{name:/Start Over/}));await act(async()=>releaseROM(rom.buffer));expect(screen.queryByRole('button',{name:'Export JSON'})).toBeNull();
  });
});

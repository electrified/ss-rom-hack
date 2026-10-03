import { describe, it, expect } from 'vitest';
import { fixtureRom, fixtureTeams } from './fixtures';
import { decodeRom, updateRom, validateTeams, extractRomStructure } from '../index';
import { findPointerTable, chainWalkRegion, decode5bitString } from '../decode';
import { encode5bitString } from '../encode';
import { availableEnd } from '../layout';
const rom = fixtureRom();
const structure = extractRomStructure(rom);

describe('ROM safety', () => {
  it('decodes independent synthetic bytes and preserves an unchanged ROM exactly', () => {
    expect(decodeRom(rom)).toEqual(fixtureTeams());
    expect(updateRom(rom, fixtureTeams())).toEqual(rom);
  });
  it('round-trips edits without name heuristics and repairs checksum', () => {
    const d = fixtureTeams();
    for (const cat of ['national','club','custom'] as const) { d[cat][0].team = ''; d[cat][0].country = 'USA'; d[cat][0].coach = ''; d[cat][0].players[0].name = ''; }
    d.national[0].players[1].star = true;
    const result = updateRom(rom, d);
    expect(decodeRom(result)).toEqual(d);
    const view = new DataView(result.buffer); let sum = 0;
    for (let i = 512; i + 1 < result.length; i += 2) sum = (sum + view.getUint16(i)) & 65535;
    expect(view.getUint16(0x18e)).toBe(sum);
    expect(result.slice(-2)).toEqual(rom.slice(-2));
  });
  it('rejects NUL at every text field and the encoder boundary', () => {
    for (let i = 0; i < 19; i++) {
      const d = fixtureTeams(), t = d.national[0];
      if (i < 3) t[(['team','country','coach'] as const)[i]] = 'A\0B'; else t.players[i - 3].name = 'A\0B';
      expect(validateTeams(structure, d).valid).toBe(false);
      expect(() => updateRom(rom, d)).toThrow();
    }
    expect(() => encode5bitString('\0')).toThrow();
  });
  it('returns errors for malformed shapes, missing fields and invalid primitives', () => {
    for (const d of [null, 1, [], {}, {national: null, club: [], custom: []}]) expect(validateTeams(structure, d).valid).toBe(false);
    for (const [field, values] of Object.entries({team:[null,42,{},[]], kit:[null,{}, {first:{}}], skill:[true,1.5,'3',null,NaN,Infinity], flag:[false,2,null], tactic:['toString','__proto__',null,8]})) {
      for (const value of values) { const d: any = fixtureTeams(); d.national[0][field] = value; expect(validateTeams(structure, d).valid, `${field} ${value}`).toBe(false); }
    }
    for (const field of ['team','country','coach','kit','players']) { const d: any = fixtureTeams(); delete d.national[0][field]; expect(validateTeams(structure,d).valid).toBe(false); }
    for (const [field,value] of [['star','false'],['number',1.5],['number','1'],['number',undefined],['role','constructor']]) { const d: any=fixtureTeams();d.national[0].players[0][field as string]=value;expect(validateTeams(structure,d).valid).toBe(false); }
  });
  it('enforces canonical text lengths and character set', () => {
    for (const [field,n] of [['team',25],['country',19],['coach',25]] as const) {
      const d=fixtureTeams();d.national[0][field]='A'.repeat(n);expect(validateTeams(structure,d).valid).toBe(true);
      d.national[0][field]+='A';expect(validateTeams(structure,d).valid).toBe(false);
    }
    const d=fixtureTeams();d.national[0].team='ß'.repeat(13);expect(validateTeams(structure,d).valid).toBe(false);
  });
  it('preflights capacity and handles zero padding to EOF including odd final bytes', () => {
    const p=findPointerTable(rom), r=rom.slice(0,p.custEnd), d=fixtureTeams();
    expect(validateTeams(extractRomStructure(r),d).valid).toBe(true);
    d.national[0].coach='LONG COACH';expect(validateTeams(extractRomStructure(r),d).valid).toBe(false);expect(() => updateRom(r,d)).toThrow(/overflows/);
    for (const odd of [0,1]) { const zero=new Uint8Array(rom.length+odd);zero.set(r);expect(availableEnd(zero,p.custEnd)).toBe(zero.length-odd);expect(() => updateRom(zero,d)).not.toThrow(); }
  });
  it('rejects truncated ROMs, invalid positions and missing terminators', () => {
    const p=findPointerTable(rom);
    for (const n of [1,p.custStart+2,p.custEnd-1]) expect(() => decodeRom(rom.slice(0,n))).toThrow();
    expect(() => chainWalkRegion(new Uint8Array([0,160]),0,160)).toThrow();
    for (const value of [0,0xffff]) { const r=rom.slice();new DataView(r.buffer).setUint16(p.natStart+2,value);expect(() => decodeRom(r)).toThrow(); }
    expect(() => decode5bitString(new Uint8Array([0xff]),0)).toThrow();
    expect(() => decode5bitString(new Uint8Array([0x08]),0)).toThrow();
  });
  it('rejects writer calls that bypass UI validation', () => {
    const d=fixtureTeams();d.national[0].players[0].number=17;expect(() => updateRom(rom,d)).toThrow(/number/);
    d.national[0].players[0].number=1;d.national[0].players[0].position='sub';expect(() => updateRom(rom,d)).toThrow(/formation/);
  });
});

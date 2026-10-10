import { describe, it, expect } from 'vitest';
import { fixtureRom, fixtureTeams } from './fixtures';
import { decodeRom, updateRom, validateTeams, extractRomStructure } from '../index';
import { findPointerTable, chainWalkRegion, decode5bitString } from '../decode';
import { encode5bitString } from '../encode';
import { availableEnd, encodedSize } from '../layout';
import { normalizeTeams, TeamDataError } from '../normalize';
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
  it('preserves reserved team and player attribute bits when editing owned fields', () => {
    const source = fixtureRom();
    const start = findPointerTable(source).natStart;
    source[start + 21] |= 0xC6;
    source[start + 25] |= 0xA0;
    const teams = decodeRom(source);
    teams.national[0].skill = 5;
    teams.national[0].flag = 1;
    teams.national[0].players[0].head = 'white_blonde';
    teams.national[0].players[0].star = true;

    const result = updateRom(source, teams);
    expect(result[start + 21]).toBe(0xC6 | (5 << 3) | 1);
    expect(result[start + 25]).toBe(0xA0 | 0x10 | 1);
    expect(decodeRom(result)).toEqual(teams);
    expect(source[start + 21] & 0xC6).toBe(0xC6);
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
    for (const [field, values] of Object.entries({team:[null,42,{},[]], kit:[null,{}, {first:{}}], skill:[true,1.5,'3',null,NaN,Infinity], flag:[false,2,null], formation:['toString','__proto__',null,8]})) {
      for (const value of values) { const d: any = fixtureTeams(); d.national[0][field] = value; expect(validateTeams(structure, d).valid, `${field} ${value}`).toBe(false); }
    }
    for (const field of ['team','country','coach','kit','players']) { const d: any = fixtureTeams(); delete d.national[0][field]; expect(validateTeams(structure,d).valid).toBe(false); }
    for (const [field,value] of [['star','false'],['number',1.5],['number','1'],['number',undefined],['role','constructor']]) { const d: any=fixtureTeams();d.national[0].players[0][field as string]=value;expect(validateTeams(structure,d).valid).toBe(false); }
  });
  it('keeps multiple validation issues attached to their team and player', () => {
    const teams = fixtureTeams();
    teams.national[0].team = 'BAD!';
    teams.national[0].players[0].number = 17;
    teams.club[0].kit.first.shirt1 = 'brown';
    try {
      normalizeTeams(teams);
      throw new Error('Expected validation to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(TeamDataError);
      expect((error as TeamDataError).issues).toEqual([
        { category: 'national', team: 0, message: 'team: invalid chars (use uppercase A-Z, space, dash, apostrophe, period)' },
        { category: 'national', team: 0, player: 0, message: 'number must be an integer 1-16' },
        { category: 'club', team: 0, message: expect.stringContaining('first kit shirt1') },
      ]);
    }
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
  it('uses the final zero word but stops before the following nonzero data', () => {
    const tight = fixtureRom({padding: 2});
    const teams = decodeRom(tight);
    const originalSize = encodedSize(teams);
    const originalName = teams.national[0].team;
    const suffix = Array.from({length: 10}, (_, i) => 'A'.repeat(i + 1))
      .find(value => {
        teams.national[0].team = originalName + value;
        return encodedSize(teams) === originalSize + 2;
      });
    if (!suffix) throw new Error('Fixture has no two-byte growth case');
    teams.national[0].team = originalName + suffix;
    expect(extractRomStructure(tight).capacity).toBe(originalSize + 2);
    expect(decodeRom(updateRom(tight, teams))).toEqual(teams);

    const noPadding = fixtureRom({padding: 0});
    expect(() => updateRom(noPadding, teams)).toThrow(/overflows/);
  });
  it('updates region boundaries and clears bytes left by shorter text', () => {
    const source = fixtureRom({padding: 0});
    const before = findPointerTable(source);
    const teams = decodeRom(source);
    teams.national[0].team = 'A';
    teams.national[0].players[0].name = '';
    teams.club[0].team = 'LONGER CLUB NAME';
    teams.custom[0].team = 'C';
    teams.custom[0].players[0].name = '';
    const result = updateRom(source, teams);
    const after = findPointerTable(result);

    expect(after.natEnd + 2).toBe(after.clubStart);
    expect(after.clubEnd + 2).toBe(after.custStart);
    expect(after.custEnd).toBeLessThan(before.custEnd);
    expect(result.slice(after.custEnd, before.custEnd)).toEqual(new Uint8Array(before.custEnd - after.custEnd));
    expect(result.slice(before.custEnd)).toEqual(source.slice(before.custEnd));
    expect(decodeRom(result)).toEqual(teams);
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

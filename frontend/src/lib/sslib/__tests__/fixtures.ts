import type { TeamsJson } from '../types';

const positions = ['goalkeeper', 'right_back', 'left_back', 'centre_back', 'defender',
  'right_midfielder', 'centre_midfielder', 'left_midfielder', 'midfielder', 'forward', 'second_forward',
  'sub', 'sub', 'sub', 'sub', 'sub'];
const categories = ['national', 'club', 'custom'] as const;
const charset = "\0ABCDEFGHIJKLMNOPQRSTUVWXYZ -'.";

export function fixtureTeams(): TeamsJson {
  const team = (name: string) => {
    const kit = {style: 'plain', shirt1: 'white', shirt2: 'red', shorts: 'blue', socks: 'white'};
    return {team: name, country: 'USA', coach: 'A', formation: '4-4-2', skill: 3, flag: 0,
      kit: {first: {...kit}, second: {...kit}},
      players: positions.map((position, i) => ({name: `PLAYER ${String.fromCharCode(65 + i)}`,
        number: i + 1, position, role: i === 0 ? 'goalkeeper' : 'forward', head: 'white_dark'}))};
  };
  return {national: [team('ALPHA')], club: [team('BETA')], custom: [team('GAMMA')]} as TeamsJson;
}

export function fixtureRom(options: {padding?: number; eofZero?: boolean; odd?: boolean} = {}): Uint8Array {
  const teams = fixtureTeams();
  const rom = new Uint8Array(0x22000);
  const table = 0x1000;
  const starts: number[] = [], ends: number[] = [];
  let cursor = 0x20000;
  const write16 = (offset: number, value: number) => { rom[offset] = value >>> 8; rom[offset + 1] = value & 255; };
  const write32 = (offset: number, value: number) => { write16(offset, value >>> 16); write16(offset + 2, value); };
  for (const category of categories) {
    starts.push(cursor);
    for (const team of teams[category]) {
      const attrs = new Uint8Array(150);
      const attrView = new DataView(attrs.buffer);
      attrs.set([0, 2, 10, 11, 2, 0, 2, 10, 11, 2], 8);
      attrs[21] = 3 << 3;
      for (let i = 0; i < 16; i++) {
        attrs[24 + 8 * i] = ((i < 11 ? i : 15) << 4) | i;
        attrs[25 + 8 * i] = i === 0 ? 0 : 12;
      }
      const names = [team.team, team.country, team.coach, ...team.players.map(p => p.name)];
      let bits = '';
      const offsets = [2, 4, 6, ...Array.from({length: 16}, (_, i) => 22 + 8 * i)];
      names.forEach((name, i) => {
        attrView.setUint16(offsets[i], ((150 + Math.floor(bits.length / 16) * 2) << 5) | (bits.length % 16));
        for (const char of name + '\0') bits += charset.indexOf(char).toString(2).padStart(5, '0');
      });
      bits += '0'.repeat((16 - bits.length % 16) % 16);
      const textBytes = new Uint8Array(bits.length / 8);
      for (let i = 0; i < textBytes.length; i++) textBytes[i] = Number.parseInt(bits.slice(i * 8, i * 8 + 8), 2);
      const blockSize = 150 + textBytes.length;
      attrView.setUint16(0, blockSize);
      rom.set(attrs, cursor);
      rom.set(textBytes, cursor + attrs.length);
      cursor += blockSize;
    }
    ends.push(cursor);
    if (category !== 'custom') { cursor += 2; }
  }
  for (let i = 0; i < 6; i++) write32(table + i * 4, [starts[0], starts[1], starts[2], ends[0], ends[1], ends[2]][i]);
  const padding = options.padding ?? 512;
  const totalLength = cursor + padding + (options.eofZero ? 0 : 2) + (options.odd ? 1 : 0);
  const result = new Uint8Array(totalLength);
  result.set(rom.subarray(0, cursor));
  if (!options.eofZero) result.set([0x12, 0x34], cursor + padding);
  const view = new DataView(result.buffer);
  let checksum = 0;
  for (let i = 512; i + 1 < result.length; i += 2) checksum = (checksum + view.getUint16(i)) & 0xffff;
  view.setUint16(0x18e, checksum);
  return result;
}

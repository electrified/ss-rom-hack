import {
  CHARSET, ATTR_SIZE, KNOWN_COUNTRIES,
  COLOUR_NAMES, STYLE_NAMES, HEAD_NAMES, ROLE_NAMES, POSITION_NAMES, TACTIC_NAMES,
} from './constants.js';
import { encode5bitString, pack5bitValues } from './encode.js';
import type { Kit, PointerTable, TeamsJson } from './types.js';

/**
 * Decode a single 5-bit packed null-terminated string.
 * Returns [decoded_string, next_bit_position].
 */
export function decode5bitString(data: Uint8Array, byteOffset: number, bitStart = 0): [string, number] {
  const result: string[] = [];
  let bitPos = bitStart;
  while (true) {
    const absBit = byteOffset * 8 + bitPos;
    const byteIdx = Math.floor(absBit / 8);
    const bitIdx = absBit % 8;
    if (byteIdx >= data.length) break;
    // Treat out-of-bounds bytes as 0 (safe — real ROM has ample data beyond each string)
    const b0 = data[byteIdx];
    const b1 = byteIdx + 1 < data.length ? data[byteIdx + 1] : 0;
    const b2 = byteIdx + 2 < data.length ? data[byteIdx + 2] : 0;
    const val24 = (b0 << 16) | (b1 << 8) | b2;
    const charVal = (val24 >> (24 - bitIdx - 5)) & 0x1F;
    if (charVal === 0) {
      return [result.join(''), bitPos + 5];
    }
    if (charVal >= CHARSET.length) break;
    result.push(CHARSET[charVal]);
    bitPos += 5;
    if (result.length > 30) break;
  }
  return [result.join(''), bitPos];
}

/**
 * Decode the 16 player attribute records from the attribute block.
 * Each player has an 8-byte record starting at blockOffset + 22.
 */
export function decodePlayerAttrs(rom: Uint8Array, blockOffset: number): Array<{
  number: number; position: string | number; role: string | number; head: string | number; star?: boolean
}> {
  const players = [];
  const base = blockOffset + 22;
  for (let i = 0; i < 16; i++) {
    const recOff = base + i * 8 + 2; // skip 2-byte packed text position
    const posByte = rom[recOff];
    const appByte = rom[recOff + 1];
    const posSlot = (posByte >> 4) & 0x0F;
    const roleVal = (appByte >> 2) & 0x03;
    const headVal = appByte & 0x03;
    const star = Boolean((appByte >> 4) & 0x01);
    const p: { number: number; position: string | number; role: string | number; head: string | number; star?: boolean } = {
      number: (posByte & 0x0F) + 1,
      position: POSITION_NAMES[posSlot] ?? posSlot,
      role: ROLE_NAMES[roleVal] ?? roleVal,
      head: HEAD_NAMES[headVal] ?? headVal,
    };
    if (star) p.star = true;
    players.push(p);
  }
  return players;
}

/**
 * Decode kit attributes from bytes 8-17 of the attribute block.
 */
export function decodeKitAttrs(rom: Uint8Array, blockOffset: number): Kit {
  const b = blockOffset + 8;
  const colour = (v: number) => COLOUR_NAMES[v] ?? v;
  const style = (v: number) => STYLE_NAMES[v] ?? v;
  return {
    first: {
      style: style(rom[b]),
      shirt1: colour(rom[b + 1]),
      shirt2: colour(rom[b + 2]),
      shorts: colour(rom[b + 3]),
      socks: colour(rom[b + 4]),
    },
    second: {
      style: style(rom[b + 5]),
      shirt1: colour(rom[b + 6]),
      shirt2: colour(rom[b + 7]),
      shorts: colour(rom[b + 8]),
      socks: colour(rom[b + 9]),
    },
  };
}

/**
 * Decode team-level attributes from bytes 18-21 of the attribute block.
 */
export function decodeTeamAttrs(rom: Uint8Array, blockOffset: number): { tactic: string; skill: number; flag: number } {
  const tacticVal = rom[blockOffset + 19];
  return {
    tactic: TACTIC_NAMES[tacticVal] ?? String(tacticVal),
    skill: (rom[blockOffset + 21] >> 3) & 0x07,
    flag: rom[blockOffset + 21] & 0x01,
  };
}

/**
 * Decode a full team block at the given ROM offset (text start).
 */
export function decodeTeamBlock(rom: Uint8Array, offset: number): {
  offset: number; team: string; country: string; coach: string;
  players: string[]; textBits: number; textEnd: number;
} {
  let bitPos = 0;
  let teamName: string, country: string, manager: string;
  [teamName, bitPos] = decode5bitString(rom, offset, bitPos);
  [country, bitPos] = decode5bitString(rom, offset, bitPos);
  [manager, bitPos] = decode5bitString(rom, offset, bitPos);
  const players: string[] = [];
  for (let i = 0; i < 16; i++) {
    let player: string;
    [player, bitPos] = decode5bitString(rom, offset, bitPos);
    players.push(player);
  }
  const textByteEnd = offset + Math.ceil(bitPos / 8);
  return {
    offset,
    team: teamName,
    country,
    coach: manager,
    players,
    textBits: bitPos,
    textEnd: textByteEnd,
  };
}

/**
 * Find the ROM offset of a 5-bit encoded team name.
 */
export function findTeamOffset(rom: Uint8Array, teamName: string): number {
  const values = Array.from(teamName.toUpperCase()).map(c => CHARSET.indexOf(c));
  const { bytes: packed } = pack5bitValues(values);
  const searchLen = Math.min(packed.length, 6);

  function findBytes(haystack: Uint8Array, needle: Uint8Array, start: number, end: number): number {
    for (let i = start; i <= end - needle.length; i++) {
      let match = true;
      for (let j = 0; j < needle.length; j++) {
        if (haystack[i + j] !== needle[j]) { match = false; break; }
      }
      if (match) return i;
    }
    return -1;
  }

  let pos = findBytes(rom, packed.slice(0, searchLen), 0x020000, 0x030000);
  if (pos === -1 && searchLen > 3) {
    pos = findBytes(rom, packed.slice(0, 3), 0x020000, 0x030000);
  }
  return pos;
}

/**
 * Scan the ROM for team blocks by looking for valid team+country sequences.
 * Returns a list of offsets.
 */
export function autoFindTeams(rom: Uint8Array, scanStart = 0x020000, scanEnd = 0x030000): number[] {
  const found: number[] = [];
  let offset = scanStart;
  while (offset < scanEnd) {
    const [name, bits1] = decode5bitString(rom, offset);
    if (!name || name.length < 3 || name.length > 25) { offset++; continue; }
    const [country, bits2] = decode5bitString(rom, offset, bits1);
    if (!KNOWN_COUNTRIES.has(country)) { offset++; continue; }
    const [manager, bits3] = decode5bitString(rom, offset, bits2);
    if (!manager || manager.length < 3 || manager.length > 25) { offset++; continue; }
    const [player1, bits4] = decode5bitString(rom, offset, bits3);
    if (!player1 || player1.length < 3 || player1.length > 25) { offset++; continue; }
    found.push(offset);
    const textEndByte = offset + Math.ceil(bits4 / 8);
    offset = textEndByte + 100;
  }
  return found;
}

/**
 * Find the 6-longword pointer table for the 3 team regions.
 */
export function findPointerTable(rom: Uint8Array): PointerTable {
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
  const textOffsets = autoFindTeams(rom);
  if (!textOffsets.length) throw new Error('No teams found in ROM');

  function findBytes(needle: Uint8Array, start: number, end: number): number {
    for (let i = start; i <= end - needle.length; i++) {
      let match = true;
      for (let j = 0; j < needle.length; j++) {
        if (rom[i + j] !== needle[j]) { match = false; break; }
      }
      if (match) return i;
    }
    return -1;
  }

  for (const textOff of textOffsets) {
    const blockStart = textOff - 150;
    // Build 4-byte big-endian representation of blockStart
    const target = new Uint8Array(4);
    new DataView(target.buffer).setUint32(0, blockStart, false);

    let pos = 0;
    while (pos < 0x30000) {
      const found = findBytes(target, pos, 0x30000);
      if (found === -1) break;
      for (let slot = 0; slot < 3; slot++) {
        const tableBase = found - slot * 4;
        if (tableBase < 0) continue;
        if (tableBase + 24 > rom.length) continue;
        const natS = view.getUint32(tableBase + 0, false);
        const clubS = view.getUint32(tableBase + 4, false);
        const custS = view.getUint32(tableBase + 8, false);
        const natE = view.getUint32(tableBase + 12, false);
        const clubE = view.getUint32(tableBase + 16, false);
        const custE = view.getUint32(tableBase + 20, false);
        if (
          natS < clubS && clubS < custS &&
          natS < natE && natE <= clubS &&
          clubS < clubE && clubE <= custS &&
          custS < custE &&
          natS > 0x010000 && natS < 0x040000
        ) {
          return {
            natStart: natS, clubStart: clubS, custStart: custS,
            natEnd: natE, clubEnd: clubE, custEnd: custE,
            tableBase,
          };
        }
      }
      pos = found + 1;
    }
  }

  throw new Error('Could not find pointer table in ROM code area');
}

/**
 * Chain-walk team blocks within a region using the 2-byte BE size word.
 * Returns list of block start offsets.
 */
export function chainWalkRegion(rom: Uint8Array, regionStart: number, regionEnd: number): number[] {
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
  const blocks: number[] = [];
  let pos = regionStart;
  while (pos < regionEnd) {
    const sz = view.getUint16(pos, false);
    if (sz < 160 || sz > 500) {
      throw new Error(`Bad block size ${sz} at 0x${pos.toString(16).toUpperCase()}`);
    }
    blocks.push(pos);
    pos += sz;
  }
  if (pos !== regionEnd) {
    throw new Error(`Chain walk ended at 0x${pos.toString(16).toUpperCase()}, expected 0x${regionEnd.toString(16).toUpperCase()}`);
  }
  return blocks;
}

/**
 * Decode all teams in a region.
 */
export function decodeRegion(rom: Uint8Array, regionStart: number, regionEnd: number) {
  const blocks = chainWalkRegion(rom, regionStart, regionEnd);
  return blocks.map(blockOff => {
    const textOff = blockOff + 150;
    const info = decodeTeamBlock(rom, textOff);
    return {
      ...info,
      blockOffset: blockOff,
      kit: decodeKitAttrs(rom, blockOff),
      teamAttrs: decodeTeamAttrs(rom, blockOff),
      playerAttrs: decodePlayerAttrs(rom, blockOff),
    };
  });
}

/**
 * Decode all teams from a ROM.
 */
export function decodeRom(romBytes: Uint8Array): TeamsJson {
  const ptrs = findPointerTable(romBytes);

  const categories = [
    ['national', ptrs.natStart, ptrs.natEnd],
    ['club', ptrs.clubStart, ptrs.clubEnd],
    ['custom', ptrs.custStart, ptrs.custEnd],
  ] as const;

  const output: TeamsJson = { national: [], club: [], custom: [] };

  for (const [catName, start, end] of categories) {
    const teams = decodeRegion(romBytes, start, end);
    output[catName] = teams.map(t => {
      const players = t.players.map((name, j) => {
        const pa = t.playerAttrs[j];
        const pd: { name: string; number: number; position: string | number; role: string | number; head: string | number; star?: boolean } = {
          name,
          number: pa.number,
          position: pa.position,
          role: pa.role,
          head: pa.head,
        };
        if (pa.star) pd.star = true;
        return pd;
      });
      return {
        team: t.team,
        country: t.country,
        coach: t.coach,
        tactic: t.teamAttrs.tactic,
        skill: t.teamAttrs.skill,
        flag: t.teamAttrs.flag,
        kit: t.kit,
        players,
      };
    });
  }

  return output;
}

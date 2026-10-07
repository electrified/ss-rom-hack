import {
  CHARSET, ATTR_SIZE, ATTR_OFFSETS,
  COLOUR_NAMES, STYLE_NAMES, HEAD_NAMES, ROLE_NAMES, POSITION_NAMES, FORMATION_NAMES,
} from './constants.js';
import type { Kit, PointerTable, TeamsJson } from './types.js';

/**
 * Decode a single 5-bit packed null-terminated string.
 * Returns [decoded_string, next_bit_position].
 */
export function decode5bitString(data: Uint8Array, byteOffset: number, bitStart = 0, bitLimit = data.length * 8): [string, number] {
  let pos = byteOffset * 8 + bitStart;
  if (!Number.isInteger(pos) || pos < 0 || bitLimit > data.length * 8 || pos > bitLimit) throw new Error('Text position outside ROM/block');
  const result: string[] = [];
  while (pos + 5 <= bitLimit) {
    let value = 0;
    for (let bit = pos; bit < pos + 5; bit++) value = (value << 1) | ((data[Math.floor(bit / 8)] >> (7 - bit % 8)) & 1);
    pos += 5;
    if (value === 0) return [result.join(''), pos - byteOffset * 8];
    if (value >= CHARSET.length) throw new Error('Invalid packed character');
    result.push(CHARSET[value]);
  }
  throw new Error('Unterminated packed string');
}

function requireRange(rom: Uint8Array, offset: number, size: number): void {
  if (!Number.isInteger(offset) || offset < 0 || offset + size > rom.length) throw new Error('Truncated attribute block');
}

/**
 * Decode the 16 player attribute records from the attribute block.
 * Each player has an 8-byte record starting at blockOffset + 22.
 */
export function decodePlayerAttrs(rom: Uint8Array, blockOffset: number): Array<{
  number: number; position: string; role: string; head: string; star?: boolean
}> {
  requireRange(rom, blockOffset, ATTR_SIZE);
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
    const p: { number: number; position: string; role: string; head: string; star?: boolean } = {
      number: (posByte & 0x0F) + 1,
      position: POSITION_NAMES[posSlot] ?? `Unknown (${posSlot})`,
      role: ROLE_NAMES[roleVal] ?? `Unknown (${roleVal})`,
      head: HEAD_NAMES[headVal] ?? `Unknown (${headVal})`,
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
  requireRange(rom, blockOffset, 18);
  const b = blockOffset + 8;
  const colour = (v: number) => COLOUR_NAMES[v] ?? `Unknown (${v})`;
  const style = (v: number) => STYLE_NAMES[v] ?? `Unknown (${v})`;
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
export function decodeTeamAttrs(rom: Uint8Array, blockOffset: number): { formation: string; skill: number; flag: number } {
  requireRange(rom, blockOffset, 22);
  const formationVal = rom[blockOffset + 19];
  return {
    formation: FORMATION_NAMES[formationVal] ?? String(formationVal),
    skill: (rom[blockOffset + 21] >> 3) & 0x07,
    flag: rom[blockOffset + 21] & 0x01,
  };
}

/**
 * Decode a full team block at the given ROM offset (text start).
 */
export function decodeTeamBlock(rom: Uint8Array, offset: number) {
  const start = offset - ATTR_SIZE;
  if (start < 0 || start + ATTR_SIZE > rom.length) throw new Error('Truncated team attributes');
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
  const size = view.getUint16(start);
  if (size < 162 || size > 500 || size % 2 || start + size > rom.length) throw new Error('Invalid/truncated team block');
  let textEnd = offset * 8;
  const names = ATTR_OFFSETS.map(attr => {
    const packed = view.getUint16(start + attr), byte = packed >> 5, bit = packed & 31;
    if (byte < ATTR_SIZE || byte % 2 || bit >= 16 || byte >= size) throw new Error('Invalid packed text position');
    const [name, end] = decode5bitString(rom, start + byte, bit, (start + size) * 8);
    textEnd = Math.max(textEnd, (start + byte) * 8 + end);
    return name;
  });
  return { offset, team: names[0], country: names[1], coach: names[2], players: names.slice(3),
    textBits: textEnd - offset * 8, textEnd: Math.ceil(textEnd / 8) };
}

/** Find structures independently of editable team text. */
export function findPointerTable(rom: Uint8Array): PointerTable {
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
  function candidate(base: number): PointerTable | null {
    if (base < 0 || base + 24 > rom.length) return null;
    const [ns, cs, us, ne, ce, ue] = Array.from({length: 6}, (_, i) => view.getUint32(base + i * 4));
    if (!(ns > 0x10000 && ns < 0x40000 && base + 24 <= ns && ns < ne && ne + 2 === cs && cs < ce && ce + 2 === us && us < ue && ue <= rom.length && [ns, cs, us, ne, ce, ue].every(x => x % 2 === 0))) return null;
    try {
      for (const [start, end] of [[ns, ne], [cs, ce], [us, ue]]) {
        for (const block of chainWalkRegion(rom, start, end)) decodeTeamBlock(rom, block + ATTR_SIZE);
      }
    } catch { return null; }
    return {natStart: ns, clubStart: cs, custStart: us, natEnd: ne, clubEnd: ce, custEnd: ue, tableBase: base};
  }
  for (const base of [0x1EF22, 0x1EA42]) { const result = candidate(base); if (result) return result; }
  for (let base = 0; base + 24 <= Math.min(rom.length, 0x30000); base += 2) {
    const result = candidate(base); if (result) return result;
  }
  throw new Error('No valid team pointer table found (unsupported or damaged ROM)');
}

/**
 * Chain-walk team blocks within a region using the 2-byte BE size word.
 * Returns list of block start offsets.
 */
export function chainWalkRegion(rom: Uint8Array, regionStart: number, regionEnd: number): number[] {
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
  if (!(regionStart >= 0 && regionStart < regionEnd && regionEnd <= rom.length) || regionStart % 2 || regionEnd % 2) throw new Error('Invalid region bounds/alignment');
  const blocks: number[] = [];
  let pos = regionStart;
  while (pos < regionEnd) {
    if (pos + 2 > regionEnd) throw new Error('Truncated block size');
    const sz = view.getUint16(pos, false);
    if (sz < 160 || sz > 500 || sz % 2 || pos + sz > regionEnd) {
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
        const pd: { name: string; number: number; position: string; role: string; head: string; star?: boolean } = {
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
        formation: t.teamAttrs.formation,
        skill: t.teamAttrs.skill,
        flag: t.teamAttrs.flag,
        kit: t.kit,
        players,
      };
    });
  }

  return output;
}

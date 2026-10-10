import {
  CHARSET, ATTR_SIZE, ATTR_OFFSETS,
  COLOUR_NAMES, STYLE_NAMES, HEAD_NAMES, ROLE_NAMES, POSITION_NAMES, FORMATION_NAMES,
} from './constants.js';
import type { Kit, KitColour, Player, PointerTable, Team, TeamsJson } from './types.js';
import {
  BITS_PER_BYTE, TEXT_BITS_PER_CHARACTER, TEXT_CHARACTER_MASK, PLAYER_COUNT,
  PLAYER_RECORD_OFFSET, PLAYER_RECORD_BYTES, PLAYER_POSITION_OFFSET, PLAYER_APPEARANCE_OFFSET,
  KIT_OFFSET, KIT_BYTES, KIT_COUNT, FORMATION_ACTIVE_OFFSET, TEAM_FLAGS_OFFSET,
  SKILL_SHIFT, SKILL_MASK, FLAG_MASK, POSITION_SHIFT, NIBBLE_MASK, ROLE_SHIFT,
  TWO_BIT_MASK, STAR_MASK, WORD_BYTES, LONG_BYTES, REGION_GAP_BYTES,
  MIN_BLOCK_BYTES, MIN_DECODED_BLOCK_BYTES, MAX_BLOCK_BYTES, POINTER_COUNT,
  POINTER_TABLE_BYTES, KNOWN_POINTER_TABLES, POINTER_SCAN_END, POINTER_DATA_START,
  POINTER_DATA_END,
} from './rom-format.js';

interface TeamAttributes { formation: string; skill: number; flag: number }
interface DecodedName { name: string; endBit: number }
interface DecodedTeamBlock {
  offset: number;
  team: string;
  country: string;
  coach: string;
  players: string[];
  textBits: number;
  textEnd: number;
}
interface DecodedRegionTeam extends DecodedTeamBlock {
  blockOffset: number;
  kit: Kit;
  teamAttrs: TeamAttributes;
  playerAttrs: Omit<Player, 'name'>[];
}
interface BlockWalkState { offset: number; blocks: number[] }

/**
 * Decode a single 5-bit packed null-terminated string.
 * Returns [decoded_string, next_bit_position].
 */
export function decode5bitString(data: Uint8Array, byteOffset: number, bitStart = 0, bitLimit = data.length * BITS_PER_BYTE): [string, number] {
  const start = byteOffset * BITS_PER_BYTE + bitStart;
  if (!Number.isInteger(start) || start < 0 || bitLimit > data.length * BITS_PER_BYTE || start > bitLimit) {
    throw new Error('Text position outside ROM/block');
  }

  const values = Array.from({ length: Math.floor((bitLimit - start) / TEXT_BITS_PER_CHARACTER) }, (_, index): number => {
    const position = start + index * TEXT_BITS_PER_CHARACTER;
    const byteIndex = Math.floor(position / BITS_PER_BYTE);
    const word = (data[byteIndex] << BITS_PER_BYTE) | (data[byteIndex + 1] ?? 0);
    return (word >> (2 * BITS_PER_BYTE - TEXT_BITS_PER_CHARACTER - position % BITS_PER_BYTE)) & TEXT_CHARACTER_MASK;
  });
  const ending = values.findIndex((value): boolean => value === 0 || value >= CHARSET.length);
  if (ending < 0) throw new Error('Unterminated packed string');
  if (values[ending] !== 0) throw new Error('Invalid packed character');
  return [values.slice(0, ending).map((value): string => CHARSET[value]).join(''), start + (ending + 1) * TEXT_BITS_PER_CHARACTER - byteOffset * BITS_PER_BYTE];
}

function requireRange(rom: Uint8Array, offset: number, size: number): void {
  if (!Number.isInteger(offset) || offset < 0 || offset + size > rom.length) throw new Error('Truncated attribute block');
}

/**
 * Decode the 16 player attribute records from the attribute block.
 * Each player has an 8-byte record starting at blockOffset + 22.
 */
export function decodePlayerAttrs(rom: Uint8Array, blockOffset: number): Omit<Player, 'name'>[] {
  requireRange(rom, blockOffset, ATTR_SIZE);
  return Array.from({ length: PLAYER_COUNT }, (_, index): Omit<Player, 'name'> => {
    const attributeOffset = blockOffset + PLAYER_RECORD_OFFSET + index * PLAYER_RECORD_BYTES + PLAYER_POSITION_OFFSET;
    const positionAndNumber = rom[attributeOffset];
    const appearance = rom[attributeOffset + PLAYER_APPEARANCE_OFFSET - PLAYER_POSITION_OFFSET];
    const position = positionAndNumber >> POSITION_SHIFT;
    const role = (appearance >> ROLE_SHIFT) & TWO_BIT_MASK;
    const head = appearance & TWO_BIT_MASK;

    return {
      number: (positionAndNumber & NIBBLE_MASK) + 1,
      position: POSITION_NAMES[position] ?? `Unknown (${position})`,
      role: ROLE_NAMES[role] ?? `Unknown (${role})`,
      head: HEAD_NAMES[head] ?? `Unknown (${head})`,
      ...(appearance & STAR_MASK ? { star: true } : {}),
    };
  });
}

/**
 * Decode kit attributes from bytes 8-17 of the attribute block.
 */
export function decodeKitAttrs(rom: Uint8Array, blockOffset: number): Kit {
  requireRange(rom, blockOffset, KIT_OFFSET + KIT_COUNT * KIT_BYTES);
  const nameFor = (names: Record<number, string>, value: number): string => names[value] ?? `Unknown (${value})`;
  const decodeKit = (offset: number): KitColour => ({
    style: nameFor(STYLE_NAMES, rom[offset]),
    shirt1: nameFor(COLOUR_NAMES, rom[offset + 1]),
    shirt2: nameFor(COLOUR_NAMES, rom[offset + 2]),
    shorts: nameFor(COLOUR_NAMES, rom[offset + 3]),
    socks: nameFor(COLOUR_NAMES, rom[offset + 4]),
  });

  return { first: decodeKit(blockOffset + KIT_OFFSET), second: decodeKit(blockOffset + KIT_OFFSET + KIT_BYTES) };
}

/**
 * Decode team-level attributes from bytes 18-21 of the attribute block.
 */
export function decodeTeamAttrs(rom: Uint8Array, blockOffset: number): TeamAttributes {
  requireRange(rom, blockOffset, TEAM_FLAGS_OFFSET + 1);
  const formationVal = rom[blockOffset + FORMATION_ACTIVE_OFFSET];
  return {
    formation: FORMATION_NAMES[formationVal] ?? String(formationVal),
    skill: (rom[blockOffset + TEAM_FLAGS_OFFSET] >> SKILL_SHIFT) & SKILL_MASK,
    flag: rom[blockOffset + TEAM_FLAGS_OFFSET] & FLAG_MASK,
  };
}

/**
 * Decode a full team block at the given ROM offset (text start).
 */
export function decodeTeamBlock(rom: Uint8Array, offset: number): DecodedTeamBlock {
  const start = offset - ATTR_SIZE;
  if (start < 0 || start + ATTR_SIZE > rom.length) throw new Error('Truncated team attributes');
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
  const size = view.getUint16(start);
  if (size < MIN_DECODED_BLOCK_BYTES || size > MAX_BLOCK_BYTES || size % WORD_BYTES || start + size > rom.length) throw new Error('Invalid/truncated team block');

  const decoded = ATTR_OFFSETS.map((attributeOffset): DecodedName => {
    const packedPosition = view.getUint16(start + attributeOffset);
    const byteOffset = packedPosition >> TEXT_BITS_PER_CHARACTER;
    const bitOffset = packedPosition & TEXT_CHARACTER_MASK;
    if (byteOffset < ATTR_SIZE || byteOffset % WORD_BYTES || bitOffset >= WORD_BYTES * BITS_PER_BYTE || byteOffset >= size) {
      throw new Error('Invalid packed text position');
    }

    const [name, bitsRead] = decode5bitString(rom, start + byteOffset, bitOffset, (start + size) * BITS_PER_BYTE);
    return { name, endBit: (start + byteOffset) * BITS_PER_BYTE + bitsRead };
  });
  const names = decoded.map(({ name }): string => name);
  const textEnd = Math.max(offset * BITS_PER_BYTE, ...decoded.map(({ endBit }): number => endBit));

  return {
    offset,
    team: names[0],
    country: names[1],
    coach: names[2],
    players: names.slice(3),
    textBits: textEnd - offset * BITS_PER_BYTE,
    textEnd: Math.ceil(textEnd / BITS_PER_BYTE),
  };
}

/** Find structures independently of editable team text. */
export function findPointerTable(rom: Uint8Array): PointerTable {
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);

  function candidate(base: number): PointerTable | null {
    if (base < 0 || base + POINTER_TABLE_BYTES > rom.length) return null;
    const [natStart, clubStart, custStart, natEnd, clubEnd, custEnd] =
      Array.from({ length: POINTER_COUNT }, (_, index): number => view.getUint32(base + index * LONG_BYTES));
    const pointers = [natStart, clubStart, custStart, natEnd, clubEnd, custEnd];
    const hasValidBounds = natStart > POINTER_DATA_START && natStart < POINTER_DATA_END &&
      base + POINTER_TABLE_BYTES <= natStart && natStart < natEnd &&
      natEnd + REGION_GAP_BYTES === clubStart && clubStart < clubEnd &&
      clubEnd + REGION_GAP_BYTES === custStart && custStart < custEnd && custEnd <= rom.length &&
      pointers.every((pointer): boolean => pointer % WORD_BYTES === 0);
    if (!hasValidBounds) return null;

    const regions = [[natStart, natEnd], [clubStart, clubEnd], [custStart, custEnd]];
    const validRegions = regions.every(([start, end]): boolean => {
      try {
        chainWalkRegion(rom, start, end).forEach((block): void => {
          decodeTeamBlock(rom, block + ATTR_SIZE);
        });
        return true;
      } catch {
        return false;
      }
    });
    if (!validRegions) return null;

    return { natStart, clubStart, custStart, natEnd, clubEnd, custEnd, tableBase: base };
  }

  const known = KNOWN_POINTER_TABLES.reduce<PointerTable | null>(
    (found, base): PointerTable | null => found ?? candidate(base), null);
  const scanCount = Math.max(0, Math.floor((Math.min(rom.length, POINTER_SCAN_END) - POINTER_TABLE_BYTES) / WORD_BYTES) + 1);
  const discovered = known ?? Array.from({ length: scanCount }, (_, index): number => index * WORD_BYTES)
    .reduce<PointerTable | null>((found, base): PointerTable | null => found ?? candidate(base), null);
  if (!discovered) throw new Error('No valid team pointer table found (unsupported or damaged ROM)');
  return discovered;
}

/**
 * Chain-walk team blocks within a region using the 2-byte BE size word.
 * Returns list of block start offsets.
 */
export function chainWalkRegion(rom: Uint8Array, regionStart: number, regionEnd: number): number[] {
  if (!(regionStart >= 0 && regionStart < regionEnd && regionEnd <= rom.length) || regionStart % WORD_BYTES || regionEnd % WORD_BYTES) {
    throw new Error('Invalid region bounds/alignment');
  }

  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
  const maxBlocks = Math.ceil((regionEnd - regionStart) / MIN_BLOCK_BYTES);
  const result = Array.from({ length: maxBlocks }).reduce<BlockWalkState>((state): BlockWalkState => {
    if (state.offset === regionEnd) return state;
    const offset = state.offset;
    if (offset + WORD_BYTES > regionEnd) throw new Error('Truncated block size');
    const size = view.getUint16(offset);
    if (size < MIN_BLOCK_BYTES || size > MAX_BLOCK_BYTES || size % WORD_BYTES || offset + size > regionEnd) {
      throw new Error(`Bad block size ${size} at 0x${offset.toString(16).toUpperCase()}`);
    }
    return { offset: offset + size, blocks: [...state.blocks, offset] };
  }, { offset: regionStart, blocks: [] });
  if (result.offset !== regionEnd) {
    throw new Error(`Chain walk ended at 0x${result.offset.toString(16).toUpperCase()}, expected 0x${regionEnd.toString(16).toUpperCase()}`);
  }
  return result.blocks;
}

/**
 * Decode all teams in a region.
 */
export function decodeRegion(rom: Uint8Array, regionStart: number, regionEnd: number): DecodedRegionTeam[] {
  return chainWalkRegion(rom, regionStart, regionEnd).map((blockOffset): DecodedRegionTeam => {
    const info = decodeTeamBlock(rom, blockOffset + ATTR_SIZE);
    return {
      ...info,
      blockOffset,
      kit: decodeKitAttrs(rom, blockOffset),
      teamAttrs: decodeTeamAttrs(rom, blockOffset),
      playerAttrs: decodePlayerAttrs(rom, blockOffset),
    };
  });
}

/**
 * Decode all teams from a ROM.
 */
export function decodeRom(romBytes: Uint8Array): TeamsJson {
  const pointers = findPointerTable(romBytes);
  const decodeTeams = (start: number, end: number): Team[] =>
    decodeRegion(romBytes, start, end).map(({ team, country, coach, players, playerAttrs, teamAttrs, kit }): Team => ({
      team,
      country,
      coach,
      formation: teamAttrs.formation,
      skill: teamAttrs.skill,
      flag: teamAttrs.flag,
      kit,
      players: players.map((name, index): Player => ({ name, ...playerAttrs[index] })),
    }));

  return {
    national: decodeTeams(pointers.natStart, pointers.natEnd),
    club: decodeTeams(pointers.clubStart, pointers.clubEnd),
    custom: decodeTeams(pointers.custStart, pointers.custEnd),
  };
}

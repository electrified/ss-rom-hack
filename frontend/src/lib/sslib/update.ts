import {
  ATTR_SIZE, ATTR_OFFSETS,
  COLOUR_VALUES, STYLE_VALUES, HEAD_VALUES, ROLE_VALUES, POSITION_VALUES, FORMATION_VALUES,
} from './constants.js';
import { findPointerTable, chainWalkRegion } from './decode.js';
import { encodeTeamText, computePackedPositions } from './encode.js';
import type { Team } from './types.js';
import { normalizeTeams } from './normalize';
import { validateTeams, extractRomStructure } from './validate';
import { availableEnd } from './layout';
import {
  PLAYER_RECORD_OFFSET, PLAYER_RECORD_BYTES, PLAYER_POSITION_OFFSET, PLAYER_APPEARANCE_OFFSET,
  KIT_OFFSET, KIT_BYTES, FORMATION_DEFAULT_OFFSET, FORMATION_ACTIVE_OFFSET,
  TEAM_FLAGS_OFFSET, SKILL_SHIFT, TEAM_EDIT_MASK, POSITION_SHIFT, NIBBLE_MASK,
  ROLE_SHIFT, TWO_BIT_MASK, STAR_MASK, APPEARANCE_RESERVED_MASK, WORD_BYTES,
  LONG_BYTES, REGION_GAP_BYTES, MAX_BLOCK_BYTES, ROM_CHECKSUM_OFFSET,
  ROM_CHECKSUM_START, ROM_CHECKSUM_MASK,
} from './rom-format.js';

function resolveColour(val: string | number): number {
  return typeof val === 'string' ? COLOUR_VALUES[val] : val;
}
function resolveStyle(val: string | number): number {
  return typeof val === 'string' ? STYLE_VALUES[val] : val;
}
function resolvePosition(val: string | number): number {
  return typeof val === 'string' ? POSITION_VALUES[val] : val;
}
function resolveRole(val: string | number): number {
  return typeof val === 'string' ? ROLE_VALUES[val] : val;
}
function resolveHead(val: string | number): number {
  return typeof val === 'string' ? HEAD_VALUES[val] : val;
}

function applyKitAttrs(attrs: Uint8Array, kit: Team['kit']): Uint8Array {
  const updated = attrs.slice();
  (['first', 'second'] as const).forEach((prefix, index): void => {
    const b = KIT_OFFSET + index * KIT_BYTES;
    const k = kit[prefix];
    updated[b] = resolveStyle(k.style);
    updated[b + 1] = resolveColour(k.shirt1);
    updated[b + 2] = resolveColour(k.shirt2);
    updated[b + 3] = resolveColour(k.shorts);
    updated[b + 4] = resolveColour(k.socks);
  });
  return updated;
}

function applyTeamAttrs(attrs: Uint8Array, team: Team): Uint8Array {
  const updated = attrs.slice();
  const formation = FORMATION_VALUES[team.formation];
  if (updated[FORMATION_ACTIVE_OFFSET] !== formation) {
    updated[FORMATION_DEFAULT_OFFSET] = formation;
    updated[FORMATION_ACTIVE_OFFSET] = formation;
  }
  const skill = team.skill ?? 0;
  const flag = team.flag ?? 0;
  updated[TEAM_FLAGS_OFFSET] = (updated[TEAM_FLAGS_OFFSET] & ~TEAM_EDIT_MASK) | (skill << SKILL_SHIFT) | flag;
  return updated;
}

function applyPlayerAttrs(attrs: Uint8Array, players: Team['players']): Uint8Array {
  const updated = attrs.slice();
  players.forEach((p, i): void => {
    const recOff = PLAYER_RECORD_OFFSET + i * PLAYER_RECORD_BYTES + PLAYER_POSITION_OFFSET;
    const pos = resolvePosition(p.position);
    const role = resolveRole(p.role);
    const head = resolveHead(p.head);
    const star = p.star ? 1 : 0;
    updated[recOff] = ((pos & NIBBLE_MASK) << POSITION_SHIFT) | ((p.number - 1) & NIBBLE_MASK);
    const appearanceOffset = recOff + PLAYER_APPEARANCE_OFFSET - PLAYER_POSITION_OFFSET;
    updated[appearanceOffset] = (updated[appearanceOffset] & APPEARANCE_RESERVED_MASK) |
      (star ? STAR_MASK : 0) | ((role & TWO_BIT_MASK) << ROLE_SHIFT) | (head & TWO_BIT_MASK);
  });
  return updated;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const output = new Uint8Array(parts.reduce((length, part): number => length + part.length, 0));
  parts.reduce((offset, part): number => {
    output.set(part, offset);
    return offset + part.length;
  }, 0);
  return output;
}

/**
 * Build a new region from attribute blocks and edited JSON.
 * Returns [newRegionBytes, changesCount].
 */
export function buildRegion(rom: Uint8Array, blockOffsets: number[], teamsJson: Team[]): [Uint8Array, number] {
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);
  const parts = teamsJson.map((team, i): { block: Uint8Array; changed: boolean } => {
    const textBytes = encodeTeamText(team);
    const positions = computePackedPositions(textBytes);
    const sourceAttrs = rom.slice(blockOffsets[i], blockOffsets[i] + ATTR_SIZE);
    const positionedAttrs = sourceAttrs.slice();
    const positionsView = new DataView(positionedAttrs.buffer);
    ATTR_OFFSETS.forEach((offset, index): void => positionsView.setUint16(offset, positions[index]));
    const kitAttrs = team.kit ? applyKitAttrs(positionedAttrs, team.kit) : positionedAttrs;
    const teamAttrs = applyTeamAttrs(kitAttrs, team);
    const attrs = applyPlayerAttrs(teamAttrs, team.players);
    const attrsView = new DataView(attrs.buffer);

    const blockSize = ATTR_SIZE + textBytes.length + (textBytes.length % WORD_BYTES);
    if (blockSize > MAX_BLOCK_BYTES) throw new Error(`Encoded team block exceeds ${MAX_BLOCK_BYTES} bytes`);
    attrsView.setUint16(0, blockSize, false);

    const block = new Uint8Array(blockSize);
    block.set(attrs, 0);
    block.set(textBytes, ATTR_SIZE);

    const oldSize = view.getUint16(blockOffsets[i]);
    const changed = block.length !== oldSize || block.some((value, index): boolean => value !== rom[blockOffsets[i] + index]);
    return { block, changed };
  });

  return [concatBytes(parts.map(({ block }): Uint8Array => block)),
    parts.filter(({ changed }): boolean => changed).length];
}

/**
 * Apply edited team data to a ROM and return the modified ROM bytes.
 */
export function updateRom(romBytes: Uint8Array, input: unknown): Uint8Array {
  const validation = validateTeams(extractRomStructure(romBytes), input);
  if (!validation.valid) throw new Error(["Invalid team data", ...validation.global,
    ...Object.values(validation.teams).flatMap((category): string[] =>
      Object.values(category).flatMap((errors): string[] =>
        [...errors.team, ...errors.formation, ...Object.values(errors.players).flat()]))].join("\n"));
  const teamsJson = normalizeTeams(input);
  const rom = new Uint8Array(romBytes);
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);

  const ptrs = findPointerTable(rom);
  const [nat] = buildRegion(rom, chainWalkRegion(rom, ptrs.natStart, ptrs.natEnd), teamsJson.national);
  const [club] = buildRegion(rom, chainWalkRegion(rom, ptrs.clubStart, ptrs.clubEnd), teamsJson.club);
  const [cust] = buildRegion(rom, chainWalkRegion(rom, ptrs.custStart, ptrs.custEnd), teamsJson.custom);

  // Calculate available space
  const natStart = ptrs.natStart;
  const custEnd = ptrs.custEnd;
  const maxEnd = availableEnd(rom, custEnd);

  // Concatenate regions with 2-byte zero gaps
  const combined = concatBytes([nat, new Uint8Array(REGION_GAP_BYTES), club, new Uint8Array(REGION_GAP_BYTES), cust]);

  const totalAvailable = maxEnd - natStart;
  if (combined.length > totalAvailable) {
    const overflow = combined.length - totalAvailable;
    throw new Error(
      `New team data (${combined.length} bytes) overflows available space (${totalAvailable} bytes) by ${overflow} bytes`
    );
  }

  // Compute new pointer values
  const newNatStart = natStart;
  const newNatEnd = natStart + nat.length;
  const newClubStart = newNatEnd + REGION_GAP_BYTES;
  const newClubEnd = newClubStart + club.length;
  const newCustStart = newClubEnd + REGION_GAP_BYTES;
  const newCustEnd = newCustStart + cust.length;

  // Write combined data into ROM
  rom.set(combined, natStart);

  // Zero-fill any leftover space
  const oldTotal = custEnd - natStart;
  if (combined.length < oldTotal) {
    rom.fill(0, natStart + combined.length, natStart + oldTotal);
  }

  // Update all 6 pointers
  const tb = ptrs.tableBase;
  view.setUint32(tb + 0, newNatStart, false);
  view.setUint32(tb + LONG_BYTES, newClubStart, false);
  view.setUint32(tb + 2 * LONG_BYTES, newCustStart, false);
  view.setUint32(tb + 3 * LONG_BYTES, newNatEnd, false);
  view.setUint32(tb + 4 * LONG_BYTES, newClubEnd, false);
  view.setUint32(tb + 5 * LONG_BYTES, newCustEnd, false);

  const checksum = Array.from({ length: Math.floor((rom.length - ROM_CHECKSUM_START) / WORD_BYTES) }, (_, index): number =>
    view.getUint16(ROM_CHECKSUM_START + index * WORD_BYTES)).reduce((sum, word): number => (sum + word) & ROM_CHECKSUM_MASK, 0);
  view.setUint16(ROM_CHECKSUM_OFFSET, checksum);
  return rom;
}

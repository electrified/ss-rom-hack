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

function applyKitAttrs(attrs: Uint8Array, kit: Team['kit']): void {
  let b = 8;
  for (const prefix of ['first', 'second'] as const) {
    const k = kit[prefix];
    attrs[b] = resolveStyle(k.style);
    attrs[b + 1] = resolveColour(k.shirt1);
    attrs[b + 2] = resolveColour(k.shirt2);
    attrs[b + 3] = resolveColour(k.shorts);
    attrs[b + 4] = resolveColour(k.socks);
    b += 5;
  }
}

function applyTeamAttrs(attrs: Uint8Array, team: Team): void {
  const formation = FORMATION_VALUES[team.formation];
  if (attrs[19] !== formation) { attrs[18] = formation; attrs[19] = formation; }
  const skill = team.skill ?? 0;
  const flag = team.flag ?? 0;
  attrs[21] = (attrs[21] & ~0x39) | (skill << 3) | flag;
}

function applyPlayerAttrs(attrs: Uint8Array, players: Team['players']): void {
  const base = 22;
  for (let i = 0; i < players.length; i++) {
    const p = players[i];
    const recOff = base + i * 8 + 2;
    const pos = resolvePosition(p.position);
    const role = resolveRole(p.role);
    const head = resolveHead(p.head);
    const star = p.star ? 1 : 0;
    attrs[recOff] = ((pos & 0x0F) << 4) | ((p.number - 1) & 0x0F);
    attrs[recOff + 1] = (attrs[recOff + 1] & 0xE0) | ((star & 0x01) << 4) | ((role & 0x03) << 2) | (head & 0x03);
  }
}

/**
 * Build a new region from attribute blocks and edited JSON.
 * Returns [newRegionBytes, changesCount].
 */
export function buildRegion(rom: Uint8Array, blockOffsets: number[], teamsJson: Team[]): [Uint8Array, number] {
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);

  const attrBlocks = blockOffsets.map(off => rom.slice(off, off + ATTR_SIZE));

  const parts: Uint8Array[] = [];
  let changes = 0;

  for (let i = 0; i < teamsJson.length; i++) {
    const team = teamsJson[i];
    const textBytes = encodeTeamText(team);
    const positions = computePackedPositions(textBytes);

    const attrs = new Uint8Array(attrBlocks[i]);
    const attrsView = new DataView(attrs.buffer);
    for (let strIdx = 0; strIdx < ATTR_OFFSETS.length; strIdx++) {
      attrsView.setUint16(ATTR_OFFSETS[strIdx], positions[strIdx], false);
    }

    if (team.kit) applyKitAttrs(attrs, team.kit);
    applyTeamAttrs(attrs, team);
    applyPlayerAttrs(attrs, team.players);

    const blockSize = ATTR_SIZE + textBytes.length + (textBytes.length % 2);
    if (blockSize > 500) throw new Error('Encoded team block exceeds 500 bytes');
    attrsView.setUint16(0, blockSize, false);

    const pad = textBytes.length % 2 !== 0 ? 1 : 0;
    const block = new Uint8Array(ATTR_SIZE + textBytes.length + pad);
    block.set(attrs, 0);
    block.set(textBytes, ATTR_SIZE);
    // pad byte is already 0

    parts.push(block);

    const oldSize = view.getUint16(blockOffsets[i]);
    if (block.length !== oldSize || block.some((v, j) => v !== rom[blockOffsets[i] + j])) changes++;

  }

  // Concatenate all blocks
  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const newRegion = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) {
    newRegion.set(part, offset);
    offset += part.length;
  }

  return [newRegion, changes];
}

/**
 * Apply edited team data to a ROM and return the modified ROM bytes.
 */
export function updateRom(romBytes: Uint8Array, input: unknown): Uint8Array {
  const validation = validateTeams(extractRomStructure(romBytes), input);
  if (!validation.valid) throw new Error(["Invalid team data", ...validation.global, ...Object.values(validation.teams).flatMap(cat => Object.values(cat).flatMap(e => [...e.team, ...e.formation, ...Object.values(e.players).flat()]))].join("\n"));
  const teamsJson = normalizeTeams(input);
  const rom = new Uint8Array(romBytes);
  const view = new DataView(rom.buffer, rom.byteOffset, rom.byteLength);

  const ptrs = findPointerTable(rom);
  const regionInfo = [
    ['national', ptrs.natStart, ptrs.natEnd],
    ['club', ptrs.clubStart, ptrs.clubEnd],
    ['custom', ptrs.custStart, ptrs.custEnd],
  ] as const;

  const allBlockOffsets: Record<string, number[]> = {};
  for (const [cat, start, end] of regionInfo) {
    allBlockOffsets[cat] = chainWalkRegion(rom, start, end);
  }

  const regionData: Record<string, Uint8Array> = {};
  for (const [cat, , ] of regionInfo) {
    const [data] = buildRegion(rom, allBlockOffsets[cat], teamsJson[cat]);
    regionData[cat] = data;
  }

  // Calculate available space
  const natStart = ptrs.natStart;
  const custEnd = ptrs.custEnd;
  const maxEnd = availableEnd(rom, custEnd);

  // Concatenate regions with 2-byte zero gaps
  const nat = regionData['national'];
  const club = regionData['club'];
  const cust = regionData['custom'];
  const combined = new Uint8Array(nat.length + 2 + club.length + 2 + cust.length);
  let off = 0;
  combined.set(nat, off); off += nat.length;
  off += 2; // zero gap (already 0)
  combined.set(club, off); off += club.length;
  off += 2; // zero gap
  combined.set(cust, off);

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
  const newClubStart = newNatEnd + 2;
  const newClubEnd = newClubStart + club.length;
  const newCustStart = newClubEnd + 2;
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
  view.setUint32(tb + 4, newClubStart, false);
  view.setUint32(tb + 8, newCustStart, false);
  view.setUint32(tb + 12, newNatEnd, false);
  view.setUint32(tb + 16, newClubEnd, false);
  view.setUint32(tb + 20, newCustEnd, false);

  let checksum = 0;
  for (let i = 0x200; i + 1 < rom.length; i += 2) checksum = (checksum + view.getUint16(i)) & 0xffff;
  view.setUint16(0x18e, checksum);
  return rom;
}

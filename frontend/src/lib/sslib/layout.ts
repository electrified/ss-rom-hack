import { encodeTeamText } from './encode';
import type { TeamsJson } from './types';
import { CATEGORIES, ATTR_SIZE } from './constants';
import { REGION_GAP_BYTES, REGION_GAP_COUNT, WORD_BYTES } from './rom-format';
export function availableEnd(rom: Uint8Array, customEnd: number): number {
  const words = Math.max(0, Math.floor((rom.length - customEnd) / WORD_BYTES));
  const firstOccupied = Array.from({ length: words }, (_, index): number => customEnd + index * WORD_BYTES)
    .findIndex((offset): boolean => rom[offset] !== 0 || rom[offset + 1] !== 0);
  return customEnd + (firstOccupied < 0 ? words : firstOccupied) * WORD_BYTES;
}
export function encodedSize(teams: TeamsJson): number {
  return REGION_GAP_BYTES * REGION_GAP_COUNT + CATEGORIES.reduce((sum, cat): number => sum + teams[cat].reduce((sizeSoFar, team): number => {
    const size = encodeTeamText(team).length;
    return sizeSoFar + ATTR_SIZE + size + size % WORD_BYTES;
  }, 0), 0);
}

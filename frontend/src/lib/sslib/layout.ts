import { encodeTeamText } from './encode';
import type { TeamsJson } from './types';
import { CATEGORIES, ATTR_SIZE } from './constants';
export function availableEnd(rom: Uint8Array, customEnd: number): number {
  let end = customEnd;
  while (end + 2 <= rom.length && rom[end] === 0 && rom[end + 1] === 0) end += 2;
  return end;
}
export function encodedSize(teams: TeamsJson): number {
  return 4 + CATEGORIES.reduce((sum, cat) => sum + teams[cat].reduce((n, team) => {
    const size = encodeTeamText(team).length;
    return n + ATTR_SIZE + size + size % 2;
  }, 0), 0);
}

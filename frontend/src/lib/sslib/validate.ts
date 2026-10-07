import { CATEGORIES, POSITION_VALUES, POSITION_NAMES } from './constants';
import { findPointerTable, chainWalkRegion } from './decode';
import { normalizeTeams, TeamDataError } from './normalize';
import { availableEnd, encodedSize } from './layout';
import { positionLabel } from './formation';
import type { TeamsJson } from './types';
export interface TeamErrors { team: string[]; formation: string[]; players: Record<number, string[]> }
export interface ValidationResult { valid: boolean; global: string[]; teams: Record<string, Record<number, TeamErrors>>; budget?: {used: number; capacity: number} }
export interface RomStructure { teamCounts: Record<string, number>; capacity?: number }
export function extractRomStructure(rom: Uint8Array): RomStructure {
  const p = findPointerTable(rom);
  return {teamCounts: {national: chainWalkRegion(rom, p.natStart, p.natEnd).length,
    club: chainWalkRegion(rom, p.clubStart, p.clubEnd).length, custom: chainWalkRegion(rom, p.custStart, p.custEnd).length},
    capacity: availableEnd(rom, p.custEnd) - p.natStart};
}
export function validateTeams(structure: RomStructure, input: unknown): ValidationResult {
  const result: ValidationResult = {valid: true, global: [], teams: {}};
  function error(cat: string, i: number): TeamErrors {
    result.valid = false;
    result.teams[cat] ??= {};
    return result.teams[cat][i] ??= {team: [], formation: [], players: {}};
  }
  let teams: TeamsJson;
  try { teams = normalizeTeams(input); }
  catch (exc) {
    if (!(exc instanceof TeamDataError)) throw exc;
    result.valid = false;
    for (const issue of exc.issues) {
      if (issue.category === undefined || issue.team === undefined) result.global.push(issue.message);
      else {
        const e = error(issue.category, issue.team);
        if (issue.player === undefined) e.team.push(issue.message);
        else (e.players[issue.player] ??= []).push(issue.message);
      }
    }
    return result;
  }
  for (const cat of CATEGORIES) {
    const count = structure.teamCounts[cat] ?? 0;
    if (teams[cat].length !== count) { result.valid = false; result.global.push(`${cat}: expected ${count} teams, got ${teams[cat].length}`); }
    teams[cat].forEach((team, i) => {
      const slots = team.players.map(p => POSITION_VALUES[p.position]);
      const missing: string[] = [];
      for (let slot = 0; slot < 11; slot++) {
        const occupants = slots.flatMap((value, index) => value === slot ? [index] : []);
        const label = positionLabel(team.formation, POSITION_NAMES[slot]);
        if (occupants.length === 0) missing.push(label);
        if (occupants.length > 1) {
          const e = error(cat, i);
          e.formation.push(`Formation: ${label} has ${occupants.length} players.`);
          for (const index of occupants) (e.players[index] ??= []).push(`Duplicate position: ${label}.`);
        }
      }
      if (missing.length) error(cat, i).formation.push(`Missing formation ${missing.length === 1 ? 'position' : 'positions'}: ${missing.join(', ')}.`);
      if (slots.filter(s => s === 15).length !== 5) error(cat, i).formation.push(`expected 5 subs, got ${slots.filter(s => s === 15).length}`);
    });
  }
  if (structure.capacity !== undefined) {
    const used = encodedSize(teams);
    result.budget = {used, capacity: structure.capacity};
    if (used > structure.capacity) { result.valid = false; result.global.push(`New team data (${used} bytes) overflows available space (${structure.capacity} bytes) by ${used - structure.capacity} bytes`); }
  }
  return result;
}

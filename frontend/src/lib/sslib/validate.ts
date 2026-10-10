import { CATEGORIES, POSITION_VALUES, POSITION_NAMES } from './constants';
import { findPointerTable, chainWalkRegion } from './decode';
import { normalizeTeams, TeamDataError } from './normalize';
import { availableEnd, encodedSize } from './layout';
import { positionLabel } from './formation';
import type { Team, TeamsJson } from './types';
import { STARTER_COUNT, PLAYER_COUNT } from './rom-format';

export interface TeamErrors { team: string[]; formation: string[]; players: Record<number, string[]> }
export interface ValidationResult { valid: boolean; global: string[]; teams: Record<string, Record<number, TeamErrors>>; budget?: {used: number; capacity: number} }
export interface RomStructure { teamCounts: Record<string, number>; capacity?: number }

interface DetailIssue { category: string; team: number; field: 'team' | 'formation'; player?: number; message: string }

export function extractRomStructure(rom: Uint8Array): RomStructure {
  const pointers = findPointerTable(rom);
  return {
    teamCounts: {
      national: chainWalkRegion(rom, pointers.natStart, pointers.natEnd).length,
      club: chainWalkRegion(rom, pointers.clubStart, pointers.clubEnd).length,
      custom: chainWalkRegion(rom, pointers.custStart, pointers.custEnd).length,
    },
    capacity: availableEnd(rom, pointers.custEnd) - pointers.natStart,
  };
}

function groupIssues(issues: DetailIssue[]): ValidationResult['teams'] {
  return issues.reduce<ValidationResult['teams']>((groups, issue): ValidationResult['teams'] => {
    const category = groups[issue.category] ?? {};
    const current = category[issue.team] ?? { team: [], formation: [], players: {} };
    const updated: TeamErrors = issue.player === undefined
      ? { ...current, [issue.field]: [...current[issue.field], issue.message] }
      : { ...current, players: { ...current.players,
          [issue.player]: [...(current.players[issue.player] ?? []), issue.message] } };
    return { ...groups, [issue.category]: { ...category, [issue.team]: updated } };
  }, {});
}

function formationIssues(team: Team, category: string, teamIndex: number): DetailIssue[] {
  const positions = team.players.map((player): number => POSITION_VALUES[player.position]);
  const slots = Array.from({ length: STARTER_COUNT }, (_, slot): { label: string; occupants: number[] } => ({
    label: positionLabel(team.formation, POSITION_NAMES[slot]),
    occupants: positions.flatMap((position, index): number[] => position === slot ? [index] : []),
  }));
  const duplicates = slots.flatMap(({ label, occupants }): DetailIssue[] => occupants.length > 1
    ? [
        { category, team: teamIndex, field: 'formation', message: `Formation: ${label} has ${occupants.length} players.` },
        ...occupants.map((player): DetailIssue => ({ category, team: teamIndex, player, field: 'team',
          message: `Duplicate position: ${label}.` })),
      ] : []);
  const missing = slots.filter(({ occupants }): boolean => occupants.length === 0)
    .map(({ label }): string => label);
  return [
    ...duplicates,
    ...(missing.length ? [{ category, team: teamIndex, field: 'formation' as const,
      message: `Missing formation ${missing.length === 1 ? 'position' : 'positions'}: ${missing.join(', ')}.` }] : []),
    ...(positions.filter((position): boolean => position === POSITION_VALUES.sub).length !== PLAYER_COUNT - STARTER_COUNT
      ? [{ category, team: teamIndex, field: 'formation' as const,
        message: `expected ${PLAYER_COUNT - STARTER_COUNT} subs, got ${positions.filter((position): boolean => position === POSITION_VALUES.sub).length}` }] : []),
  ];
}

export function validateTeams(structure: RomStructure, input: unknown): ValidationResult {
  try {
    const teams: TeamsJson = normalizeTeams(input);
    const counts = CATEGORIES.flatMap((category): string[] => {
      const count = structure.teamCounts[category] ?? 0;
      return teams[category].length === count
        ? [] : [`${category}: expected ${count} teams, got ${teams[category].length}`];
    });
    const details = CATEGORIES.flatMap((category): DetailIssue[] =>
      teams[category].flatMap((team, index): DetailIssue[] => formationIssues(team, category, index)));
    const budget = structure.capacity === undefined
      ? undefined : { used: encodedSize(teams), capacity: structure.capacity };
    const overflow = budget && budget.used > budget.capacity
      ? [`New team data (${budget.used} bytes) overflows available space (${budget.capacity} bytes) by ${budget.used - budget.capacity} bytes`]
      : [];
    const global = [...counts, ...overflow];
    return { valid: global.length === 0 && details.length === 0, global, teams: groupIssues(details),
      ...(budget ? { budget } : {}) };
  } catch (error) {
    if (!(error instanceof TeamDataError)) throw error;
    const global = error.issues.filter((issue): boolean => issue.category === undefined || issue.team === undefined)
      .map((issue): string => issue.message);
    const details = error.issues.flatMap((issue): DetailIssue[] => issue.category !== undefined && issue.team !== undefined
      ? [{ category: issue.category, team: issue.team, player: issue.player, field: 'team', message: issue.message }]
      : []);
    return { valid: false, global, teams: groupIssues(details) };
  }
}

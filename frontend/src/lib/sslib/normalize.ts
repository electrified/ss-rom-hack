import {
  CHARSET, CATEGORIES, COLOUR_NAMES, STYLE_NAMES, FORMATION_NAMES, POSITION_NAMES,
  ROLE_NAMES, HEAD_NAMES, MAX_TEAM_NAME, MAX_COUNTRY, MAX_COACH, MAX_PLAYER_NAME,
} from './constants';
import type { KitColour, Player, Team, TeamsJson } from './types';
import { PLAYER_COUNT, SKILL_MASK, FLAG_MASK } from './rom-format';

export interface DataIssue { category?: string; team?: number; player?: number; message: string }
type IssueContext = Omit<DataIssue, 'message'>;
type Category = typeof CATEGORIES[number];

export class TeamDataError extends Error {
  constructor(public issues: DataIssue[]) {
    super(issues.map((issue): string =>
      `${issue.category ?? 'JSON'}${issue.team === undefined ? '' : ` team ${issue.team + 1}`}${issue.player === undefined ? '' : ` player ${issue.player + 1}`}: ${issue.message}`
    ).join('\n'));
  }
}

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const asRecord = (value: unknown): Record<string, unknown> => object(value) ? value : {};
const issue = (context: IssueContext, message: string): DataIssue => ({ ...context, message });

function recordIssues(value: unknown, allowed: string[], label: string, context: IssueContext): DataIssue[] {
  if (!object(value)) return [issue(context, `${label} must be an object`)];
  return Object.keys(value).filter((key): boolean => !allowed.includes(key))
    .map((key): DataIssue => issue(context, `${label}: unknown field '${key}'`));
}

function textIssues(value: unknown, label: string, max: number, context: IssueContext): DataIssue[] {
  if (typeof value !== 'string') return [issue(context, `${label} must be a string`)];
  return [
    ...([...value].some((character): boolean => !CHARSET.slice(1).includes(character))
      ? [issue(context, `${label}: invalid chars (use uppercase A-Z, space, dash, apostrophe, period)`)] : []),
    ...(value.length > max ? [issue(context, `${label}: max ${max} characters, got ${value.length}`)] : []),
  ];
}

function integerIssues(value: unknown, label: string, min: number, max: number, context: IssueContext): DataIssue[] {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? [] : [issue(context, `${label} must be an integer ${min}-${max}`)];
}

function enumerationIssues(value: unknown, names: Record<number, string>, label: string, context: IssueContext): DataIssue[] {
  return typeof value === 'string' && Object.values(names).includes(value)
    ? [] : [issue(context, `${label} must be one of ${Object.values(names).join(', ')}`)];
}

function kitIssues(value: unknown, context: IssueContext): DataIssue[] {
  const kit = asRecord(value);
  return [
    ...recordIssues(value, ['first', 'second'], 'kit', context),
    ...(['first', 'second'] as const).flatMap((prefix): DataIssue[] => {
      const set = asRecord(kit[prefix]);
      return [
        ...recordIssues(kit[prefix], ['style', 'shirt1', 'shirt2', 'shorts', 'socks'], `${prefix} kit`, context),
        ...enumerationIssues(set.style, STYLE_NAMES, `${prefix} kit style`, context),
        ...(['shirt1', 'shirt2', 'shorts', 'socks'] as const).flatMap((field): DataIssue[] =>
          enumerationIssues(set[field], COLOUR_NAMES, `${prefix} kit ${field}`, context)),
      ];
    }),
  ];
}

function playerIssues(value: unknown, context: IssueContext): DataIssue[] {
  const player = asRecord(value);
  return [
    ...recordIssues(value, ['name', 'number', 'position', 'role', 'head', 'star'], 'player', context),
    ...(player.star !== undefined && typeof player.star !== 'boolean' ? [issue(context, 'star must be a boolean')] : []),
    ...textIssues(player.name, 'name', MAX_PLAYER_NAME, context),
    ...integerIssues(player.number, 'number', 1, PLAYER_COUNT, context),
    ...enumerationIssues(player.position, POSITION_NAMES, 'position', context),
    ...enumerationIssues(player.role, ROLE_NAMES, 'role', context),
    ...enumerationIssues(player.head, HEAD_NAMES, 'head', context),
  ];
}

function teamIssues(value: unknown, category: Category, index: number): DataIssue[] {
  const context: IssueContext = { category, team: index };
  const team = asRecord(value);
  const players = Array.isArray(team.players) ? team.players : [];
  return [
    ...recordIssues(value, ['team', 'country', 'coach', 'formation', 'skill', 'flag', 'kit', 'players'], 'team', context),
    ...textIssues(team.team, 'team', MAX_TEAM_NAME, context),
    ...textIssues(team.country, 'country', MAX_COUNTRY, context),
    ...textIssues(team.coach, 'coach', MAX_COACH, context),
    ...enumerationIssues(team.formation, FORMATION_NAMES, 'formation', context),
    ...integerIssues(team.skill, 'skill', 0, SKILL_MASK, context),
    ...integerIssues(team.flag, 'flag', 0, FLAG_MASK, context),
    ...kitIssues(team.kit, context),
    ...(players.length !== PLAYER_COUNT ? [issue(context, `expected ${PLAYER_COUNT} players, got ${players.length}`)] : []),
    ...players.flatMap((player, playerIndex): DataIssue[] =>
      playerIssues(player, { ...context, player: playerIndex })),
  ];
}

function categoryIssues(root: Record<string, unknown>, category: Category): DataIssue[] {
  const teams = root[category];
  return Array.isArray(teams)
    ? teams.flatMap((team, index): DataIssue[] => teamIssues(team, category, index))
    : [issue({ category }, `${category} must be an array; JSON must contain national, club, custom keys`)];
}

function normalizeKitColour(value: unknown): KitColour {
  const set = asRecord(value);
  return {
    style: set.style as string,
    shirt1: set.shirt1 as string,
    shirt2: set.shirt2 as string,
    shorts: set.shorts as string,
    socks: set.socks as string,
  };
}

function normalizePlayer(value: unknown): Player {
  const player = asRecord(value);
  return {
    name: player.name as string,
    number: player.number as number,
    position: player.position as string,
    role: player.role as string,
    head: player.head as string,
    ...(player.star === true ? { star: true } : {}),
  };
}

function normalizeTeam(value: unknown): Team {
  const team = asRecord(value);
  const kit = asRecord(team.kit);
  return {
    team: team.team as string,
    country: team.country as string,
    coach: team.coach as string,
    formation: team.formation as string,
    skill: team.skill as number,
    flag: team.flag as number,
    kit: { first: normalizeKitColour(kit.first), second: normalizeKitColour(kit.second) },
    players: (team.players as unknown[]).map((player): Player => normalizePlayer(player)),
  };
}

/** Validate external JSON before rendering or encoding; return a fresh canonical model. */
export function normalizeTeams(input: unknown): TeamsJson {
  const root = asRecord(input);
  const issues = [
    ...recordIssues(input, [...CATEGORIES, '$schema'], 'JSON', {}),
    ...('$schema' in root && typeof root.$schema !== 'string' ? [issue({}, '$schema must be a string')] : []),
    ...CATEGORIES.flatMap((category): DataIssue[] => categoryIssues(root, category)),
  ];
  if (issues.length) throw new TeamDataError(issues);
  const category = (name: Category): Team[] => (root[name] as unknown[]).map((team): Team => normalizeTeam(team));
  return { national: category('national'), club: category('club'), custom: category('custom') };
}

import { CHARSET, CATEGORIES, COLOUR_NAMES, STYLE_NAMES, FORMATION_NAMES, POSITION_NAMES, ROLE_NAMES, HEAD_NAMES, MAX_TEAM_NAME, MAX_COUNTRY, MAX_COACH, MAX_PLAYER_NAME } from './constants';
import type { TeamsJson } from './types';

export interface DataIssue { category?: string; team?: number; player?: number; message: string }
export class TeamDataError extends Error {
  constructor(public issues: DataIssue[]) { super(issues.map(i => `${i.category ?? 'JSON'}${i.team === undefined ? '' : ` team ${i.team + 1}`}${i.player === undefined ? '' : ` player ${i.player + 1}`}: ${i.message}`).join('\n')); }
}
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Validate external JSON before rendering or encoding; return a fresh canonical model. */
export function normalizeTeams(input: unknown): TeamsJson {
  const issues: DataIssue[] = [];
  let context: Omit<DataIssue, 'message'> = {};
  const fail = (message: string) => issues.push({...context, message});
  function record(value: unknown, allowed: string[], label: string): Record<string, unknown> {
    if (!object(value)) { fail(`${label} must be an object`); return {}; }
    for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${label}: unknown field '${key}'`);
    return value;
  }
  function text(value: unknown, label: string, max: number): string {
    if (typeof value !== 'string') { fail(`${label} must be a string`); return ''; }
    if ([...value].some(c => !CHARSET.slice(1).includes(c))) fail(`${label}: invalid chars (use uppercase A-Z, space, dash, apostrophe, period)`);
    if (value.length > max) fail(`${label}: max ${max} characters, got ${value.length}`);
    return value;
  }
  function integer(value: unknown, label: string, min: number, max: number): number {
    if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) { fail(`${label} must be an integer ${min}-${max}`); return min; }
    return value;
  }
  function enumeration(value: unknown, names: Record<number, string>, label: string): string {
    if (typeof value === 'string' && Object.values(names).includes(value)) return value;
    fail(`${label} must be one of ${Object.values(names).join(', ')}`);
    return '';
  }
  const root = record(input, [...CATEGORIES, '$schema'], 'JSON');
  if ('$schema' in root && typeof root.$schema !== 'string') fail('$schema must be a string');
  const output: TeamsJson = {national: [], club: [], custom: []};
  for (const cat of CATEGORIES) {
    context = {category: cat};
    if (!Array.isArray(root[cat])) { fail(`${cat} must be an array; JSON must contain national, club, custom keys`); continue; }
    output[cat] = root[cat].map((raw, i) => {
      context = {category: cat, team: i};
      const team = record(raw, ['team', 'country', 'coach', 'formation', 'skill', 'flag', 'kit', 'players'], 'team');
      const info = {team: text(team.team, 'team', MAX_TEAM_NAME), country: text(team.country, 'country', MAX_COUNTRY), coach: text(team.coach, 'coach', MAX_COACH),
        formation: enumeration(team.formation, FORMATION_NAMES, 'formation'),
        skill: integer(team.skill, 'skill', 0, 7), flag: integer(team.flag, 'flag', 0, 1)};
      const kit = record(team.kit, ['first', 'second'], 'kit');
      const kitSet = (prefix: string) => {
        const set = record(kit[prefix], ['style', 'shirt1', 'shirt2', 'shorts', 'socks'], `${prefix} kit`);
        return {style: enumeration(set.style, STYLE_NAMES, `${prefix} kit style`), shirt1: enumeration(set.shirt1, COLOUR_NAMES, `${prefix} kit shirt1`),
          shirt2: enumeration(set.shirt2, COLOUR_NAMES, `${prefix} kit shirt2`), shorts: enumeration(set.shorts, COLOUR_NAMES, `${prefix} kit shorts`), socks: enumeration(set.socks, COLOUR_NAMES, `${prefix} kit socks`)};
      };
      const kits = {first: kitSet('first'), second: kitSet('second')};
      const players = Array.isArray(team.players) ? team.players : [];
      if (players.length !== 16) fail(`expected 16 players, got ${players.length}`);
      return {...info, kit: kits, players: players.map((rawPlayer, j) => {
        context = {category: cat, team: i, player: j};
        const p = record(rawPlayer, ['name', 'number', 'position', 'role', 'head', 'star'], 'player');
        if (p.star !== undefined && typeof p.star !== 'boolean') fail('star must be a boolean');
        return {name: text(p.name, 'name', MAX_PLAYER_NAME), number: integer(p.number, 'number', 1, 16), position: enumeration(p.position, POSITION_NAMES, 'position'),
          role: enumeration(p.role, ROLE_NAMES, 'role'), head: enumeration(p.head, HEAD_NAMES, 'head'), ...(p.star === true ? {star: true} : {})};
      })};
    });
  }
  if (issues.length) throw new TeamDataError(issues);
  return output;
}

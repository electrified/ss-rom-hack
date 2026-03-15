import {
  CHARSET, CATEGORIES,
  MAX_TEAM_NAME, MAX_COUNTRY, MAX_COACH, MAX_PLAYER_NAME,
  COLOUR_VALUES, STYLE_VALUES, HEAD_VALUES, ROLE_VALUES,
  POSITION_VALUES, POSITION_NAMES, TACTIC_VALUES,
} from './constants.js';
import { findPointerTable, chainWalkRegion } from './decode.js';
import type { TeamsJson } from './types.js';

export interface TeamErrors {
  team: string[];
  formation: string[];
  players: Record<number, string[]>;
}

export interface ValidationResult {
  valid: boolean;
  global: string[];
  teams: Record<string, Record<number, TeamErrors>>;
}

/** Precomputed ROM structure — expected team counts per category. */
export interface RomStructure {
  teamCounts: Record<string, number>;
}

/** Extract ROM structure once so validation doesn't rescan the ROM. */
export function extractRomStructure(romBytes: Uint8Array): RomStructure {
  const ptrs = findPointerTable(romBytes);
  const regionInfo = [
    ['national', ptrs.natStart, ptrs.natEnd],
    ['club', ptrs.clubStart, ptrs.clubEnd],
    ['custom', ptrs.custStart, ptrs.custEnd],
  ] as const;

  const teamCounts: Record<string, number> = {};
  for (const [cat, start, end] of regionInfo) {
    teamCounts[cat] = chainWalkRegion(romBytes, start, end).length;
  }
  return { teamCounts };
}

function validateString(text: string): string[] {
  const bad: string[] = [];
  for (const c of text.toUpperCase()) {
    if (!CHARSET.includes(c)) bad.push(c);
  }
  return bad;
}

function checkEnum(val: string | number, allowed: Record<string, number>, maxInt: number, label: string): string | null {
  if (typeof val === 'string') {
    if (!(val in allowed)) {
      return `${label} must be one of ${JSON.stringify(Object.keys(allowed).sort())}, got '${val}'`;
    }
  } else if (val < 0 || val > maxInt) {
    return `${label} must be 0-${maxInt}, got ${val}`;
  }
  return null;
}

export function validateTeams(romStructure: RomStructure, teamsJson: unknown): ValidationResult {
  const result: ValidationResult = { valid: true, global: [], teams: {} };

  if (
    typeof teamsJson !== 'object' || teamsJson === null ||
    !CATEGORIES.every(k => k in (teamsJson as Record<string, unknown>))
  ) {
    result.global.push("JSON must contain 'national', 'club', 'custom' keys");
    result.valid = false;
    return result;
  }

  const teams = teamsJson as TeamsJson;

  function getTeamErrors(cat: string, i: number): TeamErrors {
    if (!result.teams[cat]) result.teams[cat] = {};
    if (!result.teams[cat][i]) result.teams[cat][i] = { team: [], formation: [], players: {} };
    return result.teams[cat][i];
  }

  function addTeam(cat: string, i: number, msg: string) {
    getTeamErrors(cat, i).team.push(msg);
    result.valid = false;
  }

  function addFormation(cat: string, i: number, msg: string) {
    getTeamErrors(cat, i).formation.push(msg);
    result.valid = false;
  }

  function addPlayer(cat: string, i: number, j: number, msg: string) {
    const te = getTeamErrors(cat, i);
    if (!te.players[j]) te.players[j] = [];
    te.players[j].push(msg);
    result.valid = false;
  }

  for (const cat of CATEGORIES) {
    const romCount = romStructure.teamCounts[cat] ?? 0;
    const jsonTeams = teams[cat];
    if (jsonTeams.length !== romCount) {
      result.global.push(`${cat}: expected ${romCount} teams, got ${jsonTeams.length}`);
      result.valid = false;
      continue;
    }
    for (let i = 0; i < jsonTeams.length; i++) {
      const team = jsonTeams[i];
      const players = team.players ?? [];
      if (players.length !== 16) {
        addTeam(cat, i, `expected 16 players, got ${players.length}`);
      }
      const textMaxLens: Record<string, number> = { team: MAX_TEAM_NAME, country: MAX_COUNTRY, coach: MAX_COACH };
      for (const label of ['team', 'country', 'coach'] as const) {
        const val = team[label] ?? '';
        const bad = validateString(val);
        if (bad.length) {
          addTeam(cat, i, `${label}: invalid chars ${JSON.stringify(bad)} in '${val}'`);
        }
        if (val.length > textMaxLens[label]) {
          addTeam(cat, i, `${label}: max ${textMaxLens[label]} characters, got ${val.length}`);
        }
      }

      let err = checkEnum(team.tactic ?? '4-4-2', TACTIC_VALUES, 7, 'tactic');
      if (err) addTeam(cat, i, err);
      if (team.skill < 0 || team.skill > 7) addTeam(cat, i, `skill must be 0-7, got ${team.skill}`);
      if (team.flag !== 0 && team.flag !== 1) addTeam(cat, i, `flag must be 0 or 1, got ${team.flag}`);

      if (team.kit) {
        for (const prefix of ['first', 'second'] as const) {
          const k = team.kit[prefix] ?? {};
          err = checkEnum(k.style ?? 'plain', STYLE_VALUES, 3, `${prefix} kit style`);
          if (err) addTeam(cat, i, err);
          for (const field of ['shirt1', 'shirt2', 'shorts', 'socks'] as const) {
            err = checkEnum(k[field] ?? 'white', COLOUR_VALUES, 15, `${prefix} kit ${field}`);
            if (err) addTeam(cat, i, err);
          }
        }
      }

      for (let j = 0; j < players.length; j++) {
        const p = players[j];
        if (typeof p !== 'object' || p === null) {
          addPlayer(cat, i, j, `expected object, got ${typeof p}`);
          continue;
        }
        const name = p.name ?? '';
        const bad = validateString(name);
        if (bad.length) {
          addPlayer(cat, i, j, `invalid chars ${JSON.stringify(bad)} in '${name}'`);
        }
        if (name.length > MAX_PLAYER_NAME) {
          addPlayer(cat, i, j, `name: max ${MAX_PLAYER_NAME} characters, got ${name.length}`);
        }
        if (p.number < 1 || p.number > 16) {
          addPlayer(cat, i, j, `number must be 1-16, got ${p.number}`);
        }
        for (const [field, allowed, maxInt, def] of [
          ['position', POSITION_VALUES, 15, 'goalkeeper'],
          ['role', ROLE_VALUES, 3, 'goalkeeper'],
          ['head', HEAD_VALUES, 2, 'white_dark'],
        ] as [string, Record<string, number>, number, string][]) {
          err = checkEnum((p as Record<string, string | number>)[field] ?? def, allowed, maxInt, field);
          if (err) addPlayer(cat, i, j, err);
        }
      }

      // Validate formation slot configuration
      const starterSlots: number[] = [];
      const playerSlots: { pos: number; idx: number }[] = [];
      let subCount = 0;
      for (let j = 0; j < players.length; j++) {
        const p = players[j];
        if (typeof p !== 'object' || p === null) continue;
        const posRaw = p.position ?? 'goalkeeper';
        const pos = typeof posRaw === 'string' ? (POSITION_VALUES[posRaw] ?? -1) : posRaw as number;
        if (pos === 15) {
          subCount++;
        } else {
          starterSlots.push(pos);
          playerSlots.push({ pos, idx: j });
        }
      }
      const expected = Array.from({ length: 11 }, (_, k) => k);
      const sortedSlots = [...starterSlots].sort((a, b) => a - b);
      if (JSON.stringify(sortedSlots) !== JSON.stringify(expected)) {
        const missingSet = new Set(expected);
        starterSlots.forEach(s => missingSet.delete(s));
        const dupedSet = new Set(starterSlots.filter((s, idx, a) => a.indexOf(s) !== idx));
        const missingNames = [...missingSet].sort((a, b) => a - b).map(s => POSITION_NAMES[s] ?? String(s));
        const dupedNames = [...dupedSet].sort((a, b) => a - b).map(s => POSITION_NAMES[s] ?? String(s));
        addFormation(cat, i, `formation slots invalid — missing ${JSON.stringify(missingNames)}, duplicated ${JSON.stringify(dupedNames)}`);

        // Flag individual players that occupy duplicated positions
        for (const { pos, idx: j } of playerSlots) {
          if (dupedSet.has(pos)) {
            addPlayer(cat, i, j, `duplicate position: ${POSITION_NAMES[pos] ?? String(pos)}`);
          }
        }
      }
      if (subCount !== 5) {
        addFormation(cat, i, `expected 5 subs, got ${subCount}`);
      }
    }
  }

  // Clean up empty entries
  for (const cat of Object.keys(result.teams)) {
    for (const idx of Object.keys(result.teams[cat])) {
      const te = result.teams[cat][Number(idx)];
      if (te.team.length === 0 && te.formation.length === 0 && Object.keys(te.players).length === 0) {
        delete result.teams[cat][Number(idx)];
      }
    }
    if (Object.keys(result.teams[cat]).length === 0) {
      delete result.teams[cat];
    }
  }

  return result;
}

import {
  CHARSET, CATEGORIES,
  COLOUR_VALUES, STYLE_VALUES, HEAD_VALUES, ROLE_VALUES,
  POSITION_VALUES, POSITION_NAMES, TACTIC_VALUES,
} from './constants.js';
import { findPointerTable, chainWalkRegion } from './decode.js';
import type { TeamsJson } from './types.js';

function validateString(text: string): string[] {
  const bad: string[] = [];
  for (const c of text.toUpperCase()) {
    if (!CHARSET.includes(c)) bad.push(c);
  }
  return bad;
}

function checkEnum(val: string | number, allowed: Record<string, number>, maxInt: number, context: string): string | null {
  if (typeof val === 'string') {
    if (!(val in allowed)) {
      return `${context} must be one of ${JSON.stringify(Object.keys(allowed).sort())}, got '${val}'`;
    }
  } else if (val < 0 || val > maxInt) {
    return `${context} must be 0-${maxInt}, got ${val}`;
  }
  return null;
}

/**
 * Validate teams JSON against the ROM structure.
 * Returns { errors, warnings } — both are arrays of strings.
 */
export function validateTeams(romBytes: Uint8Array, teamsJson: unknown): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (
    typeof teamsJson !== 'object' || teamsJson === null ||
    !CATEGORIES.every(k => k in (teamsJson as Record<string, unknown>))
  ) {
    errors.push("JSON must be a dict with 'national', 'club', 'custom' keys");
    return { errors, warnings };
  }

  const teams = teamsJson as TeamsJson;

  const ptrs = findPointerTable(romBytes);
  const regionInfo = [
    ['national', ptrs.natStart, ptrs.natEnd],
    ['club', ptrs.clubStart, ptrs.clubEnd],
    ['custom', ptrs.custStart, ptrs.custEnd],
  ] as const;

  const allBlockOffsets: Record<string, number[]> = {};
  for (const [cat, start, end] of regionInfo) {
    allBlockOffsets[cat] = chainWalkRegion(romBytes, start, end);
  }

  for (const [cat, ,] of regionInfo) {
    const romCount = allBlockOffsets[cat].length;
    const jsonTeams = teams[cat];
    if (jsonTeams.length !== romCount) {
      errors.push(`${cat}: expected ${romCount} teams in JSON, got ${jsonTeams.length}`);
      continue;
    }
    for (let i = 0; i < jsonTeams.length; i++) {
      const team = jsonTeams[i];
      const tname = team.team ?? '?';
      const players = team.players ?? [];
      if (players.length !== 16) {
        errors.push(`${cat} team ${i + 1} '${tname}': expected 16 players, got ${players.length}`);
      }
      for (const label of ['team', 'country', 'coach'] as const) {
        const bad = validateString(team[label] ?? '');
        if (bad.length) {
          errors.push(`${cat} team ${i + 1} '${tname}' ${label}: invalid chars ${JSON.stringify(bad)} in '${team[label]}'`);
        }
      }

      const ctx = `${cat} team ${i + 1} '${tname}'`;
      let err = checkEnum(team.tactic ?? '4-4-2', TACTIC_VALUES, 7, `${ctx}: tactic`);
      if (err) errors.push(err);
      if (team.skill < 0 || team.skill > 7) errors.push(`${ctx}: skill must be 0-7, got ${team.skill}`);
      if (team.flag !== 0 && team.flag !== 1) errors.push(`${ctx}: flag must be 0 or 1, got ${team.flag}`);

      if (team.kit) {
        for (const prefix of ['first', 'second'] as const) {
          const k = team.kit[prefix] ?? {};
          const kctx = `${ctx} ${prefix} kit`;
          err = checkEnum(k.style ?? 'plain', STYLE_VALUES, 3, `${kctx}: style`);
          if (err) errors.push(err);
          for (const field of ['shirt1', 'shirt2', 'shorts', 'socks'] as const) {
            err = checkEnum(k[field] ?? 'white', COLOUR_VALUES, 15, `${kctx}: ${field}`);
            if (err) errors.push(err);
          }
        }
      }

      for (let j = 0; j < players.length; j++) {
        const p = players[j];
        if (typeof p !== 'object' || p === null) {
          errors.push(`${ctx} player ${j + 1}: expected object, got ${typeof p}`);
          continue;
        }
        const bad = validateString(p.name ?? '');
        if (bad.length) {
          errors.push(`${ctx} player ${j + 1}: invalid chars ${JSON.stringify(bad)} in '${p.name}'`);
        }
        if (p.number < 1 || p.number > 16) {
          errors.push(`${ctx} player ${j + 1}: number must be 1-16, got ${p.number}`);
        }
        const pctx = `${ctx} player ${j + 1}`;
        for (const [field, allowed, maxInt, def] of [
          ['position', POSITION_VALUES, 15, 'goalkeeper'],
          ['role', ROLE_VALUES, 3, 'goalkeeper'],
          ['head', HEAD_VALUES, 2, 'white_dark'],
        ] as [string, Record<string, number>, number, string][]) {
          err = checkEnum((p as Record<string, string | number>)[field] ?? def, allowed, maxInt, `${pctx}: ${field}`);
          if (err) errors.push(err);
        }
      }

      // Validate formation slot configuration
      const starterSlots: number[] = [];
      let subCount = 0;
      for (const p of players) {
        if (typeof p !== 'object' || p === null) continue;
        const posRaw = p.position ?? 'goalkeeper';
        const pos = typeof posRaw === 'string' ? (POSITION_VALUES[posRaw] ?? -1) : posRaw as number;
        if (pos === 15) {
          subCount++;
        } else {
          starterSlots.push(pos);
        }
      }
      const expected = Array.from({ length: 11 }, (_, i) => i);
      const sortedSlots = [...starterSlots].sort((a, b) => a - b);
      if (JSON.stringify(sortedSlots) !== JSON.stringify(expected)) {
        const missingSet = new Set(expected);
        starterSlots.forEach(s => missingSet.delete(s));
        const dupedSet = new Set(starterSlots.filter((s, i, a) => a.indexOf(s) !== i));
        const missingNames = [...missingSet].sort((a, b) => a - b).map(s => POSITION_NAMES[s] ?? String(s));
        const dupedNames = [...dupedSet].sort((a, b) => a - b).map(s => POSITION_NAMES[s] ?? String(s));
        warnings.push(`${ctx}: formation slots invalid — missing ${JSON.stringify(missingNames)}, duplicated ${JSON.stringify(dupedNames)}`);
      }
      if (subCount !== 5) {
        warnings.push(`${ctx}: expected 5 subs, got ${subCount}`);
      }
    }
  }

  return { errors, warnings };
}

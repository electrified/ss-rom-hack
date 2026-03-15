import { describe, it, expect } from 'vitest';
import { validateTeams } from '../validate.js';
import type { RomStructure } from '../validate.js';

const romStructure: RomStructure = {
  teamCounts: { national: 1, club: 1, custom: 1 },
};

function makePlayer(overrides: Record<string, unknown> = {}) {
  return {
    name: 'SMITH',
    number: 1,
    position: 'goalkeeper',
    role: 'goalkeeper',
    head: 'white_dark',
    ...overrides,
  };
}

function makeTeam(overrides: Record<string, unknown> = {}) {
  return {
    team: 'ENGLAND',
    country: 'ENGLAND',
    coach: 'SMITH',
    tactic: '4-4-2',
    skill: 3,
    flag: 0,
    kit: {
      first: { style: 'plain', shirt1: 'white', shirt2: 'red', shorts: 'white', socks: 'white' },
      second: { style: 'plain', shirt1: 'blue', shirt2: 'blue', shorts: 'blue', socks: 'blue' },
    },
    players: [
      makePlayer({ position: 'goalkeeper', role: 'goalkeeper' }),
      makePlayer({ position: 'right_back', role: 'defender', number: 2 }),
      makePlayer({ position: 'left_back', role: 'defender', number: 3 }),
      makePlayer({ position: 'centre_back', role: 'defender', number: 4 }),
      makePlayer({ position: 'defender', role: 'defender', number: 5 }),
      makePlayer({ position: 'right_midfielder', role: 'midfielder', number: 6 }),
      makePlayer({ position: 'centre_midfielder', role: 'midfielder', number: 7 }),
      makePlayer({ position: 'left_midfielder', role: 'midfielder', number: 8 }),
      makePlayer({ position: 'midfielder', role: 'midfielder', number: 9 }),
      makePlayer({ position: 'forward', role: 'forward', number: 10 }),
      makePlayer({ position: 'second_forward', role: 'forward', number: 11 }),
      makePlayer({ position: 'sub', role: 'forward', number: 12 }),
      makePlayer({ position: 'sub', role: 'forward', number: 13 }),
      makePlayer({ position: 'sub', role: 'midfielder', number: 14 }),
      makePlayer({ position: 'sub', role: 'defender', number: 15 }),
      makePlayer({ position: 'sub', role: 'goalkeeper', number: 16 }),
    ],
    ...overrides,
  };
}

function makeTeamsJson(overrides: Record<string, unknown[]> = {}) {
  return {
    national: [makeTeam()],
    club: [makeTeam()],
    custom: [makeTeam()],
    ...overrides,
  };
}

/** Collect all error strings from a validation result. */
function allErrors(result: ReturnType<typeof validateTeams>): string[] {
  const msgs = [...result.global];
  for (const catTeams of Object.values(result.teams)) {
    for (const te of Object.values(catTeams)) {
      msgs.push(...te.team, ...te.formation);
      for (const playerMsgs of Object.values(te.players)) {
        msgs.push(...playerMsgs);
      }
    }
  }
  return msgs;
}

describe('validateTeams', () => {
  it('passes a valid minimal team JSON with no errors', () => {
    const result = validateTeams(romStructure, makeTeamsJson());
    expect(result.valid).toBe(true);
    expect(allErrors(result)).toHaveLength(0);
  });

  it('errors on missing top-level keys', () => {
    const result = validateTeams(romStructure, { national: [] });
    expect(result.valid).toBe(false);
    expect(result.global[0]).toMatch(/national.*club.*custom/i);
  });

  it('errors on invalid character in team name', () => {
    const result = validateTeams(romStructure, makeTeamsJson({
      national: [makeTeam({ team: 'ENGLAND!' })],
    }));
    expect(result.valid).toBe(false);
    const errors = allErrors(result);
    expect(errors.some(e => e.includes('!') || e.includes('invalid chars'))).toBe(true);
  });

  it('errors on wrong player count', () => {
    const result = validateTeams(romStructure, makeTeamsJson({
      national: [makeTeam({ players: Array.from({ length: 15 }, () => makePlayer()) })],
    }));
    expect(result.valid).toBe(false);
    const errors = allErrors(result);
    expect(errors.some(e => e.includes('16 players'))).toBe(true);
  });

  it('errors on invalid tactic', () => {
    const result = validateTeams(romStructure, makeTeamsJson({
      national: [makeTeam({ tactic: '3-4-3' })],
    }));
    expect(result.valid).toBe(false);
    const errors = allErrors(result);
    expect(errors.some(e => e.includes('tactic'))).toBe(true);
  });

  it('flags formation missing goalkeeper slot', () => {
    const players = makeTeam().players.map((p: Record<string, unknown>, i: number) =>
      i === 0 ? { ...p, position: 'right_back' } : p
    );
    const result = validateTeams(romStructure, makeTeamsJson({
      national: [makeTeam({ players })],
    }));
    expect(result.valid).toBe(false);
    const errors = allErrors(result);
    expect(errors.some(e => e.includes('formation slots invalid'))).toBe(true);
  });

  it('flags wrong sub count', () => {
    const players = [...makeTeam().players];
    players[11] = makePlayer({ position: 'second_forward', role: 'forward', number: 12 });
    const result = validateTeams(romStructure, makeTeamsJson({
      national: [makeTeam({ players })],
    }));
    expect(result.valid).toBe(false);
    const errors = allErrors(result);
    expect(errors.some(e => e.includes('subs'))).toBe(true);
  });

  it('errors on invalid skill value', () => {
    const result = validateTeams(romStructure, makeTeamsJson({
      national: [makeTeam({ skill: 10 })],
    }));
    expect(result.valid).toBe(false);
    const errors = allErrors(result);
    expect(errors.some(e => e.includes('skill'))).toBe(true);
  });
});

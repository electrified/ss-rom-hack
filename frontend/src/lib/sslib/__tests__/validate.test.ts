import { describe, it, expect, vi } from 'vitest';
import { validateTeams } from '../validate.js';

// validateTeams requires a real ROM to find the pointer table.
// We mock the decode module's findPointerTable and chainWalkRegion
// to isolate the validation logic.
vi.mock('../decode.js', () => ({
  findPointerTable: vi.fn(() => ({
    natStart: 0x020000, natEnd: 0x021000,
    clubStart: 0x021002, clubEnd: 0x022000,
    custStart: 0x022002, custEnd: 0x023000,
    tableBase: 0x001000,
  })),
  chainWalkRegion: vi.fn(() => Array.from({ length: 1 }, (_, i) => i * 160)),
}));

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

const fakeRom = new Uint8Array(0x030000);

describe('validateTeams', () => {
  it('passes a valid minimal team JSON with no errors', () => {
    const { errors, warnings } = validateTeams(fakeRom, makeTeamsJson());
    expect(errors).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });

  it('errors on missing top-level keys', () => {
    const { errors } = validateTeams(fakeRom, { national: [] });
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toMatch(/national.*club.*custom/i);
  });

  it('errors on invalid character in team name', () => {
    const { errors } = validateTeams(fakeRom, makeTeamsJson({
      national: [makeTeam({ team: 'ENGLAND!' })],
    }));
    expect(errors.some(e => e.includes('!') || e.includes('invalid chars'))).toBe(true);
  });

  it('errors on wrong player count', () => {
    const { errors } = validateTeams(fakeRom, makeTeamsJson({
      national: [makeTeam({ players: Array.from({ length: 15 }, () => makePlayer()) })],
    }));
    expect(errors.some(e => e.includes('16 players'))).toBe(true);
  });

  it('errors on invalid tactic', () => {
    const { errors } = validateTeams(fakeRom, makeTeamsJson({
      national: [makeTeam({ tactic: '3-4-3' })],
    }));
    expect(errors.some(e => e.includes('tactic'))).toBe(true);
  });

  it('warns on formation missing goalkeeper slot', () => {
    // Replace goalkeeper with a second right_back
    const players = makeTeam().players.map((p: Record<string, unknown>, i: number) =>
      i === 0 ? { ...p, position: 'right_back' } : p
    );
    const { warnings } = validateTeams(fakeRom, makeTeamsJson({
      national: [makeTeam({ players })],
    }));
    expect(warnings.some(w => w.includes('formation slots invalid'))).toBe(true);
  });

  it('warns on wrong sub count', () => {
    // Give only 4 subs instead of 5 (replace one sub with a forward at position 10)
    const players = [...makeTeam().players];
    // position 10 = second_forward, already used, so use a dup position to force wrong subs
    players[11] = makePlayer({ position: 'second_forward', role: 'forward', number: 12 });
    const { warnings } = validateTeams(fakeRom, makeTeamsJson({
      national: [makeTeam({ players })],
    }));
    expect(warnings.some(w => w.includes('subs'))).toBe(true);
  });

  it('errors on invalid skill value', () => {
    const { errors } = validateTeams(fakeRom, makeTeamsJson({
      national: [makeTeam({ skill: 10 })],
    }));
    expect(errors.some(e => e.includes('skill'))).toBe(true);
  });
});

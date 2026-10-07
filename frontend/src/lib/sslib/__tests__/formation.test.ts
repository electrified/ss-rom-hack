import {describe, expect, it} from 'vitest';
import {assignPosition, changeFormation, expectedRole, positionLabel} from '../formation';
import {POSITION_NAMES, ROLE_NAMES} from '../constants';
import {fixtureTeams, fixtureRom} from './fixtures';
import {decodeRom, updateRom, validateTeams, extractRomStructure} from '../index';

// Role-word values read independently from the original ROM formation tables.
// International: 0x16034; Original/European: 0x1603c. Both editions agree.
const reference: Record<string, string> = {
  '4-4-2': '01111222233', '5-4-1': '01111212223',
  '4-5-1': '01111222223', '5-3-2': '01111212233',
  '3-5-2': '01121222233', '4-3-3': '01111223233',
  'Attack': '01121233233', 'Defend': '01111211223',
};
describe('formation roles', () => {
  for (const formation of ['Attack', 'Defend']) it(`round-trips the named ${formation} formation`, () => {
    const teams = fixtureTeams();
    teams.national[0].formation = formation;
    expect(decodeRom(updateRom(fixtureRom(), teams)).national[0].formation).toBe(formation);
  });
  for (const [formation, words] of Object.entries(reference)) it(`matches ROM roles and player counts for ${formation}`, () => {
    const roles = Array.from({length: 11}, (_, slot) => expectedRole(formation, POSITION_NAMES[slot]));
    expect(roles).toEqual([...words].map(word => ROLE_NAMES[Number(word)]));
    expect(['defender','midfielder','forward'].map(role => roles.filter(r => r === role).length)).toEqual((formation === 'Attack' ? [3,3,4] : formation === 'Defend' ? [6,3,1] : formation.split('-').map(Number)));
    expect(expectedRole(formation, 'sub')).toBeUndefined();
  });
  it('labels formation-dependent slots without misleading midfield labels', () => {
    expect(positionLabel('4-4-2','centre_midfielder')).toBe('Centre midfield');
    expect(positionLabel('5-4-1','centre_midfielder')).toBe('Defender (slot 7)');
  });
  it('changes both fields explicitly and handles each substitute type without mutating the input', () => {
    const player = fixtureTeams().national[0].players[0];
    expect(assignPosition(player,'5-4-1','centre_midfielder')).toMatchObject({position:'centre_midfielder',role:'defender'});
    for (const role of Object.values(ROLE_NAMES)) expect(assignPosition(player,'4-4-2','sub',role)).toMatchObject({position:'sub',role});
    expect(player).toMatchObject({position:'goalkeeper',role:'goalkeeper'});
    expect(() => assignPosition(player,'4-4-2','sub','invalid')).toThrow();
  });
  it('updates matching starters on formation changes, preserves mismatches and substitutes', () => {
    const team = fixtureTeams().national[0];
    team.players[6].role = 'midfielder';
    team.players[9].role = 'defender';
    const result = changeFormation(team,'5-4-1');
    expect(result.players[6].role).toBe('defender');
    expect(result.players[9].role).toBe('defender');
    expect(result.players.slice(11)).toEqual(team.players.slice(11));
    expect(team.players[6].role).toBe('midfielder');
  });
  it('preserves mismatches through JSON, validation and ROM updates', () => {
    const teams = fixtureTeams();
    teams.national[0].players[5].role = 'defender';
    const saved = JSON.parse(JSON.stringify(teams));
    const rom = fixtureRom();
    expect(validateTeams(extractRomStructure(rom), saved).valid).toBe(true);
    expect(decodeRom(updateRom(rom,saved))).toEqual(teams);
  });
  it('lists every missing and duplicate slot without changing assignments', () => {
    const teams = fixtureTeams();
    teams.national[0].players[5].position = 'centre_midfielder';
    teams.national[0].players[9].position = 'second_forward';
    const before = JSON.stringify(teams);
    const result = validateTeams(extractRomStructure(fixtureRom()), teams);
    expect(result.teams.national[0].formation).toEqual([
      'Formation: Centre midfield has 2 players.',
      'Formation: Second forward has 2 players.',
      'Missing formation positions: Right midfield, Forward.',
    ]);
    expect(Object.keys(result.teams.national[0].players)).toEqual(['5','6','9','10']);
    expect(JSON.stringify(teams)).toBe(before);
  });
});

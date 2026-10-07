import { POSITION_VALUES, ROLE_NAMES } from './constants';
import type { Player, Team } from './types';

// Eleven big-endian role words per formation. Verified in both supported ROMs:
// International pointer table 0x16034; Original/European pointer table 0x1603c.
const FORMATION_ROLES: Record<string, readonly number[]> = {
  '4-4-2': [0,1,1,1,1,2,2,2,2,3,3],
  '5-4-1': [0,1,1,1,1,2,1,2,2,2,3],
  '4-5-1': [0,1,1,1,1,2,2,2,2,2,3],
  '5-3-2': [0,1,1,1,1,2,1,2,2,3,3],
  '3-5-2': [0,1,1,2,1,2,2,2,2,3,3],
  '4-3-3': [0,1,1,1,1,2,2,3,2,3,3],
  'Attack': [0,1,1,2,1,2,3,3,2,3,3],
  'Defend': [0,1,1,1,1,2,1,1,2,2,3],
};
export const ROLE_LABELS: Record<string, string> = {
  goalkeeper: 'Goalkeeper', defender: 'Defender', midfielder: 'Midfielder', forward: 'Forward',
};
const SLOT_LABELS = ['Goalkeeper', 'Right back', 'Left back', 'Centre back', 'Defender',
  'Right midfield', 'Centre midfield', 'Left midfield', 'Midfielder', 'Forward', 'Second forward'];
export function expectedRole(formation: string, position: string): string | undefined {
  const role = FORMATION_ROLES[formation]?.[POSITION_VALUES[position]];
  return role === undefined ? undefined : ROLE_NAMES[role];
}
export function positionLabel(formation: string, position: string): string {
  const slot = POSITION_VALUES[position];
  if (position === 'sub') return 'Substitute';
  const role = expectedRole(formation, position);
  if (role && role !== expectedRole('4-4-2', position)) return `${ROLE_LABELS[role]} (slot ${slot + 1})`;
  return SLOT_LABELS[slot] ?? position;
}
/** Explicit UI assignment; loading and validation never call this. */
export function assignPosition(player: Player, formation: string, position: string, substituteRole?: string): Player {
  const role = position === 'sub' ? substituteRole : expectedRole(formation, position);
  if (!role || !Object.prototype.hasOwnProperty.call(ROLE_LABELS, role)) throw new Error('Unsupported position or role');
  return {...player, position, role};
}
export function changeFormation(team: Team, formation: string): Team {
  if (!FORMATION_ROLES[formation]) throw new Error('Unsupported formation');
  return {...team, formation, players: team.players.map(player => {
    const oldRole = expectedRole(team.formation, player.position);
    const newRole = expectedRole(formation, player.position);
    return oldRole && newRole && player.role === oldRole ? {...player, role: newRole} : player;
  })};
}

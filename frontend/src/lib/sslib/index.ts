export { decodeRom } from './decode.js';
export { validateTeams, extractRomStructure } from './validate.js';
export type { ValidationResult, TeamErrors, RomStructure } from './validate.js';
export { updateRom } from './update.js';
export type { TeamsJson, Team, Player, Kit, KitColour, PointerTable } from './types.js';
export {
  CHARSET, CATEGORIES,
  MAX_TEAM_NAME, MAX_COUNTRY, MAX_COACH, MAX_PLAYER_NAME,
  COLOUR_NAMES, COLOUR_VALUES,
  STYLE_NAMES, STYLE_VALUES,
  HEAD_NAMES, HEAD_VALUES,
  TACTIC_NAMES, TACTIC_VALUES,
  ROLE_NAMES, ROLE_VALUES,
  POSITION_NAMES, POSITION_VALUES,
} from './constants.js';

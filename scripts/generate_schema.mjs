import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';
import {
  CATEGORIES, COLOUR_VALUES, STYLE_VALUES, TACTIC_VALUES, POSITION_VALUES,
  ROLE_VALUES, HEAD_VALUES, MAX_TEAM_NAME, MAX_COUNTRY, MAX_COACH, MAX_PLAYER_NAME,
} from '../frontend/src/lib/sslib/constants.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const obj = (properties, required = Object.keys(properties)) => ({
  type: 'object', required, additionalProperties: false, properties,
});
const text = maxLength => ({type: 'string', pattern: "^[A-Z .'-]*$", maxLength});
const enumeration = values => ({type: 'string', enum: Object.keys(values)});
const integer = (minimum, maximum) => ({type: 'integer', minimum, maximum});
const player = obj({
  name: text(MAX_PLAYER_NAME), number: integer(1, 16), position: enumeration(POSITION_VALUES),
  role: enumeration(ROLE_VALUES), head: enumeration(HEAD_VALUES), star: {type: 'boolean'},
}, ['name', 'number', 'position', 'role', 'head']);
const kitSet = obj({style: enumeration(STYLE_VALUES), ...Object.fromEntries(
  ['shirt1', 'shirt2', 'shorts', 'socks'].map(key => [key, enumeration(COLOUR_VALUES)]),
)});
const team = obj({
  team: text(MAX_TEAM_NAME), country: text(MAX_COUNTRY), coach: text(MAX_COACH),
  tactic: enumeration(TACTIC_VALUES), skill: integer(0, 7), flag: integer(0, 1),
  kit: obj(Object.fromEntries(['first', 'second'].map(key => [key, {$ref: '#/$defs/kitSet'}]))),
  players: {type: 'array', items: {$ref: '#/$defs/player'}, minItems: 16, maxItems: 16},
}, ['team', 'country', 'coach', 'tactic', 'skill', 'flag', 'kit', 'players']);
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'Sensible Soccer canonical team data', description: 'Canonical team data format.',
  ...obj({$schema: {type: 'string'}, ...Object.fromEntries(CATEGORIES.map(key => [key, {
    type: 'array', items: {$ref: '#/$defs/team'},
  }]))}, [...CATEGORIES]),
  $defs: {team, player, kitSet},
};
const target = resolve(root, 'teams.schema.json');
const contents = `${JSON.stringify(schema, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== contents) {
    console.error('teams.schema.json is stale: run npm run schema:generate in frontend');
    process.exitCode = 1;
  }
} else {
  writeFileSync(target, contents);
}

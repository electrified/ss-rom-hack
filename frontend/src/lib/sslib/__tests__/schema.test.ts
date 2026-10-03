import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020';
import { fixtureTeams } from './fixtures';
const schema=JSON.parse(readFileSync('../teams.schema.json','utf8'));
const validate=new Ajv2020({strict: true}).compile(schema);
it('canonical fixture conforms to the generated schema',()=>{
  expect(validate(fixtureTeams()),JSON.stringify(validate.errors)).toBe(true);
});
it('schema catches missing structure, invalid enums and overlong text',()=>{
  for(const mutate of [(t:any)=>delete t.kit,(t:any)=>t.players[0].position='wrong',(t:any)=>t.country='A'.repeat(20),(t:any)=>t.team='A\0B']){const d=fixtureTeams();mutate(d.national[0]);expect(validate(d)).toBe(false);}
});

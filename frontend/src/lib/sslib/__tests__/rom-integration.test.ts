import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeRom, extractRomStructure, updateRom, validateTeams } from '../index';
import { findPointerTable } from '../decode';
import { ATTRIBUTE_BYTES, TEXT_POSITION_OFFSETS, KNOWN_POINTER_TABLES } from '../rom-format';

for (const filename of ['ssint_orig.md', 'ss_orig.md']) {
  describe(`${filename} integration`, () => {
    const original = new Uint8Array(readFileSync(`../${filename}`));
    const pointers = findPointerTable(original);

    it('round-trips the stock ROM without changing any byte', () => {
      const teams = decodeRom(original);
      expect(validateTeams(extractRomStructure(original), teams).valid).toBe(true);
      expect(updateRom(original, teams)).toEqual(original);
    });

    it('edits a team while leaving code and following ROM data untouched', () => {
      const teams = decodeRom(original);
      const oldName = teams.national[0].team;
      teams.national[0].team = `${oldName[0] === 'A' ? 'B' : 'A'}${oldName.slice(1)}`;

      const result = updateRom(original, teams);
      expect(decodeRom(result)).toEqual(teams);
      expect(result).not.toEqual(original);
      expect(result.slice(pointers.custEnd)).toEqual(original.slice(pointers.custEnd));
      expect(result.slice(0x200, pointers.natStart)).toEqual(original.slice(0x200, pointers.natStart));
      const view = new DataView(result.buffer);
      let checksum = 0;
      for (let i = 0x200; i < result.length; i += 2) checksum = (checksum + view.getUint16(i)) & 0xffff;
      expect(view.getUint16(0x18e)).toBe(checksum);
      expect(original).toEqual(new Uint8Array(readFileSync(`../${filename}`)));
    });
  });
}

describe('ROM format provenance', () => {
  const editions = [
    { filename: 'ssint_orig.md', table: 0x1ef22, offsets: 0x19630,
      start: 0x20576, end: 0x2d5c6 },
    { filename: 'ss_orig.md', table: 0x1ea42, offsets: 0x193a6,
      start: 0x1feac, end: 0x2c146 },
  ];

  it('matches the observed format tables and region bounds in both editions', () => {
    expect(ATTRIBUTE_BYTES).toBe(150);
    expect(TEXT_POSITION_OFFSETS).toEqual([2, 4, 6, 22, 30, 38, 46, 54, 62, 70,
      78, 86, 94, 102, 110, 118, 126, 134, 142]);
    expect(KNOWN_POINTER_TABLES).toEqual(editions.map(({ table }) => table));

    editions.forEach(({ filename, table, offsets, start, end }): void => {
      const rom = new Uint8Array(readFileSync(`../${filename}`));
      const view = new DataView(rom.buffer);
      expect(TEXT_POSITION_OFFSETS.map((_, index): number => view.getUint16(offsets + index * 2)))
        .toEqual(TEXT_POSITION_OFFSETS);
      expect(view.getUint32(table)).toBe(start);
      expect(view.getUint32(table + 20)).toBe(end);
      expect(findPointerTable(rom).tableBase).toBe(table);
    });
  });
});

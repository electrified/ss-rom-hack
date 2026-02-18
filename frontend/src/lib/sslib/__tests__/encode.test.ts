import { describe, it, expect } from 'vitest';
import { encode5bitString, pack5bitValues, computePackedPositions, encodeTeamText } from '../encode.js';
import { CHARSET } from '../constants.js';

describe('encode5bitString', () => {
  it('encodes ENGLAND correctly', () => {
    // E=5, N=14, G=7, L=12, A=1, N=14, D=4, null=0
    expect(encode5bitString('ENGLAND')).toEqual([5, 14, 7, 12, 1, 14, 4, 0]);
  });

  it('encodes empty string as just null terminator', () => {
    expect(encode5bitString('')).toEqual([0]);
  });

  it('is case-insensitive', () => {
    expect(encode5bitString('england')).toEqual(encode5bitString('ENGLAND'));
  });

  it('encodes all CHARSET characters', () => {
    const chars = CHARSET.slice(1); // skip null char
    for (let i = 0; i < chars.length; i++) {
      const result = encode5bitString(chars[i]);
      expect(result[0]).toBe(i + 1);
      expect(result[result.length - 1]).toBe(0); // null terminator
    }
  });
});

describe('pack5bitValues', () => {
  it('packs [1, 0] to correct bytes', () => {
    // 5-bit 1 = 00001, 5-bit 0 = 00000
    // bitstream: 00001_00000 = 10 bits
    // byte 0: top 8 bits = 00001_000 = 0x08
    // remainder: 00 (2 bits), padded to byte: 00_000000 = 0x00
    const { bytes } = pack5bitValues([1, 0]);
    expect(bytes[0]).toBe(0x08);
    expect(bytes[1]).toBe(0x00);
  });

  it('totalBits equals values.length * 5', () => {
    const { totalBits } = pack5bitValues([5, 14, 7, 12, 1, 14, 4, 0]);
    expect(totalBits).toBe(8 * 5);
  });

  it('packs and length is ceil(values * 5 / 8)', () => {
    const vals = [1, 2, 3, 4, 5];
    const { bytes } = pack5bitValues(vals);
    expect(bytes.length).toBe(Math.ceil(vals.length * 5 / 8));
  });
});

describe('computePackedPositions', () => {
  it('returns 19 positions', () => {
    // Create a minimal text block with 19 null-terminated strings
    // Simplest: 19 strings each consisting of just one char + null
    const allValues: number[] = [];
    for (let i = 0; i < 19; i++) {
      allValues.push(1, 0); // 'A' + null
    }
    const { bytes } = pack5bitValues(allValues);
    const positions = computePackedPositions(bytes);
    expect(positions).toHaveLength(19);
  });

  it('first position starts at ATTR_SIZE (byte offset 150, bit 0)', () => {
    const allValues: number[] = [];
    for (let i = 0; i < 19; i++) allValues.push(1, 0);
    const { bytes } = pack5bitValues(allValues);
    const positions = computePackedPositions(bytes);
    // First position: byte 150, bit 0 => (150 << 5) | 0 = 4800
    expect(positions[0]).toBe(150 << 5);
  });

  it('position format encodes byte and bit offset', () => {
    const allValues: number[] = [];
    for (let i = 0; i < 19; i++) allValues.push(1, 0);
    const { bytes } = pack5bitValues(allValues);
    const positions = computePackedPositions(bytes);
    for (const pos of positions) {
      const byteOff = pos >> 5;
      const bitOff = pos & 0x1F;
      expect(byteOff).toBeGreaterThanOrEqual(150);
      expect(bitOff).toBeLessThan(16); // bit offset should be < 16
    }
  });
});

describe('encodeTeamText', () => {
  it('produces non-empty bytes', () => {
    const team = {
      team: 'ENGLAND',
      country: 'ENGLAND',
      coach: 'SMITH',
      players: Array.from({ length: 16 }, (_, i) => ({ name: `PLAYER` })),
    };
    const bytes = encodeTeamText(team);
    expect(bytes.length).toBeGreaterThan(0);
  });
});

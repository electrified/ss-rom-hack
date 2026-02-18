import { describe, it, expect } from 'vitest';
import { encode5bitString, pack5bitValues, encodeTeamText, computePackedPositions } from '../encode.js';
import { decode5bitString } from '../decode.js';
import { ATTR_SIZE } from '../constants.js';

describe('encode/decode roundtrip', () => {
  const testStrings = [
    'A',
    'AB',
    'ENGLAND',
    'SMITH',
    'ST JAMES',
    "O'BRIEN",
    'NOTTS CO',
    'SHEFFIELD',
    'REPUBLIC OF IRELAND',
  ];

  for (const s of testStrings) {
    it(`round-trips "${s}"`, () => {
      const values = encode5bitString(s);
      const { bytes } = pack5bitValues(values);
      const [decoded] = decode5bitString(bytes, 0, 0);
      expect(decoded).toBe(s);
    });
  }
});

describe('multi-string roundtrip', () => {
  it('round-trips 19 strings packed together', () => {
    const strings = [
      'ENGLAND', 'ENGLAND', 'SMITH',
      ...Array.from({ length: 16 }, (_, i) => `PLAYER ${String.fromCharCode(65 + i % 26)}`),
    ];
    // Note: spaces are valid in CHARSET
    const allValues: number[] = [];
    for (const s of strings) allValues.push(...encode5bitString(s));
    const { bytes } = pack5bitValues(allValues);

    let bitPos = 0;
    for (const s of strings) {
      const [decoded, nextBit] = decode5bitString(bytes, 0, bitPos);
      expect(decoded).toBe(s);
      bitPos = nextBit;
    }
  });
});

describe('computePackedPositions roundtrip', () => {
  it('positions allow correct re-decoding of each string', () => {
    const teamStrings = [
      'ENGLAND', 'ENGLAND', 'SMITH',
      'JONES', 'SMITH', 'BROWN', 'DAVIS', 'WILSON',
      'MOORE', 'TAYLOR', 'THOMAS', 'JACKSON', 'WHITE',
      'HARRIS', 'MARTIN', 'THOMPSON', 'GARCIA', 'MARTINEZ',
      'ROBINSON',
    ];

    const allValues: number[] = [];
    for (const s of teamStrings) allValues.push(...encode5bitString(s));
    const { bytes: textBytes } = pack5bitValues(allValues);

    const positions = computePackedPositions(textBytes);
    expect(positions).toHaveLength(19);

    // Reconstruct the full block (attr bytes + text bytes) as decode expects
    const fullBlock = new Uint8Array(ATTR_SIZE + textBytes.length);
    fullBlock.set(textBytes, ATTR_SIZE);

    for (let i = 0; i < 19; i++) {
      const packedPos = positions[i];
      const byteOff = packedPos >> 5;
      const bitOff = packedPos & 0x1F;
      const [decoded] = decode5bitString(fullBlock, byteOff, bitOff);
      expect(decoded).toBe(teamStrings[i]);
    }
  });
});

describe('full team block roundtrip', () => {
  it('encodes and re-decodes a team', () => {
    const team = {
      team: 'ENGLAND',
      country: 'ENGLAND',
      coach: 'VENABLES',
      players: [
        { name: 'SEAMAN' },
        { name: 'DIXON' },
        { name: 'PEARCE' },
        { name: 'ADAMS' },
        { name: 'WALKER' },
        { name: 'PLATT' },
        { name: 'GASCOIGNE' },
        { name: 'INCE' },
        { name: 'ANDERTON' },
        { name: 'SHERINGHAM' },
        { name: 'SHEARER' },
        { name: 'FLOWERS' },
        { name: 'JONES' },
        { name: 'BOULD' },
        { name: 'VENISON' },
        { name: 'FOWLER' },
      ],
    };

    const textBytes = encodeTeamText(team);
    const positions = computePackedPositions(textBytes);
    expect(positions).toHaveLength(19);

    // Decode team name from position[0]
    const fullBlock = new Uint8Array(ATTR_SIZE + textBytes.length);
    fullBlock.set(textBytes, ATTR_SIZE);

    const [teamName] = decode5bitString(fullBlock, positions[0] >> 5, positions[0] & 0x1F);
    expect(teamName).toBe('ENGLAND');

    const [country] = decode5bitString(fullBlock, positions[1] >> 5, positions[1] & 0x1F);
    expect(country).toBe('ENGLAND');

    const [coach] = decode5bitString(fullBlock, positions[2] >> 5, positions[2] & 0x1F);
    expect(coach).toBe('VENABLES');

    for (let i = 0; i < 16; i++) {
      const [name] = decode5bitString(fullBlock, positions[3 + i] >> 5, positions[3 + i] & 0x1F);
      expect(name).toBe(team.players[i].name);
    }
  });
});

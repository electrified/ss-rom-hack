import { describe, it, expect } from 'vitest';
import { decode5bitString, decodeKitAttrs, decodeTeamAttrs, decodePlayerAttrs, chainWalkRegion } from '../decode.js';
import { pack5bitValues, encode5bitString } from '../encode.js';

describe('decode5bitString', () => {
  it('decodes ENGLAND', () => {
    // E=5, N=14, G=7, L=12, A=1, N=14, D=4, null=0
    const values = [5, 14, 7, 12, 1, 14, 4, 0];
    const { bytes } = pack5bitValues(values);
    const [decoded] = decode5bitString(bytes, 0, 0);
    expect(decoded).toBe('ENGLAND');
  });

  it('decodes empty string', () => {
    const { bytes } = pack5bitValues([0]);
    const [decoded] = decode5bitString(bytes, 0, 0);
    expect(decoded).toBe('');
  });

  it('round-trips various strings', () => {
    for (const s of ['A', 'AB', 'HELLO', 'SMITH', 'ST JAMES']) {
      const values = encode5bitString(s);
      const { bytes } = pack5bitValues(values);
      const [decoded] = decode5bitString(bytes, 0, 0);
      expect(decoded).toBe(s);
    }
  });

  it('advances bit position by 5 per char plus null', () => {
    const values = encode5bitString('ABC'); // 3 chars + null = 4 values = 20 bits
    const { bytes } = pack5bitValues(values);
    const [, nextBit] = decode5bitString(bytes, 0, 0);
    expect(nextBit).toBe(20); // 4 * 5
  });
});

describe('decodeKitAttrs', () => {
  it('decodes known kit values', () => {
    // Build a 28-byte block (at least offset 8..17 needed)
    const block = new Uint8Array(30);
    const b = 8;
    // first: style=1(sleeves), shirt1=0x02(white), shirt2=0x0A(red), shorts=0x0B(blue), socks=0x0F(yellow)
    block[b] = 1;
    block[b + 1] = 0x02;
    block[b + 2] = 0x0A;
    block[b + 3] = 0x0B;
    block[b + 4] = 0x0F;
    // second: style=0(plain), shirt1=0x0E(green), shirt2=0x03(black), shorts=0x04(brown), socks=0x01(grey)
    block[b + 5] = 0;
    block[b + 6] = 0x0E;
    block[b + 7] = 0x03;
    block[b + 8] = 0x04;
    block[b + 9] = 0x01;

    const kit = decodeKitAttrs(block, 0);
    expect(kit.first.style).toBe('sleeves');
    expect(kit.first.shirt1).toBe('white');
    expect(kit.first.shirt2).toBe('red');
    expect(kit.first.shorts).toBe('blue');
    expect(kit.first.socks).toBe('yellow');
    expect(kit.second.style).toBe('plain');
    expect(kit.second.shirt1).toBe('green');
    expect(kit.second.shirt2).toBe('black');
    expect(kit.second.shorts).toBe('brown');
    expect(kit.second.socks).toBe('grey');
  });

  it('decodes all-zero attrs without throwing', () => {
    const block = new Uint8Array(30);
    expect(() => decodeKitAttrs(block, 0)).not.toThrow();
  });
});

describe('decodeTeamAttrs', () => {
  it('decodes tactic, skill, flag', () => {
    const block = new Uint8Array(30);
    // tactic at byte 19 = 5 => "4-3-3"
    block[19] = 5;
    // byte 21: skill bits [5:3]=3, flag bit[0]=1 => 0b00011001 = 0x19
    block[21] = (3 << 3) | 1;

    const attrs = decodeTeamAttrs(block, 0);
    expect(attrs.tactic).toBe('4-3-3');
    expect(attrs.skill).toBe(3);
    expect(attrs.flag).toBe(1);
  });
});

describe('decodePlayerAttrs', () => {
  it('decodes a player record', () => {
    const block = new Uint8Array(150);
    const base = 22;
    // Player 0: skip 2-byte text pos, then at recOff=base+2
    const recOff = base + 2;
    // posByte: pos_slot=3(centre_back) in [7:4], number-1=4 in [3:0] => 0x34
    block[recOff] = (3 << 4) | 4;
    // appByte: star=0, role=1(defender) in [3:2], head=2(black_dark) in [1:0] => 0x06
    block[recOff + 1] = (0 << 4) | (1 << 2) | 2;

    const players = decodePlayerAttrs(block, 0);
    expect(players[0].number).toBe(5); // 4 + 1
    expect(players[0].position).toBe('centre_back');
    expect(players[0].role).toBe('defender');
    expect(players[0].head).toBe('black_dark');
    expect(players[0].star).toBeUndefined();
  });

  it('decodes star player', () => {
    const block = new Uint8Array(150);
    const recOff = 22 + 2;
    block[recOff] = 0;
    // star=1 in bit 4: 0b00010000 = 0x10
    block[recOff + 1] = 0x10;

    const players = decodePlayerAttrs(block, 0);
    expect(players[0].star).toBe(true);
  });
});

describe('chainWalkRegion', () => {
  it('walks two blocks correctly', () => {
    // Block 1: size=160 at offset 0, Block 2: size=170 at offset 160
    const totalSize = 160 + 170;
    const buf = new Uint8Array(totalSize);
    const view = new DataView(buf.buffer);
    view.setUint16(0, 160, false);
    view.setUint16(160, 170, false);

    const blocks = chainWalkRegion(buf, 0, totalSize);
    expect(blocks).toEqual([0, 160]);
  });

  it('throws on bad block size', () => {
    const buf = new Uint8Array(10);
    const view = new DataView(buf.buffer);
    view.setUint16(0, 50, false); // too small
    expect(() => chainWalkRegion(buf, 0, 10)).toThrow(/Bad block size/);
  });

  it('throws when chain does not end at regionEnd', () => {
    const buf = new Uint8Array(200);
    const view = new DataView(buf.buffer);
    view.setUint16(0, 160, false);
    // regionEnd=170 but block ends at 160, then tries to read at 160 which has size 0 — bad
    expect(() => chainWalkRegion(buf, 0, 170)).toThrow();
  });
});

import { CHARSET, ATTR_SIZE } from './constants.js';

/**
 * Encode a string as a list of 5-bit values (with null terminator).
 */
export function encode5bitString(text: string): number[] {
  const values: number[] = [];
  for (const c of text.toUpperCase()) {
    const idx = CHARSET.indexOf(c);
    if (idx === -1) throw new Error(`Character '${c}' not in CHARSET`);
    values.push(idx);
  }
  values.push(0); // null terminator
  return values;
}

/**
 * Pack a list of 5-bit values into bytes.
 * Returns { bytes: Uint8Array, totalBits: number }.
 */
export function pack5bitValues(values: number[]): { bytes: Uint8Array; totalBits: number } {
  let bitstream = 0;
  let nbits = 0;
  const result: number[] = [];
  for (const val of values) {
    bitstream = (bitstream << 5) | (val & 0x1F);
    nbits += 5;
    while (nbits >= 8) {
      nbits -= 8;
      result.push((bitstream >> nbits) & 0xFF);
    }
  }
  const totalBits = values.length * 5;
  if (nbits > 0) {
    result.push((bitstream << (8 - nbits)) & 0xFF);
  }
  return { bytes: new Uint8Array(result), totalBits };
}

/**
 * Encode all 19 strings (team + country + coach + 16 players) into packed bytes.
 */
export function encodeTeamText(team: { team: string; country: string; coach: string; players: { name: string }[] }): Uint8Array {
  const allValues: number[] = [];
  const names = [team.team, team.country, team.coach, ...team.players.map(p => p.name)];
  for (const s of names) {
    allValues.push(...encode5bitString(s));
  }
  const { bytes } = pack5bitValues(allValues);
  return bytes;
}

/**
 * Compute the 19 packed text position values by simulating the game's decode loop.
 *
 * The packed position format is: (byte_offset << 5) | bit_offset
 *
 * Returns list of 19 packed position values (16-bit words).
 *
 * IMPORTANT: The game uses 32-bit rotate operations. In JS, >> is signed, so
 * we must use >>> (unsigned right shift) and mask to keep values in 32-bit range.
 */
export function computePackedPositions(textBytes: Uint8Array): number[] {
  const block = new Uint8Array(ATTR_SIZE + textBytes.length);
  block.set(textBytes, ATTR_SIZE);

  let d3 = ATTR_SIZE; // byte offset starts at 150 (text start)
  let d4 = 0;         // bit offset

  const positions: number[] = [];

  for (let iter = 0; iter < 19; iter++) {
    positions.push((d3 << 5) | d4);

    let charVal = 0;
    do {
      const addr = d3;
      let d5: number;
      if (addr + 4 <= block.length) {
        d5 = (((block[addr] << 24) | (block[addr + 1] << 16) | (block[addr + 2] << 8) | block[addr + 3]) >>> 0);
      } else {
        const chunk = new Uint8Array(4);
        chunk.set(block.slice(addr, Math.min(addr + 4, block.length)));
        d5 = (((chunk[0] << 24) | (chunk[1] << 16) | (chunk[2] << 8) | chunk[3]) >>> 0);
      }

      if (d4 > 0) {
        d5 = (((d5 << d4) | (d5 >>> (32 - d4))) >>> 0);
      }

      while (true) {
        d4 += 5;
        d5 = (((d5 << 5) | (d5 >>> 27)) >>> 0);
        charVal = d5 & 0x1F;

        if (charVal === 0) {
          // null terminator
          if (d4 >= 16) {
            d4 -= 16;
            d3 += 2;
          }
          break;
        }

        if (d4 >= 16) {
          d4 -= 16;
          d3 += 2;
          break; // reload 32-bit value
        }
      }

      if (charVal === 0) {
        break; // string done
      }
    } while (true);
  }

  return positions;
}

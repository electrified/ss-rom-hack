import { CHARSET, ATTR_SIZE } from './constants.js';
import { BITS_PER_BYTE, TEXT_BITS_PER_CHARACTER, TEXT_CHARACTER_MASK, TEXT_STRING_COUNT, WORD_BYTES } from './rom-format.js';

/**
 * Encode a string as a list of 5-bit values (with null terminator).
 */
export function encode5bitString(text: string): number[] {
  if (typeof text !== 'string' || [...text.toUpperCase()].some((character): boolean => !CHARSET.slice(1).includes(character))) {
    throw new Error("Text must contain only A-Z, space, dash, apostrophe, or period");
  }
  return [...[...text.toUpperCase()].map((character): number => CHARSET.indexOf(character)), 0];
}

/**
 * Pack a list of 5-bit values into bytes.
 * Returns { bytes: Uint8Array, totalBits: number }.
 */
export function pack5bitValues(values: number[]): { bytes: Uint8Array; totalBits: number } {
  const totalBits = values.length * TEXT_BITS_PER_CHARACTER;
  const bits = values.flatMap((value): number[] =>
    Array.from({ length: TEXT_BITS_PER_CHARACTER }, (_, index): number =>
      ((value & TEXT_CHARACTER_MASK) >> (TEXT_BITS_PER_CHARACTER - 1 - index)) & 1));
  const bytes = Uint8Array.from(Array.from({ length: Math.ceil(totalBits / BITS_PER_BYTE) }, (_, index): number => {
    const chunk = bits.slice(index * BITS_PER_BYTE, index * BITS_PER_BYTE + BITS_PER_BYTE);
    return chunk.reduce((byte, bit): number => (byte << 1) | bit, 0) << (BITS_PER_BYTE - chunk.length);
  }));
  return { bytes, totalBits };
}

/**
 * Encode all 19 strings (team + country + coach + 16 players) into packed bytes.
 */
export function encodeTeamText(team: { team: string; country: string; coach: string; players: { name: string }[] }): Uint8Array {
  const names = [team.team, team.country, team.coach, ...team.players.map((player): string => player.name)];
  const { bytes } = pack5bitValues(names.flatMap((name): number[] => encode5bitString(name)));
  return bytes;
}

/**
 * Compute the 19 packed text position values by simulating the game's decode loop.
 *
 * The packed position format is: (byte_offset << 5) | bit_offset
 *
 * Returns list of 19 packed position values (16-bit words).
 *
 */
export function computePackedPositions(textBytes: Uint8Array): number[] {
  const values = Array.from({ length: Math.floor(textBytes.length * BITS_PER_BYTE / TEXT_BITS_PER_CHARACTER) }, (_, index): number => {
    const bit = index * TEXT_BITS_PER_CHARACTER;
    const byte = Math.floor(bit / BITS_PER_BYTE);
    const word = (textBytes[byte] << BITS_PER_BYTE) | (textBytes[byte + 1] ?? 0);
    return (word >> (WORD_BYTES * BITS_PER_BYTE - TEXT_BITS_PER_CHARACTER - bit % BITS_PER_BYTE)) & TEXT_CHARACTER_MASK;
  });
  const starts = [0, ...values.flatMap((value, index): number[] => value === 0 ? [index + 1] : [])].slice(0, TEXT_STRING_COUNT);
  if (starts.length !== TEXT_STRING_COUNT) throw new Error('Missing packed string terminator');
  return starts.map((index): number => {
    const bit = ATTR_SIZE * BITS_PER_BYTE + index * TEXT_BITS_PER_CHARACTER;
    const wordBits = WORD_BYTES * BITS_PER_BYTE;
    return (Math.floor(bit / wordBits) * WORD_BYTES << TEXT_BITS_PER_CHARACTER) | (bit % wordBits);
  });
}

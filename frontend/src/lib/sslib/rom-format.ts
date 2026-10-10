export const WORD_BYTES = 2;
export const LONG_BYTES = 4;
export const BITS_PER_BYTE = 8;
export const TEXT_BITS_PER_CHARACTER = 5;
export const TEXT_CHARACTER_MASK = (1 << TEXT_BITS_PER_CHARACTER) - 1;

export const PLAYER_COUNT = 16;
export const STARTER_COUNT = 11;
export const PLAYER_RECORD_OFFSET = 22;
export const PLAYER_RECORD_BYTES = 8;
export const PLAYER_POSITION_OFFSET = 2;
export const PLAYER_APPEARANCE_OFFSET = 3;
export const ATTRIBUTE_BYTES = PLAYER_RECORD_OFFSET + PLAYER_COUNT * PLAYER_RECORD_BYTES;
export const TEXT_POSITION_OFFSETS = [2, 4, 6,
  ...Array.from({ length: PLAYER_COUNT }, (_, index): number => PLAYER_RECORD_OFFSET + index * PLAYER_RECORD_BYTES)];
export const TEXT_STRING_COUNT = TEXT_POSITION_OFFSETS.length;

export const KIT_OFFSET = 8;
export const KIT_BYTES = 5;
export const KIT_COUNT = 2;
export const FORMATION_DEFAULT_OFFSET = 18;
export const FORMATION_ACTIVE_OFFSET = 19;
export const TEAM_FLAGS_OFFSET = 21;
export const SKILL_SHIFT = 3;
export const SKILL_MASK = 0x07;
export const FLAG_MASK = 0x01;
export const TEAM_EDIT_MASK = (SKILL_MASK << SKILL_SHIFT) | FLAG_MASK;

export const POSITION_SHIFT = 4;
export const NIBBLE_MASK = 0x0f;
export const ROLE_SHIFT = 2;
export const TWO_BIT_MASK = 0x03;
export const STAR_MASK = 0x10;
export const APPEARANCE_RESERVED_MASK = 0xe0;

export const REGION_GAP_BYTES = WORD_BYTES;
export const REGION_GAP_COUNT = 2;
export const MIN_BLOCK_BYTES = 160;
export const MIN_DECODED_BLOCK_BYTES = ATTRIBUTE_BYTES + WORD_BYTES;
export const MAX_BLOCK_BYTES = 500;
export const POINTER_COUNT = 6;
export const POINTER_TABLE_BYTES = POINTER_COUNT * LONG_BYTES;

export const ROM_CHECKSUM_OFFSET = 0x18e;
export const ROM_CHECKSUM_START = 0x200;
export const ROM_CHECKSUM_MASK = 0xffff;

export const KNOWN_POINTER_TABLES = [0x1ef22, 0x1ea42] as const;
export const POINTER_SCAN_END = 0x30000;
export const POINTER_DATA_START = 0x10000;
export const POINTER_DATA_END = 0x40000;

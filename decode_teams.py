#!/usr/bin/env python3
"""
Sensible Soccer (Mega Drive) - Team Data Decoder/Encoder

Works with both the original and International Edition ROMs.

Team/player names are stored using 5-bit packed encoding (MSB-first bitstream).
Character set (index 0 = null terminator):
  0: NUL, 1-26: A-Z, 27: space, 28: -, 29: ', 30: .

Each team block contains:
  1. Team name (5-bit packed, null-terminated)
  2. Country name (5-bit packed, null-terminated)
  3. Manager name (5-bit packed, null-terminated)
  4. 16 player names (5-bit packed, null-terminated each)
  5. ~150 bytes of attribute data (player stats, kit colors, etc.)

International Edition:
  Decode routine: 0x019658, charset table: 0x0196A4
  Team data block: 0x0243DC - 0x029260

Original Edition:
  Decode routine: ~0x0193AE, charset table: 0x01941A
  Team data block: 0x022FD4 - 0x027E60
  Uses city names instead of club names, misspelled player names (licensing).
"""

import sys
import struct

CHARSET = "\x00ABCDEFGHIJKLMNOPQRSTUVWXYZ -'."


def decode_5bit_string(data, byte_offset, bit_start=0):
    """Decode a single 5-bit packed null-terminated string.
    Returns (decoded_string, next_bit_position)."""
    result = []
    bit_pos = bit_start
    while True:
        abs_bit = byte_offset * 8 + bit_pos
        byte_idx = abs_bit // 8
        bit_idx = abs_bit % 8
        if byte_idx + 2 >= len(data):
            break
        val24 = (data[byte_idx] << 16) | (data[byte_idx + 1] << 8) | data[byte_idx + 2]
        char_val = (val24 >> (24 - bit_idx - 5)) & 0x1F
        if char_val == 0:
            return ''.join(result), bit_pos + 5
        if char_val >= len(CHARSET):
            break
        result.append(CHARSET[char_val])
        bit_pos += 5
        if len(result) > 30:
            break
    return ''.join(result), bit_pos


def encode_5bit_string(text):
    """Encode a string as a 5-bit packed bitstream (with null terminator).
    Returns list of 5-bit values including the trailing 0."""
    values = []
    for c in text.upper():
        idx = CHARSET.index(c)
        values.append(idx)
    values.append(0)  # null terminator
    return values


def pack_5bit_values(values):
    """Pack a list of 5-bit values into bytes.
    Returns (bytes, total_bits)."""
    bitstream = 0
    nbits = 0
    result = []
    for val in values:
        bitstream = (bitstream << 5) | (val & 0x1F)
        nbits += 5
        while nbits >= 8:
            nbits -= 8
            result.append((bitstream >> nbits) & 0xFF)
    total_bits = len(values) * 5
    # Pad remaining bits with zeros
    if nbits > 0:
        result.append((bitstream << (8 - nbits)) & 0xFF)
    return bytes(result), total_bits


def decode_team_block(rom, offset):
    """Decode a full team block at the given ROM offset.
    Returns dict with team info and the bit position after all text."""
    bit_pos = 0
    team_name, bit_pos = decode_5bit_string(rom, offset, bit_pos)
    country, bit_pos = decode_5bit_string(rom, offset, bit_pos)
    manager, bit_pos = decode_5bit_string(rom, offset, bit_pos)
    players = []
    for _ in range(16):
        player, bit_pos = decode_5bit_string(rom, offset, bit_pos)
        players.append(player)

    text_byte_end = offset + (bit_pos + 7) // 8
    return {
        'offset': offset,
        'team': team_name,
        'country': country,
        'manager': manager,
        'players': players,
        'text_bits': bit_pos,
        'text_end': text_byte_end,
    }


def find_team_offset(rom, team_name):
    """Find the ROM offset of a 5-bit encoded team name."""
    values = [CHARSET.index(c) for c in team_name.upper()]
    packed, _ = pack_5bit_values(values)
    search_len = min(len(packed), 6)
    pos = rom.find(packed[:search_len], 0x020000, 0x030000)
    if pos == -1 and search_len > 3:
        pos = rom.find(packed[:3], 0x020000, 0x030000)
    return pos


KNOWN_COUNTRIES = {
    "ENGLAND", "SCOTLAND", "WALES", "NORTHERN IRELAND", "REPUBLIC OF IRELAND",
    "FRANCE", "GERMANY", "ITALY", "SPAIN", "HOLLAND", "BELGIUM", "PORTUGAL",
    "AUSTRIA", "SWITZERLAND", "SWEDEN", "NORWAY", "DENMARK", "FINLAND",
    "GREECE", "TURKEY", "ROMANIA", "BULGARIA", "HUNGARY", "POLAND",
    "CZECHOSLOVAKIA", "CROATIA", "SLOVENIA", "RUSSIA", "UKRAINE",
    "ALBANIA", "CYPRUS", "ICELAND", "ISRAEL", "LUXEMBOURG", "MALTA",
    "ESTONIA", "LATVIA", "LITHUANIA", "FAEROE ISLES",
}


def auto_find_teams(rom, scan_start=0x020000, scan_end=0x030000):
    """Scan the ROM for team blocks by looking for valid team+country sequences.
    Returns a list of offsets."""
    found = []
    offset = scan_start
    while offset < scan_end:
        name, bits1 = decode_5bit_string(rom, offset)
        if not name or len(name) < 3 or len(name) > 25:
            offset += 1
            continue
        country, bits2 = decode_5bit_string(rom, offset, bits1)
        if country not in KNOWN_COUNTRIES:
            offset += 1
            continue
        manager, bits3 = decode_5bit_string(rom, offset, bits2)
        if not manager or len(manager) < 3 or len(manager) > 25:
            offset += 1
            continue
        player1, bits4 = decode_5bit_string(rom, offset, bits3)
        if not player1 or len(player1) < 3 or len(player1) > 25:
            offset += 1
            continue
        found.append(offset)
        # Skip past this team block to avoid finding substrings
        text_end_byte = offset + (bits4 + 7) // 8
        offset = text_end_byte + 100
    return found


def main():
    if len(sys.argv) < 2:
        print("Usage: decode_teams.py <rom_file> [--json]")
        sys.exit(1)

    rom_path = sys.argv[1]
    json_output = '--json' in sys.argv

    with open(rom_path, 'rb') as f:
        rom = f.read()

    offsets = auto_find_teams(rom)
    if not offsets:
        print("No teams found!")
        sys.exit(1)
    print(f"Found {len(offsets)} teams\n")

    teams = []
    for offset in offsets:
        info = decode_team_block(rom, offset)
        teams.append(info)

    if json_output:
        import json
        output = []
        for t in teams:
            output.append({
                'offset': f"0x{t['offset']:06X}",
                'team': t['team'],
                'country': t['country'],
                'manager': t['manager'],
                'players': t['players'],
            })
        print(json.dumps(output, indent=2))
    elif not teams:
        print("No teams decoded.")
    else:
        for i, t in enumerate(teams):
            print(f"\n{'='*60}")
            print(f"Team {i+1:2d}: {t['team']} ({t['country']}) @ 0x{t['offset']:06X}")
            print(f"Manager: {t['manager']}")
            print(f"Players:")
            for j, p in enumerate(t['players']):
                print(f"  {j+1:2d}. {p}")


if __name__ == '__main__':
    main()

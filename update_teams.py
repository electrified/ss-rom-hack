#!/usr/bin/env python3
"""
Sensible Soccer (Mega Drive) - ROM Team Name Editor

Reads an edited JSON file (produced by decode_teams.py --json) and writes
the modified team/player names back into the ROM, preserving all binary
attribute data (stats, kit colors, formation) unchanged.

Team block layout in ROM: [150 bytes attributes][variable-length 5-bit text]
The attribute block contains packed text positions at specific offsets that
the game uses to locate each of the 19 strings. These positions must be
recomputed when text content changes.

Usage:
    python3 update_teams.py <rom> <teams.json> -o <output.md>
"""

import sys
import json
import struct
import argparse

from decode_teams import (
    CHARSET,
    encode_5bit_string,
    pack_5bit_values,
    decode_team_block,
    auto_find_teams,
)

ATTR_SIZE = 150

# Offsets within the 150-byte attribute block where packed text positions
# are stored (19 entries for: team, country, manager, 16 players)
ATTR_OFFSETS = [2, 4, 6, 22, 30, 38, 46, 54, 62, 70, 78, 86, 94, 102, 110, 118, 126, 134, 142]


def validate_string(text, context):
    """Check all characters are in CHARSET. Returns list of bad chars or empty list."""
    bad = []
    for c in text.upper():
        if c not in CHARSET:
            bad.append(c)
    return bad


def encode_team_text(team):
    """Encode all 19 strings (team + country + manager + 16 players) into packed bytes."""
    all_values = []
    for s in [team['team'], team['country'], team['manager']] + team['players']:
        all_values.extend(encode_5bit_string(s))
    packed, _total_bits = pack_5bit_values(all_values)
    return packed


def compute_packed_positions(text_bytes):
    """Compute the 19 packed text position values by simulating the game's decode loop.

    The game stores text starting at byte 150 of the team block (after the
    attribute block). It reads 32-bit values using a word-aligned byte offset
    (D3) and a bit offset (D4). When D4 >= 16, it advances D3 by 2 and reloads.

    The packed position format is: (byte_offset << 5) | bit_offset

    Returns list of 19 packed position values (16-bit words).
    """
    # Build temporary block: [150 zero bytes][text_bytes]
    block = bytes(ATTR_SIZE) + text_bytes

    d3 = ATTR_SIZE  # byte offset starts at 150 (text start)
    d4 = 0          # bit offset

    positions = []

    for _ in range(19):
        # Record position before decoding this string
        positions.append((d3 << 5) | d4)

        # Simulate decoding characters until null terminator
        while True:
            # Load 32 bits from block[d3..d3+3], big-endian
            addr = d3
            if addr + 4 <= len(block):
                d5 = (block[addr] << 24) | (block[addr+1] << 16) | (block[addr+2] << 8) | block[addr+3]
            else:
                chunk = (block[addr:] + bytes(4))[:4]
                d5 = (chunk[0] << 24) | (chunk[1] << 16) | (chunk[2] << 8) | chunk[3]

            # ROL.L d4, d5 (initial alignment)
            if d4 > 0:
                d5 = ((d5 << d4) | (d5 >> (32 - d4))) & 0xFFFFFFFF

            # Character extraction inner loop
            while True:
                d4 += 5
                d5 = ((d5 << 5) | (d5 >> 27)) & 0xFFFFFFFF
                char_val = d5 & 0x1F

                if char_val == 0:  # null terminator
                    if d4 >= 16:
                        d4 -= 16
                        d3 += 2
                    break

                if d4 >= 16:
                    d4 -= 16
                    d3 += 2
                    break  # reload 32-bit value

            if char_val == 0:
                break  # string done

    return positions


def main():
    parser = argparse.ArgumentParser(description='Update team names in a Sensible Soccer ROM')
    parser.add_argument('rom', help='Input ROM file')
    parser.add_argument('teams_json', help='Edited teams JSON file')
    parser.add_argument('-o', '--output', required=True, help='Output ROM file (required, never overwrites input)')
    args = parser.parse_args()

    if args.output == args.rom:
        print("Error: output file must differ from input ROM", file=sys.stderr)
        sys.exit(1)

    # Load ROM
    with open(args.rom, 'rb') as f:
        rom = bytearray(f.read())

    # Find existing teams (auto_find_teams returns TEXT start offsets)
    text_offsets = auto_find_teams(rom)
    if not text_offsets:
        print("Error: no teams found in ROM", file=sys.stderr)
        sys.exit(1)

    if len(text_offsets) != 64:
        print(f"Error: expected 64 teams in ROM, found {len(text_offsets)}", file=sys.stderr)
        sys.exit(1)

    # Team block layout: [attrs (150 bytes)][text (variable)]
    # auto_find_teams returns text start, so attr block is 150 bytes before
    block_offsets = [t - ATTR_SIZE for t in text_offsets]

    # Extract attribute bytes for each team (first 150 bytes of each block)
    attr_blocks = []
    for block_off in block_offsets:
        attr_blocks.append(bytearray(rom[block_off:block_off + ATTR_SIZE]))

    # Calculate original region bounds
    region_start = block_offsets[0]
    # End of last team: text end + padding to make block even-sized
    last_info = decode_team_block(rom, text_offsets[-1])
    last_text_bytes = (last_info['text_bits'] + 7) // 8
    region_end = text_offsets[-1] + last_text_bytes + (last_text_bytes % 2)
    original_size = region_end - region_start

    # Load edited JSON
    with open(args.teams_json, 'r') as f:
        teams_json = json.load(f)

    if len(teams_json) != 64:
        print(f"Error: expected 64 teams in JSON, found {len(teams_json)}", file=sys.stderr)
        sys.exit(1)

    # Validate all teams
    errors = []
    for i, team in enumerate(teams_json):
        if len(team['players']) != 16:
            errors.append(f"Team {i+1} '{team['team']}': expected 16 players, got {len(team['players'])}")

        for label, s in [('team', team['team']), ('country', team['country']), ('manager', team['manager'])]:
            bad = validate_string(s, label)
            if bad:
                errors.append(f"Team {i+1} '{team['team']}' {label}: invalid chars {bad!r} in '{s}'")

        for j, p in enumerate(team['players']):
            bad = validate_string(p, f"player {j+1}")
            if bad:
                errors.append(f"Team {i+1} '{team['team']}' player {j+1}: invalid chars {bad!r} in '{p}'")

    if errors:
        print("Validation errors:", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    # Rebuild all team blocks: [attrs][text] for each team
    original_teams = []
    for text_off in text_offsets:
        original_teams.append(decode_team_block(rom, text_off))

    new_region = bytearray()
    changes = 0

    for i, team in enumerate(teams_json):
        # Encode the new text
        text_bytes = encode_team_text(team)

        # Compute packed text positions for the new text
        positions = compute_packed_positions(text_bytes)

        # Update the attribute block with new positions
        attrs = bytearray(attr_blocks[i])
        for str_idx, attr_off in enumerate(ATTR_OFFSETS):
            struct.pack_into('>H', attrs, attr_off, positions[str_idx])

        # Write block: [attrs][text][pad]
        # Each block must be an even number of bytes (word-aligned for 68000)
        new_region.extend(attrs)
        new_region.extend(text_bytes)
        if len(text_bytes) % 2 != 0:
            new_region.append(0x00)

        # Check if text changed
        orig = original_teams[i]
        if (team['team'] != orig['team'] or team['country'] != orig['country'] or
                team['manager'] != orig['manager'] or team['players'] != orig['players']):
            changes += 1

    new_size = len(new_region)
    if new_size > original_size:
        print(f"Error: new team data ({new_size} bytes) exceeds original region ({original_size} bytes) by {new_size - original_size} bytes",
              file=sys.stderr)
        sys.exit(1)

    # Pad to original size if shorter (fill with 0x00)
    if new_size < original_size:
        new_region.extend(b'\x00' * (original_size - new_size))

    # Write into ROM
    rom[region_start:region_start + original_size] = new_region

    # Write output
    with open(args.output, 'wb') as f:
        f.write(rom)

    print(f"Teams changed: {changes}/64")
    print(f"Region: 0x{region_start:06X} - 0x{region_start + original_size:06X}")
    print(f"Bytes used: {new_size}/{original_size} ({original_size - new_size} bytes free)")
    print(f"Written to: {args.output}")


if __name__ == '__main__':
    main()

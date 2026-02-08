#!/usr/bin/env python3
"""
Sensible Soccer (Mega Drive) - ROM Team Name Editor

Reads an edited JSON file (produced by decode_teams.py --json) and writes
the modified team/player names back into the ROM, preserving all binary
attribute data (stats, kit colors, formation) unchanged.

Usage:
    python3 update_teams.py <rom> <teams.json> -o <output.md>
"""

import sys
import json
import argparse

from decode_teams import (
    CHARSET,
    encode_5bit_string,
    pack_5bit_values,
    decode_team_block,
    auto_find_teams,
)


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

    # Find existing teams
    offsets = auto_find_teams(rom)
    if not offsets:
        print("Error: no teams found in ROM", file=sys.stderr)
        sys.exit(1)

    if len(offsets) != 64:
        print(f"Error: expected 64 teams in ROM, found {len(offsets)}", file=sys.stderr)
        sys.exit(1)

    # Extract attribute bytes for each team
    attr_blocks = []
    for i, offset in enumerate(offsets):
        info = decode_team_block(rom, offset)
        text_end = info['text_end']

        if i < len(offsets) - 1:
            # Attribute bytes run from text_end to the start of the next team
            next_offset = offsets[i + 1]
            attr_bytes = rom[text_end:next_offset]
        else:
            # Last team: determine attr size from the first byte pattern
            # 0x00 at text_end means 151 bytes of attrs, 0x01 means 150 bytes
            if rom[text_end] == 0x00:
                attr_len = 151
            else:
                attr_len = 150
            attr_bytes = rom[text_end:text_end + attr_len]

        attr_blocks.append(bytes(attr_bytes))

    # Calculate original region bounds
    region_start = offsets[0]
    last_info = decode_team_block(rom, offsets[-1])
    region_end = last_info['text_end'] + len(attr_blocks[-1])
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
        # Check player count
        if len(team['players']) != 16:
            errors.append(f"Team {i+1} '{team['team']}': expected 16 players, got {len(team['players'])}")

        # Check all strings for valid characters
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

    # Rebuild all team blocks
    new_region = bytearray()
    changes = 0
    original_teams = []
    for offset in offsets:
        original_teams.append(decode_team_block(rom, offset))

    for i, team in enumerate(teams_json):
        text_bytes = encode_team_text(team)
        new_region.extend(text_bytes)
        new_region.extend(attr_blocks[i])

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

#!/usr/bin/env python3
"""
Sensible Soccer (Mega Drive) - ROM Team Name Editor

Reads an edited JSON file (produced by decode_teams.py --json) and writes
the modified team/player names back into the ROM, preserving all binary
attribute data (stats, kit colors, formation) unchanged.

Handles all 3 team regions: national, club, and custom.

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
    find_pointer_table,
    chain_walk_region,
    COLOUR_VALUES, STYLE_VALUES,
    HEAD_VALUES,
    ROLE_VALUES, POSITION_NAMES, POSITION_VALUES,
    TACTIC_VALUES,
)

ATTR_SIZE = 150

# Offsets within the 150-byte attribute block where packed text positions
# are stored (19 entries for: team, country, coach, 16 players)
ATTR_OFFSETS = [2, 4, 6, 22, 30, 38, 46, 54, 62, 70, 78, 86, 94, 102, 110, 118, 126, 134, 142]

CATEGORIES = ('national', 'club', 'custom')


def validate_string(text, context):
    """Check all characters are in CHARSET. Returns list of bad chars or empty list."""
    bad = []
    for c in text.upper():
        if c not in CHARSET:
            bad.append(c)
    return bad


def encode_team_text(team):
    """Encode all 19 strings (team + country + coach + 16 players) into packed bytes."""
    all_values = []
    names = [team['team'], team['country'], team['coach']]
    names += [p['name'] for p in team['players']]
    for s in names:
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


def _check_enum(val, allowed, max_int, context):
    """Validate val is a known string or int in 0..max_int. Returns error or None."""
    if isinstance(val, str):
        if val not in allowed:
            return f"{context} must be one of {sorted(allowed)}, got '{val}'"
    elif not (0 <= val <= max_int):
        return f"{context} must be 0-{max_int}, got {val}"
    return None


def _resolve_colour(val):
    """Convert a colour string or int to its byte value."""
    if isinstance(val, str):
        return COLOUR_VALUES[val]
    return val


def _resolve_style(val):
    """Convert a style string or int to its byte value."""
    if isinstance(val, str):
        return STYLE_VALUES[val]
    return val


def apply_kit_attrs(attrs, kit):
    """Write kit attributes into bytes 8-17."""
    b = 8
    for prefix in ('first', 'second'):
        k = kit[prefix]
        attrs[b] = _resolve_style(k['style'])
        attrs[b + 1] = _resolve_colour(k['shirt1'])
        attrs[b + 2] = _resolve_colour(k['shirt2'])
        attrs[b + 3] = _resolve_colour(k['shorts'])
        attrs[b + 4] = _resolve_colour(k['socks'])
        b += 5


def apply_team_attrs(attrs, team):
    """Write team-level attributes into bytes 18-21.

    Byte 18: tactic (written for consistency, not used by game engine)
    Byte 19: tactic (gameplay-active formation, 0-7)
    Byte 20: 0x00 (unused)
    Byte 21: (skill << 3) | flag
    """
    tactic = team.get('tactic', '4-4-2')
    if isinstance(tactic, str):
        tactic = TACTIC_VALUES[tactic]
    attrs[18] = tactic
    attrs[19] = tactic  # both bytes kept in sync
    attrs[20] = 0x00
    skill = team.get('skill', 0)
    flag = team.get('flag', 0)
    attrs[21] = ((skill & 0x07) << 3) | (flag & 0x01)


def _resolve_position(val):
    """Convert a position string or int to its numeric slot."""
    if isinstance(val, str):
        return POSITION_VALUES[val]
    return val


def _resolve_role(val):
    """Convert a role string or int to its numeric value."""
    if isinstance(val, str):
        return ROLE_VALUES[val]
    return val


def _resolve_head(val):
    """Convert a head type string or int to its numeric value."""
    if isinstance(val, str):
        return HEAD_VALUES[val]
    return val


def apply_player_attrs(attrs, players):
    """Write player position and appearance into the attribute block.

    Each player has an 8-byte record starting at offset 22.
    Byte 2 = (position << 4) | (number - 1).
    Byte 3 = (star << 4) | (role << 2) | head.
    """
    base = 22
    for i, p in enumerate(players):
        rec_off = base + i * 8 + 2  # skip 2-byte packed text position
        pos = _resolve_position(p['position'])
        role = _resolve_role(p['role'])
        head = _resolve_head(p['head'])
        star = 1 if p.get('star', False) else 0
        attrs[rec_off] = ((pos & 0x0F) << 4) | ((p['number'] - 1) & 0x0F)
        attrs[rec_off + 1] = ((star & 0x01) << 4) | ((role & 0x03) << 2) | (head & 0x03)


def build_region(rom, block_offsets, teams_json):
    """Build a new region from attribute blocks and edited JSON.

    Returns (new_region_bytes, changes_count).
    """
    # Extract attribute bytes for each team
    attr_blocks = []
    for block_off in block_offsets:
        attr_blocks.append(bytearray(rom[block_off:block_off + ATTR_SIZE]))

    # Decode original teams for change detection
    original_teams = []
    for block_off in block_offsets:
        original_teams.append(decode_team_block(rom, block_off + ATTR_SIZE))

    new_region = bytearray()
    changes = 0

    for i, team in enumerate(teams_json):
        text_bytes = encode_team_text(team)
        positions = compute_packed_positions(text_bytes)

        attrs = bytearray(attr_blocks[i])
        for str_idx, attr_off in enumerate(ATTR_OFFSETS):
            struct.pack_into('>H', attrs, attr_off, positions[str_idx])

        # Write kit, team, and player attributes from JSON
        if 'kit' in team:
            apply_kit_attrs(attrs, team['kit'])
        apply_team_attrs(attrs, team)
        apply_player_attrs(attrs, team['players'])

        block_size = ATTR_SIZE + len(text_bytes) + (len(text_bytes) % 2)
        struct.pack_into('>H', attrs, 0, block_size)

        new_region.extend(attrs)
        new_region.extend(text_bytes)
        if len(text_bytes) % 2 != 0:
            new_region.append(0x00)

        orig = original_teams[i]
        player_names = [p['name'] for p in team['players']]
        if (team['team'] != orig['team'] or team['country'] != orig['country'] or
                team['coach'] != orig['coach'] or player_names != orig['players']):
            changes += 1

    return bytes(new_region), changes


def main():
    parser = argparse.ArgumentParser(description='Update team names in a Sensible Soccer ROM')
    parser.add_argument('rom', help='Input ROM file')
    parser.add_argument('teams_json', help='Edited teams JSON file')
    parser.add_argument('-o', '--output', help='Output ROM file (required unless --validate)')
    parser.add_argument('--validate', action='store_true',
                        help='Validate JSON only, do not write ROM')
    args = parser.parse_args()

    if not args.validate and not args.output:
        parser.error('-o/--output is required when not using --validate')

    if args.output and args.output == args.rom:
        print("Error: output file must differ from input ROM", file=sys.stderr)
        sys.exit(1)

    # Load ROM
    with open(args.rom, 'rb') as f:
        rom = bytearray(f.read())

    # Find pointer table and all 3 regions
    ptrs = find_pointer_table(rom)
    region_info = [
        ('national', ptrs['nat_start'], ptrs['nat_end']),
        ('club', ptrs['club_start'], ptrs['club_end']),
        ('custom', ptrs['cust_start'], ptrs['cust_end']),
    ]

    # Chain-walk all regions to get block offsets
    all_block_offsets = {}
    for cat, start, end in region_info:
        all_block_offsets[cat] = chain_walk_region(rom, start, end)

    # Load edited JSON
    with open(args.teams_json, 'r') as f:
        teams_json = json.load(f)

    if not isinstance(teams_json, dict) or not all(k in teams_json for k in CATEGORIES):
        print("Error: JSON must be a dict with 'national', 'club', 'custom' keys",
              file=sys.stderr)
        sys.exit(1)
    teams_by_cat = teams_json

    # Validate team counts and content
    errors = []
    warnings = []
    for cat, start, end in region_info:
        rom_count = len(all_block_offsets[cat])
        json_teams = teams_by_cat[cat]
        if len(json_teams) != rom_count:
            errors.append(f"{cat}: expected {rom_count} teams in JSON, got {len(json_teams)}")
            continue
        for i, team in enumerate(json_teams):
            tname = team.get('team', '?')
            players = team.get('players', [])
            if len(players) != 16:
                errors.append(f"{cat} team {i+1} '{tname}': expected 16 players, "
                              f"got {len(players)}")
            for label in ('team', 'country', 'coach'):
                bad = validate_string(team.get(label, ''), label)
                if bad:
                    errors.append(f"{cat} team {i+1} '{tname}' {label}: "
                                  f"invalid chars {bad!r} in '{team[label]}'")
            # Validate team-level attributes
            ctx = f"{cat} team {i+1} '{tname}'"
            err = _check_enum(team.get('tactic', '4-4-2'), TACTIC_VALUES, 7, f"{ctx}: tactic")
            if err:
                errors.append(err)
            skill = team.get('skill', 0)
            if not (0 <= skill <= 7):
                errors.append(f"{ctx}: skill must be 0-7, got {skill}")
            flag = team.get('flag', 0)
            if flag not in (0, 1):
                errors.append(f"{ctx}: flag must be 0 or 1, got {flag}")
            # Validate kit attributes
            kit = team.get('kit')
            if kit:
                for prefix in ('first', 'second'):
                    k = kit.get(prefix, {})
                    kctx = f"{ctx} {prefix} kit"
                    err = _check_enum(k.get('style', 'plain'), STYLE_VALUES, 3, f"{kctx}: style")
                    if err:
                        errors.append(err)
                    for field in ('shirt1', 'shirt2', 'shorts', 'socks'):
                        err = _check_enum(k.get(field, 'white'), COLOUR_VALUES, 15, f"{kctx}: {field}")
                        if err:
                            errors.append(err)
            # Validate player attributes
            for j, p in enumerate(players):
                if not isinstance(p, dict):
                    errors.append(f"{ctx} player {j+1}: "
                                  f"expected dict, got {type(p).__name__}")
                    continue
                bad = validate_string(p.get('name', ''), f"player {j+1}")
                if bad:
                    errors.append(f"{ctx} player {j+1}: "
                                  f"invalid chars {bad!r} in '{p['name']}'")
                num = p.get('number', 1)
                if not (1 <= num <= 16):
                    errors.append(f"{ctx} player {j+1}: "
                                  f"number must be 1-16, got {num}")
                pctx = f"{ctx} player {j+1}"
                for field, allowed, max_int, default in (
                    ('position', POSITION_VALUES, 15, 'goalkeeper'),
                    ('role', ROLE_VALUES, 3, 'goalkeeper'),
                    ('head', HEAD_VALUES, 2, 'white_dark'),
                ):
                    err = _check_enum(p.get(field, default), allowed, max_int, f"{pctx}: {field}")
                    if err:
                        errors.append(err)
            # Validate formation slot configuration
            starter_slots = []
            sub_count = 0
            for p in players:
                if not isinstance(p, dict):
                    continue
                pos = p.get('position', 'goalkeeper')
                if isinstance(pos, str):
                    pos = POSITION_VALUES.get(pos, -1)
                if pos == 15:
                    sub_count += 1
                else:
                    starter_slots.append(pos)
            if sorted(starter_slots) != list(range(11)):
                missing = set(range(11)) - set(starter_slots)
                duped = set(s for s in starter_slots if starter_slots.count(s) > 1)
                missing_names = [POSITION_NAMES.get(s, str(s)) for s in sorted(missing)]
                duped_names = [POSITION_NAMES.get(s, str(s)) for s in sorted(duped)]
                warnings.append(f"{ctx}: formation slots invalid — "
                                f"missing {missing_names}, duplicated {duped_names}")
            if sub_count != 5:
                warnings.append(f"{ctx}: expected 5 subs, got {sub_count}")

    if errors:
        print("Validation errors:", file=sys.stderr)
        for e in errors:
            print(f"  {e}", file=sys.stderr)
        sys.exit(1)

    if warnings:
        print("Warnings:", file=sys.stderr)
        for w in warnings:
            print(f"  {w}", file=sys.stderr)

    if args.validate:
        total_players = 0
        for cat in CATEGORIES:
            n = len(teams_by_cat[cat])
            total_players += n * 16
            print(f"{cat:8s}: {n} teams OK")
        print(f"Total: {total_players} players validated")
        sys.exit(0)

    # Build new region data for each category
    region_data = {}
    total_changes = {}
    for cat, start, end in region_info:
        data, changes = build_region(rom, all_block_offsets[cat], teams_by_cat[cat])
        region_data[cat] = data
        total_changes[cat] = changes

    # Calculate total available space: from nat_start to end of custom data area
    # Find the first non-zero byte after custom_end to determine where the next
    # data region actually starts
    nat_start = ptrs['nat_start']
    cust_end = ptrs['cust_end']
    max_end = cust_end
    # Scan forward for non-zero data (the next real data region)
    scan_pos = cust_end
    while scan_pos < len(rom) - 1:
        word = struct.unpack_from('>H', rom, scan_pos)[0]
        if word != 0:
            max_end = scan_pos
            break
        scan_pos += 2

    # Concatenate regions with 2-byte zero gaps
    combined = bytearray()
    combined.extend(region_data['national'])
    combined.extend(b'\x00\x00')
    club_offset_in_combined = len(combined)
    combined.extend(region_data['club'])
    combined.extend(b'\x00\x00')
    cust_offset_in_combined = len(combined)
    combined.extend(region_data['custom'])

    total_available = max_end - nat_start
    if len(combined) > total_available:
        overflow = len(combined) - total_available
        print(f"Error: new team data ({len(combined)} bytes) overflows available space "
              f"({total_available} bytes) by {overflow} bytes", file=sys.stderr)
        sys.exit(1)

    # Compute new pointer values
    new_nat_start = nat_start  # unchanged
    new_nat_end = nat_start + len(region_data['national'])
    new_club_start = new_nat_end + 2
    new_club_end = new_club_start + len(region_data['club'])
    new_cust_start = new_club_end + 2
    new_cust_end = new_cust_start + len(region_data['custom'])

    # Write combined data into ROM
    rom[nat_start:nat_start + len(combined)] = combined

    # Zero-fill any leftover space
    old_total = cust_end - nat_start
    if len(combined) < old_total:
        rom[nat_start + len(combined):nat_start + old_total] = b'\x00' * (old_total - len(combined))

    # Update all 6 pointers in the table
    tb = ptrs['table_base']
    struct.pack_into('>I', rom, tb + 0, new_nat_start)
    struct.pack_into('>I', rom, tb + 4, new_club_start)
    struct.pack_into('>I', rom, tb + 8, new_cust_start)
    struct.pack_into('>I', rom, tb + 12, new_nat_end)
    struct.pack_into('>I', rom, tb + 16, new_club_end)
    struct.pack_into('>I', rom, tb + 20, new_cust_end)

    # Write output
    with open(args.output, 'wb') as f:
        f.write(rom)

    # Summary
    for cat, start, end in region_info:
        rom_count = len(all_block_offsets[cat])
        print(f"{cat:8s}: {total_changes[cat]:2d}/{rom_count} changed")

    print(f"Total: {len(combined)} / {total_available} bytes used "
          f"({total_available - len(combined)} free)")
    print(f"Written to: {args.output}")


if __name__ == '__main__':
    main()

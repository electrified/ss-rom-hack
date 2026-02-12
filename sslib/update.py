"""ROM writing: build regions and update ROM with edited team data."""

import struct

from .constants import (
    ATTR_SIZE, ATTR_OFFSETS, CATEGORIES,
    COLOUR_VALUES, STYLE_VALUES, HEAD_VALUES, ROLE_VALUES, POSITION_VALUES, TACTIC_VALUES,
)
from .decode import decode_team_block, find_pointer_table, chain_walk_region
from .encode import encode_team_text, compute_packed_positions


def _resolve_colour(val):
    if isinstance(val, str):
        return COLOUR_VALUES[val]
    return val


def _resolve_style(val):
    if isinstance(val, str):
        return STYLE_VALUES[val]
    return val


def _resolve_position(val):
    if isinstance(val, str):
        return POSITION_VALUES[val]
    return val


def _resolve_role(val):
    if isinstance(val, str):
        return ROLE_VALUES[val]
    return val


def _resolve_head(val):
    if isinstance(val, str):
        return HEAD_VALUES[val]
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
    """Write team-level attributes into bytes 18-21."""
    tactic = team.get('tactic', '4-4-2')
    if isinstance(tactic, str):
        tactic = TACTIC_VALUES[tactic]
    attrs[18] = tactic
    attrs[19] = tactic
    attrs[20] = 0x00
    skill = team.get('skill', 0)
    flag = team.get('flag', 0)
    attrs[21] = ((skill & 0x07) << 3) | (flag & 0x01)


def apply_player_attrs(attrs, players):
    """Write player position and appearance into the attribute block."""
    base = 22
    for i, p in enumerate(players):
        rec_off = base + i * 8 + 2
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
    attr_blocks = []
    for block_off in block_offsets:
        attr_blocks.append(bytearray(rom[block_off:block_off + ATTR_SIZE]))

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


def update_rom(rom_bytes, teams_json):
    """Apply edited team data to a ROM and return the modified ROM bytes.

    Args:
        rom_bytes: original ROM contents (bytes or bytearray)
        teams_json: dict with 'national', 'club', 'custom' keys

    Returns:
        Modified ROM as bytes.

    Raises:
        RuntimeError: if new data overflows available space.
    """
    rom = bytearray(rom_bytes)

    ptrs = find_pointer_table(rom)
    region_info = [
        ('national', ptrs['nat_start'], ptrs['nat_end']),
        ('club', ptrs['club_start'], ptrs['club_end']),
        ('custom', ptrs['cust_start'], ptrs['cust_end']),
    ]

    all_block_offsets = {}
    for cat, start, end in region_info:
        all_block_offsets[cat] = chain_walk_region(rom, start, end)

    # Build new region data
    region_data = {}
    for cat, start, end in region_info:
        data, _changes = build_region(rom, all_block_offsets[cat], teams_json[cat])
        region_data[cat] = data

    # Calculate available space
    nat_start = ptrs['nat_start']
    cust_end = ptrs['cust_end']
    max_end = cust_end
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
    combined.extend(region_data['club'])
    combined.extend(b'\x00\x00')
    combined.extend(region_data['custom'])

    total_available = max_end - nat_start
    if len(combined) > total_available:
        overflow = len(combined) - total_available
        raise RuntimeError(
            f"New team data ({len(combined)} bytes) overflows available space "
            f"({total_available} bytes) by {overflow} bytes")

    # Compute new pointer values
    new_nat_start = nat_start
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

    # Update all 6 pointers
    tb = ptrs['table_base']
    struct.pack_into('>I', rom, tb + 0, new_nat_start)
    struct.pack_into('>I', rom, tb + 4, new_club_start)
    struct.pack_into('>I', rom, tb + 8, new_cust_start)
    struct.pack_into('>I', rom, tb + 12, new_nat_end)
    struct.pack_into('>I', rom, tb + 16, new_club_end)
    struct.pack_into('>I', rom, tb + 20, new_cust_end)

    return bytes(rom)

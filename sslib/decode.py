"""ROM reading: find pointer table, chain-walk regions, decode team blocks."""

import struct

from .constants import (
    CHARSET, ATTR_SIZE, KNOWN_COUNTRIES,
    COLOUR_NAMES, STYLE_NAMES, HEAD_NAMES, ROLE_NAMES, POSITION_NAMES, TACTIC_NAMES,
)
from .encode import encode_5bit_string, pack_5bit_values


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


def decode_player_attrs(rom, block_offset):
    """Decode the 16 player attribute records from the attribute block.

    Each player has an 8-byte record starting at block_offset + 22.
    Returns list of 16 dicts.
    """
    players = []
    base = block_offset + 22
    for i in range(16):
        rec_off = base + i * 8 + 2  # skip 2-byte packed text position
        pos_byte = rom[rec_off]
        app_byte = rom[rec_off + 1]
        pos_slot = (pos_byte >> 4) & 0x0F
        role_val = (app_byte >> 2) & 0x03
        head_val = app_byte & 0x03
        star = bool((app_byte >> 4) & 0x01)
        p = {
            'number': (pos_byte & 0x0F) + 1,
            'position': POSITION_NAMES.get(pos_slot, pos_slot),
            'role': ROLE_NAMES.get(role_val, role_val),
            'head': HEAD_NAMES.get(head_val, head_val),
        }
        if star:
            p['star'] = True
        players.append(p)
    return players


def decode_kit_attrs(rom, block_offset):
    """Decode kit attributes from bytes 8-17 of the attribute block."""
    b = block_offset + 8
    def _colour(v):
        return COLOUR_NAMES.get(v, v)
    def _style(v):
        return STYLE_NAMES.get(v, v)
    return {
        'first': {
            'style': _style(rom[b]),
            'shirt1': _colour(rom[b + 1]),
            'shirt2': _colour(rom[b + 2]),
            'shorts': _colour(rom[b + 3]),
            'socks': _colour(rom[b + 4]),
        },
        'second': {
            'style': _style(rom[b + 5]),
            'shirt1': _colour(rom[b + 6]),
            'shirt2': _colour(rom[b + 7]),
            'shorts': _colour(rom[b + 8]),
            'socks': _colour(rom[b + 9]),
        },
    }


def decode_team_attrs(rom, block_offset):
    """Decode team-level attributes from bytes 18-21 of the attribute block."""
    b = block_offset
    tactic_val = rom[b + 19]  # gameplay-active formation byte
    return {
        'tactic': TACTIC_NAMES.get(tactic_val, str(tactic_val)),
        'skill': (rom[b + 21] >> 3) & 0x07,
        'flag': rom[b + 21] & 0x01,
    }


def decode_team_block(rom, offset):
    """Decode a full team block at the given ROM offset (text start).
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
        'coach': manager,
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
        text_end_byte = offset + (bits4 + 7) // 8
        offset = text_end_byte + 100
    return found


def find_pointer_table(rom):
    """Find the 6-longword pointer table for the 3 team regions.

    Returns dict with nat_start, club_start, cust_start, nat_end, club_end,
    cust_end, and table_base.
    """
    text_offsets = auto_find_teams(rom)
    if not text_offsets:
        raise RuntimeError("No teams found in ROM")

    for text_off in text_offsets:
        block_start = text_off - 150
        target = struct.pack('>I', block_start)
        pos = 0
        while pos < 0x30000:
            found = rom.find(target, pos, 0x30000)
            if found == -1:
                break
            for slot in range(3):
                table_base = found - slot * 4
                if table_base < 0:
                    continue
                if table_base + 24 > len(rom):
                    continue
                ptrs = struct.unpack_from('>6I', rom, table_base)
                nat_s, club_s, cust_s, nat_e, club_e, cust_e = ptrs
                if (nat_s < club_s < cust_s and
                        nat_s < nat_e <= club_s and
                        club_s < club_e <= cust_s and
                        cust_s < cust_e and
                        0x010000 < nat_s < 0x040000):
                    return {
                        'nat_start': nat_s, 'club_start': club_s, 'cust_start': cust_s,
                        'nat_end': nat_e, 'club_end': club_e, 'cust_end': cust_e,
                        'table_base': table_base,
                    }
            pos = found + 1

    raise RuntimeError("Could not find pointer table in ROM code area")


def chain_walk_region(rom, region_start, region_end):
    """Chain-walk team blocks within a region using the 2-byte BE size word.

    Returns list of block start offsets.
    """
    blocks = []
    pos = region_start
    while pos < region_end:
        sz = struct.unpack_from('>H', rom, pos)[0]
        if sz < 160 or sz > 500:
            raise RuntimeError(f"Bad block size {sz} at 0x{pos:06X}")
        blocks.append(pos)
        pos += sz
    if pos != region_end:
        raise RuntimeError(
            f"Chain walk ended at 0x{pos:06X}, expected 0x{region_end:06X}")
    return blocks


def decode_region(rom, region_start, region_end):
    """Decode all teams in a region. Returns list of team info dicts."""
    blocks = chain_walk_region(rom, region_start, region_end)
    teams = []
    for block_off in blocks:
        text_off = block_off + 150
        info = decode_team_block(rom, text_off)
        info['block_offset'] = block_off
        info['kit'] = decode_kit_attrs(rom, block_off)
        info['team_attrs'] = decode_team_attrs(rom, block_off)
        info['player_attrs'] = decode_player_attrs(rom, block_off)
        teams.append(info)
    return teams


def decode_rom(rom_bytes):
    """Decode all teams from a ROM.

    Returns dict with 'national', 'club', 'custom' keys, each containing
    a list of team dicts ready for JSON serialization.
    """
    ptrs = find_pointer_table(rom_bytes)

    categories = [
        ('national', ptrs['nat_start'], ptrs['nat_end']),
        ('club', ptrs['club_start'], ptrs['club_end']),
        ('custom', ptrs['cust_start'], ptrs['cust_end']),
    ]

    all_teams = {}
    for cat_name, start, end in categories:
        all_teams[cat_name] = decode_region(rom_bytes, start, end)

    output = {}
    for cat_name in ('national', 'club', 'custom'):
        output[cat_name] = []
        for t in all_teams[cat_name]:
            players = []
            for j, name in enumerate(t['players']):
                pa = t['player_attrs'][j]
                pd = {
                    'name': name,
                    'number': pa['number'],
                    'position': pa['position'],
                    'role': pa['role'],
                    'head': pa['head'],
                }
                if pa.get('star'):
                    pd['star'] = True
                players.append(pd)
            ta = t['team_attrs']
            output[cat_name].append({
                'team': t['team'],
                'country': t['country'],
                'coach': t['coach'],
                'tactic': ta['tactic'],
                'skill': ta['skill'],
                'flag': ta['flag'],
                'kit': t['kit'],
                'players': players,
            })
    return output

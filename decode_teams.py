#!/usr/bin/env python3
"""
Sensible Soccer (Mega Drive) - Team Data Decoder/Encoder

Works with both the original and International Edition ROMs.

Team/player names are stored using 5-bit packed encoding (MSB-first bitstream).
Character set (index 0 = null terminator):
  0: NUL, 1-26: A-Z, 27: space, 28: -, 29: ', 30: .

Each team block contains:
  1. 150 bytes of attribute data (kit, team attrs, player records)
  2. Team name (5-bit packed, null-terminated)
  3. Country name (5-bit packed, null-terminated)
  4. Coach name (5-bit packed, null-terminated)
  5. 16 player names (5-bit packed, null-terminated each)

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

# --- Human-readable mapping tables ---

COLOUR_NAMES = {
    0x01: "grey", 0x02: "white", 0x03: "black", 0x04: "brown",0x05: "dark_orange", 0x06: "orange",
    0x07: "light_grey",0x08: "dark_grey",0x09: "dark_grey_2",
    0x0A: "red", 0x0B: "blue", 0x0C: "dark_red", 0x0D: "light_blue",
    0x0E: "green", 0x0F: "yellow",
}
COLOUR_VALUES = {v: k for k, v in COLOUR_NAMES.items()}

STYLE_NAMES = {0: "plain", 1: "sleeves", 2: "vertical", 3: "horizontal"}
STYLE_VALUES = {v: k for k, v in STYLE_NAMES.items()}

HEAD_NAMES = {0: "white_dark", 1: "white_blonde", 2: "black_dark"}
HEAD_VALUES = {v: k for k, v in HEAD_NAMES.items()}

TACTIC_NAMES = {0: "4-4-2", 1: "5-4-1", 2: "4-5-1", 3: "5-3-2", 4: "3-5-2", 5: "4-3-3"}
TACTIC_VALUES = {v: k for k, v in TACTIC_NAMES.items()}

ROLE_NAMES = {0: "GK", 1: "DEF", 2: "MID", 3: "FWD"}
ROLE_VALUES = {v: k for k, v in ROLE_NAMES.items()}

POSITION_NAMES = {
    0: "goalkeeper", 1: "right_back", 2: "left_back", 3: "defender", 4: "DEF4",
    5: "MID1", 6: "MID2", 7: "MID3", 8: "MID4",
    9: "FWD1", 10: "FWD2", 15: "SUB",
}
POSITION_VALUES = {v: k for k, v in POSITION_NAMES.items()}


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


def decode_player_attrs(rom, block_offset):
    """Decode the 16 player attribute records from the attribute block.

    Each player has an 8-byte record starting at block_offset + 22.
    Bytes 0-1 are the packed text position (rewritten by the tool).
    Byte 2: position byte — high nibble = formation slot (0=GK, 1-4=DEF,
            5-8=MID, 9-A=FWD, F=sub), low nibble = shirt number - 1.
    Byte 3: appearance — bits 0-1=head type (0=white/dark hair,1=white/blonde,
            2=black/dark), bits 2-3=type (0=GK,1=DEF,2=MID,3=FWD),
            bit 4=redundant hair bit (kept in sync).
    Bytes 4-7: unused (always 00).

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
    """Decode kit attributes from bytes 8-21 of the attribute block.

    Returns dict with first kit, second kit, and extra bytes.
    """
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
    """Decode team-level attributes from bytes 18-21 of the attribute block.

    Byte 18: tactic (formation preset, 0-5)
    Byte 19: division (competitive tier, 0-7)
    Byte 20: unused (always 0)
    Byte 21: bits 3-5 = skill tier (0=best, 7=weakest), bit 0 = flag
    """
    b = block_offset
    tactic_val = rom[b + 18]
    return {
        'tactic': TACTIC_NAMES.get(tactic_val, str(tactic_val)),
        'division': rom[b + 19],
        'skill': (rom[b + 21] >> 3) & 0x07,
        'flag': rom[b + 21] & 0x01,
    }


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


def find_pointer_table(rom):
    """Find the 6-longword pointer table for the 3 team regions.

    Uses auto_find_teams() to locate the club region start address, then
    searches the ROM code area for that address as a BE 32-bit value.
    The table layout is 6 consecutive longwords:
      nat_start, club_start, cust_start, nat_end, club_end, cust_end

    Returns dict with those keys plus 'table_base'.
    """
    text_offsets = auto_find_teams(rom)
    if not text_offsets:
        raise RuntimeError("No teams found in ROM")

    # auto_find_teams returns text start offsets; block starts are 150 bytes before.
    # The club region start is the block start of the first club team.
    # Club teams come after national teams. We need to find where club starts
    # by searching for the first text_offset - 150 as a pointer in the code area.
    # But we don't yet know which teams are national vs club. Instead, search for
    # each candidate block start address in the code area until we find one that's
    # part of a valid 6-pointer table.

    for text_off in text_offsets:
        block_start = text_off - 150
        target = struct.pack('>I', block_start)
        pos = 0
        while pos < 0x30000:
            found = rom.find(target, pos, 0x30000)
            if found == -1:
                break
            # This could be nat_start (+0), club_start (+4), or cust_start (+8)
            # Try each possibility
            for slot in range(3):
                table_base = found - slot * 4
                if table_base < 0:
                    continue
                if table_base + 24 > len(rom):
                    continue
                ptrs = struct.unpack_from('>6I', rom, table_base)
                nat_s, club_s, cust_s, nat_e, club_e, cust_e = ptrs
                # Validate ordering
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


def main():
    if len(sys.argv) < 2:
        print("Usage: decode_teams.py <rom_file> [--json]")
        sys.exit(1)

    rom_path = sys.argv[1]
    json_output = '--json' in sys.argv

    with open(rom_path, 'rb') as f:
        rom = f.read()

    ptrs = find_pointer_table(rom)

    categories = [
        ('national', ptrs['nat_start'], ptrs['nat_end']),
        ('club', ptrs['club_start'], ptrs['club_end']),
        ('custom', ptrs['cust_start'], ptrs['cust_end']),
    ]

    all_teams = {}
    for cat_name, start, end in categories:
        all_teams[cat_name] = decode_region(rom, start, end)

    if json_output:
        import json
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
                    'division': ta['division'],
                    'skill': ta['skill'],
                    'flag': ta['flag'],
                    'kit': t['kit'],
                    'players': players,
                })
        print(json.dumps(output, indent=2))
    else:
        for cat_name, start, end in categories:
            teams = all_teams[cat_name]
            print(f"\n{'#'*60}")
            print(f"# {cat_name.upper()} TEAMS ({len(teams)})  "
                  f"0x{start:06X}-0x{end:06X}")
            print(f"{'#'*60}")
            for i, t in enumerate(teams):
                print(f"\n{'='*60}")
                print(f"Team {i+1:2d}: {t['team']} ({t['country']}) "
                      f"@ 0x{t['block_offset']:06X}")
                print(f"Coach: {t['coach']}")
                print(f"Players:")
                for j, p in enumerate(t['players']):
                    print(f"  {j+1:2d}. {p}")
        total = sum(len(all_teams[c]) for c in all_teams)
        print(f"\nTotal: {total} teams")


if __name__ == '__main__':
    main()

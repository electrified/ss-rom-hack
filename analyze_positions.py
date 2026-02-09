#!/usr/bin/env python3
"""Analyze the relationship between actual bit positions and ROM attribute values."""

import sys
sys.path.insert(0, '/home/ed/dev/ss-md-hack')
from decode_teams import CHARSET, decode_5bit_string, decode_team_block, auto_find_teams

# Lookup table offsets (where in the 150-byte attr block the position words are stored)
ATTR_OFFSETS = [2, 4, 6, 22, 30, 38, 46, 54, 62, 70, 78, 86, 94, 102, 110, 118, 126, 134, 142]

with open('/home/ed/dev/ss-md-hack/ssint_orig.md', 'rb') as f:
    rom = f.read()

offsets = auto_find_teams(rom)

# Collect all data points
all_points = []

for team_idx in range(len(offsets)):
    offset = offsets[team_idx]
    info = decode_team_block(rom, offset)

    text_end = info['text_end']
    attr_start = text_end + (text_end % 2)
    attr_data = rom[attr_start:attr_start + 150]

    # Get all 19 string bit positions by decoding sequentially
    bit_positions = [0]
    bit_pos = 0
    strings = []
    for i in range(19):
        s, bit_pos = decode_5bit_string(rom, offset, bit_pos)
        strings.append(s)
        if i < 18:
            bit_positions.append(bit_pos)

    for i in range(19):
        attr_off = ATTR_OFFSETS[i]
        rom_val = (attr_data[attr_off] << 8) | attr_data[attr_off + 1]
        bp = bit_positions[i]

        # Decode the ROM value as (byte << 5) | bit
        rom_byte = rom_val >> 5
        rom_bit = rom_val & 0x1F
        decoded_total_bits = (rom_byte - 150) * 8 + rom_bit

        all_points.append({
            'team_idx': team_idx,
            'str_idx': i,
            'team': info['team'],
            'string': strings[i],
            'bp': bp,
            'rom_val': rom_val,
            'rom_byte': rom_byte,
            'rom_bit': rom_bit,
            'decoded_bits': decoded_total_bits,
        })

# Print first 5 teams with full detail
for team_idx in range(5):
    pts = [p for p in all_points if p['team_idx'] == team_idx]
    print(f"\n{'='*80}")
    print(f"Team {team_idx}: {pts[0]['team']}")
    print(f"{'Str':>3} {'bp':>5} {'rom':>6} {'rbyte':>5} {'rbit':>4} {'dec_bits':>8} {'diff':>5} {'string':<25}")
    for p in pts:
        diff = p['bp'] - p['decoded_bits']
        print(f"{p['str_idx']:3d} {p['bp']:5d} 0x{p['rom_val']:04X} {p['rom_byte']:5d} {p['rom_bit']:4d} {p['decoded_bits']:8d} {diff:5d}  {p['string']}")

# Now let's look at cumulative null terminators and see if that explains the diff
print(f"\n\n{'='*80}")
print("Checking if diff correlates with number of null terminators processed")
print(f"{'='*80}")
for team_idx in range(3):
    pts = [p for p in all_points if p['team_idx'] == team_idx]
    print(f"\nTeam: {pts[0]['team']}")
    for p in pts:
        diff = p['bp'] - p['decoded_bits']
        # Number of strings (null terminators) before this one
        num_nulls = p['str_idx']
        # Number of null term bits = num_nulls * 5
        null_bits = num_nulls * 5
        print(f"  str{p['str_idx']:2d}: bp={p['bp']:4d} dec_bits={p['decoded_bits']:4d} diff={diff:3d} nulls_before={num_nulls} null_bits={null_bits} diff-null_bits={diff-null_bits}")

# Check: maybe the game writes each character as a byte (not packed)?
print(f"\n\n{'='*80}")
print("Checking byte-per-character model")
print(f"{'='*80}")
for team_idx in range(3):
    pts = [p for p in all_points if p['team_idx'] == team_idx]
    offset = offsets[team_idx]

    # Count characters up to each string start
    bit_pos = 0
    char_count = 0
    print(f"\nTeam: {pts[0]['team']}")
    for i in range(19):
        # Position before decoding string i
        expected_byte = 150 + char_count
        expected_rom_val = expected_byte << 5  # assuming bit=0 for byte-aligned

        rom_val = pts[i]['rom_val']
        rom_byte = pts[i]['rom_byte']

        s, bit_pos = decode_5bit_string(rom, offset, bit_pos) if i == 0 else (None, bit_pos)
        if i > 0:
            s = pts[i]['string']
        else:
            s = pts[0]['string']

        print(f"  str{i:2d}: chars_so_far={char_count:4d} exp_byte={expected_byte:4d} rom_byte={rom_byte:4d} diff={rom_byte-expected_byte:3d}  '{s}'")

        # Count chars in this string (including null terminator)
        char_count += len(s) + 1  # +1 for null terminator

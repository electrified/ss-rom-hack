#!/usr/bin/env python3
"""Verify that team block layout is [attrs][text], not [text][attrs]."""

import sys
sys.path.insert(0, '/home/ed/dev/ss-md-hack')
from decode_teams import auto_find_teams, decode_team_block

with open('/home/ed/dev/ss-md-hack/ssint_orig.md', 'rb') as f:
    rom = f.read()

offsets = auto_find_teams(rom)

# auto_find_teams finds the TEXT start. If layout is [attrs(150)][text],
# then attribute block starts 150 bytes before text.
print("=== Checking if 0x01 marker appears 150 bytes before text ===")
for i in range(10):
    text_start = offsets[i]
    possible_attr_start = text_start - 150
    marker_byte = rom[possible_attr_start]
    # Also check with padding: sometimes 151 bytes before
    marker_byte_151 = rom[text_start - 151] if text_start >= 151 else 0
    # Check with 2-byte length prefix: maybe 152 before
    marker_byte_152 = rom[text_start - 152] if text_start >= 152 else 0

    info = decode_team_block(rom, text_start)
    print(f"  Team {i:2d}: text@0x{text_start:06X}  [-150]=0x{marker_byte:02X}  [-151]=0x{marker_byte_151:02X}  [-152]=0x{marker_byte_152:02X}  '{info['team']}'")

# Also check: what 16-bit value is at attr_offset 2 (relative to -150)?
print("\n=== Checking packed position for string 0 (should be 0x12C0 = 150<<5|0) ===")
for i in range(10):
    text_start = offsets[i]
    attr_start = text_start - 150
    word_at_2 = (rom[attr_start + 2] << 8) | rom[attr_start + 3]
    print(f"  Team {i:2d}: attr@0x{attr_start:06X}  word@2=0x{word_at_2:04X}  (expected 0x12C0)")

# What about the old layout assumption (attrs AFTER text)?
print("\n=== Old assumption: attrs after text ===")
for i in range(5):
    text_start = offsets[i]
    info = decode_team_block(rom, text_start)
    text_end = info['text_end']
    old_attr_start = text_end + (text_end % 2)
    marker = rom[old_attr_start]
    word_at_2 = (rom[old_attr_start + 2] << 8) | rom[old_attr_start + 3]
    print(f"  Team {i:2d}: attr@0x{old_attr_start:06X}  marker=0x{marker:02X}  word@2=0x{word_at_2:04X}")

# NEW: Check if there's a 2-byte length prefix before the attrs
print("\n=== Checking for length prefix ===")
for i in range(10):
    text_start = offsets[i]
    # Check 2 bytes before attr block start
    prefix_addr = text_start - 152
    if prefix_addr >= 0:
        length_word = (rom[prefix_addr] << 8) | rom[prefix_addr + 1]
        info = decode_team_block(rom, text_start)
        text_bits = info['text_bits']
        text_bytes = (text_bits + 7) // 8
        expected_total = 150 + text_bytes  # attrs + text
        # Also check with padding
        print(f"  Team {i:2d}: len@0x{prefix_addr:06X}=0x{length_word:04X}={length_word:4d}  text_bytes={text_bytes:3d}  150+text={expected_total:3d}")

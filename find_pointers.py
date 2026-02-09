#!/usr/bin/env python3
"""Search for pointer tables that reference team data offsets."""

import sys
import struct
sys.path.insert(0, '/home/ed/dev/ss-md-hack')
from decode_teams import auto_find_teams

with open('/home/ed/dev/ss-md-hack/ssint_orig.md', 'rb') as f:
    rom = f.read()

offsets = auto_find_teams(rom)
print(f"Found {len(offsets)} teams")
print(f"First team: 0x{offsets[0]:06X}, Last team: 0x{offsets[-1]:06X}")

# Search for 32-bit pointers to the first few team offsets
print("\n=== Searching for 32-bit pointers to team offsets ===")
for i in range(min(5, len(offsets))):
    target = offsets[i]
    # Search as big-endian 32-bit
    needle = struct.pack('>I', target)
    pos = 0
    while True:
        pos = rom.find(needle, pos)
        if pos == -1:
            break
        # Skip if it's within the team data region itself
        if pos < 0x020000 or pos > 0x030000:
            print(f"  Team {i} (0x{target:06X}) found as 32-bit BE at 0x{pos:06X}")
        pos += 1

# Search for 16-bit relative offsets
print("\n=== Searching for 16-bit offset tables ===")
# Try various base addresses
for base in [0x020000, 0x024000, 0x0243DC, 0x000000]:
    found_at = None
    # Look for the first 3 team offsets as consecutive 16-bit values
    target_words = [(offsets[i] - base) & 0xFFFF for i in range(3)]
    if all(0 <= w < 0xFFFF for w in target_words):
        needle = struct.pack('>HHH', *target_words)
        pos = rom.find(needle, 0, 0x030000)
        if pos != -1:
            print(f"  Base 0x{base:06X}: first 3 offsets found at 0x{pos:06X}")
            found_at = pos

# Also try: maybe the game stores byte sizes of each team block
print("\n=== Checking team block sizes ===")
sizes = []
for i in range(len(offsets) - 1):
    sizes.append(offsets[i+1] - offsets[i])
print(f"Block sizes: min={min(sizes)}, max={max(sizes)}, unique={len(set(sizes))}")
print(f"First 10 sizes: {sizes[:10]}")

# Search for a table of block sizes
# sizes are > 255, skip 8-bit search

# Try 16-bit sizes
size_words = b''.join(struct.pack('>H', s) for s in sizes[:5])
pos = rom.find(size_words, 0, 0x030000)
if pos != -1:
    print(f"  16-bit size table found at 0x{pos:06X}")

# Search for the absolute start address of team data as a 32-bit pointer anywhere
print("\n=== Searching for references to team data region start ===")
region_start = offsets[0]  # 0x0243DC
needle = struct.pack('>I', region_start)
pos = 0
while True:
    pos = rom.find(needle, pos)
    if pos == -1:
        break
    print(f"  0x{region_start:06X} found at ROM offset 0x{pos:06X}")
    pos += 1

# Also search for LEA-style references (68000 often uses PC-relative or absolute)
# The 68000 LEA instruction for absolute long is 41F9 followed by 32-bit address
print("\n=== Searching for 68000 LEA instructions referencing team data ===")
for target in [region_start, region_start - 2, region_start + 150]:
    lea_abs = b'\x41\xF9' + struct.pack('>I', target)  # LEA (xxx).L, A0
    # Try all address registers
    for areg in range(8):
        opcode = 0x41F9 + (areg << 9)
        needle = struct.pack('>H', opcode) + struct.pack('>I', target)
        pos = rom.find(needle, 0, 0x030000)
        if pos != -1:
            print(f"  LEA 0x{target:06X}, A{areg} at 0x{pos:06X}")

    # MOVEA.L #imm, An
    for areg in range(8):
        opcode = 0x207C + (areg << 9)  # MOVEA.L #imm, An
        needle = struct.pack('>H', opcode) + struct.pack('>I', target)
        pos = rom.find(needle, 0, 0x030000)
        if pos != -1:
            print(f"  MOVEA.L #0x{target:06X}, A{areg} at 0x{pos:06X}")

# Let's also look at the code around the decode routine (0x019658) for references
print("\n=== Hex dump around decode routine (0x019600-0x019700) ===")
for addr in range(0x019600, 0x019700, 16):
    hexbytes = ' '.join(f'{rom[addr+j]:02X}' for j in range(16))
    print(f"  {addr:06X}: {hexbytes}")

# Search more broadly for the team data start address
print("\n=== All occurrences of bytes 02 43 DC in ROM ===")
needle = bytes([0x02, 0x43, 0xDC])
pos = 0
while True:
    pos = rom.find(needle, pos)
    if pos == -1:
        break
    context = rom[max(0,pos-4):pos+8]
    hexctx = ' '.join(f'{b:02X}' for b in context)
    print(f"  Found at 0x{pos:06X}: ...{hexctx}...")
    pos += 1

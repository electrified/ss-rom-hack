#!/usr/bin/env python3
"""Disassemble 68000 code from the Sensible Soccer ROM."""

import sys
from capstone import *

with open('/home/ed/dev/ss-md-hack/ssint_orig.md', 'rb') as f:
    rom = f.read()

md = Cs(CS_ARCH_M68K, CS_MODE_BIG_ENDIAN | CS_MODE_M68K_000)
md.detail = True

# Disassemble around the team decode routines
ranges = [
    (0x019480, 0x0196A2, "Main team decode area"),
    (0x0196C0, 0x019760, "Secondary routine after charset"),
]

for start, end, label in ranges:
    print(f"\n{'='*70}")
    print(f"  {label}: 0x{start:06X} - 0x{end:06X}")
    print(f"{'='*70}")
    code = rom[start:end]
    for insn in md.disasm(code, start):
        print(f"  {insn.address:06X}: {insn.mnemonic:10s} {insn.op_str}")
        if insn.address >= end:
            break

#!/usr/bin/env python3
"""
Sensible Soccer (Mega Drive) - Team Data Decoder

Decodes team/player data from ROM into JSON format.
"""

import sys
import json
import argparse

from sslib import decode_rom


def main():
    parser = argparse.ArgumentParser(
        description='Decode team data from a Sensible Soccer (Mega Drive) ROM')
    parser.add_argument('rom', help='Input ROM file')
    parser.add_argument('-o', '--output', help='Write output to file instead of stdout')
    args = parser.parse_args()

    with open(args.rom, 'rb') as f:
        rom = f.read()

    teams = decode_rom(rom)

    output = {'$schema': './teams.schema.json', **teams}
    text = json.dumps(output, indent=2)

    if args.output:
        with open(args.output, 'w') as f:
            f.write(text)
            f.write('\n')
        total = sum(len(teams[c]) for c in teams)
        print(f"Written {total} teams to {args.output}", file=sys.stderr)
    else:
        print(text)


if __name__ == '__main__':
    main()

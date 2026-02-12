#!/usr/bin/env python3
"""
Sensible Soccer (Mega Drive) - ROM Team Name Editor

Reads an edited JSON file and writes the modified team/player data back
into the ROM.
"""

import sys
import json
import argparse

from sslib import validate_teams, update_rom
from sslib.constants import CATEGORIES


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

    with open(args.rom, 'rb') as f:
        rom = f.read()

    with open(args.teams_json, 'r') as f:
        teams_json = json.load(f)

    errors, warnings = validate_teams(rom, teams_json)

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
            n = len(teams_json[cat])
            total_players += n * 16
            print(f"{cat:8s}: {n} teams OK")
        print(f"Total: {total_players} players validated")
        sys.exit(0)

    result = update_rom(rom, teams_json)

    with open(args.output, 'wb') as f:
        f.write(result)

    print(f"Written to: {args.output}")


if __name__ == '__main__':
    main()

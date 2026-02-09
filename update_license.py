#!/usr/bin/env python3
"""
Sensible Soccer (Mega Drive) - ROM Licensing Text Editor

Modifies the licensing and legal text displayed on screen.

IMPORTANT: Strings are stored contiguously in the ROM. Each string has:
- 1 byte marker (0x01) for main license block
- N bytes for characters
- 1 byte terminator (0x00)

When modifying text, replacement strings are padded to maintain original byte
positions so subsequent strings don't shift.

Usage:
    python3 update_license.py <rom> <license.json> -o <output.md>
    python3 update_license.py <rom> --show-json

Example:
    python3 update_license.py ss_modded.md license.json -o new.md
    python3 update_license.py ss_modded.md --show-json
"""

import sys
import argparse
import json

EUROPEAN_WARNING = 0x018BAB
DISCLAIMER_START = 0x018BF6

LICENSE_STRINGS = [
    (0x018A3A, "copyright", 38),
    (0x018A61, "exclusive", 48),
    (0x018A92, "from", 24),
]

LICENSE_DEFAULTS = {
    "copyright": "(C) 1992,1993,1994 SENSIBLE SOFTWARE.",
    "exclusive": "UNDER EXCLUSIVE LICENCE TO SONY IMAGESOFT, INC.",
    "from": "FROM RENEGADE SOFTWARE.",
    "european_warning": "THIS GAME CARTRIDGE IS ONLY DESIGNED TO RUN ON A EUROPEAN MEGADRIVE SYSTEM",
    "disclaimer": "THIS GAME IS NOT CONNECTED WITH OR ENDORSED OR APPROVED BY ANY PLAYER TEAM OR ORGANISATION WHETHER REFERRED TO OR CONTAINED IN THE ELEMENTS OF THE GAME OR OTHERWISE.",
}


def decode_license_string(data, offset, has_marker=True):
    """Decode a license string."""
    i = offset

    if has_marker and data[i] == 0x01:
        i += 1

    chars = []
    while i < len(data) and data[i] not in [0x00, 0xFF]:
        if 32 <= data[i] < 127:
            chars.append(chr(data[i]))
        i += 1
    return "".join(chars)


def encode_license_string(text, max_bytes, has_marker=True):
    """Encode a license string padded to exactly max_bytes to maintain position."""
    result = bytearray()
    if has_marker:
        result.append(0x01)
    result.extend(text.upper().encode("ascii"))
    terminator = 0x00
    current_len = len(result) + 1  # +1 for terminator
    padding = max_bytes - current_len
    if padding > 0:
        result.extend([0x00] * padding)
    elif padding < 0:
        padding = 0
    result.append(terminator)
    return bytes(result)


def show_license_text(rom_data):
    """Display all licensing text from the ROM."""
    print("=" * 70)
    print("Sensible Soccer - Licensing Text")
    print("=" * 70)
    print()

    print("Main Licensing Block (0x018A00 region):")
    print("-" * 50)
    for offset, key, size in LICENSE_STRINGS:
        current = decode_license_string(rom_data, offset, has_marker=True)
        print(f"  {key:12s} @ 0x{offset:06X} ({size} bytes): {current}")
    print()

    print(f"European Warning @ 0x{EUROPEAN_WARNING:06X}:")
    print("-" * 50)
    eurowarn = decode_license_string(rom_data, EUROPEAN_WARNING, has_marker=False)
    print(f"  {eurowarn}")
    print()

    print(f"Disclaimer @ 0x{DISCLAIMER_START:06X}:")
    print("-" * 50)
    disclaimer = decode_license_string(rom_data, DISCLAIMER_START, has_marker=False)
    print(f"  {disclaimer[:80]}...")
    print()


def update_license_string(rom_data, offset, new_text, max_bytes, has_marker=True):
    """Replace a license string, padding to maintain byte position."""
    rom = bytearray(rom_data)

    new_bytes = encode_license_string(new_text, max_bytes, has_marker)

    rom[offset : offset + len(new_bytes)] = new_bytes

    return bytes(rom)


def main():
    parser = argparse.ArgumentParser(
        description="Edit Sensible Soccer ROM licensing text",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s rom.md license.json -o new.md    # Apply changes from JSON
  %(prog)s rom.md --show-json                 # Show current text as JSON
  %(prog)s rom.md --show                      # Display current text
        """,
    )

    parser.add_argument("rom", help="Input ROM file")
    parser.add_argument(
        "license_json", nargs="?", help="JSON file with license text changes"
    )
    parser.add_argument("-o", "--output", help="Output ROM file")

    parser.add_argument(
        "--show", action="store_true", help="Show current licensing text"
    )
    parser.add_argument(
        "--show-json", action="store_true", help="Show current text as JSON"
    )

    args = parser.parse_args()

    with open(args.rom, "rb") as f:
        rom_data = bytearray(f.read())

    if args.show_json:
        result = {}
        for offset, key, size in LICENSE_STRINGS:
            result[key] = decode_license_string(rom_data, offset, has_marker=True)
        result["european_warning"] = decode_license_string(
            rom_data, EUROPEAN_WARNING, has_marker=False
        )
        result["disclaimer"] = decode_license_string(
            rom_data, DISCLAIMER_START, has_marker=False
        )
        print(json.dumps(result, indent=2))
        return

    if args.show:
        show_license_text(rom_data)
        return

    if not args.license_json:
        print(
            "Error: license_json required. Use --show to view or --show-json for JSON.",
            file=sys.stderr,
        )
        sys.exit(1)

    if not args.output:
        print("Error: output file required (-o <file>)", file=sys.stderr)
        sys.exit(1)

    if args.output == args.rom:
        print("Error: output file must differ from input ROM", file=sys.stderr)
        sys.exit(1)

    with open(args.license_json, "r") as f:
        new_values = json.load(f)

    rom = bytearray(rom_data)
    changes = []

    for offset, key, size in LICENSE_STRINGS:
        if key in new_values:
            rom = update_license_string(
                rom, offset, new_values[key], size, has_marker=True
            )
            changes.append(key)

    if "european_warning" in new_values:
        rom = update_license_string(
            rom, EUROPEAN_WARNING, new_values["european_warning"], 75, has_marker=False
        )
        changes.append("european_warning")

    if "disclaimer" in new_values:
        rom = update_license_string(
            rom, DISCLAIMER_START, new_values["disclaimer"], 166, has_marker=False
        )
        changes.append("disclaimer")

    with open(args.output, "wb") as f:
        f.write(rom)

    if changes:
        print("Changes applied:")
        for c in changes:
            print(f"  - {c}")
    else:
        print("No changes specified in JSON file.")
    print()
    print(f"Written to: {args.output}")


if __name__ == "__main__":
    main()

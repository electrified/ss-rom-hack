#!/usr/bin/env python3
"""Test script for the web API."""

import sys
import json
from pathlib import Path

# Add parent directory to path for sslib import
sys.path.insert(0, str(Path(__file__).parent.parent))
from sslib import decode_rom, validate_teams


def test_decode():
    """Test ROM decoding."""
    rom_path = Path("/home/ed/dev/ss-md-hack/ssint_orig.md")
    if not rom_path.exists():
        print(f"ROM file not found: {rom_path}")
        return False

    rom_bytes = rom_path.read_bytes()
    print(f"ROM size: {len(rom_bytes)} bytes")

    teams = decode_rom(rom_bytes)

    national = len(teams.get("national", []))
    club = len(teams.get("club", []))
    custom = len(teams.get("custom", []))
    total = national + club + custom

    print(f"Teams found: {total}")
    print(f"  National: {national}")
    print(f"  Club: {club}")
    print(f"  Custom: {custom}")

    # Save JSON for testing
    output = {"$schema": "./teams.schema.json", **teams}
    json_path = Path("/tmp/test_teams.json")
    json_path.write_text(json.dumps(output, indent=2))
    print(f"Saved JSON to: {json_path}")

    return True


def test_validation():
    """Test validation with original ROM and JSON."""
    rom_path = Path("/home/ed/dev/ss-md-hack/ssint_orig.md")
    json_path = Path("/tmp/test_teams.json")

    if not rom_path.exists() or not json_path.exists():
        print("Missing test files")
        return False

    rom_bytes = rom_path.read_bytes()
    teams_data = json.loads(json_path.read_text())

    errors, warnings = validate_teams(rom_bytes, teams_data)

    print(f"\nValidation results:")
    print(f"  Errors: {len(errors)}")
    print(f"  Warnings: {len(warnings)}")

    if errors:
        print("\nErrors:")
        for err in errors[:5]:  # Show first 5
            print(f"  - {err}")

    if warnings:
        print("\nWarnings:")
        for warn in warnings[:5]:  # Show first 5
            print(f"  - {warn}")

    return len(errors) == 0


if __name__ == "__main__":
    print("Testing ROM decoding...")
    if not test_decode():
        print("FAILED: Decode test")
        sys.exit(1)

    print("\nTesting validation...")
    if not test_validation():
        print("FAILED: Validation test")
        sys.exit(1)

    print("\nAll tests passed!")

# Sensible Soccer MD ROM Hack Project

## Key Findings: Team Name Encoding

- **Encoding**: 5-bit packed bitstream, MSB-first
- **Character set** at ROM offset `0x0196A4` (intl) / `0x01941A` (orig): `\x00ABCDEFGHIJKLMNOPQRSTUVWXYZ -'.`
  - Index 0 = null terminator, 1-26 = A-Z, 27 = space, 28 = `-`, 29 = `'`, 30 = `.`
- **Decode routine**: `0x019658` (intl) / `0x0193AE` approx (orig)
- **Team data block** (intl): `0x0243DC` - `0x029260` (~19.6KB)
- Each team block: team name + country + manager + 16 players (all 5-bit null-terminated) + ~150 bytes attribute data
- Tool: `decode_teams.py` decodes all 64 teams

## RNC Blocks
- 4 RNC method 2 blocks in both ROMs (graphics/ZID tile data)
- **Identical** between original and international edition
- Not relevant to team name data

## ROM Differences
- Original game: misspelled player names (licensing), team data at different offsets
- International edition: real player names, European cup teams
- Both use the same 5-bit text encoding engine

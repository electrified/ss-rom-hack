# Sensible Soccer (Mega Drive) ROM Tools

Tools for decoding and editing team data in Sensible Soccer Mega Drive ROMs.
Works with both the **International Edition** and the **Original/European Edition**.

## What you can edit

- Team names, country names, coach names
- All 16 player names per team
- Kit colours and styles (plain, sleeves, vertical stripes, horizontal stripes)
- Formation / tactic (4-4-2, 5-4-1, 4-5-1, 5-3-2, 3-5-2, 4-3-3, 3-3-4, 6-3-1)
- Team skill level (0=best, 7=weakest)
- Player positions, roles, shirt numbers, head types, star player flags

All 3 team regions are supported: national, club, and custom.

## Usage

### Extract teams to JSON

```
python3 decode_teams.py <rom_file> -o teams.json
```

Or pipe to stdout:

```
python3 decode_teams.py <rom_file> > teams.json
```

### Edit teams

Edit `teams.json` with any text editor. The structure is:

```json
{
  "national": [
    {
      "team": "ALBANIA",
      "country": "ALBANIA",
      "coach": "BUSHI",
      "tactic": "3-5-2",
      "skill": 4,
      "kit": {
        "first": {"style": "plain", "shirt1": "red", "shirt2": "red", "shorts": "red", "socks": "red"},
        "second": {"style": "plain", "shirt1": "white", "shirt2": "white", "shorts": "white", "socks": "white"}
      },
      "players": [
        {"name": "FOTO STRAKOSHA", "number": 1, "position": "goalkeeper", "role": "goalkeeper", "head": "white_dark"},
        {"name": "HYSEN ZMIJANI", "number": 2, "position": "left_back", "role": "defender", "head": "white_dark"},
        {"name": "RUDI VATA", "number": 5, "position": "centre_midfield", "role": "midfielder", "head": "white_dark", "star": true},
        {"name": "XHEVAIR KAPLLANI", "number": 12, "position": "sub", "role": "goalkeeper", "head": "white_dark"}
      ]
    }
  ],
  "club": [...],
  "custom": [...]
}
```

### Write changes back to ROM

```
python3 update_teams.py <rom_file> teams.json -o modded.md
```

The output file is always separate from the input — the tool will not overwrite
your original ROM. The tool shows which teams changed and what was modified.

### Validate JSON without writing

```
python3 update_teams.py <rom_file> teams.json --validate
```

Checks team counts, character sets, enum values, and player attributes, then
prints a summary and exits without writing a ROM.

## Player fields

| Field      | Values |
|------------|--------|
| `position` | `goalkeeper`, `right_back`, `left_back`, `centre_back`, `defender`, `right_midfield`, `centre_midfield`, `left_midfield`, `midfielder`, `forward`, `second_forward`, `sub` |
| `role`     | `goalkeeper`, `defender`, `midfielder`, `forward` |
| `head`     | `white_dark`, `white_blonde`, `black_dark` |
| `star`     | `true` (omit if not a star player) |
| `number`   | 1-16 |

## Kit fields

| Field    | Values |
|----------|--------|
| `style`  | `plain`, `sleeves`, `vertical`, `horizontal` |
| colours  | `white`, `black`, `red`, `blue`, `green`, `yellow`, `orange`, `dark_orange`, `dark_red`, `light_blue`, `grey`, `light_grey`, `dark_grey`, `dark_grey_2`, `brown` |

## JSON Schema

A [JSON Schema](teams.schema.json) is provided for editor support. Add this to
the top of your teams JSON file for VS Code autocomplete and validation:

```json
{
  "$schema": "./teams.schema.json",
  "national": [...]
}
```

## Documentation

- [rom-structure.md](rom-structure.md) - full binary layout of team blocks, attributes, and pointer tables

## Quick recipes

List all teams with their skill levels:

```
jq -r 'del(."$schema") | keys[] as $type | .[$type][] | [$type, .team, .skill] | @tsv' teams.json
```

Find all star players:

```
jq -r 'del(."$schema") | to_entries[] | .key as $type | .value[] | . as $team | .players[] | select(.star == true) | "\(.name) - \($team.team)"' teams.json
```

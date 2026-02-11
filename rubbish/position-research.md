# Position & Formation Research

## Formation Lookup Table

The game stores a formation lookup table at **`$016034`** containing 8 longword
pointers, one per formation. Each pointer references an 11-entry sub-table
(22 bytes) mapping formation slots 0–10 to roles (0=GK, 1=DEF, 2=MID, 3=FWD).

### Sub-table pointers

| Formation | Value | Address    |
|-----------|-------|------------|
| 4-4-2     | 0     | `$015F84`  |
| 5-4-1     | 1     | `$015FF2`  |
| 4-5-1     | 2     | `$015FB0`  |
| 5-3-2     | 3     | `$015FDC`  |
| 3-5-2     | 4     | `$015FC6`  |
| 4-3-3     | 5     | `$015F9A`  |
| 3-3-4     | 6     | `$016008`  |
| 6-3-1     | 7     | `$01601E`  |

### Slot-to-role mapping per formation

| Slot | Name             | 4-4-2 | 5-4-1 | 4-5-1 | 5-3-2 | 3-5-2 | 4-3-3 | 3-3-4 | 6-3-1 |
|------|------------------|-------|-------|-------|-------|-------|-------|-------|-------|
| 0    | goalkeeper       | GK    | GK    | GK    | GK    | GK    | GK    | GK    | GK    |
| 1    | right_back       | DEF   | DEF   | DEF   | DEF   | DEF   | DEF   | DEF   | DEF   |
| 2    | left_back        | DEF   | DEF   | DEF   | DEF   | DEF   | DEF   | DEF   | DEF   |
| 3    | centre_back      | DEF   | DEF   | DEF   | DEF   | MID   | DEF   | MID   | DEF   |
| 4    | defender         | DEF   | DEF   | DEF   | DEF   | DEF   | DEF   | DEF   | DEF   |
| 5    | right_midfield   | MID   | MID   | MID   | MID   | MID   | MID   | MID   | MID   |
| 6    | centre_midfield  | MID   | DEF   | MID   | DEF   | MID   | MID   | FWD   | DEF   |
| 7    | left_midfield    | MID   | MID   | MID   | MID   | MID   | FWD   | FWD   | DEF   |
| 8    | midfielder       | MID   | MID   | MID   | MID   | MID   | MID   | MID   | MID   |
| 9    | forward          | FWD   | MID   | MID   | FWD   | FWD   | FWD   | FWD   | MID   |
| 10   | second_forward   | FWD   | FWD   | FWD   | FWD   | FWD   | FWD   | FWD   | FWD   |

Slots 3, 6, 7, and 9 shift roles depending on the formation. For example,
slot 6 (centre_midfield) becomes DEF in 5-4-1 and 5-3-2, and slot 9 (forward)
becomes MID in 5-4-1 and 4-5-1.


## Stored Role vs Formation Table

The stored role (bits 2–3 of the appearance byte) matches the formation
lookup table **97.6%** of the time across all 1,969 starting players in the
International ROM:

| Category                         | Count | Percentage |
|----------------------------------|-------|------------|
| Matches formation table          | 1,922 | 97.6%      |
| Matches default 4-4-2 instead    | 20    | 1.0%       |
| Matches neither                  | 27    | 1.4%       |

The mismatches appear to be data entry errors rather than intentional
overrides. Examples include Ryan Giggs (slot=right_midfield, stored=forward,
table=midfielder) and several custom team players.

For substitutes (slot 15), the stored role indicates what position the sub
plays — it cannot be derived from the formation table since subs are not
in the 11-slot formation.


## Key ROM Addresses

| Address      | Description                                        |
|--------------|----------------------------------------------------|
| `$016034`    | Formation lookup table (8 longword pointers)       |
| `$015F84`    | First sub-table (4-4-2, 11 words)                  |
| `$01CE12`    | Code that performs formation lookup                 |
| `$01C960`    | Team editor: reads/writes formation (byte 19)      |
| `$01C7FC`    | Menu UI: formation picker (loops 0–7)              |
| `$01F968`    | Match setup: copies formation to runtime RAM       |

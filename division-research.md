# Division & Flag Research — 68000 Disassembly Findings

## Summary

- **Byte 19 ("division")** is actually the **gameplay-active formation/tactic**.
  It is functionally identical to byte 18 ("tactic") for national/club teams,
  and is the only one the game engine reads at runtime.
- **Byte 21 bit 0 ("flag")** is **never read by the game engine**. It is
  masked away during skill extraction.


## Division (byte 19) = Formation

### Evidence 1: Formation lookup table at `$016034`

The game uses byte 19 as an index into a table of 8 longword pointers at
`$016034`. Each pointer leads to an 11-entry sub-table that maps the 11
formation slots (GK, DEF1–4, MID1–4, FWD1–2) to roles (0=GK, 1=DEF,
2=MID, 3=FWD).

Code at `$01CE12` performs this lookup:

```
$01CE12  MOVE.W  (division),D0       ; read byte 19 value
         ASL.W   #2,D0               ; multiply by 4 (longword index)
         LEA     $016034,A0          ; formation table base
         MOVEA.L (A0,D0.W),A0        ; follow pointer to sub-table
         ; A0 now points to 11-byte role mapping for this formation
```

### Evidence 2: Formation mappings

The 8 sub-tables define these formations:

| Index | Formation | Slot→Role mapping (11 slots)                   |
|-------|-----------|------------------------------------------------|
| 0     | 4-4-2     | GK, DEF DEF DEF DEF, MID MID MID MID, FWD FWD |
| 1     | 5-4-1     | GK, DEF DEF DEF DEF DEF, MID MID MID MID, FWD |
| 2     | 4-5-1     | GK, DEF DEF DEF DEF, MID MID MID MID MID, FWD |
| 3     | 5-3-2     | GK, DEF DEF DEF DEF DEF, MID MID MID, FWD FWD |
| 4     | 3-5-2     | GK, DEF DEF DEF, MID MID MID MID MID, FWD FWD |
| 5     | 4-3-3     | GK, DEF DEF DEF DEF, MID MID MID, FWD FWD FWD |
| 6     | 3-3-4     | GK, DEF DEF DEF, MID MID MID, FWD FWD FWD FWD |
| 7     | 6-3-1     | GK, DEF DEF DEF DEF DEF DEF, MID MID MID, FWD |

Formations 6 and 7 are only used by custom teams in the original ROM data.

### Evidence 3: tactic == division for all national/club teams

A scan of all 135 national and club teams in both ROM editions confirms
that byte 18 and byte 19 always have the same value. Only custom teams
differ: they all have byte 18 = 0 but byte 19 varies across 0–7.

### Evidence 4: In-game team editor uses byte 19

The team editor code at `$01C960` reads and writes byte 19 exclusively.
Byte 18 is never modified by the editor. The editor's formation picker
UI at `$01C7FC` loops 8 times (values 0–7), highlighting the current
formation — matching the 8-entry lookup table.

### Evidence 5: Match setup copies byte 19 to runtime RAM

Code at `$01F968` stores the byte 19 value into `$FF0318` (team A) and
`$FF031A` (team B) before each match begins.

### Conclusion

Byte 18 appears to be the "initial" or "default" formation value, while
byte 19 is the gameplay-active one. For national/club teams they are
always in sync. The in-game editor only modifies byte 19, so after
editing a team in-game, byte 18 may become stale. The tools now read
from byte 19 and write both bytes to keep them consistent.


## Flag (byte 21, bit 0) = Unused

### Evidence 1: Skill extraction masks it away

The match setup code at `$01F982` reads the word at attribute offset
`$14` (bytes 20–21) and extracts the skill value:

```
$01F982  MOVE.W  $14(A0),D0          ; read bytes 20-21 as a word
         ANDI.W  #$0038,D0           ; mask to keep only bits 3-5
         LSR.W   #3,D0               ; shift right 3 → skill value 0-7
         ; bit 0 (flag) is explicitly zeroed by the AND mask
```

The `#$0038` mask (binary `0000 0000 0011 1000`) keeps only bits 3–5,
completely discarding bit 0.

### Evidence 2: No other code reads it

A search of the entire code area (0x000000–0x030000) for instructions
that access offset `$15` (byte 21) from team data pointers found no
references other than:
- League table structures (different data format, not team blocks)
- Loop counters using the literal value 21

### Evidence 3: No bit 0 extraction found

A search for `ANDI #1` patterns near team attribute reads found no code
that isolates bit 0 of byte 21.

### Data pattern

In the ROM data, flag=0 appears on exactly the British/Irish teams:
- National: England, Scotland, Wales, Northern Ireland
- Club: all 10 UK/Irish club teams

This pattern exists only in the static data. No game logic distinguishes
these teams based on this bit. It may be vestigial metadata from the
SWOS development process, or a reserved field for a feature that was
never implemented.


## Key ROM Addresses

| Address     | Description                                    |
|-------------|------------------------------------------------|
| `$016034`   | Formation lookup table (8 longword pointers)   |
| `$01957E`   | Team decode routine (International)            |
| `$019630`   | Attribute offset lookup (19 entries)            |
| `$019658`   | Character extraction routine                   |
| `$0196A4`   | Charset table                                  |
| `$01C7FC`   | Team editor formation picker UI loop           |
| `$01C960`   | Team editor — reads/writes byte 19             |
| `$01CE12`   | Formation slot→role lookup using byte 19       |
| `$01F968`   | Match setup — copies byte 19 to runtime RAM    |
| `$01F982`   | Match setup — extracts skill, masks away flag  |
| `$FF0318`   | Runtime RAM: team A formation                  |
| `$FF031A`   | Runtime RAM: team B formation                  |
| `$FFEBE6`   | RAM: team attribute backup during decode       |

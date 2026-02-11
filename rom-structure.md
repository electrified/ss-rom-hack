# Sensible Soccer (Mega Drive) - ROM Structure

## Team Regions Overview

Both ROM editions store teams in **3 contiguous regions** separated by 2-byte
zero gaps:

```
[national teams] [00 00] [club teams] [00 00] [custom teams]
```

| Edition       | National | Club | Custom | Total |
|---------------|----------|------|--------|-------|
| International | 51       | 64   | 64     | 179   |
| Original/Euro | 40       | 64   | 64     | 168   |

Each region contains variable-size team blocks packed end-to-end with no
internal gaps. The game chain-walks blocks using the 2-byte size word at the
start of each block, and stops at the region end pointer.


## Region Pointer Table

A table of **6 consecutive big-endian longwords** in the ROM code area stores
the start and end addresses for all 3 regions:

```
+0:   national_start
+4:   club_start
+8:   custom_start
+12:  national_end
+16:  club_end
+20:  custom_end
```

| Edition       | Table base | Region span                          |
|---------------|------------|--------------------------------------|
| International | `0x01EF22` | `0x020576` – `0x02D5C6` (53,328 B)  |
| Original/Euro | `0x01EA42` | `0x01FEAC` – `0x02C146` (49,818 B)  |

The end pointer of one region + 2 equals the start pointer of the next
(`club_start = national_end + 2`, etc.). There are only ~2 bytes free after
the custom region in the International edition.

### Finding the pointer table

`find_pointer_table()` in `decode_teams.py` locates the table automatically:

1. Use `auto_find_teams()` to find team text offsets in the ROM
2. For each candidate block start address, search the code area (0–0x30000)
   for it as a BE 32-bit value
3. Try interpreting the match as slot 0, 1, or 2 of the table
4. Validate the 6 pointers have correct ordering


## Known Offsets

| Edition | Decode routine | Charset table | Attr offset lookup |
|---------|---------------|---------------|-------------------|
| International | `0x019658` | `0x0196A4` | `0x019630` (19 entries) |
| Original | `0x0193AE` | `0x01941A` | — |

The Original Edition uses city names instead of club names and misspelled
player names (licensing workaround).


## Block Layout

Each team block is laid out as **[attributes][text][pad]**:

```
Team block N:
┌──────────────────────────────────┐
│ Attribute data (150 bytes)       │  fixed size
│  - Bytes 0-1: block size word   │
│  - Team header (22 bytes)       │
│  - Player records (128 bytes)   │
├──────────────────────────────────┤
│ 5-bit packed text                │  variable length
│ (19 null-terminated strings)     │
├──────────────────────────────────┤
│ 0x00 alignment pad (if needed)   │  0 or 1 byte
└──────────────────────────────────┘
Team block N+1:
┌──────────────────────────────────┐
│ ...                              │
```

Each block's total size (attrs + text + pad) is always **even**, ensuring
the next block starts at a word-aligned address. The pad byte is added when
the text section has an odd number of bytes.

### Block Size Word (bytes 0–1)

The first 2 bytes of the attribute block hold a 16-bit big-endian size word
equal to the **total block size** (150 + text bytes + pad). The game uses
this to chain-walk through blocks within a region. Valid sizes range from
~160 (short names) to ~500 (maximum names).


## 5-Bit Text Encoding

Team/player/coach names are encoded as an MSB-first bitstream, 5 bits per
character:

```
Index  Char        Index  Char
-----  ----        -----  ----
 0     NUL (end)    16    P
 1     A            17    Q
 2     B            18    R
 3     C            19    S
 4     D            20    T
 5     E            21    U
 6     F            22    V
 7     G            23    W
 8     H            24    X
 9     I            25    Y
10     J            26    Z
11     K            27    (space)
12     L            28    -
13     M            29    '
14     N            30    .
15     O
```

Each team block contains 19 null-terminated strings packed end-to-end:

1. Team name
2. Country name
3. Coach name
4. 16 player names

The final string's null terminator is followed by zero-bit padding to
complete the last byte.


## Packed Text Positions

The game does **not** decode strings sequentially. Instead, the attribute
block contains pre-computed packed positions that let the game jump directly
to any of the 19 strings within the text section.

### Position format

Each position is a 16-bit big-endian word: `(byte_offset << 5) | bit_offset`

- `byte_offset` is relative to the start of the team block (byte 0 = first
  attribute byte). Since text starts at byte 150, all positions have
  `byte_offset >= 150`.
- `bit_offset` is 0–31, representing the bit position within a 32-bit read
  at the (word-aligned) byte offset.
- String 0 (team name) always has position `0x12C0` = `(150 << 5) | 0`.

### Attribute offsets for positions

The game uses a lookup table at ROM `0x019630` (International Edition) with
19 entries specifying which attribute byte offsets hold the packed positions:

```
String   Attr offset   Description
------   -----------   -----------
  0          2         Team name
  1          4         Country
  2          6         Coach
  3         22         Player 1
  4         30         Player 2
  5         38         Player 3
  6         46         Player 4
  7         54         Player 5
  8         62         Player 6
  9         70         Player 7
 10         78         Player 8
 11         86         Player 9
 12         94         Player 10
 13        102         Player 11
 14        110         Player 12
 15        118         Player 13
 16        126         Player 14
 17        134         Player 15
 18        142         Player 16
```

Note: these offsets overlap with the player record area (bytes 22–149).
Bytes 22–23 of the attribute block serve double duty: in ROM they hold
player 1's index/stat, but at load time the game overwrites them with
the packed position for player 1's name. The game reads the ROM value first
(to locate the string), decodes the string, then writes the decoded buffer
position back to the attribute copy in RAM.

### Decode algorithm (from 68000 disassembly at 0x01957E)

1. Copy 150 bytes of attributes from RAM buffer to backup at `$FFEBE6`
2. Set output pointer A1 to backup + 150 (decoded text area)
3. For each of 19 strings:
   a. Compute packed position = `((A1 - backup_start) << 5) | D2`
   b. Write packed position to backup at the lookup table offset
   c. Read original packed value from the unmodified RAM buffer
   d. Decode byte_offset and bit_offset from the packed value
   e. Read 32-bit value from RAM buffer at word-aligned byte_offset
   f. ROL to align, then extract 5-bit characters until null
   g. Write decoded characters to output buffer (packed into 16-bit words)
4. Store total decoded size at backup[0]
5. Copy backup (with positions + decoded text) back to RAM buffer


## Attribute Data Layout (150 bytes)

```
Offset  Length  Description
------  ------  -----------
  0       2     Block size word (total block size in bytes)
  2       2     Packed position: team name (always 0x12C0)
  4       2     Packed position: country
  6       2     Packed position: coach
  8      10     Kit attributes (2 x 5 bytes, see below)
 18       4     Team attributes (tactic, skill, flag — see below)
 22     128     Player records (16 x 8 bytes, see below)
------  ------
 Total  150
```


### Team Header (bytes 0–7)

```
Bytes 0-1:   Block size word (total block size)
Bytes 2-3:   Packed position for team name (0x12C0)
Bytes 4-5:   Packed position for country
Bytes 6-7:   Packed position for coach
```


### Kit Attributes (bytes 8–17)

Each team has two kits (first and second), 5 bytes each:

```
Offset  Field            Values
------  -----            ------
  8     First kit style   0-3 (see style table)
  9     First shirt 1     Colour index (primary colour)
 10     First shirt 2     Colour index (secondary colour, same as shirt 1 for plain)
 11     First shorts      Colour index
 12     First socks       Colour index
 13     Second kit style  0-3
 14     Second shirt 1    Colour index
 15     Second shirt 2    Colour index
 16     Second shorts     Colour index
 17     Second socks      Colour index
```

**Kit style values:**

| Value | Style      | Description                          |
|-------|------------|--------------------------------------|
| 0     | Plain      | Single colour shirt                  |
| 1     | Sleeves    | Different colour sleeves             |
| 2     | Vertical   | Vertical stripes (shirt1 + shirt2)   |
| 3     | Horizontal | Horizontal stripes (shirt1 + shirt2) |

**Colour palette indices:**

| Value | Colour      | Value | Colour      |
|-------|-------------|-------|-------------|
| 0x01  | Grey        | 0x09  | Dark grey 2 |
| 0x02  | White       | 0x0A  | Red         |
| 0x03  | Black       | 0x0B  | Blue        |
| 0x04  | Brown       | 0x0C  | Dark red    |
| 0x05  | Dark orange | 0x0D  | Light blue  |
| 0x06  | Orange      | 0x0E  | Green       |
| 0x07  | Light grey  | 0x0F  | Yellow      |
| 0x08  | Dark grey   |       |             |

Example (Lazio): `00 0D 0D 02 02  00 0F 0F 0F 0F`
→ First kit: plain, light blue shirt, white shorts & socks.
→ Second kit: plain, yellow all over.


### Team Attributes (bytes 18–21)

Team-level gameplay attributes:

```
Offset  Field     Values
------  -----     ------
 18     Tactic    0-7 (formation, see table — initial/default value)
 19     Tactic    0-7 (formation — gameplay-active value, see below)
 20     (unused)  Always 0x00
 21     Composite Bits 3-5: skill (0=best, 7=weakest)
                  Bit 0: flag (unused by game engine, see below)
                  Bits 1-2, 6-7: always 0
```

**Bytes 18 and 19 — two tactic bytes:**

Both bytes store a formation value. Byte 19 is the one the game engine
actually reads at match time (code at `$01F968` copies it to runtime RAM).
The in-game team editor (`$01C960`) also reads/writes byte 19. For all
national and club teams in the original ROM, bytes 18 and 19 are identical.
Custom teams have byte 18=0 but byte 19 varies (including two extra
formations not available for national/club teams). The tools read from
byte 19 and write both bytes to keep them in sync.

**Tactic/formation values:**

| Value | Formation |
|-------|-----------|
| 0     | 4-4-2     |
| 1     | 5-4-1     |
| 2     | 4-5-1     |
| 3     | 5-3-2     |
| 4     | 3-5-2     |
| 5     | 4-3-3     |
| 6     | 3-3-4     |
| 7     | 6-3-1     |

Values 6–7 are only used by custom teams in the original ROM. The formation
lookup table at `$016034` contains 8 entries, each pointing to an 11-slot
sub-table mapping formation slots to roles (GK/DEF/MID/FWD).

**Skill** correlates with real-world team quality. Brazil, Germany etc. have
skill=0; Malta, Luxembourg etc. have skill=7.

**Flag (bit 0 of byte 21):** This bit is never read by the game engine.
The match setup code at `$01F982` explicitly masks it away with
`andi.w #$38` when extracting the skill value. In the ROM data, flag=0
marks British/Irish teams, but no game logic acts on this. It may be
vestigial metadata from development. See `division-research.md` for the
full disassembly analysis.


### Player Records (bytes 22–149)

16 players × 8 bytes each = 128 bytes.

```
Byte  Meaning
----  -------
 0-1  Packed text position (rewritten at load time — do not use for player data)
  2   Position byte
  3   Appearance byte
 4-7  Unused (always 0x00)
```

#### Position byte (byte 2)

Encodes the formation slot and shirt number in a single byte:

```
  High nibble (bits 7-4): formation slot
  Low nibble  (bits 3-0): shirt number minus 1
```

**Formation slot values:**

| Value | Name             | Meaning                             |
|-------|------------------|-------------------------------------|
| 0     | goalkeeper       | Goalkeeper                          |
| 1     | right_back       | Right back                          |
| 2     | left_back        | Left back                           |
| 3     | centre_back      | Centre back                         |
| 4     | defender         | Defender (4th slot, formation-dependent) |
| 5     | right_midfield   | Right midfield                      |
| 6     | centre_midfield  | Centre midfield                     |
| 7     | left_midfield    | Left midfield                       |
| 8     | midfielder       | Midfielder (4th slot, formation-dependent) |
| 9     | forward          | Forward                             |
| 10    | second_forward   | Second forward                      |
| 15 (F)| sub              | Substitute (not on pitch)           |

**Shirt number** is the low nibble + 1, giving values 1–16.

Examples:
- `0x00` = GK, shirt #1
- `0xFB` = substitute, shirt #12
- `0x79` = midfielder slot 7, shirt #10
- `0xA8` = forward slot 10, shirt #9

#### Appearance byte (byte 3)

```
  Bits 0-1: head type (0-2, see table)
  Bits 2-3: role (0=goalkeeper, 1=defender, 2=midfielder, 3=forward)
  Bit  4:   star player flag (0=normal, 1=star)
  Bits 5-7: unused (always 0)
```

**Role** determines the letter shown in the game's squad screen
(G / D / M / F). For starting players this matches the formation
slot; for substitutes (formation slot = F) it indicates what role
the sub plays.

**Head type** controls the player sprite appearance. The game renders
3 visual combinations:

| Value | Name         | Appearance              |
|-------|--------------|-------------------------|
| 0     | white_dark   | Light skin, dark hair   |
| 1     | white_blonde | Light skin, blonde hair |
| 2     | black_dark   | Dark skin, dark hair    |

**Star player** flag is set for approximately 12% of players across
all teams and head types. It is independent of the head type value.

Example (Partizani Tirana, block size 0x0148 = 328 bytes):
```
01 48 12 c0 14 05 14 8d 00 0c 0c 02 0c 00 02 02 02 02  04 04 00 21
│     │     │     │     │                 │              │  │  │  └─ byte 21: skill=4 (bits 3-5=100), flag=1 (bit 0)
│     │     │     │     │                 │              │  │  └──── byte 20: unused (0x00)
│     │     │     │     │                 │              │  └─────── byte 19: tactic=4 (3-5-2, gameplay-active)
│     │     │     │     │                 │              └────────── byte 18: tactic=4 (3-5-2, initial/default)
│     │     │     │     │                 └───────────────────────── bytes 13-17: second kit
│     │     │     │     └─────────────────────────────────────────── bytes 8-12: first kit
│     │     │     └───────────────────────────────────────────────── bytes 6-7: coach position
│     │     └─────────────────────────────────────────────────────── bytes 4-5: country position
│     └───────────────────────────────────────────────────────────── bytes 2-3: team name (0x12C0)
└─────────────────────────────────────────────────────────────────── bytes 0-1: block size (0x0148 = 328)
```

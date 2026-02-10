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

Team/player/manager names are encoded as an MSB-first bitstream, 5 bits per
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
2. Country name (empty for national teams)
3. Manager name
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
  2          6         Manager
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
  6       2     Packed position: manager
  8      14     Kit attributes (see below)
 22     128     Player records (16 x 8 bytes, see below)
------  ------
 Total  150
```


### Team Header (bytes 0–7)

```
Bytes 0-1:   Block size word (total block size)
Bytes 2-3:   Packed position for team name (0x12C0)
Bytes 4-5:   Packed position for country
Bytes 6-7:   Packed position for manager
```


### Kit Attributes (bytes 8–21)

Each team has two kits (first and second) plus 4 extra bytes:

```
Offset  Field            Values
------  -----            ------
  8     First kit style   0-3 (see style table)
  9     First shirt 1     0-15 (primary colour, see colour table)
 10     First shirt 2     0-15 (secondary colour, same as shirt 1 for plain)
 11     First shorts      0-15
 12     First socks       0-15
 13     Second kit style  0-3
 14     Second shirt 1    0-15
 15     Second shirt 2    0-15
 16     Second shorts     0-15
 17     Second socks      0-15
 18-19  Unknown           Often paired (e.g. 03 03, 04 04), possibly GK kit
 20     Unknown           Always 0x00
 21     Unknown           Varies (formation/tactic code?)
```

**Kit style values:**

| Value | Style             |
|-------|-------------------|
| 0     | Plain             |
| 1     | Hoops / stripes   |
| 2     | Vertical stripes  |
| 3     | Halves            |

**Colour palette indices:**

| Value | Colour     | Value | Colour     |
|-------|------------|-------|------------|
| 0x00  | (varies)   | 0x08  | (varies)   |
| 0x02  | White      | 0x0A  | Red        |
| 0x03  | Black      | 0x0B  | Blue       |
| 0x04  | (varies)   | 0x0C  | Dark red   |
| 0x06  | Orange     | 0x0D  | Light blue |
| 0x07  | (varies)   | 0x0E  | Green      |
|       |            | 0x0F  | Yellow     |

Example (Lazio): `00 0D 0D 02 02  00 0F 0F 0F 0F  00 00 00 09`
→ First kit: plain, light blue shirt, white shorts & socks.
→ Second kit: plain, yellow all over.


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

| Value | Meaning                                  |
|-------|------------------------------------------|
| 0     | Goalkeeper                               |
| 1–4   | Defender (slot 1=leftmost … 4=rightmost) |
| 5–8   | Midfielder (slot 5=leftmost … 8=rightmost) |
| 9–10  | Forward (slot 9=left, 10=right)          |
| 15 (F)| Substitute (not on pitch)                |

**Shirt number** is the low nibble + 1, giving values 1–16.

Examples:
- `0x00` = GK, shirt #1
- `0xFB` = substitute, shirt #12
- `0x79` = midfielder slot 7, shirt #10
- `0xA8` = forward slot 10, shirt #9

#### Appearance byte (byte 3)

```
  Bits 0-1: skin colour (0=light, 1=medium, 2=dark)
  Bits 2-3: position type (0=GK, 1=DEF, 2=MID, 3=FWD)
  Bit  4:   hair colour (0=dark, 1=light)
  Bits 5-7: unused (always 0)
```

**Position type** determines the letter shown in the game's squad
screen (G / D / M / F). For starting players this matches the
formation slot; for substitutes (formation slot = F) it indicates
what role the sub plays.

**Skin and hair** control the player sprite appearance. The game only
renders **3 visual combinations**:

| Skin  | Hair  | Appearance              |
|-------|-------|-------------------------|
| 0 / 1 | 0    | Light skin, dark hair   |
| 0 / 1 | 1    | Light skin, light hair  |
| 2     | 0 / 1 | Dark skin, dark hair   |

Skin values 0 (light) and 1 (medium) look identical on screen.
Dark-skinned players always appear with dark hair regardless of
the hair bit.

Example (Partizani Tirana, block size 0x0148 = 328 bytes):
```
01 48 12 c0 14 05 14 8d 00 0c 0c 02 0c 00 02 02 02 02 04 04 00 21
```

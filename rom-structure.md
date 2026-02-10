# Sensible Soccer (Mega Drive) - ROM Structure

## Team Data Region

Both ROM editions store 64 teams as contiguous variable-size blocks in a
single region. Each block contains a 150-byte attribute blob (kit colours,
formation, player stats, and packed text positions) followed by 5-bit packed
text.

### Known Offsets

| Edition | Decode routine | Charset table | Team data region (incl. attrs) |
|---------|---------------|---------------|--------------------------------|
| International | `0x019658` | `0x0196A4` | `0x024346` – `0x029262` (20,252 bytes) |
| Original | `0x0193AE` | `0x01941A` | `0x022F3E` – `0x027DE2` (20,132 bytes) |

The Original Edition uses city names instead of club names and misspelled
player names (licensing workaround).


## Block Layout

Each team block is laid out as **[attributes][text][pad]**:

```
Team block N:
┌──────────────────────────────────┐
│ Attribute data (150 bytes)       │  fixed size
│  - Team header (22 bytes)        │
│  - Player records (128 bytes)    │
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

All 64 blocks are packed contiguously with no gaps.


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
2. Country name
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
  0       1     Always 0x01 (marker byte)
  1       1     Kit/stat data (shared with packed position high byte)
  2       2     Packed position: team name (always 0x12C0)
  4       2     Packed position: country
  6       2     Packed position: manager
  8      14     Formation and tactics
 22     128     Player records (16 x 8 bytes)
------  ------
 Total  150
```

Player records at offsets 22–149 (16 x 8 bytes) contain packed text
positions at their first 2 bytes (offsets 22, 30, 38, ..., 142) which
get overwritten at load time.

### Player Records (bytes 22–149)

16 players x 8 bytes each = 128 bytes.

```
Byte  Meaning
----  -------
 0-1  Packed text position (overwritten at load time)
  2   Stat byte 1
  3   Stat byte 2
 4-7  Additional data (often 0x00)
```

Note: The player index/ID that was previously thought to be at byte 0 of
each record is actually the high byte of the packed text position. The
game reads it before overwriting.

### Team Header (bytes 0–21)

```
Byte  0:     0x01 marker
Byte  1:     Kit/stat byte
Bytes 2-3:   Packed position for team name (0x12C0)
Bytes 4-5:   Packed position for country
Bytes 6-7:   Packed position for manager
Bytes 8-21:  Formation/tactics data
```

Example (Partizani Tirana):
```
01 48 12 c0 14 05 14 8d 00 0c 0c 02 0c 00 02 02 02 02 04 04 00 21
```

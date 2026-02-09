# Sensible Soccer (Mega Drive) - ROM Structure

## Team Data Region

Both ROM editions store 64 teams as contiguous variable-size blocks in a
single region. Each block contains 5-bit packed text followed by a 150-byte
attribute blob (kit colours, formation, player stats).

### Known Offsets

| Edition | Decode routine | Charset table | Team data region |
|---------|---------------|---------------|------------------|
| International | `0x019658` | `0x0196A4` | `0x0243DC` – `0x029260` (20,252 bytes) |
| Original | `0x0193AE` | `0x01941A` | `0x022FD4` – `0x027E60` (20,132 bytes) |

The Original Edition uses city names instead of club names and misspelled
player names (licensing workaround).


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


## Word-Alignment Padding

The Mega Drive (68000 CPU) requires word-aligned (even address) reads for
16-bit and 32-bit values. The game reads attribute data using word-sized
operations, so attributes must start at an even ROM address.

When the text section ends on an **odd** byte address, a single `0x00`
padding byte is inserted before the attributes. When it ends on an **even**
address, no padding is needed.

```
Example (text ends odd):
  Text bytes:  0x0243DC ... 0x02447A  (text_end = 0x02447B, odd)
  Pad byte:    0x02447B = 0x00
  Attributes:  0x02447C ... 0x024511  (150 bytes, even start)

Example (text ends even):
  Text bytes:  0x024512 ... 0x0245C3  (text_end = 0x0245C4, even)
  Attributes:  0x0245C4 ... 0x024659  (150 bytes, already aligned)
```

This is why naively treating "text_end to next_team_start" as the attribute
blob produces blocks of 150 or 151 bytes — the extra byte is alignment
padding, not attribute data. The canonical attribute size is always **150
bytes**.


## Attribute Data Layout (150 bytes)

```
Offset  Length  Description
------  ------  -----------
  0       1     Always 0x01 (marker byte)
  1       7     Kit colours (3 kits × ~2-3 bytes each)
  8      14     Formation and tactics
 22     128     Player records (16 × 8 bytes)
------  ------
 Total  150
```

### Team Header (bytes 0–21)

```
Byte  0:     0x01 marker
Bytes 1-7:   Kit colour definitions (home, away, goalkeeper)
Bytes 8-21:  Formation/tactics data
```

Example (Partizani Tirana):
```
01 48 12 c0 13 cb 14 83 00 0c 0c 02 0c 00 02 02 02 02 04 04 00 21
```

### Player Records (bytes 22–149)

16 players × 8 bytes each = 128 bytes.

```
Byte  Meaning
----  -------
  0   Player index/ID
  1   Stat byte 1 (skill/quality)
  2   Stat byte 2
  3   Stat byte 3
 4-7  Additional data (often 0x00)
```

Example (Partizani Tirana, first 4 players):
```
15 8e 00 00 00 00 00 00   # ELTON KASHI
16 ce fb 00 00 00 00 00   # ARJAN PISHA
17 cf 11 04 00 00 00 00   # SOKOL KUSHTA
19 00 42 04 00 00 00 00   # AGUSTIN KOLA
```

Player stat bytes are not yet fully decoded. The index byte (byte 0) may
reference a global player database or sprite/position table.


## Block Layout Diagram

```
Team block N:
┌──────────────────────────────────┐
│ 5-bit packed text                │  variable length
│ (19 null-terminated strings)     │
├──────────────────────────────────┤
│ 0x00 alignment pad (if needed)   │  0 or 1 byte
├──────────────────────────────────┤
│ Team header (22 bytes)           │
│ Player records (128 bytes)       │  150 bytes total
└──────────────────────────────────┘
Team block N+1:
┌──────────────────────────────────┐
│ ...                              │
```

All 64 blocks are packed contiguously with no gaps (other than the
word-alignment padding within each block).

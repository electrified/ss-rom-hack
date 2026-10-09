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

`findPointerTable()` in `frontend/src/lib/sslib/decode.ts`
checks the known table locations first, then scans aligned candidate tables in
the code area. Every candidate must have ordered, in-bounds, word-aligned region
pointers, two-byte region gaps, valid block chains, and bounded packed strings.
Editable country, team, coach, and player names do not identify the edition.


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

| Index | Char | Index | Char |
|-------|------|-------|------|
| 0 | NUL (end) | 16 | P |
| 1 | A | 17 | Q |
| 2 | B | 18 | R |
| 3 | C | 19 | S |
| 4 | D | 20 | T |
| 5 | E | 21 | U |
| 6 | F | 22 | V |
| 7 | G | 23 | W |
| 8 | H | 24 | X |
| 9 | I | 25 | Y |
| 10 | J | 26 | Z |
| 11 | K | 27 | (space) |
| 12 | L | 28 | - |
| 13 | M | 29 | ' |
| 14 | N | 30 | . |
| 15 | O | | |

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

| String | Attr offset | Description |
|--------|-------------|-------------|
| 0 | 2 | Team name |
| 1 | 4 | Country |
| 2 | 6 | Coach |
| 3 | 22 | Player 1 |
| 4 | 30 | Player 2 |
| 5 | 38 | Player 3 |
| 6 | 46 | Player 4 |
| 7 | 54 | Player 5 |
| 8 | 62 | Player 6 |
| 9 | 70 | Player 7 |
| 10 | 78 | Player 8 |
| 11 | 86 | Player 9 |
| 12 | 94 | Player 10 |
| 13 | 102 | Player 11 |
| 14 | 110 | Player 12 |
| 15 | 118 | Player 13 |
| 16 | 126 | Player 14 |
| 17 | 134 | Player 15 |
| 18 | 142 | Player 16 |

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

| Offset | Length | Description |
|--------|--------|-------------|
| 0 | 2 | Block size word (total block size in bytes) |
| 2 | 2 | Packed position: team name (always 0x12C0) |
| 4 | 2 | Packed position: country |
| 6 | 2 | Packed position: coach |
| 8 | 10 | Kit attributes (2 x 5 bytes, see below) |
| 18 | 4 | Team attributes (formation, skill, flag — see below) |
| 22 | 128 | Player records (16 x 8 bytes, see below) |
| Total | 150 | |


### Team Header (bytes 0–7)

| Bytes | Field | Description |
|-------|-------|-------------|
| 0-1 | Block size word | Total block size |
| 2-3 | Packed position | Team name (always 0x12C0) |
| 4-5 | Packed position | Country |
| 6-7 | Packed position | Coach |


### Kit Attributes (bytes 8–17)

Each team has two kits (first and second), 5 bytes each:

| Offset | Field | Values |
|--------|-------|--------|
| 8 | First kit style | 0-3 (see style table) |
| 9 | First shirt 1 | Colour index (primary colour) |
| 10 | First shirt 2 | Colour index (secondary colour, same as shirt 1 for plain) |
| 11 | First shorts | Colour index |
| 12 | First socks | Colour index |
| 13 | Second kit style | 0-3 |
| 14 | Second shirt 1 | Colour index |
| 15 | Second shirt 2 | Colour index |
| 16 | Second shorts | Colour index |
| 17 | Second socks | Colour index |

**Kit style values:**

| Value | Style      | Description                          |
|-------|------------|--------------------------------------|
| 0     | Plain      | Single colour shirt                  |
| 1     | Sleeves    | Different colour sleeves             |
| 2     | Vertical   | Vertical stripes (shirt1 + shirt2)   |
| 3     | Horizontal | Horizontal stripes (shirt1 + shirt2) |

**Supported kit colour indices:**

| Value | Colour | Value | Colour |
|-------|--------|-------|--------|
| 0x01 | Grey | 0x0B | Blue |
| 0x02 | White | 0x0C | Dark red |
| 0x03 | Black | 0x0D | Light blue |
| 0x06 | Orange | 0x0E | Green |
| 0x0A | Red | 0x0F | Yellow |

The International ROM's ten-entry kit-colour lookup table is at `0x01FAFA`;
the Original ROM has the same table at `0x01F430`. All stock team kit colour
fields use these ten values. Values `0x04`, `0x05`, and `0x07`–`0x09` are not
supported kit colour choices.

Example (Lazio): `00 0D 0D 02 02  00 0F 0F 0F 0F`
→ First kit: plain, light blue shirt, white shorts & socks.
→ Second kit: plain, yellow all over.


### Team Attributes (bytes 18–21)

Team-level gameplay attributes:

| Offset | Field | Values |
|--------|-------|--------|
| 18 | Formation | 0-7 (formation, see table — initial/default value) |
| 19 | Formation | 0-7 (formation — gameplay-active value, see below) |
| 20 | (unused) | Always 0x00 |
| 21 | Composite | Bits 3-5: skill (0=best, 7=weakest)<br>Bit 0: flag (unused by game engine, see below)<br>Bits 1-2, 6-7: always 0 |

**Bytes 18 and 19 — two formation bytes:**

Both bytes store a formation value. Byte 19 is the one the game engine
actually reads at match time (code at `$01F968` copies it to runtime RAM).
The in-game team editor (`$01C960`) also reads/writes byte 19. For all
national and club teams in the original ROM, bytes 18 and 19 are identical.
Custom teams have byte 18=0 but byte 19 varies (including two extra
formations not available for national/club teams). The tools read from
byte 19. Changing the formation updates both bytes; unchanged formations preserve
their original byte 18 values.

**Formation values:**

| Value | Formation |
|-------|-----------|
| 0     | 4-4-2     |
| 1     | 5-4-1     |
| 2     | 4-5-1     |
| 3     | 5-3-2     |
| 4     | 3-5-2     |
| 5     | 4-3-3     |
| 6     | Attack     |
| 7     | Defend     |

Values 6–7 are only used by custom teams in the original ROM. The formation
lookup table is at `$016034` in International and `$01603C` in Original/European.
It contains eight 32-bit pointers, each pointing to eleven big-endian 16-bit
role words (0=GK, 1=DEF, 2=MID, 3=FWD). Both ROMs have identical role mappings:

| Formation | Roles for slots 0–10 |
| --- | --- |
| 4-4-2 | 0 1 1 1 1 2 2 2 2 3 3 |
| 5-4-1 | 0 1 1 1 1 2 1 2 2 2 3 |
| 4-5-1 | 0 1 1 1 1 2 2 2 2 2 3 |
| 5-3-2 | 0 1 1 1 1 2 1 2 2 3 3 |
| 3-5-2 | 0 1 1 2 1 2 2 2 2 3 3 |
| 4-3-3 | 0 1 1 1 1 2 2 3 2 3 3 |
| Attack | 0 1 1 2 1 2 3 3 2 3 3 |
| Defend | 0 1 1 1 1 2 1 1 2 2 3 |

The library's `formation.ts` uses these tables for explicit editor assignments.
Slot names in JSON remain unchanged. The UI uses the familiar 4-4-2 labels where
the role is unchanged, and a role plus slot number where it differs (for example,
“Defender (slot 7)” rather than “Centre midfield” in 5-4-1).
Stored role mismatches remain valid and are preserved during loading, import,
validation and unrelated edits. Changing a position sets its expected role;
changing formation updates only starters that matched the old expected role.
Substitute roles and existing overrides are preserved on formation changes.

**Skill** correlates with real-world team quality. Brazil, Germany etc. have
skill=0; Malta, Luxembourg etc. have skill=7.

**Flag (bit 0 of byte 21):** This bit is never read by the game engine.
The match setup code at `$01F982` explicitly masks it away with
`andi.w #$38` when extracting the skill value. In the ROM data, flag=0
marks British/Irish teams, but no game logic acts on this. It may be
vestigial metadata from development. The underlying disassembly notes are not included in this repository.


### Player Records (bytes 22–149)

16 players × 8 bytes each = 128 bytes.

| Byte | Meaning |
|------|---------|
| 0-1 | Packed text position (rewritten at load time — do not use for player data) |
| 2 | Position byte |
| 3 | Appearance byte |
| 4-7 | Unused (always 0x00) |

#### Position byte (byte 2)

Encodes the formation slot and shirt number in a single byte:

| Bits | Field | Description |
|------|-------|-------------|
| 7-4 (high nibble) | Formation slot | See formation slot values below |
| 3-0 (low nibble) | Shirt number | Minus 1 (add 1 to get actual number) |

**Formation slot values:**

| Value | Name             | Meaning                             |
|-------|------------------|-------------------------------------|
| 0     | goalkeeper       | Goalkeeper                          |
| 1     | right_back       | Right back                          |
| 2     | left_back        | Left back                           |
| 3     | centre_back      | Centre back                         |
| 4     | defender         | Defender (4th slot, formation-dependent) |
| 5     | right_midfielder   | Right midfield                      |
| 6     | centre_midfielder  | Centre midfield                     |
| 7     | left_midfielder    | Left midfield                       |
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

| Bits | Field | Description |
|------|-------|-------------|
| 0-1 | Head type | 0-2 (see table below) |
| 2-3 | Role | 0=goalkeeper, 1=defender, 2=midfielder, 3=forward |
| 4 | Star player flag | 0=normal, 1=star |
| 5-7 | Unused | Always 0 |

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
│     │     │     │     │                 │              │  └─────── byte 19: formation=4 (3-5-2, gameplay-active)
│     │     │     │     │                 │              └────────── byte 18: formation=4 (3-5-2, initial/default)
│     │     │     │     │                 └───────────────────────── bytes 13-17: second kit
│     │     │     │     └─────────────────────────────────────────── bytes 8-12: first kit
│     │     │     └───────────────────────────────────────────────── bytes 6-7: coach position
│     │     └─────────────────────────────────────────────────────── bytes 4-5: country position
│     └───────────────────────────────────────────────────────────── bytes 2-3: team name (0x12C0)
└─────────────────────────────────────────────────────────────────── bytes 0-1: block size (0x0148 = 328)
```

## Competition Setup Records After Teams

The two zero bytes after the custom-team region separate team blocks from a
second data section. A nearby table of big-endian 32-bit pointers selects
competition setup templates. The table has gaps containing `0x00000001`, not
record pointers.

| Edition | Pointer table | Record bytes | 64-byte records | 152-byte records | Following text |
|---------|---------------|--------------|-----------------|------------------|----------------|
| International | `0x1EFF8` (21 slots) | `0x2D5C8`–`0x2DBD7` | 10 | 6 | `0x2DBD8` |
| Original | `0x1EB18` (20 slots) | `0x2C148`–`0x2C717` | 9 | 6 | `0x2C718` |

In the International code, the 64-byte path at `0x1C1F2`–`0x1C204` copies a
selected template to RAM at `$FF0BD4`; the 152-byte path at `0x1C2B4`–`0x1C2CC`
copies one to `$FF092C`. It then copies the initialized state into the active
competition buffer at `$FF0346`. The complete active states are larger: 832
bytes for the 64-byte path and 680 bytes for the 152-byte path. The ROM records
are starting snapshots, not complete saved competitions. The next bytes after
the records are interface strings, starting with `NATIONAL TEAMS`.

The short path is consistent with knockout cups. The long path includes leagues
and the International edition's World Championship, so it is better described
as a league/group competition state than as leagues only.

The beginning of both formats has a shared layout:

| Relative offset | Size | Finding |
|-----------------|------|---------|
| `+0x00` | 2 | Initial state/type word (`0x4000` or `0x8000` in stock templates). The loader replaces it with `0x8000` plus the selected mode ID. |
| `+0x02` | 2 | Initial progress/size value. It equals `+0x04` in most 64-byte presets and is two less in the 152-byte presets. Its exact role is not yet proven. |
| `+0x04` | 2 | Participant count. Values include 2, 4, 6, 8, 16, 20, 32, and 64. The game uses it to loop over and shuffle participant entries, and changes it as a competition advances. |
| `+0x06`–`+0x0D` | 8 | 64-bit eligible-team bitmap. Bit 0 refers to team slot 0, bit 1 to slot 1, etc. |
| `+0x0E`–`+0x15` | 8 | Second 64-bit bitmap assigning a different status to selected teams. It is zero in all stock presets; its exact status meaning is not yet proven. |
| `+0x16`, `+0x18` | 2 each | Team-slot IDs for the current match's two sides. |
| `+0x1A`, `+0x1C` | 2 each | Offsets from the active competition-state base to those sides' participant entries. |
| `+0x1E`, `+0x20` | 2 each | Current match scores, updated from the completed match. |
| `+0x22` | 2 | Match environment selector. Nonnegative values `0`–`11` select one of twelve seven-weight tables at `0x6254`; negative values use the generic table at `0x62A8` (except `-1`, which selects a fresh random result). The chosen 0–6 result is stored at `$FF5528`. The exact on-screen name of each result still needs verification. |
| `+0x24`–`+0x2B` | 8 | Format-dependent round/progress controls. In the short format `+0x24` low byte adjusts the match environment, `+0x26` selects a two-bit rule position, and `+0x2A` can encode the knockout size as `2 << value`. In the long format `+0x24` and `+0x28` count remaining/active fixtures and `+0x26` is added to a winner's points (normally 0 or 1). See format tables below. |

At `0x1BC94`–`0x1BCD2`, the game walks 64 team slots while shifting both
bitmaps. A set bit in the first mask marks a team as eligible; the corresponding
bit in the second mask chooses between two team-status flags. For example, the
International template at `0x2D860` has 20 set bits, matching its `+0x04`
value of 20. Applied to the stock club list, these bits select clubs including
Anderlecht, Manchester United, Ajax, AC Milan, Barcelona, and Real Madrid.
Other templates have a larger eligible pool than their initial field size, so
the mask is not always a final participant list.

Code at `0x1BF38`–`0x1BFAC` copies the six words at `+0x16`–`+0x20` to and from
match-state RAM. During match setup, `0x1D426`–`0x1D44C` uses `+0x1A` and
`+0x1C` as offsets into the active state and `+0x16` and `+0x18` as team IDs.
After a league match, `0x1E1D0`–`0x1E23A` uses the offsets to find the two
participant entries, applies the two scores, and updates matches played,
wins/draws/losses, goals for/against, and points in those entries.

Examples from the International ROM (mode IDs are pointer-table indices):

| Mode ID | Format | `+0x04` count | Set bits in eligible mask | Observation |
|---------|--------|---------------|---------------------------|-------------|
| 2 | Long | 20 | 20 | Selected stock clubs include several major European clubs. |
| 3 | Long | 4 | 8 | Initial field is smaller than the eligible pool. |
| 9 | Long | 6 in ROM, 24 after setup | 6 in ROM, replaced during setup | World Championship special case. |
| 11 | Short | 64 | 64 | Every slot is eligible. |
| 18 | Short | 2 | 16 | Two initial participants are drawn from a wider pool. |

The 64-byte loader sets `+0x00` to the selected mode ID with bit 15 set and
can adjust `+0x32` before creating the active cup state. At `0x1D166`–`0x1D174`,
the game can derive both size words as `2 << (+0x2A)`. The short header's
remaining bytes have these uses:

| Offset | Size | Use in short-format code |
|--------|------|--------------------------|
| `+0x24` | 2 | Low byte is added to the nonnegative environment selector before a cup match (`0x1D3D6`–`0x1D3E6`). High byte is set during initialization and appears to be a phase flag. |
| `+0x26` | 2 | Bit shift selecting a two-bit rule entry from `+0x2C`, `+0x2E`, and `+0x30` (`0x1D310`–`0x1D332`). |
| `+0x28` | 2 | Fixture/round counter updated while finding the next cup match (`0x1DA84`–`0x1DB20`). |
| `+0x2A` | 2 | Initial field-size exponent; also consulted in later round transitions. |
| `+0x2C`, `+0x2E`, `+0x30` | 2 each | Packed two-bit entries read at the shift in `+0x26`; they affect the match rules sent to `$FF0324`–`$FF0328`. The exact meaning of each two-bit value remains open. |
| `+0x32` | 2 | Tie-resolution setting tested when a two-leg aggregate score is equal (`0x1D51A`). |
| `+0x34`–`+0x3F` | 12 | Working cup state: pending/tie masks, fixture index, and leg/phase. Initialization at `0x1D21E`–`0x1D23C` resets these values, so the stock template values here are not retained for a newly started cup. |

The long format's 88 additional header bytes and the intervening words are
used differently:

| Offset | Size | Use in long-format code |
|--------|------|-------------------------|
| `+0x2C`–`+0x7B` | 80 | Twenty 32-bit pairing bitsets, indexed by participant slot. Bit `j` in slot `i` is set when the pair is scheduled; `0x1DF5C`–`0x1DFD8` checks and sets both directions. Initialization at `0x1DDEE`–`0x1DE00` seeds a one-bit value per slot. Mode 9 instead puts a pointer to its separate World Championship stage script at `+0x2C`, changing the interpretation of this range. |
| `+0x7C`–`+0x8F` | 20 | Temporary byte list of candidate/blocked participant slots used while generating the next fixture (`0x1DEF6`, `0x1DF64`–`0x1DF78`). |
| `+0x90`, `+0x92` | 2 each | Current participant index and selected opponent index. |
| `+0x94` | 2 | Scheduling flags; bits 0 and 1 are toggled in setup and fixture generation. |
| `+0x96` | 2 | Number of entries currently in the temporary list at `+0x7C`. |

Long-format initialization resets `+0x2A`, `+0x90`, and `+0x96`, rewrites the
pairing table (or script pointer), and changes `+0x94`. Thus some nonzero
bytes in the ROM template are overwritten before a fixture is played. These
bytes are competition state, not name strings.

The short format uses 12-byte participant entries. It starts its active
participant array at `+0x40`; code at `0x1DA4C` reads the count from `+0x04`
and shuffles that many 12-byte entries. Thus its 832-byte RAM state is exactly
a 64-byte header plus 64 participant slots. Its entry holds a team ID and
status, two result bytes, and a 16-bit tie/status field (the other entry bytes
are initialized by the participant-building path). The long format instead
uses 22-byte participant entries beginning at `+0x98`: `0x1DFDC` multiplies
each participant index by `0x16` before adding `0x98`. `0x1DD2A` uses the
selected-team mask or the World Championship's explicit list to populate
them. Each long entry begins with a team ID and status, and has played,
won, drawn, lost, goals-for, goals-against, and points fields at entry offsets
`+0x08`–`+0x15`. The 680-byte active state is exactly a 152-byte header plus
24 participant slots, accommodating the World Championship's 24 teams.

The International World Championship is long-format mode 9. Its setup path at
`0x1C300`–`0x1C334` replaces the template's initial six-team mask with a
24-team selection read from a separate byte list at `0x17BE7`, then sets both
size words to 24. That list maps to the 1994 tournament field: it starts with
USA, Switzerland, Colombia, Romania, Brazil, and Russia. On a later path,
mode 9 places a pointer to a separate stage script at `+0x2C` instead of building
the usual 20-entry one-hot table. The template alone therefore does not contain
the complete World Championship setup. The script begins at `0x17CB1` with
three bytes (`0x11 0x06 0x01`); the mode-9 path at `0x1DE7E` loads these into
state bytes `+0x30`, `+0x31`, and word `+0x32`. Later it reads three-byte
fixture commands and advances the script pointer by three (`0x1E314`). The
command bytes encode participant choices and progression, but their full
grammar has not been established.

The International ROM also references the 64-byte template at `0x2DA68`
directly from code at `0x17DA8`, outside the pointer table.

This is a storage map, not a complete semantics map yet. The remaining
unverified parts are the precise meaning of `+0x02`, the named conditions
represented by the seven environment results, the interpretation of each
two-bit knockout rule, several short-format phase/counter values, and the
World Championship stage-script encoding. An editor that exposes these fields
would need further tracing and gameplay tests before it could safely label or
change them.

## Writer invariants

Every public update validates and normalizes the complete JSON document before
writing. Supported editor text lengths are 25/19/25 characters for
team/country/coach and 25 for each player, with a maximum 500-byte block guard.
Decoders enforce ROM and block bounds, packed-position alignment, and actual
terminators. Position fields are read from the attributes, as the game does.

Available space extends from the national region start through the custom region
and consecutive zero words, stopping before the first nonzero word or aligned EOF.
The competition setup records that follow are outside the editor's available
team capacity and remain untouched when writing a ROM.

An unmatched final byte is not usable capacity. Validation and writing share the
same size calculation. The writer preserves reserved attribute bits, clears
leftover team bytes after shrinkage, updates all six team pointers, and recalculates
the big-endian word-sum checksum at `0x18E` over complete words from `0x200` onward.

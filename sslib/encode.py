"""Text encoding: 5-bit string packing and packed position computation."""

from .constants import CHARSET, ATTR_SIZE


def encode_5bit_string(text):
    """Encode a string as a 5-bit packed bitstream (with null terminator).
    Returns list of 5-bit values including the trailing 0."""
    values = []
    for c in text.upper():
        idx = CHARSET.index(c)
        values.append(idx)
    values.append(0)  # null terminator
    return values


def pack_5bit_values(values):
    """Pack a list of 5-bit values into bytes.
    Returns (bytes, total_bits)."""
    bitstream = 0
    nbits = 0
    result = []
    for val in values:
        bitstream = (bitstream << 5) | (val & 0x1F)
        nbits += 5
        while nbits >= 8:
            nbits -= 8
            result.append((bitstream >> nbits) & 0xFF)
    total_bits = len(values) * 5
    if nbits > 0:
        result.append((bitstream << (8 - nbits)) & 0xFF)
    return bytes(result), total_bits


def encode_team_text(team):
    """Encode all 19 strings (team + country + coach + 16 players) into packed bytes."""
    all_values = []
    names = [team['team'], team['country'], team['coach']]
    names += [p['name'] for p in team['players']]
    for s in names:
        all_values.extend(encode_5bit_string(s))
    packed, _total_bits = pack_5bit_values(all_values)
    return packed


def compute_packed_positions(text_bytes):
    """Compute the 19 packed text position values by simulating the game's decode loop.

    The packed position format is: (byte_offset << 5) | bit_offset

    Returns list of 19 packed position values (16-bit words).
    """
    block = bytes(ATTR_SIZE) + text_bytes

    d3 = ATTR_SIZE  # byte offset starts at 150 (text start)
    d4 = 0          # bit offset

    positions = []

    for _ in range(19):
        positions.append((d3 << 5) | d4)

        while True:
            addr = d3
            if addr + 4 <= len(block):
                d5 = (block[addr] << 24) | (block[addr+1] << 16) | (block[addr+2] << 8) | block[addr+3]
            else:
                chunk = (block[addr:] + bytes(4))[:4]
                d5 = (chunk[0] << 24) | (chunk[1] << 16) | (chunk[2] << 8) | chunk[3]

            if d4 > 0:
                d5 = ((d5 << d4) | (d5 >> (32 - d4))) & 0xFFFFFFFF

            while True:
                d4 += 5
                d5 = ((d5 << 5) | (d5 >> 27)) & 0xFFFFFFFF
                char_val = d5 & 0x1F

                if char_val == 0:  # null terminator
                    if d4 >= 16:
                        d4 -= 16
                        d3 += 2
                    break

                if d4 >= 16:
                    d4 -= 16
                    d3 += 2
                    break  # reload 32-bit value

            if char_val == 0:
                break  # string done

    return positions

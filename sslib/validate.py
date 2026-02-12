"""JSON validation for team data."""

from .constants import (
    CHARSET, CATEGORIES,
    COLOUR_VALUES, STYLE_VALUES, HEAD_VALUES, ROLE_VALUES,
    POSITION_VALUES, POSITION_NAMES, TACTIC_VALUES,
)
from .decode import find_pointer_table, chain_walk_region


def validate_string(text, context):
    """Check all characters are in CHARSET. Returns list of bad chars or empty list."""
    bad = []
    for c in text.upper():
        if c not in CHARSET:
            bad.append(c)
    return bad


def _check_enum(val, allowed, max_int, context):
    """Validate val is a known string or int in 0..max_int. Returns error or None."""
    if isinstance(val, str):
        if val not in allowed:
            return f"{context} must be one of {sorted(allowed)}, got '{val}'"
    elif not (0 <= val <= max_int):
        return f"{context} must be 0-{max_int}, got {val}"
    return None


def validate_teams(rom_bytes, teams_json):
    """Validate teams JSON against the ROM structure.

    Args:
        rom_bytes: ROM file contents (bytes or bytearray)
        teams_json: parsed JSON dict with 'national', 'club', 'custom' keys

    Returns:
        (errors, warnings) — both are lists of strings.
    """
    errors = []
    warnings = []

    if not isinstance(teams_json, dict) or not all(k in teams_json for k in CATEGORIES):
        errors.append("JSON must be a dict with 'national', 'club', 'custom' keys")
        return errors, warnings

    ptrs = find_pointer_table(rom_bytes)
    region_info = [
        ('national', ptrs['nat_start'], ptrs['nat_end']),
        ('club', ptrs['club_start'], ptrs['club_end']),
        ('custom', ptrs['cust_start'], ptrs['cust_end']),
    ]

    all_block_offsets = {}
    for cat, start, end in region_info:
        all_block_offsets[cat] = chain_walk_region(rom_bytes, start, end)

    for cat, start, end in region_info:
        rom_count = len(all_block_offsets[cat])
        json_teams = teams_json[cat]
        if len(json_teams) != rom_count:
            errors.append(f"{cat}: expected {rom_count} teams in JSON, got {len(json_teams)}")
            continue
        for i, team in enumerate(json_teams):
            tname = team.get('team', '?')
            players = team.get('players', [])
            if len(players) != 16:
                errors.append(f"{cat} team {i+1} '{tname}': expected 16 players, "
                              f"got {len(players)}")
            for label in ('team', 'country', 'coach'):
                bad = validate_string(team.get(label, ''), label)
                if bad:
                    errors.append(f"{cat} team {i+1} '{tname}' {label}: "
                                  f"invalid chars {bad!r} in '{team[label]}'")
            # Validate team-level attributes
            ctx = f"{cat} team {i+1} '{tname}'"
            err = _check_enum(team.get('tactic', '4-4-2'), TACTIC_VALUES, 7, f"{ctx}: tactic")
            if err:
                errors.append(err)
            skill = team.get('skill', 0)
            if not (0 <= skill <= 7):
                errors.append(f"{ctx}: skill must be 0-7, got {skill}")
            flag = team.get('flag', 0)
            if flag not in (0, 1):
                errors.append(f"{ctx}: flag must be 0 or 1, got {flag}")
            # Validate kit attributes
            kit = team.get('kit')
            if kit:
                for prefix in ('first', 'second'):
                    k = kit.get(prefix, {})
                    kctx = f"{ctx} {prefix} kit"
                    err = _check_enum(k.get('style', 'plain'), STYLE_VALUES, 3, f"{kctx}: style")
                    if err:
                        errors.append(err)
                    for field in ('shirt1', 'shirt2', 'shorts', 'socks'):
                        err = _check_enum(k.get(field, 'white'), COLOUR_VALUES, 15, f"{kctx}: {field}")
                        if err:
                            errors.append(err)
            # Validate player attributes
            for j, p in enumerate(players):
                if not isinstance(p, dict):
                    errors.append(f"{ctx} player {j+1}: "
                                  f"expected dict, got {type(p).__name__}")
                    continue
                bad = validate_string(p.get('name', ''), f"player {j+1}")
                if bad:
                    errors.append(f"{ctx} player {j+1}: "
                                  f"invalid chars {bad!r} in '{p['name']}'")
                num = p.get('number', 1)
                if not (1 <= num <= 16):
                    errors.append(f"{ctx} player {j+1}: "
                                  f"number must be 1-16, got {num}")
                pctx = f"{ctx} player {j+1}"
                for field, allowed, max_int, default in (
                    ('position', POSITION_VALUES, 15, 'goalkeeper'),
                    ('role', ROLE_VALUES, 3, 'goalkeeper'),
                    ('head', HEAD_VALUES, 2, 'white_dark'),
                ):
                    err = _check_enum(p.get(field, default), allowed, max_int, f"{pctx}: {field}")
                    if err:
                        errors.append(err)
            # Validate formation slot configuration
            starter_slots = []
            sub_count = 0
            for p in players:
                if not isinstance(p, dict):
                    continue
                pos = p.get('position', 'goalkeeper')
                if isinstance(pos, str):
                    pos = POSITION_VALUES.get(pos, -1)
                if pos == 15:
                    sub_count += 1
                else:
                    starter_slots.append(pos)
            if sorted(starter_slots) != list(range(11)):
                missing = set(range(11)) - set(starter_slots)
                duped = set(s for s in starter_slots if starter_slots.count(s) > 1)
                missing_names = [POSITION_NAMES.get(s, str(s)) for s in sorted(missing)]
                duped_names = [POSITION_NAMES.get(s, str(s)) for s in sorted(duped)]
                warnings.append(f"{ctx}: formation slots invalid — "
                                f"missing {missing_names}, duplicated {duped_names}")
            if sub_count != 5:
                warnings.append(f"{ctx}: expected 5 subs, got {sub_count}")

    return errors, warnings

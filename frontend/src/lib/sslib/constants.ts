export const CHARSET = "\x00ABCDEFGHIJKLMNOPQRSTUVWXYZ -'.";

export const ATTR_SIZE = 150;

// Offsets within the 150-byte attribute block where packed text positions
// are stored (19 entries for: team, country, coach, 16 players)
export const ATTR_OFFSETS = [2, 4, 6, 22, 30, 38, 46, 54, 62, 70, 78, 86, 94, 102, 110, 118, 126, 134, 142];

export const CATEGORIES = ['national', 'club', 'custom'] as const;

export const COLOUR_NAMES: Record<number, string> = {
  0x01: "grey", 0x02: "white", 0x03: "black", 0x04: "brown",
  0x05: "dark_orange", 0x06: "orange",
  0x07: "light_grey", 0x08: "dark_grey", 0x09: "dark_grey_2",
  0x0A: "red", 0x0B: "blue", 0x0C: "dark_red", 0x0D: "light_blue",
  0x0E: "green", 0x0F: "yellow",
};
export const COLOUR_VALUES: Record<string, number> = Object.fromEntries(
  Object.entries(COLOUR_NAMES).map(([k, v]) => [v, Number(k)])
);

export const STYLE_NAMES: Record<number, string> = {
  0: "plain", 1: "sleeves", 2: "vertical", 3: "horizontal",
};
export const STYLE_VALUES: Record<string, number> = Object.fromEntries(
  Object.entries(STYLE_NAMES).map(([k, v]) => [v, Number(k)])
);

export const HEAD_NAMES: Record<number, string> = {
  0: "white_dark", 1: "white_blonde", 2: "black_dark",
};
export const HEAD_VALUES: Record<string, number> = Object.fromEntries(
  Object.entries(HEAD_NAMES).map(([k, v]) => [v, Number(k)])
);

export const TACTIC_NAMES: Record<number, string> = {
  0: "4-4-2", 1: "5-4-1", 2: "4-5-1", 3: "5-3-2",
  4: "3-5-2", 5: "4-3-3", 6: "3-3-4", 7: "6-3-1",
};
export const TACTIC_VALUES: Record<string, number> = Object.fromEntries(
  Object.entries(TACTIC_NAMES).map(([k, v]) => [v, Number(k)])
);

export const ROLE_NAMES: Record<number, string> = {
  0: "goalkeeper", 1: "defender", 2: "midfielder", 3: "forward",
};
export const ROLE_VALUES: Record<string, number> = Object.fromEntries(
  Object.entries(ROLE_NAMES).map(([k, v]) => [v, Number(k)])
);

export const POSITION_NAMES: Record<number, string> = {
  0: "goalkeeper", 1: "right_back", 2: "left_back", 3: "centre_back", 4: "defender",
  5: "right_midfielder", 6: "centre_midfielder", 7: "left_midfielder", 8: "midfielder",
  9: "forward", 10: "second_forward", 15: "sub",
};
export const POSITION_VALUES: Record<string, number> = Object.fromEntries(
  Object.entries(POSITION_NAMES).map(([k, v]) => [v, Number(k)])
);

export const KNOWN_COUNTRIES = new Set([
  "ENGLAND", "SCOTLAND", "WALES", "NORTHERN IRELAND", "REPUBLIC OF IRELAND",
  "FRANCE", "GERMANY", "ITALY", "SPAIN", "HOLLAND", "BELGIUM", "PORTUGAL",
  "AUSTRIA", "SWITZERLAND", "SWEDEN", "NORWAY", "DENMARK", "FINLAND",
  "GREECE", "TURKEY", "ROMANIA", "BULGARIA", "HUNGARY", "POLAND",
  "CZECHOSLOVAKIA", "CROATIA", "SLOVENIA", "RUSSIA", "UKRAINE",
  "ALBANIA", "CYPRUS", "ICELAND", "ISRAEL", "LUXEMBOURG", "MALTA",
  "ESTONIA", "LATVIA", "LITHUANIA", "FAEROE ISLES",
]);

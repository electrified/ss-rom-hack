export interface KitColour {
  style: string;
  shirt1: string;
  shirt2: string;
  shorts: string;
  socks: string;
}

export interface Kit {
  first: KitColour;
  second: KitColour;
}

export interface Player {
  name: string;
  number: number;
  position: string;
  role: string;
  head: string;
  star?: boolean;
}

export interface Team {
  team: string;
  country: string;
  coach: string;
  tactic: string;
  skill: number;
  flag: number;
  kit: Kit;
  players: Player[];
}

export interface TeamsJson {
  national: Team[];
  club: Team[];
  custom: Team[];
}

export interface PointerTable {
  natStart: number;
  clubStart: number;
  custStart: number;
  natEnd: number;
  clubEnd: number;
  custEnd: number;
  tableBase: number;
}

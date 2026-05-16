async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// Build a `?modes=A,B,C` suffix. Empty array means "no filter, show all".
function modesQuery(modes: string[] | undefined): string {
  if (!modes || modes.length === 0) return "";
  return `?modes=${modes.map(encodeURIComponent).join(",")}`;
}

export type PlayerSummary = {
  player_key: string;
  display_name: string;
  riot_id_tagline: string | null;
  puuid: string | null;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  damage_dealt: number;
  damage_taken: number;
  gold_earned: number;
  cs: number;
  vision_score: number;
  top_nemesis?: { killer: string; times: number } | null;
};

export type NemesisRow = { nemesis: string; times: number };
export type VictimRow = { victim: string; times: number };

export type ChampionSummary = {
  champion_name: string;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  damage_dealt: number;
  gold_earned: number;
  cs: number;
};

export type PlayerByChampionRow = {
  champion_name: string;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  damage_dealt: number;
  gold_earned: number;
  cs: number;
};

export type ChampionByPlayerRow = {
  player_key: string;
  display_name: string;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  damage_dealt: number;
};

export type RecentGame = {
  match_id: string;
  game_creation: number | null;
  game_duration: number | null;
  game_mode: string | null;
  game_version: string | null;
  ingested_at: number;
};

// Live-client raw payload — fields we render in the match detail UI.
export type RawLiveItem = {
  itemID: number;
  displayName: string;
  count: number;
  slot: number;
  consumable?: boolean;
};
export type RawLivePlayer = {
  riotIdGameName?: string;
  riotIdTagLine?: string;
  summonerName?: string;
  championName?: string;
  team?: string;
  level?: number;
  isDead?: boolean;
  position?: string;
  scores?: {
    kills?: number;
    deaths?: number;
    assists?: number;
    creepScore?: number;
    wardScore?: number;
  };
  items?: RawLiveItem[];
  summonerSpells?: {
    summonerSpellOne?: { displayName?: string };
    summonerSpellTwo?: { displayName?: string };
  };
};
export type RawLiveEvent = {
  EventID: number;
  EventName: string;
  EventTime: number;
  KillerName?: string;
  VictimName?: string;
  Assisters?: string[];
  Recipient?: string;
  DragonType?: string;
  Stolen?: string;
  KillStreak?: number;
  Acer?: string;
  TurretKilled?: string;
  InhibKilled?: string;
  Result?: string;
};
export type RawLivePayload = {
  gameData?: { gameMode?: string; gameTime?: number; mapName?: string };
  allPlayers?: RawLivePlayer[];
  events?: { Events?: RawLiveEvent[] };
};

export type MatchParticipant = {
  puuid: string | null;
  riot_id_game_name: string | null;
  riot_id_tagline: string | null;
  summoner_name: string | null;
  team_id: number | null;
  champion_name: string | null;
  team_position: string | null;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
  total_damage_dealt_to_champions: number;
  total_damage_taken: number;
  gold_earned: number;
  total_minions_killed: number;
  neutral_minions_killed: number;
  vision_score: number;
};

export type MatchDetail = {
  game: {
    match_id: string;
    game_creation: number | null;
    game_duration: number | null;
    game_mode: string | null;
    game_type: string | null;
    game_version: string | null;
    queue_id: number | null;
    ingested_at: number;
  };
  participants: MatchParticipant[];
};

export const api = {
  modes: () => getJSON<{ modes: string[] }>("/api/modes"),
  players: (modes?: string[]) =>
    getJSON<{ players: PlayerSummary[] }>(`/api/players${modesQuery(modes)}`),
  player: (id: string, modes?: string[]) =>
    getJSON<{
      summary: PlayerSummary;
      byChampion: PlayerByChampionRow[];
      topNemeses: NemesisRow[];
      topVictims: VictimRow[];
    }>(`/api/players/${encodeURIComponent(id)}${modesQuery(modes)}`),
  champions: (modes?: string[]) =>
    getJSON<{ champions: ChampionSummary[] }>(
      `/api/champions${modesQuery(modes)}`
    ),
  champion: (name: string, modes?: string[]) =>
    getJSON<{ summary: ChampionSummary; byPlayer: ChampionByPlayerRow[] }>(
      `/api/champions/${encodeURIComponent(name)}${modesQuery(modes)}`
    ),
  games: (modes?: string[]) =>
    getJSON<{ games: RecentGame[] }>(`/api/games${modesQuery(modes)}`),
  match: (id: string) =>
    getJSON<MatchDetail>(`/api/games/${encodeURIComponent(id)}`),
  matchRaw: (id: string) =>
    getJSON<RawLivePayload>(`/api/games/${encodeURIComponent(id)}/raw`),
};

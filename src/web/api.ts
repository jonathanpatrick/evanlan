async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
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
};

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

export const api = {
  players: () => getJSON<{ players: PlayerSummary[] }>("/api/players"),
  player: (id: string) =>
    getJSON<{ summary: PlayerSummary; byChampion: PlayerByChampionRow[] }>(
      `/api/players/${encodeURIComponent(id)}`
    ),
  champions: () => getJSON<{ champions: ChampionSummary[] }>("/api/champions"),
  champion: (name: string) =>
    getJSON<{ summary: ChampionSummary; byPlayer: ChampionByPlayerRow[] }>(
      `/api/champions/${encodeURIComponent(name)}`
    ),
  games: () => getJSON<{ games: RecentGame[] }>("/api/games"),
};

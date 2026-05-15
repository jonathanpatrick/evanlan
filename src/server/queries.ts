import { db } from "./db.js";

// A single "player key" expression we group on consistently: prefer puuid,
// then Riot ID (game_name#tagline), then summoner_name. Computed inline so we
// don't have to maintain a separate column.
const PLAYER_KEY = `COALESCE(
  NULLIF(puuid, ''),
  NULLIF(riot_id_game_name || '#' || COALESCE(riot_id_tagline, ''), '#'),
  summoner_name
)`;

const PLAYER_DISPLAY = `COALESCE(riot_id_game_name, summoner_name, puuid)`;

export type PlayerSummaryRow = {
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

export function listPlayers(): PlayerSummaryRow[] {
  return db
    .prepare(
      `
      SELECT
        ${PLAYER_KEY}                                     AS player_key,
        ${PLAYER_DISPLAY}                                 AS display_name,
        MAX(riot_id_tagline)                              AS riot_id_tagline,
        MAX(puuid)                                        AS puuid,
        COUNT(*)                                          AS games,
        SUM(win)                                          AS wins,
        COUNT(*) - SUM(win)                               AS losses,
        SUM(kills)                                        AS kills,
        SUM(deaths)                                       AS deaths,
        SUM(assists)                                      AS assists,
        SUM(total_damage_dealt_to_champions)              AS damage_dealt,
        SUM(total_damage_taken)                           AS damage_taken,
        SUM(gold_earned)                                  AS gold_earned,
        SUM(total_minions_killed + neutral_minions_killed) AS cs,
        SUM(vision_score)                                 AS vision_score
      FROM participants
      WHERE ${PLAYER_KEY} IS NOT NULL
      GROUP BY ${PLAYER_KEY}, ${PLAYER_DISPLAY}
      ORDER BY games DESC, wins DESC
    `
    )
    .all() as PlayerSummaryRow[];
}

export function getPlayerSummary(
  identifier: string
): PlayerSummaryRow | undefined {
  return db
    .prepare(
      `
      SELECT
        ${PLAYER_KEY}                                     AS player_key,
        ${PLAYER_DISPLAY}                                 AS display_name,
        MAX(riot_id_tagline)                              AS riot_id_tagline,
        MAX(puuid)                                        AS puuid,
        COUNT(*)                                          AS games,
        SUM(win)                                          AS wins,
        COUNT(*) - SUM(win)                               AS losses,
        SUM(kills)                                        AS kills,
        SUM(deaths)                                       AS deaths,
        SUM(assists)                                      AS assists,
        SUM(total_damage_dealt_to_champions)              AS damage_dealt,
        SUM(total_damage_taken)                           AS damage_taken,
        SUM(gold_earned)                                  AS gold_earned,
        SUM(total_minions_killed + neutral_minions_killed) AS cs,
        SUM(vision_score)                                 AS vision_score
      FROM participants
      WHERE puuid = @id OR riot_id_game_name = @id OR summoner_name = @id
      GROUP BY ${PLAYER_KEY}, ${PLAYER_DISPLAY}
      LIMIT 1
    `
    )
    .get({ id: identifier }) as PlayerSummaryRow | undefined;
}

export function getPlayerByChampion(identifier: string) {
  return db
    .prepare(
      `
      SELECT
        champion_name,
        COUNT(*)                              AS games,
        SUM(win)                              AS wins,
        COUNT(*) - SUM(win)                   AS losses,
        SUM(kills)                            AS kills,
        SUM(deaths)                           AS deaths,
        SUM(assists)                          AS assists,
        SUM(total_damage_dealt_to_champions)  AS damage_dealt,
        SUM(gold_earned)                      AS gold_earned,
        SUM(total_minions_killed + neutral_minions_killed) AS cs
      FROM participants
      WHERE (puuid = @id OR riot_id_game_name = @id OR summoner_name = @id)
        AND champion_name IS NOT NULL
      GROUP BY champion_name
      ORDER BY games DESC, wins DESC
    `
    )
    .all({ id: identifier });
}

export type ChampionSummaryRow = {
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

export function listChampions(): ChampionSummaryRow[] {
  return db
    .prepare(
      `
      SELECT
        champion_name,
        COUNT(*)                              AS games,
        SUM(win)                              AS wins,
        COUNT(*) - SUM(win)                   AS losses,
        SUM(kills)                            AS kills,
        SUM(deaths)                           AS deaths,
        SUM(assists)                          AS assists,
        SUM(total_damage_dealt_to_champions)  AS damage_dealt,
        SUM(gold_earned)                      AS gold_earned,
        SUM(total_minions_killed + neutral_minions_killed) AS cs
      FROM participants
      WHERE champion_name IS NOT NULL
      GROUP BY champion_name
      ORDER BY games DESC, wins DESC
    `
    )
    .all() as ChampionSummaryRow[];
}

export function getChampionSummary(
  championName: string
): ChampionSummaryRow | undefined {
  return db
    .prepare(
      `
      SELECT
        champion_name,
        COUNT(*)                              AS games,
        SUM(win)                              AS wins,
        COUNT(*) - SUM(win)                   AS losses,
        SUM(kills)                            AS kills,
        SUM(deaths)                           AS deaths,
        SUM(assists)                          AS assists,
        SUM(total_damage_dealt_to_champions)  AS damage_dealt,
        SUM(gold_earned)                      AS gold_earned,
        SUM(total_minions_killed + neutral_minions_killed) AS cs
      FROM participants
      WHERE champion_name = @champion
      GROUP BY champion_name
    `
    )
    .get({ champion: championName }) as ChampionSummaryRow | undefined;
}

export function getChampionByPlayer(championName: string) {
  return db
    .prepare(
      `
      SELECT
        ${PLAYER_KEY}                         AS player_key,
        ${PLAYER_DISPLAY}                     AS display_name,
        COUNT(*)                              AS games,
        SUM(win)                              AS wins,
        COUNT(*) - SUM(win)                   AS losses,
        SUM(kills)                            AS kills,
        SUM(deaths)                           AS deaths,
        SUM(assists)                          AS assists,
        SUM(total_damage_dealt_to_champions)  AS damage_dealt
      FROM participants
      WHERE champion_name = @champion
        AND ${PLAYER_KEY} IS NOT NULL
      GROUP BY ${PLAYER_KEY}, ${PLAYER_DISPLAY}
      ORDER BY games DESC, wins DESC
    `
    )
    .all({ champion: championName });
}

export function listRecentGames(limit = 50) {
  return db
    .prepare(
      `
      SELECT match_id, game_creation, game_duration, game_mode, game_version, ingested_at
      FROM games
      ORDER BY COALESCE(game_creation, ingested_at) DESC
      LIMIT ?
    `
    )
    .all(limit);
}

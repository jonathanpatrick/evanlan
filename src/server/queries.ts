import { db } from "./db.js";

// A single "player key" expression we group on consistently: prefer puuid,
// then Riot ID (game_name#tagline), then summoner_name. Computed inline so we
// don't have to maintain a separate column.
const PLAYER_KEY = `COALESCE(
  NULLIF(p.puuid, ''),
  NULLIF(p.riot_id_game_name || '#' || COALESCE(p.riot_id_tagline, ''), '#'),
  p.summoner_name
)`;

const PLAYER_DISPLAY = `COALESCE(p.riot_id_game_name, p.summoner_name, p.puuid)`;

// Mode partitions. Arena ("CHERRY") needs separate aggregation — different
// team semantics (2v2v2v2), no win/loss inference yet, and Summoner's Rift
// stats like CS/vision don't translate. Everything that's not Arena lives in
// the main aggregation; Arena lives in /api/arena/*.
const ARENA_MODE = "CHERRY";
const NON_ARENA_FILTER = `(g.game_mode IS NULL OR g.game_mode != '${ARENA_MODE}')`;
const ARENA_FILTER = `g.game_mode = '${ARENA_MODE}'`;

type Scope = "non_arena" | "arena";
const modeFilter = (scope: Scope) =>
  scope === "arena" ? ARENA_FILTER : NON_ARENA_FILTER;

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

export function listPlayers(scope: Scope = "non_arena"): PlayerSummaryRow[] {
  return db
    .prepare(
      `
      SELECT
        ${PLAYER_KEY}                                       AS player_key,
        ${PLAYER_DISPLAY}                                   AS display_name,
        MAX(p.riot_id_tagline)                              AS riot_id_tagline,
        MAX(p.puuid)                                        AS puuid,
        COUNT(*)                                            AS games,
        SUM(p.win)                                          AS wins,
        COUNT(*) - SUM(p.win)                               AS losses,
        SUM(p.kills)                                        AS kills,
        SUM(p.deaths)                                       AS deaths,
        SUM(p.assists)                                      AS assists,
        SUM(p.total_damage_dealt_to_champions)              AS damage_dealt,
        SUM(p.total_damage_taken)                           AS damage_taken,
        SUM(p.gold_earned)                                  AS gold_earned,
        SUM(p.total_minions_killed + p.neutral_minions_killed) AS cs,
        SUM(p.vision_score)                                 AS vision_score
      FROM participants p
      JOIN games g ON g.match_id = p.match_id
      WHERE ${PLAYER_KEY} IS NOT NULL AND ${modeFilter(scope)}
      GROUP BY ${PLAYER_KEY}, ${PLAYER_DISPLAY}
      ORDER BY games DESC, wins DESC
    `
    )
    .all() as PlayerSummaryRow[];
}

export function getPlayerSummary(
  identifier: string,
  scope: Scope = "non_arena"
): PlayerSummaryRow | undefined {
  return db
    .prepare(
      `
      SELECT
        ${PLAYER_KEY}                                       AS player_key,
        ${PLAYER_DISPLAY}                                   AS display_name,
        MAX(p.riot_id_tagline)                              AS riot_id_tagline,
        MAX(p.puuid)                                        AS puuid,
        COUNT(*)                                            AS games,
        SUM(p.win)                                          AS wins,
        COUNT(*) - SUM(p.win)                               AS losses,
        SUM(p.kills)                                        AS kills,
        SUM(p.deaths)                                       AS deaths,
        SUM(p.assists)                                      AS assists,
        SUM(p.total_damage_dealt_to_champions)              AS damage_dealt,
        SUM(p.total_damage_taken)                           AS damage_taken,
        SUM(p.gold_earned)                                  AS gold_earned,
        SUM(p.total_minions_killed + p.neutral_minions_killed) AS cs,
        SUM(p.vision_score)                                 AS vision_score
      FROM participants p
      JOIN games g ON g.match_id = p.match_id
      WHERE (p.puuid = @id OR p.riot_id_game_name = @id OR p.summoner_name = @id)
        AND ${modeFilter(scope)}
      GROUP BY ${PLAYER_KEY}, ${PLAYER_DISPLAY}
      LIMIT 1
    `
    )
    .get({ id: identifier }) as PlayerSummaryRow | undefined;
}

export function getPlayerByChampion(
  identifier: string,
  scope: Scope = "non_arena"
) {
  return db
    .prepare(
      `
      SELECT
        p.champion_name                         AS champion_name,
        COUNT(*)                                AS games,
        SUM(p.win)                              AS wins,
        COUNT(*) - SUM(p.win)                   AS losses,
        SUM(p.kills)                            AS kills,
        SUM(p.deaths)                           AS deaths,
        SUM(p.assists)                          AS assists,
        SUM(p.total_damage_dealt_to_champions)  AS damage_dealt,
        SUM(p.gold_earned)                      AS gold_earned,
        SUM(p.total_minions_killed + p.neutral_minions_killed) AS cs
      FROM participants p
      JOIN games g ON g.match_id = p.match_id
      WHERE (p.puuid = @id OR p.riot_id_game_name = @id OR p.summoner_name = @id)
        AND p.champion_name IS NOT NULL
        AND ${modeFilter(scope)}
      GROUP BY p.champion_name
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

export function listChampions(scope: Scope = "non_arena"): ChampionSummaryRow[] {
  return db
    .prepare(
      `
      SELECT
        p.champion_name                         AS champion_name,
        COUNT(*)                                AS games,
        SUM(p.win)                              AS wins,
        COUNT(*) - SUM(p.win)                   AS losses,
        SUM(p.kills)                            AS kills,
        SUM(p.deaths)                           AS deaths,
        SUM(p.assists)                          AS assists,
        SUM(p.total_damage_dealt_to_champions)  AS damage_dealt,
        SUM(p.gold_earned)                      AS gold_earned,
        SUM(p.total_minions_killed + p.neutral_minions_killed) AS cs
      FROM participants p
      JOIN games g ON g.match_id = p.match_id
      WHERE p.champion_name IS NOT NULL AND ${modeFilter(scope)}
      GROUP BY p.champion_name
      ORDER BY games DESC, wins DESC
    `
    )
    .all() as ChampionSummaryRow[];
}

export function getChampionSummary(
  championName: string,
  scope: Scope = "non_arena"
): ChampionSummaryRow | undefined {
  return db
    .prepare(
      `
      SELECT
        p.champion_name                         AS champion_name,
        COUNT(*)                                AS games,
        SUM(p.win)                              AS wins,
        COUNT(*) - SUM(p.win)                   AS losses,
        SUM(p.kills)                            AS kills,
        SUM(p.deaths)                           AS deaths,
        SUM(p.assists)                          AS assists,
        SUM(p.total_damage_dealt_to_champions)  AS damage_dealt,
        SUM(p.gold_earned)                      AS gold_earned,
        SUM(p.total_minions_killed + p.neutral_minions_killed) AS cs
      FROM participants p
      JOIN games g ON g.match_id = p.match_id
      WHERE p.champion_name = @champion AND ${modeFilter(scope)}
      GROUP BY p.champion_name
    `
    )
    .get({ champion: championName }) as ChampionSummaryRow | undefined;
}

export function getChampionByPlayer(
  championName: string,
  scope: Scope = "non_arena"
) {
  return db
    .prepare(
      `
      SELECT
        ${PLAYER_KEY}                           AS player_key,
        ${PLAYER_DISPLAY}                       AS display_name,
        COUNT(*)                                AS games,
        SUM(p.win)                              AS wins,
        COUNT(*) - SUM(p.win)                   AS losses,
        SUM(p.kills)                            AS kills,
        SUM(p.deaths)                           AS deaths,
        SUM(p.assists)                          AS assists,
        SUM(p.total_damage_dealt_to_champions)  AS damage_dealt
      FROM participants p
      JOIN games g ON g.match_id = p.match_id
      WHERE p.champion_name = @champion
        AND ${PLAYER_KEY} IS NOT NULL
        AND ${modeFilter(scope)}
      GROUP BY ${PLAYER_KEY}, ${PLAYER_DISPLAY}
      ORDER BY games DESC, wins DESC
    `
    )
    .all({ champion: championName });
}

// Returns the original POST body for a successfully-parsed match so the UI
// can render fields we don't normalize into columns (items, runes, summoner
// spells, events timeline, active player stats, etc.).
export function getMatchRaw(matchId: string): unknown | undefined {
  const row = db
    .prepare(
      `SELECT body_json FROM raw_payloads WHERE match_id = ? AND parse_status = 'ok' LIMIT 1`
    )
    .get(matchId) as { body_json: string } | undefined;
  if (!row) return undefined;
  try {
    return JSON.parse(row.body_json);
  } catch {
    return undefined;
  }
}

export function getMatch(matchId: string) {
  const game = db
    .prepare(
      `SELECT match_id, game_creation, game_duration, game_mode, game_type, game_version, queue_id, ingested_at
       FROM games WHERE match_id = ?`
    )
    .get(matchId) as Record<string, unknown> | undefined;
  if (!game) return undefined;
  const participants = db
    .prepare(
      `SELECT puuid, riot_id_game_name, riot_id_tagline, summoner_name,
              team_id, champion_name, team_position, win,
              kills, deaths, assists,
              total_damage_dealt_to_champions, total_damage_taken,
              gold_earned, total_minions_killed, neutral_minions_killed, vision_score
       FROM participants
       WHERE match_id = ?
       ORDER BY team_id, kills + assists DESC`
    )
    .all(matchId);
  return { game, participants };
}

export function listRecentGames(limit = 50, scope: Scope = "non_arena") {
  return db
    .prepare(
      `
      SELECT match_id, game_creation, game_duration, game_mode, game_version, ingested_at
      FROM games g
      WHERE ${modeFilter(scope)}
      ORDER BY COALESCE(game_creation, ingested_at) DESC
      LIMIT ?
    `
    )
    .all(limit);
}

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

// "Known players" = anyone who has at least one non-Arena game. Arena custom
// lobbies frequently pull in randos who aren't part of the LAN. Applied to
// every player/champion aggregation so leaderboards stay LAN-only regardless
// of which game modes the user has selected in the filter.
const KNOWN_PLAYERS_CTE = `
  WITH known AS (
    SELECT DISTINCT COALESCE(
      NULLIF(p2.puuid, ''),
      NULLIF(p2.riot_id_game_name || '#' || COALESCE(p2.riot_id_tagline, ''), '#'),
      p2.summoner_name
    ) AS pk
    FROM participants p2
    JOIN games g2 ON g2.match_id = p2.match_id
    WHERE g2.game_mode IS NULL OR g2.game_mode != 'CHERRY'
  )
`;

// Mode filter clause used in every list/aggregation query. @modes is bound to
// a JSON array of mode codes; an empty array means "no filter, all modes".
const MODE_FILTER = `(
  json_array_length(@modes) = 0
  OR g.game_mode IN (SELECT value FROM json_each(@modes))
)`;

const modesBinding = (modes: string[] | undefined) =>
  JSON.stringify(modes ?? []);

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

export function listPlayers(modes?: string[]): PlayerSummaryRow[] {
  return db
    .prepare(
      `
      ${KNOWN_PLAYERS_CTE}
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
      WHERE ${PLAYER_KEY} IS NOT NULL
        AND ${PLAYER_KEY} IN (SELECT pk FROM known)
        AND ${MODE_FILTER}
      GROUP BY ${PLAYER_KEY}, ${PLAYER_DISPLAY}
      ORDER BY games DESC, wins DESC
    `
    )
    .all({ modes: modesBinding(modes) }) as PlayerSummaryRow[];
}

export function getPlayerSummary(
  identifier: string,
  modes?: string[]
): PlayerSummaryRow | undefined {
  return db
    .prepare(
      `
      ${KNOWN_PLAYERS_CTE}
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
        AND ${PLAYER_KEY} IN (SELECT pk FROM known)
        AND ${MODE_FILTER}
      GROUP BY ${PLAYER_KEY}, ${PLAYER_DISPLAY}
      LIMIT 1
    `
    )
    .get({ id: identifier, modes: modesBinding(modes) }) as
    | PlayerSummaryRow
    | undefined;
}

export function getPlayerByChampion(identifier: string, modes?: string[]) {
  return db
    .prepare(
      `
      ${KNOWN_PLAYERS_CTE}
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
        AND ${PLAYER_KEY} IN (SELECT pk FROM known)
        AND ${MODE_FILTER}
      GROUP BY p.champion_name
      ORDER BY games DESC, wins DESC
    `
    )
    .all({ id: identifier, modes: modesBinding(modes) });
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

export function listChampions(modes?: string[]): ChampionSummaryRow[] {
  return db
    .prepare(
      `
      ${KNOWN_PLAYERS_CTE}
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
      WHERE p.champion_name IS NOT NULL
        AND ${PLAYER_KEY} IN (SELECT pk FROM known)
        AND ${MODE_FILTER}
      GROUP BY p.champion_name
      ORDER BY games DESC, wins DESC
    `
    )
    .all({ modes: modesBinding(modes) }) as ChampionSummaryRow[];
}

export function getChampionSummary(
  championName: string,
  modes?: string[]
): ChampionSummaryRow | undefined {
  return db
    .prepare(
      `
      ${KNOWN_PLAYERS_CTE}
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
      WHERE p.champion_name = @champion
        AND ${PLAYER_KEY} IN (SELECT pk FROM known)
        AND ${MODE_FILTER}
      GROUP BY p.champion_name
    `
    )
    .get({ champion: championName, modes: modesBinding(modes) }) as
    | ChampionSummaryRow
    | undefined;
}

export function getChampionByPlayer(championName: string, modes?: string[]) {
  return db
    .prepare(
      `
      ${KNOWN_PLAYERS_CTE}
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
        AND ${PLAYER_KEY} IN (SELECT pk FROM known)
        AND ${MODE_FILTER}
      GROUP BY ${PLAYER_KEY}, ${PLAYER_DISPLAY}
      ORDER BY games DESC, wins DESC
    `
    )
    .all({ champion: championName, modes: modesBinding(modes) });
}

// ---- nemesis stats --------------------------------------------------------
// Computed on-demand from raw_payloads by walking each game's ChampionKill
// events. The events use riot_id_game_name as the player identifier (no
// puuid in there). Both killer and victim are restricted to known LAN names
// so randos can't appear as a top nemesis.

export type NemesisRow = { nemesis: string; times: number };
export type VictimRow = { victim: string; times: number };

const KNOWN_BY_NAME_CTE = `
  known_names AS (
    SELECT DISTINCT p2.riot_id_game_name AS name
    FROM participants p2
    JOIN games g2 ON g2.match_id = p2.match_id
    WHERE p2.riot_id_game_name IS NOT NULL
      AND (g2.game_mode IS NULL OR g2.game_mode != 'CHERRY')
  )
`;

const KILL_EVENTS_CTE = `
  kill_events AS (
    SELECT
      json_extract(event.value, '$.KillerName') AS killer,
      json_extract(event.value, '$.VictimName') AS victim
    FROM raw_payloads rp
    JOIN games g ON g.match_id = rp.match_id
    JOIN json_each(json_extract(rp.body_json, '$.events.Events')) AS event
    WHERE rp.parse_status = 'ok'
      AND json_extract(event.value, '$.EventName') = 'ChampionKill'
      AND ${MODE_FILTER}
  )
`;

// One row per (victim, killer) pair where both are LAN players: their #1
// killer + times. Used to attach a top_nemesis field to every player on the
// listings.
export function listTopNemesisPerPlayer(
  modes?: string[]
): { victim: string; killer: string; times: number }[] {
  return db
    .prepare(
      `
      WITH ${KNOWN_BY_NAME_CTE},
      ${KILL_EVENTS_CTE},
      counts AS (
        SELECT victim, killer, COUNT(*) AS times,
               ROW_NUMBER() OVER (PARTITION BY victim ORDER BY COUNT(*) DESC) AS rn
        FROM kill_events
        WHERE victim IN (SELECT name FROM known_names)
          AND killer IN (SELECT name FROM known_names)
        GROUP BY victim, killer
      )
      SELECT victim, killer, times
      FROM counts
      WHERE rn = 1
    `
    )
    .all({ modes: modesBinding(modes) }) as {
    victim: string;
    killer: string;
    times: number;
  }[];
}

export function getTopNemeses(
  victim: string,
  modes?: string[],
  limit = 5
): NemesisRow[] {
  return db
    .prepare(
      `
      WITH ${KNOWN_BY_NAME_CTE},
      ${KILL_EVENTS_CTE}
      SELECT killer AS nemesis, COUNT(*) AS times
      FROM kill_events
      WHERE victim = @victim
        AND killer IN (SELECT name FROM known_names)
      GROUP BY killer
      ORDER BY times DESC
      LIMIT @limit
    `
    )
    .all({ victim, limit, modes: modesBinding(modes) }) as NemesisRow[];
}

export function getTopVictims(
  killer: string,
  modes?: string[],
  limit = 5
): VictimRow[] {
  return db
    .prepare(
      `
      WITH ${KNOWN_BY_NAME_CTE},
      ${KILL_EVENTS_CTE}
      SELECT victim, COUNT(*) AS times
      FROM kill_events
      WHERE killer = @killer
        AND victim IN (SELECT name FROM known_names)
      GROUP BY victim
      ORDER BY times DESC
      LIMIT @limit
    `
    )
    .all({ killer, limit, modes: modesBinding(modes) }) as VictimRow[];
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

export function listRecentGames(limit = 50, modes?: string[]) {
  return db
    .prepare(
      `
      SELECT match_id, game_creation, game_duration, game_mode, game_version, ingested_at
      FROM games g
      WHERE ${MODE_FILTER}
      ORDER BY COALESCE(game_creation, ingested_at) DESC
      LIMIT @limit
    `
    )
    .all({ modes: modesBinding(modes), limit });
}

// Pairwise synergy: every (player_a, player_b) combo across LAN games,
// counting how often they were teamed vs opposing each other. Used by the
// synergy matrix + best-partnerships leaderboard. Mode filter respected;
// note that CHERRY games put everyone on team 100, so they'll skew the
// "together" counts — users can deselect Arena to get a clean read.
export type SynergyRow = {
  player_a: string;
  player_b: string;
  display_a: string;
  display_b: string;
  games_together: number;
  wins_together: number;
  games_versus: number;
  wins_a_versus_b: number;
};

export function getSynergyMatrix(modes?: string[]): SynergyRow[] {
  return db
    .prepare(
      `
      WITH known AS (
        SELECT DISTINCT COALESCE(
          NULLIF(p2.puuid, ''),
          NULLIF(p2.riot_id_game_name || '#' || COALESCE(p2.riot_id_tagline, ''), '#'),
          p2.summoner_name
        ) AS pk
        FROM participants p2
        JOIN games g2 ON g2.match_id = p2.match_id
        WHERE g2.game_mode IS NULL OR g2.game_mode != 'CHERRY'
      ),
      pp AS (
        SELECT
          ${PLAYER_KEY}     AS player_key,
          ${PLAYER_DISPLAY} AS display_name,
          p.match_id        AS match_id,
          p.team_id         AS team_id,
          p.win             AS win
        FROM participants p
        JOIN games g ON g.match_id = p.match_id
        WHERE ${PLAYER_KEY} IS NOT NULL
          AND ${PLAYER_KEY} IN (SELECT pk FROM known)
          AND ${MODE_FILTER}
      )
      SELECT
        pa.player_key      AS player_a,
        pb.player_key      AS player_b,
        MAX(pa.display_name) AS display_a,
        MAX(pb.display_name) AS display_b,
        SUM(CASE WHEN pa.team_id = pb.team_id THEN 1 ELSE 0 END) AS games_together,
        SUM(CASE WHEN pa.team_id = pb.team_id AND pa.win = 1 THEN 1 ELSE 0 END) AS wins_together,
        SUM(CASE WHEN pa.team_id != pb.team_id THEN 1 ELSE 0 END) AS games_versus,
        SUM(CASE WHEN pa.team_id != pb.team_id AND pa.win = 1 THEN 1 ELSE 0 END) AS wins_a_versus_b
      FROM pp pa
      JOIN pp pb ON pb.match_id = pa.match_id AND pa.player_key < pb.player_key
      GROUP BY pa.player_key, pb.player_key
    `
    )
    .all({ modes: modesBinding(modes) }) as SynergyRow[];
}

// Per-game stats for the N most recent games, restricted to LAN players.
// Frontend pivots this into one series per player for a line chart.
export type TrendPoint = {
  player_key: string;
  display_name: string;
  match_id: string;
  game_creation: number | null;
  ingested_at: number;
  game_mode: string | null;
  kills: number;
  deaths: number;
  assists: number;
  win: number;
};

export function getTrends(modes?: string[], limit = 20): TrendPoint[] {
  return db
    .prepare(
      `
      WITH known AS (
        SELECT DISTINCT COALESCE(
          NULLIF(p2.puuid, ''),
          NULLIF(p2.riot_id_game_name || '#' || COALESCE(p2.riot_id_tagline, ''), '#'),
          p2.summoner_name
        ) AS pk
        FROM participants p2
        JOIN games g2 ON g2.match_id = p2.match_id
        WHERE g2.game_mode IS NULL OR g2.game_mode != 'CHERRY'
      ),
      recent AS (
        SELECT g.match_id
        FROM games g
        WHERE ${MODE_FILTER}
        ORDER BY COALESCE(g.game_creation, g.ingested_at) DESC
        LIMIT @limit
      )
      SELECT
        ${PLAYER_KEY}     AS player_key,
        ${PLAYER_DISPLAY} AS display_name,
        g.match_id        AS match_id,
        g.game_creation   AS game_creation,
        g.ingested_at     AS ingested_at,
        g.game_mode       AS game_mode,
        p.kills           AS kills,
        p.deaths          AS deaths,
        p.assists         AS assists,
        p.win             AS win
      FROM participants p
      JOIN games g ON g.match_id = p.match_id
      WHERE p.match_id IN (SELECT match_id FROM recent)
        AND ${PLAYER_KEY} IS NOT NULL
        AND ${PLAYER_KEY} IN (SELECT pk FROM known)
      ORDER BY COALESCE(g.game_creation, g.ingested_at) ASC, g.match_id
    `
    )
    .all({ modes: modesBinding(modes), limit }) as TrendPoint[];
}

export function listAvailableModes(): string[] {
  return (
    db
      .prepare(
        `SELECT DISTINCT game_mode FROM games WHERE game_mode IS NOT NULL ORDER BY game_mode`
      )
      .all() as { game_mode: string }[]
  ).map((r) => r.game_mode);
}

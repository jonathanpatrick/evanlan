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

export function listAvailableModes(): string[] {
  return (
    db
      .prepare(
        `SELECT DISTINCT game_mode FROM games WHERE game_mode IS NOT NULL ORDER BY game_mode`
      )
      .all() as { game_mode: string }[]
  ).map((r) => r.game_mode);
}

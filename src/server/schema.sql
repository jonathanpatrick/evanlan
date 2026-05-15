-- Append-only log of every payload POSTed to /games. We always store the raw
-- body first so we can reparse retroactively if the parser changes.
CREATE TABLE IF NOT EXISTS raw_payloads (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  body_json     TEXT NOT NULL,
  received_at   INTEGER NOT NULL,
  parse_status  TEXT NOT NULL,    -- 'ok' | 'error'
  parse_error   TEXT,
  -- UNIQUE so re-POSTing the same game UPSERTs (latest snapshot wins).
  -- SQLite treats multiple NULLs as distinct, so unparseable payloads append.
  match_id      TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS idx_raw_payloads_status ON raw_payloads(parse_status);

-- One row per game when parsing succeeds. The canonical raw lives in
-- raw_payloads; this table is the normalized projection used by aggregations.
CREATE TABLE IF NOT EXISTS games (
  match_id        TEXT PRIMARY KEY,
  game_creation   INTEGER,
  game_duration   INTEGER,
  game_mode       TEXT,
  game_type       TEXT,
  game_version    TEXT,
  queue_id        INTEGER,
  ingested_at     INTEGER NOT NULL
);

-- One row per (game, player). Normalized so we can aggregate without
-- re-parsing JSON. Add columns as needed once we see the real payload.
CREATE TABLE IF NOT EXISTS participants (
  id                              INTEGER PRIMARY KEY AUTOINCREMENT,
  match_id                        TEXT NOT NULL REFERENCES games(match_id) ON DELETE CASCADE,
  puuid                           TEXT,
  riot_id_game_name               TEXT,
  riot_id_tagline                 TEXT,
  summoner_name                   TEXT,
  team_id                         INTEGER,
  champion_id                     INTEGER,
  champion_name                   TEXT,
  team_position                   TEXT,
  win                             INTEGER NOT NULL,
  kills                           INTEGER NOT NULL DEFAULT 0,
  deaths                          INTEGER NOT NULL DEFAULT 0,
  assists                         INTEGER NOT NULL DEFAULT 0,
  total_damage_dealt_to_champions INTEGER NOT NULL DEFAULT 0,
  total_damage_taken              INTEGER NOT NULL DEFAULT 0,
  gold_earned                     INTEGER NOT NULL DEFAULT 0,
  total_minions_killed            INTEGER NOT NULL DEFAULT 0,
  neutral_minions_killed          INTEGER NOT NULL DEFAULT 0,
  vision_score                    INTEGER NOT NULL DEFAULT 0,
  UNIQUE(match_id, puuid)
);

CREATE INDEX IF NOT EXISTS idx_participants_match    ON participants(match_id);
CREATE INDEX IF NOT EXISTS idx_participants_puuid    ON participants(puuid);
CREATE INDEX IF NOT EXISTS idx_participants_champ    ON participants(champion_name);
CREATE INDEX IF NOT EXISTS idx_participants_riot_id  ON participants(riot_id_game_name);

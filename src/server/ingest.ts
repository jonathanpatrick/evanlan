import { db } from "./db.js";

// Normalized shape we persist. Mirrors Riot's match-v5 DTO closely so we can
// extend the parser without changing the DB schema for common fields.
export type ParsedParticipant = {
  puuid: string | null;
  riotIdGameName: string | null;
  riotIdTagline: string | null;
  summonerName: string | null;
  teamId: number | null;
  championId: number | null;
  championName: string | null;
  teamPosition: string | null;
  win: boolean;
  kills: number;
  deaths: number;
  assists: number;
  totalDamageDealtToChampions: number;
  totalDamageTaken: number;
  goldEarned: number;
  totalMinionsKilled: number;
  neutralMinionsKilled: number;
  visionScore: number;
};

export type ParsedGame = {
  matchId: string;
  gameCreation: number | null;
  gameDuration: number | null;
  gameMode: string | null;
  gameType: string | null;
  gameVersion: string | null;
  queueId: number | null;
  participants: ParsedParticipant[];
};

// ---- helpers ---------------------------------------------------------------

const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};
const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;
const bool = (v: unknown): boolean => v === true || v === "Win" || v === 1;

// ---- parser ----------------------------------------------------------------

// Dispatch by shape: live-client API has top-level `allPlayers`, Riot match-v5
// has `metadata`/`info`. One function per source keeps each readable.
export function parseGameJson(raw: unknown): ParsedGame {
  if (!raw || typeof raw !== "object") {
    throw new Error("payload must be a JSON object");
  }
  const root = raw as Record<string, any>;
  if (Array.isArray(root.allPlayers)) return parseLiveClient(root);
  return parseMatchV5(root);
}

function parseMatchV5(root: Record<string, any>): ParsedGame {
  const metadata = (root.metadata ?? {}) as Record<string, any>;
  const info = (root.info ?? root) as Record<string, any>;

  const matchId =
    str(metadata.matchId) ?? str(root.matchId) ?? str(info.gameId);
  if (!matchId) throw new Error("missing matchId/gameId in match-v5 payload");

  const rawParticipants: unknown =
    info.participants ?? root.participants ?? [];
  if (!Array.isArray(rawParticipants)) {
    throw new Error("info.participants must be an array");
  }

  const participants: ParsedParticipant[] = rawParticipants.map((p: any) => ({
    puuid: str(p.puuid),
    riotIdGameName: str(p.riotIdGameName) ?? str(p.riotIdName),
    riotIdTagline: str(p.riotIdTagline),
    summonerName: str(p.summonerName),
    teamId: numOrNull(p.teamId),
    championId: numOrNull(p.championId),
    championName: str(p.championName),
    teamPosition: str(p.teamPosition) ?? str(p.individualPosition),
    win: bool(p.win),
    kills: num(p.kills),
    deaths: num(p.deaths),
    assists: num(p.assists),
    totalDamageDealtToChampions: num(p.totalDamageDealtToChampions),
    totalDamageTaken: num(p.totalDamageTaken),
    goldEarned: num(p.goldEarned),
    totalMinionsKilled: num(p.totalMinionsKilled),
    neutralMinionsKilled: num(p.neutralMinionsKilled),
    visionScore: num(p.visionScore),
  }));

  return {
    matchId,
    gameCreation: numOrNull(info.gameCreation),
    gameDuration: numOrNull(info.gameDuration),
    gameMode: str(info.gameMode),
    gameType: str(info.gameType),
    gameVersion: str(info.gameVersion),
    queueId: numOrNull(info.queueId),
    participants,
  };
}

// Live Client Data API (https://127.0.0.1:2999/liveclientdata/allgamedata)
// returns a different shape than match-v5: no matchId, no win/loss, no damage
// totals. We synthesize a stable matchId and extract what we can.
function parseLiveClient(root: Record<string, any>): ParsedGame {
  const gameData = (root.gameData ?? {}) as Record<string, any>;
  const allPlayers = root.allPlayers as any[];
  if (allPlayers.length === 0) {
    throw new Error("live-client payload has no players");
  }
  // events is { Events: [...] } in live-client; tolerate both wrappers
  const events: any[] = Array.isArray(root.events?.Events)
    ? root.events.Events
    : Array.isArray(root.events)
    ? root.events
    : [];
  const activePlayer = root.activePlayer as Record<string, any> | undefined;

  const gameTimeSec = num(gameData.gameTime);
  // gameStart in real wall-clock terms. Round to the minute so re-POSTs of
  // slightly different snapshots from the same game synthesize the same
  // matchId and dedupe.
  const gameStartMs =
    Math.round((Date.now() - gameTimeSec * 1000) / 60_000) * 60_000;

  let winningTeam: "ORDER" | "CHAOS" | null = null;

  // Preferred: explicit GameEnd event ("Win"/"Lose" relative to active player).
  const gameEnd = events.find((e: any) => e?.EventName === "GameEnd");
  if (gameEnd && activePlayer) {
    const apName =
      str(activePlayer.riotIdGameName) ?? str(activePlayer.summonerName);
    const apRow = allPlayers.find(
      (p: any) =>
        (apName && str(p.riotIdGameName) === apName) ||
        (apName && str(p.summonerName) === apName) ||
        str(p.riotId) === str(activePlayer.riotId)
    );
    const apTeam = apRow?.team as "ORDER" | "CHAOS" | undefined;
    const result = String(gameEnd.Result ?? "").toLowerCase();
    if (apTeam) {
      if (result === "win") winningTeam = apTeam;
      else if (result === "lose" || result === "loss") {
        winningTeam = apTeam === "ORDER" ? "CHAOS" : "ORDER";
      }
    }
  }

  // Fallback: count destroyed structures per side. If the snapshot was taken
  // right before the nexus fell (no GameEnd recorded), the losing side will
  // have noticeably more of its structures destroyed. Targets look like
  // "Turret_TOrder_L1_P3_..." or "Inhib_TChaos_L1_P1_...".
  if (winningTeam === null) {
    let orderLost = 0;
    let chaosLost = 0;
    for (const e of events) {
      const target =
        typeof e.TurretKilled === "string"
          ? e.TurretKilled
          : typeof e.InhibKilled === "string"
          ? e.InhibKilled
          : null;
      if (!target) continue;
      if (target.includes("_TOrder") || /_T1[_]/.test(target)) orderLost++;
      else if (target.includes("_TChaos") || /_T2[_]/.test(target)) chaosLost++;
    }
    if (orderLost > chaosLost) winningTeam = "CHAOS";
    else if (chaosLost > orderLost) winningTeam = "ORDER";
  }

  const participants: ParsedParticipant[] = allPlayers.map((p: any) => {
    const scores = (p.scores ?? {}) as Record<string, any>;
    const team = p.team as "ORDER" | "CHAOS" | undefined;
    return {
      puuid: null,
      riotIdGameName: str(p.riotIdGameName),
      // live-client uses riotIdTagLine (capital L); match-v5 uses riotIdTagline
      riotIdTagline: str(p.riotIdTagLine) ?? str(p.riotIdTagline),
      summonerName: str(p.summonerName),
      teamId: team === "ORDER" ? 100 : team === "CHAOS" ? 200 : null,
      championId: null,
      championName: str(p.championName),
      teamPosition: str(p.position),
      win: winningTeam !== null ? team === winningTeam : false,
      kills: num(scores.kills),
      deaths: num(scores.deaths),
      assists: num(scores.assists),
      // Live-client doesn't expose damage or gold totals — stored as 0.
      totalDamageDealtToChampions: 0,
      totalDamageTaken: 0,
      goldEarned: 0,
      totalMinionsKilled: num(scores.creepScore),
      neutralMinionsKilled: 0,
      visionScore: num(scores.wardScore),
    };
  });

  // Human-readable matchId: <MODE>_<YYYY-MM-DD>_<HH-MM> in UTC. The minute
  // granularity gives us tolerance for re-POSTs of the same game taken seconds
  // apart (they round to the same minute → same matchId → dedupe). Re-posting
  // a stored capture hours later will produce a different matchId, which is
  // fine for our live-capture-once-per-game flow.
  const gameMode = str(gameData.gameMode) ?? "UNKNOWN";
  const d = new Date(gameStartMs);
  const pad = (n: number) => n.toString().padStart(2, "0");
  const matchId = `${gameMode}_${d.getUTCFullYear()}-${pad(
    d.getUTCMonth() + 1
  )}-${pad(d.getUTCDate())}_${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}`;

  return {
    matchId,
    gameCreation: gameStartMs,
    gameDuration: Math.round(gameTimeSec),
    gameMode: str(gameData.gameMode),
    gameType: "CUSTOM_GAME",
    gameVersion: null,
    queueId: null,
    participants,
  };
}

// ---- persistence -----------------------------------------------------------

const insertGameStmt = db.prepare(`
  INSERT INTO games (
    match_id, game_creation, game_duration, game_mode, game_type,
    game_version, queue_id, ingested_at
  ) VALUES (
    @matchId, @gameCreation, @gameDuration, @gameMode, @gameType,
    @gameVersion, @queueId, @ingestedAt
  )
  ON CONFLICT(match_id) DO UPDATE SET
    game_creation = excluded.game_creation,
    game_duration = excluded.game_duration,
    game_mode     = excluded.game_mode,
    game_type     = excluded.game_type,
    game_version  = excluded.game_version,
    queue_id      = excluded.queue_id,
    ingested_at   = excluded.ingested_at
`);

// When parsing succeeds we UPSERT keyed by match_id so re-POSTs of the same
// game replace the prior raw snapshot ("latest timestamp wins" dedup).
const upsertRawByMatchStmt = db.prepare(`
  INSERT INTO raw_payloads (body_json, received_at, parse_status, parse_error, match_id)
  VALUES (@bodyJson, @receivedAt, 'ok', NULL, @matchId)
  ON CONFLICT(match_id) DO UPDATE SET
    body_json    = excluded.body_json,
    received_at  = excluded.received_at,
    parse_status = excluded.parse_status,
    parse_error  = excluded.parse_error
  RETURNING id
`);

// When parsing fails we append (no match_id to key off of). These rows are
// inspection bait — debug them, then update the parser.
const insertRawUnparsedStmt = db.prepare(`
  INSERT INTO raw_payloads (body_json, received_at, parse_status, parse_error, match_id)
  VALUES (@bodyJson, @receivedAt, 'error', @parseError, NULL)
  RETURNING id
`);

const deleteParticipantsStmt = db.prepare(
  `DELETE FROM participants WHERE match_id = ?`
);

const insertParticipantStmt = db.prepare(`
  INSERT INTO participants (
    match_id, puuid, riot_id_game_name, riot_id_tagline, summoner_name,
    team_id, champion_id, champion_name, team_position, win,
    kills, deaths, assists,
    total_damage_dealt_to_champions, total_damage_taken,
    gold_earned, total_minions_killed, neutral_minions_killed, vision_score
  ) VALUES (
    @matchId, @puuid, @riotIdGameName, @riotIdTagline, @summonerName,
    @teamId, @championId, @championName, @teamPosition, @win,
    @kills, @deaths, @assists,
    @totalDamageDealtToChampions, @totalDamageTaken,
    @goldEarned, @totalMinionsKilled, @neutralMinionsKilled, @visionScore
  )
`);

// One transaction: upsert the raw row (keyed on match_id), then upsert the
// normalized game + replace its participants.
const ingestParsedTxn = db.transaction(
  (parsed: ParsedGame, bodyJson: string, receivedAt: number) => {
    const { id } = upsertRawByMatchStmt.get({
      bodyJson,
      receivedAt,
      matchId: parsed.matchId,
    }) as { id: number };

    insertGameStmt.run({
      matchId: parsed.matchId,
      gameCreation: parsed.gameCreation,
      gameDuration: parsed.gameDuration,
      gameMode: parsed.gameMode,
      gameType: parsed.gameType,
      gameVersion: parsed.gameVersion,
      queueId: parsed.queueId,
      ingestedAt: receivedAt,
    });

    deleteParticipantsStmt.run(parsed.matchId);
    for (const p of parsed.participants) {
      insertParticipantStmt.run({
        matchId: parsed.matchId,
        ...p,
        win: p.win ? 1 : 0,
      });
    }
    return id;
  }
);

export type IngestResult = {
  rawId: number;
  parsed: boolean;
  matchId?: string;
  participants?: number;
  error?: string;
};

// Parse first, then persist. If parsing succeeds we UPSERT everything keyed
// on match_id; if it fails we append the raw payload for later inspection.
export function ingestGame(raw: unknown): IngestResult {
  const bodyJson = JSON.stringify(raw);
  const receivedAt = Date.now();

  let parsed: ParsedGame | undefined;
  let parseError: string | undefined;
  try {
    parsed = parseGameJson(raw);
  } catch (err) {
    parseError = err instanceof Error ? err.message : String(err);
  }

  if (parsed) {
    const rawId = ingestParsedTxn(parsed, bodyJson, receivedAt);
    return {
      rawId,
      parsed: true,
      matchId: parsed.matchId,
      participants: parsed.participants.length,
    };
  }

  const { id } = insertRawUnparsedStmt.get({
    bodyJson,
    receivedAt,
    parseError: parseError ?? "unknown error",
  }) as { id: number };
  return { rawId: id, parsed: false, error: parseError };
}

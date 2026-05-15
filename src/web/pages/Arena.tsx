import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  api,
  type ChampionSummary,
  type PlayerSummary,
  type RecentGame,
} from "../api.js";
import { KDA_TOOLTIP, SortableHeader, TableFilter } from "../components.js";
import { fmt, kdaValue } from "../format.js";
import { useAsync, useTable } from "../hooks.js";

const GAME_KEYS = {
  match: (g: RecentGame) => (g.match_id ?? "").toLowerCase(),
  played: (g: RecentGame) => g.game_creation ?? g.ingested_at ?? 0,
  duration: (g: RecentGame) => g.game_duration ?? 0,
};

const PLAYER_KEYS = {
  name: (p: PlayerSummary) => (p.display_name ?? "").toLowerCase(),
  games: (p: PlayerSummary) => p.games,
  kda: (p: PlayerSummary) => kdaValue(p.kills, p.deaths, p.assists),
};

const CHAMPION_KEYS = {
  name: (c: ChampionSummary) => (c.champion_name ?? "").toLowerCase(),
  games: (c: ChampionSummary) => c.games,
  kda: (c: ChampionSummary) => kdaValue(c.kills, c.deaths, c.assists),
};

export function Arena() {
  const games = useAsync(() => api.arena.games(), []);
  const players = useAsync(() => api.arena.players(), []);
  const champions = useAsync(() => api.arena.champions(), []);

  const gameFilterFields = useMemo(
    () => (g: RecentGame) => [g.match_id ?? "", g.game_mode ?? ""],
    []
  );
  const playerFilterFields = useMemo(
    () => (p: PlayerSummary) => [p.display_name ?? ""],
    []
  );
  const championFilterFields = useMemo(
    () => (c: ChampionSummary) => [c.champion_name ?? ""],
    []
  );

  const gameTable = useTable(games.data?.games, GAME_KEYS, {
    defaultSortId: "played",
    defaultDir: "desc",
    filterFields: gameFilterFields,
  });
  const playerTable = useTable(players.data?.players, PLAYER_KEYS, {
    defaultSortId: "kda",
    defaultDir: "desc",
    filterFields: playerFilterFields,
  });
  const championTable = useTable(champions.data?.champions, CHAMPION_KEYS, {
    defaultSortId: "kda",
    defaultDir: "desc",
    filterFields: championFilterFields,
  });

  return (
    <>
      <h1>Arena</h1>
      <p className="muted">
        Arena (2v2v2v2) games are separated out because the live-client API
        groups all 18 players onto one team and doesn't expose Arena placement,
        so win/loss numbers aren't computed here. Only players who have at
        least one non-Arena game show up — randos who joined the Arena custom
        lobby but aren't part of the LAN are filtered out automatically.
      </p>

      <h2>Recent games</h2>
      {games.loading && <p className="muted">Loading…</p>}
      {games.data && games.data.games.length === 0 && (
        <p className="muted">No Arena games yet.</p>
      )}
      {games.data && games.data.games.length > 0 && (
        <>
          <TableFilter
            value={gameTable.filter}
            onChange={gameTable.setFilter}
            count={gameTable.rows.length}
            placeholder="Filter games…"
          />
          <table>
            <thead>
              <tr>
                <SortableHeader id="match" label="Match" sortId={gameTable.sortId} sortDir={gameTable.sortDir} onClick={gameTable.toggleSort} />
                <SortableHeader id="played" label="Played" sortId={gameTable.sortId} sortDir={gameTable.sortDir} onClick={gameTable.toggleSort} />
                <SortableHeader id="duration" label="Duration" sortId={gameTable.sortId} sortDir={gameTable.sortDir} onClick={gameTable.toggleSort} className="numeric" />
              </tr>
            </thead>
            <tbody>
              {gameTable.rows.map((g) => (
                <tr key={g.match_id}>
                  <td>
                    <Link to={`/matches/${encodeURIComponent(g.match_id)}`}>
                      {g.match_id}
                    </Link>
                  </td>
                  <td>{fmt.date(g.game_creation ?? g.ingested_at)}</td>
                  <td className="numeric">{fmt.duration(g.game_duration)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2 style={{ marginTop: "2rem" }}>Players (Arena only)</h2>
      {players.data && players.data.players.length === 0 && (
        <p className="muted">No known players have Arena data yet.</p>
      )}
      {players.data && players.data.players.length > 0 && (
        <>
          <TableFilter
            value={playerTable.filter}
            onChange={playerTable.setFilter}
            count={playerTable.rows.length}
            placeholder="Filter players…"
          />
          <table>
            <thead>
              <tr>
                <SortableHeader id="name" label="Player" sortId={playerTable.sortId} sortDir={playerTable.sortDir} onClick={playerTable.toggleSort} />
                <SortableHeader id="games" label="Games" sortId={playerTable.sortId} sortDir={playerTable.sortDir} onClick={playerTable.toggleSort} className="numeric" />
                <SortableHeader id="kda" label="KDA" sortId={playerTable.sortId} sortDir={playerTable.sortDir} onClick={playerTable.toggleSort} className="numeric" title={KDA_TOOLTIP} />
              </tr>
            </thead>
            <tbody>
              {playerTable.rows.map((p) => (
                <tr key={p.player_key}>
                  <td>{p.display_name}</td>
                  <td className="numeric">{fmt.int(p.games)}</td>
                  <td className="numeric" title={KDA_TOOLTIP}>
                    {fmt.kda(p.kills, p.deaths, p.assists)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <h2 style={{ marginTop: "2rem" }}>Champions (Arena only)</h2>
      {champions.data && champions.data.champions.length === 0 && (
        <p className="muted">No Arena champion data yet.</p>
      )}
      {champions.data && champions.data.champions.length > 0 && (
        <>
          <TableFilter
            value={championTable.filter}
            onChange={championTable.setFilter}
            count={championTable.rows.length}
            placeholder="Filter champions…"
          />
          <table>
            <thead>
              <tr>
                <SortableHeader id="name" label="Champion" sortId={championTable.sortId} sortDir={championTable.sortDir} onClick={championTable.toggleSort} />
                <SortableHeader id="games" label="Games" sortId={championTable.sortId} sortDir={championTable.sortDir} onClick={championTable.toggleSort} className="numeric" />
                <SortableHeader id="kda" label="KDA" sortId={championTable.sortId} sortDir={championTable.sortDir} onClick={championTable.toggleSort} className="numeric" title={KDA_TOOLTIP} />
              </tr>
            </thead>
            <tbody>
              {championTable.rows.map((c) => (
                <tr key={c.champion_name}>
                  <td>{c.champion_name}</td>
                  <td className="numeric">{fmt.int(c.games)}</td>
                  <td className="numeric" title={KDA_TOOLTIP}>
                    {fmt.kda(c.kills, c.deaths, c.assists)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

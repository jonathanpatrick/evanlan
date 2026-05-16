import { useMemo } from "react";
import { Link } from "react-router-dom";
import { api, type ChampionSummary, type PlayerSummary } from "../api.js";
import { KDA_TOOLTIP, SortableHeader, TableFilter } from "../components.js";
import { fmt, kdaValue } from "../format.js";
import { useAsync, useTable } from "../hooks.js";
import { useSelectedModes } from "../mode-filter.js";

// Floor for "ranked" lists. One 100%-WR game would otherwise dominate; with a
// small friend group two games is a reasonable signal floor.
const MIN_GAMES = 2;
const TOP_N = 5;

const PLAYER_SORT_KEYS = {
  name: (p: PlayerSummary) => (p.display_name ?? "").toLowerCase(),
  games: (p: PlayerSummary) => p.games,
  record: (p: PlayerSummary) => p.wins,
  winPct: (p: PlayerSummary) => (p.games ? p.wins / p.games : 0),
  kda: (p: PlayerSummary) => kdaValue(p.kills, p.deaths, p.assists),
};

const CHAMPION_SORT_KEYS = {
  name: (c: ChampionSummary) => (c.champion_name ?? "").toLowerCase(),
  games: (c: ChampionSummary) => c.games,
  record: (c: ChampionSummary) => c.wins,
  winPct: (c: ChampionSummary) => (c.games ? c.wins / c.games : 0),
  kda: (c: ChampionSummary) => kdaValue(c.kills, c.deaths, c.assists),
};

export function Home() {
  const modes = useSelectedModes();
  const players = useAsync(() => api.players(modes), [modes]);
  const champions = useAsync(() => api.champions(modes), [modes]);

  // Floor before sort/filter so the leaderboards stay meaningful.
  const eligiblePlayers = useMemo(
    () => (players.data?.players ?? []).filter((p) => p.games >= MIN_GAMES),
    [players.data]
  );
  const eligibleChampions = useMemo(
    () =>
      (champions.data?.champions ?? []).filter((c) => c.games >= MIN_GAMES),
    [champions.data]
  );

  const playerFilterFields = useMemo(
    () => (p: PlayerSummary) => [p.display_name ?? ""],
    []
  );
  const championFilterFields = useMemo(
    () => (c: ChampionSummary) => [c.champion_name ?? ""],
    []
  );

  const playerTable = useTable(eligiblePlayers, PLAYER_SORT_KEYS, {
    defaultSortId: "winPct",
    defaultDir: "desc",
    filterFields: playerFilterFields,
  });
  const championTable = useTable(eligibleChampions, CHAMPION_SORT_KEYS, {
    defaultSortId: "winPct",
    defaultDir: "desc",
    filterFields: championFilterFields,
  });

  const topPlayers = playerTable.rows.slice(0, TOP_N);
  const topChampions = championTable.rows.slice(0, TOP_N);

  return (
    <>
      <h1>Biggest Peepees</h1>
      <div className="card-grid">
        <section className="card">
          <h2>Top {TOP_N} Players</h2>
          <p className="muted card-subtitle">Minimum {MIN_GAMES} games</p>
          {players.loading && <p className="muted">Loading…</p>}
          {players.error && (
            <p className="loss">Error: {players.error.message}</p>
          )}
          {!players.loading && eligiblePlayers.length === 0 && (
            <p className="muted">Not enough games yet.</p>
          )}
          {eligiblePlayers.length > 0 && (
            <>
              <TableFilter
                value={playerTable.filter}
                onChange={playerTable.setFilter}
                count={topPlayers.length}
                placeholder="Filter players…"
              />
              <table>
                <thead>
                  <tr>
                    <SortableHeader id="name" label="Player" sortId={playerTable.sortId} sortDir={playerTable.sortDir} onClick={playerTable.toggleSort} />
                    <SortableHeader id="winPct" label="Win %" sortId={playerTable.sortId} sortDir={playerTable.sortDir} onClick={playerTable.toggleSort} className="numeric" />
                    <SortableHeader id="record" label="W / L" sortId={playerTable.sortId} sortDir={playerTable.sortDir} onClick={playerTable.toggleSort} className="numeric" />
                    <SortableHeader id="kda" label="KDA" sortId={playerTable.sortId} sortDir={playerTable.sortDir} onClick={playerTable.toggleSort} className="numeric" title={KDA_TOOLTIP} />
                  </tr>
                </thead>
                <tbody>
                  {topPlayers.map((p) => (
                    <tr key={p.player_key}>
                      <td>
                        <Link to={`/players/${encodeURIComponent(p.puuid ?? p.display_name)}`}>
                          {p.display_name}
                        </Link>
                      </td>
                      <td className="numeric">{fmt.pct(p.wins, p.games)}</td>
                      <td className="numeric">
                        <span className="win">{fmt.int(p.wins)}</span>
                        {" / "}
                        <span className="loss">{fmt.int(p.losses)}</span>
                      </td>
                      <td className="numeric" title={KDA_TOOLTIP}>
                        {fmt.kda(p.kills, p.deaths, p.assists)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>

        <section className="card">
          <h2>Top {TOP_N} Champions</h2>
          <p className="muted card-subtitle">Minimum {MIN_GAMES} games</p>
          {champions.loading && <p className="muted">Loading…</p>}
          {champions.error && (
            <p className="loss">Error: {champions.error.message}</p>
          )}
          {!champions.loading && eligibleChampions.length === 0 && (
            <p className="muted">Not enough games yet.</p>
          )}
          {eligibleChampions.length > 0 && (
            <>
              <TableFilter
                value={championTable.filter}
                onChange={championTable.setFilter}
                count={topChampions.length}
                placeholder="Filter champions…"
              />
              <table>
                <thead>
                  <tr>
                    <SortableHeader id="name" label="Champion" sortId={championTable.sortId} sortDir={championTable.sortDir} onClick={championTable.toggleSort} />
                    <SortableHeader id="winPct" label="Win %" sortId={championTable.sortId} sortDir={championTable.sortDir} onClick={championTable.toggleSort} className="numeric" />
                    <SortableHeader id="record" label="W / L" sortId={championTable.sortId} sortDir={championTable.sortDir} onClick={championTable.toggleSort} className="numeric" />
                    <SortableHeader id="kda" label="KDA" sortId={championTable.sortId} sortDir={championTable.sortDir} onClick={championTable.toggleSort} className="numeric" title={KDA_TOOLTIP} />
                  </tr>
                </thead>
                <tbody>
                  {topChampions.map((c) => (
                    <tr key={c.champion_name}>
                      <td>
                        <Link to={`/champions/${encodeURIComponent(c.champion_name)}`}>
                          {c.champion_name}
                        </Link>
                      </td>
                      <td className="numeric">{fmt.pct(c.wins, c.games)}</td>
                      <td className="numeric">
                        <span className="win">{fmt.int(c.wins)}</span>
                        {" / "}
                        <span className="loss">{fmt.int(c.losses)}</span>
                      </td>
                      <td className="numeric" title={KDA_TOOLTIP}>
                        {fmt.kda(c.kills, c.deaths, c.assists)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </section>
      </div>
    </>
  );
}

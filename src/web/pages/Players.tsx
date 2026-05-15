import { useMemo } from "react";
import { Link } from "react-router-dom";
import { api, type PlayerSummary } from "../api.js";
import { KDA_TOOLTIP, SortableHeader, TableFilter } from "../components.js";
import { fmt, kdaValue } from "../format.js";
import { useAsync, useTable } from "../hooks.js";

const SORT_KEYS = {
  name: (p: PlayerSummary) => (p.display_name ?? "").toLowerCase(),
  games: (p: PlayerSummary) => p.games,
  record: (p: PlayerSummary) => p.wins,
  winPct: (p: PlayerSummary) => (p.games ? p.wins / p.games : 0),
  kda: (p: PlayerSummary) => kdaValue(p.kills, p.deaths, p.assists),
  damage: (p: PlayerSummary) => p.damage_dealt / Math.max(p.games, 1),
};

export function Players() {
  const { data, error, loading } = useAsync(() => api.players(), []);
  const filterFields = useMemo(
    () => (p: PlayerSummary) => [p.display_name ?? ""],
    []
  );
  const t = useTable(data?.players, SORT_KEYS, {
    defaultSortId: "kda",
    defaultDir: "desc",
    filterFields,
  });

  return (
    <>
      <h1>Players</h1>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="loss">Error: {error.message}</p>}
      {data && data.players.length === 0 && (
        <p className="muted">No players yet.</p>
      )}
      {data && data.players.length > 0 && (
        <>
          <TableFilter
            value={t.filter}
            onChange={t.setFilter}
            count={t.rows.length}
            placeholder="Filter players…"
          />
          <table>
            <thead>
              <tr>
                <SortableHeader
                  id="name"
                  label="Player"
                  sortId={t.sortId}
                  sortDir={t.sortDir}
                  onClick={t.toggleSort}
                />
                <SortableHeader
                  id="games"
                  label="Games"
                  sortId={t.sortId}
                  sortDir={t.sortDir}
                  onClick={t.toggleSort}
                  className="numeric"
                />
                <SortableHeader
                  id="record"
                  label="W / L"
                  sortId={t.sortId}
                  sortDir={t.sortDir}
                  onClick={t.toggleSort}
                  className="numeric"
                />
                <SortableHeader
                  id="winPct"
                  label="Win %"
                  sortId={t.sortId}
                  sortDir={t.sortDir}
                  onClick={t.toggleSort}
                  className="numeric"
                />
                <SortableHeader
                  id="kda"
                  label="KDA"
                  sortId={t.sortId}
                  sortDir={t.sortDir}
                  onClick={t.toggleSort}
                  className="numeric"
                  title={KDA_TOOLTIP}
                />
                <SortableHeader
                  id="damage"
                  label="DMG / game"
                  sortId={t.sortId}
                  sortDir={t.sortDir}
                  onClick={t.toggleSort}
                  className="numeric"
                />
              </tr>
            </thead>
            <tbody>
              {t.rows.map((p) => (
                <tr key={p.player_key}>
                  <td>
                    <Link
                      to={`/players/${encodeURIComponent(
                        p.puuid ?? p.display_name
                      )}`}
                    >
                      {p.display_name}
                    </Link>
                    {p.riot_id_tagline && (
                      <span className="muted"> #{p.riot_id_tagline}</span>
                    )}
                  </td>
                  <td className="numeric">{fmt.int(p.games)}</td>
                  <td className="numeric">
                    <span className="win">{fmt.int(p.wins)}</span>
                    {" / "}
                    <span className="loss">{fmt.int(p.losses)}</span>
                  </td>
                  <td className="numeric">{fmt.pct(p.wins, p.games)}</td>
                  <td className="numeric" title={KDA_TOOLTIP}>
                    {fmt.kda(p.kills, p.deaths, p.assists)}
                  </td>
                  <td className="numeric">
                    {fmt.int(p.damage_dealt / Math.max(p.games, 1))}
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

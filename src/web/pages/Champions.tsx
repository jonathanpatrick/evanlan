import { useMemo } from "react";
import { Link } from "react-router-dom";
import { api, type ChampionSummary } from "../api.js";
import { KDA_TOOLTIP, SortableHeader, TableFilter } from "../components.js";
import { fmt, kdaValue } from "../format.js";
import { useAsync, useTable } from "../hooks.js";

const SORT_KEYS = {
  name: (c: ChampionSummary) => (c.champion_name ?? "").toLowerCase(),
  games: (c: ChampionSummary) => c.games,
  record: (c: ChampionSummary) => c.wins,
  winPct: (c: ChampionSummary) => (c.games ? c.wins / c.games : 0),
  kda: (c: ChampionSummary) => kdaValue(c.kills, c.deaths, c.assists),
  damage: (c: ChampionSummary) => c.damage_dealt / Math.max(c.games, 1),
};

export function Champions() {
  const { data, error, loading } = useAsync(() => api.champions(), []);
  const filterFields = useMemo(
    () => (c: ChampionSummary) => [c.champion_name ?? ""],
    []
  );
  const t = useTable(data?.champions, SORT_KEYS, {
    defaultSortId: "kda",
    defaultDir: "desc",
    filterFields,
  });

  return (
    <>
      <h1>Champions</h1>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="loss">Error: {error.message}</p>}
      {data && data.champions.length === 0 && (
        <p className="muted">No champion data yet.</p>
      )}
      {data && data.champions.length > 0 && (
        <>
          <TableFilter
            value={t.filter}
            onChange={t.setFilter}
            count={t.rows.length}
            placeholder="Filter champions…"
          />
          <table>
            <thead>
              <tr>
                <SortableHeader id="name" label="Champion" sortId={t.sortId} sortDir={t.sortDir} onClick={t.toggleSort} />
                <SortableHeader id="games" label="Games" sortId={t.sortId} sortDir={t.sortDir} onClick={t.toggleSort} className="numeric" />
                <SortableHeader id="record" label="W / L" sortId={t.sortId} sortDir={t.sortDir} onClick={t.toggleSort} className="numeric" />
                <SortableHeader id="winPct" label="Win %" sortId={t.sortId} sortDir={t.sortDir} onClick={t.toggleSort} className="numeric" />
                <SortableHeader id="kda" label="KDA" sortId={t.sortId} sortDir={t.sortDir} onClick={t.toggleSort} className="numeric" title={KDA_TOOLTIP} />
                <SortableHeader id="damage" label="DMG / game" sortId={t.sortId} sortDir={t.sortDir} onClick={t.toggleSort} className="numeric" />
              </tr>
            </thead>
            <tbody>
              {t.rows.map((c) => (
                <tr key={c.champion_name}>
                  <td>
                    <Link to={`/champions/${encodeURIComponent(c.champion_name)}`}>
                      {c.champion_name}
                    </Link>
                  </td>
                  <td className="numeric">{fmt.int(c.games)}</td>
                  <td className="numeric">
                    <span className="win">{fmt.int(c.wins)}</span>
                    {" / "}
                    <span className="loss">{fmt.int(c.losses)}</span>
                  </td>
                  <td className="numeric">{fmt.pct(c.wins, c.games)}</td>
                  <td className="numeric" title={KDA_TOOLTIP}>
                    {fmt.kda(c.kills, c.deaths, c.assists)}
                  </td>
                  <td className="numeric">
                    {fmt.int(c.damage_dealt / Math.max(c.games, 1))}
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

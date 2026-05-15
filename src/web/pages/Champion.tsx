import { useMemo, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type ChampionByPlayerRow } from "../api.js";
import { KDA_TOOLTIP, SortableHeader, TableFilter } from "../components.js";
import { fmt, kdaValue } from "../format.js";
import { useAsync, useTable } from "../hooks.js";

const SORT_KEYS = {
  name: (r: ChampionByPlayerRow) => (r.display_name ?? "").toLowerCase(),
  games: (r: ChampionByPlayerRow) => r.games,
  record: (r: ChampionByPlayerRow) => r.wins,
  winPct: (r: ChampionByPlayerRow) => (r.games ? r.wins / r.games : 0),
  kda: (r: ChampionByPlayerRow) => kdaValue(r.kills, r.deaths, r.assists),
};

export function Champion() {
  const { name = "" } = useParams();
  const { data, error, loading } = useAsync(() => api.champion(name), [name]);
  const filterFields = useMemo(
    () => (r: ChampionByPlayerRow) => [r.display_name ?? ""],
    []
  );
  const t = useTable(data?.byPlayer, SORT_KEYS, {
    defaultSortId: "kda",
    defaultDir: "desc",
    filterFields,
  });

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="loss">Error: {error.message}</p>;
  if (!data) return null;

  const { summary } = data;

  return (
    <>
      <h1>{summary.champion_name}</h1>

      <div className="stat-grid">
        <Stat label="Games" value={fmt.int(summary.games)} />
        <Stat
          label="W / L"
          value={
            <>
              <span className="win">{fmt.int(summary.wins)}</span>
              {" / "}
              <span className="loss">{fmt.int(summary.losses)}</span>
            </>
          }
        />
        <Stat label="Win rate" value={fmt.pct(summary.wins, summary.games)} />
        <Stat
          label="KDA"
          value={fmt.kda(summary.kills, summary.deaths, summary.assists)}
          title={KDA_TOOLTIP}
        />
        <Stat label="Total damage" value={fmt.int(summary.damage_dealt)} />
        <Stat label="Total CS" value={fmt.int(summary.cs)} />
      </div>

      <h2>By player</h2>
      {data.byPlayer.length === 0 ? (
        <p className="muted">Nobody has played this champion yet.</p>
      ) : (
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
                <SortableHeader id="name" label="Player" sortId={t.sortId} sortDir={t.sortDir} onClick={t.toggleSort} />
                <SortableHeader id="games" label="Games" sortId={t.sortId} sortDir={t.sortDir} onClick={t.toggleSort} className="numeric" />
                <SortableHeader id="record" label="W / L" sortId={t.sortId} sortDir={t.sortDir} onClick={t.toggleSort} className="numeric" />
                <SortableHeader id="winPct" label="Win %" sortId={t.sortId} sortDir={t.sortDir} onClick={t.toggleSort} className="numeric" />
                <SortableHeader id="kda" label="KDA" sortId={t.sortId} sortDir={t.sortDir} onClick={t.toggleSort} className="numeric" title={KDA_TOOLTIP} />
              </tr>
            </thead>
            <tbody>
              {t.rows.map((p) => (
                <tr key={p.player_key}>
                  <td>
                    <Link
                      to={`/players/${encodeURIComponent(p.player_key.split("#")[0])}`}
                    >
                      {p.display_name}
                    </Link>
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
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}

function Stat({
  label,
  value,
  title,
}: {
  label: string;
  value: ReactNode;
  title?: string;
}) {
  return (
    <div className="stat-card" title={title}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

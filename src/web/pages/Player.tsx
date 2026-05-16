import { useMemo, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  type NemesisRow,
  type PlayerByChampionRow,
  type VictimRow,
} from "../api.js";
import { KDA_TOOLTIP, SortableHeader, TableFilter } from "../components.js";
import { fmt, kdaValue } from "../format.js";
import { useAsync, useTable } from "../hooks.js";
import { useSelectedModes } from "../mode-filter.js";

const SORT_KEYS = {
  name: (r: PlayerByChampionRow) => (r.champion_name ?? "").toLowerCase(),
  games: (r: PlayerByChampionRow) => r.games,
  record: (r: PlayerByChampionRow) => r.wins,
  winPct: (r: PlayerByChampionRow) => (r.games ? r.wins / r.games : 0),
  kda: (r: PlayerByChampionRow) => kdaValue(r.kills, r.deaths, r.assists),
  damage: (r: PlayerByChampionRow) => r.damage_dealt / Math.max(r.games, 1),
};

export function Player() {
  const { id = "" } = useParams();
  const modes = useSelectedModes();
  const { data, error, loading } = useAsync(
    () => api.player(id, modes),
    [id, modes]
  );
  const filterFields = useMemo(
    () => (r: PlayerByChampionRow) => [r.champion_name ?? ""],
    []
  );
  const t = useTable(data?.byChampion, SORT_KEYS, {
    defaultSortId: "kda",
    defaultDir: "desc",
    filterFields,
  });

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="loss">Error: {error.message}</p>;
  if (!data) return null;

  const { summary, topNemeses, topVictims } = data;

  return (
    <>
      <h1>
        {summary.display_name}
        {summary.riot_id_tagline && (
          <span className="muted"> #{summary.riot_id_tagline}</span>
        )}
      </h1>

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
        <Stat label="Total gold" value={fmt.int(summary.gold_earned)} />
        <Stat label="Total CS" value={fmt.int(summary.cs)} />
        <Stat label="Total vision" value={fmt.int(summary.vision_score)} />
      </div>

      <div className="card-grid" style={{ marginTop: "1.5rem" }}>
        <NemesisCard title="Top Nemeses" subtitle="Who's killed them most" rows={topNemeses} />
        <VictimCard title="Top Victims" subtitle="Who they kill most" rows={topVictims} />
      </div>

      <h2 style={{ marginTop: "2rem" }}>By champion</h2>
      {data.byChampion.length === 0 ? (
        <p className="muted">No champions yet.</p>
      ) : (
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

function NemesisCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: NemesisRow[];
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted card-subtitle">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="muted">No data yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nemesis</th>
              <th className="numeric">Kills on you</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.nemesis}>
                <td>
                  <Link to={`/players/${encodeURIComponent(r.nemesis)}`}>
                    {r.nemesis}
                  </Link>
                </td>
                <td className="numeric">{fmt.int(r.times)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function VictimCard({
  title,
  subtitle,
  rows,
}: {
  title: string;
  subtitle: string;
  rows: VictimRow[];
}) {
  return (
    <section className="card">
      <h2>{title}</h2>
      <p className="muted card-subtitle">{subtitle}</p>
      {rows.length === 0 ? (
        <p className="muted">No data yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Victim</th>
              <th className="numeric">Your kills</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.victim}>
                <td>
                  <Link to={`/players/${encodeURIComponent(r.victim)}`}>
                    {r.victim}
                  </Link>
                </td>
                <td className="numeric">{fmt.int(r.times)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

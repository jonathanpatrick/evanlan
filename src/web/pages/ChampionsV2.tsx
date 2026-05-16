import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api.js";
import { TableFilter } from "../components.js";
import { fmt, kdaValue } from "../format.js";
import { useAsync } from "../hooks.js";
import { useSelectedModes } from "../mode-filter.js";

// Portrait pixel range. Min keeps tiny champs readable; max keeps a single
// runaway perfect-KDA portrait from becoming a 600px monster.
const MIN_SIZE = 70;
const MAX_SIZE = 200;

type Row = {
  champion_name: string;
  games: number;
  wins: number;
  losses: number;
  kills: number;
  deaths: number;
  assists: number;
  kda: number;
  imageUrl?: string;
};

export function ChampionsV2() {
  const modes = useSelectedModes();
  const champions = useAsync(() => api.champions(modes), [modes]);
  const meta = useAsync(() => api.championMeta(), []);
  const [filter, setFilter] = useState("");

  const metaByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of meta.data?.champions ?? []) {
      m.set(c.name.toLowerCase(), c.imageUrl);
    }
    return m;
  }, [meta.data]);

  const rows: Row[] = useMemo(
    () =>
      (champions.data?.champions ?? []).map((c) => ({
        ...c,
        kda: kdaValue(c.kills, c.deaths, c.assists),
        imageUrl: metaByName.get(c.champion_name.toLowerCase()),
      })),
    [champions.data, metaByName]
  );

  const { minKda, maxKda } = useMemo(() => {
    if (rows.length === 0) return { minKda: 0, maxKda: 0 };
    let mn = rows[0].kda;
    let mx = rows[0].kda;
    for (const r of rows) {
      if (r.kda < mn) mn = r.kda;
      if (r.kda > mx) mx = r.kda;
    }
    return { minKda: mn, maxKda: mx };
  }, [rows]);

  const sizeFor = (kda: number) => {
    if (maxKda === minKda) return (MIN_SIZE + MAX_SIZE) / 2;
    const t = (kda - minKda) / (maxKda - minKda);
    return MIN_SIZE + t * (MAX_SIZE - MIN_SIZE);
  };

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.champion_name.toLowerCase().includes(q))
      : rows;
    return [...filtered].sort((a, b) => b.kda - a.kda);
  }, [rows, filter]);

  if (champions.loading || meta.loading) {
    return <p className="muted">Loading…</p>;
  }
  if (champions.error || meta.error) {
    const err = champions.error ?? meta.error;
    return <p className="loss">Error: {err?.message ?? "unknown"}</p>;
  }
  if (rows.length === 0) {
    return <p className="muted">No champion data yet.</p>;
  }

  return (
    <>
      <h1>
        Champions · Visual{" "}
        <small className="muted" style={{ fontWeight: 400 }}>
          (<Link to="/champions">table view</Link>)
        </small>
      </h1>
      <p className="muted">
        Portraits scaled by KDA in the currently selected modes. Click any
        champion to drill in.
      </p>
      <TableFilter
        value={filter}
        onChange={setFilter}
        count={visible.length}
        placeholder="Filter champions…"
      />
      <div className="champion-grid">
        {visible.map((c) => {
          const px = sizeFor(c.kda);
          return (
            <Link
              key={c.champion_name}
              to={`/champions/${encodeURIComponent(c.champion_name)}`}
              className="champion-tile"
              title={`KDA ${fmt.kda(c.kills, c.deaths, c.assists)} · ${c.games} games · ${c.wins}-${c.losses}`}
            >
              {c.imageUrl ? (
                <img
                  src={c.imageUrl}
                  alt={c.champion_name}
                  style={{ width: `${px}px`, height: `${px}px` }}
                />
              ) : (
                <div
                  className="champion-placeholder"
                  style={{ width: `${px}px`, height: `${px}px` }}
                >
                  ?
                </div>
              )}
              <div className="champion-label">
                <div className="champion-name">{c.champion_name}</div>
                <div className="muted">
                  {fmt.kda(c.kills, c.deaths, c.assists)} · {c.games}g
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

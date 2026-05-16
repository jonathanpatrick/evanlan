import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type TrendPoint } from "../api.js";
import { gameModeLabel, kdaValue } from "../format.js";
import { useAsync } from "../hooks.js";
import { useSelectedModes } from "../mode-filter.js";

// Deterministic color per player by hashing the name into a palette.
const PALETTE = [
  "#c89b3c", // accent gold
  "#4cc38a", // win green
  "#f47174", // loss red
  "#58a6ff",
  "#d2a8ff",
  "#ff9580",
  "#a6e3a1",
  "#89b4fa",
  "#fab387",
  "#cba6f7",
  "#94e2d5",
  "#f9e2af",
];
function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

type Metric = "kda" | "winrate";

const METRICS: Record<
  Metric,
  { label: string; yLabel: string; format: (n: number) => string; domain?: [number, number] }
> = {
  kda: {
    label: "KDA (per game)",
    yLabel: "KDA",
    format: (n) => n.toFixed(2),
  },
  winrate: {
    label: "Win rate (cumulative)",
    yLabel: "Win %",
    format: (n) => `${n.toFixed(0)}%`,
    domain: [0, 100],
  },
};

type ChartRow = {
  game: string;
  matchId: string;
  modeLabel: string;
  [player: string]: number | string;
};

export function Trends() {
  const modes = useSelectedModes();
  const [limit, setLimit] = useState(10);
  const [metric, setMetric] = useState<Metric>("kda");
  const [visibleSet, setVisibleSet] = useState<Set<string> | null>(null);
  const { data, error, loading } = useAsync(
    () => api.trends(modes, limit),
    [modes, limit]
  );

  const { chartData, players } = useMemo(() => {
    const points: TrendPoint[] = data?.points ?? [];
    const matchOrder: string[] = [];
    const byMatch = new Map<string, ChartRow>();
    const playerSet = new Set<string>();
    // For win rate we accumulate per-player totals as we walk forwards
    // through the chronologically-sorted points.
    const totals = new Map<string, { wins: number; games: number }>();

    for (const p of points) {
      if (!byMatch.has(p.match_id)) {
        matchOrder.push(p.match_id);
        byMatch.set(p.match_id, {
          game: "",
          matchId: p.match_id,
          modeLabel: gameModeLabel(p.game_mode),
        });
      }
      const row = byMatch.get(p.match_id)!;
      const prev = totals.get(p.display_name) ?? { wins: 0, games: 0 };
      const next = {
        wins: prev.wins + (p.win === 1 ? 1 : 0),
        games: prev.games + 1,
      };
      totals.set(p.display_name, next);

      if (metric === "kda") {
        row[p.display_name] = kdaValue(p.kills, p.deaths, p.assists);
      } else {
        row[p.display_name] =
          next.games === 0 ? 0 : (next.wins / next.games) * 100;
      }
      playerSet.add(p.display_name);
    }

    const chartData = matchOrder.map((mid, i) => {
      const row = byMatch.get(mid)!;
      row.game = `#${i + 1}`;
      return row;
    });
    return { chartData, players: [...playerSet].sort() };
  }, [data, metric]);

  const visiblePlayers = useMemo(
    () => (visibleSet ? players.filter((p) => visibleSet.has(p)) : players),
    [players, visibleSet]
  );

  const togglePlayer = (name: string) => {
    setVisibleSet((cur) => {
      const next = new Set(cur ?? players);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const showAll = () => setVisibleSet(null);
  const hideAll = () => setVisibleSet(new Set());

  const m = METRICS[metric];

  return (
    <>
      <h1>Trends</h1>
      <p className="muted">
        Per-game performance across the most recent games for each LAN player.
        Respects the global mode filter; click a name below the chart to toggle
        it on/off.
      </p>

      <div className="trend-controls">
        <label>
          Metric
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as Metric)}
          >
            {(Object.entries(METRICS) as [Metric, typeof METRICS[Metric]][]).map(
              ([key, def]) => (
                <option key={key} value={key}>
                  {def.label}
                </option>
              )
            )}
          </select>
        </label>
        <label>
          Last
          <select
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10))}
          >
            {[5, 10, 20, 50].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          games
        </label>
        <button type="button" className="mode-button" onClick={showAll}>
          Show all
        </button>
        <button type="button" className="mode-button" onClick={hideAll}>
          Hide all
        </button>
      </div>

      {loading && <p className="muted">Loading…</p>}
      {error && <p className="loss">Error: {error.message}</p>}
      {!loading && chartData.length === 0 && (
        <p className="muted">No games match the current filter.</p>
      )}
      {chartData.length > 0 && (
        <>
          <div style={{ width: "100%", height: 420 }}>
            <ResponsiveContainer>
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 24, bottom: 10, left: 0 }}
              >
                <CartesianGrid stroke="#2d333b" strokeDasharray="3 3" />
                <XAxis dataKey="game" stroke="#7d8590" />
                <YAxis
                  stroke="#7d8590"
                  domain={m.domain ?? ["auto", "auto"]}
                  tickFormatter={(v: number) => m.format(v)}
                  label={{
                    value: m.yLabel,
                    angle: -90,
                    position: "insideLeft",
                    style: { fill: "#7d8590", fontSize: 12 },
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#161b22",
                    border: "1px solid #2d333b",
                    borderRadius: 6,
                  }}
                  labelFormatter={(label, payload) => {
                    const first = payload?.[0]?.payload as ChartRow | undefined;
                    return first
                      ? `${label} · ${first.modeLabel} · ${first.matchId}`
                      : label;
                  }}
                  formatter={(value: number, name: string) => [
                    m.format(value),
                    name,
                  ]}
                />
                {visiblePlayers.map((p) => (
                  <Line
                    key={p}
                    type="monotone"
                    dataKey={p}
                    stroke={colorFor(p)}
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls={false}
                    isAnimationActive={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="trend-legend">
            {players.map((p) => {
              const on = visibleSet ? visibleSet.has(p) : true;
              return (
                <button
                  key={p}
                  type="button"
                  className="trend-legend-item"
                  onClick={() => togglePlayer(p)}
                  style={{
                    borderColor: on ? colorFor(p) : "var(--border)",
                    color: on ? "var(--text)" : "var(--muted)",
                  }}
                >
                  <span
                    className="trend-swatch"
                    style={{ background: colorFor(p) }}
                  />
                  {p}
                </button>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { fmt } from "../format.js";
import { useAsync } from "../hooks.js";

export function Champion() {
  const { name = "" } = useParams();
  const { data, error, loading } = useAsync(() => api.champion(name), [name]);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="loss">Error: {error.message}</p>;
  if (!data) return null;

  const { summary, byPlayer } = data;

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
        <Stat label="KDA" value={fmt.kda(summary.kills, summary.deaths, summary.assists)} />
        <Stat label="Total damage" value={fmt.int(summary.damage_dealt)} />
        <Stat label="Total CS" value={fmt.int(summary.cs)} />
      </div>

      <h2>By player</h2>
      {byPlayer.length === 0 ? (
        <p className="muted">Nobody has played this champion yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th className="numeric">Games</th>
              <th className="numeric">W / L</th>
              <th className="numeric">Win %</th>
              <th className="numeric">KDA</th>
            </tr>
          </thead>
          <tbody>
            {byPlayer.map((p) => (
              <tr key={p.player_key}>
                <td>
                  <Link to={`/players/${encodeURIComponent(p.player_key.split("#")[0])}`}>
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
                <td className="numeric">{fmt.kda(p.kills, p.deaths, p.assists)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

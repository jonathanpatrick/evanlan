import { Link, useParams } from "react-router-dom";
import { api } from "../api.js";
import { fmt } from "../format.js";
import { useAsync } from "../hooks.js";

export function Player() {
  const { id = "" } = useParams();
  const { data, error, loading } = useAsync(() => api.player(id), [id]);

  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="loss">Error: {error.message}</p>;
  if (!data) return null;

  const { summary, byChampion } = data;

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
        <Stat label="KDA" value={fmt.kda(summary.kills, summary.deaths, summary.assists)} />
        <Stat label="Total damage" value={fmt.int(summary.damage_dealt)} />
        <Stat label="Total gold" value={fmt.int(summary.gold_earned)} />
        <Stat label="Total CS" value={fmt.int(summary.cs)} />
        <Stat label="Total vision" value={fmt.int(summary.vision_score)} />
      </div>

      <h2>By champion</h2>
      {byChampion.length === 0 ? (
        <p className="muted">No champions yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Champion</th>
              <th className="numeric">Games</th>
              <th className="numeric">W / L</th>
              <th className="numeric">Win %</th>
              <th className="numeric">KDA</th>
              <th className="numeric">DMG / game</th>
            </tr>
          </thead>
          <tbody>
            {byChampion.map((c) => (
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
                <td className="numeric">{fmt.kda(c.kills, c.deaths, c.assists)}</td>
                <td className="numeric">
                  {fmt.int(c.damage_dealt / Math.max(c.games, 1))}
                </td>
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

import { Link } from "react-router-dom";
import { api } from "../api.js";
import { fmt } from "../format.js";
import { useAsync } from "../hooks.js";

export function Champions() {
  const { data, error, loading } = useAsync(() => api.champions(), []);

  return (
    <>
      <h1>Champions</h1>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="loss">Error: {error.message}</p>}
      {data && data.champions.length === 0 && (
        <p className="muted">No champion data yet.</p>
      )}
      {data && data.champions.length > 0 && (
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
            {data.champions.map((c) => (
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

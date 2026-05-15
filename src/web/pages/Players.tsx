import { Link } from "react-router-dom";
import { api } from "../api.js";
import { fmt } from "../format.js";
import { useAsync } from "../hooks.js";

export function Players() {
  const { data, error, loading } = useAsync(() => api.players(), []);

  return (
    <>
      <h1>Players</h1>
      {loading && <p className="muted">Loading…</p>}
      {error && <p className="loss">Error: {error.message}</p>}
      {data && data.players.length === 0 && (
        <p className="muted">No players yet.</p>
      )}
      {data && data.players.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th className="numeric">Games</th>
              <th className="numeric">W / L</th>
              <th className="numeric">Win %</th>
              <th className="numeric">KDA</th>
              <th className="numeric">DMG / game</th>
            </tr>
          </thead>
          <tbody>
            {data.players.map((p) => (
              <tr key={p.player_key}>
                <td>
                  <Link to={`/players/${encodeURIComponent(p.puuid ?? p.display_name)}`}>
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
                <td className="numeric">{fmt.kda(p.kills, p.deaths, p.assists)}</td>
                <td className="numeric">
                  {fmt.int(p.damage_dealt / Math.max(p.games, 1))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

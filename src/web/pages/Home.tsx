import { Link } from "react-router-dom";
import { api } from "../api.js";
import { fmt } from "../format.js";
import { useAsync } from "../hooks.js";

export function Home() {
  const games = useAsync(() => api.games(), []);
  const players = useAsync(() => api.players(), []);
  const champions = useAsync(() => api.champions(), []);

  return (
    <>
      <h1>League Dashboard</h1>
      <p className="muted">
        Aggregate custom game stats. POST a game payload to
        <code> /games </code> with the <code>X-Ingest-Token</code> header.
      </p>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">Games ingested</div>
          <div className="value">{fmt.int(games.data?.games.length ?? 0)}</div>
        </div>
        <div className="stat-card">
          <div className="label">Players</div>
          <div className="value">
            {fmt.int(players.data?.players.length ?? 0)}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">Champions played</div>
          <div className="value">
            {fmt.int(champions.data?.champions.length ?? 0)}
          </div>
        </div>
      </div>

      <h2>Recent games</h2>
      {games.loading && <p className="muted">Loading…</p>}
      {games.error && <p className="loss">Error: {games.error.message}</p>}
      {games.data && games.data.games.length === 0 && (
        <p className="muted">No games yet. POST one to <code>/games</code>.</p>
      )}
      {games.data && games.data.games.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Match</th>
              <th>Played</th>
              <th>Duration</th>
              <th>Mode</th>
              <th>Patch</th>
            </tr>
          </thead>
          <tbody>
            {games.data.games.map((g) => (
              <tr key={g.match_id}>
                <td><Link to={`/games/${encodeURIComponent(g.match_id)}`}>{g.match_id}</Link></td>
                <td>{fmt.date(g.game_creation ?? g.ingested_at)}</td>
                <td>{fmt.duration(g.game_duration)}</td>
                <td>{g.game_mode ?? "—"}</td>
                <td>{g.game_version ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

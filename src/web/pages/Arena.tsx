import { Link } from "react-router-dom";
import { api } from "../api.js";
import { fmt } from "../format.js";
import { useAsync } from "../hooks.js";

export function Arena() {
  const games = useAsync(() => api.arena.games(), []);
  const players = useAsync(() => api.arena.players(), []);
  const champions = useAsync(() => api.arena.champions(), []);

  return (
    <>
      <h1>Arena</h1>
      <p className="muted">
        Arena (2v2v2v2) games are separated out because the live-client API
        groups all 18 players onto one team and doesn't expose Arena placement,
        so win/loss numbers below should be treated as unreliable until we
        parse the Arena-specific fields.
      </p>

      <h2>Recent games</h2>
      {games.loading && <p className="muted">Loading…</p>}
      {games.data && games.data.games.length === 0 && (
        <p className="muted">No Arena games yet.</p>
      )}
      {games.data && games.data.games.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Match</th>
              <th>Played</th>
              <th>Duration</th>
            </tr>
          </thead>
          <tbody>
            {games.data.games.map((g) => (
              <tr key={g.match_id}>
                <td>
                  <Link to={`/matches/${encodeURIComponent(g.match_id)}`}>
                    {g.match_id}
                  </Link>
                </td>
                <td>{fmt.date(g.game_creation ?? g.ingested_at)}</td>
                <td>{fmt.duration(g.game_duration)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: "2rem" }}>Players (Arena only)</h2>
      {players.data && players.data.players.length === 0 && (
        <p className="muted">No Arena player data yet.</p>
      )}
      {players.data && players.data.players.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th className="numeric">Games</th>
              <th className="numeric">KDA</th>
            </tr>
          </thead>
          <tbody>
            {players.data.players.map((p) => (
              <tr key={p.player_key}>
                <td>{p.display_name}</td>
                <td className="numeric">{fmt.int(p.games)}</td>
                <td className="numeric">{fmt.kda(p.kills, p.deaths, p.assists)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 style={{ marginTop: "2rem" }}>Champions (Arena only)</h2>
      {champions.data && champions.data.champions.length === 0 && (
        <p className="muted">No Arena champion data yet.</p>
      )}
      {champions.data && champions.data.champions.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>Champion</th>
              <th className="numeric">Games</th>
              <th className="numeric">KDA</th>
            </tr>
          </thead>
          <tbody>
            {champions.data.champions.map((c) => (
              <tr key={c.champion_name}>
                <td>{c.champion_name}</td>
                <td className="numeric">{fmt.int(c.games)}</td>
                <td className="numeric">{fmt.kda(c.kills, c.deaths, c.assists)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

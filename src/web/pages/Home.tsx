import { Link } from "react-router-dom";
import { api, type ChampionSummary, type PlayerSummary } from "../api.js";
import { KDA_TOOLTIP } from "../components.js";
import { fmt } from "../format.js";
import { useAsync } from "../hooks.js";

// Floor for "ranked" lists. One 100%-WR game would otherwise dominate; with a
// small friend group two games is a reasonable signal floor.
const MIN_GAMES = 2;

export function Home() {
  const players = useAsync(() => api.players(), []);
  const champions = useAsync(() => api.champions(), []);

  const topPlayers = rankByWinRate(players.data?.players ?? []);
  const topChampions = rankByWinRate(champions.data?.champions ?? []);

  return (
    <>
      <h1>Biggest Peepees</h1>
      <div className="card-grid">
        <section className="card">
          <h2>Top 5 Players · Win Rate</h2>
          <p className="muted card-subtitle">Minimum {MIN_GAMES} games</p>
          {players.loading && <p className="muted">Loading…</p>}
          {players.error && (
            <p className="loss">Error: {players.error.message}</p>
          )}
          {players.data && topPlayers.length === 0 && (
            <p className="muted">Not enough games yet.</p>
          )}
          {topPlayers.length > 0 && <PlayerTable rows={topPlayers} />}
        </section>

        <section className="card">
          <h2>Top 5 Champions · Win Rate</h2>
          <p className="muted card-subtitle">Minimum {MIN_GAMES} games</p>
          {champions.loading && <p className="muted">Loading…</p>}
          {champions.error && (
            <p className="loss">Error: {champions.error.message}</p>
          )}
          {champions.data && topChampions.length === 0 && (
            <p className="muted">Not enough games yet.</p>
          )}
          {topChampions.length > 0 && <ChampionTable rows={topChampions} />}
        </section>
      </div>
    </>
  );
}

function rankByWinRate<T extends { games: number; wins: number }>(rows: T[]): T[] {
  return rows
    .filter((r) => r.games >= MIN_GAMES)
    .slice()
    .sort((a, b) => {
      const wa = a.wins / a.games;
      const wb = b.wins / b.games;
      if (wa !== wb) return wb - wa;
      return b.games - a.games;
    })
    .slice(0, 5);
}

function PlayerTable({ rows }: { rows: PlayerSummary[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Player</th>
          <th className="numeric">Win %</th>
          <th className="numeric">W / L</th>
          <th className="numeric" title={KDA_TOOLTIP}>KDA</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((p) => (
          <tr key={p.player_key}>
            <td>
              <Link
                to={`/players/${encodeURIComponent(p.puuid ?? p.display_name)}`}
              >
                {p.display_name}
              </Link>
            </td>
            <td className="numeric">{fmt.pct(p.wins, p.games)}</td>
            <td className="numeric">
              <span className="win">{fmt.int(p.wins)}</span>
              {" / "}
              <span className="loss">{fmt.int(p.losses)}</span>
            </td>
            <td className="numeric" title={KDA_TOOLTIP}>{fmt.kda(p.kills, p.deaths, p.assists)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ChampionTable({ rows }: { rows: ChampionSummary[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Champion</th>
          <th className="numeric">Win %</th>
          <th className="numeric">W / L</th>
          <th className="numeric" title={KDA_TOOLTIP}>KDA</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((c) => (
          <tr key={c.champion_name}>
            <td>
              <Link to={`/champions/${encodeURIComponent(c.champion_name)}`}>
                {c.champion_name}
              </Link>
            </td>
            <td className="numeric">{fmt.pct(c.wins, c.games)}</td>
            <td className="numeric">
              <span className="win">{fmt.int(c.wins)}</span>
              {" / "}
              <span className="loss">{fmt.int(c.losses)}</span>
            </td>
            <td className="numeric" title={KDA_TOOLTIP}>{fmt.kda(c.kills, c.deaths, c.assists)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

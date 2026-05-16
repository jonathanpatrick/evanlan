import { useMemo } from "react";
import { Link } from "react-router-dom";
import { api, type PlayerSummary, type SynergyPair } from "../api.js";
import { fmt } from "../format.js";
import { useAsync } from "../hooks.js";
import { useSelectedModes } from "../mode-filter.js";

// Minimum games together / against before we show a win-rate percentage in
// the leaderboards. With 1 game the rate is always 0% or 100% and not very
// useful as a signal.
const MIN_PAIR_GAMES = 2;

type PairLookup = Map<
  string,
  { together: { games: number; wins: number }; versus: { games: number; wins_a: number; player_a: string } }
>;

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function Synergy() {
  const modes = useSelectedModes();
  const players = useAsync(() => api.players(modes), [modes]);
  const synergy = useAsync(() => api.synergy(modes), [modes]);

  const playerList = useMemo<PlayerSummary[]>(
    () =>
      (players.data?.players ?? []).slice().sort((a, b) =>
        a.display_name.localeCompare(b.display_name)
      ),
    [players.data]
  );

  // Build a lookup keyed by sorted pair so cell lookups are O(1).
  const lookup = useMemo<PairLookup>(() => {
    const m: PairLookup = new Map();
    for (const p of synergy.data?.pairs ?? []) {
      m.set(pairKey(p.player_a, p.player_b), {
        together: { games: p.games_together, wins: p.wins_together },
        versus: {
          games: p.games_versus,
          wins_a: p.wins_a_versus_b,
          player_a: p.player_a,
        },
      });
    }
    return m;
  }, [synergy.data]);

  const bestPartnerships = useMemo(
    () =>
      (synergy.data?.pairs ?? [])
        .filter((p) => p.games_together >= MIN_PAIR_GAMES)
        .slice()
        .sort((a, b) => {
          const wa = a.wins_together / a.games_together;
          const wb = b.wins_together / b.games_together;
          if (wa !== wb) return wb - wa;
          return b.games_together - a.games_together;
        })
        .slice(0, 8),
    [synergy.data]
  );

  const biggestRivalries = useMemo(
    () =>
      (synergy.data?.pairs ?? [])
        .filter((p) => p.games_versus >= MIN_PAIR_GAMES)
        .slice()
        .sort((a, b) => b.games_versus - a.games_versus)
        .slice(0, 8),
    [synergy.data]
  );

  if (players.loading || synergy.loading) {
    return <p className="muted">Loading…</p>;
  }
  if (players.error || synergy.error) {
    return <p className="loss">Error: {(players.error ?? synergy.error)!.message}</p>;
  }
  if (playerList.length === 0) {
    return <p className="muted">No player data for the current mode filter.</p>;
  }

  return (
    <>
      <h1>Synergy</h1>
      <p className="muted">
        How each LAN pair performs when teamed up versus when on opposite
        teams. Respects the global mode filter. Heads-up: Arena (CHERRY) puts
        everyone on team 100 in the live-client data, so deselect it for a
        clean SR/ARAM read.
      </p>

      <h2>Matrix</h2>
      <p className="muted card-subtitle">
        Each cell shows that pair's <strong>together</strong> record (top) and{" "}
        <strong>row-vs-column</strong> record (bottom). Color is the
        together win rate.
      </p>
      <div className="synergy-scroll">
        <table className="synergy-matrix">
          <thead>
            <tr>
              <th></th>
              {playerList.map((p) => (
                <th key={p.player_key} className="synergy-corner">
                  {p.display_name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {playerList.map((row) => (
              <tr key={row.player_key}>
                <th className="synergy-corner">{row.display_name}</th>
                {playerList.map((col) => {
                  if (row.player_key === col.player_key) {
                    return (
                      <td key={col.player_key} className="synergy-diagonal">
                        —
                      </td>
                    );
                  }
                  const entry = lookup.get(pairKey(row.player_key, col.player_key));
                  if (!entry) {
                    return (
                      <td key={col.player_key} className="synergy-cell synergy-empty">
                        <span className="muted">—</span>
                      </td>
                    );
                  }
                  const t = entry.together;
                  const v = entry.versus;
                  // "wins_a_versus_b" is from player_a's perspective. Flip
                  // when the current row is player_b.
                  const rowIsA = row.player_key === v.player_a;
                  const rowWinsVs = rowIsA ? v.wins_a : v.games - v.wins_a;
                  const rowLossesVs = v.games - rowWinsVs;
                  const togetherRate = t.games > 0 ? t.wins / t.games : null;
                  return (
                    <td
                      key={col.player_key}
                      className="synergy-cell"
                      style={{ background: cellColor(togetherRate, t.games) }}
                      title={
                        `Together: ${t.wins}-${t.games - t.wins} (${
                          t.games === 0 ? "—" : fmt.pct(t.wins, t.games)
                        })\n` +
                        `${row.display_name} vs ${col.display_name}: ${rowWinsVs}-${rowLossesVs}`
                      }
                    >
                      <div className="synergy-line synergy-together">
                        <span className="win">{t.wins}</span>-
                        <span className="loss">{t.games - t.wins}</span>
                      </div>
                      <div className="synergy-line synergy-versus muted">
                        vs <span className="win">{rowWinsVs}</span>-
                        <span className="loss">{rowLossesVs}</span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card-grid" style={{ marginTop: "1.5rem" }}>
        <BestPartnershipsCard rows={bestPartnerships} />
        <BiggestRivalriesCard rows={biggestRivalries} />
      </div>
    </>
  );
}

// Color goes from muted-red (poor together win rate) → neutral → muted-green
// (great together win rate). Cells with few games stay near neutral so a
// single 1-0 doesn't paint the matrix.
function cellColor(rate: number | null, games: number): string {
  if (rate === null || games === 0) return "transparent";
  // Pull rates toward 0.5 when sample size is small.
  const confidence = Math.min(games / 4, 1);
  const adjusted = 0.5 + (rate - 0.5) * confidence;
  if (adjusted > 0.5) {
    const t = (adjusted - 0.5) / 0.5;
    return `rgba(76, 195, 138, ${0.08 + t * 0.22})`; // green
  } else {
    const t = (0.5 - adjusted) / 0.5;
    return `rgba(244, 113, 116, ${0.08 + t * 0.22})`; // red
  }
}

function BestPartnershipsCard({ rows }: { rows: SynergyPair[] }) {
  return (
    <section className="card">
      <h2>Best partnerships</h2>
      <p className="muted card-subtitle">
        Sorted by win rate when teamed. Min {MIN_PAIR_GAMES} games together.
      </p>
      {rows.length === 0 ? (
        <p className="muted">No pairs meet the floor yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Duo</th>
              <th className="numeric">Together</th>
              <th className="numeric">Win %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.player_a + p.player_b}>
                <td>
                  <Link to={`/players/${encodeURIComponent(p.display_a)}`}>
                    {p.display_a}
                  </Link>
                  {" + "}
                  <Link to={`/players/${encodeURIComponent(p.display_b)}`}>
                    {p.display_b}
                  </Link>
                </td>
                <td className="numeric">
                  <span className="win">{fmt.int(p.wins_together)}</span>
                  {" - "}
                  <span className="loss">{fmt.int(p.games_together - p.wins_together)}</span>
                </td>
                <td className="numeric">
                  {fmt.pct(p.wins_together, p.games_together)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function BiggestRivalriesCard({ rows }: { rows: SynergyPair[] }) {
  return (
    <section className="card">
      <h2>Heaviest rivalries</h2>
      <p className="muted card-subtitle">
        Most games on opposite teams. Min {MIN_PAIR_GAMES} games versus.
      </p>
      {rows.length === 0 ? (
        <p className="muted">No rivalries with enough games yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Pair</th>
              <th className="numeric">Versus games</th>
              <th className="numeric">A's W/L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.player_a + p.player_b}>
                <td>
                  <Link to={`/players/${encodeURIComponent(p.display_a)}`}>
                    {p.display_a}
                  </Link>
                  {" vs "}
                  <Link to={`/players/${encodeURIComponent(p.display_b)}`}>
                    {p.display_b}
                  </Link>
                </td>
                <td className="numeric">{fmt.int(p.games_versus)}</td>
                <td className="numeric">
                  <span className="win">{fmt.int(p.wins_a_versus_b)}</span>
                  {" - "}
                  <span className="loss">{fmt.int(p.games_versus - p.wins_a_versus_b)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

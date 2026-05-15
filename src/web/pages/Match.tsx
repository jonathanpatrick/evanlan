import { Fragment } from "react";
import { Link, useParams } from "react-router-dom";
import {
  api,
  type MatchParticipant,
  type RawLiveEvent,
  type RawLivePayload,
  type RawLivePlayer,
} from "../api.js";
import { KDA_TOOLTIP } from "../components.js";
import { fmt, gameModeLabel } from "../format.js";
import { useAsync } from "../hooks.js";

export function Match() {
  const { id = "" } = useParams();
  const normalized = useAsync(() => api.match(id), [id]);
  // Raw is optional — render the page even if it 404s.
  const raw = useAsync(
    () => api.matchRaw(id).catch(() => null as RawLivePayload | null),
    [id]
  );

  if (normalized.loading) return <p className="muted">Loading…</p>;
  if (normalized.error)
    return <p className="loss">Error: {normalized.error.message}</p>;
  if (!normalized.data) return null;

  const { game, participants } = normalized.data;
  const teams = new Map<number, MatchParticipant[]>();
  for (const p of participants) {
    const key = p.team_id ?? 0;
    if (!teams.has(key)) teams.set(key, []);
    teams.get(key)!.push(p);
  }
  const teamEntries = [...teams.entries()].sort(([a], [b]) => a - b);

  const rawPlayers = raw.data?.allPlayers ?? [];
  const findRaw = (p: MatchParticipant): RawLivePlayer | undefined =>
    rawPlayers.find(
      (rp) =>
        (p.riot_id_game_name && rp.riotIdGameName === p.riot_id_game_name) ||
        (p.summoner_name && rp.summonerName === p.summoner_name)
    );

  const events = raw.data?.events?.Events ?? [];

  return (
    <>
      <h1>{game.match_id}</h1>
      <p className="muted">
        <strong>{gameModeLabel(game.game_mode)}</strong> ·{" "}
        {fmt.duration(game.game_duration)} ·{" "}
        {fmt.date(game.game_creation ?? game.ingested_at)}
      </p>

      {teamEntries.map(([teamId, members]) => {
        const teamWin = members[0]?.win === 1;
        const label =
          teamId === 100
            ? "Blue (Order)"
            : teamId === 200
            ? "Red (Chaos)"
            : `Team ${teamId}`;
        return (
          <section key={teamId} style={{ marginBottom: "1.5rem" }}>
            <h2>
              {label}{" "}
              <span className={teamWin ? "win" : "loss"}>
                {teamWin ? "— Victory" : "— Defeat"}
              </span>
            </h2>
            <table>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Champion</th>
                  <th className="numeric">Lvl</th>
                  <th className="numeric" title={KDA_TOOLTIP}>K / D / A</th>
                  <th className="numeric">CS</th>
                  <th className="numeric">Vision</th>
                </tr>
              </thead>
              <tbody>
                {members.map((p) => {
                  const playerKey =
                    p.puuid ?? p.riot_id_game_name ?? p.summoner_name ?? "?";
                  const display =
                    p.riot_id_game_name ?? p.summoner_name ?? p.puuid ?? "?";
                  const rp = findRaw(p);
                  return (
                    <Fragment key={playerKey + (p.champion_name ?? "")}>
                      <tr>
                        <td>
                          <Link to={`/players/${encodeURIComponent(playerKey)}`}>
                            {display}
                          </Link>
                          {p.riot_id_tagline && (
                            <span className="muted"> #{p.riot_id_tagline}</span>
                          )}
                        </td>
                        <td>
                          {p.champion_name ? (
                            <Link
                              to={`/champions/${encodeURIComponent(p.champion_name)}`}
                            >
                              {p.champion_name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="numeric">{rp?.level ?? "—"}</td>
                        <td className="numeric" title={KDA_TOOLTIP}>
                          {fmt.kda(p.kills, p.deaths, p.assists)}
                        </td>
                        <td className="numeric">
                          {fmt.int(
                            p.total_minions_killed + p.neutral_minions_killed
                          )}
                        </td>
                        <td className="numeric">{fmt.int(p.vision_score)}</td>
                      </tr>
                      {rp && (
                        <tr className="detail-row">
                          <td colSpan={6} className="detail-cell">
                            <PlayerBuild raw={rp} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </section>
        );
      })}

      {events.length > 0 && (
        <section>
          <h2>Event timeline</h2>
          <EventTimeline events={events} />
        </section>
      )}
    </>
  );
}

function PlayerBuild({ raw }: { raw: RawLivePlayer }) {
  const items = (raw.items ?? []).slice().sort((a, b) => a.slot - b.slot);
  const ss = raw.summonerSpells;
  const spells = [
    ss?.summonerSpellOne?.displayName,
    ss?.summonerSpellTwo?.displayName,
  ].filter(Boolean);

  return (
    <div className="build-info">
      {spells.length > 0 && (
        <span className="build-section">
          <span className="build-label">Spells:</span>{" "}
          {spells.join(" + ")}
        </span>
      )}
      {items.length > 0 ? (
        <span className="build-section">
          <span className="build-label">Build:</span>{" "}
          {items.map((it, i) => (
            <span key={i} className="item-pill" title={`ID ${it.itemID}`}>
              {it.displayName}
              {it.count > 1 ? ` x${it.count}` : ""}
            </span>
          ))}
        </span>
      ) : (
        <span className="muted">no items</span>
      )}
    </div>
  );
}

// Filter the live-client event stream to events worth showing in the UI.
// MinionsSpawning / InhibRespawned / level-up noise is dropped.
const SHOWN_EVENTS = new Set([
  "FirstBlood",
  "ChampionKill",
  "Multikill",
  "Ace",
  "DragonKill",
  "BaronKill",
  "HeraldKill",
  "AtakhanKill",
  "VoidGrubKill",
  "TurretKilled",
  "InhibKilled",
  "GameEnd",
]);

function EventTimeline({ events }: { events: RawLiveEvent[] }) {
  const items = events
    .filter((e) => SHOWN_EVENTS.has(e.EventName))
    .map((e) => ({ time: e.EventTime, text: formatEvent(e), type: e.EventName }))
    .filter((e): e is { time: number; text: string; type: string } => !!e.text)
    .sort((a, b) => a.time - b.time);

  if (items.length === 0) {
    return <p className="muted">No events recorded.</p>;
  }

  return (
    <ul className="events-timeline">
      {items.map((e, i) => (
        <li key={i} className={`event event-${e.type}`}>
          <span className="event-time">{eventTime(e.time)}</span>
          <span className="event-text">{e.text}</span>
        </li>
      ))}
    </ul>
  );
}

function eventTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function structureName(raw: string | undefined): string {
  if (!raw) return "structure";
  // Turret_TChaos_L1_P3_... → "Chaos turret (lane 1, pos 3)"
  const m = raw.match(/^(Turret|Inhib)_T(Order|Chaos|1|2)_(L\d+)_(P\d+)/);
  if (!m) return raw;
  const [, kind, side] = m;
  const sideName = side === "Order" || side === "1" ? "Order" : "Chaos";
  return `${sideName} ${kind === "Turret" ? "turret" : "inhibitor"}`;
}

function formatEvent(e: RawLiveEvent): string | null {
  const k = e.KillerName ?? "?";
  switch (e.EventName) {
    case "FirstBlood":
      return `First Blood — ${e.Recipient ?? "?"}`;
    case "ChampionKill": {
      const a = e.Assisters?.length
        ? ` (assists: ${e.Assisters.join(", ")})`
        : "";
      return `${k} killed ${e.VictimName ?? "?"}${a}`;
    }
    case "Multikill":
      return `${k} multikill x${e.KillStreak ?? "?"}`;
    case "Ace":
      return `${e.Acer ?? "?"}'s team aced the enemy`;
    case "DragonKill":
      return `${k} killed ${e.DragonType ?? "Dragon"}${
        e.Stolen === "True" ? " (STOLEN)" : ""
      }`;
    case "BaronKill":
      return `${k} killed Baron Nashor${e.Stolen === "True" ? " (STOLEN)" : ""}`;
    case "HeraldKill":
      return `${k} killed Rift Herald`;
    case "AtakhanKill":
      return `${k} killed Atakhan`;
    case "VoidGrubKill":
      return `${k} killed a Voidgrub`;
    case "TurretKilled":
      return `${k} destroyed ${structureName(e.TurretKilled)}`;
    case "InhibKilled":
      return `${k} destroyed ${structureName(e.InhibKilled)}`;
    case "GameEnd":
      return `Game ended (${e.Result ?? "?"})`;
    default:
      return null;
  }
}

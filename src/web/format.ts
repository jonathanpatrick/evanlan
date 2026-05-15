// Maps Riot's internal mode codes to human-readable labels. Riot ships
// codenames (CLASSIC, CHERRY, KIWI, etc.); the dashboard should never show
// these raw. Add new entries as we observe them.
export function gameModeLabel(code: string | null | undefined): string {
  if (!code) return "Unknown";
  switch (code.toUpperCase()) {
    case "CLASSIC":      return "Summoner's Rift";
    case "ARAM":         return "ARAM";
    case "KIWI":         return "ARAM Mayhem"; // confirmed by Howling Abyss + user
    case "CHERRY":       return "Arena";
    case "URF":          return "URF";
    case "ARURF":        return "ARURF";
    case "ONEFORALL":    return "One For All";
    case "NEXUSBLITZ":   return "Nexus Blitz";
    case "PRACTICETOOL": return "Practice Tool";
    case "TUTORIAL":     return "Tutorial";
    case "BRAWL":        return "Brawl";
    default:             return code;
  }
}

// Numeric KDA used for sorting. Mirrors the convention League uses where
// 0 deaths is treated as "perfect" (returns k+a directly).
export function kdaValue(kills: number, deaths: number, assists: number): number {
  if (deaths === 0) return kills + assists;
  return (kills + assists) / deaths;
}

export const fmt = {
  int: (n: number | null | undefined) =>
    n == null ? "—" : Math.round(n).toLocaleString(),
  pct: (numerator: number, denominator: number) =>
    denominator === 0 ? "—" : `${((numerator / denominator) * 100).toFixed(1)}%`,
  ratio: (numerator: number, denominator: number, digits = 2) =>
    denominator === 0
      ? numerator === 0
        ? "0"
        : "∞"
      : (numerator / denominator).toFixed(digits),
  kda: (k: number, d: number, a: number) =>
    `${fmt.int(k)} / ${fmt.int(d)} / ${fmt.int(a)} (${fmt.ratio(k + a, d, 2)})`,
  date: (ms: number | null | undefined) =>
    ms == null ? "—" : new Date(ms).toLocaleString(),
  duration: (s: number | null | undefined) => {
    if (s == null) return "—";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  },
};

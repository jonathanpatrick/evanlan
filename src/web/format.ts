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

// Parse a "?modes=A,B,C" query string into an array of mode codes.
// Empty string / undefined → undefined (no filter). Caller-side semantics:
// undefined or empty array means "all modes".
export function parseModes(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  const parts = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length > 0 ? parts : undefined;
}

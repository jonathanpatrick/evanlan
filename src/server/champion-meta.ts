import { db } from "./db.js";

// Riot's Data Dragon CDN is the canonical source for champion images. We
// fetch the latest version + champion list once and cache the (name →
// filename, version) tuple in the champion_meta table so subsequent
// requests don't hit Riot.

const VERSIONS_URL =
  "https://ddragon.leagueoflegends.com/api/versions.json";
const CHAMPIONS_URL = (version: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/data/en_US/champion.json`;
const PORTRAIT_URL = (version: string, filename: string) =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/champion/${filename}`;

export type ChampionMeta = {
  name: string;
  imageUrl: string;
};

type Row = { name: string; image_filename: string; version: string };

const selectAllStmt = db.prepare<[], Row>(
  `SELECT name, image_filename, version FROM champion_meta`
);
const upsertStmt = db.prepare(`
  INSERT INTO champion_meta (name, image_filename, version, updated_at)
  VALUES (@name, @filename, @version, @updatedAt)
  ON CONFLICT(name) DO UPDATE SET
    image_filename = excluded.image_filename,
    version = excluded.version,
    updated_at = excluded.updated_at
`);

const upsertMany = db.transaction(
  (entries: { name: string; filename: string }[], version: string) => {
    const updatedAt = Date.now();
    for (const e of entries) {
      upsertStmt.run({ ...e, version, updatedAt });
    }
  }
);

async function fetchFromDDragon(): Promise<string> {
  const versionsRes = await fetch(VERSIONS_URL);
  if (!versionsRes.ok)
    throw new Error(`DDragon versions: HTTP ${versionsRes.status}`);
  const versions = (await versionsRes.json()) as string[];
  const version = versions[0];

  const champsRes = await fetch(CHAMPIONS_URL(version));
  if (!champsRes.ok)
    throw new Error(`DDragon champion.json: HTTP ${champsRes.status}`);
  const data = (await champsRes.json()) as {
    data: Record<string, { name: string; image: { full: string } }>;
  };

  const entries = Object.values(data.data).map((c) => ({
    name: c.name,
    filename: c.image.full,
  }));
  upsertMany(entries, version);
  return version;
}

// Returns the full set of champion meta. If the DB is empty (or empty for
// the latest version), fetches from DDragon. Subsequent calls are served
// straight from SQLite.
export async function getChampionMeta(): Promise<{
  version: string | null;
  champions: ChampionMeta[];
}> {
  let rows = selectAllStmt.all();
  if (rows.length === 0) {
    await fetchFromDDragon();
    rows = selectAllStmt.all();
  }
  const version = rows[0]?.version ?? null;
  return {
    version,
    champions: rows.map((r) => ({
      name: r.name,
      imageUrl: PORTRAIT_URL(r.version, r.image_filename),
    })),
  };
}

export async function refreshChampionMeta(): Promise<string> {
  return fetchFromDDragon();
}

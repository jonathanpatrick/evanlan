import { resolve } from "node:path";

export const env = {
  port: parseInt(process.env.PORT ?? "8080", 10),
  databasePath: resolve(process.env.DATABASE_PATH ?? "./data/league.db"),
  ingestToken: process.env.INGEST_TOKEN ?? "",
  webDist: resolve(process.env.WEB_DIST ?? "./dist/web"),
};

if (!env.ingestToken) {
  console.warn(
    "[env] INGEST_TOKEN is empty — POST /games will reject every request. Set one in .env before ingesting."
  );
}

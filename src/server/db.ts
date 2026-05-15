import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";

const here = dirname(fileURLToPath(import.meta.url));
// schema.sql sits next to this file in src/ during dev (tsx) and in dist/ after build.
const schemaPath = resolve(here, "schema.sql");

mkdirSync(dirname(env.databasePath), { recursive: true });

export const db = new Database(env.databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(readFileSync(schemaPath, "utf8"));

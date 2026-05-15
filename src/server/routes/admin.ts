import type { FastifyInstance } from "fastify";
import { db } from "../db.js";
import { env } from "../env.js";
import { ingestGame } from "../ingest.js";

type RawRow = { id: number; body_json: string };

export async function adminRoutes(app: FastifyInstance) {
  // Re-runs the current parser over every raw_payloads row whose parse_status
  // is 'error'. On success the old error row is deleted and ingestGame()
  // creates a fresh row (with the now-parseable match_id). Use this after
  // updating the parser to backfill previously-failed payloads.
  app.post("/admin/reparse", async (req, reply) => {
    const provided = req.headers["x-ingest-token"];
    if (!env.ingestToken || provided !== env.ingestToken) {
      return reply.code(401).send({ error: "missing or invalid ingest token" });
    }

    const errored = db
      .prepare(`SELECT id, body_json FROM raw_payloads WHERE parse_status = 'error'`)
      .all() as RawRow[];

    const deleteErrored = db.prepare(`DELETE FROM raw_payloads WHERE id = ?`);

    const results = {
      attempted: errored.length,
      recovered: 0,
      stillErrored: [] as { id: number; error: string }[],
    };

    for (const row of errored) {
      let body: unknown;
      try {
        body = JSON.parse(row.body_json);
      } catch (err) {
        results.stillErrored.push({
          id: row.id,
          error: `body_json not valid JSON: ${(err as Error).message}`,
        });
        continue;
      }
      deleteErrored.run(row.id);
      const r = ingestGame(body);
      if (r.parsed) {
        results.recovered++;
      } else {
        results.stillErrored.push({ id: row.id, error: r.error ?? "unknown" });
      }
    }

    return results;
  });
}

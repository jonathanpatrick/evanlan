import type { FastifyInstance } from "fastify";
import { env } from "../env.js";
import { ingestGame } from "../ingest.js";

export async function ingestRoutes(app: FastifyInstance) {
  app.post("/games", async (req, reply) => {
    const provided = req.headers["x-ingest-token"];
    if (!env.ingestToken || provided !== env.ingestToken) {
      return reply.code(401).send({ error: "missing or invalid ingest token" });
    }

    const result = ingestGame(req.body);
    if (!result.parsed) {
      req.log.warn({ rawId: result.rawId, error: result.error }, "ingest stored but parse failed");
    }
    // 201 when normalized into games/participants, 202 when the raw was
    // accepted but the parser couldn't make sense of it yet.
    return reply.code(result.parsed ? 201 : 202).send({ ok: true, ...result });
  });
}

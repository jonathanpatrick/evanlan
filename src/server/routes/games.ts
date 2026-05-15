import type { FastifyInstance } from "fastify";
import { getMatch, getMatchRaw, listRecentGames } from "../queries.js";

export async function gameRoutes(app: FastifyInstance) {
  app.get("/api/games", async () => {
    return { games: listRecentGames() };
  });

  app.get<{ Params: { id: string } }>("/api/games/:id", async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    const match = getMatch(id);
    if (!match) return reply.code(404).send({ error: "match not found" });
    return match;
  });

  // Raw original payload for the match page to render extra detail.
  app.get<{ Params: { id: string } }>(
    "/api/games/:id/raw",
    async (req, reply) => {
      const id = decodeURIComponent(req.params.id);
      const raw = getMatchRaw(id);
      if (!raw) return reply.code(404).send({ error: "raw payload not found" });
      return raw;
    }
  );
}

import type { FastifyInstance } from "fastify";
import {
  getMatch,
  getMatchRaw,
  listAvailableModes,
  listRecentGames,
} from "../queries.js";
import { parseModes } from "./util.js";

export async function gameRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { modes?: string } }>("/api/games", async (req) => {
    return { games: listRecentGames(50, parseModes(req.query.modes)) };
  });

  app.get<{ Params: { id: string } }>("/api/games/:id", async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    const match = getMatch(id);
    if (!match) return reply.code(404).send({ error: "match not found" });
    return match;
  });

  app.get<{ Params: { id: string } }>(
    "/api/games/:id/raw",
    async (req, reply) => {
      const id = decodeURIComponent(req.params.id);
      const raw = getMatchRaw(id);
      if (!raw) return reply.code(404).send({ error: "raw payload not found" });
      return raw;
    }
  );

  // Distinct gameMode codes seen across the ingested games. Drives the global
  // mode-filter checkboxes in the UI; the UI maps these to friendly labels.
  app.get("/api/modes", async () => {
    return { modes: listAvailableModes() };
  });
}

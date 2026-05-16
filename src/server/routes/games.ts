import type { FastifyInstance } from "fastify";
import { getChampionMeta, refreshChampionMeta } from "../champion-meta.js";
import { env } from "../env.js";
import {
  getMatch,
  getMatchRaw,
  getSynergyMatrix,
  getTrends,
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

  // Per-game stats for the most recent N games, restricted to LAN players.
  // Drives the Trends line chart.
  app.get<{ Querystring: { modes?: string; limit?: string } }>(
    "/api/trends",
    async (req) => {
      const modes = parseModes(req.query.modes);
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 20;
      return { points: getTrends(modes, isNaN(limit) ? 20 : limit) };
    }
  );

  // Pairwise synergy + rivalry stats for every LAN player pair.
  app.get<{ Querystring: { modes?: string } }>(
    "/api/synergy",
    async (req) => {
      return { pairs: getSynergyMatrix(parseModes(req.query.modes)) };
    }
  );

  // Champion portrait metadata (name + imageUrl). Cached in the DB; first
  // call fetches from Riot's Data Dragon and persists.
  app.get("/api/champion-meta", async (req, reply) => {
    try {
      return await getChampionMeta();
    } catch (err) {
      req.log.error({ err }, "champion-meta fetch failed");
      return reply
        .code(503)
        .send({ error: "could not fetch champion metadata" });
    }
  });

  // Manual refresh endpoint (token-protected) — useful after a new patch.
  app.post("/admin/refresh-champion-meta", async (req, reply) => {
    const provided = req.headers["x-ingest-token"];
    if (!env.ingestToken || provided !== env.ingestToken) {
      return reply.code(401).send({ error: "missing or invalid ingest token" });
    }
    try {
      const version = await refreshChampionMeta();
      return { ok: true, version };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(502).send({ error: message });
    }
  });
}

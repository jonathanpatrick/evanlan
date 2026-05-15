import type { FastifyInstance } from "fastify";
import {
  getPlayerByChampion,
  getPlayerSummary,
  listPlayers,
} from "../queries.js";

export async function playerRoutes(app: FastifyInstance) {
  app.get("/api/players", async () => {
    return { players: listPlayers() };
  });

  app.get<{ Params: { id: string } }>("/api/players/:id", async (req, reply) => {
    const id = decodeURIComponent(req.params.id);
    const summary = getPlayerSummary(id);
    if (!summary) {
      return reply.code(404).send({ error: "player not found" });
    }
    return {
      summary,
      byChampion: getPlayerByChampion(id),
    };
  });
}

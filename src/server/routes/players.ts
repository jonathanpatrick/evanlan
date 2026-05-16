import type { FastifyInstance } from "fastify";
import {
  getPlayerByChampion,
  getPlayerSummary,
  listPlayers,
} from "../queries.js";
import { parseModes } from "./util.js";

export async function playerRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { modes?: string } }>("/api/players", async (req) => {
    return { players: listPlayers(parseModes(req.query.modes)) };
  });

  app.get<{ Params: { id: string }; Querystring: { modes?: string } }>(
    "/api/players/:id",
    async (req, reply) => {
      const id = decodeURIComponent(req.params.id);
      const modes = parseModes(req.query.modes);
      const summary = getPlayerSummary(id, modes);
      if (!summary) {
        return reply.code(404).send({ error: "player not found" });
      }
      return {
        summary,
        byChampion: getPlayerByChampion(id, modes),
      };
    }
  );
}

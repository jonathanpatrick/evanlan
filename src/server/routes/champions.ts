import type { FastifyInstance } from "fastify";
import {
  getChampionByPlayer,
  getChampionSummary,
  listChampions,
} from "../queries.js";

export async function championRoutes(app: FastifyInstance) {
  app.get("/api/champions", async () => {
    return { champions: listChampions() };
  });

  app.get<{ Params: { name: string } }>(
    "/api/champions/:name",
    async (req, reply) => {
      const name = decodeURIComponent(req.params.name);
      const summary = getChampionSummary(name);
      if (!summary) {
        return reply.code(404).send({ error: "champion not found" });
      }
      return {
        summary,
        byPlayer: getChampionByPlayer(name),
      };
    }
  );
}

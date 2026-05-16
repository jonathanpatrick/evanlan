import type { FastifyInstance } from "fastify";
import {
  getChampionByPlayer,
  getChampionSummary,
  listChampions,
} from "../queries.js";
import { parseModes } from "./util.js";

export async function championRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { modes?: string } }>(
    "/api/champions",
    async (req) => {
      return { champions: listChampions(parseModes(req.query.modes)) };
    }
  );

  app.get<{ Params: { name: string }; Querystring: { modes?: string } }>(
    "/api/champions/:name",
    async (req, reply) => {
      const name = decodeURIComponent(req.params.name);
      const modes = parseModes(req.query.modes);
      const summary = getChampionSummary(name, modes);
      if (!summary) {
        return reply.code(404).send({ error: "champion not found" });
      }
      return {
        summary,
        byPlayer: getChampionByPlayer(name, modes),
      };
    }
  );
}

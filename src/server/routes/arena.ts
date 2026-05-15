import type { FastifyInstance } from "fastify";
import {
  getChampionByPlayer,
  getChampionSummary,
  getPlayerByChampion,
  getPlayerSummary,
  listChampions,
  listPlayers,
  listRecentGames,
} from "../queries.js";

// Arena (CHERRY) needs its own namespace because its team/win-loss semantics
// differ from Summoner's Rift / ARAM and we don't want to pollute the main
// aggregations with 18-on-ORDER rows.
export async function arenaRoutes(app: FastifyInstance) {
  app.get("/api/arena/games", async () => {
    return { games: listRecentGames(50, "arena") };
  });

  app.get("/api/arena/players", async () => {
    return { players: listPlayers("arena") };
  });

  app.get<{ Params: { id: string } }>(
    "/api/arena/players/:id",
    async (req, reply) => {
      const id = decodeURIComponent(req.params.id);
      const summary = getPlayerSummary(id, "arena");
      if (!summary) return reply.code(404).send({ error: "player not found" });
      return { summary, byChampion: getPlayerByChampion(id, "arena") };
    }
  );

  app.get("/api/arena/champions", async () => {
    return { champions: listChampions("arena") };
  });

  app.get<{ Params: { name: string } }>(
    "/api/arena/champions/:name",
    async (req, reply) => {
      const name = decodeURIComponent(req.params.name);
      const summary = getChampionSummary(name, "arena");
      if (!summary)
        return reply.code(404).send({ error: "champion not found" });
      return { summary, byPlayer: getChampionByPlayer(name, "arena") };
    }
  );
}

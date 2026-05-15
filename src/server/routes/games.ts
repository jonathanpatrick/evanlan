import type { FastifyInstance } from "fastify";
import { listRecentGames } from "../queries.js";

export async function gameRoutes(app: FastifyInstance) {
  app.get("/api/games", async () => {
    return { games: listRecentGames() };
  });
}

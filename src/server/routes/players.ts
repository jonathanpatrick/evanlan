import type { FastifyInstance } from "fastify";
import {
  getPlayerByChampion,
  getPlayerSummary,
  getTopNemeses,
  getTopVictims,
  listPlayers,
  listTopNemesisPerPlayer,
} from "../queries.js";
import { parseModes } from "./util.js";

export async function playerRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { modes?: string } }>("/api/players", async (req) => {
    const modes = parseModes(req.query.modes);
    const players = listPlayers(modes);
    const nemeses = listTopNemesisPerPlayer(modes);
    const map = new Map<string, { killer: string; times: number }>(
      nemeses.map((n) => [n.victim, { killer: n.killer, times: n.times }])
    );
    return {
      players: players.map((p) => ({
        ...p,
        top_nemesis: map.get(p.display_name) ?? null,
      })),
    };
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
      // Events use riot_id_game_name; display_name resolves to that for known
      // LAN players (everyone surfaced here has a riot ID).
      const name = summary.display_name;
      return {
        summary,
        byChampion: getPlayerByChampion(id, modes),
        topNemeses: getTopNemeses(name, modes, 5),
        topVictims: getTopVictims(name, modes, 5),
      };
    }
  );
}

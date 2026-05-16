import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { existsSync } from "node:fs";
import { env } from "./env.js";
import { adminRoutes } from "./routes/admin.js";
import { championRoutes } from "./routes/champions.js";
import { gameRoutes } from "./routes/games.js";
import { ingestRoutes } from "./routes/ingest.js";
import { playerRoutes } from "./routes/players.js";

// Import for side-effect: opens DB and runs migrations at startup.
import "./db.js";

const app = Fastify({
  logger: true,
  bodyLimit: 10 * 1024 * 1024, // 10MB — Riot match payloads aren't large but leave headroom
});

await app.register(ingestRoutes);
await app.register(adminRoutes);
await app.register(playerRoutes);
await app.register(championRoutes);
await app.register(gameRoutes);

app.get("/healthz", async () => ({ ok: true }));

if (existsSync(env.webDist)) {
  await app.register(fastifyStatic, {
    root: env.webDist,
    prefix: "/",
  });
  // SPA fallback so /players/:id etc. route to index.html for the React app.
  app.setNotFoundHandler((req, reply) => {
    if (
      req.method !== "GET" ||
      req.url.startsWith("/api") ||
      req.url.startsWith("/games") ||
      req.url.startsWith("/admin")
    ) {
      return reply.code(404).send({ error: "not found" });
    }
    return reply.sendFile("index.html");
  });
}

try {
  await app.listen({ port: env.port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

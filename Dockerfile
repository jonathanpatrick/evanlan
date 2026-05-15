# syntax=docker/dockerfile:1.7
FROM node:20-bookworm-slim AS builder
WORKDIR /app

# Build deps for better-sqlite3 (native module). Removed in runner stage.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY tsconfig.json tsconfig.server.json tsconfig.web.json vite.config.ts index.html ./
COPY scripts ./scripts
COPY src ./src

RUN npm run build
# Drop dev deps but keep the compiled better-sqlite3 binding.
RUN npm prune --omit=dev

# ---------------------------------------------------------------------------

FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DATABASE_PATH=/data/league.db
ENV PORT=8080
ENV WEB_DIST=/app/dist/web

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json

EXPOSE 8080
CMD ["node", "dist/server/index.js"]

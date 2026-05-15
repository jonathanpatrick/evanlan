#!/usr/bin/env node
// Poll the LoL Live Client Data API while a custom game is running and POST
// the final snapshot to the dashboard's ingest endpoint when the game ends.
// Parsing happens server-side; this script is a dumb pipe.
//
// Env vars:
//   INGEST_URL    (default http://localhost:8080)
//   INGEST_TOKEN  (required — matches the server's INGEST_TOKEN)
//
// Run:
//   $env:INGEST_TOKEN = "dev-smoke-token"
//   node scripts/collect-live-stats.mjs
//
// If the POST fails the snapshot is dumped to live-captures/ as a fallback.

import { mkdir, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { join } from "node:path";
import { URL } from "node:url";

const LIVE_HOST = "127.0.0.1";
const LIVE_PORT = 2999;
const LIVE_PATH = "/liveclientdata/allgamedata";
const POLL_MS = 5_000;
const COOLDOWN_MS = 5_000;
const REQUEST_TIMEOUT_MS = 2_000;
const LOCAL_DIR = join(process.cwd(), "live-captures");

const INGEST_URL = process.env.INGEST_URL ?? "http://localhost:8080";
const INGEST_TOKEN = process.env.INGEST_TOKEN ?? "";

if (!INGEST_TOKEN) {
  console.error("INGEST_TOKEN env var is required. Set it before running:");
  console.error('  $env:INGEST_TOKEN = "your-token"');
  console.error("  node scripts/collect-live-stats.mjs");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function fetchLiveData() {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        host: LIVE_HOST,
        port: LIVE_PORT,
        path: LIVE_PATH,
        method: "GET",
        rejectUnauthorized: false,
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
          } catch (err) {
            reject(err);
          }
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("request timeout")));
    req.end();
  });
}

function postToServer(payload) {
  const url = new URL("/games", INGEST_URL);
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const isHttps = url.protocol === "https:";
  const lib = isHttps ? httpsRequest : httpRequest;

  return new Promise((resolve, reject) => {
    const req = lib(
      {
        method: "POST",
        host: url.hostname,
        port: url.port || (isHttps ? 443 : 80),
        path: url.pathname,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": body.byteLength,
          "X-Ingest-Token": INGEST_TOKEN,
        },
        timeout: 10_000,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed;
          try { parsed = JSON.parse(text); } catch { parsed = text; }
          resolve({ status: res.statusCode ?? 0, body: parsed });
        });
        res.on("error", reject);
      }
    );
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("request timeout")));
    req.write(body);
    req.end();
  });
}

// Filename key: ties this script invocation's saves together so a single game
// produces a single file (overwritten as snapshots come in). When the script
// detects "game lost", we clear it so the next game gets a fresh file.
let currentGameFile = null;

async function saveLocal(stats) {
  await mkdir(LOCAL_DIR, { recursive: true });
  if (!currentGameFile) {
    currentGameFile = join(LOCAL_DIR, `lol_match_${Math.floor(Date.now() / 1000)}.json`);
  }
  await writeFile(currentGameFile, JSON.stringify(stats, null, 2));
  return currentGameFile;
}

async function handleGameEnd(stats) {
  const players = stats?.allPlayers ?? [];
  if (players.length === 0) {
    console.log("No player data in final snapshot — skipping.");
    return;
  }

  // Local copy was already updated by the polling loop, but write one more
  // time to make absolutely sure the on-disk file matches the snapshot we
  // are about to POST.
  let localPath;
  try {
    localPath = await saveLocal(stats);
    console.log(`Final local copy: ${localPath}`);
  } catch (err) {
    console.log(`Local save failed: ${err.message}`);
  }

  console.log(`Posting snapshot to ${INGEST_URL}/games (${players.length} players)…`);
  try {
    const resp = await postToServer(stats);
    if (resp.status >= 200 && resp.status < 300) {
      console.log(`Server accepted (${resp.status}):`, JSON.stringify(resp.body));
      if (resp.body && resp.body.parsed === false) {
        console.log("Note: server stored raw but parser couldn't normalize yet.");
      }
    } else {
      console.log(`Server rejected (${resp.status}):`, JSON.stringify(resp.body));
      if (localPath) console.log(`Local copy preserved at ${localPath}.`);
    }
  } catch (err) {
    console.log(`POST failed: ${err.message}`);
    if (localPath) console.log(`Local copy preserved at ${localPath}.`);
  }
}

async function main() {
  console.log(`Monitoring LoL client. Snapshots POST to ${INGEST_URL}/games on game end.`);
  console.log("(Ctrl+C posts the latest snapshot if a game was detected.)");

  let activeGame = false;
  let lastStats = null;

  const flushAndExit = async () => {
    if (activeGame && lastStats) {
      console.log("\nInterrupted — sending last snapshot…");
      try { await handleGameEnd(lastStats); } catch (e) { console.error(e); }
    }
    process.exit(0);
  };
  process.on("SIGINT", flushAndExit);
  process.on("SIGTERM", flushAndExit);

  while (true) {
    try {
      const data = await fetchLiveData();
      if (!activeGame) {
        console.log("Game detected! Polling for stats…");
        activeGame = true;
      }
      lastStats = data;
      // Persist the latest snapshot to disk on every poll. Same file gets
      // overwritten for the current game, so a crash/Ctrl+C/reboot mid-game
      // still leaves the most recent state on disk.
      try {
        await saveLocal(data);
      } catch (err) {
        console.log(`Local save error: ${err.message}`);
      }
    } catch {
      if (activeGame) {
        console.log("Game connection lost. Sending final snapshot…");
        if (lastStats) await handleGameEnd(lastStats);
        else console.log("No stats were recorded before the game ended.");
        activeGame = false;
        lastStats = null;
        currentGameFile = null;
      }
      await sleep(COOLDOWN_MS);
    }
    await sleep(POLL_MS);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

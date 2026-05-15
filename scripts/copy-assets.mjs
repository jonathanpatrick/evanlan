import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist/server", { recursive: true });
copyFileSync("src/server/schema.sql", "dist/server/schema.sql");
console.log("copied schema.sql -> dist/server/");

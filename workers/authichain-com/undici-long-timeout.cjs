"use strict";

const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

function findUndici(start) {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const direct = path.join(dir, "node_modules", "undici", "package.json");
    if (fs.existsSync(direct)) return path.join(dir, "node_modules", "undici");
    const pnpm = path.join(dir, "node_modules", ".pnpm");
    if (fs.existsSync(pnpm)) {
      const hit = fs.readdirSync(pnpm).find(name => name.startsWith("undici@"));
      if (hit) {
        return path.join(pnpm, hit, "node_modules", "undici");
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

const undiciDir = findUndici(process.cwd());
if (undiciDir) {
  const { Agent, setGlobalDispatcher } = createRequire(
    path.join(undiciDir, "package.json")
  )(undiciDir);
  setGlobalDispatcher(
    new Agent({
      connectTimeout: 60_000,
      headersTimeout: 0,
      bodyTimeout: 0,
    })
  );
  console.error("undici-long-timeout: headersTimeout 0");
}

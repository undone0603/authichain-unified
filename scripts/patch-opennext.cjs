#!/usr/bin/env node
// Patches the OpenNext Cloudflare output before final deployment.
// Currently a no-op placeholder — reserved for future compatibility shims.
// The cf:build script (package.json) runs this before `opennextjs-cloudflare build`.
const fs = require("fs");
const path = require("path");

const outputDir = path.join(__dirname, "..", ".open-next");
if (!fs.existsSync(outputDir)) {
  // Nothing to patch before the build has run — exit cleanly.
  process.exit(0);
}

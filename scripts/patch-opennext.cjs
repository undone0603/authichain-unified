#!/usr/bin/env node
// patch-opennext.cjs — runs as the first step of `pnpm run cf:build`.
//
// 1. Injects `pages_build_output_dir = ".open-next"` into wrangler.toml so
//    Cloudflare Pages knows where to find the opennextjs build output after
//    this script exits and `opennextjs-cloudflare build` runs.
//    (Only authichain-com runs cf:build; authichain-unified uses `pnpm build`
//    and never touches wrangler.toml, so its dashboard output-dir is unchanged.)
//
// 2. Reserved for post-build compat shims once .open-next exists.

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const wranglerPath = path.join(root, "wrangler.toml");

// Inject pages_build_output_dir if not already present.
let wranglerContent = fs.readFileSync(wranglerPath, "utf8");
if (!wranglerContent.includes("pages_build_output_dir")) {
  wranglerContent += '\npages_build_output_dir = ".open-next"\n';
  fs.writeFileSync(wranglerPath, wranglerContent);
  console.log('[patch-opennext] Injected pages_build_output_dir = ".open-next" into wrangler.toml');
}

// Post-build patching (reserved — .open-next not yet created at this point).
const outputDir = path.join(root, ".open-next");
if (!fs.existsSync(outputDir)) {
  process.exit(0);
}

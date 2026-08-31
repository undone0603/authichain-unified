#!/usr/bin/env node

const userAgent = process.env.npm_config_user_agent || "";
const npmVersion = process.versions?.npm;

if (userAgent.startsWith("pnpm/")) {
  console.log("Skipping npm version check under pnpm.");
  process.exit(0);
}

if (!npmVersion) {
  console.warn("Skipping npm version check: npm version not available in this runtime.");
  process.exit(0);
}

const [major = 0, minor = 0, patch = 0] = npmVersion.split(".").map(Number);
const current = major * 1_000_000 + minor * 1_000 + patch;
const minimum = 11 * 1_000_000 + 3 * 1_000;

if (current < minimum) {
  console.error(
    `Unsupported npm ${npmVersion}. AuthiChain requires npm >= 11.3.0 because npm/cli#4828 affected platform-specific optional dependencies.`
  );
  console.error("Upgrade npm before installing dependencies: npm install --global npm@11.3.0");
  process.exit(1);
}

console.log(`npm ${npmVersion} passes the npm/cli#4828 compatibility check.`);

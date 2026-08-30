#!/usr/bin/env node

const [major, minor, patch] = process.versions.npm.split('.').map(Number);
const current = major * 1_000_000 + minor * 1_000 + patch;
const minimum = 11 * 1_000_000 + 3 * 1_000;

if (current < minimum) {
  console.error(
    `Unsupported npm ${process.versions.npm}. AuthiChain requires npm >= 11.3.0 because npm/cli#4828 affected platform-specific optional dependencies.`
  );
  console.error('Upgrade npm before installing dependencies: npm install --global npm@11.3.0');
  process.exit(1);
}

console.log(`npm ${process.versions.npm} passes the npm/cli#4828 compatibility check.`);

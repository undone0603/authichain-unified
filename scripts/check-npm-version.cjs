#!/usr/bin/env node

const npmVersion = process.versions.npm;

if (!npmVersion) {
  console.log('Skipping npm version check because this install is not running under npm.');
  process.exit(0);
}

const [major, minor, patch] = npmVersion.split('.').map(Number);
const current = major * 1_000_000 + minor * 1_000 + patch;
const minimum = 11 * 1_000_000 + 3 * 1_000;

if (current < minimum) {
  console.error(
    `Unsupported npm ${npmVersion}. AuthiChain requires npm >= 11.3.0 because npm/cli#4828 affected platform-specific optional dependencies.`
  );
  console.error('Upgrade npm before installing dependencies: npm install --global npm@11.3.0');
  process.exit(1);
}

console.log(`npm ${npmVersion} passes the npm/cli#4828 compatibility check.`);

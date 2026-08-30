#!/usr/bin/env node

const [major, minor, patch] = process.versions.npm.split('.').map(Number);
const current = major * 1_000_000 + minor * 1_000 + patch;
const minimum = 11 * 1_000_000 + 3 * 1_000;

if (current < minimum) {
  console.error(`Unsupported npm ${process.versions.npm}. AuthiChain requires npm >= 11.3.0 because npm/cli#4828 corrupted platform-specific optional dependencies in lockfiles.`);
  console.error('Use Node.js 24+ (which ships with npm 11) or upgrade npm before installing dependencies.');
  process.exit(1);
}

console.log(`npm ${process.versions.npm} passes optional-dependency integrity gate (npm/cli#4828 fixed in npm 11.3.0+).`);

#!/usr/bin/env node

/**
 * Cross-platform CLI wrapper for agent-browser
 * 
 * This wrapper enables npx support on Windows where shell scripts don't work.
 * For global installs, postinstall.js patches the shims to invoke the native
 * binary directly (zero overhead).
 */

import { spawn } from 'child_process';
import { existsSync, accessSync, chmodSync, statSync, constants } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { platform, arch } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Map Node.js platform/arch to binary naming convention
function getCandidateBinaryNames() {
  const os = platform();
  const cpuArch = arch();

  let osKey;
  switch (os) {
    case 'darwin': osKey = 'darwin'; break;
    case 'linux':  osKey = 'linux';  break;
    case 'win32':  osKey = 'win32';  break;
    default: return [];
  }

  let primaryArch;
  switch (cpuArch) {
    case 'x64':
    case 'x86_64':
      primaryArch = 'x64';
      break;
    case 'arm64':
    case 'aarch64':
      primaryArch = 'arm64';
      break;
    default:
      return [];
  }

  const ext = os === 'win32' ? '.exe' : '';

  // Primary arch first; on Windows ARM64 fall back to x64 (runs via emulation)
  const candidates = [`agent-browser-${osKey}-${primaryArch}${ext}`];
  if (os === 'win32' && primaryArch === 'arm64') {
    candidates.push(`agent-browser-${osKey}-x64${ext}`);
  }
  return candidates;
}

function main() {
  const candidates = getCandidateBinaryNames();

  if (candidates.length === 0) {
    console.error(`Error: Unsupported platform: ${platform()}-${arch()}`);
    process.exit(1);
  }

  // Pick the first candidate that exists and is non-empty
  const binaryPath = candidates
    .map((name) => join(__dirname, name))
    .find((p) => existsSync(p) && statSync(p).size > 0);

  if (!binaryPath) {
    console.error(`Error: No binary found for ${platform()}-${arch()}`);
    console.error(`Tried: ${candidates.join(', ')}`);
    console.error('');
    console.error('Run "npm run build:native" to build for your platform,');
    console.error('or reinstall the package to trigger the postinstall download.');
    process.exit(1);
  }

  // Ensure binary is executable (fixes EACCES on macOS/Linux when postinstall didn't run,
  // e.g., when using bun which blocks lifecycle scripts by default)
  if (platform() !== 'win32') {
    try {
      accessSync(binaryPath, constants.X_OK);
    } catch {
      // Binary exists but isn't executable - fix it
      try {
        chmodSync(binaryPath, 0o755);
      } catch (chmodErr) {
        console.error(`Error: Cannot make binary executable: ${chmodErr.message}`);
        console.error('Try running: chmod +x ' + binaryPath);
        process.exit(1);
      }
    }
  }

  // Spawn the native binary with inherited stdio
  const child = spawn(binaryPath, process.argv.slice(2), {
    stdio: 'inherit',
    windowsHide: false,
  });

  child.on('error', (err) => {
    console.error(`Error executing binary: ${err.message}`);
    process.exit(1);
  });

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });
}

main();

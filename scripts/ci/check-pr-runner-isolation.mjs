#!/usr/bin/env node
// Fail closed when a PR-triggered workflow can route untrusted code to a persistent runner.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = '.github/workflows';
const errors = [];
for (const name of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n))) {
  const file = join(dir, name);
  const source = readFileSync(file, 'utf8');
  const lines = source.split(/\r?\n/);
  // Read only top-level event block; ignore mentions in comments or job steps.
  const start = lines.findIndex((l) => /^on:\s*(?:#.*)?$/.test(l));
  if (start < 0) {
    // Inline triggers also count; unknown forms are rejected if self-hosted.
    if (/^on:\s*\[.*pull_request/.test(source) && /self-hosted/.test(source)) errors.push(file + ': inline PR event with self-hosted runner');
    continue;
  }
  const events = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^[^\s#]/.test(lines[i])) break;
    const m = lines[i].match(/^  (pull_request(?:_target)?|workflow_run):/);
    if (m) events.push(m[1]);
  }
  if (!events.length) continue;
  if (events.includes('pull_request_target') && /(?:checkout@|head\.sha|head\.ref|pull_request\.head)/.test(source)) {
    errors.push(file + ': privileged pull_request_target may execute PR content');
  }
  if (events.includes('workflow_run') && /self-hosted/.test(source)) {
    if (!/head_branch\s*==\s*['"]main['"]/.test(source) || !/ref:\s*main\b/.test(source)) {
      errors.push(file + ': workflow_run on self-hosted lacks main-only checkout guard');
    }
  }
  if (!events.includes('pull_request')) continue;
  lines.forEach((line, i) => {
    if (!/^\s*runs-on:/.test(line) || !/self-hosted/.test(line)) return;
    const pushOnly = /github\.event_name\s*==\s*'push'/.test(line) && /\|\|\s*'ubuntu-24\.04'/.test(line);
    const prHosted = /github\.event_name\s*==\s*'pull_request'/.test(line) && /'ubuntu-24\.04'\s*\|\|/.test(line);
    if (!pushOnly && !prHosted) errors.push(file + ':' + (i + 1) + ': PR can select self-hosted or route is not provably safe');
  });
});
if (errors.length) {
  console.error('Runner routing security violations:\n' + errors.map((e) => ' - ' + e).join('\n'));
  process.exit(1);
}
console.log('Runner routing audit: PR paths use isolated runners (static policy checks passed).');

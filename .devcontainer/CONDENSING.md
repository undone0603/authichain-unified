# Codespaces condensing technique

Keep GitHub Codespaces for `authichain-unified` small enough to open, install, and work without pulling the whole monorepo product surface into every session.

This file is the technique. `.devcontainer/devcontainer.json` and `setup.sh` implement it.

## Why condense

The repo is a Cloudflare-first monorepo (apps, packages, workers, edge). A default Codespace that installs browsers, builds Next, and enables every VS Code extension burns time and disk before the first useful command.

Condensing means: **start with the smallest environment that can edit, typecheck, and unit-test the slice you own**, then expand scope only when a task needs it.

## Rules

1. **Default scope is `core`.**  
   `AUTHICHAIN_CODESPACE_SCOPE=core` (set in `devcontainer.json`). Installs the pnpm workspace with frozen lockfile. Skips Playwright/Puppeteer browser downloads and husky.

2. **Expand with an env var, not a second image.**  
   - `core` — edit + vitest/unit paths; no browser binaries  
   - `workers` — same install + confirm `wrangler` CLI  
   - `full` — same install; still skips browsers unless you unset `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`

   Rebuild or re-run `bash .devcontainer/setup.sh` after changing the variable in Codespace secrets / env.

3. **Put install in `updateContentCommand`, not only `postCreateCommand`.**  
   Prebuilds can cache dependency work. `post-create.sh` only repairs a missing `node_modules` and prints tips. Never put secret materialization or production deploys in create hooks.

4. **Pin the toolchain.**  
   Node 22 (`.nvmrc` / `engines`), pnpm `10.28.2` (`packageManager`). No `latest` tags on the image or Corepack prepare.

5. **Minimal features and extensions.**  
   Features: `github-cli` + lean `common-utils` (no Oh My Zsh). Extensions: ESLint, Prettier, Tailwind only. Add Cloudflare/Wrangler extensions only when the task is worker-heavy.

6. **Exclude heavy trees from watchers and search.**  
   `node_modules`, `.turbo`, `.next`, `dist`, coverage, Playwright reports, and `pnpm-lock.yaml` stay out of the editor index.

7. **Do not start paid or production paths from a Codespace by default.**  
   Leave `CLOUDFLARE_DEPLOY_ENABLED` alone. Do not invent `DPP_SMOKE_SECRET` or outreach sends. Use Codespaces secrets for real keys when a human opts in.

8. **Prefer a worktree or filter when the task is one worker.**  
   For a single apex change, work under `workers/<name>` tests (`npm test` / `pnpm exec tsx --test`) instead of `pnpm build` at the root.

9. **Machine size stays modest until proven short.**  
   Host requirements start at 2 CPU / 8 GB / 32 GB. Bump only if install OOMs or you need `full` + browsers.

10. **Condense the task, not just the container.**  
    Open Codespaces for a named slice (one PR, one worker, one package). Close or stop idle Codespaces. Do not keep a long-lived “everything installed” machine as the default.

## Quick commands

```bash
# Re-run condensed install
AUTHICHAIN_CODESPACE_SCOPE=core bash .devcontainer/setup.sh

# Worker-focused session
AUTHICHAIN_CODESPACE_SCOPE=workers bash .devcontainer/setup.sh

# Unit tests for DPP importer / activate (example)
pnpm exec vitest run src/lib/dpp-importer-file.test.ts src/lib/dpp-activate.test.ts

# One sister worker package tests
(cd workers/strainchain-io && npm test)
```

## What this is not

- Not a substitute for CI Main / Typecheck ratchet on PRs  
- Not a production deploy path (that remains GitHub Actions `deploy-workers.yml` / `deploy-cloudflare.yml`)  
- Not permission to flip outreach or deploy feature flags  

## Checklist when changing this folder

- [ ] Default scope remains `core`  
- [ ] Browser downloads stay skipped unless explicitly opted in  
- [ ] No secrets written into scripts or `devcontainer.json`  
- [ ] New VS Code extensions are justified by a recurring Codespaces task  
- [ ] `CONDENSING.md` stays the single technique doc (do not fork into README essays)

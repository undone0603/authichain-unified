<!-- BEGIN:repo-reality-rules -->

# Repo reality check (required)

This repo contains Next.js-related packages/config **and** a Vite-based frontend build. Do not assume a standard Next.js App Router project layout.

Before making changes:
- Check `package.json` scripts to confirm the actual dev/build entrypoints (`pnpm dev`, `pnpm build`).
- Inspect where routing/brand selection is implemented (Host / x-forwarded-host / Cloudflare headers).
- Treat autonomous/"auto" agent workflows as high-blast-radius: require explicit env kill-switches for any side effects (email, billing, chain ops, deploys).

<!-- END:repo-reality-rules -->

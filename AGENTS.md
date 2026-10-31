<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Unified Architect Agent
**Role:** Documentation & Compliance Enforcer
**Trigger:** Any changes made to `docs/**` or `compliance/**`
**Directives:** 
- Automatically audit changes to ensure strict alignment with EU Digital Product Passport (CIRPASS) standards.
- Verify that newly generated schema or specification documentation accurately reflects current CI/CD and repository capabilities.
- Propose pipeline or codebase corrections if compliance drifts are detected.
# YES-DEPLOY-DOCS — laptop only

Founder authorized `/docs` on `authichain-com`. This chat cannot `wrangler deploy`. Main has no `docs-pages.ts`. Deploying current main is a no-op.

Not in scope: merge to main, Basic/`price_`, AC-DEMO seed, ISSUE_SECRET, GSC (after first 200).

## Drop-in

From the Wave-1 pack:

```
workers/docs-pages.ts          → workers/authichain-com/src/docs-pages.ts
workers/docs-pages.test.ts     → workers/authichain-com/src/docs-pages.test.ts
content/docs/public/*.md       → workers/authichain-com/content/docs/public/
```

You still need a `renderDocsPage()` that compiles those markdown files into HTML using the same `--ac-*` tokens as `x402-docs-page.ts`. Routing contract alone does not serve HTML.

## Wire in `src/index.ts` (after x402 docs)

```ts
import {
  docsRedirect,
  isDocsHub,
  isDocsPage,
} from "./docs-pages";
import { renderDocsPage } from "./docs-render"; // you add this

// existing:
if (isX402DocsPath(url.pathname)) return html(renderX402DocsPage());

const dest = docsRedirect(url.pathname);
if (dest) return Response.redirect(new URL(dest, url.origin), 301);

if (isDocsHub(url.pathname) || isDocsPage(url.pathname)) {
  return html(renderDocsPage(url.pathname));
}
```

Do not add an `authichain.com/*` catch-all. Do not swallow `/onboard` `/verify` `/api` `/checkout` `/pricing`.

## Banned-copy grep before deploy

```bash
cd workers/authichain-com
rg -n "GS1 Conformant Resolver|gs1ConformantResolver: true|Bitcoin L1|anchored to Bitcoin|\\$49/mo|id.authichain.com/01/" \
  src/docs-pages.ts src/docs-render.ts content/docs/public || true
```

Allowed: “not a GS1 Conformant Resolver”. Forbidden: live scan URL, AC-DEMO-001 as a working demo, $49/mo.

## Deploy (does not merge main)

```bash
cd workers/authichain-com
npx wrangler deploy
```

If Workers Builds production command on this script is `wrangler deploy`, merging main also ships. Prefer local deploy of this worker only. Do not deploy `govchain-us` / `qron-space` / `authichain-app`.

## Smoke

```bash
curl -sS -o /dev/null -w "%{http_code}\n" https://authichain.com/docs
curl -sS -o /dev/null -w "%{http_code}\n" https://authichain.com/docs/gs1-digital-link
curl -sS -o /dev/null -w "%{http_code}\n" https://authichain.com/docs/verification
curl -sS -o /dev/null -w "%{http_code}\n" https://authichain.com/docs/dpp-architecture
curl -sS -o /dev/null -w "%{http_code}\n" https://authichain.com/docs/examples
curl -sS -o /dev/null -w "%{http_code}\n" https://authichain.com/docs/x402
curl -sS -I https://authichain.com/docs/resolver | head -n 8
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" https://authichain.com/.well-known/jwks.json
```

Expect: five 200s, `/docs/x402` still 200, `/docs/resolver` 301 → `/docs/gs1-digital-link`, JWKS still `application/json`.

GSC submit `/docs` is founder-only after the hub 200s.

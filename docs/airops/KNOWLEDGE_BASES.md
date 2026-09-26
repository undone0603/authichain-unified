# Three Knowledge Bases (Solo free cap)

Create exactly these three. Name them as written so Playbooks can pick them by name later.

AirOps does not ingest a GitHub repo natively. Use file upload + web scrape.

## 1. AC Public Product

Purpose: what the company is, what it sells, what agents may say.

Upload this file: `docs/airops/KB_PUBLIC_PRODUCT.md` (also in this folder).

Optional extra files (only if they stay public-safe):
- repo `README.md`
- `docs/ESTATE.md` (domains and CTA rules — yes, public)

Do not upload CAPABILITIES, OPERATING_CHARTER, .env.example, or worker source.

## 2. AC Repo Docs

Purpose: accurate product/architecture language from the public repo.

Add Data → Web Scrape → Single Page for each URL:

- https://github.com/undone0603/authichain-unified
- https://github.com/undone0603/authichain-unified/blob/main/README.md
- https://github.com/undone0603/authichain-unified/blob/main/docs/ESTATE.md
- https://github.com/undone0603/authichain-unified/blob/main/docs/INDEX.md
- https://github.com/undone0603/authichain-unified/blob/main/docs/PARTNER_INTEGRATION_GUIDE.md
- https://raw.githubusercontent.com/undone0603/authichain-unified/main/README.md

Do not sitemap-scrape the whole repo. That will index issues, archives, and internal runbooks.

If scrape quality is poor (GitHub HTML chrome), download those markdown files and upload them as .md instead.

## 3. AC Live Sites

Purpose: what is actually live for citations.

Add Data → Web Scrape → Single Page:

- https://authichain.com
- https://authichain.com/verify
- https://authichain.com/authentic-agentic-economy
- https://qron.space
- https://govchain.us
- https://strainchain.io
- https://authichain.com/.well-known/jwks.json (only if the page is human-readable or you paste a short note that JWKS is published there)

Skip sitemap scrape of all four domains on day one. That burns index quality and is easy to over-ingest.

## Refresh rule

Re-upload or re-scrape only after a public positioning change. Do not schedule refresh jobs on free tier.

## GitHub MCP (optional, not a Knowledge Base)

Settings → MCP Connectors → Add Connector

- Name: GitHub MCP
- Auth: Access Token
- Token: a fine-scoped PAT with `contents:read` on `undone0603/authichain-unified` only

Use this later inside an LLM step when you need a live file. Do not use it as a fourth Knowledge Base.

# Genuine external reviewer evidence (credential-free MCP POST)

This is not founder evidence. An independent person or agent must run the pinned script.

## Required steps
1. Clone or download `scripts/mcp/pin-free-mcp-post.mjs` from the exact commit SHA.
2. Run: `node scripts/mcp/pin-free-mcp-post.mjs > evidence.json`
3. Confirm `credentials_used: false` and both steps returned 200.
4. Record:
   - UTC timestamp of the run
   - Node version (`node --version`)
   - SHA-256 of the script file
   - SHA-256 of the response bodies (already in evidence.json)
   - Your identity statement: "I am not the AuthiChain founder or an automated agent under founder control. I ran this against the public endpoint with no credentials."

## What counts as evidence
- The raw `evidence.json` plus the identity statement posted as a public GitHub issue comment or gist.
- Independent MCP client logs (Cursor, Claude, Glama, etc.) that show the same `tools/list` + `tools/call verify_record` with `id: "polygon-anchor-1"` and no Authorization header.

## What does not count
- Founder-run captures
- Screenshots without request/response hashes
- GET-only probes
- Any run that used an API key or X-PAYMENT header

No approval, listing, or revenue claim is implied by a successful run.

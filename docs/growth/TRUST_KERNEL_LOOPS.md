# Trust Kernel acquisition loops

Public contract after `feat/verify-evaluate-wire`:

```json
{
  "decision": "verified | anomaly | blocked | expired | invalid | not_found",
  "vector": {
    "identity": "verified | partial | failed | not_supplied",
    "issuer": "verified | failed | unknown",
    "signature": "verified | failed | unknown",
    "provenance": "verified | partial | unknown",
    "physical_binding": "partial | unknown",
    "scan_behavior": "clear | anomalous | unknown",
    "revocation": "clear | failed",
    "freshness": "verified | failed | unknown"
  },
  "reasons": ["string"],
  "unknowns": ["string"],
  "depthUsed": "lookup | history"
}
```

No `trust_score`. No `authenticityScore`. No Lab brand page. Prices unchanged.

Surfaces (same primitive):
- `GET|POST https://authichain.com/verify` and `/api/verify` — free lookup depth
- `/desk/verify` — same decision, desk chrome
- `POST /api/x402` history depth — existing $0.05 USDC
- MCP `verify_product` / `authichain_verify_product` — same JSON

CTA after a decision is only `/onboard` (register) or `/dapp` (manage). Never a `*.vercel.app` URL.

---

## Loop 1 — Scan → decision → register

- **Trigger:** QR scan or pasted serial on `/verify`.
- **Mechanism:** Worker calls `evaluate()`. Page renders the six-word decision plus the evidence vector. Verified or anomaly both CTA to `/onboard` ("Register this object" / "Report and register"). not_found CTA is "Register the first seal".
- **Expected conversion (estimate):** 2–8% of unique `/verify` sessions → `/onboard` start. Anomaly sessions convert higher than verified (4–12%) because the owner needs a record.
- **Events:** `verify_shown`, `verify_decision` (`decision`, `depthUsed`), `verify_cta_click` (`decision`, `cta`), `onboard_started_from_verify`.
- **Kill:** if 1,000 `/verify` sessions produce zero `onboard_started_from_verify` in 14 days, drop the CTA experiment and keep lookup only.

## Loop 2 — Decision share → second scan

- **Trigger:** visitor copies the public decision URL (`/verify?id=`).
- **Mechanism:** every scan already is a distribution surface. Share card is the decision word + vector chips, not a score. Recipient lands on the same `/verify`.
- **Expected conversion (estimate):** 8–20% of shares produce a second unique `/verify` session.
- **Events:** `verify_share_click`, `verify_second_session`.
- **Kill:** if share click → second session < 3% after 200 clicks, remove the share control.

## Loop 3 — MCP / x402 machine verify

- **Trigger:** agent calls `verify_product` or pays `POST /api/x402`.
- **Mechanism:** same `evaluate()` JSON. Lookup is free on `/verify`. History depth stays the existing $0.05 x402 SKU. No new product.
- **Expected conversion (estimate):** 1–4% of free lookups → paid history depth.
- **Events:** `mcp_verify`, `x402_verify_paid` (`decision`, `depthUsed`).
- **Kill:** if paid history is 0 after 2,000 free lookups *and* MCP callers exist, the depth upsell copy is wrong — rewrite, do not add a SKU.

## Loop 4 — Anomaly → desk

- **Trigger:** `decision=anomaly|blocked|expired`.
- **Mechanism:** `/desk/verify` shows the same JSON plus "what is unknown". No authenticity guarantee language. CTA is `/onboard` to attach evidence, not a sales call.
- **Expected conversion (estimate):** 5–15% of anomaly decisions → `/onboard`.
- **Events:** `verify_anomaly_shown`, `desk_verify_shown`, `onboard_started_from_anomaly`.
- **Kill:** if anomaly copy claims the object is counterfeit (it does not; reasons are evidence gaps), revert copy immediately.

## Proof that must be collected first

Do not publish customer logos, case studies, or "X% authentic" rates. Collect, in order:
1. 100 live `/verify` responses with the new JSON shape (instrument `verify_decision`).
2. One object with a real (not mock) evidence digest and a passing history-depth scan.
3. One paid x402 history-depth receipt that returns the same `evaluate()` shape.

## Copy lock (apex `/verify`)

- **Headline:** Check a seal.
- **Subhead:** The result is a decision and an evidence vector. It is not an authenticity score.
- **Proof:** Ed25519 + JWKS at `https://authichain.com/.well-known/jwks.json`. Missing evidence stays unknown.
- **CTA:** Verify → `/verify`. Register an object → `/onboard`.
- **Meta title:** Verify a seal | AuthiChain
- **Meta description:** Paste a serial or scan a QRON. AuthiChain returns verified, anomaly, blocked, expired, invalid, or not found — plus what it could not inspect.

## Launch decision already taken

Kernel + lab: merged in #1267.
This branch wires the public JSON. Merge when worker + MCP return `{ decision, vector, reasons, unknowns }` and no public `trust_score`.

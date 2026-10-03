# Trust Kernel

Single `evaluate()` behind `/verify`, `/desk/verify`, `POST /api/x402`, and MCP `verify_product`.

Wraps `protocol/attestation/types.ts`. Does not invent REVIEW as a public string.

```
node protocol/adversarial/run.mjs --strict
```

Public JSON: `{ decision, vector, reasons, unknowns, physical_binding }`.
Never `trust_score`, never `authentic`, never simulated agent notes.

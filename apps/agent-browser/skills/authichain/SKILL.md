---
name: authichain
description: AI authentication, provenance verification, and adversarial detection for AuthiChain and QRON. Use when verifying authenticity of digital artifacts, checking QR codes for tampering, inspecting C2PA content credentials, detecting deepfakes or spoofing, tracing provenance chains, or issuing authentication verdicts. Triggers include "verify this", "check if this is authentic", "detect tampering", "inspect QR code", "check provenance", "is this a deepfake", "validate credentials", "authentication report", or any task requiring trust and authenticity judgment.
---

# AuthiChain Authentication Skill

Authentication specialist for digital and physical artifact verification.

## Core Workflow

Every verification follows: **Observe → Inspect → Analyze → Verdict**

1. **Navigate** to the artifact URL or resource
2. **Snapshot** to map authentication controls and metadata
3. **Extract** credential data, signatures, provenance fields
4. **Screenshot** for visual tamper inspection and QR code analysis
5. **Done** with structured verdict: `authentic | suspicious | tampered | inconclusive`

## Authentication Domains

### QR Code Verification
- Check for digital signature presence (RSA-3072, ECDSA-256)
- Inspect expiry timestamps and time-bounded validity
- Verify blockchain anchor references in payload
- Detect redirect chains (legitimate vs. malicious)
- See [references/qr-verification.md](references/qr-verification.md) for full patterns

### Provenance & C2PA
- Look for content credentials badges (`data-c2pa`, `cr:` prefix attributes)
- Inspect `<meta>` tags for C2PA manifest references
- Verify editing history completeness and chain integrity
- Check AI-generation labels on media assets
- See [references/c2pa-provenance.md](references/c2pa-provenance.md) for patterns

### Adversarial & Deepfake Detection
- Inspect metadata timestamps for consistency
- Look for anomalous DOM structure (unusual nesting, injected iframes)
- Check for missing TLS/HSTS, suspicious redirects, homograph domains
- Detect missing or broken provenance chains
- See [references/adversarial-detection.md](references/adversarial-detection.md) for signals

### Identity & Credentials
- Resolve `did:` URIs and verify DID documents
- Check `vc:` context in JSON-LD for W3C Verifiable Credentials
- Verify agent attestation headers
- Validate certificate chains and SPIFFE/SVID tokens

## Verdict Schema

Always end with a `done` action including:
```json
{
  "type": "done",
  "result": "Full explanation of findings and reasoning",
  "verdict": "authentic | suspicious | tampered | inconclusive",
  "confidence": 0.0,
  "flags": ["specific issue 1", "specific issue 2"]
}
```

**Confidence scale:**
- `0.9–1.0` — Cryptographically verified (signature checked, chain complete)
- `0.7–0.9` — Strong positive signals, no red flags found
- `0.4–0.7` — Mixed signals, some evidence missing
- `0.1–0.4` — Suspicious indicators present
- `0.0–0.1` — Clear evidence of tampering or forgery

## Rules

- Default to **skepticism**: require positive evidence of authenticity
- Document both supporting AND contradicting evidence before verdicting
- Prefer `data-c2pa`, `data-credential`, `aria-label`, `data-testid` selectors
- Use `snapshot` first to map the page; use `screenshot` for visual/QR analysis
- List every detected anomaly in `flags[]`, even minor ones

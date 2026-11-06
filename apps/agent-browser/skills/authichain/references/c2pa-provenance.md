# C2PA & Provenance Reference

## Contents
1. [C2PA Signal Detection](#c2pa-signal-detection)
2. [Provenance Chain Validation](#provenance-chain-validation)
3. [AI-Generation Labels](#ai-generation-labels)
4. [Hybrid Storage Patterns](#hybrid-storage-patterns)
5. [Flags Reference](#flags-reference)

## C2PA Signal Detection

### DOM attributes to inspect
```
data-c2pa="..."                  → Inline manifest reference
data-c2pa-status="verified"     → Pre-verified status (check issuer)
data-credential-type="c2pa"     → C2PA credential marker
```

### Meta tags to check
```html
<meta name="c2pa:manifest" content="..." />
<meta property="c2pa:issuer" content="did:web:..." />
<meta name="c2pa:assertions" content="c2pa.training-mining,c2pa.ai-generative-training" />
<link rel="c2pa-manifest" href="/.well-known/c2pa.json" />
```

### Content credentials badge
- Look for a badge element with `aria-label` containing "content credentials" or "cr:"
- Badge present + manifest verifiable = **strong authentic signal** (+0.35)
- Badge present but manifest link 404 = **suspicious** (flag: `c2pa-manifest-missing`)
- No badge on media claiming C2PA compliance = **suspicious** (flag: `c2pa-badge-absent`)

## Provenance Chain Validation

A valid chain must be complete from creation to current state:

```
[Device capture] → [Edit 1] → [Edit 2] → [Current]
      ↓                 ↓           ↓          ↓
  Signature        Signature   Signature   Signature
```

**Validation steps:**
1. Extract manifest from `<link rel="c2pa-manifest">` or `/.well-known/c2pa.json`
2. Check `assertions` array for `c2pa.hard-bindings` (ties manifest to content hash)
3. Verify each edit in `actions` array has a signed ingredient reference
4. Check `claim_generator` field for issuing tool identity

**Chain breaks to flag:**
- `provenance-chain-gap` — Missing step between edits
- `provenance-hash-mismatch` — Content hash doesn't match bound manifest
- `provenance-issuer-unrecognized` — `claim_generator` is unknown tool
- `provenance-chain-missing` — No manifest found at all

## AI-Generation Labels

C2PA includes assertions for AI-generated content:

| Assertion | Meaning |
|---|---|
| `c2pa.ai-generative-training` | Content used to train AI |
| `c2pa.training-mining` | Content mined for training |
| `com.adobe.generative-ai` | Adobe Firefly generated |
| `com.openai.dalle` | DALL-E generated |
| `org.starlinglab` | Camera-authenticated (Starling Lab) |

If a media asset has **no** AI-generation assertion but shows visual signs of AI synthesis, flag as `ai-generation-undisclosed`.

## Hybrid Storage Patterns

Legitimate provenance implementations use:
- **On-chain**: manifest hash anchored to Ethereum/Polygon/Hedera (look for `data-anchor-tx`)
- **Off-chain**: full manifest at `/.well-known/c2pa.json` or CDN URL
- **Inline**: compact manifest embedded in `<meta>` tag for small assets

Flag `provenance-storage-unusual` if:
- Full manifest is served inline for large media (>1MB)
- Anchor transaction is on an unknown/private chain
- `/.well-known/c2pa.json` returns non-JSON content

## Flags Reference

| Flag | Severity | Description |
|---|---|---|
| `c2pa-manifest-missing` | High | Badge present but manifest not found |
| `c2pa-badge-absent` | Medium | No content credentials badge |
| `provenance-chain-gap` | High | Missing step in edit history |
| `provenance-hash-mismatch` | Critical | Content modified after signing |
| `ai-generation-undisclosed` | Medium | Visual AI synthesis, no label |
| `provenance-chain-missing` | Medium | No provenance data present |
| `c2pa-issuer-unrecognized` | Medium | Unknown claim generator |

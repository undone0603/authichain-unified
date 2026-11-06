# Adversarial & Deepfake Detection Reference

## Contents
1. [Signal Categories](#signal-categories)
2. [DOM & Network Signals](#dom--network-signals)
3. [Visual Inconsistency Signals](#visual-inconsistency-signals)
4. [Identity Spoofing Patterns](#identity-spoofing-patterns)
5. [Behavioral Anomalies](#behavioral-anomalies)
6. [Flags Reference](#flags-reference)

## Signal Categories

Adversarial attacks fall into four categories:

| Category | Examples | Detection method |
|---|---|---|
| **Content forgery** | Deepfake images/video, synthetic text | C2PA check, visual analysis |
| **Identity spoofing** | Homograph domains, fake badges, cloned UIs | DOM inspection, URL analysis |
| **Provenance poisoning** | Fake manifest, broken chain | Provenance validation |
| **Injection** | Prompt injection in page content, malicious iframes | DOM structure analysis |

## DOM & Network Signals

### URL and domain checks
```
Legitimate:  https://authichain.io/verify/abc123
Homograph:   https://аuthichain.io/verify/abc123  ← Cyrillic 'а'
Typosquat:   https://authichain-io.com/verify/abc123
Subdomain:   https://verify.evil.com/authichain.io
```

Steps:
1. Extract `Current URL` from page context
2. Decode any punycode: `xn--` prefix = non-ASCII domain
3. Check TLD matches expected (`.io`, `.com`, `.dev` for known brands)
4. Flag if subdomain structure obscures the real domain

### Iframe injection
```javascript
// Suspicious patterns in page HTML:
<iframe src="https://different-domain.com" style="opacity:0">
<iframe sandbox="" src="data:text/html,...">
```
Flag `iframe-injection` if: hidden iframes to external domains, data-URI iframes, or iframe count > 3 on simple pages.

### Meta-tag inconsistencies
- `og:url` ≠ actual page URL → flag `og-url-mismatch`
- `og:site_name` doesn't match domain → flag `og-sitename-mismatch`
- Missing `Content-Security-Policy` header on auth pages → flag `csp-missing`

## Visual Inconsistency Signals

Use `screenshot` action then analyze for:

### Layout anomalies
- Brand logo pixelated or wrong aspect ratio
- Font rendering inconsistencies (mixed serif/sans-serif in headers)
- Color profile mismatch (brand colors slightly off)
- Button styles inconsistent with rest of page

### Deepfake media indicators
- Unnatural skin texture uniformity in portrait images
- Hair boundary artifacts (soft edges, halos)
- Ear/eye asymmetry beyond normal human variance
- Background-foreground boundary inconsistencies
- Temporal inconsistencies in video thumbnails

### Badge and credential spoofing
- Verification badge is a static image (`.png`, `.jpg`) not an SVG/interactive element
- Badge links to `javascript:void(0)` or dead link
- "Verified by" text doesn't match expected authority
- Verification badge has no `aria-label` or accessibility markup

## Identity Spoofing Patterns

### DID/VC spoofing
```json
// Legitimate VC context:
{ "@context": ["https://www.w3.org/2018/credentials/v1"] }

// Spoofed (wrong domain):
{ "@context": ["https://www.w3c.org/2018/credentials/v1"] }  ← wrong TLD
{ "@context": ["https://credentials.example.com/v1"] }       ← unknown issuer
```

### Agent attestation spoofing
- `X-Agent-Attestation` header present but self-signed
- SPIFFE SVID with unknown trust domain
- Agent ID format doesn't match expected pattern (UUID v4 vs custom)

## Behavioral Anomalies

### Redirect manipulation
Normal: Direct URL → Resource
Suspicious: URL → tracker.evil.com → URL → Resource (click hijacking)

Steps:
1. Navigate to the resource
2. Compare `Current URL` from each step context
3. Flag if intermediate URLs cross domains unexpectedly

### Timing attacks
- Page loads extremely fast (pre-rendered clone) or very slow (proxy)
- Authentication forms submit without network latency
- Verification "check" completes in <50ms (no real computation)

## Flags Reference

| Flag | Severity | Description |
|---|---|---|
| `homograph-domain` | Critical | Unicode look-alike in domain |
| `typosquat-domain` | High | Domain closely resembles known brand |
| `iframe-injection` | High | Hidden external iframe detected |
| `og-url-mismatch` | Medium | OpenGraph URL ≠ actual URL |
| `csp-missing` | Medium | No Content-Security-Policy on auth page |
| `badge-static-image` | Medium | Verification badge is non-interactive image |
| `badge-dead-link` | High | Verification badge links to nowhere |
| `vc-context-spoofed` | Critical | VC uses non-W3C context domain |
| `did-unresolvable` | High | DID document cannot be fetched |
| `redirect-chain-cross-domain` | High | Unexpected cross-domain redirect |
| `timing-anomaly-fast` | Low | Page verified suspiciously fast |
| `prompt-injection-risk` | High | Page content contains instruction-like text |

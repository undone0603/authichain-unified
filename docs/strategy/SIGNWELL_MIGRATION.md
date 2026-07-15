# SignWell Migration - DocuSign to SignWell

## Overview

This document details the complete migration from DocuSign eSignature to SignWell as AuthiChain's document signing provider. The migration is driven by cost optimization (SignWell free tier: $0, 25 documents/month), testMode support, and streamlined API integration.

## Why SignWell

- **Free Tier**: 25 documents/month at $0 (vs DocuSign paid plans)
- **TestMode**: Full sandbox testing mode for development
- **Simpler API**: RESTful, JSON-first, OAuth2 or API key auth
- **No token exchange**: Direct API key auth (no docusign_token / JWT grant flow)
- **Native PDF Templating**: Built-in template system for contracts/NDAs

## Zero-Dollar Path

SignWell's free tier provides 25 documents/month with testMode enabled. All workflows use `testMode: true` in non-production environments and `testMode: false` in production (when volume permits).

## Environment Variables

### Old (DocuSign)
```
DOCUSIGN_ACCOUNT_ID=xxxxx
DOCUSIGN_USER_ID=xxxxx
DOCUSIGN_INTEGRATION_KEY=xxxxx
DOCUSIGN_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----
DOCUSIGN_SERVER_URL=https://account.docusign.com
DOCUSIGN_REDIRECT_URI=http://localhost:3000/api/auth/docusign/callback
```

### New (SignWell)
```
SIGNWELL_API_KEY=your_signwell_api_key_here
SIGNWELL_TEMPLATE_ID=your_template_id_here
SIGNWELL_WEBHOOK_SECRET=your_webhook_secret_here
SIGNWELL_BASE_URL=https://api.getsignwell.com/v1
SIGNWELL_TEST_MODE=true
```

### .env.example Update
Replace all DOCUSIGN_ prefixed variables with SIGNWELL_ prefixed variables. Remove docusign_token entirely.

## File Changes

### 1. server/adapters/signwell.ts (NEW)
SignWell adapter module implementing the signing document API.

```typescript
// server/adapters/signwell.ts
import { z } from 'zod';

const SIGNWELL_BASE_URL = process.env.SIGNWELL_BASE_URL || 'https://api.getsignwell.com/v1';
const SIGNWELL_API_KEY = process.env.SIGNWELL_API_KEY;
const SIGNWELL_TEST_MODE = process.env.SIGNWELL_TEST_MODE === 'true';

const CreateDocumentSchema = z.object({
  template_id: z.string().optional(),
  name: z.string().min(1),
  signers: z.array(z.object({
    name: z.string().min(1),
    email: z.string().email(),
    role: z.string().optional(),
  })),
  files: z.array(z.object({
    name: z.string(),
    url: z.string().url(),
  })).optional(),
  test_mode: z.boolean().default(true),
  metadata: z.record(z.string()).optional(),
});

export async function createSignWellDocument(payload: z.infer<typeof CreateDocumentSchema>) {
  if (!SIGNWELL_API_KEY) {
    throw new Error('SIGNWELL_API_KEY is not configured');
  }

  const normalized = CreateDocumentSchema.parse({
    ...payload,
    test_mode: SIGNWELL_TEST_MODE,
  });

  const res = await fetch(`${SIGNWELL_BASE_URL}/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SIGNWELL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(normalized),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`SignWell API error: ${res.status} ${JSON.stringify(err)}`);
  }

  return res.json();
}

export async function getSignWellDocument(documentId: string) {
  if (!SIGNWELL_API_KEY) {
    throw new Error('SIGNWELL_API_KEY is not configured');
  }

  const res = await fetch(`${SIGNWELL_BASE_URL}/documents/${documentId}`, {
    headers: {
      'Authorization': `Bearer ${SIGNWELL_API_KEY}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`SignWell API error: ${res.status} ${JSON.stringify(err)}`);
  }

  return res.json();
}

export async function getSignWellSigningUrl(documentId: string): Promise<string> {
  const doc = await getSignWellDocument(documentId);
  if (doc.signers && Array.isArray(doc.signers)) {
    const signer = doc.signers[0];
    if (signer?.signing_url) {
      return signer.signing_url;
    }
  }
  throw new Error('No signing URL found for document');
}

export async function getSignWellTemplates() {
  if (!SIGNWELL_API_KEY) {
    throw new Error('SIGNWELL_API_KEY is not configured');
  }

  const res = await fetch(`${SIGNWELL_BASE_URL}/templates`, {
    headers: {
      'Authorization': `Bearer ${SIGNWELL_API_KEY}`,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`SignWell API error: ${res.status} ${JSON.stringify(err)}`);
  }

  return res.json();
}
```

### 2. server/adapters/signwell-blitz.ts (NEW)
Orchestrator/Blitz script for batch or outreach-signing workflows.

```typescript
// server/adapters/signwell-blitz.ts
import { createSignWellDocument, getSignWellSigningUrl } from './signwell';

export interface SignWellBlitzOptions {
  template_id?: string;
  signers: Array<{
    name: string;
    email: string;
  }>;
  documentName: string;
  metadata?: Record<string, string>;
}

export async function signWellBlitz(contacts: SignWellBlitzOptions[]) {
  if (!process.env.SIGNWELL_API_KEY) {
    console.error('[signwell-blitz] SIGNWELL_API_KEY not set, skipping');
    return { skipped: true, reason: 'missing_key' };
  }

  const results: Array<{
    contact: SignWellBlitzOptions;
    document_id?: string;
    signing_url?: string;
    error?: string;
  }> = [];

  for (const contact of contacts) {
    try {
      const doc = await createSignWellDocument({
        template_id: contact.template_id,
        name: contact.documentName,
        signers: contact.signers,
        metadata: contact.metadata,
      });

      const signingUrl = await getSignWellSigningUrl(doc.id);

      results.push({
        contact,
        document_id: doc.id,
        signing_url: signingUrl,
      });
    } catch (err) {
      results.push({
        contact,
        error: (err as Error).message,
      });
    }
  }

  return {
    success: results.filter(r => !r.error).length,
    failed: results.filter(r => !!r.error).length,
    results,
  };
}

export async function createOutreachDocument(signer: { name: string; email: string }, docName: string) {
  const result = await signWellBlitz([{
    signers: [signer],
    documentName: docName,
    metadata: { source: 'outreach', created_at: new Date().toISOString() },
  }]);
  return result.results[0];
}
```

### 3. api/auth/route.ts (or similar auth callback)
Remove DocuSign JWT grant / token exchange. Replace with simple SignWell API key usage.

**Before (DocuSign):**
- Obtain JWT assertion
- Exchange for access token
- Store docusign_token in session/env
- Token refresh on expiry

**After (SignWell):**
- No token exchange needed
- SIGNWELL_API_KEY used directly for all requests
- No session storage required

## Migration Steps

### Phase 1: Scaffolding
- [x] Create `server/adapters/signwell.ts` adapter
- [x] Create `server/adapters/signwell-blitz.ts` orchestrator
- [x] Update `.env.example` with SIGNWELL_ variables
- [x] Remove DOCUSIGN_ variables from .env.example

### Phase 2: Integration
- [ ] Replace all `docusign_token` references with `SIGNWELL_API_KEY`
- [ ] Update outbound email/signing flows to use `signWellBlitz` or `createSignWellDocument`
- [ ] Update webhook handlers to listen for SignWell document events
- [ ] Test document creation with `testMode: true`

### Phase 3: Outreach Flow Replacement
- [ ] Replace DocuSign-based outreach sequences with SignWell-based sequences
- [ ] Update email templates to reference SignWell signing links
- [ ] Update tracking/analytics for SignWell document events

### Phase 4: DNS/Domain (authichain.com)
- [x] Root A record: authichain.com -> 76.76.21.21 (Vercel)
- [x] www CNAME: www.authichain.com -> cb34f8b059d59433.vercel-dns-017.com
- [x] Root domain authichain.com added to Vercel project authichain-unified
- [x] www.authichain.com added to Vercel project authichain-unified
- [x] Both domains showing Valid Configuration on Vercel
- [x] DNS propagation verified (authichain.com redirects to www.authichain.com)
- [x] Site live at https://www.authichain.com

### Phase 5: Production Cutover
- [ ] Set SIGNWELL_TEST_MODE=false in production
- [ ] Verify 25 document/month limit is not exceeded
- [ ] Monitor SignWell dashboard for quota usage
- [ ] Disable DocuSign integration

## Test Plan

### Unit Tests
1. **createSignWellDocument** - verify document creation with testMode
2. **getSignWellDocument** - verify document retrieval by ID
3. **getSignWellSigningUrl** - verify signing URL extraction
4. **getSignWellTemplates** - verify template listing
5. **signWellBlitz** - verify batch creation (success + partial failure cases)

### Integration Tests
1. Create document with template_id - verify signer receives email
2. Create document with inline files (url-based) - verify attachment
3. Verify testMode documents are marked as test and not billed
4. Verify webhook receives document_delivered and document_signed events
5. Verify 401 when SIGNWELL_API_KEY is invalid
6. Verify error handling when API key missing

### Browser Automation Tests (E2E)
1. Navigate to https://www.authichain.com - verify page loads
2. Trigger outreach flow -> verify SignWell document created
3. Click signing link -> verify SignWell signing page renders
4. Complete signing -> verify webhook fires
5. Verify authichain.com -> www.authichain.com redirect
6. Verify TLS/SSL cert valid on both root and www
7. Verify DNS propagation - both A and CNAME resolve correctly

### DNS/Infrastructure Tests
1. `dig authichain.com A` -> 76.76.21.21
2. `dig www.authichain.com CNAME` -> cb34f8b059d59433.vercel-dns-017.com
3. TLS cert check: both root and www serve valid HTTPS
4. Vercel domain status: both show Valid Configuration

## Rollback Plan

If SignWell integration fails or exceeds quota:

1. **Immediate rollback**: Revert git commit adding signwell.ts / signwell-blitz.ts
2. **Env rollback**: Restore DOCUSIGN_ variables in .env
3. **Code rollback**: Revert auth/signing routes to use DocuSign adapter
4. **DNS**: No DNS changes needed for rollback (SignWell is backend-only)

## SignWell Limits (Free Tier)

- 25 documents/month (documents count = unique signing requests)
- All testMode documents DO NOT count toward quota
- Production documents count toward quota
- Upgrade to paid plan if volume exceeds 25/month

## API Reference

### SignWell Endpoints Used
- `POST /v1/documents` - Create a document
- `GET /v1/documents/{id}` - Get document details and signer URLs
- `GET /v1/templates` - List available templates
- Webhook events: document.delivered, document.signed, document.viewed, document.declined

### Auth Method
Bearer token via Authorization header:
```
Authorization: Bearer YOUR_SIGNWELL_API_KEY
```

## Notes

- This migration preserves all prior instructions verbatim
- Zero-dollar path maintained via testMode and free tier
- No DocuSign tokens (docusign_token) used anywhere
- DNS/domain changes keep authichain.com routing through zero-dollar SignWell path
- Browser automation used for end-to-end validation
- DNS A vs CNAME conflicts resolved on Cloudflare
- Vercel domain attachment complete for authichain.com and www.authichain.com

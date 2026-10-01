# High-Value Asset Passport Pilot

## Purpose

Use a real physical object to exercise AuthiChain's trust boundary without creating a new vertical protocol.

The first reference object is a small sealed platinum bar in Valcambi Suisse assay packaging. The pilot is not an authenticity determination. The supplied photographs are evidence of what was observed visually; they are not sufficient by themselves to establish provenance, issuer control, assay validity or physical composition.

## Pilot workflow

physical object
  -> identifier capture
  -> issuer claim
  -> evidence binding
  -> optional physical inspection
  -> lifecycle/custody events
  -> signed attestation
  -> AuthiChain verification

### Phase A — identity

Capture, under an authorized inspection:

- exact serial;
- exact certificate identifier;
- any GS1 identifier present;
- package/bar relationship;
- issuer namespace.

Never infer or invent an identifier from a blurry image.

### Phase B — evidence

Bind each material claim to an evidence object:

- assay/certificate image digest;
- package photographs;
- measured weight;
- dimensions;
- inspection report;
- issuer lookup response, where available.

Evidence hashes establish integrity of the referenced evidence; they do not establish the truth of the underlying claim.

### Phase C — physical inspection

Keep inspection separate from issuer assertion. Possible methods include:

- visual serial/package match;
- calibrated weight measurement;
- dimensional measurement;
- XRF;
- density;
- microscopy or other authorized assay methods.

Record method, instrument/operator, timestamp and evidence reference.

### Phase D — lifecycle

Represent manufacture, packaging, inspection, shipment and custody as events. Revocation and supersession are status changes, not evidence of physical composition.

### Phase E — verification

Return separate dimensions for:

- identifier;
- issuer;
- cryptographic claim integrity;
- evidence integrity;
- physical inspection;
- lifecycle status;
- custody continuity.

Do not collapse these dimensions into an unsupported "authentic" claim.

## Scope

This module is deliberately generic. The precious-metal fixture is the first example; batteries, electronics, regulated goods and other physical assets should reuse the same identity/evidence/event primitives.

## Current limitations

- The fixture contains redacted identifiers and no private ownership data.
- No production issuer key is committed.
- No live issuer lookup is implied.
- No assay result is inferred from photographs.
- No market value or ownership claim is included.
- The module does not yet add a production HTTP route; integration with the existing attestation/verification endpoints should be a separate change after protocol conformance is accepted.

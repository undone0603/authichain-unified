# AuthiChain Historical Identity Protocol v0.1

Authenticated historical identities extend AuthiChain's provenance model from physical objects to documentary identities.

## Graph

`IDENTITY -> SOURCE -> CLAIM -> TEMPORAL_STATE -> RESPONSE -> ATTESTATION`

Evidence classes are explicit: `direct`, `contextual`, `inferred`, `unknown`.

Temporal state is keyed by `person + as_of + location + knowledge_cutoff`. A historical simulation must not silently import later knowledge.

## Validation fixtures

- Nikola Tesla: archival/technical corpus and wireless-power material.
- Benjamin Franklin: deep editorial documentary corpus.
- Harriet Tubman: distributed archival, military and pension records; tests uncertainty and retrospective evidence boundaries.

## Rights

Rights are stored per source. Public-domain or CC0 status is never inferred globally from the historical figure's death date.

## v0.1 acceptance criteria

- Every claim has at least one evidence edge.
- Every temporal state has an explicit knowledge cutoff.
- Generated dialogue is reconstruction, never silently presented as a verbatim quotation.
- Attestation input is deterministic from canonicalized identity, source, claim, state and edge data.
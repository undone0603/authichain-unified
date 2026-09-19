# AuthiChain Accountability Identity Protocol v0.1

Accountability identities apply AuthiChain provenance to deceased perpetrators and the documented systems around them.

## Principle

**Preserve the record. Center the people harmed. Never let the perpetrator control the narrative.**

This protocol is not a synthetic “chat with a criminal” product. Persona reconstruction, if ever enabled, is secondary to a source-grounded documentary record.

## Graph

`PERPETRATOR -> CONDUCT / SURVIVOR RECORD / INSTITUTIONAL RECORD / LEGAL RECORD / ACCOUNTABILITY RECORD -> HISTORICAL IDENTITY`

Survivors are first-class subjects and are never required to be represented as subnodes of the perpetrator.

## Evidence classes

Use descriptive evidence states rather than a numerical truth score:

- `documented` — supported by an identified documentary source.
- `adjudicated` — established by a court or other identified adjudicative record.
- `testimonial` — testimony or statement attributed to a source.
- `corroborated` — supported by multiple independent evidence paths.
- `alleged_disputed` — allegation or materially disputed claim.
- `unknown` — unresolved or not established by the available record.

Association is never equivalent to wrongdoing. A person's appearance in a contact book, photograph, travel record, email, or other document must not automatically become a claim of criminal conduct.

## Survivor protections

- Never ingest survivor identifying information merely because it appears in a public document.
- Preserve redaction metadata and reason codes.
- Support visibility states: `public_pseudonymous`, `restricted`, `counsel_only`, `excluded`.
- Do not charge survivors for access to records concerning themselves.
- Do not monetize graphic material, private trauma, or survivor identity.
- Keep perpetrator simulation off by default.

## Temporal accountability

Every accountability state is bound to `as_of + knowledge_cutoff + location`. The system must not project later evidence, later public knowledge, or later legal outcomes backward into an earlier state.

## Narrative vs. record

The UI should expose:

`claim -> source -> source type -> evidence state -> corroboration -> contradiction -> temporal state -> redaction`

A generated response must distinguish what the sources establish from interpretation and from unknowns.

## Epstein pilot boundary

The initial pilot uses only public, official records and contains no survivor names, contact details, or other direct identifiers. DOJ's current Epstein Library states that victim names and identifying information are redacted and warns that some released material may contain sensitive sexual content. The protocol therefore treats privacy/redaction metadata as part of provenance, not as missing-data noise.

The pilot should be useful for researchers, publishers, documentary teams, museums, universities, and accountability-focused archives without turning victimization into entertainment.

## Acceptance criteria

- Every substantive claim has a source edge.
- Every claim has a descriptive evidence state.
- Survivor records are independently addressable and privacy-scoped.
- Redactions carry an explicit reason.
- Associations cannot silently become misconduct claims.
- Every temporal state has an explicit knowledge cutoff.
- Synthetic dialogue is clearly labeled reconstruction and is never presented as recorded speech.
- Attestation input is deterministic from canonicalized protocol data.

# AuthiChain Living Identity Protocol v0.1

A living-person identity is a verifiable record of identity, provenance, credentials, attribution, and authorization. It is not ownership of a person, a reputation score, or an AI impersonation.

## Rights-first protocol boundary

AuthiChain verifies provenance, identity, authorization, and temporal state. It does **not** determine a person's moral worth, political worth, credibility as a human being, or fitness to participate in society.

### Core graph

`PERSON -> CLAIM -> SOURCE -> ATTESTATION -> TEMPORAL_STATE`

Optional authority graph:

`PERSON -> AUTHORIZATION -> DELEGATE/AGENT -> CAPABILITY -> ACTION`

### Claim states

Use descriptive states rather than a person-level trust score:

- `self_attested` — directly attested by the identity holder.
- `issuer_attested` — attested by an identified credential issuer.
- `source_attested` — supported by an identified authoritative source.
- `public_record` — documented in an identified public source.
- `third_party_claim` — asserted by another party without identity-holder attestation.
- `disputed` — materially contested.
- `unknown` — not established by the available evidence.

### Non-negotiable protections

- Identity verification must not imply endorsement of every associated claim.
- Public availability does not by itself authorize republication of sensitive personal data.
- Sensitive personal data should be minimized or excluded by default.
- No person-level trust, morality, credibility, political, or social-worth score.
- No synthetic speech, image, video, or dialogue may be presented as authentic personal expression unless it is sourced/attested as such.
- AI representation of a living person requires explicit authorization from that person or an authorized representative.
- Authorization must be scoped by capability, audience, time, and transaction limits where applicable.
- Delegated agents must identify themselves as agents and preserve attribution.
- Claims must support correction, dispute, revocation, and temporal state.
- Commercial identity use requires an explicit authorization path where applicable; a public record is not automatically a commercial license.
- The protocol must not infer private facts from public records.

## Identity vs. reputation

AuthiChain should return evidence states such as:

`IDENTITY: VERIFIED`
`CREDENTIAL: ISSUER_ATTESTED`
`STATEMENT ATTRIBUTION: SOURCE_ATTESTED`
`CURRENT STATUS: UNKNOWN`

It must not collapse these into a single human "trust score."

## AI representation

A digital representative is an authorization object, not a claim that an AI system is the human.

A valid authorization should specify:

- principal identity
- delegate/agent identity
- permitted capabilities
- prohibited capabilities
- audience/scope
- effective and expiry times
- revocation state
- transaction/value limits when relevant

Without valid authorization, the system may provide source-grounded information about a person but must not represent generated content as that person's own speech or action.

## Public figures

Public figures can have public identity records, but public status does not erase privacy or attribution boundaries. Political figures receive the same protocol treatment: document source and attribution without converting the identity record into an endorsement, opposition signal, or political score.

## Commercial boundary

AuthiChain can sell verification infrastructure, credential verification, provenance APIs, authorization/delegation controls, and audit trails. It should not monetize sensitive personal trauma or expose private identity data merely because it is technically obtainable.

## Acceptance criteria

- Every substantive claim has provenance.
- Identity verification is separate from claim verification.
- No person-level reputation score exists in the schema.
- Sensitive data is explicitly minimized/excluded.
- Dispute and revocation states are representable.
- AI delegation requires explicit authorization and scope.
- Generated content cannot silently become attributed human speech.
- Temporal validity and authorization expiry are explicit.
- Commercial use has an authorization boundary.
- Test fixtures include prohibited patterns and validator failures.

# TRUmark: offline physical evidence intake

Status: development branch; no production claim or issuer authority. Related to #2682.

## Purpose

Compare actual private capture and examiner-report bytes with their declared SHA-256 hashes; reject missing, altered, unsafe or incomplete material before *independent review*. This gate never issues an attestation, verifies an issuer, measures a metal or calls a network endpoint.

## Run

- From the repository root, Node.js 22+: node --test scripts/trumark/physical-evidence-intake.test.mjs
- For a real, privately stored package: node scripts/trumark/physical-evidence-intake.mjs /private/folder/manifest.json

The 16 tests use **synthetic** report/capture bytes and fictional people. They are code checks, not physical examination evidence.

## Private manifest requirements

The manifest schema is authichain.trumark.physical-evidence-intake.v0.1 and includes:
- observationId: private pilot URN (not an invented global identifier or GS1 GTIN)
- challenge: id, 32-hex TRM nonce, nonceObserved, issuedAt, expiresAt, capturedAt, media { file, sha256 }
- examiner: business, person, attributionReference, examinedAt
- method: name, instrument, packagingState (sealed/opened/unknown), scope, limitations
- report: claimedIssuer, scope, limitations, findings, evidence { file, sha256 }
- status: EVIDENCE_ONLY_UNVERIFIED

Timestamps must use UTC ISO-8601 seconds and the capturedAt time must fall between issuedAt and expiresAt. All file references must be relative to the private manifest directory; the files are actually read and hashed. No source files, full serial numbers, original media or examiner contact information should be committed.

## Trust boundaries

A structurally accepted submission only means the supplied data and the two file hashes are consistent. Examiner identity, independence, report source channel, issuance authority, measurement method/uncertainty, unit identification and material composition remain UNREVIEWED or NOT_ESTABLISHED.

The nonceObserved field is self-reported metadata. Human/vision review of *unedited original capture media* is still required to determine whether the nonce, bar and package actually appear together. Unreviewed metadata is not physical binding.

Distinct next gates:
1. Obtain new, challenge-bound capture of the actual unit (the prior owner photos are baseline only).
2. Obtain a genuine, dated, independently attributable report using an appropriate method; test limitations through assay-card packaging must be explicitly described.
3. Independently check the examiner issuer/source/signature and match the documented report to the physical unit. Check manufacturer serial provenance separately.
4. Only with authorized issuer review use existing AuthiChain v0.1 Ed25519/JWS and durable status machinery; no new registry or premature production attestation.
5. Element material attestations (Pt, atomic number 78, etc.) remain future goals and require competent measured results, not markings alone.

No payments, cloud deploys, production keys, unsolicited outreach, blockchain anchoring, or authenticity badges are performed here.